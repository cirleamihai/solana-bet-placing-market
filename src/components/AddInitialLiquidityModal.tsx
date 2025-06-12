import {Button} from "@/components/ui/button";
import {createAssociatedTokenAccounts} from "@/blockchain/createAssociatedTokenAccounts";
import {USD_MINT} from "@/lib/constants";
import {PublicKey, Transaction} from "@solana/web3.js";
import {AnchorProvider, BN} from "@coral-xyz/anchor";
import {TOKEN_PROGRAM_ID} from "@coral-xyz/anchor/dist/cjs/utils/token";
import {toast} from "sonner";
import {useAnchorProgram} from "@/lib/anchor";
import {useNavigate} from "react-router-dom";
import {useState} from "react";

interface Props {
    marketPubkey: string;
    market: any;
    setLiquidityEmptyModal: (value: boolean) => void;
    setWantsToAddLiquidity: (value: boolean) => void;
    submitting: boolean;
    setSubmitting: (value: boolean) => void;
}

export default function AddInitialLiquidityModal({
                                              marketPubkey,
                                              market,
                                              setLiquidityEmptyModal,
                                              submitting,
                                              setSubmitting,
                                          }: Props) {
    const {wallet, connection, program} = useAnchorProgram();
    const navigate = useNavigate();
    const [depositAmount, setDepositAmount] = useState<string>("");

    const handleInitialLiquidity = async () => {
        if (!wallet?.publicKey || !marketPubkey || !market) return;
        const ataInstructions: any[] = []; // Instructions for creating associated token accounts
        const userUsd = (await createAssociatedTokenAccounts(USD_MINT, wallet.publicKey, wallet, connection, ataInstructions)).ata;
        // @ts-ignore
        const userYes = (await createAssociatedTokenAccounts(market.yesMint, wallet.publicKey, wallet, connection, ataInstructions)).ata;
        // @ts-ignore
        const userNo = (await createAssociatedTokenAccounts(market.noMint, wallet.publicKey, wallet, connection, ataInstructions)).ata;
        // @ts-ignore
        const userLp = (await createAssociatedTokenAccounts(market.lpShareMint, wallet.publicKey, wallet, connection, ataInstructions)).ata;

        // Get the market public key
        const marketKey = new PublicKey(marketPubkey);

        const [poolPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("pool"), marketKey.toBuffer()],
            program.programId
        );

        const [vaultPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("vault"), marketKey.toBuffer()],
            program.programId
        );

        const [yesLiquidityPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("yes_liquidity_pool"), marketKey.toBuffer()],
            program.programId
        );

        const [noLiquidityPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("no_liquidity_pool"), marketKey.toBuffer()],
            program.programId
        );

        try {
            const tx = new Transaction();
            ataInstructions.length > 0 && tx.add(...ataInstructions);

            const ix = await program.methods
                .addLiquidity(new BN(Number(depositAmount) * 10 ** 9))
                .accounts({
                    pool: poolPda,
                    market: marketKey,
                    vault: vaultPda,
                    // @ts-ignore
                    yesMint: market.yesMint,
                    // @ts-ignore
                    noMint: market.noMint,
                    // @ts-ignore
                    lpShareMint: market.lpShareMint,
                    userUsdAccount: userUsd,
                    userYesAccount: userYes,
                    userNoAccount: userNo,
                    userLpShareAccount: userLp,
                    liquidityYesTokensAccount: yesLiquidityPda,
                    liquidityNoTokensAccount: noLiquidityPda,
                    user: wallet.publicKey,
                    tokenProgram: TOKEN_PROGRAM_ID,
                })
                .instruction();

            tx.add(ix);

            // @ts-ignore
            const provider = program.provider as AnchorProvider;
            const _sig = await provider.sendAndConfirm(tx);

            toast.success("Liquidity added successfully!");
            setLiquidityEmptyModal(false);
        } catch (err) {
            console.error("Failed to add liquidity:", err);
            toast.error("Liquidity deposit failed.");
        }
    }

    const formatted = depositAmount
        ? Number(depositAmount).toLocaleString("en-US", {
            minimumFractionDigits: depositAmount.includes(".") ? depositAmount.split(".")[1].length : 0,
            useGrouping: true,
        })
        : "";

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let val = e.target.value.replace(/\s/g, "").replace(",", ".");

        // Allow only digits and one decimal point
        if (/^\d*\.?\d{0,9}$/.test(val) || val === "") {
            setDepositAmount(val);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-black/60">
            <div
                className="bg-[#1f2937] p-6 rounded-2xl shadow-xl w-full max-w-md border border-slate-600 text-white">
                <h2 className="text-2xl font-semibold mb-4">No Liquidity Found</h2>
                <p className="text-red-300 mb-6">
                    This market currently has no liquidity. To enable trading, please add initial liquidity to
                    the pool.
                </p>

                <label className="block mb-2 text-sm font-medium text-slate-400">
                    Deposit Amount (USD-UBB)
                </label>
                <input
                    type="text"
                    inputMode="decimal"
                    className="w-full px-4 py-2 rounded-md bg-slate-800 border border-slate-600 text-white focus:outline-none mb-6"
                    value={formatted}
                    onChange={handleChange}
                />

                <div className="flex justify-end gap-3">
                    <button
                        className="px-4 py-2 rounded-md cursor-pointer bg-slate-700 hover:bg-slate-600 text-sm text-white"
                        onClick={() => {
                            navigate("/"); // Close modal by navigating back
                        }}
                    >
                        Back
                    </button>
                    <Button
                        onClick={() => {
                            setSubmitting(true);
                            handleInitialLiquidity().then();
                        }}
                        className="px-4 py-2 rounded-md cursor-pointer bg-green-600 hover:bg-green-700 text-sm text-white font-semibold"
                        disabled={Number(depositAmount) === 0 || submitting}
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
                                Submitting...
                            </>
                        ) : (
                            "Submit"
                        )}
                    </Button>
                </div>
            </div>
        </div>
    )
}