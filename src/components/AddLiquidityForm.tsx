import {Dispatch, SetStateAction, useEffect, useMemo, useState} from "react";
import {Button} from "@/components/ui/button";
import {useWallet} from "@solana/wallet-adapter-react";
import ConnectWalletButton from "@/components/ConnectWalletButton";
import {Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip} from "recharts";
import {getAddLiquidityPotentialBenefits} from "@/blockchain/computeLiquidityBenefits";

type Props = {
    amount: number;
    setAmount: Dispatch<SetStateAction<number>>;
    submitting: boolean;
    onSubmit: () => void;
    liquidityAdded: boolean;
    poolAccount: any,
    userShares: number,
};

const MAX_AMOUNT = 100_000_000; // 100 million

export default function AddLiquidityForm({
                                             amount,
                                             setAmount,
                                             submitting,
                                             onSubmit,
                                             liquidityAdded,
                                             poolAccount,
                                             userShares,
                                         }: Props) {
    const [_maxAmountReached, setMaxAmountReached] = useState(false);
    const [liquidityShares, setLiquidityShares] = useState<number>(0);
    const [outcomeShares, setOutcomeShares] = useState<string>("0");
    const wallet = useWallet();

    const handleAddAmount = (value: number) => {
        if (amount + value < MAX_AMOUNT) {
            setAmount((prev) => prev + value);
            setMaxAmountReached(false);
        } else {
            setMaxAmountReached(true); // Set flag if adding this value exceeds max
        }
    };

    const handleAmountTyping = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value.replace(/[^0-9]/g, ""); // Allow only numbers
        if (Number(value) < MAX_AMOUNT) {
            setAmount(value ? Number(value) : 0); // Convert to number or reset to 0
            setMaxAmountReached(false);
        } else {
            setAmount(MAX_AMOUNT); // Set to max if input exceeds
            setMaxAmountReached(true);
        }
    }

    const chartData = useMemo(() => {
        let total = poolAccount?.liquidityShares ? poolAccount?.liquidityShares.toNumber() / 10 ** 9 : 0;
        total += liquidityShares; // Add the liquidity shares to the total
        const mine = userShares + liquidityShares;
        const userSharePercentage = total > 0 ? (mine / total) * 100 : 0;
        const othersSharePercentage = 100 - userSharePercentage;
        return [
            {name: `You ${userSharePercentage}%`, value: mine},
            {name: `Others ${othersSharePercentage}%`, value: total - mine},
        ];
    }, [amount, poolAccount?.liquidityShares, userShares, liquidityShares]);

    useEffect(() => {
        const liquidityBenefits = getAddLiquidityPotentialBenefits(
            Number(poolAccount.liquidityShares) / 10 ** 9,
            Number(poolAccount.yesLiquidity) / 10 ** 9,
            Number(poolAccount.noLiquidity) / 10 ** 9,
            amount,
        )
        setLiquidityShares(liquidityBenefits.lpShares)

        const outcomeShares = liquidityBenefits.yesShares ?
            liquidityBenefits.yesShares.toLocaleString("en-US", {minimumFractionDigits: 2, maximumFractionDigits: 2}) + " YES":
            liquidityBenefits.noShares.toLocaleString("en-US", {minimumFractionDigits: 2, maximumFractionDigits: 2}) + " NO";
        setOutcomeShares(outcomeShares)
    }, [amount]);

    return (
        <>
            {/* Amount input & quick-selects */}
            <div className="text-sm text-slate-400 mb-1">USD Amount</div>
            <div className="flex items-center justify-between mb-8 w-full ">
                <input
                    type="text"
                    className="bg-transparent w-64 text-3xl font-semibold text-slate-300 focus:outline-none absolute"
                    value={amount.toLocaleString()}
                    onChange={(e) => handleAmountTyping(e)}
                />
                <div className="flex gap-2 ml-auto">
                    {[10, 50, 100, 1000].map((val) => (
                        <button
                            key={val}
                            onClick={() => handleAddAmount(val)}
                            className="bg-slate-800 border border-gray-700 px-3 py-1 cursor-pointer rounded-md text-white text-sm hover:bg-slate-700"
                        >
                            +${val}
                        </button>
                    ))}
                    <button
                        onClick={() => setAmount(MAX_AMOUNT)}
                        className="bg-slate-800 border border-gray-700 px-3 py-1 rounded-md cursor-pointer text-white text-sm hover:bg-slate-700"
                    >
                        Max
                    </button>
                    <button
                        onClick={() => {
                            setAmount(0);
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
                            className=" md:col-span-1 md:col-start-1 flex flex-col justify-center items-center bg-[#2f3e4e] p-5 rounded-xl shadow-inner border border-slate-700">

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
                                                <Cell fill="#083fa0"/>

                                            </Pie>
                                            <Tooltip
                                                formatter={(v: number) => `${v.toLocaleString("en-US", {maximumFractionDigits: 2, minimumFractionDigits: 2})} shares`}
                                                contentStyle={{
                                                    backgroundColor: "#1f2937",
                                                    border: "1px solid #4b5563",
                                                    borderRadius: "8px",
                                                    padding: "8px",
                                                    color: "#e5e7eb"
                                                }}
                                                itemStyle={{
                                                    color: "#e5e7eb",
                                                    fontSize: "0.875rem"
                                                }}
                                            />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                                {/* Legend on the right */}
                                <div className="ml-1 space-y-2">
                                    {chartData.map((entry, idx) => (
                                        <div key={entry.name} className="flex items-center text-slate-200">
                                          <span
                                              className="w-3 h-3 rounded-full inline-block mr-2"
                                              style={{backgroundColor: idx === 0 ? "#00ffa3" : "#083fa0"}}
                                          />
                                            <span className="text-sm">{entry.name}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Shares to Purchase occupies 1/3 of the width */}
                        <div
                            className="md:col-span-1 md:col-start-3 bg-[#2f3e4e] p-5 rounded-xl shadow-inner border border-slate-700 flex flex-col items-center">
                            <div className="text-sm uppercase text-slate-400 tracking-widest mb-1 ">
                                LIQUIDITY SHARES TO RECEIVE
                            </div>
                            <div className="text-xl font-bold text-sky-400">{liquidityShares.toLocaleString("en-US", {maximumFractionDigits: 2})} SHARES</div>

                            <div className="w-full border-b-2 mt-3 border-slate-600"></div>
                            <div className="text-sm uppercase text-slate-400 tracking-widest mb-1 mt-3 relative">
                                OUTCOME SHARES TO RECEIVE

                                {/* Tooltip icon container */}
                                <div className="group cursor-pointer absolute top-0.5 right-[-21px]">
                                    {/* Info SVG Icon */}
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        className="h-4 w-4 text-sky-500 hover:text-white transition duration-200"
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
                                        most likely outcome.
                                    </div>
                                </div>
                            </div>
                            <div className={`text-xl font-bold ${outcomeShares.toLowerCase().includes("no") ? 
                            "text-red-400" : "text-green-400"}`}>{outcomeShares} SHARES</div>
                        </div>
                    </div>

                    <Button
                        className={`w-full h-12 text-xl font-semibold ${
                            liquidityAdded ? "bg-green-600 hover:bg-green-700" : "bg-blue-600 hover:bg-blue-800"
                        }`}
                        disabled={submitting || amount <= 0}
                        onClick={onSubmit}
                    >
                        {submitting ? "Submitting…" : "Add Liquidity"}
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
