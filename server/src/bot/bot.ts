import { Telegraf, Context } from 'telegraf';
import { PrismaClient } from '@prisma/client';
import { BotState } from '../types';
import { handleStart } from './handlers/start';
import { handleDeals, handleDealsText } from './handlers/deals';
import { handleWallets } from './handlers/wallets';
import { handleWithdraw, handleWithdrawText } from './handlers/withdraw';
import { getState } from "./state";
import { config } from "../config/env";

export interface BotContext extends Context {
    state: BotState;
}

const prisma = new PrismaClient();

const telegramToken = config.BOT_TOKEN;
if (!telegramToken) throw new Error('Telegram token is missing');

export const bot = new Telegraf<BotContext>(telegramToken);

bot.use(async (ctx, next) => {
    const userId = ctx.from?.id.toString();
    if (userId) {
        ctx.state = await getState(userId);
    } else {
        ctx.state = {};
    }
    await next();
});

handleStart(bot);
handleWallets(bot);
handleWithdraw(bot);
handleDeals(bot);

bot.on('text', async (ctx) => {
    const state = ctx.state;
    if (state.action?.startsWith('withdraw')) {
        await handleWithdrawText(ctx);
    } else if (state.action?.startsWith('buy_amount') || state.action?.startsWith('sell_amount')) {
        await handleDealsText(ctx);
    } else {
        await ctx.reply('Пожалуйста, выберите действие из меню.');
    }
});