// src/components/MarketCard.tsx
import {Card, CardContent} from "@/components/ui/card";
import {Button} from "@/components/ui/button";
import {ArrowDown, ArrowUp} from "lucide-react";
import {Link} from "react-router-dom";

interface MarketCardProps {
    marketPubkey: string;
    question: string;
    yesProbability: number;
    noProbability: number;
    volume: string;
}

export const MarketCard = ({
                               marketPubkey,
                               question,
                               yesProbability,
                               noProbability,
                               volume,
                           }: MarketCardProps) => {
    return (
        <Card className="bg-zinc-900 text-white rounded-2xl p-4 shadow-xl transition hover:scale-[1.01]">
            <CardContent className="space-y-3">
                <Link to={`/market/${marketPubkey}`}>
                    <h2 className="text-lg font-semibold hover:underline">
                        {question}
                    </h2>
                </Link>

                <div className="flex justify-between text-sm">
                    <div>
            <span className="text-green-400 font-bold">
              YES: {yesProbability}%
            </span>
                    </div>
                    <div>
            <span className="text-red-400 font-bold">
              NO: {noProbability}%
            </span>
                    </div>
                </div>

                <div className="text-xs text-muted-foreground">
                    Volume: {volume}
                </div>

                <div className="flex gap-2">
                    <Button
                        variant="default"
                        className="flex-1 flex gap-1 items-center justify-center"
                    >
                        <ArrowUp className="w-4 h-4"/>
                        Buy Yes
                    </Button>

                    <Button
                        variant="destructive"
                        className="flex-1 flex gap-1 items-center justify-center"
                    >
                        <ArrowDown className="w-4 h-4"/>
                        Buy No
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
};
