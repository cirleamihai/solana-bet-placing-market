import React, {Dispatch, SetStateAction, useCallback, useEffect, useMemo, useState} from "react";
import {PublicKey} from "@solana/web3.js";
import {useAnchorProgram} from "@/lib/anchor";
import {
    PieChart,
    Pie,
    Cell,
    ResponsiveContainer,
    Tooltip,
    Legend,
} from "recharts";
import AddLiquidityForm from "@/components/AddLiquidityForm";
import RemoveLiquidityForm from "@/components/RemoveLiquidityForm";
import {AnimatePresence, motion} from "framer-motion";
import {createAssociatedTokenAccounts} from "@/blockchain/createAssociatedTokenAccounts";
import {getRemoveLiquidityPotentialBenefits} from "@/blockchain/computeLiquidityBenefits";
import {getTransactionDetails, useLiquidityPoolListener} from "@/blockchain/heliusEventListener";
import {supabase} from "@/lib/supabase";
import {toast} from "sonner";
import {EventParser} from "@coral-xyz/anchor";

type Props = {
    market: any;
    marketPubkey: PublicKey; // public key of the market
    poolAccount: any;            // on-chain pool PDA
    reloadMarket: number;
    setReloadMarket: Dispatch<SetStateAction<number>>;
    reloadLiquidityPool: number;
    setReloadLiquidityPool: Dispatch<SetStateAction<number>>;
    marketDataLoading: boolean
};

interface LiquidityPoolTransaction {
    tx_signature: string,
    tx_slot: number,
    market_pubkey: string,
    user_pubkey: string,
    added_liquidity: boolean,
    created_at: string,
    usd_used: number,
    lp_shares_used: number,
    usd_received: number,
    lp_shares_received: number,
    received_outcome_shares: number,
    received_outcome: string,
    lp_total_shares: number,
}

