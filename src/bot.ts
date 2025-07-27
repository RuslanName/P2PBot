import { Telegraf, Markup, Context } from 'telegraf';
import { PrismaClient } from '@prisma/client';
import {
    generateBTCWallet,
    generateLTCWallet,
    generateUSDTWallet,
    checkDeposits,
    withdrawToExternalWallet,
    sendP2PTransaction
} from './wallet';
import { getBlockCypherFees, getCryptoPrice } from './api';
import { encrypt } from './crypto';
import * as dotenv from 'dotenv';
import { getState, setState, clearState, BotState } from './state';
import {calculateOrderTransaction, calculateUserTransaction, calculateWithdrawal} from "./utils";

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

    const existingUser = await prisma.user.findUnique({ where: { userId } });
    if (!existingUser) {
        const btcWallet = generateBTCWallet();
        const ltcWallet = generateLTCWallet();
        const usdtWallet = generateUSDTWallet();

        await prisma.user.create({
            data: {
                userId,
                username,
                btcAddress: btcWallet.address,
                ltcAddress: ltcWallet.address,
                usdtAddress: usdtWallet.address,
                btcPrivateKey: encrypt(btcWallet.privateKey),
                ltcPrivateKey: encrypt(ltcWallet.privateKey),
                usdtPrivateKey: encrypt(usdtWallet.privateKey),
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
    const user = await prisma.user.findUnique({ where: { userId } });
    if (!user) return;

    const btcDeposits = await checkDeposits(user.btcAddress, 'BTC', userId);
    const ltcDeposits = await checkDeposits(user.ltcAddress, 'LTC', userId);
    const usdtDeposits = await checkDeposits(user.usdtAddress, 'USDT', userId);

    const updatedUser = await prisma.user.update({
        where: { userId },
        data: {
            btcBalance: btcDeposits.reduce((sum, tx) => sum + tx.amount, user.btcBalance),
            ltcBalance: ltcDeposits.reduce((sum, tx) => sum + tx.amount, user.ltcBalance),
            usdtBalance: usdtDeposits.reduce((sum, tx) => sum + tx.amount, user.usdtBalance),
        },
    });

    await ctx.reply(
        `BTC - кошелёк\nАдрес: ${updatedUser.btcAddress}\nБаланс: ${updatedUser.btcBalance} BTC\n\n` +
        `LTC - кошелёк\nАдрес: ${updatedUser.ltcAddress}\nБаланс: ${updatedUser.ltcBalance} LTC\n\n` +
        `USDT - кошелёк\nАдрес: ${updatedUser.usdtAddress}\nБаланс: ${updatedUser.usdtBalance} USDT`
    );
});

bot.hears('Переводы', async (ctx) => {
    if (!ctx.from?.id) return;
    await ctx.reply('С какого кошелька хотите вывести?', Markup.inlineKeyboard([
        [Markup.button.callback('BTC', 'withdraw_BTC'), Markup.button.callback('LTC', 'withdraw_LTC'), Markup.button.callback('USDT', 'withdraw_USDT')],
        [Markup.button.callback('Отменить', 'cancel')],
    ]));
});

bot.action('buy', async (ctx) => {
    await ctx.editMessageText('Какую валюту хотите купить?', Markup.inlineKeyboard([
        [Markup.button.callback('BTC', 'buy_BTC'), Markup.button.callback('LTC', 'buy_LTC'), Markup.button.callback('USDT', 'buy_USDT')],
        [Markup.button.callback('Отменить', 'cancel')],
    ]));
});

bot.action('sell', async (ctx) => {
    await ctx.editMessageText('Какую валюту хотите продать?', Markup.inlineKeyboard([
        [Markup.button.callback('BTC', 'sell_BTC'), Markup.button.callback('LTC', 'sell_LTC'), Markup.button.callback('USDT', 'sell_USDT')],
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
    const orders = await prisma.order.findMany({
        where: { coin, status: 'open', type: 'sell' },
        take: pageSize,
        skip,
    });

    const totalOrders = await prisma.order.count({
        where: { coin, status: 'open', type: 'sell' },
    });

    console.log(`Orders found: ${orders.length}, Total orders: ${totalOrders}`);

    const buttons = orders.map((order, i) => [
        Markup.button.callback(
            `Сделка ${i + 1}: ${order.amount} ${coin}, ${order.fiatAmount} RUB`,
            `select_buy_${order.id}`
        ),
    ]);

    if (totalOrders > pageSize) {
        buttons.push([Markup.button.callback('>', 'next_buy')]);
    }

    await ctx.editMessageText('Выберите подходящую сделку', Markup.inlineKeyboard(buttons));
});

bot.action(/sell_(BTC|LTC|USDT)/, async (ctx) => {
    const coin = ctx.match[1];
    if (!ctx.from?.id) return;

    const userId = ctx.from.id.toString();
    await setState(userId, { coin, page: 0 });

    const pageSize = 5;
    const skip = 0;
    const orders = await prisma.order.findMany({
        where: { coin, status: 'open', type: 'buy' },
        take: pageSize,
        skip,
    });

    const totalOrders = await prisma.order.count({
        where: { coin, status: 'open', type: 'buy' },
    });

    console.log(`Orders found: ${orders.length}, Total orders: ${totalOrders}`);

    const buttons = orders.map((order, i) => [
        Markup.button.callback(
            `Сделка ${i + 1}: ${order.fiatAmount} RUB, ${order.amount} ${coin}`,
            `select_sell_${order.id}`
        ),
    ]);

    if (totalOrders > pageSize) {
        buttons.push([Markup.button.callback('>', 'next_sell')]);
    }

    await ctx.editMessageText('Выберите подходящую сделку', Markup.inlineKeyboard(buttons));
});

bot.action(/withdraw_(BTC|LTC|USDT)/, async (ctx) => {
    const coin = ctx.match[1];
    if (!ctx.from?.id) return;
    const userId = ctx.from.id.toString();
    const user = await prisma.user.findUnique({ where: { userId } });
    if (!user) {
        await ctx.editMessageText('Ошибка: пользователь не найден', Markup.inlineKeyboard([]));
        return;
    }

    const balance = coin === 'BTC' ? user.btcBalance :
        coin === 'LTC' ? user.ltcBalance :
            user.usdtBalance;

    const platformFeePercent = parseFloat(process.env.PLATFORM_WITHDRAW_FEE_PERCENT || '5');

    await setState(userId, { coin, action: 'withdraw_amount' });
    await ctx.editMessageText(
        `Сколько ${coin} хотите вывести? На вашем кошельке сейчас ${balance} ${coin}. Комиссия платформы за вывод ${platformFeePercent}%`,
        { reply_markup: { inline_keyboard: [] } }
    );
});

bot.action(/select_buy_(\d+)/, async (ctx) => {
    const orderId = parseInt(ctx.match[1], 10);
    if (!ctx.from?.id) return;
    await setState(ctx.from.id.toString(), { orderId, action: 'buy_amount' });
    const state = await getState(ctx.from.id.toString());
    if (!state.coin) return;
    await ctx.editMessageText(`Сколько ${state.coin} хотите приобрести?`, { reply_markup: { inline_keyboard: [] } });
});

bot.action(/select_sell_(\d+)/, async (ctx) => {
    const orderId = parseInt(ctx.match[1], 10);
    if (!ctx.from?.id) return;
    await setState(ctx.from.id.toString(), { orderId, action: 'sell_amount' });
    const state = await getState(ctx.from.id.toString());
    if (!state.coin) return;
    await ctx.editMessageText(`Сколько ${state.coin} хотите продать?`, { reply_markup: { inline_keyboard: [] } });
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
    const orders = await prisma.order.findMany({
        where: { coin: state.coin, status: 'open', type: 'sell' },
        take: pageSize,
        skip,
    });

    const totalOrders = await prisma.order.count({
        where: { coin: state.coin, status: 'open', type: 'sell' },
    });

    const buttons = orders.map((order, i) => [
        Markup.button.callback(
            `Сделка ${i + 1}: ${order.amount} ${state.coin}, ${order.fiatAmount} RUB`,
            `select_buy_${order.id}`
        ),
    ]);

    const totalPages = Math.ceil(totalOrders / pageSize);
    const currentPage = page;

    // Определяем кнопки навигации
    if (totalOrders > pageSize) {
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

    await ctx.editMessageText('Выберите подходящую сделку', Markup.inlineKeyboard(buttons));
});

bot.action('next_buy', async (ctx) => {
    if (!ctx.from?.id) return;
    const userId = ctx.from.id.toString();
    const state = await getState(userId);
    if (!state.coin) return;

    const page = (state.page || 0) + 1;
    const pageSize = 5;
    const skip = page * pageSize;

    const orders = await prisma.order.findMany({
        where: { coin: state.coin, status: 'open', type: 'sell' },
        take: pageSize,
        skip,
    });

    const totalOrders = await prisma.order.count({
        where: { coin: state.coin, status: 'open', type: 'sell' },
    });

    if (orders.length === 0) {
        await setState(userId, { page: page - 1 });
        await ctx.editMessageText('Нет доступных сделок на этой странице', Markup.inlineKeyboard([]));
        return;
    }

    await setState(userId, { page });

    const buttons = orders.map((order, i) => [
        Markup.button.callback(
            `Сделка ${i + 1}: ${order.amount} ${state.coin}, ${order.fiatAmount} RUB`,
            `select_buy_${order.id}`
        ),
    ]);

    const totalPages = Math.ceil(totalOrders / pageSize);
    const currentPage = page;

    if (totalOrders > pageSize) {
        if (currentPage === totalPages - 1) {
            buttons.push([Markup.button.callback('<', 'prev_buy')]);
        } else {
            buttons.push([
                Markup.button.callback('<', 'prev_buy'),
                Markup.button.callback('>', 'next_buy'),
            ]);
        }
    }

    await ctx.editMessageText('Выберите подходящую сделку', Markup.inlineKeyboard(buttons));
});

bot.action('next_buy', async (ctx) => {
    if (!ctx.from?.id) return;
    const userId = ctx.from.id.toString();
    const state = await getState(userId);
    if (!state.coin) return;

    const page = (state.page || 0) + 1;
    const pageSize = 5;
    const skip = page * pageSize;

    const orders = await prisma.order.findMany({
        where: { coin: state.coin, status: 'open', type: 'buy' },
        take: pageSize,
        skip,
    });

    const totalOrders = await prisma.order.count({
        where: { coin: state.coin, status: 'open', type: 'buy' },
    });

    if (orders.length === 0) {
        await setState(userId, { page: page - 1 });
        await ctx.editMessageText('Нет доступных сделок на этой странице', Markup.inlineKeyboard([]));
        return;
    }

    await setState(userId, { page });

    const buttons = orders.map((order, i) => [
        Markup.button.callback(
            `Сделка ${i + 1}: ${order.amount} ${state.coin}, ${order.fiatAmount} RUB`,
            `select_buy_${order.id}`
        ),
    ]);

    if (totalOrders > pageSize) {
        buttons.push([
            Markup.button.callback('<', 'prev_buy'),
            Markup.button.callback('>', 'next_buy'),
        ]);
    }

    await ctx.editMessageText('Выберите подходящую сделку', Markup.inlineKeyboard(buttons));
});

bot.action('next_buy', async (ctx) => {
    if (!ctx.from?.id) return;
    const userId = ctx.from.id.toString();
    const state = await getState(userId);
    if (!state.coin) return;

    const page = (state.page || 0) + 1;
    const pageSize = 5;
    const skip = page * pageSize;

    const orders = await prisma.order.findMany({
        where: { coin: state.coin, status: 'open', type: 'buy' },
        take: pageSize,
        skip,
    });

    const totalOrders = await prisma.order.count({
        where: { coin: state.coin, status: 'open', type: 'buy' },
    });

    if (orders.length === 0) {
        await setState(userId, { page: page - 1 });
        await ctx.editMessageText('Нет доступных сделок на этой странице', Markup.inlineKeyboard([]));
        return;
    }

    await setState(userId, { page });

    const buttons = orders.map((order, i) => [
        Markup.button.callback(
            `Сделка ${i + 1}: ${order.amount} ${state.coin}, ${order.fiatAmount} RUB`,
            `select_buy_${order.id}`
        ),
    ]);

    if (totalOrders > pageSize) {
        buttons.push([
            Markup.button.callback('<', 'prev_buy'),
            Markup.button.callback('>', 'next_buy'),
        ]);
    }

    await ctx.editMessageText('Выберите подходящую сделку', Markup.inlineKeyboard(buttons));
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
    const orders = await prisma.order.findMany({
        where: { coin: state.coin, status: 'open', type: 'buy' },
        take: pageSize,
        skip,
    });

    const totalOrders = await prisma.order.count({
        where: { coin: state.coin, status: 'open', type: 'buy' },
    });

    const buttons = orders.map((order, i) => [
        Markup.button.callback(
            `Сделка ${i + 1}: ${order.fiatAmount} RUB, ${order.amount} ${state.coin}`,
            `select_sell_${order.id}`
        ),
    ]);

    const totalPages = Math.ceil(totalOrders / pageSize);
    const currentPage = page;

    if (totalOrders > pageSize) {
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

    await ctx.editMessageText('Выберите подходящую сделку', Markup.inlineKeyboard(buttons));
});

bot.action('next_sell', async (ctx) => {
    if (!ctx.from?.id) return;
    const userId = ctx.from.id.toString();
    const state = await getState(userId);
    if (!state.coin) return;

    const page = (state.page || 0) + 1;
    const pageSize = 5;
    const skip = page * pageSize;

    const orders = await prisma.order.findMany({
        where: { coin: state.coin, status: 'open', type: 'buy' },
        take: pageSize,
        skip,
    });

    const totalOrders = await prisma.order.count({
        where: { coin: state.coin, status: 'open', type: 'buy' },
    });

    if (orders.length === 0) {
        await setState(userId, { page: page - 1 });
        await ctx.editMessageText('Нет доступных сделок на этой странице', Markup.inlineKeyboard([]));
        return;
    }

    await setState(userId, { page });

    const buttons = orders.map((order, i) => [
        Markup.button.callback(
            `Сделка ${i + 1}: ${order.fiatAmount} RUB, ${order.amount} ${state.coin}`,
            `select_sell_${order.id}`
        ),
    ]);

    const totalPages = Math.ceil(totalOrders / pageSize);
    const currentPage = page;

    if (totalOrders > pageSize) {
        if (currentPage === totalPages - 1) {
            buttons.push([Markup.button.callback('<', 'prev_sell')]);
        } else {
            buttons.push([
                Markup.button.callback('<', 'prev_sell'),
                Markup.button.callback('>', 'next_sell'),
            ]);
        }
    }

    await ctx.editMessageText('Выберите подходящую сделку', Markup.inlineKeyboard(buttons));
});

bot.action('next_sell', async (ctx) => {
    if (!ctx.from?.id) return;
    const userId = ctx.from.id.toString();
    const state = await getState(userId);
    if (!state.coin) return;

    const page = (state.page || 0) + 1;
    const pageSize = 5;
    const skip = page * pageSize;

    const orders = await prisma.order.findMany({
        where: { coin: state.coin, status: 'open', type: 'sell' },
        take: pageSize,
        skip,
    });

    const totalOrders = await prisma.order.count({
        where: { coin: state.coin, status: 'open', type: 'sell' },
    });

    if (orders.length === 0) {
        await setState(userId, { page: page - 1 });
        await ctx.editMessageText('Нет доступных сделок на этой странице', Markup.inlineKeyboard([]));
        return;
    }

    await setState(userId, { page });

    const buttons = orders.map((order, i) => [
        Markup.button.callback(
            `Сделка ${i + 1}: ${order.fiatAmount} RUB, ${order.amount} ${state.coin}`,
            `select_sell_${order.id}`
        ),
    ]);

    if (totalOrders > pageSize) {
        buttons.push([
            Markup.button.callback('<', 'prev_sell'),
            Markup.button.callback('>', 'next_sell'),
        ]);
    }

    await ctx.editMessageText('Выберите подходящую сделку', Markup.inlineKeyboard(buttons));
});

bot.action('cancel', async (ctx) => {
    if (!ctx.from?.id) return;
    await ctx.editMessageText('Действие отменено', Markup.inlineKeyboard([]));
    await clearState(ctx.from.id.toString());
});

bot.command('createorder', async (ctx) => {
    if (!ctx.from?.id) return;
    const userId = ctx.from.id.toString();
    if (!warrantHolders.includes(userId)) {
        return;
    }

    const args = ctx.message.text.split(' ').slice(1);
    if (args.length < 4) {
        await ctx.reply('Неверный формат.');
        return;
    }

    const [type, coin, amountStr, markupPercentStr] = [...args];
    if (!['sell', 'buy'].includes(type)) {
        await ctx.reply('Тип должен быть buy или sell.');
        return;
    }
    if (!['BTC', 'LTC', 'USDT'].includes(coin)) {
        await ctx.reply('Валюта должна быть BTC, LTC или USDT.');
        return;
    }
    const amount = parseFloat(amountStr);
    const markupPercent = parseFloat(markupPercentStr);
    if (isNaN(amount) || isNaN(markupPercent)) {
        await ctx.reply('Количество и процент наценки должны быть числами.');
        return;
    }

    try {
        const fees = await getBlockCypherFees(coin);
        const totalAmount = amount * (1 + markupPercent / 100);
        const fiatAmount = await getCryptoPrice(coin, totalAmount);
        const order = await prisma.order.create({
            data: {
                userId,
                type,
                coin,
                amount,
                fiatAmount,
                markupPercent,
                minerFee: fees.medium_fee,
            },
        });
        await ctx.reply(`Заказ №${order.id} успешно создан! \nТип: ${order.type} \nСумма: ${order.amount} ${order.coin} ~ ${order.fiatAmount} RUB \nНаценка: ${order.markupPercent}%`);
    } catch (error) {
        await ctx.reply('Ошибка при создании заказа. Проверьте данные и попробуйте снова.');
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

        const order = await prisma.order.findUnique({ where: { id: state.orderId } });
        if (!order || order.type !== 'sell') return;

        const { totalAmount, currency } = await calculateUserTransaction('buy', amount, order);

        await ctx.reply(
            `Вы покупаете ${amount} ${order.coin} с наценкой продавца ${order.markupPercent}%. ` +
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

        const order = await prisma.order.findUnique({ where: { id: state.orderId } });
        if (!order || order.type !== 'buy') return;

        const { totalAmount, currency } = await calculateUserTransaction('sell', amount, order);
        const fiatAmount = await getCryptoPrice(order.coin, amount);

        await ctx.reply(
            `Вы продаете ${amount} ${order.coin} с наценкой ${order.markupPercent}%. ` +
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
            where: { userId }
        });
        if (!user) {
            await ctx.reply('Ошибка: пользователь не найден');
            return;
        }

        const balance = coin === 'BTC' ? user.btcBalance :
            coin === 'LTC' ? user.ltcBalance :
                user.usdtBalance;

        if (amount > balance) {
            await ctx.reply(`Недостаточно средств. Ваш баланс: ${balance} ${coin}`);
            return;
        }

        const netAmount = calculateWithdrawal(amount);

        const txId = await withdrawToExternalWallet(
            coin,
            amount,
            ctx.from.id.toString(),
            address
        );

        if (!txId) {
            await ctx.reply('Ошибка при выводе средств');
            return;
        }

        const updateData = coin === 'BTC' ? { btcBalance: balance - amount } :
            coin === 'LTC' ? { ltcBalance: balance - amount } :
                { usdtBalance: balance - amount };

        await prisma.user.update({
            where: { userId },
            data: updateData
        });

        await prisma.transaction.create({
            data: {
                userId,
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
    const order = await prisma.order.findUnique({ where: { id: state.orderId } });
    if (!order) return;
    const user = await prisma.user.findUnique({ where: { userId: order.userId } });
    if (!user) return;
    await prisma.order.update({ where: { id: state.orderId }, data: { buyerId: ctx.from.id.toString(), status: 'pending' } });
    const netAmount = await calculateOrderTransaction('buy', order);
    await ctx.editMessageText(
        `Реквизиты продавца ${user.username}. Переведите ${netAmount} RUB продавцу и нажмите кнопку "Оплатил"`,
        Markup.inlineKeyboard([Markup.button.callback('Оплатил', 'paid')])
    );
});

bot.action('proceed_sell', async (ctx) => {
    if (!ctx.from?.id) return;
    const state = await getState(ctx.from.id.toString());
    const order = await prisma.order.findUnique({ where: { id: state.orderId } });
    if (!order) return;
    const buyer = await prisma.user.findUnique({ where: { userId: ctx.from.id.toString() } });
    if (!buyer) return;
    await prisma.order.update({ where: { id: state.orderId }, data: { buyerId: ctx.from.id.toString(), status: 'pending' } });
    const fees = await getBlockCypherFees(order.coin);
    const txWeight = 150;
    const minerFee = fees.medium_fee * txWeight / 1e8;
    const amount = state.amount
    if (!amount) return;
    const totalAmount = amount * (1 + order.markupPercent / 100) + minerFee;
    const fiatAmount = await getCryptoPrice(order.coin, amount);
    await ctx.telegram.sendMessage(
        order.userId,
        `Пришла оплата сделки на продажу №${order.id} на сумму ${totalAmount} ${order.coin}. ` +
        `Реквизиты покупателя ${buyer.username}. Переведите ${fiatAmount} RUB покупателю и нажмите кнопку "Получил и отправил"`,
        Markup.inlineKeyboard([Markup.button.callback('Получил и отправил', 'received')])
    );
    await ctx.editMessageText('Ожидайте ответ продавца');
});

bot.action('paid', async (ctx) => {
    if (!ctx.from?.id) return;
    const state = await getState(ctx.from.id.toString());
    const order = await prisma.order.findUnique({ where: { id: state.orderId } });
    if (!order) return;
    await ctx.editMessageText('Ожидайте ответ продавца');
    const fees = await getBlockCypherFees(order.coin);
    const txWeight = 150;
    const minerFee = fees.medium_fee * txWeight / 1e8;
    const amount = state.amount
    if (!amount) return;
    const totalAmount = amount * (1 + order.markupPercent / 100) + minerFee;
    const fiatAmount = await getCryptoPrice(order.coin, totalAmount);
    await ctx.telegram.sendMessage(
        order.userId,
        `Пришла оплата сделки на покупку №${order.id} на сумму ${fiatAmount} RUB. Убедитесь в этом и нажмите кнопку "Получил"`,
        Markup.inlineKeyboard([Markup.button.callback('Получил', 'received')])
    );
});

bot.action('received', async (ctx) => {
    if (!ctx.from?.id) return;
    const state = await getState(ctx.from.id.toString());
    const order = await prisma.order.findUnique({ where: { id: state.orderId } });
    if (!order || !order.buyerId) return;

    const seller = await prisma.user.findUnique({ where: { userId: order.userId } });
    const buyer = await prisma.user.findUnique({ where: { userId: order.buyerId } });
    if (!seller || !buyer) return;

    const platformFee = state.platformFee || 0;
    const buyerAmount = state.amount || 0;
    const sellerAmount = buyerAmount * (1 + order.markupPercent / 100);

    const txId = await sendP2PTransaction(
        order.coin,
        state.amount || 0,
        order.userId,
        order.buyerId
    );

    if (!txId) {
        await ctx.reply('Ошибка при выполнении транзакции. Попробуйте снова.');
        return;
    }

    const updateSellerBalance = {
        btcBalance: order.coin === 'BTC' ? seller.btcBalance - sellerAmount : seller.btcBalance,
        ltcBalance: order.coin === 'LTC' ? seller.ltcBalance - sellerAmount : seller.ltcBalance,
        usdtBalance: order.coin === 'USDT' ? seller.usdtBalance - sellerAmount : seller.usdtBalance
    };

    const updateBuyerBalance = {
        btcBalance: order.coin === 'BTC' ? buyer.btcBalance + buyerAmount : buyer.btcBalance,
        ltcBalance: order.coin === 'LTC' ? buyer.ltcBalance + buyerAmount : buyer.ltcBalance,
        usdtBalance: order.coin === 'USDT' ? buyer.usdtBalance + buyerAmount : buyer.usdtBalance
    };

    await prisma.user.update({ where: { userId: order.userId }, data: updateSellerBalance });
    await prisma.user.update({ where: { userId: order.buyerId }, data: updateBuyerBalance });

    await prisma.order.update({
        where: { id: state.orderId },
        data: { status: 'completed', buyerConfirmed: true }
    });

    await prisma.transaction.createMany({
        data: [
            {
                userId: order.buyerId,
                coin: order.coin,
                txId,
                amount: buyerAmount,
                type: 'buy',
                status: 'completed'
            },
            {
                userId: order.userId,
                coin: order.coin,
                txId: `fee_${Date.now()}`,
                amount: platformFee,
                type: 'fee',
                status: 'completed'
            }
        ]
    });

    await ctx.editMessageText('Транзакция прошла успешно!');
    await ctx.telegram.sendMessage(order.buyerId, 'Транзакция прошла успешно!');
    await clearState(ctx.from.id.toString());
});

bot.launch();
console.log('Bot started!');