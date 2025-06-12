import {Dispatch, SetStateAction, useEffect, useMemo, useState} from "react";
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
    const {connection, wallet} = useAnchorProgram();

    const [action, setAction] = useState<"add" | "remove">("add");
    const [prevAction, setPrevAction] = useState<"add" | "remove">("add");
    const [submitting, setSubmitting] = useState(false);
    const [userShares, setUserShares] = useState<number>(0);
    const [liquidityRemoved, _setLiquidityRemoved] = useState(false);

    useEffect(() => {
        (async () => {
            if (!market || !wallet || !(wallet?.publicKey)) return;

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


    const chartData = useMemo(() => {
        const total = poolAccount?.liquidityShares.toNumber() ?? 1;
        const mine = 4500;
        return [
            {name: "You", value: mine},
            {name: "Others", value: 10000 - mine},
        ];
    }, [userShares, poolAccount?.liquidityShares]);

    const isAdd = action === "add";
    const direction = isAdd && prevAction === "remove" ? -1 : 1; // ← determines motion direction

    const handleTabSwitch = (newAction: "add" | "remove") => {
        if (newAction !== action) {
            setPrevAction(action);
            setAction(newAction);
        }
    };

    // ───────────── animation variants ─────────────
    const cardVariants = {
        add: {backgroundColor: "#1f2937"},   // tailwind slate-800
        remove: {backgroundColor: "#2e1065"},   // deep midnight-purple
    };
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch">
            {/* ——— Pie Chart ——— */}
            <div className="h-72 w-full">
                <ResponsiveContainer>
                    <PieChart>
                        <Pie
                            data={chartData}
                            dataKey="value"
                            nameKey="name"
                            innerRadius="45%"
                            outerRadius="65%"
                            stroke="none"
                        >
                            {/* keep two simple brand colours; tweak as desired */}
                            <Cell fill="#00ffa3"/>
                            <Cell fill="#1a3970"/>
                        </Pie>
                        <Tooltip formatter={(v: any) => `${v.toLocaleString()} shares`}/>
                        <Legend/>
                    </PieChart>
                </ResponsiveContainer>
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
