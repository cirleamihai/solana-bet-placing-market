import {PublicKey, SystemProgram} from "@solana/web3.js";
import {Program} from "@coral-xyz/anchor";


export async function ensureFactory(authority: PublicKey, program: Program) {
    const [factoryPda] = PublicKey.findProgramAddressSync(
        [
            Buffer.from("market_factory"),
            authority.toBuffer(),
        ],
        program.programId
    );

    try {
        // @ts-ignore
        await program.account.marketFactory.fetch(factoryPda);
        console.log("Market Factory PDA already exists:", factoryPda.createdMarkets.toString());
        // already exists
        return factoryPda;
    } catch {
        // create it
        await program.methods
            .initializeMarketFactory()
            .accounts({
                marketFactory: factoryPda,
                authority,
                systemProgram: SystemProgram.programId,
            })
            .rpc();
        return factoryPda;
    }
}