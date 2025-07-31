import { Telegraf, Markup } from 'telegraf';
import { PrismaClient } from '@prisma/client';
import { BotContext } from '../bot';
import { generateBTCWallet, generateLTCWallet, generateUSDTWallet } from '../../wallet/wallet';
import { encrypt } from '../../utils/crypto';

const prisma = new PrismaClient();

export function handleStart(bot: Telegraf<BotContext>) {
    bot.start(async (ctx) => {
        if (!ctx.from?.id) return;
        const userId = ctx.from.id.toString();
        const username = ctx.from.username || ctx.from.first_name || 'User';
        const firstName = ctx.from.first_name || 'User';
        const lastName = ctx.from.last_name || '';

        const existingUser = await prisma.user.findUnique({ where: { chatId: userId } });
        if (!existingUser) {
            const btcWallet = generateBTCWallet();
            const ltcWallet = generateLTCWallet();
            const usdtWallet = await generateUSDTWallet();

            await prisma.user.create({
                data: {
                    chatId: userId,
                    username,
                    firstName,
                    lastName,
                    wallets: {
                        create: [
                            { coin: 'BTC', address: btcWallet.address, privateKey: encrypt(btcWallet.privateKey), balance: 0, unconfirmedBalance: 0 },
                            { coin: 'LTC', address: ltcWallet.address, privateKey: encrypt(ltcWallet.privateKey), balance: 0, unconfirmedBalance: 0 },
                            { coin: 'USDT', address: usdtWallet.address, privateKey: encrypt(usdtWallet.privateKey), balance: 0, unconfirmedBalance: 0 },
                        ]
                    }
                },
            });
        }

        await ctx.reply('Добро пожаловать в P2P бот!', Markup.keyboard([
            ['Сделки', 'Кошельки'],
            ['Переводы'],
        ]).resize());
    });
}