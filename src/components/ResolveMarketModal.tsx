import {motion, AnimatePresence} from "framer-motion";
import React, {Dispatch, SetStateAction, useState} from "react";
import {Button} from "@/components/ui/button";
import {CheckCircle, XCircle} from "lucide-react";
import {useAnchorProgram} from "@/lib/anchor";
import {PublicKey, Transaction} from "@solana/web3.js";
import {toast} from "sonner";
import {AnchorProvider, EventParser} from "@coral-xyz/anchor";
import {confirmTransaction} from "@/blockchain/blockchainTransactions";
import {supabase} from "@/lib/supabase";

interface Props {
    onClose: () => void;
    marketTitle: string;
    market: any;
    marketKey: PublicKey;
    setReloadMarket: Dispatch<SetStateAction<number>>
}

export default function ResolveMarketModal({onClose, marketTitle, market, marketKey, setReloadMarket}: Props) {
    const {wallet, program, connection} = useAnchorProgram();
    const [selectedOutcome, setSelectedOutcome] = useState<"yes" | "no" | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [parser, _setParser] = useState(new EventParser(program.programId, program.coder))
    const [marketResolved, setMarketResolved] = useState(false);

    const handleConfirm = async () => {
        if (!wallet?.publicKey || !market) return;
        setSubmitting(true);

        try {
            const ataInstructions: any[] = [];

            const tx = new Transaction();
            ataInstructions.length > 0 && tx.add(...ataInstructions);
            const [poolPda] = PublicKey.findProgramAddressSync(
                [Buffer.from("pool"), marketKey.toBuffer()],
                program.programId
            );

            const accountInfo = await program.provider.connection.getAccountInfo(poolPda);
            if (!accountInfo) {
                throw new Error("Pool PDA not initialized");
            }

            const ix = await program.methods
                .resolveMarket(selectedOutcome === "yes" ? 1 : 0)
                .accounts({
                    market: marketKey,
                    pool: poolPda,
                    oracle: market.oracle,
                })
                .instruction()

            tx.add(ix);

            // @ts-ignore
            const provider = program.provider as AnchorProvider;
            const _sig = await provider.sendAndConfirm(tx);

            const {transactionTime, transaction} = await confirmTransaction(
                connection,
                _sig,
                parser,
                "marketResolvedEvent"
            )

            console.log("Transaction confirmed:", transactionTime, transaction);

            const {error} = await supabase.from("market_metadata")
                .update({
                    resolved: true,
                    resolved_at: transactionTime,
                    resolved_outcome: transaction.outcome === 1 ? "yes" : "no",
                    resolver_pubkey: wallet.publicKey.toBase58(),
                })
                .eq("market_pubkey", marketKey.toBase58())

            if (error) {
                throw new Error(error.message);
            }

            toast.success("Market resolved successfully!");
            setReloadMarket(prev => prev + 1);
            setMarketResolved(true);

            setTimeout(() => {
                onClose();
            }, 1000); // Close modal after 1 second

        } catch (error) {
            toast.error("Error resolving market. Please try again.");
            console.log(
                "Error resolving market:",
                error instanceof Error ? error.message : String(error)
            )
        } finally {
            setSubmitting(false);
        }

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
                            {marketTitle}
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
                                disabled={submitting}
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
                                disabled={submitting}
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
                            className={`w-full cursor-pointer text-white text-lg py-3 rounded-md transition-all duration-300 ${marketResolved ? "bg-green-600 hover:bg-green-700" : "bg-blue-600 hover:bg-blue-700"}`}
                            disabled={submitting || !selectedOutcome}
                        >
                            {marketResolved ? (
                                <div className="flex items-center justify-center gap-2">
                                    <svg
                                        className="h-5 w-5 text-white"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth={3}
                                        viewBox="0 0 24 24"
                                    >
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
                                    </svg>
                                    Market Resolved!
                                </div>
                            ) : submitting ? (
                                <>
                                    <svg
                                        className="animate-spin h-4 w-4 text-white"
                                        xmlns="http://www.w3.org/2000/svg"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                    >
                                        <circle
                                            className="opacity-25"
                                            cx="12"
                                            cy="12"
                                            r="10"
                                            stroke="currentColor"
                                            strokeWidth="4"
                                        ></circle>
                                        <path
                                            className="opacity-75"
                                            fill="currentColor"
                                            d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 100 16 8 8 0 01-8-8z"
                                        ></path>
                                    </svg>
                                    Resolving...
                                </>
                            ) : (
                                "Resolve Market"
                            )}
                        </Button>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}