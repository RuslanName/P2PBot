import * as bitcoin from 'bitcoinjs-lib';
import { TronWeb } from 'tronweb';
import {
    MoneroWalletRpc,
    MoneroWalletConfig,
    MoneroTransferQuery,
    MoneroRpcConnection,
    MoneroNetworkType,
    MoneroConnectionManager
} from 'monero-ts';
import { ECPairFactory } from 'ecpair';
import * as ecc from 'tiny-secp256k1';
import axios from 'axios';
import { Wallet } from './types';
import * as dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { decrypt } from './crypto';

dotenv.config();

const prisma = new PrismaClient();

const ECPair = ECPairFactory(ecc);

const litecoinNetwork = {
    messagePrefix: '\x19Litecoin Signed Message:\n',
    bech32: 'tltc',
    bip32: { public: 0x0436ef7d, private: 0x0436ef7d },
    pubKeyHash: 0x6f,
    scriptHash: 0x3a,
    wif: 0xef,
};

const blockcypherApi = axios.create({
    baseURL: 'https://api.blockcypher.com/v1',
    params: { token: process.env.BLOCKCYPHER_API_KEY },
});

const tronWeb = new TronWeb({
    fullHost: 'https://api.shasta.trongrid.io',
    headers: { 'TRON-PRO-API-KEY': process.env.TRONGRID_API_KEY || '' },
});

export function generateBTCWallet(): Wallet {
    const network = bitcoin.networks.testnet;
    const keyPair = ECPair.makeRandom({ network });
    const pubkeyBuffer = Buffer.from(keyPair.publicKey);
    const { address } = bitcoin.payments.p2wpkh({ pubkey: pubkeyBuffer, network });
    return { address: address!, privateKey: keyPair.toWIF() };
}

export function generateLTCWallet(): Wallet {
    const keyPair = ECPair.makeRandom({ network: litecoinNetwork });
    const pubkeyBuffer = Buffer.from(keyPair.publicKey);
    const { address } = bitcoin.payments.p2wpkh({ pubkey: pubkeyBuffer, network: litecoinNetwork });
    return { address: address!, privateKey: keyPair.toWIF() };
}

export async function generateUSDTWallet(): Promise<Wallet> {
    const wallet = await tronWeb.createAccount();
    return { address: wallet.address.base58, privateKey: wallet.privateKey };
}

// export async function generateXMRWallet(): Promise<Wallet> {
//     try {
//         const config = {
//             networkType: MoneroNetworkType.TESTNET,
//             server: new MoneroRpcConnection({
//                 uri: process.env.MONERO_WALLET_RPC_HOST || 'https://testnet.xmr.ditatompel.com:18083',
//                 rejectUnauthorized: false,
//             }),
//             path: `wallet_${Date.now()}`,
//             password: '',
//             language: 'English',
//             proxyToWorker: false,
//             connectionManager: new MoneroConnectionManager(),
//         } as unknown as MoneroWalletConfig;
//
//         const walletRpc = new MoneroWalletRpc(config);
//         await walletRpc.createWallet(config);
//         await walletRpc.startSyncing();
//
//         const address = await walletRpc.getPrimaryAddress();
//         const privateKey = await walletRpc.getPrivateSpendKey();
//
//         const wallet: Wallet = {
//             address,
//             privateKey,
//             walletPath: config.path,
//         };
//
//         await walletRpc.close(true);
//
//         return wallet;
//     } catch (error) {
//         console.error('Error generating XMR wallet:', error);
//         throw new Error('Failed to generate XMR wallet');
//     }
// }

