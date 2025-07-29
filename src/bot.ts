import { Telegraf, Markup, Context } from 'telegraf';
import { PrismaClient } from '@prisma/client';
import {
    generateBTCWallet,
    generateLTCWallet,
    generateUSDTWallet,
    checkDeposits,
    withdrawToExternalWallet,
    sendP2PTransaction,
    getWalletBalance,
    // generateXMRWallet
} from './wallet';
import { getBlockCypherFees, getCryptoPrice } from './api';
import { encrypt } from './crypto';
import * as dotenv from 'dotenv';
import { getState, setState, clearState, BotState } from './state';
import { calculateUserTransaction, calculateWithdrawal } from './utils';

dotenv.config();

interface BotContext extends Context {
    state: BotState;
}

const prisma = new PrismaClient();

const telegramToken = process.env.TELEGRAM_TOKEN;
if (!telegramToken) throw new Error('Telegram token is missing');

const bot = new Telegraf<BotContext>(telegramToken);
const warrantHolders = JSON.parse(process.env.WARRANT_HOLDERS_IDS || '[]') as string[];

bot.use(async (ctx, next) => {
    const userId = ctx.from?.id.toString();
    if (userId) {
        ctx.state = await getState(userId);
    } else {
        ctx.state = {};
    }
    await next();
});

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
        // const xmrWallet = await generateXMRWallet();

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
                        // { coin: 'XMR', address: xmrWallet.address, privateKey: encrypt(xmrWallet.privateKey), balance: 0, unconfirmedBalance: 0 },
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

bot.hears('Сделки', async (ctx) => {
    await ctx.reply('Какую опцию хотите выбрать?', Markup.inlineKeyboard([
        [Markup.button.callback('Покупка', 'buy'), Markup.button.callback('Продажа', 'sell')],
    ]));
});

bot.hears('Кошельки', async (ctx) => {
    if (!ctx.from?.id) return;
    const userId = ctx.from.id.toString();
    const user = await prisma.user.findUnique({
        where: { chatId: userId },
        include: { wallets: true }
    });
    if (!user) return;

    for (const wallet of user.wallets) {
        const { confirmed, unconfirmed } = await getWalletBalance(wallet.address, wallet.coin, userId);
        await prisma.wallet.update({
            where: { id: wallet.id },
            data: { balance: confirmed, unconfirmedBalance: unconfirmed }
        });
    }

    const updatedUser = await prisma.user.findUnique({
        where: { chatId: userId },
        include: { wallets: true }
    });

    if (!updatedUser) return;

    const walletInfo = await Promise.all(updatedUser.wallets.map(async (wallet) => {
        const pendingTransactions = await prisma.transaction.findMany({
            where: {
                userId: updatedUser.id,
                coin: wallet.coin,
                status: 'pending',
                type: 'buy'
            },
            select: { amount: true }
        });
        const heldAmount = pendingTransactions.reduce((sum, tx) => sum + tx.amount, 0);

        const pendingAmount = wallet.unconfirmedBalance || 0;

        let balanceText = `${wallet.coin} - кошелёк\nАдрес: ${wallet.address}\nБаланс: ${wallet.balance} ${wallet.coin}`;

        const statusParts = [];
        if (pendingAmount > 0) {
            statusParts.push(`на обработке: ${pendingAmount}`);
        }
        if (heldAmount > 0) {
            statusParts.push(`на удержании: ${heldAmount}`);
        }
        if (statusParts.length > 0) {
            balanceText += ` (${statusParts.join(', ')})`;
        }

        return balanceText;
    }));

    await ctx.reply(walletInfo.join('\n\n'));
});

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

