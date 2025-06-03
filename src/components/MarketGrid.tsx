// src/components/MarketGrid.tsx
import { useEffect, useState } from "react";
import { MarketCard } from "@/components/MarketCard";
import { getAnchorProgram } from "@/lib/anchor";
import { supabase } from "@/lib/supabase";
import { GridLoader } from "react-spinners";

interface MarketMetadata {
    market_pubkey: string;
    question: string;
}

export const MarketGrid = () => {
    const [markets, setMarkets] = useState<any[]>([]);
    const [metadata, setMetadata] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchMarkets = async () => {
            try {
                const fetchedMarkets = await program.account.market.all();
                setMarkets(fetchedMarkets);

                const pubkeys = fetchedMarkets.map((m) => m.publicKey.toBase58());
                const { data } = await supabase
                    .from("market_metadata")
                    .select("market_pubkey, question")
                    .in("market_pubkey", pubkeys);

                const metaMap: Record<string, string> = {};
                data?.forEach((entry) => {
                    metaMap[entry.market_pubkey] = entry.question;
                });

                setMetadata(metaMap);
            } catch (err) {
                console.error("Error fetching markets or metadata:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchMarkets();
    }, []);

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <GridLoader color="#22c55e" />
            </div>
        );
    }

    return (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {markets.map(({ account, publicKey }, idx) => {
                const pubkeyStr = publicKey.toBase58();

                // Dummy volume for now
                const totalVolume = parseFloat(account.volumeYes.toString() || "0") +
                    parseFloat(account.volumeNo.toString() || "0");

                const yesProb = Math.floor(
                    (parseFloat(account.volumeYes.toString()) / (totalVolume || 1)) * 100
                );

                return (
                    <MarketCard
                        key={pubkeyStr}
                        marketPubkey={pubkeyStr}
                        question={metadata[pubkeyStr] || `Market #${idx + 1}`}
                        yesProbability={yesProb}
                        noProbability={100 - yesProb}
                        volume={`${totalVolume.toFixed(2)} tokens`}
                    />
                );
            })}
        </div>
    );
};
