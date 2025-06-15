import {Connection, PublicKey, Transaction,} from '@solana/web3.js';
import React, {Dispatch, useEffect} from "react";
import {EventParser, Program} from "@coral-xyz/anchor";

export const getWSConnection = (cluster: string): Connection => {
    // @ts-ignore
    const endpoint = `https://${cluster}.helius-rpc.com/?api-key=${import.meta.env.VITE_HELIUS_API_KEY}`;
    return new Connection(endpoint, 'confirmed');
}

export const useLogsListener = (
    marketKey: PublicKey,
    eventParser: EventParser,
    unifiedHandlerRef: React.RefObject<Record<string, (args: { transactionData: any; txSignature: string }) => void>
    >) => {
    useEffect(() => {
        console.log(`Websocket mounted at ${new Date().toISOString()}`);
        if (!marketKey) return;

        const connection = getWSConnection("devnet");

        const logSubscription = connection.onLogs(
            marketKey,
            async (logInfo) => {
                const parsedEvents = [...eventParser.parseLogs(logInfo.logs)];
                for (const event of parsedEvents) {
                    const {name: eventName, data: eventData} = event;
                    const handler = unifiedHandlerRef.current[eventName];
                    if (handler) {
                        handler({
                            transactionData: eventData,
                            txSignature: logInfo.signature
                        });
                    }
                }
            },
            'confirmed'
        );

        return () => {
            connection.removeOnLogsListener(logSubscription);
        };
    }, [marketKey?.toBase58()]);
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
    }, [walletPublicKey.toBase58()]);
}

export const listenToMarketChanges = (
    setMarketStatusChanged: React.Dispatch<React.SetStateAction<number>>,
    programId: PublicKey
) => {
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
    }, [programId.toBase58()]);
}

export const getTransactionDetails = async (
    connection: Connection,
    event: { txSignature: string; transactionData: any; } // Adjust the type as needed
) => {
    const transaction = await connection.getTransaction(event.txSignature, {
        commitment: 'confirmed',
        maxSupportedTransactionVersion: 0,
    })
    if (!transaction) {
        return {
            transactionSlot: null,
            createdAt: null,
            userKey: null
        };
    }

    const transactionSlot = transaction.slot;
    const createdAt = transaction.blockTime ? new Date(transaction.blockTime * 1000).toISOString() : new Date().toISOString();
    const transactionMessage = transaction.transaction.message;
    const userKey = transaction.transaction.message.getAccountKeys().staticAccountKeys
        .map((key) => key.toBase58())
        .filter((_, idx) => transactionMessage.isAccountSigner(idx))[0];

    return {
        transactionSlot,
        createdAt,
        userKey
    }
}