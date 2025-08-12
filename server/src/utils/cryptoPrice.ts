import axios from 'axios';

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