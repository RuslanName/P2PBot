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

export async function getCryptoPrice(coin: string, amount: number): Promise<number> {
    const id = coin === 'BTC' ? 'bitcoin' : coin === 'LTC' ? 'litecoin' : coin === 'USDT' ? 'tether' : 'monero';
    const response = await axios.get(`https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=rub`);
    const price = response.data[id].rub;
    return amount * price;
}