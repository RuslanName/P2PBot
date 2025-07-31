import { Telegraf, Markup } from 'telegraf';
import { PrismaClient } from '@prisma/client';
import { BotContext } from '../bot';
import { getState, setState, clearState } from '../state';
import { withdrawToExternalWallet } from '../../wallet/wallet';
import { calculateWithdrawal } from '../../utils/transactions';
import { getWalletBalance } from "../../wallet/balance";

const prisma = new PrismaClient();

export function handleWithdraw(bot: Telegraf<BotContext>) {
    bot.hears('Переводы', async (ctx) => {
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
        const wallet = await prisma.wallet.findFirst({
            where: { user: { chatId: userId }, coin }
        });
        if (!wallet) {
            await ctx.editMessageText('Ошибка: кошелек не найден', Markup.inlineKeyboard([]));
            return;
        }

        const { confirmed } = await getWalletBalance(wallet.address, coin, userId);
        await prisma.wallet.update({
            where: { id: wallet.id },
            data: { balance: confirmed }
        });

        const platformFeePercent = parseFloat(process.env.PLATFORM_WITHDRAW_FEE_PERCENT || '5');

        await setState(userId, { coin, action: 'withdraw_amount' });
        await ctx.editMessageText(
            `Сколько ${coin} хотите вывести? На вашем кошельке сейчас ${confirmed} ${coin}. Комиссия платформы за вывод ${platformFeePercent}%`,
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
        await ctx.reply(`Введите адрес своего кошелька ${state.coin}`);
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
            where: { chatId: userId },
            include: { wallets: { where: { coin } } }
        });
        if (!user || !user.wallets[0]) {
            await ctx.reply('Ошибка: пользователь или кошелек не найден');
            return;
        }

        const wallet = user.wallets[0];
        const { confirmed } = await getWalletBalance(wallet.address, coin, userId);
        await prisma.wallet.update({
            where: { id: wallet.id },
            data: { balance: confirmed }
        });

        if (amount > confirmed) {
            await ctx.reply(`Недостаточно средств. Ваш подтверждённый баланс: ${confirmed} ${coin}`);
            return;
        }

        const netAmount = calculateWithdrawal(amount);

        const txId = await withdrawToExternalWallet(
            coin,
            amount,
            userId,
            address
        );

        if (!txId) {
            await ctx.reply('Ошибка при выводе средств');
            return;
        }

        await prisma.wallet.update({
            where: { id: wallet.id },
            data: { balance: confirmed - amount }
        });

        await prisma.transaction.create({
            data: {
                userId: user.id,
                coin,
                txId,
                amount: netAmount,
                type: 'withdraw',
                status: 'completed'
            }
        });

        await ctx.reply(`Транзакция успешно отправлена! TXID: ${txId}`);
        await clearState(userId);
    }
}