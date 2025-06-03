// src/components/MarketGrid.tsx
import {useEffect, useState} from "react";
import {MarketCard} from "@/components/MarketCard";
import {useAnchorProgram} from "@/lib/anchor";
import {supabase} from "@/lib/supabase";
import {GridLoader} from "react-spinners";
import EmptyState from "@/components/EmptyState";

interface MarketMetadata {
    market_pubkey: string;
    market_name: string;
}

export default function MarketGrid() {
    const [markets, setMarkets] = useState<any[]>([]);
    const [metadata, setMetadata] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(true);
    const {program} = useAnchorProgram();

    useEffect(() => {
        const fetchMarkets = async () => {
            try {
                // @ts-ignore
                const fetchedMarkets = await program.account.market.all();
                setMarkets(fetchedMarkets);

                const pubkeys = fetchedMarkets.map((m: any) => m.publicKey.toBase58());
                const {data} = await supabase
                    .from("market_metadata")
                    .select("market_pubkey, market_name")
                    .in("market_pubkey", pubkeys);

                const metaMap: Record<string, string> = {};
                data?.forEach((entry) => {
                    metaMap[entry.market_pubkey] = entry.market_name;
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
                <GridLoader color="#a6d1e6"/>
            </div>
        );
    }

    return markets.length === 0 ? (
        <EmptyState/>
    ) : (
        <div className="grid gap-4 grid-cols-[repeat(auto-fit,minmax(280px,auto))] w-[58%] mx-auto mt-8">
            {markets.filter((market) => {
                const key = market.publicKey.toBase58();
                return metadata.hasOwnProperty(key);
            })
                .map(({account, publicKey}, i) => {
                    const keyStr = publicKey.toBase58();

                    /* your on-chain struct has yes_liquidity / no_liquidity */
                    const yes = Number(account.yesLiquidity ?? 0);
                    const no = Number(account.noLiquidity ?? 0);
                    const vol = yes + no;
                    const yesPct = vol ? Math.floor((yes / vol) * 100) : 50;

                    return (
                        <MarketCard
                            key={keyStr}
                            marketPubkey={keyStr}
                            question={metadata[keyStr] || `Market #${i + 1}`}
                            yesProbability={yesPct}
                            volume={`$${vol.toLocaleString()}`}
                        />
                    );
                })}
        </div>
    )


};
