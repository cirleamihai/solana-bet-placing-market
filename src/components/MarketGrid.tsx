// src/components/MarketGrid.tsx
import {useEffect, useState} from "react";
import {MarketCard} from "@/components/MarketCard";
import {useAnchorProgram} from "@/lib/anchor";
import {supabase} from "@/lib/supabase";
import {GridLoader} from "react-spinners";
import EmptyState from "@/components/EmptyState";
import {useDebounce} from "@/lib/useDebounce";
import {useParams} from "react-router-dom";

interface MarketGridProps {
    searchQuery: string;
}


export default function MarketGrid({searchQuery}: MarketGridProps) {
    const [markets, setMarkets] = useState<any[]>([]);
    const [metadata, setMetadata] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(true);
    const {program} = useAnchorProgram();
    const {market_category} = useParams();

    const debouncedMarketName = useDebounce(searchQuery, 500);

    useEffect(() => {
        const fetchMarkets = async () => {
            setLoading(true);
            try {
                // @ts-ignore
                const fetchedMarkets = await program.account.market.all();

                const pubkeys = fetchedMarkets.map((m: any) => m.publicKey.toBase58());
                const query = supabase
                    .from("market_metadata")
                    .select("market_pubkey, market_name")
                    .in("market_pubkey", pubkeys);

                if (debouncedMarketName) {
                    query.ilike("market_name", `%${debouncedMarketName}%`);
                }

                if (market_category) {
                    query.ilike("market_category", market_category);
                }

                const {data} = await query;

                const metaMap: Record<string, string> = {};
                data?.forEach((entry) => {
                    metaMap[entry.market_pubkey] = entry.market_name;
                });

                const filtered_markets = fetchedMarkets.filter((market: any) => {
                    const key = market.publicKey.toBase58();
                    return metaMap.hasOwnProperty(key);
                });

                setMarkets(filtered_markets);
                setMetadata(metaMap);
            } catch (err) {
                console.error("Error fetching markets or metadata:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchMarkets();
    }, [debouncedMarketName, program, market_category]);

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
        <div className="grid gap-4 grid-cols-[repeat(auto-fit,minmax(280px,auto))] w-[70%] mx-auto mt-8">
            {markets.map(({account, publicKey}, i) => {
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
