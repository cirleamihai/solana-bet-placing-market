import {PublicKey} from "@solana/web3.js";
import {createAssociatedTokenAccountInstruction, getAccount, getAssociatedTokenAddress} from "@solana/spl-token";
import {AnchorWallet} from "@solana/wallet-adapter-react";

export const createAssociatedTokenAccounts = async (
    mint: PublicKey,
    walletKey: PublicKey,
    wallet: AnchorWallet,
    connection: any,
    ataInstructions: any[]
) => {
    const ata = await getAssociatedTokenAddress(mint, walletKey, true);
    try {
        await getAccount(connection, ata);
    } catch (e) {
        ataInstructions.push(
            createAssociatedTokenAccountInstruction(
                wallet.publicKey, // payer
                ata,              // ata to create
                walletKey,             // owner
                mint              // token mint
            )
        );
    }
    return ata;
}