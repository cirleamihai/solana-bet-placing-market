import {useEffect, useState} from "react";
import {useNavigate, useParams} from "react-router-dom";
import {useAnchorProgram} from "@/lib/anchor";
import {supabase} from "@/lib/supabase";
import {PublicKey, Transaction} from "@solana/web3.js";
import {AnchorProvider} from "@coral-xyz/anchor";
import {GridLoader} from "react-spinners";
import MarketPriceChart from "@/components/MarketPriceChart";
import MarketTradeSection from "@/components/MarketTradeSection";
import {BN} from "@coral-xyz/anchor";
import {USD_MINT} from "@/lib/constants";
import {TOKEN_PROGRAM_ID} from "@coral-xyz/anchor/dist/cjs/utils/token";
import {toast} from "sonner";
import {createAssociatedTokenAccounts} from "@/blockchain/createAssociatedTokenAccounts";
import {Button} from "@/components/ui/button";

interface ChartPoint {
    t: number;          // milliseconds since epoch
    yesProb: number;    // 0-100
}

export default function MarketDetails() {
    const {marketPubkey} = useParams();          // ← from route
    const navigate = useNavigate(); // for closing modals

    const {program, wallet, connection} = useAnchorProgram();
    const [market, setMarket] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [question, setQuestion] = useState<string>("");
    const [createdAt, setCreatedAt] = useState<string>("");
    const [_yesProb, setYesProb] = useState<number>(50);
    const [volume, setVolume] = useState<number>(0);
    const [liquidityEmptyModal, setLiquidityEmptyModal] = useState(false);
    const [depositAmount, setDepositAmount] = useState<string>("");
    const [somethingWrong, setSomethingWrong] = useState<string | null>(null);
    const [poolAccount, setPoolAccount] = useState<any>(null); // Replace 'any' with the actual type if known
    const [chartData, setChartData] = useState<ChartPoint[]>([]);
    const [submitting, setSubmitting] = useState(false);

    const handleInitialLiquidity = async () => {
        if (!wallet?.publicKey || !marketPubkey || !market) return;
        const ataInstructions: any[] = []; // Instructions for creating associated token accounts
        const userUsd = (await createAssociatedTokenAccounts(USD_MINT, wallet.publicKey, wallet, connection, ataInstructions)).ata;
        // @ts-ignore
        const userYes = (await createAssociatedTokenAccounts(market.yesMint, wallet.publicKey, wallet, connection, ataInstructions)).ata;
        // @ts-ignore
        const userNo = (await createAssociatedTokenAccounts(market.noMint, wallet.publicKey, wallet, connection, ataInstructions)).ata;
        // @ts-ignore
        const userLp = (await createAssociatedTokenAccounts(market.lpShareMint, wallet.publicKey, wallet, connection, ataInstructions)).ata;

        // Get the market public key
        const marketKey = new PublicKey(marketPubkey);

        const [poolPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("pool"), marketKey.toBuffer()],
            program.programId
        );

        const [vaultPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("vault"), marketKey.toBuffer()],
            program.programId
        );

        const [yesLiquidityPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("yes_liquidity_pool"), marketKey.toBuffer()],
            program.programId
        );

        const [noLiquidityPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("no_liquidity_pool"), marketKey.toBuffer()],
            program.programId
        );

        try {
            const tx = new Transaction();
            ataInstructions.length > 0 && tx.add(...ataInstructions);

            const ix = await program.methods
                .addLiquidity(new BN(Number(depositAmount) * 10 ** 9))
                .accounts({
                    pool: poolPda,
                    market: marketKey,
                    vault: vaultPda,
                    // @ts-ignore
                    yesMint: market.yesMint,
                    // @ts-ignore
                    noMint: market.noMint,
                    // @ts-ignore
                    lpShareMint: market.lpShareMint,
                    userUsdAccount: userUsd,
                    userYesAccount: userYes,
                    userNoAccount: userNo,
                    userLpShareAccount: userLp,
                    liquidityYesTokensAccount: yesLiquidityPda,
                    liquidityNoTokensAccount: noLiquidityPda,
                    user: wallet.publicKey,
                    tokenProgram: TOKEN_PROGRAM_ID,
                })
                .instruction();

            tx.add(ix);

            // @ts-ignore
            const provider = program.provider as AnchorProvider;
            const _sig = await provider.sendAndConfirm(tx);

            toast.success("Liquidity added successfully!");
            setLiquidityEmptyModal(false);
        } catch (err) {
            console.error("Failed to add liquidity:", err);
            toast.error("Liquidity deposit failed.");
        }
    }


    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let val = e.target.value.replace(/\s/g, "").replace(",", ".");

        // Allow only digits and one decimal point
        if (/^\d*\.?\d{0,9}$/.test(val) || val === "") {
            setDepositAmount(val);
        }
    };

    const formatted = depositAmount
        ? Number(depositAmount).toLocaleString("", {
            minimumFractionDigits: depositAmount.includes(".") ? depositAmount.split(".")[1].length : 0,
            useGrouping: true,
        })
        : "";

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
                setCreatedAt(data?.created_at)

                /** ---------- chart seed -------------- **/
                    // TEMP: five mock points – replace once you wire event indexer
                const now = Date.now();
                setChartData([
                    {t: now - 4 * 3600e3, yesProb: prob - 3.52},
                    {t: now - 3 * 3600e3, yesProb: prob - 2},
                    {t: now - 2 * 3600e3, yesProb: prob},
                    {t: now - 1 * 3600e3, yesProb: prob + 1},
                    {t: now, yesProb: prob},
                ]);
            } catch (err) {
                console.error("Failed to load market page:", err);
            } finally {
                setLoading(false);
            }
        })();
    }, [marketPubkey, program]);

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
            {liquidityEmptyModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-black/60">
                    <div
                        className="bg-[#1f2937] p-6 rounded-2xl shadow-xl w-full max-w-md border border-slate-600 text-white">
                        <h2 className="text-2xl font-semibold mb-4">No Liquidity Found</h2>
                        <p className="text-red-300 mb-6">
                            This market currently has no liquidity. To enable trading, please add initial liquidity to
                            the pool.
                        </p>

                        <label className="block mb-2 text-sm font-medium text-slate-400">
                            Deposit Amount (USD-UBB)
                        </label>
                        <input
                            type="text"
                            inputMode="decimal"
                            className="w-full px-4 py-2 rounded-md bg-slate-800 border border-slate-600 text-white focus:outline-none mb-6"
                            value={formatted}
                            onChange={handleChange}
                        />

                        <div className="flex justify-end gap-3">
                            <button
                                className="px-4 py-2 rounded-md cursor-pointer bg-slate-700 hover:bg-slate-600 text-sm text-white"
                                onClick={() => {
                                    navigate("/"); // Close modal by navigating back
                                }}
                            >
                                Back
                            </button>
                            <Button
                                onClick={() => {
                                    setSubmitting(true);
                                    handleInitialLiquidity().then();
                                }}
                                className="px-4 py-2 rounded-md cursor-pointer bg-green-600 hover:bg-green-700 text-sm text-white font-semibold"
                                disabled={Number(depositAmount) === 0 || submitting}
                            >
                                {submitting ? (
                                    <>
                                        <svg
                                            className="animate-spin h-4 w-4 text-white"
                                            xmlns="http://www.w3.org/2000/svg"
                                            fill="none"
                                            viewBox="0 0 24 24"
                                        >
                                            <circle
                                                className="opacity-25"
                                                cx="12"
                                                cy="12"
                                                r="10"
                                                stroke="currentColor"
                                                strokeWidth="4"
                                            ></circle>
                                            <path
                                                className="opacity-75"
                                                fill="currentColor"
                                                d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 100 16 8 8 0 01-8-8z"
                                            ></path>
                                        </svg>
                                        Submitting...
                                    </>
                                ) : (
                                    "Submit"
                                )}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
}
