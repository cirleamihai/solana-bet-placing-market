import {Connection} from "@solana/web3.js";
import {EventParser} from "@coral-xyz/anchor";

export const confirmTransaction = async (
    connection: Connection,
    _sig: string,
    parser: EventParser,
    eventName: string
) => {
    const latestBlockHash = await connection.getLatestBlockhash();
    await connection.confirmTransaction({
        blockhash: latestBlockHash.blockhash,
        lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
        signature: _sig
    }, 'confirmed');

    // Parse the transaction logs to find the purchased shares event
    const blockchainConfirmation = await connection.getTransaction(_sig, {
        commitment: 'confirmed',
        maxSupportedTransactionVersion: 0,
    });

    const transactionTime = blockchainConfirmation?.blockTime ? new Date(blockchainConfirmation.blockTime * 1000).toISOString() : new Date().toISOString();
    const parsedEvents = [...parser.parseLogs(blockchainConfirmation?.meta?.logMessages || [])];
    const purchasedEvent = parsedEvents.find(event => event.name === eventName);
    const transaction = purchasedEvent?.data;

    if (!transaction) {
        throw new Error(`No event found with name ${eventName} for transaction ${_sig}`);
    }

    return {
        transactionTime: transactionTime,
        tx_slot: blockchainConfirmation?.slot || 0,
        transaction: transaction
    }
}