import { Dispatch, SetStateAction } from "react";
import { Button } from "@/components/ui/button";

type Props = {
    shares: number;
    setShares: Dispatch<SetStateAction<number>>;
    submitting: boolean;
    maxShares: number;
    onSubmit: () => void;
};

export default function RemoveLiquidityForm({
                                                shares,
                                                setShares,
                                                submitting,
                                                maxShares,
                                                onSubmit,
                                            }: Props) {
    return (
        <>
            {/* Shares input & quick-selects */}
            <div className="text-sm text-slate-400 mb-1">LP Shares</div>
            <div className="flex items-center justify-between mb-8 w-full">
                <input
                    type="number"
                    min={0}
                    className="bg-transparent w-64 text-3xl font-semibold text-slate-300 focus:outline-none"
                    value={shares}
                    onChange={(e) => setShares(Number(e.target.value))}
                />
                <div className="flex gap-2 ml-auto">
                    {[10, 100, 500, 1000].map((val) => (
                        <button
                            key={val}
                            onClick={() => setShares(val)}
                            className="bg-slate-800 border border-gray-700 px-3 py-1 rounded-md text-white text-sm hover:bg-slate-700"
                        >
                            {val}
                        </button>
                    ))}
                    <button
                        onClick={() => setShares(maxShares)}
                        className="bg-slate-800 border border-gray-700 px-3 py-1 rounded-md text-white text-sm hover:bg-slate-700"
                    >
                        Max
                    </button>
                    <button
                        onClick={() => setShares(0)}
                        className="bg-pink-600 border border-gray-700 px-3 py-1 rounded-md text-white text-sm hover:bg-pink-800"
                    >
                        Reset
                    </button>
                </div>
            </div>

            <Button
                className="w-full h-12 text-xl font-semibold"
                disabled={submitting || shares <= 0}
                onClick={onSubmit}
            >
                {submitting ? "Submitting…" : "Remove Liquidity"}
            </Button>
        </>
    );
}
