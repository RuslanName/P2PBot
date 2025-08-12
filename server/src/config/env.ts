import * as dotenv from 'dotenv';

dotenv.config();

export const config = {
    BOT_NAME: process.env.BOT_NAME,
    BOT_TOKEN: process.env.BOT_TOKEN,
    BLOCKCYPHER_API_KEY: process.env.BLOCKCYPHER_API_KEY,
    TRONGRID_API_KEY: process.env.TRONGRID_API_KEY,
    PLATFORM_BUY_FEE_PERCENT: parseFloat(process.env.PLATFORM_BUY_FEE_PERCENT || '5'),
    PLATFORM_SELL_FEE_PERCENT: parseFloat(process.env.PLATFORM_SELL_FEE_PERCENT || '5'),
    PLATFORM_WITHDRAW_FEE_PERCENT: parseFloat(process.env.PLATFORM_WITHDRAW_FEE_PERCENT || '5'),
    REFERRAL_REVENUE_PERCENT: parseFloat(process.env.REFERRAL_REVENUE_PERCENT || '5'),
    MINER_FEE: process.env.MINER_FEE || 'medium',
    JWT_SECRET: process.env.JWT_SECRET,
    ADMIN_USERNAME: process.env.ADMIN_USERNAME,
    ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
    FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173',
    PORT: process.env.PORT || 3000,
    OWNER_BTC_WALLET: process.env.OWNER_BTC_WALLET,
    OWNER_LTC_WALLET: process.env.OWNER_LTC_WALLET,
    OWNER_USDT_WALLET: process.env.OWNER_USDT_WALLET,
    OWNER_TRX_WALLET: process.env.OWNER_TRX_WALLET,
    OWNER_TRX_PRIVATE_KEY: process.env.OWNER_TRX_PRIVATE_KEY,
    ENCRYPTION_KEY: process.env.ENCRYPTION_KEY,
    NETWORK: process.env.NETWORK,
};