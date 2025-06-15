import {useEffect, useState} from "react";
import {MarketCard} from "@/components/MarketCard";
import {useAnchorProgram} from "@/lib/anchor";
import {supabase} from "@/lib/supabase";
import {GridLoader} from "react-spinners";
import EmptyState from "@/components/EmptyState";
import {useDebounce} from "@/lib/useDebounce";
import {useParams} from "react-router-dom";
import {PublicKey} from "@solana/web3.js";
import {listenToMarketChanges} from "@/blockchain/heliusEventListener";
import {useMarketContext} from "@/components/MarketContext";

interface MarketGridProps {
    searchQuery: string;
}


export default function MarketGrid({searchQuery}: MarketGridProps) {
    const [markets, setMarkets] = useState<any[]>([]);
    const [metadata, setMetadata] = useState<Record<string, string>>({});
    const [marketsPool, setMarketsPool] = useState<Record<string, any>>({});
    const [marketStatusChanged, setMarketStatusChanged] = useState(0);
    const [loading, setLoading] = useState(true);
    const {program} = useAnchorProgram();
    const {market_category} = useParams();
    const {newMarket} = useMarketContext();

    listenToMarketChanges(
        setMarketStatusChanged,
        program.programId
    )

    const debouncedMarketName = useDebounce(searchQuery, 500);

    useEffect(() => {
        const fetchMarkets = async () => {
            if (markets.length === 0) {
                setLoading(true);
            }
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

                // Now that we know which markets to keep, we can get the markets pool information
                const marketsPools = await Promise.all(
                    filtered_markets.map(async (market: any) => {
                        // We are going to compute the pool pda first
                        const [poolPda] = PublicKey.findProgramAddressSync(
                            [Buffer.from("pool"), market.publicKey.toBuffer()],
                            program.programId
                        );

                        let poolAccount: any;

                        try {
                            // @ts-ignore
                            poolAccount = await program.account.marketPool.fetch(poolPda);
                        } catch (error) {
                            // @ts-ignore
                            console.log(`Failed to fetch pool for market ${market.publicKey.toBase58()}:`, error.message);
                            poolAccount = null; // Skip this market if pool fetch fails
                        }

                        return [market.publicKey.toBase58(), poolAccount];
                    })
                );
                setMarketsPool(Object.fromEntries(marketsPools));
                setMarkets(filtered_markets);
                setMetadata(metaMap);
            } catch (err) {
                console.error("Error fetching markets or metadata:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchMarkets();
    }, [debouncedMarketName, program, market_category, marketStatusChanged, newMarket]);

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
            {markets.map(({_account, publicKey}, i) => {
                const marketPool = marketsPool[publicKey.toBase58()];
                const keyStr = publicKey.toBase58();

                /* your on-chain struct has yes_liquidity / no_liquidity */
                const yes = Number(marketPool?.yesLiquidity ?? 0);  // We are going to compute no based on yes
                const no = Number(marketPool?.noLiquidity ?? 0);
                const yesAndNoSummedUp = yes + no;
                const totalMarketVolume = Number(marketPool?.usdCollateral ?? 0);
                const yesPrice = yesAndNoSummedUp ? Math.floor((no / yesAndNoSummedUp) * 100) : 50;

                return (
                    <MarketCard
                        key={keyStr}
                        marketPubkey={keyStr}
                        question={metadata[keyStr] || `Market #${i + 1}`}
                        yesProbability={yesPrice}
                        volume={`$${(totalMarketVolume / 10 ** 9).toLocaleString()}`}
                    />
                );
            })}
        </div>
    )


};
