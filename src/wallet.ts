import * as bitcoin from 'bitcoinjs-lib';
import { ethers } from 'ethers';
import { ECPairFactory } from 'ecpair';
import * as ecc from 'tiny-secp256k1';
import axios from 'axios';
import { Wallet } from './types';
import * as dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import {decrypt} from "./crypto";

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

export function generateUSDTWallet(): Wallet {
    const wallet = ethers.Wallet.createRandom();
    return { address: wallet.address, privateKey: wallet.privateKey };
}

export async function checkDeposits(
    address: string,
    coin: string,
    userId: string
): Promise<{ txid: string; amount: number }[]> {
    try {
        let deposits: { txid: string; amount: number }[];

        if (coin === 'USDT') {
            const provider = new ethers.JsonRpcProvider(`https://sepolia.infura.io/v3/${process.env.INFURA_API_KEY}`);
            const usdtContractAddress = '0xaA8E23Fb1079EA71e0a56F48a2aA51851D8433D0';
            const abi = ['event Transfer(address indexed from, address indexed to, uint256 value)'];
            const contract = new ethers.Contract(usdtContractAddress, abi, provider);
            const filter = contract.filters.Transfer(null, address);
            const events = await contract.queryFilter(filter, -1000);

            deposits = events.map(event => {
                const e = event as ethers.EventLog;
                if (e.args) {
                    return {
                        txid: e.transactionHash,
                        amount: Number(ethers.formatUnits(e.args.value, 6)),
                    };
                }
                return { txid: e.transactionHash, amount: 0 };
            }).filter(tx => tx.amount > 0);
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

        const existingTxIds = (await prisma.transaction.findMany({
            where: {
                userId,
                coin,
                type: 'deposit'
            },
            select: { txId: true }
        })).map(tx => tx.txId);

        const newDeposits = deposits.filter(deposit =>
            !existingTxIds.includes(deposit.txid));

        if (newDeposits.length > 0) {
            await prisma.transaction.createMany({
                data: newDeposits.map(deposit => ({
                    userId,
                    coin,
                    txId: deposit.txid,
                    amount: deposit.amount,
                    type: 'deposit',
                    status: 'completed'
                }))
            });
        }

        return newDeposits;
    } catch (error: any) {
        console.error(`Error checking deposits for ${coin}:`, error);
        return [];
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
            prisma.user.findUnique({ where: { userId: senderId } }),
            prisma.user.findUnique({ where: { userId: recipientId } })
        ]);

        if (!sender || !recipient) {
            console.error('Sender or recipient not found');
            return undefined;
        }

        let recipientAddress: string;
        switch (coin) {
            case 'BTC': recipientAddress = recipient.btcAddress; break;
            case 'LTC': recipientAddress = recipient.ltcAddress; break;
            case 'USDT': recipientAddress = recipient.usdtAddress; break;
            default: return undefined;
        }

        return executeTransaction(coin, amount, sender, recipientAddress);
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
        const sender = await prisma.user.findUnique({ where: { userId: senderId } });
        if (!sender) {
            console.error('Sender not found');
            return undefined;
        }

        return executeTransaction(coin, amount, sender, externalAddress);
    } catch (error) {
        console.error('Withdrawal error:', error);
        return undefined;
    }
}

async function executeTransaction(
    coin: string,
    amount: number,
    sender: any,
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
        const provider = new ethers.JsonRpcProvider(`https://sepolia.infura.io/v3/${process.env.INFURA_API_KEY}`);
        const privateKey = decrypt(sender.usdtPrivateKey);
        const wallet = new ethers.Wallet(privateKey, provider);
        const usdtContractAddress = '0xaA8E23Fb1079EA71e0a56F48a2aA51851D8433D0';
        const abi = ['function transfer(address to, uint256 amount) returns (bool)'];
        const contract = new ethers.Contract(usdtContractAddress, abi, wallet);

        const amountWei = ethers.parseUnits(recipientAmount.toString(), 6);
        const tx = await contract.transfer(recipientAddress, amountWei, { gasLimit: 100000 });
        await tx.wait();

        if (platformFee > 0) {
            const feeWei = ethers.parseUnits(platformFee.toString(), 6);
            const feeTx = await contract.transfer(platformWallet, feeWei, { gasLimit: 100000 });
            await feeTx.wait();
        }

        return tx.hash;
    } else {
        const network = coin === 'BTC' ? bitcoin.networks.testnet : litecoinNetwork;
        const privateKey = coin === 'BTC' ? decrypt(sender.btcPrivateKey) : decrypt(sender.ltcPrivateKey);
        const fromAddress = coin === 'BTC' ? sender.btcAddress : sender.ltcAddress;
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
        return sendResponse.data.tx.hash;
    }
}

export async function getFeeRate(coin: string, feeLevel: string): Promise<number> {
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
    outputs: ({ address: string; value: number } | { address: string; value: number })[]
): number {
    if (coin === 'USDT') {
        return 200;
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