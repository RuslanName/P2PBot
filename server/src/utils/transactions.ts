import { Offer } from '@prisma/client';
import { getCryptoPrice } from '../api/api';
import { getFeeRate } from '../wallet/fees';
import { config } from '../config/env';

const TX_WEIGHT = 150;
const DEFAULT_FEE_RATE = 50;

export async function calculateUserTransaction(
    type: 'buy' | 'sell',
    amount: number,
    offer: Offer,
): Promise<{ totalAmount: number; currency: string }> {
    let feeRate = DEFAULT_FEE_RATE;
    if (offer.coin !== 'XMR') {
        try {
            feeRate = await getFeeRate(offer.coin, config.MINER_FEE);
        } catch (error) {
            console.error('Error getting fee rate, using default:', error);
        }
    }

    const minerFee = offer.coin === 'XMR' ? 0.0001 : feeRate * TX_WEIGHT / 1e8;

    if (type === 'buy') {
        try {
            const totalAmount = amount * (1 + offer.markupPercent / 100);
            const rubAmount = await getCryptoPrice(offer.coin, totalAmount);
            return {
                totalAmount: rubAmount,
                currency: 'RUB'
            };
        } catch (error) {
            console.error('Error calculating buy transaction:', error);
            return {
                totalAmount: 0,
                currency: 'RUB'
            };
        }
    } else {
        const totalAmount = amount * (1 + offer.markupPercent / 100) + minerFee;
        return {
            totalAmount: parseFloat(totalAmount.toFixed(8)),
            currency: offer.coin
        };
    }
}

export async function calculateOrderTransaction(
    type: 'buy' | 'sell',
    offer: Offer
): Promise<{ totalAmount: number; currency: string }> {
    let feeRate = DEFAULT_FEE_RATE;
    try {
        feeRate = await getFeeRate(offer.coin, config.MINER_FEE);
    } catch (error) {
        console.error('Error getting fee rate, using default:', error);
    }

    const minerFee = feeRate * TX_WEIGHT / 1e8;
    const platformFeePercent = type === 'buy'
        ? config.PLATFORM_BUY_FEE_PERCENT / 100
        : config.PLATFORM_SELL_FEE_PERCENT / 100;

    const platformFee = offer.amount * platformFeePercent;

    if (type === 'buy') {
        const totalAmount = offer.amount + platformFee + minerFee;
        return {
            totalAmount: parseFloat(totalAmount.toFixed(8)),
            currency: offer.coin
        };
    } else {
        try {
            const totalAmount = offer.amount + platformFee;
            const rubAmount = await getCryptoPrice(offer.coin, totalAmount);
            return {
                totalAmount: rubAmount,
                currency: 'RUB'
            };
        } catch (error) {
            console.error('Error calculating sell order transaction:', error);
            return {
                totalAmount: 0,
                currency: 'RUB'
            };
        }
    }
}

export function calculateWithdrawal(amount: number): number {
    try {
        const platformFee = amount * (config.PLATFORM_WITHDRAW_FEE_PERCENT / 100);
        return parseFloat((amount - platformFee).toFixed(8));
    } catch (error) {
        console.error('Error calculating withdrawal:', error);
        return amount;
    }
}