bot.action('buy', async (ctx) => {
    await ctx.editMessageText('Какую валюту хотите купить?', Markup.inlineKeyboard([
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

bot.action('sell', async (ctx) => {
    await ctx.editMessageText('Какую валюту хотите продать?', Markup.inlineKeyboard([
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

bot.action(/buy_(BTC|LTC|USDT)/, async (ctx) => {
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
    });

    const totalOffers = await prisma.offer.count({
        where: { coin, type: 'sell' },
    });

    console.log(`Offers found: ${offers.length}, Total offers: ${totalOffers}`);

    const buttons = offers.map((offer, i) => [
        Markup.button.callback(
            `Оферта ${i + 1}: ${offer.amount} ${coin}, ${offer.minDealAmount} - ${offer.maxDealAmount} ${coin}`,
            `select_buy_${offer.id}`
        ),
    ]);

    if (totalOffers > pageSize) {
        buttons.push([Markup.button.callback('>', 'next_buy')]);
    }

    await ctx.editMessageText('Выберите подходящую оферту', Markup.inlineKeyboard(buttons));
});

bot.action(/sell_(BTC|LTC|USDT)/, async (ctx) => {
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
    });

    const totalOffers = await prisma.offer.count({
        where: { coin, type: 'buy' },
    });

    console.log(`Offers found: ${offers.length}, Total offers: ${totalOffers}`);

    const buttons = offers.map((offer, i) => [
        Markup.button.callback(
            `Оферта ${i + 1}: ${offer.minDealAmount} - ${offer.maxDealAmount} ${coin}`,
            `select_sell_${offer.id}`
        ),
    ]);

    if (totalOffers > pageSize) {
        buttons.push([Markup.button.callback('>', 'next_sell')]);
    }

    await ctx.editMessageText('Выберите подходящую оферту', Markup.inlineKeyboard(buttons));
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
    });

    const totalOffers = await prisma.offer.count({
        where: { coin: state.coin, type: 'sell' },
    });

    const buttons = offers.map((offer, i) => [
        Markup.button.callback(
            `Оферта ${i + 1}: ${offer.amount} ${state.coin}, ${offer.minDealAmount} - ${offer.maxDealAmount} ${state.coin}`,
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

    const buttons = offers.map((offer, i) => [
        Markup.button.callback(
            `Оферта ${i + 1}: ${offer.amount} ${state.coin}, ${offer.minDealAmount} - ${offer.maxDealAmount} ${state.coin}`,
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
    });

    const totalOffers = await prisma.offer.count({
        where: { coin: state.coin, type: 'buy' },
    });

    const buttons = offers.map((offer, i) => [
        Markup.button.callback(
            `Оферта ${i + 1}: ${offer.minDealAmount} - ${offer.maxDealAmount} ${state.coin}`,
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

    const buttons = offers.map((offer, i) => [
        Markup.button.callback(
            `Оферта ${i + 1}: ${offer.minDealAmount} - ${offer.maxDealAmount} ${state.coin}`,
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

bot.command('createoffer', async (ctx) => {
    if (!ctx.from?.id) return;
    const userId = ctx.from.id.toString();
    if (!warrantHolders.includes(userId)) {
        await ctx.reply('Только держатели варрантов могут создавать оферты.');
        return;
    }

    const args = ctx.message.text.split(' ').slice(1);
    if (args.length < 5) {
        await ctx.reply('Неверный формат. Используйте: /createoffer <type> <coin> <amount> <minDealAmount> <maxDealAmount> <markupPercent>');
        return;
    }

    const [type, coin, amountStr, minDealAmountStr, maxDealAmountStr, markupPercentStr] = args;
    if (!['sell', 'buy'].includes(type)) {
        await ctx.reply('Тип должен быть buy или sell.');
        return;
    }
    if (!['BTC', 'LTC', 'USDT', 'XMR'].includes(coin)) {
        await ctx.reply('Валюта должна быть BTC, LTC, USDT или XMR.');
        return;
    }
    const amount = parseFloat(amountStr);
    const minDealAmount = parseFloat(minDealAmountStr);
    const maxDealAmount = parseFloat(maxDealAmountStr);
    const markupPercent = parseFloat(markupPercentStr);

    if (isNaN(amount) || isNaN(minDealAmount) || isNaN(maxDealAmount) || isNaN(markupPercent)) {
        await ctx.reply('Количество, минимальная и максимальная суммы сделки, и процент наценки должны быть числами.');
        return;
    }

    if (minDealAmount > maxDealAmount || minDealAmount < 0 || maxDealAmount > amount) {
        await ctx.reply('Неверные параметры: minDealAmount должен быть меньше maxDealAmount, а maxDealAmount не должен превышать amount.');
        return;
    }

    try {
        const offer = await prisma.offer.create({
            data: {
                userId: (await prisma.user.findUnique({ where: { chatId: userId } }))!.id,
                type,
                coin,
                amount,
                minDealAmount,
                maxDealAmount,
                markupPercent,
            },
        });
        await ctx.reply(
            `Оферта №${offer.id} успешно создана! \nТип: ${offer.type} \nВалюта: ${offer.coin} \nСумма: ${offer.amount} \nДиапазон сделки: ${offer.minDealAmount} - ${offer.maxDealAmount} \nНаценка: ${offer.markupPercent}%`
        );
    } catch (error) {
        await ctx.reply('Ошибка при создании оферты. Проверьте данные и попробуйте снова.');
        console.error(error);
    }
});

bot.on('text', async (ctx) => {
    if (!ctx.from?.id) return;
    const state = await getState(ctx.from.id.toString());
    const userId = ctx.from.id.toString();

    if (state.action === 'buy_amount') {
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
        await setState(ctx.from.id.toString(), { amount, platformFee: amount * 0.05 });
    } else if (state.action === 'sell_amount') {
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
    } else if (state.action === 'withdraw_amount') {
        const amount = parseFloat(ctx.message.text);
        if (isNaN(amount)) {
            await ctx.reply('Ошибка: введите корректное число.');
            return;
        }
        await setState(ctx.from.id.toString(), { withdrawAmount: amount });
        await ctx.reply(`Введите адрес своего кошелька ${state.coin}`);
        await setState(ctx.from.id.toString(), { action: 'withdraw_address' });
    } else if (state.action === 'withdraw_address') {
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
});

bot.action('proceed_buy', async (ctx) => {
    if (!ctx.from?.id) return;
    const state = await getState(ctx.from.id.toString());
    const offer = await prisma.offer.findUnique({ where: { id: state.offerId } });
    if (!offer) return;
    const user = await prisma.user.findUnique({ where: { id: offer.userId } });
    if (!user) return;

    const fees = await getBlockCypherFees(offer.coin);
    const txWeight = 150;
    const minerFee = fees.medium_fee * txWeight / 1e8;
    const amount = state.amount || 0;
    const fiatAmount = await getCryptoPrice(offer.coin, amount * (1 + offer.markupPercent / 100));
    const platformFee = amount * 0.05;
    const warrantHolderFee = amount * 0.05;

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
            transactionId: transaction.id
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
    const buyer = await prisma.user.findUnique({ where: { chatId: ctx.from.id.toString() } });
    if (!buyer) return;

    const fees = await getBlockCypherFees(offer.coin);
    const txWeight = 150;
    const minerFee = fees.medium_fee * txWeight / 1e8;
    const amount = state.amount || 0;
    const fiatAmount = await getCryptoPrice(offer.coin, amount);
    const platformFee = amount * 0.05;
    const warrantHolderFee = amount * 0.05;

    const transaction = await prisma.transaction.create({
        data: {
            userId: buyer.id,
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
            transactionId: transaction.id
        }
    });

    await ctx.telegram.sendMessage(
        (await prisma.user.findUnique({ where: { id: offer.userId } }))!.chatId,
        `Пришла оплата сделки на продажу №${deal.id} на сумму ${amount} ${offer.coin}. ` +
        `Реквизиты покупателя ${buyer.username}. Переведите ${fiatAmount} RUB покупателю и нажмите кнопку "Получил и отправил"`,
        Markup.inlineKeyboard([Markup.button.callback('Получил и отправил', `received_${deal.id}`)])
    );
    await ctx.editMessageText('Ожидайте ответ продавца');
});

bot.action(/paid_(\d+)/, async (ctx) => {
    if (!ctx.from?.id) return;
    const dealId = parseInt(ctx.match[1], 10);
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

    await ctx.telegram.sendMessage(
        (await prisma.user.findUnique({ where: { id: deal.offer.userId } }))!.chatId,
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

    const seller = await prisma.user.findUnique({ where: { id: deal.offer.userId } });
    const buyer = await prisma.user.findUnique({ where: { id: deal.userId } });
    if (!seller || !buyer) return;

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

bot.launch();
console.log('Bot started!');