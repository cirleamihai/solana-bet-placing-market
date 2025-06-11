import {Connection, PublicKey, Transaction,} from '@solana/web3.js';
import React, {useEffect} from "react";
import {EventParser, Program} from "@coral-xyz/anchor";

export const getWSConnection = (cluster: string): Connection => {
    const endpoint = `https://${cluster}.helius-rpc.com/?api-key=${import.meta.env.VITE_HELIUS_API_KEY}`;
    return new Connection(endpoint, 'confirmed');
}

export const listenToPurchaseSharesEventHelius = (
    marketKey: PublicKey,
    programId: PublicKey,
    setReloadShares: React.Dispatch<React.SetStateAction<number>>,
    parser: EventParser,
    handleNewPurchase: (event: any) => void,  // Callback to handle new purchase events
) => {

    useEffect(() => {
        if (!marketKey) return;

        const connection = getWSConnection("devnet");

        const logSubscription = connection.onLogs(
            programId,
            async (logInfo) => {
                const parsedEvents = [...parser.parseLogs(logInfo.logs)];
                for (const event of parsedEvents) {
                    const {name: eventName, data: eventData} = event;
                    if (eventName === "purchasedOutcomeSharesEvent") {
                        handleNewPurchase({transaction: eventData, txSignature: logInfo.signature});          // ← your UI update
                    }
                }
            },
            'confirmed'
        );

        const accountSubscription = connection.onAccountChange(
            marketKey,
            (accountInfo, _context) => {
                console.log('Market account changed:', accountInfo);
                setReloadShares((prev) => prev + 1);
            },
            {
                commitment: 'confirmed',
            }
        );

        return () => {
            connection.removeOnLogsListener(logSubscription);
            connection.removeAccountChangeListener(accountSubscription);
        };
    }, [marketKey, programId, handleNewPurchase]);
};

export const listenToAccountChangeHelius = (
    setAccountChange: React.Dispatch<React.SetStateAction<number>>,
    walletPublicKey: PublicKey,
) => {
    useEffect(() => {
        const connection = getWSConnection("devnet");

        const accountChangeSubscription = connection.onAccountChange(
            walletPublicKey,
            async (accountInfo, _context) => {
                console.log('Account changed:', accountInfo);
                setAccountChange((prev) => prev + 1);  // Trigger UI update or state change
            }
        )

        return () => {
            connection.removeAccountChangeListener(accountChangeSubscription);
        }
    }, [walletPublicKey]);
}

export const listenToMarketChanges = (
    setMarketStatusChanged: React.Dispatch<React.SetStateAction<number>>,
    programId: PublicKey
)=> {
    useEffect(() => {
        const connection = getWSConnection("devnet");

        const logSubscription = connection.onLogs(
            programId,
            async (logInfo) => {
                console.log('Market status changed:', logInfo);
                setMarketStatusChanged((prev) => prev + 1);  // Trigger UI update or state change
            },
            'confirmed'
        );

        return () => {
            connection.removeOnLogsListener(logSubscription);
        };
    }, [programId, setMarketStatusChanged]);
}
