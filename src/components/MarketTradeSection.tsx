// src/components/MarketTradeSection.tsx
import {useState} from "react";
import {Button} from "@/components/ui/button";
import {useAnchorProgram} from "@/lib/anchor";
import ConnectWalletButton from "@/components/ConnectWalletButton";

const MAX_AMOUNT = 100_000_000; // 100 million

export default function MarketTradeSection() {
    const [selectedOutcome, setSelectedOutcome] = useState<"yes" | "no">("yes");
    const [maxAmountReached, setMaxAmountReached] = useState(false);
    const [amount, setAmount] = useState(0);

    const {wallet} = useAnchorProgram(); // Assuming you have a hook to get the wallet context

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
            setMaxAmountReached(true);
        }
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-12 w-full mx-auto">
            {/* ── Betting Box ───────────────────────────── */}
            <div className="rounded-xl bg-[#1f2937] text-white p-6 shadow-md">
                <div className="flex gap-4 mb-4 border-b border-gray-700 pb-2">
                    <button
                        className={`font-semibold text-lg px-2 border-b-2 cursor-pointer ${
                            selectedOutcome === "yes"
                                ? "text-green-400 border-green-400"
                                : "text-red-500 border-red-400"
                        }`}
                        onClick={() => setSelectedOutcome("yes")}
                    >
                        Buy
                    </button>
                </div>

                <div className="flex justify-between items-center mb-4">
                    <button
                        className={`flex-1 py-3 rounded-md text-center font-semibold text-lg mr-2 cursor-pointer ${
                            selectedOutcome === "yes"
                                ? "bg-green-500 text-white"
                                : "bg-gray-700 text-gray-400"
                        }`}
                        onClick={() => setSelectedOutcome("yes")}
                    >
                        Yes 15¢
                    </button>
                    <button
                        className={`flex-1 py-3 rounded-md text-center font-semibold text-lg ml-2 cursor-pointer ${
                            selectedOutcome === "no"
                                ? "bg-red-500 text-white"
                                : "bg-gray-700 text-gray-400"
                        }`}
                        onClick={() => setSelectedOutcome("no")}
                    >
                        No 86¢
                    </button>
                </div>

                <div className="text-sm text-slate-400 mb-1">Amount</div>
                <div className="flex items-center justify-between mb-4">
                    <input
                        type="text"
                        className="bg-transparent w-64 text-3xl font-semibold text-slate-300 focus:outline-none"
                        value={amount.toLocaleString("fr-FR")}
                        onChange={(e) => handleAmountTyping(e)}
                    />
                    <div className="flex gap-2">
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
                            onClick={() => setAmount(MAX_AMOUNT - 1)}
                            className="bg-slate-800 border border-gray-700 px-3 py-1 rounded-md cursor-pointer text-white text-sm hover:bg-slate-700"
                        >
                            Max
                        </button>
                        <button
                            onClick={() => {
                                setAmount(0);
                                setMaxAmountReached(false);
                            }}
                            className="bg-pink-600 border border-gray-700 px-3 py-1 rounded-md cursor-pointer text-white text-sm hover:bg-slate-700"
                        >
                            Reset
                        </button>
                    </div>
                </div>

                {!wallet?.publicKey ? (
                    <div className={"w-full [&_*]:w-full [&_*]:justify-center"}>
                        <ConnectWalletButton/>
                    </div>
                ) : (
                    <div className="flex flex-col">
                        <div className="flex gap-6 justify-between">
                            <div className="bg-[#2f3e4e] px-5 py-3 rounded-xl shadow-inner border border-slate-700">
                                <div className="text-sm uppercase text-slate-400 tracking-widest mb-1">
                                    Expected Profit
                                </div>
                                <div className="text-xl font-bold text-green-400">$12.20</div>
                            </div>

                            <div className="bg-[#2f3e4e] px-5 py-3 rounded-xl shadow-inner border border-slate-700 flex flex-col">
                                <div className="text-sm uppercase text-slate-400 tracking-widest mb-1">
                                    Shares to Purchase
                                </div>
                                <div className="text-xl font-bold text-sky-400 ml-auto">0 SHARES</div>
                            </div>
                        </div>
                        <Button className="w-full h-12 mt-5 cursor-pointer bg-blue-600 hover:bg-blue-700 text-white text-xl font-semibold py-3 rounded-md">
                            Purchase
                        </Button>
                    </div>
                )}
            </div>

            {/* ── History / Order Book ─────────────────── */}
            <div className="rounded-xl bg-[#1f2937] text-white p-6 shadow-md">
                <h3 className="text-lg font-semibold mb-4">Recent Trades</h3>
                <ul className="space-y-2 max-h-72 overflow-y-auto text-sm">
                    {[
                        {side: "Buy", outcome: "Yes", amount: 24},
                        {side: "Buy", outcome: "No", amount: 15},
                        {side: "Buy", outcome: "Yes", amount: 50},
                        {side: "Buy", outcome: "Yes", amount: 12},
                        {side: "Buy", outcome: "No", amount: 100},
                    ].map((trade, i) => (
                        <li key={i} className="flex justify-between border-b border-gray-700 pb-1">
              <span>
                {trade.side} {trade.outcome}
              </span>
                            <span className="text-slate-400">${trade.amount}</span>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
}
