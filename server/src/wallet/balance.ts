import axios from 'axios';
import { PrismaClient } from '@prisma/client';
import { Wallet } from '../types';
import { config } from '../config/env';
import { TronWeb } from 'tronweb';

const prisma = new PrismaClient();

const blockcypherApi = axios.create({
    baseURL: 'https://api.blockcypher.com/v1',
    params: { token: config.BLOCKCYPHER_API_KEY },
});

const tronWeb = new TronWeb({
    fullHost: 'https://api.shasta.trongrid.io',
    headers: { 'TRON-PRO-API-KEY': config.TRONGRID_API_KEY || '' },
});

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