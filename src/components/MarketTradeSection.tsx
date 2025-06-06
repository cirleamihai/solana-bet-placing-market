import {useState} from "react";
import {Button} from "@/components/ui/button";
import {useAnchorProgram} from "@/lib/anchor";
import ConnectWalletButton from "@/components/ConnectWalletButton";
import {computePotentialShareProfit} from "@/blockchain/computePotentialShareProfit";
import {PublicKey, Transaction} from "@solana/web3.js";
import BN from "bn.js";
import {getAssociatedTokenAddress, TOKEN_PROGRAM_ID} from "@solana/spl-token";
import {USD_MINT} from "@/lib/constants";
import {toast} from "sonner";
import {createAssociatedTokenAccounts} from "@/blockchain/createAssociatedTokenAccounts";
import {AnchorProvider} from "@coral-xyz/anchor";

const CONST_MAX_AMOUNT = 100_000_000; // 100 million

interface TradeInfo {
    marketPool: any,
    market: any,
    marketKey: any,
}

export default function MarketTradeSection({
                                               marketPool,
                                               marketKey,
                                               market
                                           }: TradeInfo) {
    const {wallet, program, connection} = useAnchorProgram(); // Assuming you have a hook to get the wallet context
    const [selectedOutcome, setSelectedOutcome] = useState<"yes" | "no">("yes");
    const [_maxAmountReached, setMaxAmountReached] = useState(false);
    const [amount, setAmount] = useState(0);
    const [submitting, setSubmitting] = useState(false);

    // @ts-ignore
    let MAX_AMOUNT = (marketPool.usdCollateral / 10 ** 9) ?? CONST_MAX_AMOUNT;

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

    // Convert BN to numbers (if needed)
    // @ts-ignore
    const yesLiquidity = marketPool.yesLiquidity?.toNumber?.() ?? 0;
    // @ts-ignore
    const noLiquidity = marketPool.noLiquidity?.toNumber?.() ?? 0;
    const yesPrice = yesLiquidity ? (noLiquidity / (yesLiquidity + noLiquidity)).toFixed(2) : 0.50.toFixed(2);
    const noPrice = noLiquidity ? (yesLiquidity / (yesLiquidity + noLiquidity)).toFixed(2) : 0.50.toFixed(2);

    // Compute expected profit
    const expectedProfit = computePotentialShareProfit(
        yesLiquidity,
        noLiquidity,
        selectedOutcome === "yes",
        amount
    );

    // Compute total shares as amount + expected profit
    const totalShares = amount + expectedProfit;

    const purchaseOutcomeShares = async () => {
        if (!wallet?.publicKey || !marketPool) return;

        const [poolKey] = PublicKey.findProgramAddressSync(
            [Buffer.from("pool"), marketKey?.toBuffer() ?? Buffer.from("")],
            program.programId
        )

        const ataInstructions: any[] = [];
        const selectedMint = selectedOutcome === "yes" ? market.yesMint : market.noMint;
        const userUsdAccount = await createAssociatedTokenAccounts(USD_MINT, wallet.publicKey, wallet, connection, ataInstructions);
        const userOutcomeMintAccount = await createAssociatedTokenAccounts(selectedMint, wallet.publicKey, wallet, connection, ataInstructions);

        try {
            const tx = new Transaction();
            ataInstructions.length > 0 && tx.add(...ataInstructions);

            const instruction = await program.methods
                .purchaseOutcomeShares(new BN(amount * 10 ** 9), selectedMint) // Assuming input is in SOL units
                .accounts({
                    market: marketKey,
                    pool: poolKey,
                    vault: market.vault,
                    yesMint: market.yesMint,
                    noMint: market.noMint,
                    userUsdAccount,
                    userOutcomeMintAccount,
                    liquidityYesTokensAccount: marketPool.liquidityYesTokensAccount,
                    liquidityNoTokensAccount: marketPool.liquidityNoTokensAccount,
                    user: wallet.publicKey,
                    tokenProgram: TOKEN_PROGRAM_ID,
                })
                .instruction();
            tx.add(instruction);

            // @ts-ignore
            const provider = program.provider as AnchorProvider;
            const _sig = await provider.sendAndConfirm(tx);

            toast.success("Successfully purchased shares!");
        } catch (err) {
            console.error("Purchase failed:", err);
            toast.error("Purchase failed.");
        } finally {
            setSubmitting(false);
        }

    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-12 w-full  mx-auto">

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
                        Yes ${yesPrice}
                    </button>
                    <button
                        className={`flex-1 py-3 rounded-md text-center font-semibold text-lg ml-2 cursor-pointer ${
                            selectedOutcome === "no"
                                ? "bg-red-500 text-white"
                                : "bg-gray-700 text-gray-400"
                        }`}
                        onClick={() => setSelectedOutcome("no")}
                    >
                        No ${noPrice}
                    </button>
                </div>

                <div className="text-sm text-slate-400 mb-1">Amount</div>
                <div className="flex items-center justify-between mb-4">
                    <input
                        type="text"
                        className="bg-transparent w-64 text-3xl font-semibold text-slate-300 focus:outline-none"
                        value={amount.toLocaleString("")}
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
                            className="bg-pink-600 border border-gray-700 px-3 py-1 rounded-md cursor-pointer text-white text-sm hover:bg-pink-800"
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
                                <div
                                    className="text-xl font-bold text-green-400">${expectedProfit.toLocaleString("")}</div>
                            </div>

                            <div
                                className="bg-[#2f3e4e] px-5 py-3 rounded-xl shadow-inner border border-slate-700 flex flex-col">
                                <div className="text-sm uppercase text-slate-400 tracking-widest mb-1">
                                    Shares to Purchase
                                </div>
                                <div
                                    className="text-xl font-bold text-sky-400 ml-auto">{totalShares.toLocaleString("")} SHARES
                                </div>
                            </div>
                        </div>
                        <Button
                            onClick={() => {
                                setSubmitting(true);
                                purchaseOutcomeShares().then();
                            }}
                            className="w-full h-12 mt-5 cursor-pointer bg-blue-600 hover:bg-blue-700 text-white text-xl font-semibold py-3 rounded-md"
                            disabled={Number(amount) === 0 || submitting}
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
                                    Purchasing...
                                </>
                            ) : (
                                "Purchase"
                            )}
                        </Button>
                    </div>
                )}
            </div>

            {/* ── History / Order Book ─────────────────── */}
            <div className="flex flex-col gap-2">
                <div className="rounded-xl bg-[#1f2937] text-white p-6 shadow-md h-[60%]">
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
                                <span>{trade.side} {trade.outcome}</span>
                                <span className="text-slate-400">${trade.amount}</span>
                            </li>
                        ))}
                    </ul>
                </div>

                <div className="rounded-xl bg-[#1f2937] text-white p-6 h-full shadow-md">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-center">
                        <div className="bg-[#2a3646] rounded-lg p-4 shadow-inner border border-slate-700">
                            <div className="text-sm uppercase tracking-wide text-slate-400 mb-1">
                                Money Invested
                            </div>
                            <div className="text-2xl font-semibold text-yellow-400">$123.45</div>
                        </div>

                        <div className="bg-[#2a3646] rounded-lg p-4 shadow-inner border border-slate-700">
                            <div className="text-sm uppercase tracking-wide text-slate-400 mb-1">
                                Shares Owned
                            </div>
                            <div className="text-2xl font-semibold text-sky-400">150</div>
                        </div>

                        <div className="bg-[#2a3646] rounded-lg p-4 shadow-inner border border-slate-700">
                            <div className="text-sm uppercase tracking-wide text-slate-400 mb-1">
                                Profit / Loss
                            </div>
                            <div className={`text-2xl font-semibold `}>+$23.67</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
