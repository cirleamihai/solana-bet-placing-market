import {Dispatch, SetStateAction, useMemo, useState} from "react";
import {Button} from "@/components/ui/button";
import {Cell, Pie, PieChart, ResponsiveContainer, Tooltip} from "recharts";
import ConnectWalletButton from "@/components/ConnectWalletButton";
import {useWallet} from "@solana/wallet-adapter-react";

type Props = {
    shares: number;
    setShares: Dispatch<SetStateAction<number>>;
    submitting: boolean;
    maxShares: number;
    onSubmit: () => void;
    liquidityRemoved: boolean;
    poolAccount: any; // on-chain pool PDA account
};

export default function RemoveLiquidityForm({
                                                shares,
                                                setShares,
                                                submitting,
                                                maxShares,
                                                onSubmit,
                                                liquidityRemoved,
                                                poolAccount
                                            }: Props) {

    const [_maxAmountReached, setMaxAmountReached] = useState(false);
    const wallet = useWallet();
    // const MAX_AMOUNT = maxShares;
    const MAX_AMOUNT = maxShares;

    const handleAddAmount = (value: number) => {
        if (shares + value < MAX_AMOUNT) {
            setShares((prev) => prev + value);
            setMaxAmountReached(false);
        } else {
            setMaxAmountReached(true); // Set flag if adding this value exceeds max
        }
    };

    const handleAmountTyping = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value.replace(/[^0-9]/g, ""); // Allow only numbers
        if (Number(value) < MAX_AMOUNT) {
            setShares(value ? Number(value) : 0); // Convert to number or reset to 0
            setMaxAmountReached(false);
        } else {
            setShares(MAX_AMOUNT); // Set to max if input exceeds
            setMaxAmountReached(true);
        }
    }

    const chartData = useMemo(() => {
        const total = poolAccount?.liquidityShares.toNumber() ?? 1;
        const mine = 4500;
        return [
            {name: "You", value: mine},
            {name: "Others", value: 10000 - mine},
        ];
    }, [shares, poolAccount?.liquidityShares]);


    return (
        <>
            {/* Shares input & quick-selects */}
            <div className="text-sm text-slate-400 mb-1">LP Shares</div>
            <div className="flex items-center justify-between mb-8 w-full">
                <input
                    type="text"
                    className="bg-transparent w-64 text-3xl font-semibold text-slate-300 focus:outline-none absolute"
                    value={shares.toLocaleString()}
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
                        onClick={() => setShares(MAX_AMOUNT)}
                        className="bg-slate-800 border border-gray-700 px-3 py-1 rounded-md cursor-pointer text-white text-sm hover:bg-slate-700"
                    >
                        Max
                    </button>
                    <button
                        onClick={() => {
                            setShares(0);
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
                                LIQUIDITY SHARES TO RECEIVE
                            </div>
                            <div className="text-xl font-bold text-purple-400">2093 SHARES</div>

                            <div className="w-full border-b-2 mt-3 border-purple-800"></div>
                            <div className="text-sm uppercase text-slate-400 tracking-widest mb-1 mt-3 ">
                                LIQUIDITY SHARES TO RECEIVE
                            </div>
                            <div className="text-xl font-bold text-purple-400">2093 SHARES</div>


                        </div>
                    </div>

                    <Button
                        className={`w-full h-12 text-xl cursor-pointer font-semibold ${liquidityRemoved ? "bg-green-600 hover:bg-green-700" : "bg-[#630287] hover:bg-[#3f0164]"}`}
                        disabled={submitting || shares <= 0}
                        onClick={onSubmit}
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
