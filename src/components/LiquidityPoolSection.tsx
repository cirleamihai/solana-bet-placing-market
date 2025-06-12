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
import {getRemoveLiquidityPotentialBenefits} from "@/blockchain/computeLiquidityBenefits";

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
    const [userSharesValue, setUserSharesValue] = useState<number>(0);
    const liquidityPoolShares = useMemo(() => {
        if (!poolAccount || !poolAccount.liquidityShares) return 0;
        return Number(poolAccount.liquidityShares) / 10 ** 9;
    }, [poolAccount?.liquidityShares])
    const userPercentageOfThePool = useMemo(() => {
        if (liquidityPoolShares === 0) return 0;
        return (userShares / liquidityPoolShares) * 100;
    }, [userShares, liquidityPoolShares]);

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
        console.log(liquidityBenefits)
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
                    <h3 className="text-lg font-semibold mb-4">Liquidity Pool Actions</h3>
                    <ul className="space-y-2 text-sm">
                        {/* Row 1: Last Action */}
                        <li className="flex items-center border-b border-slate-700 pb-2">
                            <span className="text-slate-400 w-40">Last Action</span>
                            <div className="ml-auto text-blue-400 font-semibold uppercase">{prevAction}</div>
                        </li>

                        {/* Row 2: Current Mode */}
                        <li className="flex items-center border-b border-slate-700 pb-2">
                            <span className="text-slate-400 w-40">Current Mode</span>
                            <div className="ml-auto text-yellow-400 font-semibold uppercase">{action}</div>
                        </li>

                        {/* Row 3: LP Shares */}
                        <li className="flex items-center">
                            <span className="text-slate-400 w-40">Your LP Shares</span>
                            <div className="ml-auto text-green-300 font-semibold">{userShares.toFixed(2)}</div>
                        </li>
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
