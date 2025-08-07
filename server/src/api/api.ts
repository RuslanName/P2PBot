import axios from 'axios';

export async function getBlockCypherFees(coin: string) {
    const chain = coin === 'BTC' ? 'btc/test3' : coin === 'LTC' ? 'ltc/testnet' : 'eth/testnet';
    const response = await axios.get(`https://api.blockcypher.com/v1/${chain}`, {
        params: { token: process.env.BLOCKCYPHER_API_KEY },
    });
    return {
        low_fee: response.data.low_fee_per_kb / 1000,
        medium_fee: response.data.medium_fee_per_kb / 1000,
        high_fee: response.data.high_fee_per_kb / 1000,
    };
}

const priceCache: { [key: string]: { price: number; timestamp: number } } = {};

export async function getCryptoPrice(coin: string, amount: number, fiatCurrency: string): Promise<number> {
    const id = coin === 'BTC' ? 'bitcoin'
        : coin === 'LTC' ? 'litecoin'
            : coin === 'USDT' ? 'tether'
                : 'monero';

    const cacheKey = `${id}_${fiatCurrency}`;
    const cached = priceCache[cacheKey];

    if (cached && Date.now() - cached.timestamp < 60_000) {
        return amount * cached.price;
    }

    const response = await axios.get(
        `https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=${fiatCurrency.toLowerCase()}`
    );

    const price = response.data[id][fiatCurrency.toLowerCase()];
    priceCache[cacheKey] = { price, timestamp: Date.now() };

    return amount * price;
}