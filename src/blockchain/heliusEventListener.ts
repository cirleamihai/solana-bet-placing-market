import {Connection, PublicKey, Transaction,} from '@solana/web3.js';
import React, {useEffect} from "react";
import {EventParser, Program} from "@coral-xyz/anchor";

export const getWSConnection = (cluster: string): Connection => {
    // @ts-ignore
    const endpoint = `https://${cluster}.helius-rpc.com/?api-key=${import.meta.env.VITE_HELIUS_API_KEY}`;
    return new Connection(endpoint, 'confirmed');
}

export const usePurchaseSharesListener = (
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
                console.log('New logs received:', logInfo);
                const parsedEvents = [...parser.parseLogs(logInfo.logs)];
                for (const event of parsedEvents) {
                    const {name: eventName, data: eventData} = event;
                    if (eventName === "purchasedOutcomeSharesEvent") {
                        handleNewPurchase({transactionData: eventData, txSignature: logInfo.signature});
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
    }, [marketKey?.toBase58(), programId.toBase58()]);
};

export const useLiquidityPoolListener = (
    handleNewLiquidityAddedAction: (event: any) => void,
    handleNewLiquidityRemovedAction: (event: any) => void,
    marketKey: PublicKey,
    parser: EventParser
) => {
    useEffect(() => {
        if (!marketKey) return;

        const connection = getWSConnection("devnet");

        const logSubscription = connection.onLogs(
            marketKey,
            async (logInfo) => {
                const parsedEvents = [...parser.parseLogs(logInfo.logs)];
                for (const event of parsedEvents) {
                    const {name: eventName, data: eventData} = event;
                    if (eventName === "liquidityAddedEvent") {
                        handleNewLiquidityAddedAction({
                            transactionData: eventData,
                            txSignature: logInfo.signature
                        });
                    } else if (eventName === "liquidityRemovedEvent") {
                        handleNewLiquidityRemovedAction({
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
    }, [marketKey.toBase58()]);
}

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
    // noinspection DuplicatedCode
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