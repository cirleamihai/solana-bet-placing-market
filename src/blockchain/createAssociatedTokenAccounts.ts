import {PublicKey} from "@solana/web3.js";
import {createAssociatedTokenAccountInstruction, getAccount, getAssociatedTokenAddress} from "@solana/spl-token";
import {AnchorWallet} from "@solana/wallet-adapter-react";

export const createAssociatedTokenAccounts = async (
    mint: PublicKey,
    user: PublicKey,
    wallet: AnchorWallet,
    connection: any,
    ataInstructions: any[]
) => {
    const ata = await getAssociatedTokenAddress(mint, user, true);
    try {
        await getAccount(connection, ata);
    } catch (e) {
        ataInstructions.push(
            createAssociatedTokenAccountInstruction(
                wallet.publicKey, // payer
                ata,              // ata to create
                user,             // owner
                mint              // token mint
            )
        );
    }
    return ata;
}