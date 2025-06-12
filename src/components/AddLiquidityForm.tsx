import {Dispatch, SetStateAction, useState} from "react";
import {Button} from "@/components/ui/button";

type Props = {
    amount: number;
    setAmount: Dispatch<SetStateAction<number>>;
    submitting: boolean;
    onSubmit: () => void;
    liquidityAdded: boolean;
};

const MAX_AMOUNT = 100_000_000; // 100 million

export default function AddLiquidityForm({
                                             amount,
                                             setAmount,
                                             submitting,
                                             onSubmit,
                                             liquidityAdded
                                         }: Props) {

    const [_maxAmountReached, setMaxAmountReached] = useState(false);

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

            <Button
                className={`w-full h-12 text-xl cursor-pointer font-semibold ${liquidityAdded ? "bg-green-600 hover:bg-green-700" : "bg-blue-600 hover:bg-blue-800"}`}
                disabled={submitting || amount <= 0}
                onClick={onSubmit}
            >
                {submitting ? "Submitting…" : "Add Liquidity"}
            </Button>
        </>
    );
}
