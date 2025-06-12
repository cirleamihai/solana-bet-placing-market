import { useEffect, useMemo, useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { useWallet } from "@solana/wallet-adapter-react";
import { useAnchorProgram } from "@/lib/anchor";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
    PieChart,
    Pie,
    Cell,
    ResponsiveContainer,
    Tooltip,
    Legend,
} from "recharts";
import BN from "bn.js";
import AddLiquidityForm from "@/components/AddLiquidityForm";
import RemoveLiquidityForm from "@/components/RemoveLiquidityForm";
import {AnimatePresence, motion} from "framer-motion";

type Props = {
    marketKey: PublicKey | null;
    poolAccount: any;            // on-chain pool PDA
    reloadMarket: number;
    setReloadMarket: (n: number) => void;
};

export default function LiquidityPoolSection({
                                                 marketKey,
                                                 poolAccount,
                                                 reloadMarket,
                                                 setReloadMarket,
                                             }: Props) {
    const { program } = useAnchorProgram();
    const wallet = useWallet();

    const [action, setAction] = useState<"add" | "remove">("add");
    const [prevAction, setPrevAction] = useState<"add" | "remove">("add");
    const [amount, setAmount] = useState<number>(0);
    const [submitting, setSubmitting] = useState(false);
    const [userShares, setUserShares] = useState<number>(0);
    const [shares, setShares] = useState<number>(0);
    const [liquidityAdded, setLiquidityAdded] = useState(false);
    const [liquidityRemoved, setLiquidityRemoved] = useState(false);

    /* ══════════════════ On-chain fetch of the caller’s share ══════════════════ */
    useEffect(() => {
        (async () => {
            if (!wallet.publicKey || !marketKey) return;
            try {
                // PDA seeds mirror the program’s UserPosition struct, adjust if needed
                const [userPositionPda] = PublicKey.findProgramAddressSync(
                    [Buffer.from("user_position"), marketKey.toBuffer(), wallet.publicKey.toBuffer()],
                    program.programId
                );
                // @ts-ignore – adapt type
                const position = await program.account.userPosition.fetchNullable(
                    userPositionPda
                );
                setUserShares(position?.liquidityShares.toNumber() ?? 0);
            } catch (e) {
                console.error("Failed to load user shares", e);
                toast.error("Could not fetch your LP shares.");
            }
        })();
    }, [wallet.publicKey?.toBase58(), marketKey, reloadMarket]);



    const chartData = useMemo(() => {
        const total = poolAccount?.liquidityShares.toNumber() ?? 1;
        const mine = 4500;
        return [
            { name: "You", value: mine },
            { name: "Others", value: 10000 - mine },
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
        add:    { backgroundColor: "#1f2937" },   // tailwind slate-800
        remove: { backgroundColor: "#2e1065" },   // deep midnight-purple
    };

    /* submit wrappers just dispatch the right RPC */
    const handleAdd = async () => {
        setSubmitting(true);
        try {
            /* …call addLiquidity() here… */
            setAmount(0);
            toast.success("Added liquidity");
            setReloadMarket(reloadMarket + 1);
        } finally {
            setSubmitting(false);
        }
    };

    const handleRemove = async () => {
        setSubmitting(true);
        try {
            setUserShares(0);
            toast.success("Removed liquidity");
            setReloadMarket(reloadMarket + 1);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
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
                            <Cell fill="#00ffa3" />
                            <Cell fill="#1a3970" />
                        </Pie>
                        <Tooltip formatter={(v: any) => `${v.toLocaleString()} shares`} />
                        <Legend />
                    </PieChart>
                </ResponsiveContainer>
            </div>

            {/* ——— Add / Remove Liquidity ——— */}
            <motion.div
                variants={cardVariants}
                animate={action}
                initial={false}
                transition={{ duration: 0.35 }}
                className="rounded-xl text-white p-6 shadow-md overflow-hidden"
            >
                {/* ─ Tabs ─ */}
                <div className="flex gap-4 mb-4 border-b border-gray-700 pb-2">
                    <button
                        className={`flex-1 text-center font-semibold text-lg px-3 border-b-2 cursor-pointer transition-colors ${
                            isAdd ? "text-blue-400 border-blue-400" : "text-gray-400 border-transparent"
                        }`}
                        onClick={() => handleTabSwitch("add")}
                    >
                        Add Liquidity
                    </button>
                    <button
                        className={`flex-1 text-center font-semibold text-lg px-3 border-b-2 cursor-pointer transition-colors ${
                            !isAdd ? "text-purple-400 border-purple-400" : "text-gray-400 border-transparent"
                        }`}
                        onClick={() => handleTabSwitch("remove")}
                    >
                        Remove Liquidity
                    </button>
                </div>

                {/* ─ Slide-animated form switching ─ */}
                <div className="relative items-stretch">
                    <AnimatePresence mode="sync" initial={false}>
                        {isAdd ? (
                            <motion.div
                                key="add"
                                initial={{ x: -50 * direction, opacity: 0 }}
                                animate={{ x: 0, opacity: 1 }}
                                exit={{ x: 50 * direction, opacity: 0 }}
                                transition={{ duration: 0.3 }}
                                className="absolute inset-0"
                            >
                                <AddLiquidityForm
                                    amount={amount}
                                    setAmount={setAmount}
                                    submitting={submitting}
                                    onSubmit={handleAdd}
                                    liquidityAdded={liquidityAdded}
                                    poolAccount={poolAccount}
                                />
                            </motion.div>
                        ) : (
                            <motion.div
                                key="remove"
                                initial={{ x: 50 * direction, opacity: 0 }}
                                animate={{ x: 0, opacity: 1 }}
                                exit={{ x: -50 * direction, opacity: 0 }}
                                transition={{ duration: 0.3 }}
                                className="absolute inset-0"
                            >
                                <RemoveLiquidityForm
                                    shares={shares}
                                    setShares={setShares}
                                    submitting={submitting}
                                    maxShares={userShares}
                                    onSubmit={handleRemove}
                                    liquidityRemoved={liquidityRemoved}
                                />
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </motion.div>
        </div>
    );
}
