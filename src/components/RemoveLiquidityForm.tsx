import {Dispatch, SetStateAction, useEffect, useMemo, useRef, useState} from "react";
import {Button} from "@/components/ui/button";
import {Cell, Pie, PieChart, ResponsiveContainer, Tooltip} from "recharts";
import ConnectWalletButton from "@/components/ConnectWalletButton";
import {useWallet} from "@solana/wallet-adapter-react";
import {PublicKey} from "@solana/web3.js";
import {getRemoveLiquidityPotentialBenefits} from "@/blockchain/computeLiquidityBenefits";

type Props = {
    submitting: boolean;
    setSubmitting: Dispatch<SetStateAction<boolean>>;
    reloadMarket: number;
    setReloadMarket: Dispatch<SetStateAction<number>>;
    setReloadLiquidityPool: Dispatch<SetStateAction<number>>;
    poolAccount: any,
    userShares: number,
    marketKey: PublicKey,
    market: any,
};

export default function RemoveLiquidityForm({
                                                submitting,
                                                poolAccount,
                                                userShares,
                                                marketKey,
                                                setSubmitting,
                                                setReloadMarket,
                                                setReloadLiquidityPool,
                                                market,
                                                reloadMarket,
                                            }: Props) {
    const [sharesToRemove, setSharesToRemove] = useState<number>(0);
    const [usdToReceiveForLPShares, setUsdToReceiveForLPShares] = useState<number>(0);
    const [outcomeShares, setOutcomeShares] = useState<string>("0.00");
    const [_maxAmountReached, setMaxAmountReached] = useState(false);
    const [liquidityRemoved, setLiquidityRemoved] = useState(false);
    const wallet = useWallet();
    const chartDataRef = useRef([]);
    const justPurchased = useRef(false);
    // const MAX_AMOUNT = maxShares;
    const MAX_AMOUNT = userShares;

    const handleAddAmount = (value: number) => {
        if (sharesToRemove + value < MAX_AMOUNT) {
            setSharesToRemove((prev) => prev + value);
            setMaxAmountReached(false);
        } else {
            setMaxAmountReached(true); // Set flag if adding this value exceeds max
        }
    };

    const handleAmountTyping = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value.replace(/[^0-9]/g, ""); // Allow only numbers
        if (Number(value) < MAX_AMOUNT) {
            setSharesToRemove(value ? Number(value) : 0); // Convert to number or reset to 0
            setMaxAmountReached(false);
        } else {
            setSharesToRemove(MAX_AMOUNT); // Set to max if input exceeds
            setMaxAmountReached(true);
        }
    }

    const chartData = useMemo(() => {
        if (justPurchased.current) return chartDataRef.current;

        let total = poolAccount?.liquidityShares ? poolAccount.liquidityShares.toNumber() / 10 ** 9 : 0;
        total -= usdToReceiveForLPShares; // Adjust total by shares to remove
        const mine = userShares - sharesToRemove;
        const userSharePercentage = total > 0 ? (mine / total) * 100 : 0;
        const othersSharePercentage = 100 - userSharePercentage;
        const newChartData = [
            {name: `You ${userSharePercentage.toFixed(2)}%`, value: mine},
            {name: `Others ${othersSharePercentage.toFixed(2)}%`, value: total - mine},
        ];

        // @ts-ignore
        chartDataRef.current = newChartData;
        return newChartData;
    }, [sharesToRemove, poolAccount?.liquidityShares, usdToReceiveForLPShares]);

    useEffect(() => {
        const liquidityBenefits = getRemoveLiquidityPotentialBenefits(
            Number(poolAccount.liquidityShares) / 10 ** 9,
            Number(poolAccount.yesLiquidity) / 10 ** 9,
            Number(poolAccount.noLiquidity) / 10 ** 9,
            sharesToRemove
        )
        setUsdToReceiveForLPShares(liquidityBenefits.moneyToReceive);



        const outcomeShares = liquidityBenefits.yesShares ?
            liquidityBenefits.yesShares.toLocaleString("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            }) + " YES" : liquidityBenefits.noShares ?
                liquidityBenefits.noShares.toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                }) + " NO" : "0.00";
        setOutcomeShares(outcomeShares)
    }, [sharesToRemove, reloadMarket]);


    return (
        <>
            {/* Shares input & quick-selects */}
            <div className="text-sm text-slate-400 mb-1">LP Shares</div>
            <div className="flex items-center justify-between mb-8 w-full">
                <input
                    type="text"
                    className="bg-transparent w-64 text-3xl font-semibold text-slate-300 focus:outline-none absolute"
                    value={sharesToRemove.toLocaleString()}
                    onChange={(e) => handleAmountTyping(e)}
                />
                <div className="flex gap-2 ml-auto">
                    {[10, 50, 100, 1000].map((val) => (
                        <button
                            key={val}
                            onClick={() => handleAddAmount(val)}
                            className="bg-slate-800 border border-gray-700 px-3 py-1 cursor-pointer rounded-md text-white text-sm hover:bg-slate-700"
                        >
                            +{val}
                        </button>
                    ))}
                    <button
                        onClick={() => setSharesToRemove(MAX_AMOUNT)}
                        className="bg-slate-800 border border-gray-700 px-3 py-1 rounded-md cursor-pointer text-white text-sm hover:bg-slate-700"
                    >
                        Max
                    </button>
                    <button
                        onClick={() => {
                            setSharesToRemove(0);
                            setMaxAmountReached(false);
                        }}
                        className="bg-pink-600 border border-gray-700 px-3 py-1 rounded-md cursor-pointer text-white text-sm hover:bg-pink-800"
                    >
                        Reset
                    </button>
                </div>
            </div>


            {wallet.connected ? (
                <div className="mt-12">
                    {/* ── Chart & Shares Grid ── */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                        <div
                            className=" md:col-span-1 md:col-start-1 flex flex-col justify-center items-center bg-[#270740] p-5 rounded-xl shadow-inner border border-[#5c2c78]
">

                            <div className="text-sm uppercase text-slate-400 tracking-widest mb-1">
                                Potential Pool Share
                            </div>
                            <div className="md:col-span-2 flex items-center">
                                <div className="w-35 h-28">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={chartData}
                                                dataKey="value"
                                                nameKey="name"
                                                cx="50%"
                                                cy="50%"
                                                innerRadius="50%"
                                                outerRadius="80%"
                                                stroke="none"
                                            >
                                                <Cell fill="#00ffa3"/>
                                                <Cell fill="#693992"/>
                                            </Pie>
                                            <Tooltip formatter={(v: any) => `${v.toLocaleString()} shares`}/>
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                                {/* Legend on the right */}
                                <div className="ml-6 space-y-2">
                                    {chartData.map((entry, idx) => (
                                        <div key={entry.name} className="flex items-center text-slate-200">
                                          <span
                                              className="w-3 h-3 rounded-full inline-block mr-2"
                                              style={{backgroundColor: idx === 0 ? "#00ffa3" : "#693992"}}
                                          />
                                            <span className="text-sm">{entry.name}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Shares to Purchase occupies 1/3 of the width */}
                        <div className="md:col-span-1 md:col-start-3 bg-[#270740] p-5 rounded-xl shadow-inner border border-[#5c2c78]
 flex flex-col items-center">
                            <div className="text-sm uppercase text-slate-400 tracking-widest mb-1 ">
                                USD-UBB TO RECEIVE
                            </div>
                            <div
                                className="text-xl font-bold text-purple-400">${usdToReceiveForLPShares.toLocaleString("en-US", {
                                maximumFractionDigits: 2,
                                minimumFractionDigits: 2
                            })}</div>

                            <div className="w-full border-b-2 mt-3 border-purple-800"></div>
                            <div className="text-sm uppercase text-slate-400 tracking-widest mb-1 mt-3 relative">
                                OUTCOME SHARES TO RECEIVE
                                <div className="group cursor-pointer absolute top-0.5 right-[-21px]">
                                    {/* Info SVG Icon */}
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        className="h-4 w-4 text-purple-400 hover:text-white transition duration-200"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                        strokeWidth={2}
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20 10 10 0 000-20z"
                                        />
                                    </svg>

                                    {/* Tooltip message */}
                                    <div
                                        className="absolute right-0 mt-2 w-64 text-xs text-white bg-gray-800 p-3 rounded-xl shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none transition duration-300 z-50">
                                        In case the market OUTCOMES are not equal, you will also receive shares from the
                                        least likely outcome. Users can trade these shares on the market for a profit.
                                    </div>
                                </div>
                            </div>
                            <div className={`text-xl font-bold ${outcomeShares.toLowerCase().includes("no") ?
                                "text-red-400" : outcomeShares.toLowerCase().includes("yes")
                                    ? "text-green-400" : "text-purple-400"}`}>{outcomeShares} SHARES
                            </div>


                        </div>
                    </div>

                    <Button
                        className={`w-full h-12 text-xl cursor-pointer font-semibold ${liquidityRemoved ? "bg-green-600 hover:bg-green-700" : "bg-[#630287] hover:bg-[#3f0164]"}`}
                        disabled={submitting || sharesToRemove <= 0}
                        onClick={() => {
                        }}
                    >
                        {submitting ? "Submitting…" : "Remove Liquidity"}
                    </Button>
                </div>
            ) : (
                <div className="w-full flex justify-center">
                    <ConnectWalletButton/>
                </div>
            )}
        </>
    );
}
