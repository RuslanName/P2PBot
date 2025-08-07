import { Telegraf, Markup } from 'telegraf';
import { PrismaClient } from '@prisma/client';
import { BotContext } from '../bot';
import { getState, setState, clearState } from '../state';
import { getWalletBalance } from "../../wallet/balance";
import {withdrawToExternalWallet} from "../../wallet/transaction";
import {config} from "../../config/env";

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
                Markup.button.callback('USDT', 'withdraw_USDT'),
                Markup.button.callback('XMR', 'withdraw_XMR')
            ],
            [Markup.button.callback('Отменить', 'cancel')],
        ]));
    });

    bot.action(/withdraw_(BTC|LTC|USDT|XMR)/, async (ctx) => {
        const coin = ctx.match[1];
        if (!ctx.from?.id) return;
        const userId = ctx.from.id.toString();
        const user = await prisma.user.findFirst({
            where: { chatId: userId }
        });

        const { confirmed, unconfirmed, held } = await getWalletBalance(user.id, coin);

        const totalAmount = (confirmed - unconfirmed - held).toFixed(8);

        await setState(userId, { coin, action: 'withdraw_amount' });
        await ctx.editMessageText(
            `Сколько ${coin} хотите вывести? На вашем кошельке сейчас ${totalAmount} ${coin}. Комиссия платформы за вывод ${config.PLATFORM_WITHDRAW_FEE_PERCENT}%`,
            { reply_markup: { inline_keyboard: [] } }
        );
    });
}

export async function handleWithdrawText(ctx: BotContext) {
    if (!ctx.from?.id) return;
    const state = await getState(ctx.from.id.toString());
    const userId = ctx.from.id.toString();

    if (state.action === 'withdraw_amount') {
        if (!('text' in ctx.message)) return;
        const amount = parseFloat(ctx.message.text);
        if (isNaN(amount)) {
            await ctx.reply('Ошибка: введите корректное число.');
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

        await ctx.reply(`Транзакция отправлена успешно! TxID: ${txId}`);
        await clearState(userId);
    }
}