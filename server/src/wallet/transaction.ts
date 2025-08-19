import { config } from '../config/env';
import { TronWeb } from 'tronweb';
import axios from 'axios';
import * as bitcoin from 'bitcoinjs-lib';
import { ECPairFactory } from 'ecpair';
import * as ecc from 'tiny-secp256k1';
import { PrismaClient } from '@prisma/client';
import { decrypt } from '../utils/cryptoEncrypted';
import { getCryptoPrice } from '../utils/cryptoPrice';
import { getWalletBalance } from './balance';
import {estimateNetworkFee} from "../utils/calculateTransaction";

const prisma = new PrismaClient();
const ECPair = ECPairFactory(ecc);

const litecoinNetwork = {
    messagePrefix: '\x19Litecoin Signed Message:\n',
    bech32: 'ltc',
    bip32: { public: 0x0488b21e, private: 0x0488ade4 },
    pubKeyHash: 0x30,
    scriptHash: 0x32,
    wif: 0xb0,
};

const blockcypherApi = axios.create({
    baseURL: `https://api.blockcypher.com/v1`,
    params: { token: config.BLOCKCYPHER_API_KEY },
});

const tronWeb = new TronWeb({
    fullHost: config.NETWORK === 'main' ? 'https://api.trongrid.io' : 'https://api.shasta.trongrid.io',
    headers: { 'TRON-PRO-API-KEY': config.TRONGRID_API_KEY },
    privateKey: config.OWNER_TRX_PRIVATE_KEY
});

const trc20ABI = [
    {
        "constant": true,
        "inputs": [{ "name": "owner", "type": "address" }],
        "name": "balanceOf",
        "outputs": [{ "name": "", "type": "uint256" }],
        "type": "function"
    },
    {
        "constant": false,
        "inputs": [
            { "name": "_to", "type": "address" },
            { "name": "_value", "type": "uint256" }
        ],
        "name": "transfer",
        "outputs": [{ "name": "", "type": "bool" }],
        "type": "function"
    }
];

export async function sendP2PTransaction(
    amount: number,
    coin: string,
    senderId: number,
    recipientAddress: string,
    offerType: 'buy' | 'sell'
): Promise<string | undefined> {
    try {
        const sender = await prisma.user.findUnique({
            where: { id: senderId },
            include: {
                wallets: { where: { coin } },
                referrer: { include: { wallets: { where: { coin } } } }
            }
        });

        if (!sender || !sender.wallets[0]) {
            console.error('Sender wallet not found');
            return undefined;
        }

        const platformCommissionPercent = offerType === 'buy'
            ? config.PLATFORM_BUY_COMMISSION_PERCENT
            : config.PLATFORM_SELL_COMMISSION_PERCENT;
        const platformFee = amount * (platformCommissionPercent / 100);
        const referralPercent = config.REFERRAL_REVENUE_PERCENT / 100;
        const referralFee = platformFee * referralPercent;
        const totalAmount = amount + platformFee;

        const { confirmed, unconfirmed, held } = await getWalletBalance(senderId, coin, true);
        if (confirmed - unconfirmed - held < totalAmount) {
            console.error('Insufficient confirmed funds in sender wallet');
            return undefined;
        }

        return executeTransaction(coin, amount, sender.wallets[0], recipientAddress, platformFee, referralFee, sender.referrer?.wallets[0]?.address);
    } catch (error) {
        console.error('P2P transaction error:', error);
        return undefined;
    }
}

export async function withdrawToExternalWallet(
    amount: number,
    coin: string,
    senderId: number,
    externalAddress: string
): Promise<string | undefined> {
    try {
        const sender = await prisma.user.findUnique({
            where: { id: senderId },
            include: {
                wallets: { where: { coin } },
                referrer: { include: { wallets: { where: { coin } } } }
            }
        });
        if (!sender || !sender.wallets[0]) {
            console.error('Sender wallet not found');
            return undefined;
        }

        const platformFee = amount * (config.PLATFORM_WITHDRAW_COMMISSION_PERCENT / 100);
        const referralPercent = config.REFERRAL_REVENUE_PERCENT / 100;
        const referralFee = platformFee * referralPercent;
        const totalAmount = amount + platformFee;

        const { confirmed, unconfirmed, held } = await getWalletBalance(senderId, coin, true);
        if (confirmed - unconfirmed - held + amount < totalAmount) {
            console.error('Insufficient confirmed funds in sender wallet');
            return undefined;
        }

        return executeTransaction(coin, amount, sender.wallets[0], externalAddress, platformFee, referralFee, sender.referrer?.wallets[0]?.address);
    } catch (error) {
        console.error('Withdrawal error:', error);
        return undefined;
    }
}

