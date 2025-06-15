import {motion, AnimatePresence} from "framer-motion";
import React, {useState} from "react";
import {Button} from "@/components/ui/button";
import {CheckCircle, XCircle} from "lucide-react";

interface Props {
    onClose: () => void;
    marketTitle: string
}

export default function ResolveMarketModal({onClose, marketTitle}: Props) {
    const [selectedOutcome, setSelectedOutcome] = useState<"yes" | "no" | null>(null);
    const [submitting, setSubmitting] = useState(false);

    const handleConfirm = async () => {

    };

    return (
        <AnimatePresence>
            <motion.div
                key="backdrop"
                initial={{opacity: 0}}
                animate={{opacity: 1}}
                exit={{opacity: 0}}
                transition={{duration: 0.25}}
                onClick={onClose}
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
            >
                <motion.div
                    key="modal"
                    initial={{y: 40, scale: 0.95, opacity: 0}}
                    animate={{y: 0, scale: 1, opacity: 1}}
                    exit={{y: 40, scale: 0.95, opacity: 0}}
                    transition={{type: "spring", stiffness: 300, damping: 30}}
                    onClick={(e) => e.stopPropagation()}
                    className="rounded-xl bg-[#1f2937] p-6 text-white shadow-2xl w-[90%] max-w-md"
                >
                    {/* Header */}
                    <h3 className="mb-6 text-center text-3xl font-bold uppercase tracking-wider text-slate-400">
                        Resolve Market
                    </h3>

                    {/* Outcome selector */}
                    <div className="flex flex-col bg-[#2f4150] rounded-xl shadow-inner p-6 h-full w-full">
                        {/* ── Title ────────────────────────────────────────── */}
                        <h2 className="text-center text-xl font-semibold text-slate-200 tracking-tight mb-8">
                            {marketTitle}?
                        </h2>

                        {/* ── Outcome buttons ─────────────────────────────── */}
                        <div className="flex gap-4 mt-auto">
                            {/* YES */}
                            <button
                                onClick={() => setSelectedOutcome("yes")}
                                className={`flex-1 flex items-center justify-center cursor-pointer gap-2 py-3 rounded-md text-lg font-semibold transition focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#2f4150] focus:ring-green-400/50 ${
                                    selectedOutcome === "yes"
                                        ? "bg-green-500 text-white shadow-lg hover:bg-green-600"
                                        : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                                }`}
                            >
                                <CheckCircle className="h-5 w-5"/>
                                Resolve to YES
                            </button>

                            {/* NO */}
                            <button
                                onClick={() => setSelectedOutcome("no")}
                                className={`flex-1 flex items-center justify-center cursor-pointer gap-2 py-3 rounded-md text-lg font-semibold transition focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#2f4150] focus:ring-red-400/50 ${
                                    selectedOutcome === "no"
                                        ? "bg-red-500 text-white shadow-lg hover:bg-red-600"
                                        : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                                }`}
                            >
                                <XCircle className="h-5 w-5"/>
                                Resolve to NO
                            </button>
                        </div>
                    </div>
                    {/* Confirm Button */}
                    <div className="flex flex-col">
                        <div
                            className="mt-4 text-sm font-semibold text-center text-yellow-400  bg-opacity-30 px-3 py-2 rounded-md">
                            ⚠️ WARNING: Action is irreversible.
                        </div>
                        <Button
                            onClick={handleConfirm}
                            disabled={!selectedOutcome || submitting}
                            className="w-full mt-2 cursor-pointer bg-blue-600 hover:bg-blue-700 text-white"
                        >
                            {submitting ? "Resolving..." : "Confirm Resolution"}
                        </Button>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}