import axios from 'axios';
import { config } from '../config/env';

const blockcypherApi = axios.create({
    baseURL: 'https://api.blockcypher.com/v1',
    params: { token: config.BLOCKCYPHER_API_KEY },
});

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
        return 2000;
    } else if (coin === 'USDT') {
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