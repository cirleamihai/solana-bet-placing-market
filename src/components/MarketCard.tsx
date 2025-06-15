import {Card, CardContent} from "@/components/ui/card";
import {Button} from "@/components/ui/button";
import {ArrowDown, ArrowUp} from "lucide-react";
import {Link, useNavigate} from "react-router-dom";
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
                           }: MarketCardProps) => {
    const navigator = useNavigate();

    return (
        <Card
            className="bg-[#2f4150] rounded-xl p-4 min-h-[170px] shadow-md hover:shadow-lg transition-all transform-gpu hover:scale-[1.02]  relative border border-[#486279] hover:border-[#64b5f6] hover:bg-[#3b5266]">
            <CardContent className="p-0 flex flex-col gap-4 h-full justify-between">
                {/* ── Header ─────────────────────────────── */}
                <div className="flex items-start justify-between mb-5">
                    <Link to={`/market/${marketPubkey}`} className="flex-1 pr-2">
                        <h2 className="text-xl font-semibold text-white leading-snug w-[85%] hover:underline break-words whitespace-normal">
                            {question}
                        </h2>

                    </Link>

                    {/* Ring pinned to top-right */}
                    <div className="absolute top-2 right-2">
                        <ProbabilityRing value={yesProbability} size={50} stroke={4}/>
                    </div>
                </div>

                {/* ── Buy Buttons ───────────────────────── */}
                <div className="flex-col gap-2 mt-auto">
                    <div className="text-sm text-slate-300 font-medium flex gap-4 mt-1 mb-2.5 justify-between">
                        <span>Yes: <span className="text-white">${(yesProbability / 100).toFixed(2)}</span></span>
                        <span>No: <span
                            className="text-white">${((100 - yesProbability) / 100).toFixed(2)}</span></span>
                    </div>
                    <div className={"flex gap-2 justify-between"}>
                        <Button
                            className="bg-[#2b5453] hover:bg-[#23b866] hover:text-white cursor-pointer w-1/2 h-9 text-lg font-semibold text-[#27ae60] rounded-md"
                            onClick={() => {navigator(`/market/${marketPubkey}?buy=yes`)}}
                        >
                            Buy Yes <ArrowUp className="w-4 h-4 ml-1"/>
                        </Button>

                        <Button
                            className="bg-[#534250] hover:bg-[#c23333] hover:text-white cursor-pointer w-1/2 h-9 text-lg font-semibold text-[#e34600] rounded-md"
                            onClick={() => {navigator(`/market/${marketPubkey}?buy=no`)}}
                        >
                            Buy No <ArrowDown className="w-4 h-4 ml-1"/>
                        </Button>
                    </div>
                </div>

                {/* ── Volume Footer ─────────────────────── */}
                <div className="text-xs text-slate-300">{volume} Vol.</div>
            </CardContent>
        </Card>
    )
};
