import { useAnchorWallet, useConnection } from "@solana/wallet-adapter-react";
import { Connection, PublicKey } from "@solana/web3.js";
import { Program, AnchorProvider, Idl, setProvider } from "@coral-xyz/anchor";
import idl from "./idl/solana_bet_placing_market.json";

const PROGRAM_ID = new PublicKey(
  "3waVbK9Pps4X1ZwS5GbwDQKmX5syrwe6guwnyN3YJfRc"
);

const { connection } = useConnection();
const wallet = useAnchorWallet();
const provider = new AnchorProvider(connection, wallet, {});
setProvider(provider);

export const program = new Program(idl as Idl, { connection });
