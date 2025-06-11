import {useCallback, useEffect, useState} from "react";
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
import {AnchorProvider, EventParser} from "@coral-xyz/anchor";
import {listenToPurchaseSharesEventHelius} from "@/blockchain/heliusEventListener";
import {supabase} from "@/lib/supabase";
import {motion, AnimatePresence} from "framer-motion";
import {Frown} from "lucide-react";

const CONST_MAX_AMOUNT = 100_000_000; // 100 million

export interface TransactionDetails {
    tx_signature: string;
    market_pubkey: string;
    user_pubkey: string;
    purchased_outcome: "yes" | "no";
    amount_purchased: number; // in shares
    money_spent: number; // in USD
    created_at: string; // ISO date string
    yes_price: number; // Price of Yes outcome
    no_price: number; // Price of No outcome
}

interface TradeInfo {
    marketPool: any,
    market: any,
    marketKey: any,
    reloadMarket: number,
    setReloadMarket: (value: any) => void,
    transactionDetails: TransactionDetails[],
    setYesPrice: (price: number) => void,
    setNoPrice: (price: number) => void
}

export default function MarketTradeSection({
                                               marketPool,
                                               marketKey,
                                               market,
                                               reloadMarket,
                                               setReloadMarket,
                                               transactionDetails,
                                               setYesPrice,
                                               setNoPrice
                                           }: TradeInfo) {
    const {wallet, program, connection} = useAnchorProgram(); // Assuming you have a hook to get the wallet context
    const [selectedOutcome, setSelectedOutcome] = useState<"yes" | "no">("yes");
    const [_maxAmountReached, setMaxAmountReached] = useState(false);
    const [amount, setAmount] = useState(0);
    const [submitting, setSubmitting] = useState(false);
    const [purchased, setPurchased] = useState(false);
    const [yesSharesOwned, setYesSharesOwned] = useState(0);
    const [noSharesOwned, setNoSharesOwned] = useState(0);
    const [yesRemainingTokens, setYesRemainingTokens] = useState(0);
    const [noRemainingTokens, setNoRemainingTokens] = useState(0);
    const [moneyInvested, setMoneyInvested] = useState(0);
    const [profitMade, setProfitMade] = useState(0);
    const [parser, _setParser] = useState(new EventParser(program.programId, program.coder))

    // Convert BN to numbers (if needed)
    // @ts-ignore
    const yesLiquidity = yesRemainingTokens ? yesRemainingTokens : marketPool.yesLiquidity?.toNumber?.() ?? 0;
    // @ts-ignore
    const noLiquidity = noRemainingTokens ? noRemainingTokens : marketPool.noLiquidity?.toNumber?.() ?? 0;
    const yesPrice = yesLiquidity ? (noLiquidity / (yesLiquidity + noLiquidity)).toFixed(2) : 0.50.toFixed(2);
    const noPrice = noLiquidity ? (yesLiquidity / (yesLiquidity + noLiquidity)).toFixed(2) : 0.50.toFixed(2);

    useEffect(() => {
        setYesPrice(Number(yesPrice));
        setNoPrice(Number(noPrice));
    }, [reloadMarket, yesPrice, noPrice, yesRemainingTokens, noRemainingTokens]);

    useEffect(() => {
        const computeInvestmentPrice = () => {
            if (!transactionDetails || !wallet || !wallet.publicKey || !yesSharesOwned || !noSharesOwned) return;
            const userTransactions = transactionDetails.filter((tx: TransactionDetails) => tx.user_pubkey === wallet?.publicKey?.toBase58());
            const totalInvested = userTransactions.reduce((acc, tx) => acc + tx.money_spent, 0);
            const profit = yesSharesOwned * Number(yesPrice) + noSharesOwned * Number(noPrice) - totalInvested;

            setMoneyInvested(totalInvested);
            setProfitMade(profit);
        }
        computeInvestmentPrice();

    }, [reloadMarket, yesPrice, noPrice, yesSharesOwned, noSharesOwned]);

    const handleNewPurchaseBlockchainEvent = useCallback(
        async (event: { txSignature: string, transaction: any }) => {
            setReloadMarket((prev: any) => prev + 1);
            console.log('Transaction details:', event.transaction);

            // Set the remaining tokens for yes and no outcomes
            setYesRemainingTokens(Number(event.transaction.poolRemainingYesTokens));
            setNoRemainingTokens(Number(event.transaction.poolRemainingNoTokens));

        }, [setReloadMarket]);

    // Listen to the Helius events for market updates
    listenToPurchaseSharesEventHelius(
        marketKey,
        program.programId,
        setReloadMarket,
        parser,
        handleNewPurchaseBlockchainEvent
    )

    // @ts-ignore
    let MAX_AMOUNT = CONST_MAX_AMOUNT;

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

    // Compute expected profit
    let expectedProfit = computePotentialShareProfit(
        yesLiquidity / 10 ** 9,
        noLiquidity / 10 ** 9,
        selectedOutcome === "yes",
        amount
    );

    expectedProfit = expectedProfit < 0 ? 0 : expectedProfit; // Ensure profit is not negative

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
        const userUsdAccount = (await createAssociatedTokenAccounts(USD_MINT, wallet.publicKey, wallet, connection, ataInstructions)).ata;
        const {
            ata
        } = await createAssociatedTokenAccounts(selectedMint, wallet.publicKey, wallet, connection, ataInstructions);
        const userOutcomeMintAccount = ata;

        try {
            const tx = new Transaction();
            ataInstructions.length > 0 && tx.add(...ataInstructions);

            const instruction = await program.methods
                .purchaseOutcomeShares(
                    new BN(amount * 10 ** 9),
                    selectedMint
                ) // Assuming input is in SOL units
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

            // Sign and send the transaction
            // @ts-ignore
            const provider = program.provider as AnchorProvider;
            const _sig = await provider.sendAndConfirm(tx);

            // Confirm the transaction
            const latestBlockHash = await connection.getLatestBlockhash();
            await connection.confirmTransaction({
                blockhash: latestBlockHash.blockhash,
                lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
                signature: _sig
            }, 'confirmed');

            // Parse the transaction logs to find the purchased shares event
            const blockchainConfirmation = await connection.getTransaction(_sig, {
                commitment: 'confirmed',
                maxSupportedTransactionVersion: 0,
            });
            const parsedEvents = [...parser.parseLogs(blockchainConfirmation?.meta?.logMessages || [])];
            const purchasedEvent = parsedEvents.find(event => event.name === "purchasedOutcomeSharesEvent");
            const transaction = purchasedEvent?.data;

            // Log the transaction to our supabase
            const {error} = await supabase.from("bets").upsert(
                [
                    {
                        tx_signature: _sig,
                        market_pubkey: marketKey,
                        user_pubkey: wallet?.publicKey.toBase58(),
                        purchased_outcome: selectedOutcome,
                        amount_purchased: Number(transaction.wantedSharesPurchased) / 10 ** 9, // Convert from decimals to shares
                        money_spent: Number(transaction.amount) / 10 ** 9,
                        yes_price: yesPrice,
                        no_price: noPrice,
                    }
                ],
                {onConflict: "tx_signature",}
            )

            if (error) {
                console.error("Error inserting bet:", error);
            } else {
                console.log("Bet recorded successfully");
            }

            // Set the remaining tokens for yes and no outcomes
            setYesRemainingTokens(Number(transaction.poolRemainingYesTokens));
            setNoRemainingTokens(Number(transaction.poolRemainingNoTokens));

            toast.success("Successfully purchased shares!");
            setPurchased(true);
            setReloadMarket((prev: any) => prev + 1); // Trigger reload of shares
            setAmount(0); // Reset amount after purchase
            setTimeout(() => setPurchased(false), 2500);

        } catch (err) {
            console.error("Purchase failed:", err);
            toast.error("Purchase failed.");
        } finally {
            setSubmitting(false);
        }

    }

    const getOwnedShares = async () => {
        const yesATA = await getAssociatedTokenAddress(market.yesMint, wallet?.publicKey as PublicKey);
        const noATA = await getAssociatedTokenAddress(market.noMint, wallet?.publicKey as PublicKey);

        try {
            const yesAccount = await connection.getTokenAccountBalance(yesATA);
            const noAccount = await connection.getTokenAccountBalance(noATA);
            return {
                // @ts-ignore
                yesShares: Number(yesAccount.value.amount) / 10 ** 9, // Convert from lamports to shares
                // @ts-ignore
                noShares: Number(noAccount.value.amount) / 10 ** 9, // Convert from lamports to shares
            };
        } catch (error) {
            toast.error("Failed to fetch owned shares:");
            return {yesShares: 0, noShares: 0};
        }
    }

    useEffect(() => {
        const loadShares = async () => {
            if (!wallet?.publicKey) return;
            const {yesShares, noShares} = await getOwnedShares(); // ← your function
            setYesSharesOwned(yesShares);
            setNoSharesOwned(noShares);
        };

        loadShares();
    }, [reloadMarket]);

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

                <div className="flex justify-between items-center mb-3">
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
                <div className="flex items-center justify-between mb-7 w-full ">
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
                    <div className="flex flex-col mt-21">
                        <div className="flex gap-6 justify-between">
                            <div className="bg-[#2f3e4e] px-5 py-3 rounded-xl shadow-inner border border-slate-700">
                                <div className="text-sm uppercase text-slate-400 tracking-widest mb-1">
                                    Expected Profit
                                </div>
                                <div
                                    className="text-xl font-bold text-green-400">${expectedProfit.toLocaleString()}</div>
                            </div>

                            <div
                                className="bg-[#2f3e4e] px-5 py-3 rounded-xl shadow-inner border border-slate-700 flex flex-col">
                                <div className="text-sm uppercase text-slate-400 tracking-widest mb-1">
                                    Shares to Purchase
                                </div>
                                <div
                                    className="text-xl font-bold text-sky-400 ml-auto">{totalShares.toLocaleString()} SHARES
                                </div>
                            </div>
                        </div>
                        <Button
                            onClick={() => {
                                setSubmitting(true);
                                purchaseOutcomeShares().then();
                            }}
                            className={`w-full mt-4 h-12  cursor-pointer text-white text-xl font-semibold py-3 rounded-md transition-all duration-300 ${purchased ? "bg-green-600 hover:bg-green-700" : "bg-blue-600 hover:bg-blue-700"}`}
                            disabled={Number(amount) === 0 || submitting || purchased}
                        >
                            {purchased ? (
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
                                    Purchased!
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
                <div className="rounded-xl bg-[#1f2937] text-white p-6 shadow-md">
                    <h3 className="text-lg font-semibold mb-4">Recent Trades</h3>
                    {transactionDetails.length > 0 ? (
                        <ul className="custom-scroll space-y-1 h-[160px] overflow-y-auto pr-1">
                            <AnimatePresence initial={false}>
                                {transactionDetails.slice(0, 25).map((trade, _i) => (
                                    <motion.li
                                        key={trade.tx_signature} // ✅ Use unique key
                                        initial={{opacity: 0, y: 10}}
                                        animate={{opacity: 1, y: 0}}
                                        exit={{opacity: 0, y: -10}}
                                        transition={{duration: 0.3, ease: "easeOut"}}
                                        className="flex items-center border-b border-gray-700 px-2 py-[6px] rounded-md hover:bg-[#273447] transition duration-150 text-sm"
                                    >
                                        {/* Timestamp */}
                                        <div
                                            className="text-xs text-blue-400 italic min-w-[100px] text-left pr-2 leading-none">
                                            {new Date(trade.created_at).toLocaleString("en-US", {
                                                year: "numeric",
                                                month: "short",
                                                day: "numeric",
                                                hour: "2-digit",
                                                minute: "2-digit",
                                                second: "2-digit",
                                                hour12: true,
                                            })}
                                        </div>

                                        {/* Divider */}
                                        <div
                                            className="ml-auto h-[20px] w-[1px] bg-slate-600 mx-2 opacity-50 rounded"></div>

                                        {/* Details */}
                                        <div className="flex justify-between items-center flex-1 font-mono">
                                            <div className="flex gap-2">
                                            <span
                                                className="text-slate-300"
                                                title={wallet?.publicKey.toBase58()}
                                            >
                                              User {trade.user_pubkey.slice(0, 4)}...{trade.user_pubkey.slice(-4)}
                                            </span>

                                                <div
                                                    className="ml-auto h-[20px] w-[1px] bg-slate-600 opacity-50 rounded"></div>
                                                <span className="min-w-[220px] inline-block font-mono text-slate-300">
                                              Purchased {trade.amount_purchased.toFixed(2).toLocaleString()}{" "}
                                                    {trade.purchased_outcome[0].toUpperCase() + trade.purchased_outcome.slice(1)} shares
                                            </span>
                                                <div
                                                    className="ml-auto h-[20px] w-[1px] bg-slate-600 opacity-50 rounded"></div>
                                                <span className="text-slate-300">
                                              Average price ${(trade.money_spent / trade.amount_purchased).toFixed(2)}/ share
                                            </span>
                                            </div>
                                            <span className="text-slate-400 font-bold">
                                          ${trade.money_spent.toFixed(2).toLocaleString()}
                                        </span>
                                        </div>
                                    </motion.li>
                                ))}
                            </AnimatePresence>
                        </ul>
                    ) : (
                        <div className="h-[160px] flex flex-col items-center justify-center text-slate-400">
                            <Frown className="w-20 h-20 mb-4"/>
                            <h2 className="text-xl font-semibold">No trades yet.</h2>
                            <p className="text-sm">Be the first one to trade!</p>
                        </div>
                    )}
                </div>

                {wallet?.publicKey && (
                    <div className="rounded-xl bg-[#1f2937] text-white p-6 h-full shadow-md">
                        <div className="grid grid-cols-1 grid-flow-col auto-cols-fr gap-6 text-center">
                            <div className="bg-[#2a3646] rounded-lg p-4 shadow-inner border border-slate-700">
                                <div className="text-sm uppercase tracking-wide text-slate-400 mb-1">
                                    Money Invested
                                </div>
                                <div
                                    className="text-xl font-semibold text-purple-400 mt-3">${moneyInvested.toLocaleString("en-US", {
                                    minimumFractionDigits: 3,
                                    maximumFractionDigits: 3
                                })}</div>
                            </div>

                            <div className="bg-[#2a3646] rounded-lg p-4 shadow-inner border border-slate-700">
                                <div className="text-sm uppercase tracking-wide text-slate-400 mb-1">
                                    Shares Owned
                                </div>
                                <div
                                    className="text-xl font-semibold text-sky-300 flex flex-col gap-2">
                                    <span className="text-green-400">
                                      {yesSharesOwned ? yesSharesOwned.toLocaleString() : "0"} Yes
                                    </span>
                                    <div className={"border-b-2 border-slate-600"}></div>
                                    <span
                                        className="text-red-400">{noSharesOwned ? noSharesOwned.toLocaleString() : "0"} No
                                    </span>
                                </div>
                            </div>

                            <div className="bg-[#2a3646] rounded-lg p-4 shadow-inner border border-slate-700">
                                <div className="text-sm uppercase tracking-wide text-slate-400 mb-1">
                                    Profit / Loss
                                </div>
                                <div className={`text-xl font-semibold mt-3 ${profitMade >= 0 ?
                                    "text-green-400" : "text-red-400"}`}>${profitMade.toLocaleString("en-US", {
                                    minimumFractionDigits: 3,
                                    maximumFractionDigits: 3
                                })}</div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
