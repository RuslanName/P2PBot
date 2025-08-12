import { TronWeb } from 'tronweb';
import { config } from './src/config/env';

const tronWeb = new TronWeb({
    fullHost: config.NETWORK === 'main' ? 'https://api.trongrid.io' : 'https://api.shasta.trongrid.io',
    headers: { 'TRON-PRO-API-KEY': config.TRONGRID_API_KEY },
});

async function generateTronWallet(): Promise<{ address: string; privateKey: string }> {
    try {
        const wallet = await tronWeb.createAccount();
        return {
            address: wallet.address.base58,
            privateKey: wallet.privateKey
        };
    } catch (error) {
        console.error('Error generating TRON wallet:', error);
        throw new Error('Failed to generate TRON wallet');
    }
}

(async () => {
    try {
        const wallet = await generateTronWallet();
        console.log('Address:', wallet.address);
        console.log('Private Key:', wallet.privateKey);
    } catch (error) {
        console.error('Failed to generate wallet:', error);
    }
})();