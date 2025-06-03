// src/WalletContextProvider.tsx
import { FC, ReactNode, useMemo } from "react";
import {
    ConnectionProvider,
    WalletProvider,
} from "@solana/wallet-adapter-react";
import {
    WalletModalProvider,
    WalletDisconnectButton,
    WalletMultiButton,
} from "@solana/wallet-adapter-react-ui";

import {
    PhantomWalletAdapter
} from "@solana/wallet-adapter-wallets";

import { clusterApiUrl } from "@solana/web3.js";

// Default styles that can be overridden
import "@solana/wallet-adapter-react-ui/styles.css";

export const WalletContextProvider: FC<{ children: ReactNode }> = ({ children }) => {
    const endpoint = clusterApiUrl("devnet");

    const wallets = useMemo(
        () => [new PhantomWalletAdapter()],
        []
    );

    return (
        <ConnectionProvider endpoint={endpoint}>
            <WalletProvider wallets={wallets} autoConnect>
                <WalletModalProvider>{children}</WalletModalProvider>
            </WalletProvider>
        </ConnectionProvider>
    );
};
