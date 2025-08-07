import axios from 'axios';
import { PrismaClient } from '@prisma/client';
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
    userId: number,
    coin: string
): Promise<{ confirmed: number; unconfirmed: number; held: number }> {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
            wallets: { where: { coin } },
            warrantHolder: true
        }
    });

    if (!user) return { confirmed: 0, unconfirmed: 0, held: 0 };

    const address = user.wallets[0].address;

    const clientPendingDeals = await prisma.deal.findMany({
        where: {
            userId,
            status: 'pending',
            offer: {
                type: 'sell'
            }
        },
    });

    let heldAmount = clientPendingDeals.reduce((sum, deal) => sum + deal.amount * (1 + deal.markupPercent / 100), 0);

    if (user.warrantHolder) {
        const warrantHolderPendingDeals = await prisma.deal.findMany({
            where: {
                status: 'pending',
                offer: {
                    type: 'buy', userId
                }
            },
        });

        heldAmount = warrantHolderPendingDeals.reduce((sum, deal) => sum + deal.amount * (1 + deal.markupPercent / 100), 0);
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
            const hexAddress = tronWeb.address.toHex(address);
            const contract = await tronWeb.contract(usdtABI).at(usdtContractAddress);
            const balance = await contract.balanceOf(hexAddress).call();
            confirmed = Number(balance) / 1e6;
            unconfirmed = 0;
        } else {
            const chain = coin === 'BTC' ? 'btc/test3' : 'ltc/testnet';
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
            where: { id: user.wallets[0].id },
            data: { balance: confirmed, unconfirmedBalance: unconfirmed, lastBalanceUpdate: new Date() }
        });

        return { confirmed, unconfirmed, held: heldAmount };
    } catch (error: any) {
        console.error(`Error fetching balance for ${coin}:`, {
            message: error.message,
            stack: error.stack,
            code: error.code,
            response: error.response ? error.response.data : null
        });
        return { confirmed: user.wallets[0].balance, unconfirmed: user.wallets[0].unconfirmedBalance || 0, held: heldAmount };
    }
}