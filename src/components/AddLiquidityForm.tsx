import {Dispatch, SetStateAction, useMemo, useState} from "react";
import {Button} from "@/components/ui/button";
import {useWallet} from "@solana/wallet-adapter-react";
import ConnectWalletButton from "@/components/ConnectWalletButton";
import {Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip} from "recharts";

type Props = {
    amount: number;
    setAmount: Dispatch<SetStateAction<number>>;
    submitting: boolean;
    onSubmit: () => void;
    liquidityAdded: boolean;
    poolAccount: any
};

const MAX_AMOUNT = 100_000_000; // 100 million

export default function AddLiquidityForm({
                                             amount,
                                             setAmount,
                                             submitting,
                                             onSubmit,
                                             liquidityAdded,
    poolAccount
                                         }: Props) {
    const [_maxAmountReached, setMaxAmountReached] = useState(false);
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
        const total = poolAccount?.liquidityShares.toNumber() ?? 1;
        const mine = 4500;
        return [
            { name: "You", value: mine },
            { name: "Others", value: 10000 - mine },
        ];
    }, [amount, poolAccount?.liquidityShares]);

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
                    <>
                        <div className="flex gap-6 justify-between">
                            <div className="bg-[#2f3e4e] px-5 py-3 rounded-xl shadow-inner border border-slate-700">
                                <div className="text-sm uppercase text-slate-400 tracking-widest mb-1">
                                    Expected Profit
                                </div>
                                <div className="w-full h-20">
                                    <ResponsiveContainer>
                                        <PieChart>
                                            <Pie
                                                data={chartData}
                                                dataKey="value"
                                                nameKey="name"
                                                innerRadius="45%"
                                                outerRadius="65%"
                                                stroke="none"
                                            >
                                                {/* keep two simple brand colours; tweak as desired */}
                                                <Cell fill="#00ffa3" />
                                                <Cell fill="#1a3970" />
                                            </Pie>
                                            <Tooltip formatter={(v: any) => `${v.toLocaleString()} shares`} />
                                            <Legend />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            <div
                                className="bg-[#2f3e4e] px-5 py-3 rounded-xl shadow-inner border border-slate-700 flex flex-col">
                                <div className="text-sm uppercase text-slate-400 tracking-widest mb-1">
                                    Shares to Purchase
                                </div>
                                <div
                                    className="text-xl font-bold text-sky-400 ml-auto">asd SHARES
                                </div>
                            </div>
                        </div>
                        <Button
                            className={`w-full h-12 text-xl cursor-pointer font-semibold ${liquidityAdded ? "bg-green-600 hover:bg-green-700" : "bg-blue-600 hover:bg-blue-800"}`}
                            disabled={submitting || amount <= 0}
                            onClick={onSubmit}
                        >
                            {submitting ? "Submitting…" : "Add Liquidity"}
                        </Button>
                    </>
                ) : (
                    <div className={"w-full [&_*]:w-full [&_*]:justify-center"}>
                        <ConnectWalletButton/>
                    </div>
                )}
        </>
    );
}
