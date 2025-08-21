import {Context, Telegraf} from 'telegraf';
import { config } from '../config/env';
import {amlMiddleware, checkBlockedMiddleware} from './middleware';
import { handleStart } from './handlers/start';
import { handleDeals, handleDealsText } from './handlers/deals';
import { handleWallets } from './handlers/wallets';
import { handleWithdraw, handleWithdrawText } from './handlers/withdraw';
import { handleProfile } from './handlers/profile';
import { handleReferral } from './handlers/referral';
import { handleSupport, handleSupportText } from './handlers/support';
import { handleAml } from './handlers/aml';
import {BotState} from "../types";

export interface BotContext extends Context {
    state: BotState;
}

const telegramToken = config.BOT_TOKEN;
if (!telegramToken) throw new Error('Telegram token is missing');

export const bot = new Telegraf<BotContext>(telegramToken);

bot.use(checkBlockedMiddleware);
bot.use(amlMiddleware);

handleStart(bot);
handleProfile(bot);
handleDeals(bot);
handleWallets(bot);
handleWithdraw(bot);
handleReferral(bot);
handleSupport(bot);
handleAml(bot);

bot.on('text', async (ctx) => {
    const state = ctx.state;

    if (state.action?.startsWith('withdraw')) {
        await handleWithdrawText(ctx);
    } else if (
        state.action?.startsWith('buy_amount') ||
        state.action?.startsWith('sell_amount') ||
        state.action === 'buy_wallet_address' ||
        state.action === 'sell_payment_details' ||
        state.action === 'chat_to_warrant' ||
        state.action === 'chat_to_client'
    ) {
        await handleDealsText(ctx);
    } else if (
        state.action === 'support_describe_problem' ||
        state.action?.startsWith('support_reply_')
    ) {
        await handleSupportText(ctx);
    } else {
        await ctx.reply('Пожалуйста, выберите действие из меню.');
    }
});