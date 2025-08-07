import {Markup, Telegraf} from 'telegraf';
import {PrismaClient} from '@prisma/client';
import {BotContext} from '../bot';
import {clearState, getState, setState} from '../state';
import {calculateClientTransaction, calculateReferralFee} from '../../utils/calculateTransaction';
import {sendP2PTransaction} from "../../wallet/transaction";

const prisma = new PrismaClient();

export function handleDeals(bot: Telegraf<BotContext>) {
    bot.hears('💰 Сделки', async (ctx) => {
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
        await setState(userId, { coin, action: 'buy_fiat' });

        await ctx.editMessageText('Какую фиатную валюту хотите обменять?', Markup.inlineKeyboard([
            [
                Markup.button.callback('RUB', 'buy_fiat_RUB'),
                Markup.button.callback('UAH', 'buy_fiat_UAH'),
            ],
            [
                Markup.button.callback('KZT', 'buy_fiat_KZT'),
                Markup.button.callback('BYN', 'buy_fiat_BYN'),
            ],
            [
                Markup.button.callback('USD', 'buy_fiat_USD'),
                Markup.button.callback('EUR', 'buy_fiat_EUR'),
            ],
            [Markup.button.callback('Отменить', 'cancel')],
        ]));
    });

    bot.action(/sell_(BTC|LTC|USDT|XMR)/, async (ctx) => {
        const coin = ctx.match[1];
        if (!ctx.from?.id) return;

        const userId = ctx.from.id.toString();
        await setState(userId, { coin, action: 'sell_fiat' });

        await ctx.editMessageText('Какую фиатную валюту хотите получить?', Markup.inlineKeyboard([
            [
                Markup.button.callback('RUB', 'sell_fiat_RUB'),
                Markup.button.callback('UAH', 'sell_fiat_UAH'),
            ],
            [
                Markup.button.callback('KZT', 'sell_fiat_KZT'),
                Markup.button.callback('BYN', 'sell_fiat_BYN'),
            ],
            [
                Markup.button.callback('USD', 'sell_fiat_USD'),
                Markup.button.callback('EUR', 'sell_fiat_EUR'),
            ],
            [Markup.button.callback('Отменить', 'cancel')],
        ]));
    });

    bot.action(/buy_fiat_(RUB|UAH|KZT|BYN|USD|EUR)/, async (ctx) => {
        const fiatCurrency = ctx.match[1];
        if (!ctx.from?.id) return;

        const userId = ctx.from.id.toString();
        const state = await getState(userId);
        if (!state.coin) return;

        await setState(userId, { fiatCurrency, page: 0 });

        const pageSize = 5;
        const skip = 0;
        const offers = await prisma.offer.findMany({
            where: {
                coin: state.coin,
                type: 'buy',
                fiatCurrency: { has: fiatCurrency },
                status: 'open'
            },
            take: pageSize,
            skip,
            include: { warrantHolder: { include: { user: true } } }
        });

        const totalOffers = await prisma.offer.count({
            where: {
                coin: state.coin,
                type: 'buy',
                fiatCurrency: { has: fiatCurrency },
                status: 'open'
            },
        });

        const buttons = offers.map((offer) => [
            Markup.button.callback(
                `${offer.warrantHolder.user.username || 'Неизвестно'}: ${offer.minDealAmount}-${offer.maxDealAmount} ${state.coin} (${offer.markupPercent}%)`,
                `select_buy_${offer.id}`
            ),
        ]);

        if (totalOffers > pageSize) {
            buttons.push([Markup.button.callback('>', 'next_buy')]);
        }

        await ctx.editMessageText('Выберите подходящую оферту', Markup.inlineKeyboard(buttons));
    });

    bot.action(/sell_fiat_(RUB|UAH|KZT|BYN|USD|EUR)/, async (ctx) => {
        const fiatCurrency = ctx.match[1];
        if (!ctx.from?.id) return;

        const userId = ctx.from.id.toString();
        const state = await getState(userId);
        if (!state.coin) return;

        await setState(userId, { fiatCurrency, page: 0 });

        const pageSize = 5;
        const skip = 0;
        const offers = await prisma.offer.findMany({
            where: {
                coin: state.coin,
                type: 'sell',
                fiatCurrency: { has: fiatCurrency },
                status: 'open'
            },
            take: pageSize,
            skip,
            include: { warrantHolder: { include: { user: true } } }
        });

        const totalOffers = await prisma.offer.count({
            where: {
                coin: state.coin,
                type: 'sell',
                fiatCurrency: { has: fiatCurrency },
                status: 'open'
            },
        });

        const buttons = offers.map((offer) => [
            Markup.button.callback(
                `${offer.warrantHolder.user.username || 'Неизвестно'}: ${offer.minDealAmount}-${offer.maxDealAmount} ${state.coin} (${offer.markupPercent}%)`,
                `select_sell_${offer.id}`
            ),
        ]);

        if (totalOffers > pageSize) {
            buttons.push([Markup.button.callback('>', 'next_sell')]);
        }

        await ctx.editMessageText('Выберите подходящую оферту', Markup.inlineKeyboard(buttons));
    });

    bot.action('prev_buy', async (ctx) => {
        if (!ctx.from?.id) return;
        const userId = ctx.from.id.toString();
        const state = await getState(userId);
        if (!state.coin || !state.fiatCurrency) return;

        let page = (state.page || 0) - 1;
        if (page < 0) page = 0;

        await setState(userId, { page });

        const pageSize = 5;
        const skip = page * pageSize;
        const offers = await prisma.offer.findMany({
            where: {
                coin: state.coin,
                type: 'buy',
                fiatCurrency: { has: state.fiatCurrency },
                status: 'open'
            },
            take: pageSize,
            skip,
            include: { warrantHolder: { include: { user: true } } }
        });

        const totalOffers = await prisma.offer.count({
            where: {
                coin: state.coin,
                type: 'buy',
                fiatCurrency: { has: state.fiatCurrency },
                status: 'open'
            },
        });

        const buttons = offers.map((offer) => [
            Markup.button.callback(
                `${offer.warrantHolder.user.username || 'Неизвестно'}: ${offer.minDealAmount}-${offer.maxDealAmount} ${state.coin} (${offer.markupPercent}%)`,
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
        if (!state.coin || !state.fiatCurrency) return;

        const page = (state.page || 0) + 1;
        const pageSize = 5;
        const skip = page * pageSize;

        const offers = await prisma.offer.findMany({
            where: {
                coin: state.coin,
                type: 'buy',
                fiatCurrency: { has: state.fiatCurrency },
                status: 'open'
            },
            take: pageSize,
            skip,
            include: { warrantHolder: { include: { user: true } } }
        });

        const totalOffers = await prisma.offer.count({
            where: {
                coin: state.coin,
                type: 'buy',
                fiatCurrency: { has: state.fiatCurrency },
                status: 'open'
            },
        });

        if (offers.length === 0) {
            await setState(userId, { page: page - 1 });
            await ctx.editMessageText('Нет доступных оферт на этой странице', Markup.inlineKeyboard([]));
            return;
        }

        await setState(userId, { page });

        const buttons = offers.map((offer) => [
            Markup.button.callback(
                `${offer.warrantHolder.user.username || 'Неизвестно'}: ${offer.minDealAmount}-${offer.maxDealAmount} ${state.coin} (${offer.markupPercent}%)`,
                `select_buy_${offer.id}`
            ),
        ]);

        const totalPages = Math.ceil(totalOffers / pageSize);

        if (totalOffers > pageSize) {
            if (page === totalPages - 1) {
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
        if (!state.coin || !state.fiatCurrency) return;

        let page = (state.page || 0) - 1;
        if (page < 0) page = 0;

        await setState(userId, { page });

        const pageSize = 5;
        const skip = page * pageSize;
        const offers = await prisma.offer.findMany({
            where: {
                coin: state.coin,
                type: 'sell',
                fiatCurrency: { has: state.fiatCurrency },
                status: 'open'
            },
            take: pageSize,
            skip,
            include: { warrantHolder: { include: { user: true } } }
        });

        const totalOffers = await prisma.offer.count({
            where: {
                coin: state.coin,
                type: 'sell',
                fiatCurrency: { has: state.fiatCurrency },
                status: 'open'
            },
        });

        const buttons = offers.map((offer) => [
            Markup.button.callback(
                `${offer.warrantHolder.user.username || 'Неизвестно'}: ${offer.minDealAmount}-${offer.maxDealAmount} ${offer.coin} (${offer.markupPercent}%)`,
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
        if (!state.coin || !state.fiatCurrency) return;

        const page = (state.page || 0) + 1;
        const pageSize = 5;
        const skip = page * pageSize;

        const offers = await prisma.offer.findMany({
            where: {
                coin: state.coin,
                type: 'sell',
                fiatCurrency: { has: state.fiatCurrency },
                status: 'open'
            },
            take: pageSize,
            skip,
            include: { warrantHolder: { include: { user: true } } }
        });

        const totalOffers = await prisma.offer.count({
            where: {
                coin: state.coin,
                type: 'sell',
                fiatCurrency: { has: state.fiatCurrency },
                status: 'open'
            },
        });

        if (offers.length === 0) {
            await setState(userId, { page: page - 1 });
            await ctx.editMessageText('Нет доступных оферт на этой странице', Markup.inlineKeyboard([]));
            return;
        }

        await setState(userId, { page });

        const buttons = offers.map((offer) => [
            Markup.button.callback(
                `${offer.warrantHolder.user.username || 'Неизвестно'}: ${offer.minDealAmount}-${offer.maxDealAmount} ${offer.coin} (${offer.markupPercent}%)`,
                `select_sell_${offer.id}`
            ),
        ]);

        const totalPages = Math.ceil(totalOffers / pageSize);

        if (totalOffers > pageSize) {
            if (page === totalPages - 1) {
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

    bot.action('confirm_buy', async (ctx) => {
        if (!ctx.from?.id) return;
        const state = await getState(ctx.from.id.toString());
        if (!state.coin || !state.amount || !state.fiatCurrency) return;

        await setState(ctx.from.id.toString(), { action: 'buy_wallet_choice' });
        await ctx.editMessageText(
            `На какой ваш ${state.coin} кошелёк вы хотите перевести деньги?`,
            Markup.inlineKeyboard([
                [Markup.button.callback('Платформы', 'platform_wallet'), Markup.button.callback('Свой', 'own_wallet')],
                [Markup.button.callback('Отменить', 'cancel')]
            ])
        );
    });

    bot.action('confirm_sell', async (ctx) => {
        if (!ctx.from?.id) return;
        const userId = ctx.from.id.toString();
        await setState(userId, { action: 'sell_payment_details' });
        await ctx.editMessageText(
            'Введите свои реквизиты для получения оплаты (например, номер карты или банковские данные). Вводите внимательно!',
            Markup.inlineKeyboard([[Markup.button.callback('Отменить', 'cancel')]])
        );
    });

    bot.action('cancel', async (ctx) => {
        if (!ctx.from?.id) return;
        await ctx.editMessageText('Действие отменено', Markup.inlineKeyboard([]));
        await clearState(ctx.from.id.toString());
    });

    bot.action('platform_wallet', async (ctx) => {
        if (!ctx.from?.id) return;
        const state = await getState(ctx.from.id.toString());
        const offer = await prisma.offer.findUnique({
            where: { id: state.offerId },
            include: { warrantHolder: { include: { user: true } } }
        });
        if (!offer || !state.fiatCurrency) return;

        const deal = await prisma.deal.create({
            data: {
                client: { connect: { id: offer.warrantHolder.user.id } },
                offer: { connect: { id: offer.id } },
                amount: state.amount,
                markupPercent: offer.markupPercent,
                fiatCurrency: state.fiatCurrency
            },
        });

        await setState(ctx.from.id.toString(), { dealId: deal.id });

        const totalAmount = await calculateClientTransaction('buy', state.coin, state.fiatCurrency, state.amount, offer.markupPercent);

        await ctx.editMessageText(
            `Реквизиты продавца ${offer.warrantHolderPaymentDetails}. Переведите ${totalAmount} ${state.fiatCurrency} продавцу и нажмите кнопку "Оплатил"`,
            Markup.inlineKeyboard([Markup.button.callback('Оплатил', `paid_${deal.id}`)])
        );
    });

    bot.action('own_wallet', async (ctx) => {
        if (!ctx.from?.id) return;
        const state = await getState(ctx.from.id.toString());
        await setState(ctx.from.id.toString(), { action: 'buy_wallet_address' });
        await ctx.editMessageText(
            `Введите адрес своего ${state.coin} кошелька. Вводите внимательно!`,
            { reply_markup: { inline_keyboard: [[Markup.button.callback('Отменить', 'cancel')]] } }
        );
    });

    bot.action(/paid_(\d+)/, async (ctx) => {
        if (!ctx.from?.id) return;
        const dealId = parseInt(ctx.match[1], 10);

        const deal = await prisma.deal.update({
            where: { id: dealId },
            data: { clientConfirmed: true },
            include: { offer: { include: { warrantHolder: { include: { user: true } } } } }
        });

        if (!deal) return;

        const totalAmount = await calculateClientTransaction(deal.offer.type, deal.offer.coin, deal.fiatCurrency, deal.amount, deal.markupPercent);

        await ctx.telegram.sendMessage(
            deal.offer.warrantHolder.user.chatId,
            `Пришла оплата сделки на покупку №${deal.id} на сумму ${totalAmount} ${deal.fiatCurrency}. Убедитесь в этом и нажмите кнопку "Получил"`,
            Markup.inlineKeyboard([Markup.button.callback('Получил', `received_${deal.id}`)])
        );

        await ctx.editMessageText('Ожидайте подтверждения продавца');
    });

    bot.action(/received_(\d+)/, async (ctx) => {
        if (!ctx.from?.id) return;
        const dealId = parseInt(ctx.match[1], 10);

        const deal = await prisma.deal.findUnique({
            where: { id: dealId },
            include: {
                offer: { include: { warrantHolder: { include: { user: true } } } },
                client: { include: { referrer: true } }
            }
        });
        if (!deal) return;

        const warrantHolder = await prisma.warrantHolder.findUnique({
            where: { id: deal.offer.userId },
            include: { user: true }
        });
        if (!warrantHolder) return;
        const client = await prisma.user.findUnique({
            where: { id: deal.userId },
            include: {
                wallets: { where: { coin: deal.offer.coin } },
                referrer: true
            }
        });
        if (!warrantHolder || !client) return;

        let recipientAddress: string;
        let txId: string | undefined;

        if (deal.offer.type === "buy") {
            recipientAddress = deal.clientPaymentDetails || client.wallets[0].address;

            txId = await sendP2PTransaction(
                deal.amount,
                deal.offer.coin,
                warrantHolder.id,
                recipientAddress,
                "sell"
            );
        } else {
            recipientAddress = deal.offer.warrantHolderPaymentDetails;

            txId = await sendP2PTransaction(
                deal.amount,
                deal.offer.coin,
                client.id,
                recipientAddress,
                "buy"
            );
        }

        if (!txId) {
            await ctx.reply('Ошибка при выполнении транзакции. Попробуйте снова.');
            return;
        }

        await prisma.deal.update({
            where: { id: deal.id },
            data: { status: 'completed', txId }
        });

        const referralFee = calculateReferralFee(deal.amount, deal.offer.type as 'buy' | 'sell');

        if (referralFee > 0 && client.referrer) {
            await ctx.telegram.sendMessage(
                client.referrer.chatId,
                `Вам начислен реферальный бонус ${referralFee} ${deal.offer.coin} за сделку №${deal.id}!`
            );
        }

        await ctx.editMessageText(`Транзакция отправлена успешно!\nTxID: ${txId}`);
        await ctx.telegram.sendMessage(client.chatId, `Транзакция отправлена успешно!\nTxID: ${txId}`);
        await clearState(ctx.from.id.toString());
    });
}

export async function handleDealsText(ctx: BotContext) {
    if (!ctx.from?.id) return;
    const state = ctx.state;
    const userId = ctx.from.id.toString();

    if (state.action === 'buy_amount') {
        if (!('text' in ctx.message)) return;
        const amount = parseFloat(ctx.message.text);
        if (isNaN(amount)) {
            await ctx.reply('Ошибка: введите корректное число.');
            return;
        }

        const offer = await prisma.offer.findUnique({ where: { id: state.offerId } });
        if (!offer) return;

        if (amount < offer.minDealAmount || amount > offer.maxDealAmount) {
            await ctx.reply(`Ошибка: сумма должна быть в диапазоне ${offer.minDealAmount} - ${offer.maxDealAmount} ${offer.coin}.`);
            return;
        }

        await setState(userId, { amount });

        const totalAmount = await calculateClientTransaction('buy', state.coin, state.fiatCurrency, amount, offer.markupPercent);

        await ctx.reply(
            `Вы покупаете ${amount} ${offer.coin} с наценкой продавца ${offer.markupPercent}%. ` +
            `Итоговая сумма перевода ${totalAmount} ${state.fiatCurrency}. Готовы продолжить?`,
            Markup.inlineKeyboard([
                [Markup.button.callback('Отменить', 'cancel'), Markup.button.callback('Продолжить', 'confirm_buy')],
            ])
        );
    } else if (state.action === 'sell_amount') {
        if (!('text' in ctx.message)) return;
        const amount = parseFloat(ctx.message.text);
        if (isNaN(amount)) {
            await ctx.reply('Ошибка: введите корректное число.');
            return;
        }

        const offer = await prisma.offer.findUnique({ where: { id: state.offerId } });
        if (!offer) return;

        if (amount < offer.minDealAmount || amount > offer.maxDealAmount) {
            await ctx.reply(`Ошибка: сумма должна быть в диапазоне ${offer.minDealAmount} - ${offer.maxDealAmount} ${offer.coin}.`);
            return;
        }

        await setState(userId, { amount });

        const totalAmount = await calculateClientTransaction('sell', state.coin, state.fiatCurrency, amount, offer.markupPercent);

        await ctx.reply(
            `Вы продаете ${amount} ${offer.coin} с наценкой ${offer.markupPercent}%. ` +
            `Вы получите ${totalAmount} ${state.fiatCurrency}. Готовы продолжить?`,
            Markup.inlineKeyboard([
                [Markup.button.callback('Отменить', 'cancel'), Markup.button.callback('Продолжить', 'confirm_sell')],
            ])
        );
    } else if (state.action === 'sell_payment_details') {
        if (!('text' in ctx.message)) return;
        const paymentDetails = ctx.message.text.trim();

        const offer = await prisma.offer.findUnique({
            where: { id: state.offerId },
            include: { warrantHolder: { include: { user: true } } }
        });
        if (!offer) return;

        if (!paymentDetails) {
            await ctx.reply('Ошибка: введите корректные реквизиты.');
            return;
        }

        const client = await prisma.user.findUnique({
            where: { chatId: userId }
        });
        if (!client) return;

        const deal = await prisma.deal.create({
            data: {
                client: { connect: { id: client.id } },
                offer: { connect: { id: offer.id } },
                amount: state.amount,
                markupPercent: offer.markupPercent,
                clientPaymentDetails: paymentDetails,
                fiatCurrency: state.fiatCurrency
            },
        });

        await setState(userId, { dealId: deal.id });

        const totalAmount = await calculateClientTransaction('sell', state.coin, state.fiatCurrency, state.amount, offer.markupPercent);

        await ctx.telegram.sendMessage(
            offer.warrantHolder.user.chatId,
            `Пришла заявка на сделку №${deal.id} на продажу ${state.amount} ${offer.coin}. ` +
            `Реквизиты покупателя: ${paymentDetails}. Переведите ${totalAmount} ${state.fiatCurrency} покупателю и нажмите "Получил и отправил"`,
            Markup.inlineKeyboard([Markup.button.callback('Получил и отправил', `received_${deal.id}`)])
        );

        await ctx.reply('Ожидайте подтверждения продавца');
    } else if (state.action === 'buy_wallet_address') {
        if (!('text' in ctx.message)) return;
        const walletAddress = ctx.message.text.trim();

        const offer = await prisma.offer.findUnique({
            where: { id: state.offerId },
            include: { warrantHolder: { include: { user: true } } }
        });
        if (!offer) return;

        if (!walletAddress) {
            await ctx.reply('Ошибка: введите корректный адрес кошелька.');
            return;
        }

        await setState(userId, { paymentDetails: walletAddress });

        const deal = await prisma.deal.create({
            data: {
                client: { connect: { id: offer.warrantHolder.user.id } },
                offer: { connect: { id: offer.id } },
                amount: state.amount,
                markupPercent: offer.markupPercent,
                clientPaymentDetails: walletAddress,
                fiatCurrency: state.fiatCurrency
            },
        });

        await setState(userId, { dealId: deal.id });

        const totalAmount = await calculateClientTransaction('buy', state.coin, state.fiatCurrency, state.amount, offer.markupPercent);

        await ctx.reply(
            `Реквизиты продавца ${offer.warrantHolderPaymentDetails}. Переведите ${totalAmount} ${state.fiatCurrency} продавцу и нажмите кнопку "Оплатил"`,
            Markup.inlineKeyboard([Markup.button.callback('Оплатил', `paid_${deal.id}`)])
        );
    }
}