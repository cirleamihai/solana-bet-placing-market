import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter
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

import {PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY} from "@solana/web3.js";

import {useState} from "react";
import {marketTopics} from "@/lib/constants";
import {useAnchorProgram} from "@/lib/anchor";
import {toast} from "sonner";
import {TOKEN_PROGRAM_ID} from "@coral-xyz/anchor/dist/cjs/utils/token";
import {ensureFactory} from "@/blockchain/ensureFactory";
import BN from "bn.js";

interface Props {
    open: boolean;
    onClose: () => void;
}


export default function CreateMarketModal({open, onClose}: Props) {
    const [marketName, setMarketName] = useState("");
    const [selectedTopic, setSelectedTopic] = useState("");
    const {program, wallet} = useAnchorProgram();

    const handleSubmit = async () => {
        if (!program || !wallet?.publicKey || !marketName || !selectedTopic) {
            toast.error("Please connect wallet and fill all fields.");
            return;
        }

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

            const USD_MINT = new PublicKey("B2Zs7zCNeSWcu1bHkDUq6yRJYVwhwozLgvqDVLwYHe8Z");

            /* -------- 4. send transaction -------- */
            await program.methods
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
                .rpc();

            toast.success("Market created 🎉");
            onModalClose();
        } catch (e) {
            console.error(e);
            toast.error("Failed to create market");
        }

        onModalClose(); // You’ll replace this with actual logic
    };

    const onModalClose = () => {
        setSelectedTopic("");
        setMarketName("");
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

                <DialogFooter className="mt-6 flex justify-end gap-2">
                    <Button
                        variant="secondary"
                        onClick={onModalClose}
                        className="bg-zinc-700 text-white hover:bg-zinc-600"
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        className="bg-lime-600 hover:bg-lime-700 text-white"
                    >
                        Submit
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
