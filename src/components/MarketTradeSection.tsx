import React, {Dispatch, useCallback, useEffect, useState} from "react";
import {Button} from "@/components/ui/button";
import {useAnchorProgram} from "@/lib/anchor";
import ConnectWalletButton from "@/components/ConnectWalletButton";
import {computePotentialShareProfit} from "@/blockchain/computePotentialShareProfit";
import {PublicKey, Transaction} from "@solana/web3.js";
import BN from "bn.js";
import {TOKEN_PROGRAM_ID} from "@solana/spl-token";
import {USD_MINT} from "@/lib/constants";
import {toast} from "sonner";
import {createAssociatedTokenAccounts} from "@/blockchain/createAssociatedTokenAccounts";
import {AnchorProvider, EventParser} from "@coral-xyz/anchor";
import {getTransactionDetails} from "@/blockchain/heliusEventListener";
import {supabase} from "@/lib/supabase";
import {motion, AnimatePresence} from "framer-motion";
import {Frown} from "lucide-react";
import {useMarketContext} from "@/components/MarketContext";
import {confirmTransaction} from "@/blockchain/blockchainTransactions";

const CONST_MAX_AMOUNT = 100_000_000; // 100 million

export interface TransactionDetails {
    tx_signature: string;
    market_pubkey: string;
    user_pubkey: string;
    purchased_outcome: "yes" | "no";
    amount_purchased: number; // in shares
    money_spent: number; // in USD
    yes_price: number; // Price of Yes outcome
    no_price: number; // Price of No outcome
    created_at: string; // ISO date string
    tx_slot: number;
}

export interface UserWinnings {
    tx_signature: string,
    market_pubkey: string,
    user_pubkey: string,
    tx_slot: number,
    created_at: string,
    money_invested: number,
    user_winnings: number
    total_owned_yes_tokens: number,
    total_owned_no_tokens: number
}

interface TradeInfo {
    marketPool: any,
    market: any,
    marketKey: PublicKey,
    reloadMarket: number,
    setReloadMarket: (value: any) => void,
    transactionDetails: TransactionDetails[],
    setTransactionDetails: Dispatch<React.SetStateAction<TransactionDetails[]>>,
    setYesPrice: (price: number) => void,
    setNoPrice: (price: number) => void
    lastEventSlot: React.RefObject<number>,
    liquidityEmptyModal: boolean,
    unifiedHandlerRef: React.RefObject<Record<string, (args: { transactionData: any; txSignature: string }) => void>>
    walletWinnings: UserWinnings | null,
    setWalletWinnings: Dispatch<React.SetStateAction<UserWinnings | null>>
    usersWinnings: UserWinnings[],
    setUsersWinnings: Dispatch<React.SetStateAction<UserWinnings[]>>
}

