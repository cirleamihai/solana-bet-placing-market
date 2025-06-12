import {useEffect, useState} from "react";
import {useParams} from "react-router-dom";
import {useAnchorProgram} from "@/lib/anchor";
import {supabase} from "@/lib/supabase";
import {PublicKey} from "@solana/web3.js";
import {GridLoader} from "react-spinners";
import MarketPriceChart, {ChartPoint} from "@/components/MarketPriceChart";
import MarketTradeSection, {TransactionDetails} from "@/components/MarketTradeSection";
import {toast} from "sonner";
import {Button} from "@/components/ui/button";
import AddInitialLiquidityModal from "@/components/AddInitialLiquidityModal";

export default function MarketDetails() {
    const {marketPubkey} = useParams();          // ← from route

    const {program} = useAnchorProgram();
    const [market, setMarket] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [question, setQuestion] = useState<string>("");
    const [createdAt, setCreatedAt] = useState<string>("");
    const [_yesProb, setYesProb] = useState<number>(50);
    const [volume, setVolume] = useState<number>(0);
    const [reloadMarket, setReloadMarket] = useState(0);
    const [liquidityEmptyModal, setLiquidityEmptyModal] = useState(false);
    const [wantsToAddLiquidity, setWantsToAddLiquidity] = useState(false);
    const [somethingWrong, setSomethingWrong] = useState<string | null>(null);
    const [poolAccount, setPoolAccount] = useState<any>(null); // Replace 'any' with the actual type if known
    const [chartData, setChartData] = useState<ChartPoint[]>([]);
    const [submitting, setSubmitting] = useState(false);
    const [yesPrice, setYesPrice] = useState<number>(-1);
    const [noPrice, setNoPrice] = useState<number>(-1);
    const [transactionDetails, setTransactionDetails] = useState<TransactionDetails[]>([]);

    useEffect(() => {
        if (!marketPubkey) return;
        (async () => {
            setLoading(true);
            try {
                /** ---------- on-chain fetch ---------- **/
                const pubkey = new PublicKey(marketPubkey);
                // @ts-ignore
                const marketAcct = await program.account.market.fetch(pubkey);
                if (!marketAcct) {
                    setSomethingWrong(`Market not found. Please check the public key. ${pubkey}}`);
                }
                setMarket(marketAcct);

                // Getting the pool PDA for this market
                const [poolPda] = PublicKey.findProgramAddressSync(
                    [Buffer.from("pool"), pubkey.toBuffer()],
                    program.programId
                );
                // @ts-ignore
                const poolAcct = await program.account.marketPool.fetch(poolPda);
                if (!poolAcct) {
                    setSomethingWrong(`Pool not found for market ${marketPubkey}.`);
                    return;
                }
                if (poolAcct.liquidityShares.toNumber() === 0) {
                    setLiquidityEmptyModal(true);
                } else {
                    setLiquidityEmptyModal(false);
                }

                setPoolAccount(poolAcct);

                const yes = Number(poolAcct?.yesLiquidity ?? 0);
                const no = Number(poolAcct?.noLiquidity ?? 0);
                const totalVol = Number(poolAcct?.usdCollateral ?? 0) / 10 ** 9;
                const prob = yes + no ? Math.floor((yes / (yes + no)) * 100) : 50;

                setYesProb(prob);
                setVolume(totalVol);

                /** ----------- metadata --------------- **/
                const {data} = await supabase
                    .from("market_metadata")
                    .select("market_name, created_at")
                    .eq("market_pubkey", marketPubkey)
                    .single();

                setQuestion(data?.market_name ?? `Market ${marketPubkey.slice(0, 4)}…`);
                setCreatedAt(data?.created_at);
            } catch (err) {
                console.error("Failed to load market page:", err);
            } finally {
                setLoading(false);
            }
        })();
    }, [marketPubkey, program]);

    useEffect(() => {
        const fetchDbMarketData = async () => {
            if (!marketPubkey) return;

            const {data, error} = await supabase
                .from("bets")
                .select()
                .eq("market_pubkey", marketPubkey)
                .order("created_at", {ascending: false})

            if (error) {
                console.log("Error fetching market data:", error);
                toast.error("Error fetching market data.");
            }
            if (data) {
                setTransactionDetails(data);
            }
        }
        fetchDbMarketData();
    }, [reloadMarket]);

    useEffect(() => {
        const computeChartData = () => {
            if (transactionDetails.length > 0) {
                const dataForChart = transactionDetails.map((tx: TransactionDetails) => ({
                    t: new Date(tx.created_at).getTime(), // Convert to milliseconds since epoch
                    yesProb: (tx.yes_price).toFixed(2), // Assuming yes_prob is a field in your transaction data
                    noProb: (tx.no_price).toFixed(2)
                }));

                const actualData = yesPrice >= 0 && noPrice >= 0 ? [
                    {t: Date.now(), yesProb: yesPrice.toFixed(2), noProb: noPrice.toFixed(2)},
                    ...dataForChart
                ] : dataForChart;
                setChartData(actualData);
            }
        }

        computeChartData();
    }, [reloadMarket, transactionDetails, yesPrice, noPrice]);

    if (loading) {
        return (
            <div className="flex justify-center items-center h-80">
                <GridLoader color="#a6d1e6"/>
            </div>
        );
    }


    if (somethingWrong) {
        return (
            <div className="text-center text-red-500 mt-20">
                <h2 className="text-xl font-semibold mb-4">Error</h2>
                <p>{somethingWrong}</p>
            </div>
        );
    }

    return (
        <main className="w-[80%] mx-auto mt-10 px-4 md:px-0 text-white">
            {/* ── Top summary row ─────────────────────── */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 mb-5">
                <h1 className="text-2xl md:text-3xl font-semibold leading-snug break-words">
                    {question}
                </h1>

                <div className="flex items-center gap-8 mr-2">
                    <Button
                        className="bg-purple-700 hover:bg-purple-950 cursor-pointer text-slate-100 font-semibold px-6 py-2 h-10.5 rounded text-lg flex items-center justify-center"
                        onClick={(e) => {
                            e.preventDefault();
                            setWantsToAddLiquidity(true);
                        }}
                    >
                        <div>
                            + Add Liquidity
                        </div>
                    </Button>
                    {createdAt &&
                        <span className="text-md text-slate-300">
                        Created at &nbsp; <span
                            className="font-medium text-white"> {new Date(createdAt).toLocaleDateString("en-US", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                            hour: "numeric",
                            minute: "numeric",
                        })}</span>
                    </span>
                    }

                    <span className="text-md text-slate-300">
                        Volume &nbsp; <span
                        className="font-medium text-white"> ${volume.toLocaleString()}
                        </span>
                    </span>
                </div>
            </div>

            {/* placeholder for future book / actions */}
            <div className={"mb-5"}>
                <MarketTradeSection
                    marketPool={poolAccount}
                    marketKey={marketPubkey ? new PublicKey(marketPubkey) : null}
                    market={market}
                    reloadMarket={reloadMarket}
                    setReloadMarket={setReloadMarket}
                    transactionDetails={transactionDetails}
                    setYesPrice={setYesPrice}
                    setNoPrice={setNoPrice}
                />
            </div>

            {/* ── Price history chart ─────────────────── */}

            <div className="flex flex-col justify-between mb-4 mt-10">
                <div className="text-4xl font-bold text-slate-200 tracking-tight mb-5 flex items-center gap-3">
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-8 w-8 text-blue-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M4 6v12m4-8v8m4-4v4m4-6v6m4-8v8"
                        />
                    </svg>
                    Price Chart
                </div>

                <MarketPriceChart points={chartData}/>
            </div>
            <div className="flex flex-col justify-between mt-10">
                <div className="text-4xl font-bold text-slate-200 tracking-tight mb-5 flex items-center gap-3">
                    <div className="flex items-center gap-2">
                        {/* Solana Coin Icon */}
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-10 w-10"
                            viewBox="0 0 64 64"
                        >
                            <defs>
                                {/* Coin gradient */}
                                <radialGradient id="coinGrad" cx="50%" cy="50%" r="50%">
                                    <stop offset="0%" stopColor="#003366"/>
                                    <stop offset="10%" stopColor="#001933"/>
                                </radialGradient>

                                {/* Solana logo gradient */}
                                <linearGradient id="solGrad" x1="0%" y1="100%" x2="100%" y2="0%">
                                    <stop offset="0%" stopColor="#00ffa3"/>
                                    <stop offset="100%" stopColor="#dc1fff"/>
                                </linearGradient>
                            </defs>

                            {/* Outer coin circle */}
                            <circle cx="32" cy="32" r="30" fill="url(#coinGrad)"/>

                            {/* Solana logo: three slanted bars */}
                            {/** Each bar is a parallelogram rotated slightly */}
                            <g transform="translate(14, 20)">
                                <polygon
                                    points="0,0 28,0 24,8 0,8"
                                    fill="url(#solGrad)"
                                />
                            </g>
                            <g transform="translate(20, 28)">
                                <polygon
                                    points="0,0 28,0 24,8 0,8"
                                    fill="url(#solGrad)"
                                    opacity="0.8"
                                />
                            </g>
                            <g transform="translate(26, 36)">
                                <polygon
                                    points="0,0 28,0 24,8 0,8"
                                    fill="url(#solGrad)"
                                    opacity="0.6"
                                />
                            </g>
                        </svg>
                    </div>

                    Liquidity Pool
                </div>


            </div>
            {(liquidityEmptyModal || wantsToAddLiquidity) && (
                <AddInitialLiquidityModal
                    marketPubkey={marketPubkey || ""}
                    market={market}
                    setWantsToAddLiquidity={setWantsToAddLiquidity}
                    setLiquidityEmptyModal={setLiquidityEmptyModal}
                    submitting={submitting}
                    setSubmitting={setSubmitting}
                />
            )}
        </main>
    );
}
