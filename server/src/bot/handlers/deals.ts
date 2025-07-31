import { Telegraf, Markup } from 'telegraf';
import { PrismaClient } from '@prisma/client';
import { BotContext } from '../bot';
import { getState, setState, clearState } from '../state';
import { calculateUserTransaction } from '../../utils/transactions';
import { getBlockCypherFees, getCryptoPrice } from '../../api/api';
import { sendP2PTransaction } from '../../wallet/wallet';
import { getWalletBalance } from "../../wallet/balance";

const prisma = new PrismaClient();
const PLATFORM_BUY_FEE_PERCENT = parseFloat(process.env.PLATFORM_BUY_FEE_PERCENT || '5');
const PLATFORM_SELL_FEE_PERCENT = parseFloat(process.env.PLATFORM_SELL_FEE_PERCENT || '5');

export function handleDeals(bot: Telegraf<BotContext>) {
    bot.hears('Сделки', async (ctx) => {
        await ctx.reply('Какую опцию хотите выбрать?', Markup.inlineKeyboard([
            [Markup.button.callback('Покупка', 'buy'), Markup.button.callback('Продажа', 'sell')],
        ]));
    });

    bot.action('buy', async (ctx) => {
        await ctx.editMessageText('Какую валюту хотите купить?', Markup.inlineKeyboard([
            [
                Markup.button.callback('BTC', 'buy_BTC'),
                Markup.button.callback('LTC', 'buy_LTC'),
            ],
            [
                Markup.button.callback('USDT', 'buy_USDT'),
                Markup.button.callback('XMR', 'buy_XMR'),
            ],
            [Markup.button.callback('Отменить', 'cancel')],
        ]));
    });

    bot.action('sell', async (ctx) => {
        await ctx.editMessageText('Какую валюту хотите продать?', Markup.inlineKeyboard([
            [
                Markup.button.callback('BTC', 'sell_BTC'),
                Markup.button.callback('LTC', 'sell_LTC'),
            ],
            [
                Markup.button.callback('USDT', 'sell_USDT'),
                Markup.button.callback('XMR', 'sell_XMR'),
            ],
            [Markup.button.callback('Отменить', 'cancel')],
        ]));
    });

    bot.action(/buy_(BTC|LTC|USDT|XMR)/, async (ctx) => {
        const coin = ctx.match[1];
        if (!ctx.from?.id) return;

        const userId = ctx.from.id.toString();
        await setState(userId, { coin, page: 0 });

        const pageSize = 5;
        const skip = 0;
        const offers = await prisma.offer.findMany({
            where: { coin, type: 'sell' },
            take: pageSize,
            skip,
            include: { warrantHolder: { include: { user: true } } }
        });

        const totalOffers = await prisma.offer.count({
            where: { coin, type: 'sell' },
        });

        const buttons = offers.map((offer) => [
            Markup.button.callback(
                `${offer.warrantHolder?.user?.username || 'Unknown'}: ${offer.amount} ${coin}, ${offer.minDealAmount}-${offer.maxDealAmount} ${coin} (${offer.markupPercent}%)`,
                `select_buy_${offer.id}`
            ),
        ]);

        if (totalOffers > pageSize) {
            buttons.push([Markup.button.callback('>', 'next_buy')]);
        }

        await ctx.editMessageText('Выберите подходящую оферту', Markup.inlineKeyboard(buttons));
    });

    bot.action(/sell_(BTC|LTC|USDT|XMR)/, async (ctx) => {
        const coin = ctx.match[1];
        if (!ctx.from?.id) return;

        const userId = ctx.from.id.toString();
        await setState(userId, { coin, page: 0 });

        const pageSize = 5;
        const skip = 0;
        const offers = await prisma.offer.findMany({
            where: { coin, type: 'buy' },
            take: pageSize,
            skip,
            include: { warrantHolder: { include: { user: true } } }
        });

        const totalOffers = await prisma.offer.count({
            where: { coin, type: 'buy' },
        });

        const buttons = offers.map((offer) => [
            Markup.button.callback(
                `${offer.warrantHolder?.user?.username || 'Unknown'}: ${offer.amount} ${coin}, ${offer.minDealAmount}-${offer.maxDealAmount} ${coin} (${offer.markupPercent}%)`,
                `select_sell_${offer.id}`
            ),
        ]);

        if (totalOffers > pageSize) {
            buttons.push([Markup.button.callback('>', 'next_sell')]);
        }

        await ctx.editMessageText('Выберите подходящую оферту', Markup.inlineKeyboard(buttons));
    });

    bot.action(/select_buy_(\d+)/, async (ctx) => {
        const offerId = parseInt(ctx.match[1], 10);
        if (!ctx.from?.id) return;
        await setState(ctx.from.id.toString(), { offerId, action: 'buy_amount' });
        const state = await getState(ctx.from.id.toString());
        if (!state.coin) return;
        const offer = await prisma.offer.findUnique({ where: { id: offerId } });
        if (!offer) return;
        await ctx.editMessageText(
            `Сколько ${state.coin} хотите приобрести? (от ${offer.minDealAmount} до ${offer.maxDealAmount} ${state.coin})`,
            { reply_markup: { inline_keyboard: [] } }
        );
    });

    bot.action(/select_sell_(\d+)/, async (ctx) => {
        const offerId = parseInt(ctx.match[1], 10);
        if (!ctx.from?.id) return;
        await setState(ctx.from.id.toString(), { offerId, action: 'sell_amount' });
        const state = await getState(ctx.from.id.toString());
        if (!state.coin) return;
        const offer = await prisma.offer.findUnique({ where: { id: offerId } });
        if (!offer) return;
        await ctx.editMessageText(
            `Сколько ${state.coin} хотите продать? (от ${offer.minDealAmount} до ${offer.maxDealAmount} ${state.coin})`,
            { reply_markup: { inline_keyboard: [] } }
        );
    });

    bot.action('prev_buy', async (ctx) => {
        if (!ctx.from?.id) return;
        const userId = ctx.from.id.toString();
        const state = await getState(userId);
        if (!state.coin) return;

        let page = (state.page || 0) - 1;
        if (page < 0) page = 0;

        await setState(userId, { page });

        const pageSize = 5;
        const skip = page * pageSize;
        const offers = await prisma.offer.findMany({
            where: { coin: state.coin, type: 'sell' },
            take: pageSize,
            skip,
            include: { warrantHolder: { include: { user: true } } }
        });

        const totalOffers = await prisma.offer.count({
            where: { coin: state.coin, type: 'sell' },
        });

        const buttons = offers.map((offer) => [
            Markup.button.callback(
                `${offer.warrantHolder?.user?.username || 'Unknown'}: ${offer.amount} ${state.coin}, ${offer.minDealAmount}-${offer.maxDealAmount} ${state.coin} (${offer.markupPercent}%)`,
                `select_buy_${offer.id}`
            ),
        ]);

        const totalPages = Math.ceil(totalOffers / pageSize);
        const currentPage = page;

        if (totalOffers > pageSize) {
            if (currentPage === 0) {
                buttons.push([Markup.button.callback('>', 'next_buy')]);
            } else if (currentPage === totalPages - 1) {
                buttons.push([Markup.button.callback('<', 'prev_buy')]);
            } else {
                buttons.push([
                    Markup.button.callback('<', 'prev_buy'),
                    Markup.button.callback('>', 'next_buy'),
                ]);
            }
        }

        await ctx.editMessageText('Выберите подходящую оферту', Markup.inlineKeyboard(buttons));
    });

    bot.action('next_buy', async (ctx) => {
        if (!ctx.from?.id) return;
        const userId = ctx.from.id.toString();
        const state = await getState(userId);
        if (!state.coin) return;

        const page = (state.page || 0) + 1;
        const pageSize = 5;
        const skip = page * pageSize;

        const offers = await prisma.offer.findMany({
            where: { coin: state.coin, type: 'sell' },
            take: pageSize,
            skip,
            include: { warrantHolder: { include: { user: true } } }
        });

        const totalOffers = await prisma.offer.count({
            where: { coin: state.coin, type: 'sell' },
        });

        if (offers.length === 0) {
            await setState(userId, { page: page - 1 });
            await ctx.editMessageText('Нет доступных оферт на этой странице', Markup.inlineKeyboard([]));
            return;
        }

        await setState(userId, { page });

        const buttons = offers.map((offer) => [
            Markup.button.callback(
                `${offer.warrantHolder?.user?.username || 'Unknown'}: ${offer.amount} ${state.coin}, ${offer.minDealAmount}-${offer.maxDealAmount} ${state.coin} (${offer.markupPercent}%)`,
                `select_buy_${offer.id}`
            ),
        ]);

        const totalPages = Math.ceil(totalOffers / pageSize);
        const currentPage = page;

        if (totalOffers > pageSize) {
            if (currentPage === totalPages - 1) {
                buttons.push([Markup.button.callback('<', 'prev_buy')]);
            } else {
                buttons.push([
                    Markup.button.callback('<', 'prev_buy'),
                    Markup.button.callback('>', 'next_buy'),
                ]);
            }
        }

        await ctx.editMessageText('Выберите подходящую оферту', Markup.inlineKeyboard(buttons));
    });

    bot.action('prev_sell', async (ctx) => {
        if (!ctx.from?.id) return;
        const userId = ctx.from.id.toString();
        const state = await getState(userId);
        if (!state.coin) return;

        let page = (state.page || 0) - 1;
        if (page < 0) page = 0;

        await setState(userId, { page });

        const pageSize = 5;
        const skip = page * pageSize;
        const offers = await prisma.offer.findMany({
            where: { coin: state.coin, type: 'buy' },
            take: pageSize,
            skip,
            include: { warrantHolder: { include: { user: true } } }
        });

        const totalOffers = await prisma.offer.count({
            where: { coin: state.coin, type: 'buy' },
        });

        const buttons = offers.map((offer) => [
            Markup.button.callback(
                `${offer.warrantHolder?.user?.username || 'Unknown'}: ${offer.amount} ${state.coin}, ${offer.minDealAmount}-${offer.maxDealAmount} ${state.coin} (${offer.markupPercent}%)`,
                `select_sell_${offer.id}`
            ),
        ]);

        const totalPages = Math.ceil(totalOffers / pageSize);
        const currentPage = page;

        if (totalOffers > pageSize) {
            if (currentPage === 0) {
                buttons.push([Markup.button.callback('>', 'next_sell')]);
            } else if (currentPage === totalPages - 1) {
                buttons.push([Markup.button.callback('<', 'prev_sell')]);
            } else {
                buttons.push([
                    Markup.button.callback('<', 'prev_sell'),
                    Markup.button.callback('>', 'next_sell'),
                ]);
            }
        }

        await ctx.editMessageText('Выберите подходящую оферту', Markup.inlineKeyboard(buttons));
    });

    bot.action('next_sell', async (ctx) => {
        if (!ctx.from?.id) return;
        const userId = ctx.from.id.toString();
        const state = await getState(userId);
        if (!state.coin) return;

        const page = (state.page || 0) + 1;
        const pageSize = 5;
        const skip = page * pageSize;

        const offers = await prisma.offer.findMany({
            where: { coin: state.coin, type: 'buy' },
            take: pageSize,
            skip,
            include: { warrantHolder: { include: { user: true } } }
        });

        const totalOffers = await prisma.offer.count({
            where: { coin: state.coin, type: 'buy' },
        });

        if (offers.length === 0) {
            await setState(userId, { page: page - 1 });
            await ctx.editMessageText('Нет доступных оферт на этой странице', Markup.inlineKeyboard([]));
            return;
        }

        await setState(userId, { page });

        const buttons = offers.map((offer) => [
            Markup.button.callback(
                `${offer.warrantHolder?.user?.username || 'Unknown'}: ${offer.amount} ${state.coin}, ${offer.minDealAmount}-${offer.maxDealAmount} ${state.coin} (${offer.markupPercent}%)`,
                `select_sell_${offer.id}`
            ),
        ]);

        const totalPages = Math.ceil(totalOffers / pageSize);
        const currentPage = page;

        if (totalOffers > pageSize) {
            if (currentPage === totalPages - 1) {
                buttons.push([Markup.button.callback('<', 'prev_sell')]);
            } else {
                buttons.push([
                    Markup.button.callback('<', 'prev_sell'),
                    Markup.button.callback('>', 'next_sell'),
                ]);
            }
        }

        await ctx.editMessageText('Выберите подходящую оферту', Markup.inlineKeyboard(buttons));
    });

    bot.action('cancel', async (ctx) => {
        if (!ctx.from?.id) return;
        await ctx.editMessageText('Действие отменено', Markup.inlineKeyboard([]));
        await clearState(ctx.from.id.toString());
    });

    bot.action('proceed_buy', async (ctx) => {
        if (!ctx.from?.id) return;
        const state = await getState(ctx.from.id.toString());
        const offer = await prisma.offer.findUnique({ where: { id: state.offerId } });
        if (!offer) return;
        const warrantHolders = await prisma.warrantHolder.findUnique({ where: { id: offer.userId } });
        if (!warrantHolders) return;
        const user = await prisma.user.findUnique({ where: { id: warrantHolders.userId } });
        if (!user) return;

        const fees = await getBlockCypherFees(offer.coin);
        const txWeight = 150;
        const minerFee = fees.medium_fee * txWeight / 1e8;
        const amount = state.amount || 0;

        const platformFee = amount * (PLATFORM_BUY_FEE_PERCENT / 100);
        const warrantHolderFee = amount * (offer.markupPercent / 100);
        const fiatAmount = await getCryptoPrice(offer.coin, amount + warrantHolderFee);

        const transaction = await prisma.transaction.create({
            data: {
                userId: user.id,
                coin: offer.coin,
                amount,
                type: 'buy',
                status: 'pending',
                txId: `pending_${Date.now()}`
            }
        });

        const deal = await prisma.deal.create({
            data: {
                userId: (await prisma.user.findUnique({ where: { chatId: ctx.from.id.toString() } }))!.id,
                offerId: offer.id,
                amount,
                fiatAmount,
                clientFee: platformFee,
                warrantHolderFee,
                minerFee,
                platformFee,
                status: 'pending',
                transactionId: transaction.id,
                clientConfirmed: false
            }
        });

        await ctx.editMessageText(
            `Реквизиты продавца ${user.username}. Переведите ${fiatAmount} RUB продавцу и нажмите кнопку "Оплатил"`,
            Markup.inlineKeyboard([Markup.button.callback('Оплатил', `paid_${deal.id}`)])
        );
    });

    bot.action('proceed_sell', async (ctx) => {
        if (!ctx.from?.id) return;
        const state = await getState(ctx.from.id.toString());
        const offer = await prisma.offer.findUnique({ where: { id: state.offerId } });
        if (!offer) return;
        const warrantHolders = await prisma.warrantHolder.findUnique({ where: { id: offer.userId } });
        if (!warrantHolders) return;
        const user = await prisma.user.findUnique({ where: { id: warrantHolders.userId } });
        if (!user) return;

        const fees = await getBlockCypherFees(offer.coin);
        const txWeight = 150;
        const minerFee = fees.medium_fee * txWeight / 1e8;
        const amount = state.amount || 0;

        const platformFee = amount * (PLATFORM_SELL_FEE_PERCENT / 100);
        const warrantHolderFee = amount * (offer.markupPercent / 100);
        const fiatAmount = await getCryptoPrice(offer.coin, amount);

        const transaction = await prisma.transaction.create({
            data: {
                userId: user.id,
                coin: offer.coin,
                amount,
                type: 'sell',
                status: 'pending',
                txId: `pending_${Date.now()}`
            }
        });

        const deal = await prisma.deal.create({
            data: {
                userId: user.id,
                offerId: offer.id,
                amount,
                fiatAmount,
                clientFee: platformFee,
                warrantHolderFee,
                minerFee,
                platformFee,
                status: 'pending',
                transactionId: transaction.id,
                clientConfirmed: false
            }
        });

        await ctx.telegram.sendMessage(
            (await prisma.user.findUnique({ where: { id: offer.userId } }))!.chatId,
            `Пришла оплата сделки на продажу №${deal.id} на сумму ${amount} ${offer.coin}. ` +
            `Реквизиты покупателя ${user.username}. Переведите ${fiatAmount} RUB покупателю и нажмите кнопку "Получил и отправил"`,
            Markup.inlineKeyboard([Markup.button.callback('Получил и отправил', `received_${deal.id}`)])
        );
        await ctx.editMessageText('Ожидайте ответ продавца');
    });

    bot.action(/paid_(\d+)/, async (ctx) => {
        if (!ctx.from?.id) return;
        const dealId = parseInt(ctx.match[1], 10);

        await prisma.deal.update({
            where: { id: dealId },
            data: { clientConfirmed: true }
        });

        const deal = await prisma.deal.findUnique({
            where: { id: dealId },
            include: { offer: true }
        });
        if (!deal) return;

        await ctx.editMessageText('Ожидайте ответ продавца');
        const fees = await getBlockCypherFees(deal.offer.coin);
        const txWeight = 150;
        const minerFee = fees.medium_fee * txWeight / 1e8;
        const fiatAmount = await getCryptoPrice(deal.offer.coin, deal.amount * (1 + deal.offer.markupPercent / 100));

        const warrantHolder = await prisma.warrantHolder.findUnique({
            where: { id: deal.offer.userId },
            include: { user: true }
        });
        if (!warrantHolder?.user?.chatId) return;

        await ctx.telegram.sendMessage(
            warrantHolder.user.chatId,
            `Пришла оплата сделки на покупку №${deal.id} на сумму ${fiatAmount} RUB. Убедитесь в этом и нажмите кнопку "Получил"`,
            Markup.inlineKeyboard([Markup.button.callback('Получил', `received_${deal.id}`)])
        );
    });

    bot.action(/received_(\d+)/, async (ctx) => {
        if (!ctx.from?.id) return;
        const dealId = parseInt(ctx.match[1], 10);
        const deal = await prisma.deal.findUnique({
            where: { id: dealId },
            include: { offer: true }
        });
        if (!deal) return;

        const warrantHolder = await prisma.warrantHolder.findUnique({ where: { id: deal.offer.userId } });
        if (!warrantHolder) return;
        const seller = await prisma.user.findUnique({ where: { id: warrantHolder.userId } });
        if (!seller) return;
        const buyer = await prisma.user.findUnique({ where: { id: deal.userId } });
        if (!buyer) return;

        const sellerWallet = await prisma.wallet.findFirst({
            where: { userId: seller.id, coin: deal.offer.coin }
        });
        const buyerWallet = await prisma.wallet.findFirst({
            where: { userId: buyer.id, coin: deal.offer.coin }
        });
        if (!sellerWallet || !buyerWallet) return;

        const { confirmed: sellerBalance } = await getWalletBalance(sellerWallet.address, deal.offer.coin, seller.chatId);
        const { confirmed: buyerBalance } = await getWalletBalance(buyerWallet.address, deal.offer.coin, buyer.chatId);

        await prisma.wallet.update({
            where: { id: sellerWallet.id },
            data: { balance: sellerBalance }
        });
        await prisma.wallet.update({
            where: { id: buyerWallet.id },
            data: { balance: buyerBalance }
        });

        const sellerAmount = deal.amount * (1 + deal.offer.markupPercent / 100);

        if (sellerBalance < sellerAmount) {
            await ctx.reply('Ошибка: недостаточно средств у продавца.');
            return;
        }

        const txId = await sendP2PTransaction(
            deal.offer.coin,
            deal.amount,
            seller.chatId,
            buyer.chatId
        );

        if (!txId) {
            await ctx.reply('Ошибка при выполнении транзакции. Попробуйте снова.');
            return;
        }

        await prisma.wallet.update({
            where: { id: sellerWallet.id },
            data: { balance: sellerBalance - sellerAmount }
        });

        await prisma.wallet.update({
            where: { id: buyerWallet.id },
            data: { balance: buyerBalance + deal.amount }
        });

        await prisma.deal.update({
            where: { id: deal.id },
            data: { status: 'completed', clientConfirmed: true }
        });

        await prisma.transaction.update({
            where: { id: deal.transactionId },
            data: { txId, status: 'completed' }
        });

        await prisma.transaction.create({
            data: {
                userId: seller.id,
                coin: deal.offer.coin,
                txId: `fee_${Date.now()}`,
                amount: deal.platformFee,
                type: 'fee',
                status: 'completed'
            }
        });

        await ctx.editMessageText('Транзакция прошла успешно!');
        await ctx.telegram.sendMessage(buyer.chatId, 'Транзакция прошла успешно!');
        await clearState(ctx.from.id.toString());
    });
}

