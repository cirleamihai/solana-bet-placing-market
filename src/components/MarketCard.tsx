// src/components/MarketCard.tsx
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowDown, ArrowUp } from "lucide-react";
import { Link } from "react-router-dom";
import ProbabilityRing from "@/components/ProbabilityRing";

interface MarketCardProps {
    marketPubkey: string;
    question: string;
    yesProbability: number;
    volume: string;
    /** Optional 48×48 thumbnail / flag / logo */
    imgUrl?: string;
}

export const MarketCard = ({
                               marketPubkey,
                               question,
                               yesProbability,
                               volume,
                           }: MarketCardProps) => (
    <Card className="bg-[#2f4150] rounded-xl p-3 flex flex-col gap-3 shadow hover:shadow-lg transition-shadow">
        {/* ─── Header ─────────────────────────────────────────────── */}
        <div className="flex items-start gap-2">
            {/* avatar / placeholder */}

            {/* title */}
            <Link to={`/market/${marketPubkey}`} className="flex-1">
                <h2 className="text-sm font-semibold leading-snug line-clamp-2 hover:underline">
                    {question}
                </h2>
            </Link>

            {/* chance ring */}
            <ProbabilityRing value={yesProbability} />
        </div>

        {/* ─── Action buttons ─────────────────────────────────────── */}
        <div className="flex gap-2">
            <Button className="bg-green-600/90 hover:bg-green-600 w-1/2 h-8 text-xs font-medium gap-1">
                <ArrowUp className="w-3.5 h-3.5" />
                Buy&nbsp;Yes
            </Button>

            <Button className="bg-red-600/90 hover:bg-red-600 w-1/2 h-8 text-xs font-medium gap-1">
                <ArrowDown className="w-3.5 h-3.5" />
                Buy&nbsp;No
            </Button>
        </div>

        {/* ─── Footer (volume etc.) ───────────────────────────────── */}
        <div className="text-[11px] text-slate-400">{volume} Vol.</div>
    </Card>
);