export async function checkDeposits(
    address: string,
    coin: string,
    userId: string
): Promise<{ txid: string; amount: number }[]> {
    try {
        let deposits: { txid: string; amount: number }[] = [];

        if (coin === 'USDT') {
            const usdtContractAddress = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';
            const usdtABI = [
                {
                    "anonymous": false,
                    "inputs": [
                        { "indexed": true, "name": "from", "type": "address" },
                        { "indexed": true, "name": "to", "type": "address" },
                        { "name": "value", "type": "uint256" }
                    ],
                    "name": "Transfer",
                    "type": "event"
                }
            ];
            console.log(`Checking USDT deposits for address: ${address}`);
            const contract = await tronWeb.contract(usdtABI).at(usdtContractAddress);
            const filter = { toAddress: address };
            const events = await contract.getPastEvents('Transfer', { filter });
            deposits = events.map((event: { transaction_id: any; returnValues: { value: number; }; }) => ({
                txid: event.transaction_id,
                amount: event.returnValues.value / 1e6,
            })).filter((tx: { amount: number }) => tx.amount > 0);
            console.log(`Found ${deposits.length} USDT deposits for ${address}`);
        } else if (coin === 'XMR') {
            const user = await prisma.user.findUnique({
                where: { chatId: userId },
                include: { wallets: { where: { coin: 'XMR' } } }
            });
            if (!user || !user.wallets[0] || !user.wallets[0].walletPath) {
                console.error('User or wallet not found');
                return [];
            }

            const config = {
                networkType: MoneroNetworkType.TESTNET,
                server: new MoneroRpcConnection({
                    uri: process.env.MONERO_WALLET_RPC_HOST || 'https://testnet.xmr.ditatompel.com:18083',
                    rejectUnauthorized: false,
                }),
                path: `wallet_${Date.now()}`,
                password: '',
                language: 'English',
                proxyToWorker: false,
                connectionManager: new MoneroConnectionManager(),
            } as unknown as MoneroWalletConfig;

            const walletRpc = new MoneroWalletRpc(config);
            await walletRpc.openWallet(config);
            await walletRpc.startSyncing();

            const transfers = await walletRpc.getTransfers({
                isIncoming: true,
                minHeight: 0,
            } as unknown as MoneroTransferQuery);

            deposits = transfers
                .filter(tx => tx.getTx().getIsConfirmed())
                .map(tx => ({
                    txid: tx.getTx().getHash(),
                    amount: Number(tx.getAmount()) / 1e12,
                }))
                .filter(tx => tx.amount > 0);

            await walletRpc.close();
        } else {
            const chain = coin === 'BTC' ? 'btc/test3' : 'ltc/testnet';
            const response = await blockcypherApi.get(`/${chain}/addrs/${address}/full?unspentOnly=false`);
            const txs = response.data.txs || [];

            deposits = txs
                .filter((tx: any) => tx.confirmations > 0)
                .map((tx: any) => {
                    const relevantOutputs = tx.outputs.filter((output: any) =>
                        output.addresses && output.addresses.includes(address));
                    const amount = relevantOutputs.reduce((sum: number, output: any) =>
                        sum + (output.value || 0), 0) / 1e8;
                    return { txid: tx.hash, amount };
                })
                .filter((tx: any) => tx.amount > 0);
        }

        const user = await prisma.user.findUnique({
            where: { chatId: userId },
            include: { wallets: { where: { coin } } }
        });
        if (!user || !user.wallets[0]) {
            console.error('User or wallet not found');
            return [];
        }

        const existingTxIds = (await prisma.transaction.findMany({
            where: {
                userId: user.id,
                coin,
                type: 'deposit'
            },
            select: { txId: true }
        })).map(tx => tx.txId);

        const newDeposits = deposits.filter(deposit => !existingTxIds.includes(deposit.txid));

        if (newDeposits.length > 0) {
            await prisma.transaction.createMany({
                data: newDeposits.map(deposit => ({
                    userId: user.id,
                    coin,
                    txId: deposit.txid,
                    amount: deposit.amount,
                    type: 'deposit',
                    status: 'completed'
                }))
            });

            await prisma.wallet.update({
                where: { id: user.wallets[0].id },
                data: { balance: { increment: newDeposits.reduce((sum, tx) => sum + tx.amount, 0) } }
            });
        }

        return newDeposits;
    } catch (error: any) {
        console.error(`Error checking deposits for ${coin}:`, {
            message: error.message,
            stack: error.stack,
            code: error.code,
            response: error.response ? error.response.data : null
        });
        return [];
    }
}