export async function handleDealsText(ctx: BotContext) {
    if (!ctx.from?.id) return;
    const state = await getState(ctx.from.id.toString());
    const userId = ctx.from.id.toString();

    if (state.action === 'buy_amount') {
        if (!('text' in ctx.message)) return;
        const amount = parseFloat(ctx.message.text);
        if (isNaN(amount)) {
            await ctx.reply('Ошибка: введите корректное число.');
            return;
        }

        const offer = await prisma.offer.findUnique({ where: { id: state.offerId } });
        if (!offer || offer.type !== 'sell') return;

        if (amount < offer.minDealAmount || amount > offer.maxDealAmount) {
            await ctx.reply(`Ошибка: сумма должна быть в диапазоне ${offer.minDealAmount} - ${offer.maxDealAmount} ${offer.coin}.`);
            return;
        }

        const { totalAmount, currency } = await calculateUserTransaction('buy', amount, offer);

        await ctx.reply(
            `Вы покупаете ${amount} ${offer.coin} с наценкой продавца ${offer.markupPercent}%. ` +
            `Итоговая сумма перевода ${totalAmount} ${currency}. Готовы перейти к оплате?`,
            Markup.inlineKeyboard([
                [Markup.button.callback('Отменить', 'cancel'), Markup.button.callback('Перейти', 'proceed_buy')],
            ])
        );
        await setState(ctx.from.id.toString(), {
            amount,
            platformFee: amount * (PLATFORM_BUY_FEE_PERCENT / 100)
        });
    } else if (state.action === 'sell_amount') {
        if (!('text' in ctx.message)) return;
        const amount = parseFloat(ctx.message.text);
        if (isNaN(amount)) {
            await ctx.reply('Ошибка: введите корректное число.');
            return;
        }

        const offer = await prisma.offer.findUnique({ where: { id: state.offerId } });
        if (!offer || offer.type !== 'buy') return;

        if (amount < offer.minDealAmount || amount > offer.maxDealAmount) {
            await ctx.reply(`Ошибка: сумма должна быть в диапазоне ${offer.minDealAmount} - ${offer.maxDealAmount} ${offer.coin}.`);
            return;
        }

        const { totalAmount, currency } = await calculateUserTransaction('sell', amount, offer);
        const fiatAmount = await getCryptoPrice(offer.coin, amount);

        await ctx.reply(
            `Вы продаете ${amount} ${offer.coin} с наценкой ${offer.markupPercent}%. ` +
            `Итоговая сумма перевода ${totalAmount} ${currency}. Вы получите ${fiatAmount} RUB. Готовы оплатить?`,
            Markup.inlineKeyboard([
                [Markup.button.callback('Отменить', 'cancel'), Markup.button.callback('Оплатить', 'proceed_sell')],
            ])
        );
        await setState(ctx.from.id.toString(), { amount, platformFee: amount * 0.05 });
    }
}