import { Telegraf, Markup } from 'telegraf';
import { PrismaClient } from '@prisma/client';
import { BotContext } from '../bot';
import { getWalletBalance } from '../../wallet/balance';
import { encrypt } from '../../utils/cryptoEncrypted';
import { generateBTCWallet, generateLTCWallet, generateUSDTWallet } from "../../wallet/walletGeneration";
import { setState, clearState } from '../state';

const prisma = new PrismaClient();

export function handleWallets(bot: Telegraf<BotContext>) {
    async function showWallets(ctx: BotContext, userId: string, edit: boolean = false) {
        const user = await prisma.user.findUnique({
            where: { chatId: userId },
            include: { wallets: true }
        });
        if (!user) {
            await (edit ? ctx.editMessageText('Пользователь не найден') : ctx.reply('Пользователь не найден'));
            return;
        }

        const existingCoins = user.wallets.map(wallet => wallet.coin);
        const walletsToCreate = [];

        if (!existingCoins.includes('BTC')) {
            const btcWallet = generateBTCWallet();
            walletsToCreate.push({
                coin: 'BTC',
                address: btcWallet.address,
                privateKey: encrypt(btcWallet.privateKey),
            });
        }

        if (!existingCoins.includes('LTC')) {
            const ltcWallet = generateLTCWallet();
            walletsToCreate.push({
                coin: 'LTC',
                address: ltcWallet.address,
                privateKey: encrypt(ltcWallet.privateKey),
            });
        }

        if (!existingCoins.includes('USDT')) {
            const usdtWallet = await generateUSDTWallet();
            walletsToCreate.push({
                coin: 'USDT',
                address: usdtWallet.address,
                privateKey: encrypt(usdtWallet.privateKey),
            });
        }

        if (walletsToCreate.length > 0) {
            await prisma.user.update({
                where: { chatId: userId },
                data: {
                    wallets: {
                        create: walletsToCreate
                    }
                }
            });

            const updatedUser = await prisma.user.findUnique({
                where: { chatId: userId },
                include: { wallets: true }
            });
            if (!updatedUser) {
                await (edit ? ctx.editMessageText('Пользователь не найден') : ctx.reply('Пользователь не найден'));
                return;
            }
            user.wallets = updatedUser.wallets;
        }

        const walletOrder = ['BTC', 'LTC', 'USDT'];
        const sortedWallets = user.wallets.sort((a, b) =>
            walletOrder.indexOf(a.coin) - walletOrder.indexOf(b.coin)
        );

        const walletInfo = await Promise.all(sortedWallets.map(async (wallet) => {
            const { confirmed, unconfirmed, held } = await getWalletBalance(user.id, wallet.coin);

            let balanceText = `💸 *${wallet.coin} - кошелёк*\nАдрес: ${wallet.address}\nБаланс: ${confirmed} ${wallet.coin}`;

            const statusParts = [];
            if (unconfirmed > 0) statusParts.push(`на обработке: ${unconfirmed}`);
            if (held > 0) statusParts.push(`на удержании: ${held}`);
            if (statusParts.length > 0) balanceText += ` (${statusParts.join(', ')})`;

            return balanceText;
        }));

        const messageText = walletInfo.join('\n\n') || 'Кошельки не найдены';
        const replyMarkup = Markup.inlineKeyboard([
            [Markup.button.callback('Обновить кошелёк', 'update_wallet')]
        ]).reply_markup;

        if (edit) {
            await ctx.editMessageText(messageText, {
                parse_mode: 'Markdown',
                reply_markup: replyMarkup
            });
        } else {
            await ctx.reply(messageText, {
                parse_mode: 'Markdown',
                reply_markup: replyMarkup
            });
        }
    }

    bot.hears('💳 Кошельки', async (ctx) => {
        if (!ctx.from?.id) return;
        const userId = ctx.from.id.toString();
        await showWallets(ctx, userId, false);
    });

    bot.action('update_wallet', async (ctx) => {
        if (!ctx.from?.id) return;
        const userId = ctx.from.id.toString();
        await setState(userId, { action: 'wallet_update' });

        await ctx.editMessageText(
            'Выберите кошелёк для обновления',
            Markup.inlineKeyboard([
                [
                    Markup.button.callback('BTC', 'update_wallet_BTC'),
                    Markup.button.callback('LTC', 'update_wallet_LTC'),
                    Markup.button.callback('USDT', 'update_wallet_USDT'),
                ],
                [Markup.button.callback('Отменить', 'update_wallet_cancel')]
            ])
        );
    });

    bot.action(/update_wallet_(BTC|LTC|USDT)/, async (ctx) => {
        if (!ctx.from?.id) return;
        const userId = ctx.from.id.toString();
        const coin = ctx.match[1];

        await prisma.wallet.deleteMany({
            where: {
                user: { chatId: userId },
                coin: coin
            }
        });

        let newWallet;
        if (coin === 'BTC') {
            newWallet = generateBTCWallet();
        } else if (coin === 'LTC') {
            newWallet = generateLTCWallet();
        } else if (coin === 'USDT') {
            newWallet = await generateUSDTWallet();
        }

        if (newWallet) {
            await prisma.user.update({
                where: { chatId: userId },
                data: {
                    wallets: {
                        create: {
                            coin: coin,
                            address: newWallet.address,
                            privateKey: encrypt(newWallet.privateKey),
                            balance: 0,
                            unconfirmedBalance: 0,
                            lastBalanceUpdate: new Date()
                        }
                    }
                }
            });
        }

        await clearState(userId);
        await showWallets(ctx, userId, true);
    });

    bot.action('update_wallet_cancel', async (ctx) => {
        if (!ctx.from?.id) return;
        const userId = ctx.from.id.toString();
        await clearState(userId);
        await showWallets(ctx, userId, true);
    });
}