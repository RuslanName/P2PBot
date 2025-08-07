import {getCryptoPrice} from '../api/api';
import {getFeeRate} from './calculateMinerFee';
import {config} from '../config/env';

const TX_WEIGHT = 150;
const DEFAULT_FEE_RATE = 50;

export async function calculateClientTransaction(
    type: string,
    coin: string,
    fiatCurrency: string,
    amount: number,
    markupPercent: number
): Promise<number> {
    let feeRate = DEFAULT_FEE_RATE;
    if (coin !== 'XMR') {
        try {
            feeRate = await getFeeRate(coin, config.MINER_FEE);
        } catch (error) {
            console.error('Error getting fee rate, using default:', error);
        }
    }

    const minerFee = coin === 'XMR' ? 0.0001 : feeRate * TX_WEIGHT / 1e8;

    if (type === 'buy') {
        try {
            const totalAmount = amount * (1 + markupPercent / 100);
            const fiatAmount = await getCryptoPrice(coin, totalAmount, fiatCurrency);
            return parseFloat(fiatAmount.toFixed(2));
        } catch (error) {
            console.error('Error calculating buy transaction:', error);
            return 0;
        }
    } else {
        const totalAmount = amount * (1 - markupPercent / 100) - minerFee;
        const fiatAmount = await getCryptoPrice(coin, totalAmount, fiatCurrency);
        return parseFloat(fiatAmount.toFixed(2));
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
    return platformFee * referralPercent;
}