import { Connection,  } from '@solana/web3.js';
import * as process from "node:process";

export const getWSConnection = (cluster: string): Connection => {
    const endpoint = `wss://api.${cluster}.helius-rpc.com/?api_key=${process.env.VITE_HELIUS_API_KEY}`;
    return new Connection(endpoint, 'confirmed');
}