export default function LiquidityPoolSection({
                                                 market,
                                                 marketPubkey,
                                                 poolAccount,
                                                 reloadMarket,
                                                 setReloadMarket,
                                                 reloadLiquidityPool,
                                                 setReloadLiquidityPool,
                                                 marketDataLoading,
                                             }: Props) {
    const {connection, wallet, program} = useAnchorProgram();

    const [action, setAction] = useState<"add" | "remove">("add");
    const [prevAction, setPrevAction] = useState<"add" | "remove">("add");
    const [submitting, setSubmitting] = useState(false);
    const [userShares, setUserShares] = useState<number>(0);
    const [userSharesValue, setUserSharesValue] = useState<number>(0);
    const [parser, _setParser] = useState(new EventParser(program.programId, program.coder))
    const [poolTransactions, setPoolTransactions] = useState<LiquidityPoolTransaction[]>([]);
    const liquidityPoolShares = useMemo(() => {
        if (!poolAccount || !poolAccount.liquidityShares) return 0;
        return Number(poolAccount.liquidityShares) / 10 ** 9;
    }, [poolAccount?.liquidityShares])
    const userPercentageOfThePool = useMemo(() => {
        if (liquidityPoolShares === 0) return 0;
        return (userShares / liquidityPoolShares) * 100;
    }, [userShares, liquidityPoolShares]);

    // Listening to changes on chain for the liquidity pool history
    const handleNewLiquidityAddedAction = useCallback(
        async (event: { transactionData: any, txSignature: string }) => {
            if (!wallet || !wallet.publicKey) {
                console.error("Wallet not connected");
                return;
            }
            const {transactionSlot, createdAt, userKey} = await getTransactionDetails(connection, event);
            if (!transactionSlot || !createdAt || !userKey) {
                console.error("Failed to get transaction details. Tx: ", event.txSignature);
                return;
            }

            let receivedOutcomeShares, receivedOutcome;
            const receivedYesShares = Number(event.transactionData.yesGivenToUser) / 10 ** 9;
            const receivedNoShares = Number(event.transactionData.noGivenToUser) / 10 ** 9;

            if (receivedYesShares > 0) {
                receivedOutcomeShares = receivedYesShares;
                receivedOutcome = "yes";
            } else {
                receivedOutcomeShares = receivedNoShares;
                receivedOutcome = "no";
            }

            const newTransaction: LiquidityPoolTransaction = {
                tx_signature: event.txSignature,
                tx_slot: transactionSlot,
                market_pubkey: marketPubkey.toBase58(),
                user_pubkey: userKey,
                added_liquidity: true,
                created_at: createdAt,
                usd_used: Number(event.transactionData.amount) / 10 ** 9,
                lp_shares_used: 0,
                usd_received: 0,
                lp_shares_received: Number(event.transactionData.liquiditySharesGained) / 10 ** 9,
                received_outcome_shares: receivedOutcomeShares,
                received_outcome: receivedOutcome,
                lp_total_shares: Number(event.transactionData.poolTotalLiquidityShares) / 10 ** 9,
            }
            console.log(newTransaction);
            const newTransactions = [newTransaction, ...poolTransactions].sort(
                (a, b) => {
                    const timeDiff = new Date(b.created_at).getTime() - new Date(a.created_at).getTime();

                    if (timeDiff !== 0) return timeDiff;

                    // Fallback: sort by slot (descending)
                    return b.tx_slot - a.tx_slot;
                });

            setPoolTransactions(newTransactions.slice(0, 25)); // Keep only the latest 25 transactions
            setReloadMarket((prev: any) => prev + 1);

        }, [])
    const handleNewLiquidityRemovedAction = useCallback(
        async (event: { transactionData: any, txSignature: string }) => {
            if (!wallet || !wallet.publicKey) {
                console.error("Wallet not connected");
                return;
            }
            const {transactionSlot, createdAt, userKey} = await getTransactionDetails(connection, event);
            if (!transactionSlot || !createdAt || !userKey) {
                console.error("Failed to get transaction details. Tx: ", event.txSignature);
                return;
            }

            let receivedOutcomeShares = Number(event.transactionData.receivedLowestOutcomeTokens) / 10 ** 9;
            let receivedOutcome = event.transactionData.receivedLowestOutcomeMint.toBase58() === market.yesMint.toBase58() ? "yes" : "no";

            const newTransaction: LiquidityPoolTransaction = {
                tx_signature: event.txSignature,
                tx_slot: transactionSlot,
                market_pubkey: marketPubkey.toBase58(),
                user_pubkey: userKey,
                added_liquidity: false,
                created_at: createdAt,
                usd_used: 0,
                lp_shares_used: Number(event.transactionData.burntLpShares) / 10 ** 9,
                usd_received: Number(event.transactionData.equivalentUsd) / 10 ** 9,
                lp_shares_received: 0,
                received_outcome_shares: receivedOutcomeShares,
                received_outcome: receivedOutcome,
                lp_total_shares: Number(event.transactionData.poolRemainingLiquidityShares) / 10 ** 9,
            }
            console.log(newTransaction);
            const newTransactions = [newTransaction, ...poolTransactions].sort(
                (a, b) => {
                    const timeDiff = new Date(b.created_at).getTime() - new Date(a.created_at).getTime();

                    if (timeDiff !== 0) return timeDiff;

                    // Fallback: sort by slot (descending)
                    return b.tx_slot - a.tx_slot;
                });

            setPoolTransactions(newTransactions.slice(0, 25)); // Keep only the latest 25 transactions
            setReloadMarket((prev: any) => prev + 1);
        }, [])

    useLiquidityPoolListener(
        handleNewLiquidityAddedAction,
        handleNewLiquidityRemovedAction,
        marketPubkey,
        parser
    )

    useEffect(() => {
        const fetchDbMarketData = async () => {
            if (!marketPubkey) return;

            let {data, error} = await supabase
                .from("liquidity_pool_history").select()
                .eq("market_pubkey", marketPubkey.toBase58())
                .order("tx_slot", {ascending: false})

            if (error) {
                console.error("Error fetching liquidity pool history:", error);
                toast.error("Failed to fetch liquidity pool history");
                return;
            }

            data = data || [];
            const mergedTransactions: LiquidityPoolTransaction[] = [...poolTransactions, ...data];
            const uniqueTransactions = Array.from(new Map(mergedTransactions.map(tx => [tx.tx_signature, tx])).values())
                .sort((a, b) => {
                    const timeDiff = new Date(b.created_at).getTime() - new Date(a.created_at).getTime();

                    if (timeDiff !== 0) return timeDiff;

                    // Fallback: sort by slot (descending)
                    return b.tx_slot - a.tx_slot;
                });
            if (uniqueTransactions.length > 0) {
                setPoolTransactions(uniqueTransactions);
            }
        }

        fetchDbMarketData();
    }, []);

    useEffect(() => {
        (async () => {
            if (!market || !wallet || !(wallet?.publicKey)) {
                setUserShares(0);
                return;
            }

            const lpShareMint = market.lpShareMint;
            const liquiditySharesAccount = (await createAssociatedTokenAccounts(
                lpShareMint,
                wallet?.publicKey,
                wallet,
                connection,
                []
            )).account

            if (liquiditySharesAccount) {
                const shares = Number(liquiditySharesAccount.amount) / 10 ** 9; // Convert from lamports to shares
                setUserShares(shares);
            } else {
                setUserShares(0); // No token account found, balance will be set to 0 in that case
            }
        })();
    }, [wallet?.publicKey.toBase58(), market, reloadLiquidityPool]);

    const isAdd = action === "add";
    const direction = isAdd && prevAction === "remove" ? -1 : 1; // ← determines motion direction

    const handleTabSwitch = (newAction: "add" | "remove") => {
        if (newAction !== action) {
            setPrevAction(action);
            setAction(newAction);
        }
    };

    const chartData = useMemo(() => {

        let total = poolAccount?.liquidityShares ? poolAccount.liquidityShares.toNumber() / 10 ** 9 : 0;
        const mine = userShares;
        const userSharePercentage = total > 0 ? (mine / total) * 100 : 0;
        const othersSharePercentage = 100 - userSharePercentage;
        return [
            {name: `You ${userSharePercentage.toFixed(2)}%`, value: mine},
            {name: `Others ${othersSharePercentage.toFixed(2)}%`, value: total - mine},
        ];
    }, [reloadMarket, userShares, liquidityPoolShares]);

    useEffect(() => {
        const liquidityBenefits = getRemoveLiquidityPotentialBenefits(
            Number(poolAccount.liquidityShares) / 10 ** 9,
            Number(poolAccount.yesLiquidity) / 10 ** 9,
            Number(poolAccount.noLiquidity) / 10 ** 9,
            userShares
        )
        setUserSharesValue(liquidityBenefits.moneyToReceive);
    }, [reloadMarket, userShares]);

    // ───────────── animation variants ─────────────
    const cardVariants = {
        add: {backgroundColor: "#1f2937"},   // tailwind slate-800
        remove: {backgroundColor: "#2e1065"},   // deep midnight-purple
    };
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch">
            <div className="flex flex-col gap-4 text-white">
                {/* ─── Pool Overview ─── */}
                <div className="rounded-xl bg-[#1f2937] p-4 shadow-md text-white">
                    <h3 className="text-sm text-slate-400 uppercase mb-4">Pool Overview</h3>

                    <div className="grid grid-cols-4 grid-rows-2 gap-4">
                        {/* ─── Pie Chart ─── */}
                        <div className="row-span-2 flex items-center justify-center">
                            <div className="flex items-center gap-4">
                                {/* Chart */}
                                <div className="w-[130px] h-[130px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={chartData}
                                                dataKey="value"
                                                nameKey="name"
                                                cx="50%"
                                                cy="50%"
                                                innerRadius="50%"
                                                outerRadius="80%"
                                                stroke="none"
                                            >
                                                <Cell fill="#00ffa3"/>
                                                <Cell fill="#693992"/>
                                            </Pie>
                                            <Tooltip formatter={(v: any) => `${v.toLocaleString()} shares`}/>
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>

                                {/* Legend */}
                                <div className="space-y-2">
                                    {chartData.map((entry, idx) => (
                                        <div key={entry.name} className="flex items-center text-slate-300">
                                            <span
                                                className="w-3 h-3 rounded-full inline-block mr-2"
                                                style={{backgroundColor: idx === 0 ? "#00ffa3" : "#693992"}}
                                            />
                                            <span className="text-sm">{entry.name}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* ─── Stat 1 ─── */}
                        <div className="bg-[#2a3646] rounded-lg p-4 shadow-inner border border-slate-700 text-center">
                            <div className="text-sm uppercase tracking-wide text-slate-400 mb-1">Total Liquidity</div>
                            <div className="text-md font-semibold text-blue-400">
                                {liquidityPoolShares.toLocaleString()} Shares
                            </div>
                        </div>

                        {/* ─── Stat 2 ─── */}
                        <div className="bg-[#2a3646] rounded-lg p-4 shadow-inner border border-slate-700 text-center">
                            <div className="text-sm uppercase tracking-wide text-slate-400 mb-1">Your Shares</div>
                            <div className="text-md font-semibold text-emerald-400">
                                {userShares.toLocaleString("en-US", {maximumFractionDigits: 3})} LP Shares
                            </div>
                        </div>

                        {/* ─── Pool Liquidity ─── */}
                        <div
                            className="row-span-2 bg-[#2a3646] rounded-lg p-4 shadow-inner border border-slate-700 text-center flex flex-col justify-start">
                            <div className="text-xl uppercase tracking-wide text-slate-400 mb-4">
                                Pool Liquidity
                            </div>
                            <div className="text-xl font-semibold text-green-400">
                                {(poolAccount?.yesLiquidity.toNumber() / 10 ** 9).toLocaleString("en-US", {
                                    maximumFractionDigits: 3,
                                    minimumFractionDigits: 3
                                })} Yes
                            </div>
                            <div className="border-b border-slate-600 my-2 mx-auto w-full"/>
                            <div className="text-xl font-semibold text-red-400">
                                {(poolAccount?.noLiquidity.toNumber() / 10 ** 9).toLocaleString("en-US", {
                                    maximumFractionDigits: 3,
                                    minimumFractionDigits: 3
                                })} No
                            </div>
                        </div>

                        {/* ─── Stat 3 ─── */}
                        <div className="bg-[#2a3646] rounded-lg p-4 shadow-inner border border-slate-700 text-center">
                            <div className="text-sm uppercase tracking-wide text-slate-400 mb-1">% of Pool Owned</div>
                            <div className="text-md font-semibold text-yellow-300">
                                {userPercentageOfThePool !== 0 && userPercentageOfThePool !== 100
                                    ? userPercentageOfThePool.toFixed(2)
                                    : userPercentageOfThePool} %
                            </div>
                        </div>

                        {/* ─── Stat 4 ─── */}
                        <div className="bg-[#2a3646] rounded-lg p-4 shadow-inner border border-slate-700 text-center">
                            <div className="text-sm uppercase tracking-wide text-slate-400 mb-1">USD-UBB in Shares</div>
                            <div
                                className="text-md font-semibold text-sky-300">${userSharesValue.toLocaleString("en-US", {
                                maximumFractionDigits: 2,
                                minimumFractionDigits: 2
                            })}</div>
                        </div>
                    </div>
                </div>

                {/* ─── Liquidity Pool Actions ─── */}
                <div className="rounded-xl bg-[#1f2937] text-white p-6 shadow-md">
                    <div className="flex justify-between">
                        <h3 className="text-xl font-semibold mb-4">Liquidity History</h3>
                        <h3 className="text-sm font-semibold mt-2 mr-3">Received</h3>
                    </div>

                    <ul className="custom-scroll max-h-[110px] space-y-1 overflow-y-auto pr-1">
                        <AnimatePresence initial={false}>
                            {poolTransactions.slice(0, 25).map((transaction, _i) => (
                                <motion.li
                                    key={transaction.tx_signature} // ✅ Use unique key
                                    initial={{opacity: 0, y: 10}}
                                    animate={{opacity: 1, y: 0}}
                                    exit={{opacity: 0, y: -10}}
                                    transition={{duration: 0.3, ease: "easeOut"}}
                                    className="flex items-center border-b cursor-pointer border-gray-700 px-2 py-[6px] rounded-md hover:bg-[#273447] transition duration-150 text-sm"
                                >
                                    {/* Timestamp */}
                                    <div
                                        className="text-xs text-blue-400 italic min-w-[90px] text-left pr-2 leading-none">
                                        {new Date(transaction.created_at).toLocaleString("en-US", {
                                            month: "short",
                                            day: "numeric",
                                            hour: "2-digit",
                                            minute: "2-digit",
                                            second: "2-digit",
                                            hour12: false,
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
                                              User {transaction.user_pubkey.slice(0, 5)}...{transaction.user_pubkey.slice(-4)}
                                            </span>

                                            <div
                                                className="ml-auto h-[20px] w-[1px] bg-slate-600 opacity-50 rounded"></div>
                                            <span
                                                className="min-w-[53px] inline-block font-mono text-slate-300 text-center">
                                                    {transaction.added_liquidity ? "ADDED" : "REMOVED"}
                                            </span>
                                            <div
                                                className="ml-auto h-[20px] w-[1px] bg-slate-600 opacity-50 rounded"></div>
                                            <span className="text-slate-300">
                                              {
                                                  transaction.added_liquidity ?
                                                      `$${transaction.usd_used.toLocaleString("en-US", {
                                                          maximumFractionDigits: 2,
                                                          minimumFractionDigits: 2
                                                      })} in the pool` :
                                                      `${transaction.lp_shares_used.toLocaleString("en-US", {
                                                          maximumFractionDigits: 2,
                                                          minimumFractionDigits: 2
                                                      })} LPs from the pool`
                                              }
                                            </span>
                                        </div>
                                        <span className="text-slate-400 font-bold">
                                          {
                                              transaction.added_liquidity ?
                                                  `${transaction.lp_shares_received.toLocaleString("en-US", {
                                                      maximumFractionDigits: 2,
                                                      minimumFractionDigits: 2
                                                  })} LP shares` :
                                                  `$${transaction.usd_received.toLocaleString("en-US", {
                                                      maximumFractionDigits: 2,
                                                      minimumFractionDigits: 2
                                                  })}`
                                          }
                                        </span>
                                    </div>
                                </motion.li>
                            ))}
                        </AnimatePresence>
                    </ul>
                </div>

            </div>

            {/* ——— Add / Remove Liquidity ——— */}
            <motion.div
                variants={cardVariants}
                animate={action}
                initial={false}
                transition={{duration: 0.35}}
                className="rounded-xl text-white p-6 shadow-md relative min-h-[420px]"
            >
                {/* Tabs */}
                <div className="flex gap-4 mb-4 border-b border-gray-700 pb-2">
                    <button
                        className={`flex-1 text-center font-semibold text-lg px-3 border-b-2 cursor-pointer transition-colors ${
                            isAdd ? "text-blue-400 border-blue-400" : "text-gray-400 border-transparent"
                        }`}
                        onClick={() => handleTabSwitch("add")}
                        disabled={submitting}
                    >
                        Add Liquidity
                    </button>
                    <button
                        className={`flex-1 text-center font-semibold text-lg px-3 border-b-2 cursor-pointer transition-colors ${
                            !isAdd ? "text-purple-400 border-purple-400" : "text-gray-400 border-transparent"
                        }`}
                        onClick={() => handleTabSwitch("remove")}
                        disabled={submitting}
                    >
                        Remove Liquidity
                    </button>
                </div>

                <div className="relative w-full h-full">
                    <AnimatePresence mode="sync" initial={false}>
                        {isAdd ? (
                            <motion.div
                                key="add"
                                initial={{x: -50 * direction, opacity: 0}}
                                animate={{x: 0, opacity: 1}}
                                exit={{x: 50 * direction, opacity: 0}}
                                transition={{duration: 0.3}}
                                className="absolute inset-0"
                            >
                                <AddLiquidityForm
                                    submitting={submitting}
                                    poolAccount={poolAccount}
                                    userShares={userShares}
                                    marketKey={marketPubkey}
                                    setSubmitting={setSubmitting}
                                    setReloadLiquidityPool={setReloadLiquidityPool}
                                    reloadMarket={reloadMarket}
                                    setReloadMarket={setReloadMarket}
                                    market={market}
                                />
                            </motion.div>
                        ) : (
                            <motion.div
                                key="remove"
                                initial={{x: 50 * direction, opacity: 0}}
                                animate={{x: 0, opacity: 1}}
                                exit={{x: -50 * direction, opacity: 0}}
                                transition={{duration: 0.3}}
                                className="absolute inset-0"
                            >
                                <RemoveLiquidityForm
                                    submitting={submitting}
                                    poolAccount={poolAccount}
                                    userShares={userShares}
                                    marketKey={marketPubkey}
                                    setSubmitting={setSubmitting}
                                    setReloadLiquidityPool={setReloadLiquidityPool}
                                    reloadMarket={reloadMarket}
                                    setReloadMarket={setReloadMarket}
                                    market={market}
                                />
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </motion.div>
        </div>
    );
}
