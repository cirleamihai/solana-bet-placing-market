import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter, DialogDescription
} from "@/components/ui/dialog";
import {Input} from "@/components/ui/input";
import {Button} from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select";

import {PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY, Transaction} from "@solana/web3.js";

import {useState} from "react";
import {marketTopics, USD_MINT} from "@/lib/constants";
import {useAnchorProgram} from "@/lib/anchor";
import {toast} from "sonner";
import {TOKEN_PROGRAM_ID} from "@coral-xyz/anchor/dist/cjs/utils/token";
import {ensureFactory} from "@/blockchain/ensureFactory";
import BN from "bn.js";
import {supabase} from "@/lib/supabase";
import {AnchorProvider} from "@coral-xyz/anchor";

interface Props {
    open: boolean;
    onClose: () => void;
}


export default function CreateMarketModal({open, onClose}: Props) {
    const [marketName, setMarketName] = useState("");
    const [selectedTopic, setSelectedTopic] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const {program, wallet} = useAnchorProgram();

    const handleSubmit = async () => {
        if (!program || !wallet?.publicKey || !marketName || !selectedTopic) {
            toast.error("Please connect wallet and fill all fields.");
            return;
        }
        setSubmitting(true);

        try {
            /* -------- 1. make sure factory exists -------- */
            const factoryPda = await ensureFactory(wallet.publicKey, program);

            /* -------- 2. fetch current counter ---------- */
            // @ts-ignore
            const factoryAcc = await program.account.marketFactory.fetch(factoryPda);
            const index = factoryAcc.createdMarkets;          // u64 counter

            /* -------- 3. derive all PDAs for this market -------- */
            const [marketPda] = PublicKey.findProgramAddressSync(
                [
                    Buffer.from("market"),
                    wallet.publicKey.toBuffer(),
                    index.toArrayLike(Buffer, "le", 8)
                ],
                program.programId
            );
            const [yesMint] = PublicKey.findProgramAddressSync([Buffer.from("yes_mint"), marketPda.toBuffer()], program.programId);
            const [noMint] = PublicKey.findProgramAddressSync([Buffer.from("no_mint"), marketPda.toBuffer()], program.programId);
            const [lpShareMint] = PublicKey.findProgramAddressSync([Buffer.from("lp_share_mint"), marketPda.toBuffer()], program.programId);
            const [vault] = PublicKey.findProgramAddressSync([Buffer.from("vault"), marketPda.toBuffer()], program.programId);

            // Pool related accounts
            const [liquidityPoolAccount] = PublicKey.findProgramAddressSync([Buffer.from("pool"), marketPda.toBuffer()], program.programId)
            const [liquidityYesPoolAccount] = PublicKey.findProgramAddressSync([Buffer.from("yes_liquidity_pool"), marketPda.toBuffer()], program.programId)
            const [liquidityNoPoolAccount] = PublicKey.findProgramAddressSync([Buffer.from("no_liquidity_pool"), marketPda.toBuffer()], program.programId)


            /* -------- 4. send transaction to create market-------- */
            const tx = new Transaction();

            const create_market_instruction = await program.methods
                .createNewMarket(/* oracle pubkey here */ wallet.publicKey)   // oracle param
                .accounts({
                    market: marketPda,
                    yesMint,
                    noMint,
                    lpShareMint,
                    usdMint: USD_MINT,
                    marketFactory: factoryPda,
                    vault,
                    authority: wallet.publicKey,
                    systemProgram: SystemProgram.programId,
                    tokenProgram: TOKEN_PROGRAM_ID,
                    rent: SYSVAR_RENT_PUBKEY,
                })
                .instruction();

            /* -------- 5. send transaction to initiate liquidity pool-------- */
            const initialize_pool_instruction = await program.methods
                .initializePool()
                .accounts({
                    pool: liquidityPoolAccount,
                    liquidityYesTokensAccount: liquidityYesPoolAccount,
                    liquidityNoTokensAccount: liquidityNoPoolAccount,
                    market: marketPda,
                    authority: wallet.publicKey,
                    yesMint,
                    noMint,
                    systemProgram: SystemProgram.programId,
                    tokenProgram: TOKEN_PROGRAM_ID
                }).instruction();
            tx.add(create_market_instruction, initialize_pool_instruction);
            tx.feePayer = wallet.publicKey;

            const provider = program.provider as AnchorProvider;
            const _sig = await provider.sendAndConfirm(tx);

            // Also update the supabase metadata
            const {data, error} = await supabase
                .from("market_metadata")
                .insert({
                    market_pubkey: marketPda.toBase58(),
                    market_name: marketName,
                    market_category: selectedTopic,
                    created_by: wallet.publicKey.toBase58(),
                });

            if (error) {
                console.error("Supabase insert error:", error);
                toast.error("Market was created but metadata failed to save.");
                return
            }

            toast.success("Market created successfully!");
            onModalClose();
        } catch (e) {
            console.error(e);
            toast.error("Failed to create market");
        } finally {
            setSubmitting(false);
        }

        onModalClose(); // You’ll replace this with actual logic
    };

    const onModalClose = () => {
        setSelectedTopic("");
        setMarketName("");
        setSubmitting(false);
        onClose();
    }

    return (
        <Dialog open={open} onOpenChange={onModalClose}>
            <DialogContent
                className="bg-zinc-900 text-white border border-zinc-700 shadow-2xl backdrop-blur-lg rounded-xl sm:max-w-md"
            >
                <DialogHeader>
                    <DialogTitle className="text-xl font-semibold text-white">
                        Create a New Market
                    </DialogTitle>
                    <DialogDescription className="text-zinc-400 text-sm">
                        Choose a topic and name for your new prediction market.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 mt-4">
                    <Input
                        placeholder="Market name (e.g. 'Romania President in 2025?')"
                        className="bg-zinc-800 border border-zinc-700 text-white placeholder:text-zinc-400 focus:ring-2 focus:ring-green-500"
                        value={marketName}
                        onChange={(e) => setMarketName(e.target.value)}
                    />

                    <Select onValueChange={(val) => setSelectedTopic(val)}>
                        <SelectTrigger
                            className={`bg-zinc-800 border border-zinc-700 h-10 ${
                                selectedTopic ? "[&>span]:text-white" : "[&>span]:text-zinc-400"
                            }`}
                        >
                            <SelectValue placeholder="Select Topic"/>
                        </SelectTrigger>

                        <SelectContent className="bg-zinc-900 border-zinc-700 text-white">
                            {marketTopics.map((topic) => (
                                <SelectItem
                                    key={topic}
                                    value={topic}
                                    className="hover:bg-zinc-700 focus:bg-zinc-700"
                                >
                                    {topic}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                {/* Add this below the footer */}
                <div className="space-y-3">
                    <p className="text-sm text-red-400 flex items-center gap-2 justify-center">
                        <span className="text-yellow-400">⚠️</span>
                        Creating a new market will require SOL for transaction fees.
                    </p>

                    <DialogFooter className="flex justify-end gap-2">
                        <Button
                            variant="secondary"
                            onClick={onModalClose}
                            className="bg-zinc-700 text-white hover:bg-zinc-600"
                            disabled={submitting}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleSubmit}
                            className="bg-lime-600 hover:bg-lime-700 text-white flex items-center gap-2"
                            disabled={submitting || !marketName || !selectedTopic}
                        >
                            {submitting ? (
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
                                    Creating...
                                </>
                            ) : (
                                "Submit"
                            )}
                        </Button>
                    </DialogFooter>
                </div>
            </DialogContent>
        </Dialog>
    );
}
