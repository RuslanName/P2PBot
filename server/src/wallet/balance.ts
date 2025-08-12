import axios from 'axios';
import { PrismaClient } from '@prisma/client';
import { config } from '../config/env';
import { TronWeb } from 'tronweb';

const prisma = new PrismaClient();

const blockcypherApi = axios.create({
    baseURL: `https://api.blockcypher.com/v1`,
    params: { token: config.BLOCKCYPHER_API_KEY },
});

const tronWeb = new TronWeb({
    fullHost: config.NETWORK === 'main' ? 'https://api.trongrid.io' : 'https://api.shasta.trongrid.io',
    headers: { 'TRON-PRO-API-KEY': config.TRONGRID_API_KEY },
});

const trc20ABI = [
    {
        "constant": true,
        "inputs": [{ "name": "owner", "type": "address" }],
        "name": "balanceOf",
        "outputs": [{ "name": "", "type": "uint256" }],
        "type": "function"
    }
];

export async function getWalletBalance(
    userId: number,
    coin: string,
    forceRefresh: boolean = false
): Promise<{ confirmed: number; unconfirmed: number; held: number }> {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
            wallets: { where: { coin } },
            warrantHolder: true
        }
    });

    if (!user) return { confirmed: 0, unconfirmed: 0, held: 0 };

    const wallet = user.wallets[0];
    const address = wallet.address;

    const clientPendingDeals = await prisma.deal.findMany({
        where: {
            userId,
            status: 'pending',
            offer: {
                type: 'sell',
                coin
            }
        },
    });

    let held = clientPendingDeals.reduce((sum, deal) => sum + deal.amount * (1 + deal.markupPercent / 100), 0);

    if (user.warrantHolder) {
        const warrantHolderPendingDeals = await prisma.deal.findMany({
            where: {
                userId,
                status: 'pending',
                offer: {
                    type: 'buy',
                    coin
                }
            },
        });

        held = warrantHolderPendingDeals.reduce((sum, deal) => sum + deal.amount, 0);
    }

    if (!forceRefresh && wallet.lastBalanceUpdate && Date.now() - wallet.lastBalanceUpdate.getTime() < 300_000) {
        return {
            confirmed: wallet.balance,
            unconfirmed: wallet.unconfirmedBalance,
            held
        };
    }

    try {
        let confirmed: number;
        let unconfirmed: number;
        if (coin === 'USDT') {
            const usdtContractAddress = config.NETWORK === 'main'
                ? 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t'
                : 'TG3XXyExBkPp9nzdajDZsozEu4BkaSJozs';
            const contract = await tronWeb.contract(trc20ABI).at(usdtContractAddress);
            const balance = await contract.balanceOf(address).call({ from: address });
            confirmed = Number(balance) / 1e6;
            unconfirmed = 0;
        } else {
            const chain = coin === 'BTC' ? (config.NETWORK === 'main' ? 'btc/main' : 'btc/test3') : 'ltc/main';
            let response;
            try {
                response = await blockcypherApi.get(`/${chain}/addrs/${address}/balance`);
                confirmed = response.data.final_balance / 1e8;
                unconfirmed = Math.abs(response.data.unconfirmed_balance / 1e8);
            } catch (error: any) {
                if (error.response && error.response.status === 404) {
                    confirmed = 0;
                    unconfirmed = 0;
                } else {
                    throw error;
                }
            }
        }
    
        await prisma.wallet.update({
            where: { id: wallet.id },
            data: {
                balance: confirmed,
                unconfirmedBalance: unconfirmed,
                lastBalanceUpdate: new Date()
            }
        });

        return { confirmed, unconfirmed, held};
    } catch (error: any) {
        console.error(`Error while retrieving balance for ${coin}:`, {
            message: error.message,
            stack: error.stack,
            code: error.code,
            response: error.response ? error.response.data : null
        });
        return { confirmed: wallet.balance, unconfirmed: wallet.unconfirmedBalance, held };
    }
}