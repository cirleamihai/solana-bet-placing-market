import React, {useMemo} from "react";
import {
    PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
} from "recharts";
import {motion, AnimatePresence} from "framer-motion";
import {LiquidityPoolTransaction} from "@/components/LiquidityPoolSection";

interface Props {
    transaction: LiquidityPoolTransaction;
    onClose: () => void;
}

export default function TransactionDetailModal({transaction, onClose}: Props) {
    // pie data depends on action type
    const chartData = useMemo(() => {
        let sharesPercentage;
        let remainingPercentage;

        if (transaction.added_liquidity) {
            sharesPercentage = transaction.lp_shares_received / transaction.lp_total_shares * 100;
            remainingPercentage = 100 - sharesPercentage;
        } else {
            sharesPercentage = transaction.lp_shares_used / (transaction.lp_total_shares + transaction.lp_shares_used) * 100;
            remainingPercentage = 100 - sharesPercentage;
        }

        sharesPercentage = sharesPercentage !== 100 ? sharesPercentage > 0.01 ? sharesPercentage.toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }) : "< 0.01" : "100%";
        remainingPercentage = remainingPercentage !== 0 ? remainingPercentage < 99.99 ? remainingPercentage.toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }) : "> 99.99" : "0%";

        const totalLiquidityShares = transaction.added_liquidity ?
            transaction.lp_total_shares - transaction.lp_shares_received :
            transaction.lp_total_shares;
        const liquiditySharesValue = transaction.added_liquidity ? transaction.lp_shares_received : transaction.lp_shares_used;
        return [
            {name: `Remaining LP Shares  ${remainingPercentage}%`, value: totalLiquidityShares, color: "#693992"},
            {name: `Transaction Shares  ${sharesPercentage}%`, value: liquiditySharesValue, color: "#00ffa3"},
        ];
    }, [transaction]);

    // close when user clicks backdrop
    const handleBackdropClick = () => onClose();

    return (
        <AnimatePresence>
            <motion.div
                key="backdrop"
                initial={{opacity: 0}}
                animate={{opacity: 1}}
                exit={{opacity: 0}}
                transition={{duration: 0.25}}
                onClick={handleBackdropClick}
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
            >
                {/* modal container */}
                <motion.div
                    key="modal"
                    initial={{y: 40, scale: 0.95, opacity: 0}}
                    animate={{y: 0, scale: 1, opacity: 1}}
                    exit={{y: 40, scale: 0.95, opacity: 0}}
                    transition={{type: "spring", stiffness: 300, damping: 30}}
                    onClick={e => e.stopPropagation()}   // ⛔️ prevent backdrop close
                    className="rounded-xl bg-[#1f2937] p-6 text-white shadow-2xl"
                >
                    {/* header */}
                    <h3 className="mb-6 text-center text-lg font-semibold uppercase tracking-wider text-slate-400">
                        Transaction Detail
                    </h3>

                    <div className="rounded-lg border border-slate-700 bg-[#2a3646] p-4 shadow-inner w-full mb-5">
                        {/* Title — keep outside flex */}
                        <div
                            className="mb-6 text-center text-sm font-semibold uppercase tracking-wider text-slate-400 w-full">
                            Transaction impact over the liquidity pool
                        </div>
                        {/* pie + legend  */}
                        <div className="mx-auto -mt-5 flex items-center justify-center gap-6 w-full">
                            <div className="h-[140px] w-[140px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            dataKey="value"
                                            data={chartData}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius="50%"
                                            outerRadius="80%"
                                            stroke="none"
                                        >
                                            {chartData.map((d, i) => (
                                                <Cell key={`slice-${i}`} fill={d.color}/>
                                            ))}
                                        </Pie>
                                        <Tooltip formatter={(v: any) => v.toLocaleString()}/>
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>

                            <ul className="space-y-2">
                                {chartData.map(d => (
                                    <li key={d.name} className="flex items-center text-sm text-slate-300">
                                          <span
                                              className="mr-2 inline-block h-3 w-3 rounded-full"
                                              style={{backgroundColor: d.color}}
                                          />
                                         {d.name}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>

                    {/* stats grid  */}
                    <div className="grid grid-cols-2 gap-4">
                        <StatBox title="Action"
                                 value={transaction.added_liquidity ? "ADDED LIQUIDITY" : "REMOVED LIQUIDITY"}/>
                        <StatBox
                            title="Transaction Time"
                            className="text-md min-h-[100px]"
                            value={new Date(transaction.created_at).toLocaleString("en-US", {
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                                second: "2-digit",
                                fractionalSecondDigits: 2,
                                hour12: false,
                            })}
                        />
                        <StatBox
                            title="Spent"
                            className="min-h-[100px]"
                            textColor="text-red-400"
                            value={
                                transaction.added_liquidity
                                    ? `-$${transaction.usd_used.toLocaleString()}`
                                    : (
                                        `-${transaction.lp_shares_used.toLocaleString()} LP Shares`
                                    )
                            }
                        />
                        <StatBox
                            title="Earned"
                            className="min-h-[100px]"
                            textColor="text-green-400"
                            value={
                                transaction.added_liquidity
                                    ? `+${transaction.lp_shares_received.toLocaleString()} LP Shares`
                                    : `+$${transaction.usd_received.toLocaleString()}`
                            }
                        />
                        <StatBox
                            title="Received Outcome Shares"
                            value={`${transaction.received_outcome_shares.toLocaleString()} ${transaction.received_outcome.toUpperCase()}`}
                            className="col-span-2"
                            textColor={transaction.received_outcome.toLocaleLowerCase().includes("Yes") ? "text-green-400" : "text-red-400"}
                        />
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}

// small presentational helper
function StatBox({
                     title,
                     value,
                     className = "",
                     textColor = "text-blue-200",
                 }: {
    title: string;
    value: any;
    className?: string;
    textColor?: string;
}) {
    return (
        <div
            className={`rounded-lg border border-slate-700 bg-[#2a3646] p-4 shadow-inner flex flex-col h-full ${className}`}
        >
            <p className="mb-1 text-sm uppercase tracking-wider text-slate-400 text-center">{title}</p>
            <div className="flex-1 flex items-center justify-center text-center">
                <p className={`font-semibold ${textColor}`}>{value}</p>
            </div>
        </div>
    );
}
