import { Telegraf, Markup } from 'telegraf';
import { PrismaClient } from '@prisma/client';
import { BotContext } from '../bot';
import { encrypt } from '../../utils/cryptoEncrypted';
import { generateBTCWallet, generateLTCWallet, generateUSDTWallet } from "../../wallet/walletGeneration";

const prisma = new PrismaClient();

export function handleStart(bot: Telegraf<BotContext>) {
    bot.start(async (ctx) => {
        if (!ctx.from?.id) return;
        const userId = ctx.from.id.toString();
        const username = ctx.from.username || ctx.from.first_name || 'User';
        const firstName = ctx.from.first_name || 'User';
        const lastName = ctx.from.last_name || '';

        const payload = ctx.payload;
        let referrerId: number | undefined;
        let referrerChatId: string | undefined;

        if (payload) {
            const referrer = await prisma.user.findFirst({
                where: { referralLinkId: payload },
            });
            if (referrer) {
                referrerId = referrer.id;
                referrerChatId = referrer.chatId;
            }
        }

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
                    referrerId,
                    wallets: {
                        create: [
                            {
                                coin: 'BTC',
                                address: btcWallet.address,
                                privateKey: encrypt(btcWallet.privateKey),
                                balance: 0,
                                unconfirmedBalance: 0
                            },
                            {
                                coin: 'LTC',
                                address: ltcWallet.address,
                                privateKey: encrypt(ltcWallet.privateKey),
                                balance: 0,
                                unconfirmedBalance: 0
                            },
                            {
                                coin: 'USDT',
                                address: usdtWallet.address,
                                privateKey: encrypt(usdtWallet.privateKey),
                                balance: 0,
                                unconfirmedBalance: 0
                            }
                        ]
                    }
                }
            });

            if (referrerChatId) {
                await bot.telegram.sendMessage(
                    referrerChatId,
                    `🎉 Пользователь @${username} зарегистрировался по вашей реферальной ссылке!`
                );
            }
        }

        await ctx.reply('Добро пожаловать в P2P бот!', Markup.keyboard([
            ['🪪 Профиль', '💳 Кошельки'],
            ['💰 Сделки', '💸 Вывод средств'],
            ['🤝 Реферальная программа']
        ]).resize());
    });
}