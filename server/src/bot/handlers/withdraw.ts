import { Telegraf, Markup } from 'telegraf';
import { PrismaClient } from '@prisma/client';
import { BotContext } from '../bot';
import { getState, setState, clearState } from '../state';
import { getWalletBalance } from "../../wallet/balance";
import {withdrawToExternalWallet} from "../../wallet/transaction";
import {config} from "../../config/env";
import {checkAmlLimits} from "../../utils/amlCheck";

const prisma = new PrismaClient();

export function handleWithdraw(bot: Telegraf<BotContext>) {
    bot.hears('💸 Вывод средств', async (ctx) => {
        if (!ctx.from?.id) return;
        await ctx.reply('С какого кошелька хотите вывести?', Markup.inlineKeyboard([
            [
                Markup.button.callback('BTC', 'withdraw_BTC'),
                Markup.button.callback('LTC', 'withdraw_LTC')
            ],
            [
                Markup.button.callback('USDT TRC20', 'withdraw_USDT')
            ],
            [Markup.button.callback('Отменить', 'cancel')],
        ]));
    });

    bot.action(/withdraw_(BTC|LTC|USDT)/, async (ctx) => {
        const coin = ctx.match[1];
        if (!ctx.from?.id) return;
        const userId = ctx.from.id.toString();
        const user = await prisma.user.findFirst({
            where: { chatId: userId }
        });

        const { confirmed, unconfirmed, held } = await getWalletBalance(user.id, coin, true);

        const totalAmount = (confirmed - unconfirmed - held).toFixed(8);

        await setState(userId, { coin, action: 'withdraw_amount' });
        await ctx.editMessageText(
            `Сколько ${coin} хотите вывести? На вашем кошельке сейчас ${totalAmount} ${coin}. Комиссия платформы за вывод ${config.PLATFORM_WITHDRAW_COMMISSION_PERCENT}%`,
            { reply_markup: { inline_keyboard: [] } }
        );
    });
}

async function checkWithdrawLimits(userId: string): Promise<boolean> {
    if (!config.AML_VERIFICATION_ENABLED) return false;

    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 1000);
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 1000);

    const withdrawalsInHour = await prisma.deal.count({
        where: {
            userId: parseInt(userId),
            txId: { not: null },
            createdAt: { gte: oneHourAgo },
        },
    });

    if (withdrawalsInHour > 3) {
        await prisma.amlVerification.create({
            data: {
                userId: parseInt(userId),
                reason: 'Слишком много различных выводов за час',
                verificationImagesPath: [],
                status: 'open',
            },
        });
        return true;
    }

    const uniqueWalletsDay = await prisma.deal.groupBy({
        by: ['clientPaymentDetails'],
        where: {
            userId: parseInt(userId),
            txId: { not: null },
            createdAt: { gte: oneDayAgo },
        },
    });

    if (uniqueWalletsDay.length > 3) {
        await prisma.amlVerification.create({
            data: {
                userId: parseInt(userId),
                reason: 'Слишком много различных кошельков за день',
                verificationImagesPath: [],
                status: 'open',
            },
        });
        return true;
    }

    const uniqueWalletsWeek = await prisma.deal.groupBy({
        by: ['clientPaymentDetails'],
        where: {
            userId: parseInt(userId),
            txId: { not: null },
            createdAt: { gte: oneWeekAgo },
        },
    });

    if (uniqueWalletsWeek.length > 5) {
        await prisma.amlVerification.create({
            data: {
                userId: parseInt(userId),
                reason: 'Слишком много различных кошельков за неделю',
                verificationImagesPath: [],
                status: 'open',
            },
        });
        return true;
    }

    return false;
}

export async function handleWithdrawText(ctx: BotContext) {
    if (!ctx.from?.id) return;
    const state = await getState(ctx.from.id.toString());
    const userId = ctx.from.id.toString();

    if (state.action === 'withdraw_amount') {
        if (!('text' in ctx.message)) return;
        const amount = parseFloat(ctx.message.text);
        if (isNaN(amount)) {
            await ctx.reply('Ошибка: введите корректное число');
            return;
        }
        await setState(ctx.from.id.toString(), { withdrawAmount: amount });
        await ctx.reply(`Введите адрес своего ${state.coin} кошелька. Вводите внимательно!`);
        await setState(ctx.from.id.toString(), { action: 'withdraw_address' });
    } else if (state.action === 'withdraw_address') {
        if (!('text' in ctx.message)) return;
        const address = ctx.message.text;
        const coin = state.coin;
        const amount = state.withdrawAmount;

        if (!coin || !amount || isNaN(amount)) {
            await ctx.reply('Ошибка: неверные параметры перевода');
            return;
        }

        const needsAmlVerification = await checkAmlLimits(userId);
        if (needsAmlVerification) {
            const verification = await prisma.amlVerification.findFirst({
                where: { user: { chatId: userId }, status: 'open' },
            });

            await ctx.reply(
                `🚫 Мы заметили подозрительную активность в ваших действиях.\n` +
                `Причина: "${verification?.reason}".\n` +
                `Вам необходимо приложить документы (паспорт, подтверждение адреса, источник средств) для проверки.`,
                Markup.inlineKeyboard([
                    [Markup.button.callback('Приложить документы', 'support_category_aml')],
                ])
            );
            return;
        }

        const user = await prisma.user.findUnique({
            where: { chatId: userId }
        });
        if (!user) return;

        const txId = await withdrawToExternalWallet(
            amount,
            coin,
            user.id,
            address
        );

        if (!txId) {
            await ctx.reply('Ошибка при выводе средств');
            return;
        }

        const chain = coin === 'BTC' ? (config.NETWORK === 'main' ? 'btc/main' : 'btc/test3') : coin === 'LTC' ? 'ltc/main' : 'trx';
        const txLink = coin === 'USDT'
            ? (config.NETWORK === 'main' ? `https://tronscan.org/#/transaction/${txId}` : `https://shastascan.io/#/transaction/${txId}`)
            : `https://api.blockcypher.com/v1/${chain}/txs/${txId}`;

        await ctx.reply(`Транзакция отправлена успешно!\n${txLink}`);
        await clearState(userId);
    }
}