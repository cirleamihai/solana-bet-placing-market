// src/useMarketProgram.ts
import {useMemo} from "react";
import {useConnection, useAnchorWallet} from "@solana/wallet-adapter-react";
import {
    Program,
    AnchorProvider,
    Idl, Wallet,
} from "@coral-xyz/anchor";
import idl from "@/idl/solana_bet_placing_market.json";
import {PublicKey, Keypair} from "@solana/web3.js";

export function getAnchorProgram() {
    const {connection} = useConnection();
    const wallet = useAnchorWallet();

    const provider = useMemo(() => {
        if (wallet) {
            return new AnchorProvider(connection, wallet, {});
        }

        const dummyKeypair = Keypair.generate()
        // If there is no wallet defined, return read-only dummy provider
        const dummyWallet: Wallet = {
            publicKey: dummyKeypair.publicKey,
            payer: dummyKeypair,
            signTransaction: async (tx) => tx,
            signAllTransactions: async (txs) => txs,
        }
        return new AnchorProvider(connection, dummyWallet, {});
    }, [connection, wallet]);

    const program = useMemo(() => {
        return new Program(idl as Idl, provider);  // The program ID will be taken from the idl configuration
    }, [provider]);

    return {
        program,
        provider,
        wallet,
        connection,
    };
}