async function executeTransaction(
    coin: string,
    amount: number,
    senderWallet: any,
    recipientAddress: string,
    platformFee: number,
    referralFee: number,
    referrerAddress?: string
): Promise<string | undefined> {
    const platformWallet = config[`OWNER_${coin}_WALLET`];
    if (!platformWallet) {
        console.error(`Platform wallet for ${coin} not configured`);
        return undefined;
    }

    if (coin === 'USDT') {
        const fromAddress = senderWallet.address;
        const privateKey = decrypt(senderWallet.privateKey);
        tronWeb.setPrivateKey(privateKey);

        const requiredTrx = await estimateNetworkFee(coin, config.MINER_COMMISSION_LEVEL, 1, [{ address: recipientAddress, value: amount }]);
        const trxBalance = await tronWeb.trx.getBalance(fromAddress) / 1e6;
        const platformTrxWallet = config.OWNER_TRX_WALLET;
        const platformTrxPrivateKey = config.OWNER_TRX_PRIVATE_KEY;

        if (trxBalance < requiredTrx) {
            const trxToSend = requiredTrx - trxBalance;
            const usdtPrice = await getCryptoPrice('USDT', 1, 'USD');
            const usdtEquivalent = (trxToSend * (await getCryptoPrice('TRX', 1, 'USD'))) / usdtPrice;

            const usdtContractAddress = config.NETWORK === 'main'
                ? 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t'
                : 'TG3XXyExBkPp9nzdajDZsozEu4BkaSJozs';
            const contract = await tronWeb.contract(trc20ABI).at(usdtContractAddress);
            const usdtBalance = Number(await contract.balanceOf(fromAddress).call()) / 1e6;
            if (usdtBalance < usdtEquivalent + amount + platformFee + referralFee) {
                console.error('Insufficient USDT balance for TRX top-up and transaction');
                return undefined;
            }

            tronWeb.setPrivateKey(platformTrxPrivateKey);
            const transaction = await tronWeb.transactionBuilder.sendTrx(fromAddress, trxToSend * 1e6, platformTrxWallet);
            const signedTx = await tronWeb.trx.sign(transaction, platformTrxPrivateKey);
            await tronWeb.trx.sendRawTransaction(signedTx);

            tronWeb.setPrivateKey(privateKey);
            await contract.transfer(platformWallet, usdtEquivalent * 1e6).send({ from: fromAddress, feeLimit: 10000000 });
        }

        const usdtContractAddress = config.NETWORK === 'main'
            ? 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t'
            : 'TG3XXyExBkPp9nzdajDZsozEu4BkaSJozs';
        const contract = await tronWeb.contract(trc20ABI).at(usdtContractAddress);
        const decimals = 1e6;
        const formattedAmount = amount * decimals;

        const outputs = [
            { address: recipientAddress, value: formattedAmount },
            { address: platformWallet, value: Math.round((platformFee - referralFee) * decimals) }
        ];
        if (referralFee > 0 && referrerAddress) {
            outputs.push({ address: referrerAddress, value: Math.round(referralFee * decimals) });
        }

        const result = await contract.transfer(recipientAddress, formattedAmount).send({ from: fromAddress, feeLimit: 10000000 });

        if (platformFee > 0) {
            await contract.transfer(platformWallet, Math.round((platformFee - referralFee) * decimals)).send({ from: fromAddress, feeLimit: 10000000 });
        }
        if (referralFee > 0 && referrerAddress) {
            await contract.transfer(referrerAddress, Math.round(referralFee * decimals)).send({ from: fromAddress, feeLimit: 10000000 });
        }

        return result;
    } else {
        const network = coin === 'BTC' ? (config.NETWORK === 'main' ? bitcoin.networks.bitcoin : bitcoin.networks.testnet) : litecoinNetwork;
        const privateKey = decrypt(senderWallet.privateKey);
        const fromAddress = senderWallet.address;
        const keyPair = ECPair.fromWIF(privateKey, network);

        const chain = coin === 'BTC' ? (config.NETWORK === 'main' ? 'btc/main' : 'btc/test3') : 'ltc/main';
        const utxoResponse = await blockcypherApi.get(`/${chain}/addrs/${fromAddress}?unspentOnly=true`);
        const utxos = utxoResponse.data.txrefs || [];

        if (utxos.length === 0) {
            console.error('No UTXOs available');
            return undefined;
        }

        utxos.sort((a: any, b: any) => b.value - a.value);

        let selectedUtxos: any[] = [];
        let totalInputSat = 0;

        const outputs = [
            { address: recipientAddress, value: Math.round(amount * 1e8) },
            { address: platformWallet, value: Math.round((platformFee - referralFee) * 1e8) }
        ];

        if (referralFee > 0 && referrerAddress) {
            outputs.push({ address: referrerAddress, value: Math.round(referralFee * 1e8) });
        }

        const feeRate = await estimateNetworkFee(coin, config.MINER_COMMISSION_LEVEL, selectedUtxos.length, outputs);
        const totalOutputSat = Math.round((amount + platformFee) * 1e8);

        for (const utxo of utxos) {
            selectedUtxos.push(utxo);
            totalInputSat += utxo.value;
            if (totalInputSat >= totalOutputSat) break;
        }

        if (totalInputSat < totalOutputSat) {
            console.error('Insufficient funds');
            return undefined;
        }

        const change = totalInputSat - totalOutputSat - Math.ceil(feeRate * 1e8);

        if (totalInputSat < totalOutputSat + Math.ceil(feeRate * 1e8)) {
            console.error('Insufficient funds including fee');
            return undefined;
        }

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

        psbt.addOutput({ address: recipientAddress, value: Math.round(amount * 1e8) });
        if (platformFee > 0) {
            psbt.addOutput({ address: platformWallet, value: Math.round(platformFee * 1e8) });
        }
        if (referralFee > 0 && referrerAddress) {
            psbt.addOutput({ address: referrerAddress, value: Math.round(referralFee * 1e8) });
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