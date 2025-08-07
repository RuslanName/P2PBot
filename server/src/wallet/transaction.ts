import * as bitcoin from 'bitcoinjs-lib';
import { TronWeb } from 'tronweb';
import { ECPairFactory } from 'ecpair';
import * as ecc from 'tiny-secp256k1';
import axios from 'axios';
import { config } from '../config/env';
import { PrismaClient } from '@prisma/client';
import { decrypt } from '../utils/cryptoEncrypted';
import { getFeeRate, estimateTransactionSize } from '../utils/calculateMinerFee';
import { getWalletBalance } from './balance';

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
    params: { token: config.BLOCKCYPHER_API_KEY },
});

const tronWeb = new TronWeb({
    fullHost: 'https://api.shasta.trongrid.io',
    headers: { 'TRON-PRO-API-KEY': config.TRONGRID_API_KEY || '' },
});

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

        const feePercent = offerType === 'buy'
            ? config.PLATFORM_BUY_FEE_PERCENT
            : config.PLATFORM_SELL_FEE_PERCENT;
        const platformFeePercent = feePercent / 100;
        const platformFee = amount * platformFeePercent;
        const referralPercent = config.REFERRAL_REVENUE_PERCENT / 100;
        const referralFee = platformFee * referralPercent;
        const totalAmount = amount + platformFee;

        const { confirmed, unconfirmed, held } = await getWalletBalance(senderId, coin);
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

        const platformFeePercent = config.PLATFORM_WITHDRAW_FEE_PERCENT / 100;
        const platformFee = amount * platformFeePercent;
        const referralPercent = config.REFERRAL_REVENUE_PERCENT / 100;
        const referralFee = platformFee * referralPercent;
        const totalAmount = amount + platformFee;

        const { confirmed, unconfirmed, held } = await getWalletBalance(senderId, coin);
        if (confirmed - unconfirmed - held < totalAmount) {
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

        try {
            const hexRecipientAddress = tronWeb.address.toHex(recipientAddress);
            const hexPlatformWallet = tronWeb.address.toHex(platformWallet);
            const contract = await tronWeb.contract(usdtABI).at(usdtContractAddress);
            const amountWei = amount * 1e6;
            const tx = await contract.transfer(hexRecipientAddress, amountWei).send({
                from: senderWallet.address,
                privateKey,
            });

            if (platformFee > 0) {
                const feeWei = platformFee * 1e6;
                await contract.transfer(hexPlatformWallet, feeWei).send({
                    from: senderWallet.address,
                    privateKey,
                });
            }

            if (referralFee > 0 && referrerAddress) {
                const referralFeeWei = referralFee * 1e6;
                const hexReferrerAddress = tronWeb.address.toHex(referrerAddress);
                await contract.transfer(hexReferrerAddress, referralFeeWei).send({
                    from: senderWallet.address,
                    privateKey,
                });
            }

            await prisma.wallet.update({
                where: { id: senderWallet.id },
                data: { balance: { decrement: amount + platformFee + referralFee } }
            });

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
        const totalOutputSat = Math.round((amount + platformFee + referralFee) * 1e8);

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
            { address: recipientAddress, value: Math.round(amount * 1e8) },
            { address: platformWallet, value: Math.round(platformFee * 1e8) }
        ];

        if (referralFee > 0 && referrerAddress) {
            outputs.push({ address: referrerAddress, value: Math.round(referralFee * 1e8) });
        }

        const estimatedSize = estimateTransactionSize(coin, selectedUtxos.length, outputs);
        const feeRate = await getFeeRate(coin, config.MINER_FEE);
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

        await prisma.wallet.update({
            where: { id: senderWallet.id },
            data: { balance: { decrement: amount + platformFee + referralFee } }
        });

        return sendResponse.data.tx.hash;
    }
}