export default function MarketTradeSection({
                                               marketPool,
                                               marketKey,
                                               market,
                                               reloadMarket,
                                               setReloadMarket,
                                               transactionDetails,
                                               setTransactionDetails,
                                               setYesPrice,
                                               setNoPrice,
                                               lastEventSlot,
                                               liquidityEmptyModal,
                                               unifiedHandlerRef,
                                               walletWinnings,
                                               setWalletWinnings,
                                               usersWinnings,
                                               setUsersWinnings
                                           }: TradeInfo) {
    const {wallet, program, connection} = useAnchorProgram(); // Assuming you have a hook to get the wallet context
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
    const [combinedRecentMarketActivity, setCombinedRecentMarketActivity] = useState<any[]>([]);
    const {userBalance} = useMarketContext();
    const [parser, _setParser] = useState(new EventParser(program.programId, program.coder))

    const queryParams = new URLSearchParams(window.location.search);
    const buy_outcome = queryParams.get("buy") as "yes" | "no" | null;
    const [selectedOutcome, setSelectedOutcome] = useState<"yes" | "no">(buy_outcome ?? "yes");

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
            if (!transactionDetails || !wallet || !wallet.publicKey) return;
            const userTransactions = transactionDetails.filter((tx: TransactionDetails) => tx.user_pubkey === wallet?.publicKey?.toBase58());
            const totalInvested = userTransactions.reduce((acc, tx) => acc + tx.money_spent, 0);
            const profit = yesSharesOwned * Number(yesPrice) + noSharesOwned * Number(noPrice) - totalInvested;

            setMoneyInvested(totalInvested);
            setProfitMade(profit);
        }
        computeInvestmentPrice();

    }, [reloadMarket, yesPrice, noPrice, yesSharesOwned, noSharesOwned]);

    const handleNewPurchaseBlockchainEvent = useCallback(
        async (event: { txSignature: string, transactionData: any }) => {
            // We are gonna get the blockchain transaction
            const {transactionSlot, createdAt, userKey} = await getTransactionDetails(connection, event);
            if (!transactionSlot || !createdAt || !userKey) {
                console.error("Failed to get transaction details. Tx: ", event.txSignature);
                return;
            }

            console.log('Transaction details:', event.transactionData);
            const purchasedOutcome = event.transactionData.wantedSharesPurchasedMint.toBase58() === market.yesMint.toBase58() ? "yes" : "no";

            // Add the new transaction to the transaction details list
            const newTransaction: TransactionDetails = {
                tx_signature: event.txSignature,
                market_pubkey: marketKey.toBase58(),
                user_pubkey: userKey,
                purchased_outcome: purchasedOutcome,
                amount_purchased: Number(event.transactionData.wantedSharesPurchased) / 10 ** 9, // Convert from decimals to shares
                money_spent: Number(event.transactionData.amount) / 10 ** 9, // Convert from lamports to USD
                created_at: createdAt, // Use current time for simplicity
                tx_slot: transactionSlot,
                yes_price: Number(event.transactionData.yesPriceBeforePurchase) / 10 ** 9,
                no_price: Number(event.transactionData.noPriceBeforePurchase) / 10 ** 9,
            };
            setTransactionDetails((prev) => {
                return [newTransaction, ...prev].sort(
                    (a, b) => {
                        const timeDiff = new Date(b.created_at).getTime() - new Date(a.created_at).getTime();

                        if (timeDiff !== 0) return timeDiff;

                        // Fallback: sort by slot (descending)
                        return b.tx_slot - a.tx_slot;
                    });
            }); // Keep only the latest 25 transactions
            setReloadMarket((prev: any) => prev + 1);

            // Set the remaining tokens for yes and no outcomes
            if (transactionSlot > lastEventSlot.current) {
                lastEventSlot.current = transactionSlot;
                setYesRemainingTokens(Number(event.transactionData.poolRemainingYesTokens));
                setNoRemainingTokens(Number(event.transactionData.poolRemainingNoTokens));
            }

        }, []);

    const handleNewWinningsBlockchainEvent = useCallback(
        async (event: { txSignature: string, transactionData: any }) => {
            // We are gonna get the blockchain transaction
            const {transactionSlot, createdAt, userKey} = await getTransactionDetails(connection, event);
            if (!transactionSlot || !createdAt || !userKey) {
                console.error("Failed to get transaction details. Tx: ", event.txSignature);
                return;
            }

            // Then we need to query the supabase for the total investment of the user
            const {data, error} = await supabase
                .from("bets")
                .select("money_spent.sum()", {count: "exact"})
                .eq("user_pubkey", userKey)
                .eq("market_pubkey", marketKey.toBase58())

            if (error) {
                console.error("Error fetching user bets:", error);
                return;
            } else if (!data || data.length === 0) {
                console.error(`User ${userKey} has no bets recorded so far.`)
            }
            const moneyInvested = data[0].sum ? Number(data[0].sum) : 0;

            console.log('Transaction details:', event.transactionData);
            const winnings: UserWinnings = {
                tx_signature: event.txSignature,
                market_pubkey: marketKey.toBase58(),
                user_pubkey: userKey,
                tx_slot: transactionSlot,
                created_at: createdAt,
                money_invested: moneyInvested, // Convert from lamports to USD
                user_winnings: Number(event.transactionData.winningAmount) / 10 ** 9 - moneyInvested, // Convert from lamports to USD
                total_owned_yes_tokens: Number(event.transactionData.userYesTokens) / 10 ** 9, // Convert from lamports to shares
                total_owned_no_tokens: Number(event.transactionData.userNoTokens) / 10 ** 9, // Convert from lamports to shares
            }

            if (userKey == wallet?.publicKey?.toBase58()) {
                setWalletWinnings(winnings);
            }

            setUsersWinnings((prev) => {
                return [winnings, ...prev].sort(
                    (a, b) => {
                        const timeDiff = new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
                        if (timeDiff !== 0) return timeDiff;

                        // Fallback: sort by slot (descending)
                        return b.tx_slot - a.tx_slot;
                    }
                )
            })
            setReloadMarket((prev: number) => prev + 1);
        }, []);

    const withdrawUserWinnings = async () => {
        if (!wallet?.publicKey || !marketPool || liquidityEmptyModal) return;

        const ataInstructions: any[] = [];
        setSubmitting(true);

        const [poolKey] = PublicKey.findProgramAddressSync(
            [Buffer.from("pool"), marketKey?.toBuffer() ?? Buffer.from("")],
            program.programId
        )
        const [vaultPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("vault"), marketKey.toBuffer()],
            program.programId
        );

        const userUsd = (await createAssociatedTokenAccounts(USD_MINT, wallet.publicKey, wallet, connection, ataInstructions)).ata;
        const userYesAccount = (await createAssociatedTokenAccounts(market.yesMint, wallet.publicKey, wallet, connection, ataInstructions)).ata;
        const userNoAccount = (await createAssociatedTokenAccounts(market.noMint, wallet.publicKey, wallet, connection, ataInstructions)).ata;

        try {
            const tx = new Transaction();
            ataInstructions.length > 0 && tx.add(...ataInstructions);

            const instruction = await program.methods
                .resolveUserWinnings()
                .accounts({
                    market: marketKey.toBase58(),
                    pool: poolKey,
                    vault: vaultPda,
                    yesMint: market.yesMint,
                    noMint: market.noMint,
                    lpShareMint: market.lpShareMint,
                    userUsdAccount: userUsd,
                    userYesAccount: userYesAccount,
                    userNoAccount: userNoAccount,
                    user: wallet.publicKey,
                    tokenProgram: TOKEN_PROGRAM_ID,
                })
                .instruction()

            tx.add(instruction);
            const provider = program.provider as AnchorProvider;
            const _sig = await provider.sendAndConfirm(tx);

            const {transactionTime, transaction, tx_slot} = await confirmTransaction(
                connection,
                _sig,
                parser,
                "resolveUserWinningsEvent"
            )

            const {error} = await supabase.from("user_winnings")
                .upsert([{
                    tx_signature: _sig,
                    market_pubkey: marketKey.toBase58(),
                    user_pubkey: wallet.publicKey.toBase58(),
                    money_invested: moneyInvested,
                    user_winnings: Number(transaction.winningAmount) / 10 ** 9 - moneyInvested,
                    created_at: transactionTime,
                    total_owned_yes_tokens: yesSharesOwned,
                    total_owned_no_tokens: noSharesOwned,
                    tx_slot: tx_slot,
                }])

            if (error) {
                throw new Error(error.message)
            }

            toast.success("Successfully withdrew winnings!");
            setReloadMarket((prev: any) => prev + 1);
        } catch (e) {
            toast.error("Failed to withdraw winnings. Try again later.")
            console.log("Error creating withdraw instruction:", e);
        } finally {
            setSubmitting(false);
        }
    }

    // Listen to the Helius events for market updates
    useEffect(() => {
        unifiedHandlerRef.current["purchasedOutcomeSharesEvent"] = ({transactionData, txSignature}) => {
            handleNewPurchaseBlockchainEvent({
                transactionData,
                txSignature
            }).then();
        }
        unifiedHandlerRef.current["resolveUserWinningsEvent"] = ({transactionData, txSignature}) => {
            handleNewWinningsBlockchainEvent({
                transactionData,
                txSignature
            }).then();
        }
    }, [])

    // Combine the Winnings with the recent pool transactions
    useEffect(() => {
        if (!transactionDetails && !usersWinnings) return;
        setCombinedRecentMarketActivity(prev => {
            // IMPORTANT: Ensure every element from here contains a unique tx_signature
            const mergedActivity = [...prev, ...transactionDetails, ...usersWinnings];

            return Array.from(
                new Map(mergedActivity.map(obj => [obj.tx_signature, obj])).values()
            ).sort((a, b) => {
                const timeDiff = new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
                return timeDiff !== 0 ? timeDiff : b.tx_slot - a.tx_slot;
            });
        })

    }, [transactionDetails, usersWinnings]);

    // @ts-ignore
    let MAX_AMOUNT = wallet?.publicKey ? userBalance : CONST_MAX_AMOUNT;

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
        if (!wallet?.publicKey || !marketPool || liquidityEmptyModal) return;

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
                    market: marketKey.toBase58(),
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

            const {transactionTime, transaction, tx_slot} = await confirmTransaction(
                connection,
                _sig,
                parser,
                "purchasedOutcomeSharesEvent"
            )

            // Log the transaction to our supabase
            const {error} = await supabase.from("bets").upsert(
                [
                    {
                        tx_signature: _sig,
                        market_pubkey: marketKey,
                        user_pubkey: wallet.publicKey.toBase58(),
                        purchased_outcome: selectedOutcome,
                        amount_purchased: Number(transaction.wantedSharesPurchased) / 10 ** 9, // Convert from decimals to shares
                        money_spent: Number(transaction.amount) / 10 ** 9,
                        yes_price: yesPrice,
                        no_price: noPrice,
                        created_at: transactionTime,
                        tx_slot: tx_slot
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
            if (tx_slot > lastEventSlot.current) {
                lastEventSlot.current = tx_slot;
                setYesRemainingTokens(Number(transaction.poolRemainingYesTokens));
                setNoRemainingTokens(Number(transaction.poolRemainingNoTokens));
            }

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
        if (!wallet?.publicKey || !market) return {yesShares: 0, noShares: 0};

        try {
            const yesTokenAccount = (await createAssociatedTokenAccounts(
                market.yesMint,
                wallet.publicKey,
                wallet,
                connection,
                []
            )).account;
            const noTokenAccount = (await createAssociatedTokenAccounts(
                market.noMint,
                wallet.publicKey,
                wallet,
                connection,
                []
            )).account;

            return {
                // @ts-ignore
                yesShares: yesTokenAccount ? Number(yesTokenAccount.amount) / 10 ** 9 : 0, // Convert from lamports to shares
                // @ts-ignore
                noShares: noTokenAccount ? Number(noTokenAccount.amount) / 10 ** 9 : 0, // Convert from lamports to shares
            };
        } catch (error) {
            toast.error("Failed to fetch owned shares:");
            console.log(error)
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
            <div className="relative">
                <div
                    className={`rounded-xl bg-[#1f2937] text-white p-6 shadow-md transition-all duration-300 ${
                        (liquidityEmptyModal || market.resolved) ? "blur-sm pointer-events-none select-none" : ""
                    }`}
                >
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
                            className={`flex-1 py-3 rounded-md text-center font-semibold text-lg mr-2 cursor-pointer  ${
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

                {liquidityEmptyModal && !market.resolved && (
                    <div className="absolute inset-0 flex items-center justify-center bg-[#1f2937]/90 rounded-xl z-10">
                        <div
                            className="text-center p-6 bg-[#2f3e4e] border border-slate-700 rounded-xl shadow-lg max-w-sm">
                            <h2 className="text-lg font-semibold text-red-400 mb-2">No Liquidity</h2>
                            <p className="text-slate-300 text-sm">
                                This market currently has no liquidity. <br/>
                                To enable trading, please add initial liquidity to the pool.
                            </p>
                        </div>
                    </div>
                )}
                {market.resolved && (
                    <div className="absolute inset-0 flex items-center justify-center bg-[#1f2937]/90 rounded-xl z-10">
                        <div className="text-center p-6 bg-[#2f3e4e] border border-slate-700 rounded-xl shadow-lg">
                            <h2 className="text-2xl font-semibold text-sky-400 mb-2">Market Resolved!</h2>
                            <p className="text-slate-300">
                                The Market has been resolved by an elected third party! <br/>
                                {(yesSharesOwned || noSharesOwned) ?
                                    "You cannot trade anymore - remove your shares from the pool."
                                    : "You cannot trade anymore - chose another market."
                                }
                            </p>
                            <div className="flex justify-between mt-5">
                                <div className="text-lg font-semibold text-sky-400 ">
                                    Outcome Resolution:
                                </div>
                                <div
                                    className={`min-w-3/7 rounded-md text-center font-semibold text-lg ml-2 ${
                                        market.outcome === 0
                                            ? "bg-red-500 text-white"
                                            : "bg-green-500 text-white"
                                    }`}
                                >
                                    {market.outcome ? "Yes" : "No"}
                                </div>
                            </div>
                            {(yesSharesOwned > 0 || noSharesOwned > 0) && (
                                <div className="mt-6 text-center">
                                    <p className="text-slate-400 mb-3 font-medium text-sm">
                                        You are eligible to withdraw your {profitMade > 0 ? "Winnings" : "Shares"}.
                                    </p>
                                    <button
                                        onClick={withdrawUserWinnings}
                                        disabled={submitting}
                                        className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-md font-semibold transition shadow-md ${
                                            submitting ? "bg-purple-300 cursor-not-allowed" : "bg-purple-400 hover:bg-purple-500 cursor-pointer"
                                        } text-black hover:shadow-lg`}
                                    >
                                        {submitting ? (
                                            // Spinner icon
                                            <svg
                                                className="animate-spin h-4 w-4 text-black"
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
                                        ) : (
                                            // Coin icon
                                            <svg
                                                xmlns="http://www.w3.org/2000/svg"
                                                className="h-5 w-5"
                                                fill="none"
                                                viewBox="0 0 24 24"
                                                stroke="currentColor"
                                                strokeWidth={2}
                                            >
                                                <path
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    d="M12 8c-1.657 0-3 1.343-3 3s1.343 3 3 3m0 0c1.657 0 3-1.343 3-3s-1.343-3-3-3m0 6v3m0-3v-3"
                                                />
                                            </svg>
                                        )}

                                        <span>{submitting ? "Withdrawing..." : `Withdraw ${profitMade > 0 ? "Winnings" : "Shares"}`}</span>
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* ── History / Order Book ─────────────────── */}
            <div className="flex flex-col gap-2">
                <div className="rounded-xl bg-[#1f2937] text-white p-6 shadow-md">
                    <h3 className="text-xl font-semibold mb-4">Recent Market Activity</h3>
                    {combinedRecentMarketActivity.length > 0 ? (
                        <ul className="custom-scroll space-y-1 h-[160px] overflow-y-auto pr-1">
                            <AnimatePresence initial={false}>
                                {combinedRecentMarketActivity.slice(0, 25).map((trade, _i) => (
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
                                            className="text-xs text-blue-400 italic min-w-[105px] max-w-[105px] text-left pr-2 leading-none">
                                            {new Date(trade.created_at).toLocaleString("en-US", {
                                                month: "short",
                                                day: "numeric",
                                                hour: "2-digit",
                                                minute: "2-digit",
                                                second: "2-digit",
                                                hour12: false,
                                            })}
                                        </div>

                                        {/* Divider */}
                                        <div className="ml-auto h-[20px] w-[1px] bg-slate-600 mx-2 opacity-50 rounded"/>

                                        {/* Details */}
                                        {trade.purchased_outcome && (
                                            <div className="flex justify-between items-center flex-1 font-mono">
                                                <div className="flex gap-2">
                                                    <span
                                                        className="text-slate-300"
                                                        title={trade.user_pubkey}
                                                    >
                                                      User {trade.user_pubkey.slice(0, 5)}...{trade.user_pubkey.slice(-4)}
                                                    </span>

                                                    <div
                                                        className="ml-auto h-[20px] w-[1px] bg-slate-600 opacity-50 rounded"/>
                                                    <span
                                                        className="min-w-[105px] inline-block font-mono text-slate-300">
                                                            +{trade.amount_purchased.toLocaleString("en-US", {maximumFractionDigits: 2})}{" "}
                                                        {trade.purchased_outcome[0].toUpperCase() + trade.purchased_outcome.slice(1)}
                                                    </span>
                                                    <div
                                                        className="ml-auto h-[20px] w-[1px] bg-slate-600 opacity-50 rounded"/>
                                                    <span className="text-slate-300">
                                                      ≈${(trade.money_spent / trade.amount_purchased).toFixed(2)}/ share
                                                    </span>
                                                </div>
                                                <span className="text-slate-400 font-bold">
                                                      ${trade.money_spent.toLocaleString("en-US", {
                                                    maximumFractionDigits: 2,
                                                    minimumFractionDigits: 2
                                                })}
                                                    </span>
                                            </div>
                                        )}
                                        {trade.user_winnings && (
                                            <div
                                                className={`flex justify-between items-center flex-1 font-mono ${trade.user_winnings > 0 ? "text-green-400" : "text-red-400"}`}>
                                                <div className="flex gap-2">
                                                    <span
                                                        title={trade.user_pubkey}
                                                    >
                                                      User {trade.user_pubkey.slice(0, 5)}...{trade.user_pubkey.slice(-4)}
                                                    </span>
                                                    <div
                                                        className="ml-auto h-[20px] w-[1px] bg-slate-600 opacity-50 rounded"/>
                                                    <span
                                                        className="min-w-[105px] inline-block font-mono">
                                                            -{market.outcome === 0 ? trade.total_owned_no_tokens.toLocaleString("en-US", {
                                                        maximumFractionDigits: 2,
                                                        minimumFractionDigits: 2
                                                    }) : trade.total_owned_yes_tokens.toLocaleString("en-US", {
                                                        maximumFractionDigits: 2,
                                                        minimumFractionDigits: 2
                                                    })}{" "}
                                                        {market.outcome === 0 ? "No" : "Yes"}
                                                    </span>
                                                    <div
                                                        className="ml-auto h-[20px] w-[1px] bg-slate-600 opacity-50 rounded"/>
                                                    <span
                                                        className="min-w-[105px] inline-block font-mono ">
                                                            Invested ${trade.money_invested.toLocaleString("en-US", {
                                                        maximumFractionDigits: 2,
                                                        minimumFractionDigits: 2
                                                    })}
                                                    </span>
                                                </div>
                                                <span
                                                    className={`font-bold ${trade.user_winnings > 0 ? "text-green-400" : "text-red-400"}`}>
                                                      {trade.user_winnings > 0 ? "Profit" : "Lost"} ${trade.user_winnings.toLocaleString("en-US", {
                                                    maximumFractionDigits: 2,
                                                    minimumFractionDigits: 2
                                                })}
                                                    </span>
                                            </div>
                                        )}
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
                                    maximumFractionDigits: 3
                                })}</div>
                            </div>

                            <div className="bg-[#2a3646] rounded-lg p-4 shadow-inner border border-slate-700">
                                <div className="text-sm uppercase tracking-wide text-slate-400 mb-1">
                                    Shares Owned
                                </div>
                                <div
                                    className="text-xl font-semibold text-sky-300 flex flex-col gap-2">
                                    {!walletWinnings && (
                                        <div>
                                            <span className="text-green-400">
                                              {yesSharesOwned ? yesSharesOwned.toLocaleString() : "0"} Yes
                                            </span>
                                            <div className={"border-b-2 border-slate-600"}></div>
                                            <span
                                                className="text-red-400">{noSharesOwned ? noSharesOwned.toLocaleString() : "0"} No
                                            </span>
                                        </div>
                                    )}
                                    {walletWinnings && (
                                        <div>
                                            <span className="text-green-400">
                                              {walletWinnings.total_owned_yes_tokens ? walletWinnings.total_owned_yes_tokens.toLocaleString() : "0"} Yes
                                            </span>
                                            <div className={"border-b-2 border-slate-600"}></div>
                                            <span
                                                className="text-red-400">{walletWinnings.total_owned_no_tokens ? walletWinnings.total_owned_no_tokens.toLocaleString() : "0"} No
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="bg-[#2a3646] rounded-lg p-4 shadow-inner border border-slate-700">
                                <div className="text-sm uppercase tracking-wide text-slate-400 mb-1">
                                    Profit / Loss
                                </div>
                                {!market.resolved && (
                                    <div className={`text-xl font-semibold mt-3 ${profitMade >= 0 ?
                                        "text-green-400" : "text-red-400"}`}>${profitMade.toLocaleString("en-US", {
                                        maximumFractionDigits: 3
                                    })}</div>
                                )}
                                {market.resolved && walletWinnings && walletWinnings.user_winnings && (
                                    <div className={`text-xl font-semibold mt-3 ${walletWinnings.user_winnings >= 0 ?
                                        "text-green-400" : "text-red-400"}`}>${walletWinnings.user_winnings.toLocaleString("en-US", {

                                        maximumFractionDigits: 3
                                    })}</div>
                                )}
                                {market.resolved && !walletWinnings && (
                                    <div
                                        className={`text-xl font-semibold mt-3 ${(market.outcome === 0 ? noSharesOwned - moneyInvested : yesSharesOwned - moneyInvested) >= 0 ?
                                            "text-green-400" : "text-red-400"}`}>
                                        ${(market.outcome === 0 ?
                                        noSharesOwned - moneyInvested :
                                        yesSharesOwned - moneyInvested).toLocaleString("en-US", {
                                        maximumFractionDigits: 3
                                    })}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