export async function getWalletBalance(
    address: string,
    coin: string,
    userId: string
): Promise<{ confirmed: number; unconfirmed: number }> {
    const CACHE_DURATION = 5 * 60 * 1000;
    const user = await prisma.user.findUnique({
        where: { chatId: userId },
        include: { wallets: { where: { coin } } }
    });
    if (!user || !user.wallets[0]) {
        console.error('User or wallet not found');
        return { confirmed: 0, unconfirmed: 0 };
    }

    const wallet = user.wallets[0];
    const now = new Date();
    if (wallet.lastBalanceUpdate && new Date(wallet.lastBalanceUpdate).getTime() > now.getTime() - CACHE_DURATION) {
        return { confirmed: wallet.balance, unconfirmed: wallet.unconfirmedBalance || 0 };
    }

    try {
        let confirmed: number;
        let unconfirmed: number;
        if (coin === 'USDT') {
            const usdtContractAddress = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';
            const usdtABI = [
                {
                    "constant": true,
                    "inputs": [{ "name": "_owner", "type": "address" }],
                    "name": "balanceOf",
                    "outputs": [{ "name": "balance", "type": "uint256" }],
                    "type": "function"
                }
            ];
            console.log(`Checking USDT balance for address: ${address}`);
            const hexAddress = tronWeb.address.toHex(address);
            console.log(`Converted address to hex: ${hexAddress}`);
            const contract = await tronWeb.contract(usdtABI).at(usdtContractAddress);
            const balance = await contract.balanceOf(hexAddress).call();
            confirmed = Number(balance) / 1e6;
            unconfirmed = 0;
            console.log(`USDT balance for ${address}: ${confirmed}`);
        } else if (coin === 'XMR') {
            if (!wallet.walletPath) {
                throw new Error('Wallet path not found for XMR wallet');
            }
            const config = {
                networkType: MoneroNetworkType.TESTNET,
                server: new MoneroRpcConnection({
                    uri: process.env.MONERO_WALLET_RPC_HOST || 'https://testnet.xmr.ditatompel.com:18083',
                    rejectUnauthorized: false,
                }),
                path: `wallet_${Date.now()}`,
                password: '',
                language: 'English',
                proxyToWorker: false,
                connectionManager: new MoneroConnectionManager(),
            } as unknown as MoneroWalletConfig;

            const walletRpc = new MoneroWalletRpc(config);
            await walletRpc.openWallet(config);
            await walletRpc.startSyncing();

            const unlockedBalance = await walletRpc.getUnlockedBalance();
            const totalBalance = await walletRpc.getBalance();
            confirmed = Number(unlockedBalance) / 1e12;
            unconfirmed = (Number(totalBalance) - Number(unlockedBalance)) / 1e12;

            await walletRpc.close();
        } else {
            const chain = coin === 'BTC' ? 'btc/test3' : 'ltc/testnet';
            let response;
            try {
                response = await blockcypherApi.get(`/${chain}/addrs/${address}/balance`);
                confirmed = response.data.final_balance / 1e8;
                unconfirmed = response.data.unconfirmed_balance / 1e8;
            } catch (error: any) {
                if (error.response && error.response.status === 404) {
                    console.warn(`No transactions found for ${coin} address ${address}`);
                    confirmed = 0;
                    unconfirmed = 0;
                } else {
                    throw error;
                }
            }
        }

        await prisma.wallet.update({
            where: { id: wallet.id },
            data: { balance: confirmed, unconfirmedBalance: unconfirmed, lastBalanceUpdate: now }
        });

        return { confirmed, unconfirmed };
    } catch (error: any) {
        console.error(`Error fetching balance for ${coin}:`, {
            message: error.message,
            stack: error.stack,
            code: error.code,
            response: error.response ? error.response.data : null
        });
        return { confirmed: wallet.balance, unconfirmed: wallet.unconfirmedBalance || 0 };
    }
}

export async function sendP2PTransaction(
    coin: string,
    amount: number,
    senderId: string,
    recipientId: string
): Promise<string | undefined> {
    try {
        const [sender, recipient] = await Promise.all([
            prisma.user.findUnique({
                where: { chatId: senderId },
                include: { wallets: { where: { coin } } }
            }),
            prisma.user.findUnique({
                where: { chatId: recipientId },
                include: { wallets: { where: { coin } } }
            })
        ]);

        if (!sender || !recipient || !sender.wallets[0] || !recipient.wallets[0]) {
            console.error('Sender or recipient wallet not found');
            return undefined;
        }

        const { confirmed } = await getWalletBalance(sender.wallets[0].address, coin, senderId);
        if (confirmed < amount) {
            console.error('Insufficient confirmed funds in sender wallet');
            return undefined;
        }

        return executeTransaction(coin, amount, sender.wallets[0], recipient.wallets[0].address);
    } catch (error) {
        console.error('P2P transaction error:', error);
        return undefined;
    }
}

