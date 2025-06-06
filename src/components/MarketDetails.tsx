// src/pages/MarketPage.tsx
import {useEffect, useState} from "react";
import {useParams} from "react-router-dom";
import {useAnchorProgram} from "@/lib/anchor";
import {supabase} from "@/lib/supabase";
import {PublicKey} from "@solana/web3.js";
import {GridLoader} from "react-spinners";
import ProbabilityRing from "@/components/ProbabilityRing";
import MarketPriceChart from "@/components/MarketPriceChart";
import MarketTradeSection from "@/components/MarketTradeSection";

interface ChartPoint {
    t: number;          // milliseconds since epoch
    yesProb: number;    // 0-100
}

export default function MarketDetails() {
    const {program} = useAnchorProgram();
    const {marketPubkey} = useParams();          // ← from route
    const [loading, setLoading] = useState(true);
    const [question, setQuestion] = useState<string>("");
    const [createdAt, setCreatedAt] = useState<string>("");
    const [yesProb, setYesProb] = useState<number>(50);
    const [volume, setVolume] = useState<number>(0);
    const [somethingWrong, setSomethingWrong] = useState<string | null>(null);
    const [chartData, setChartData] = useState<ChartPoint[]>([]);

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

                // Getting the pool PDA for this market
                const [poolPda] = PublicKey.findProgramAddressSync(
                    [Buffer.from("pool"), pubkey.toBuffer()],
                    program.programId
                );
                // @ts-ignore
                const poolAcct = await program.account.marketPool.fetch(poolPda);

                console.log(poolAcct);

                const yes = Number(poolAcct?.yesLiquidity ?? 0);
                const no = Number(poolAcct?.noLiquidity ?? 0);
                const totalVol = Number(poolAcct?.usdCollateral ?? 0);
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
                        className="font-medium text-white"> ${new Intl.NumberFormat().format(volume)}
                        </span>
                    </span>
                </div>
            </div>

            {/* placeholder for future book / actions */}
            <div className={"mb-5"}>
                <MarketTradeSection/>
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
        </main>
    );
}
