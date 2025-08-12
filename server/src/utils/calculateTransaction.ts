import axios from 'axios';
import { config } from '../config/env';
import { getCryptoPrice } from './cryptoPrice';

const blockcypherApi = axios.create({
    baseURL: `https://api.blockcypher.com/v1`,
    params: { token: config.BLOCKCYPHER_API_KEY },
});

const trongridApi = axios.create({
    baseURL: config.NETWORK === 'main' ? 'https://api.trongrid.io' : 'https://api.shasta.trongrid.io',
    headers: { 'TRON-PRO-API-KEY': config.TRONGRID_API_KEY },
});

export async function estimateNetworkFee(
    coin: string,
    feeLevel: string,
    inputsCount: number,
    outputs: ({ address: string; value: number })[]
): Promise<number> {
    if (coin === 'USDT') {
        try {
            const response = await trongridApi.get(`/v1/transactions/estimatefee`);
            return response.data.fee / 1e6;
        } catch (error) {
            console.error('Error getting TRX fee, using default', error);
            return 10;
        }
    } else {
        try {
            const chain = coin === 'BTC' ? (config.NETWORK === 'main' ? 'btc/main' : 'btc/test3') : 'ltc/main';
            const response = await blockcypherApi.get(`/${chain}`);
            const feeRate = response.data[feeLevel + '_fee_per_kb'] / 1000;

            const baseSize = 10;
            const inputSize = 68;
            const outputSize = 31;
            const witnessOverhead = 2;

            const outputsCount = outputs.length;
            let totalSize = baseSize + (inputsCount * inputSize) + (outputsCount * outputSize);
            totalSize += inputsCount * witnessOverhead;

            return Math.ceil(feeRate * totalSize) / 1e8;
        } catch (error) {
            console.error('Error calculating fee, using default', error);
            return 0.00005;
        }
    }
}

export async function calculateClientTransaction(
    type: string,
    coin: string,
    fiatCurrency: string,
    amount: number,
    markupPercent: number
): Promise<number> {
    let minerFee = 0;
    let trxFeeEquivalent = 0;

    if (coin === 'USDT') {
        const requiredTrx = await estimateNetworkFee(coin, config.MINER_FEE, 1, [{ address: 'recipient', value: amount }]);
        const trxPrice = await getCryptoPrice('TRX', 1, fiatCurrency);
        const usdtPrice = await getCryptoPrice('USDT', 1, fiatCurrency);
        trxFeeEquivalent = (requiredTrx * trxPrice) / usdtPrice;
    } else {
        const outputs = [{ address: 'recipient', value: amount }];
        minerFee = await estimateNetworkFee(coin, config.MINER_FEE, 1, outputs);
    }

    const platformFeePercent = type === 'buy'
        ? config.PLATFORM_BUY_FEE_PERCENT / 100
        : config.PLATFORM_SELL_FEE_PERCENT / 100;
    const platformFee = amount * platformFeePercent;
    const referralPercent = config.REFERRAL_REVENUE_PERCENT / 100;
    const referralFee = platformFee * referralPercent;

    try {
        if (type === 'buy') {
            const totalAmount = amount * (1 + markupPercent / 100) + minerFee + platformFee + referralFee + trxFeeEquivalent;
            const fiatAmount = await getCryptoPrice(coin, totalAmount, fiatCurrency);
            return parseFloat(fiatAmount.toFixed(2));
        } else {
            const totalAmount = amount * (1 - markupPercent / 100) - minerFee - platformFee - referralFee - trxFeeEquivalent;
            if (totalAmount < 0) {
                console.error('Total amount is negative after fees');
                return 0;
            }
            const fiatAmount = await getCryptoPrice(coin, totalAmount, fiatCurrency);
            return parseFloat(fiatAmount.toFixed(2));
        }
    } catch (error) {
        console.error('Error calculating transaction:', error);
        return 0;
    }
}

export function calculateReferralFee(
    amount: number,
    offerType: 'buy' | 'sell'
): number {
    const platformFeePercent = offerType === 'buy'
        ? config.PLATFORM_BUY_FEE_PERCENT
        : config.PLATFORM_SELL_FEE_PERCENT;
    const platformFee = amount * (platformFeePercent / 100);
    const referralPercent = config.REFERRAL_REVENUE_PERCENT / 100;
    const referralFee = platformFee * referralPercent;
    return parseFloat(referralFee.toFixed(8));
}