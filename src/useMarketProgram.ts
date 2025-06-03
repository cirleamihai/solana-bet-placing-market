// src/useMarketProgram.ts
import {useMemo} from "react";
import {useConnection, useAnchorWallet} from "@solana/wallet-adapter-react";
import {
    Program,
    AnchorProvider,
    Idl,
    Wallet,
} from "@coral-xyz/anchor";
import idl from "./idl/solana_bet_placing_market.json";
import {PublicKey} from "@solana/web3.js";

export function useMarketProgram() {
    const {connection} = useConnection();
    const wallet = useAnchorWallet();

    const provider = useMemo(() => {
        if (!wallet) return null;
        return new AnchorProvider(connection, wallet, {});
    }, [connection, wallet]);

    const program = useMemo(() => {
        if (!provider) return null;
        return new Program(idl as Idl, provider);  // The program ID will be taken from the idl configuration
    }, [provider]);

    return {
        program,
        provider,
        wallet,
        connection,
    };
}
