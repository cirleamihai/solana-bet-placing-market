import {Dispatch, SetStateAction, useState} from "react";
import {Button} from "@/components/ui/button";

type Props = {
    shares: number;
    setShares: Dispatch<SetStateAction<number>>;
    submitting: boolean;
    maxShares: number;
    onSubmit: () => void;
    liquidityRemoved: boolean;
};

export default function RemoveLiquidityForm({
                                                shares,
                                                setShares,
                                                submitting,
                                                maxShares,
                                                onSubmit,
                                                liquidityRemoved,
                                            }: Props) {

    const [_maxAmountReached, setMaxAmountReached] = useState(false);
    // const MAX_AMOUNT = maxShares;
    const MAX_AMOUNT = 11111;

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

            <Button
                className={`w-full h-12 text-xl cursor-pointer font-semibold ${liquidityRemoved ? "bg-green-600 hover:bg-green-700" : "bg-[#630287] hover:bg-[#3f0164]"}`}
                disabled={submitting || shares <= 0}
                onClick={onSubmit}
            >
                {submitting ? "Submitting…" : "Remove Liquidity"}
            </Button>
        </>
    );
}
