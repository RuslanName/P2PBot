import * as bitcoin from 'bitcoinjs-lib';
import { TronWeb } from 'tronweb';
import { ECPairFactory } from 'ecpair';
import * as ecc from 'tiny-secp256k1';
import { config } from '../config/env';

const ECPair = ECPairFactory(ecc);

const litecoinNetwork = {
    messagePrefix: '\x19Litecoin Signed Message:\n',
    bech32: 'tltc',
    bip32: { public: 0x0436ef7d, private: 0x0436ef7d },
    pubKeyHash: 0x6f,
    scriptHash: 0x3a,
    wif: 0xef,
};

const tronWeb = new TronWeb({
    fullHost: 'https://api.shasta.trongrid.io',
    headers: { 'TRON-PRO-API-KEY': config.TRONGRID_API_KEY || '' },
});

export function generateBTCWallet() {
    const network = bitcoin.networks.testnet;
    const keyPair = ECPair.makeRandom({ network });
    const pubkeyBuffer = Buffer.from(keyPair.publicKey);
    const { address } = bitcoin.payments.p2wpkh({ pubkey: pubkeyBuffer, network });
    return { address: address!, privateKey: keyPair.toWIF() };
}

export function generateLTCWallet() {
    const keyPair = ECPair.makeRandom({ network: litecoinNetwork });
    const pubkeyBuffer = Buffer.from(keyPair.publicKey);
    const { address } = bitcoin.payments.p2wpkh({ pubkey: pubkeyBuffer, network: litecoinNetwork });
    return { address: address!, privateKey: keyPair.toWIF() };
}

export async function generateUSDTWallet() {
    const wallet = await tronWeb.createAccount();
    return { address: wallet.address.base58, privateKey: wallet.privateKey };
}