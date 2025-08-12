import * as bitcoin from 'bitcoinjs-lib';
import { TronWeb } from 'tronweb';
import { ECPairFactory } from 'ecpair';
import * as ecc from 'tiny-secp256k1';
import { config } from '../config/env';

const ECPair = ECPairFactory(ecc);

const litecoinNetwork = {
    messagePrefix: '\x19Litecoin Signed Message:\n',
    bech32: 'ltc',
    bip32: { public: 0x0488b21e, private: 0x0488ade4 },
    pubKeyHash: 0x30,
    scriptHash: 0x32,
    wif: 0xb0,
};

const tronWeb = new TronWeb({
    fullHost: config.NETWORK === 'main' ? 'https://api.trongrid.io' : 'https://api.shasta.trongrid.io',
    headers: { 'TRON-PRO-API-KEY': config.TRONGRID_API_KEY },
});

export function generateBTCWallet() {
    const network = config.NETWORK === 'main' ? bitcoin.networks.bitcoin : bitcoin.networks.testnet;
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
    return {
        address: wallet.address.base58,
        privateKey: wallet.privateKey
    };
}