export async function withdrawToExternalWallet(
    coin: string,
    amount: number,
    senderId: string,
    externalAddress: string
): Promise<string | undefined> {
    try {
        const sender = await prisma.user.findUnique({
            where: { chatId: senderId },
            include: { wallets: { where: { coin } } }
        });
        if (!sender || !sender.wallets[0]) {
            console.error('Sender wallet not found');
            return undefined;
        }

        const { confirmed } = await getWalletBalance(sender.wallets[0].address, coin, senderId);
        if (confirmed < amount) {
            console.error('Insufficient confirmed funds in sender wallet');
            return undefined;
        }

        return executeTransaction(coin, amount, sender.wallets[0], externalAddress);
    } catch (error) {
        console.error('Withdrawal error:', error);
        return undefined;
    }
}

async function executeTransaction(
    coin: string,
    amount: number,
    senderWallet: any,
    recipientAddress: string
): Promise<string | undefined> {
    const platformFeePercent = parseFloat(process.env.PLATFORM_FEE_PERCENT || '5') / 100;
    const platformFee = amount * platformFeePercent;
    const recipientAmount = amount - platformFee;
    const platformWallet = process.env[`OWNER_${coin}_WALLET`];

    if (!platformWallet) {
        console.error(`Platform wallet for ${coin} not configured`);
        return undefined;
    }

    if (coin === 'USDT') {
        const privateKey = decrypt(senderWallet.privateKey);
        const usdtContractAddress = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';
        const usdtABI = [
            {
                "constant": false,
                "inputs": [
                    { "name": "_to", "type": "address" },
                    { "name": "_value", "type": "uint256" }
                ],
                "name": "transfer",
                "outputs": [{ "name": "success", "type": "bool" }],
                "type": "function"
            }
        ];
        console.log(`Executing USDT transfer from ${senderWallet.address} to ${recipientAddress}, amount: ${recipientAmount}`);
        try {
            const hexRecipientAddress = tronWeb.address.toHex(recipientAddress);
            const hexPlatformWallet = tronWeb.address.toHex(platformWallet);
            console.log(`Converted recipient address to hex: ${hexRecipientAddress}`);
            console.log(`Converted platform wallet to hex: ${hexPlatformWallet}`);
            const contract = await tronWeb.contract(usdtABI).at(usdtContractAddress);
            const amountWei = recipientAmount * 1e6;
            const tx = await contract.transfer(hexRecipientAddress, amountWei).send({
                from: senderWallet.address,
                privateKey,
            });

            if (platformFee > 0) {
                const feeWei = platformFee * 1e6;
                console.log(`Sending platform fee ${platformFee} USDT to ${platformWallet}`);
                await contract.transfer(hexPlatformWallet, feeWei).send({
                    from: senderWallet.address,
                    privateKey,
                });
            }

            await prisma.wallet.update({
                where: { id: senderWallet.id },
                data: { balance: { decrement: amount } }
            });

            console.log(`USDT transaction successful, txid: ${tx}`);
            return tx;
        } catch (error: any) {
            console.error(`Error executing USDT transaction:`, {
                message: error.message,
                stack: error.stack,
                code: error.code,
                response: error.response ? error.response.data : null
            });
            throw error;
        }
    } else if (coin === 'XMR') {
        if (!senderWallet.walletPath) {
            throw new Error('Wallet path not found for XMR wallet');
        }

        const config = {
            networkType: MoneroNetworkType.TESTNET,
            server: new MoneroRpcConnection({
                uri: process.env.MONERO_WALLET_RPC_HOST || 'https://testnet.xmr.ditatompel.com:18083',
                rejectUnauthorized: false,
            }),
            path: `wallet_${Date.now()}`,
            password: '',
            language: 'English',
            proxyToWorker: false,
            connectionManager: new MoneroConnectionManager(),
        } as unknown as MoneroWalletConfig;

        const walletRpc = new MoneroWalletRpc(config);
        try {
            await walletRpc.openWallet(config);
            await walletRpc.startSyncing();

            const destinations = [
                { address: recipientAddress, amount: BigInt(Math.round(recipientAmount * 1e12)) },
            ];
            if (platformFee > 0) {
                destinations.push({ address: platformWallet, amount: BigInt(Math.round(platformFee * 1e12)) });
            }

            const tx = await walletRpc.createTx({
                accountIndex: 0,
                destinations,
                relay: true,
                priority: 1,
            });

            await prisma.wallet.update({
                where: { id: senderWallet.id },
                data: { balance: { decrement: amount } }
            });

            return tx.getHash();
        } finally {
            await walletRpc.close();
        }
    } else {
        const network = coin === 'BTC' ? bitcoin.networks.testnet : litecoinNetwork;
        const privateKey = decrypt(senderWallet.privateKey);
        const fromAddress = senderWallet.address;
        const keyPair = ECPair.fromWIF(privateKey, network);

        const chain = coin === 'BTC' ? 'btc/test3' : 'ltc/testnet';
        const utxoResponse = await blockcypherApi.get(`/${chain}/addrs/${fromAddress}?unspentOnly=true`);
        const utxos = utxoResponse.data.txrefs || [];

        if (utxos.length === 0) {
            console.error('No UTXOs available');
            return undefined;
        }

        utxos.sort((a: any, b: any) => b.value - a.value);

        let selectedUtxos: any[] = [];
        let totalInputSat = 0;
        const totalOutputSat = Math.round(amount * 1e8);

        for (const utxo of utxos) {
            selectedUtxos.push(utxo);
            totalInputSat += utxo.value;
            if (totalInputSat >= totalOutputSat) break;
        }

        if (totalInputSat < totalOutputSat) {
            console.error('Insufficient funds');
            return undefined;
        }

        const outputs = [
            { address: recipientAddress, value: Math.round(recipientAmount * 1e8) },
            { address: platformWallet, value: Math.round(platformFee * 1e8) }
        ];

        const estimatedSize = estimateTransactionSize(coin, selectedUtxos.length, outputs);
        const feeRate = await getFeeRate(coin, process.env.MINER_FEE || 'medium');
        const minerFee = Math.ceil(estimatedSize * feeRate);

        if (totalInputSat < totalOutputSat + minerFee) {
            console.error('Insufficient funds including fee');
            return undefined;
        }

        const change = totalInputSat - totalOutputSat - minerFee;

        const psbt = new bitcoin.Psbt({ network });

        for (const utxo of selectedUtxos) {
            const rawTx = await blockcypherApi.get(`/${chain}/txs/${utxo.tx_hash}?includeHex=true`);
            const tx = bitcoin.Transaction.fromHex(rawTx.data.hex);
            psbt.addInput({
                hash: utxo.tx_hash,
                index: utxo.tx_output_n,
                witnessUtxo: { script: tx.outs[utxo.tx_output_n].script, value: utxo.value },
            });
        }

        psbt.addOutput({ address: recipientAddress, value: Math.round(recipientAmount * 1e8) });
        if (platformFee > 0) {
            psbt.addOutput({ address: platformWallet, value: Math.round(platformFee * 1e8) });
        }
        if (change > 0) {
            psbt.addOutput({ address: fromAddress, value: change });
        }

        for (let i = 0; i < psbt.inputCount; i++) {
            psbt.signInput(i, {
                publicKey: Buffer.from(keyPair.publicKey),
                sign: (hash: Buffer) => Buffer.from(keyPair.sign(hash)),
            });
        }

        psbt.finalizeAllInputs();
        const tx = psbt.extractTransaction();
        const sendResponse = await blockcypherApi.post(`/${chain}/txs/push`, { tx: tx.toHex() });

        await prisma.wallet.update({
            where: { id: senderWallet.id },
            data: { balance: { decrement: amount } }
        });

        return sendResponse.data.tx.hash;
    }
}

export async function getFeeRate(coin: string, feeLevel: string): Promise<number> {
    if (coin === 'XMR') {
        return 0.0001;
    }
    try {
        const chain = coin === 'BTC' ? 'btc/test3' : 'ltc/testnet';
        const response = await blockcypherApi.get(`/${chain}`);
        return response.data[feeLevel + '_fee_per_kb'] / 1000;
    } catch (error) {
        console.error('Error getting fee rate, using default', error);
        return 50;
    }
}

export function estimateTransactionSize(
    coin: string,
    inputsCount: number,
    outputs: ({ address: string; value: number })[]
): number {
    if (coin === 'XMR') {
        return 2000; // Approximate size for Monero transaction
    } else if (coin === 'USDT') {
        return 200; // Approximate size for TRC20
    } else {
        const baseSize = 10;
        const inputSize = 68;
        const outputSize = 31;
        const witnessOverhead = 2;

        const outputsCount = outputs.length;
        let totalSize = baseSize + (inputsCount * inputSize) + (outputsCount * outputSize);
        totalSize += inputsCount * witnessOverhead;

        return Math.ceil(totalSize);
    }
}