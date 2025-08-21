import {Markup, Telegraf} from 'telegraf';
import {PrismaClient} from '@prisma/client';
import {BotContext} from '../bot';
import {clearState, getState, setState} from '../state';
import {calculateClientTransaction, calculateReferralFee} from '../../utils/calculateTransaction';
import {sendP2PTransaction} from "../../wallet/transaction";
import {config} from "../../config/env";
import {checkAmlLimits} from "../../utils/amlCheck";
import {getWalletBalance} from "../../wallet/balance";

const prisma = new PrismaClient();

export function handleDeals(bot: Telegraf<BotContext>) {
    bot.hears('💰 Обмен', async (ctx) => {
        await ctx.reply('Какую опцию хотите выбрать?', Markup.inlineKeyboard([
            [Markup.button.callback('Покупка', 'buy'), Markup.button.callback('Продажа', 'sell')],
            [Markup.button.callback('Отменить', 'cancel')],
        ]));
    });

    bot.action('buy', async (ctx) => {
        await ctx.editMessageText('Какую валюту хотите купить?', Markup.inlineKeyboard([
            [
                Markup.button.callback('BTC', 'buy_BTC'),
                Markup.button.callback('LTC', 'buy_LTC'),
            ],
            [
                Markup.button.callback('USDT TRC20', 'buy_USDT'),
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
                Markup.button.callback('USDT TRC20', 'sell_USDT'),
            ],
            [Markup.button.callback('Отменить', 'cancel')],
        ]));
    });

    bot.action(/buy_(BTC|LTC|USDT)/, async (ctx) => {
        const coin = ctx.match[1];
        if (!ctx.from?.id) return;

        const userId = ctx.from.id.toString();
        const user = await prisma.user.findUnique({ where: { chatId: userId } });
        if (!user?.fiatCurrency) return;

        await setState(userId, { coin, action: 'buy', fiatCurrency: user.fiatCurrency, page: 0 });

        const pageSize = 5;
        const skip = 0;

        const offers = await prisma.offer.findMany({
            where: {
                coin,
                type: 'buy',
                fiatCurrency: { has: user.fiatCurrency },
                status: 'open',
            },
            include: {
                warrantHolder: {
                    include: {
                        user: {
                            include: {
                                wallets: {
                                    where: {
                                        coin,
                                    },
                                },
                            },
                        },
                    },
                },
            },
        });

        const filteredOffers = offers.filter((offer) =>
            offer.warrantHolder.user.wallets.some((wallet) => wallet.balance >= offer.maxDealAmount)
        );

        const totalFilteredOffers = filteredOffers.length;
        const paginatedOffers = filteredOffers.slice(skip, skip + pageSize);

        if (paginatedOffers.length === 0) {
            await ctx.editMessageText('Нет доступных оферт', Markup.inlineKeyboard([]));
            return;
        }

        const buttons = paginatedOffers.map((offer) => [
            Markup.button.callback(
                `${offer.warrantHolder.user.username || 'Неизвестно'}: ${offer.minDealAmount} - ${offer.maxDealAmount} ${coin}`,
                `select_buy_${offer.id}`
            ),
        ]);

        if (totalFilteredOffers > pageSize) {
            buttons.push([Markup.button.callback('Вперед ▶️', 'next_buy')]);
        }

        buttons.push([Markup.button.callback('Отменить', 'cancel')]);

        await ctx.editMessageText(
            `Выберите подходящую оферту\nСтраница 1 из ${Math.ceil(totalFilteredOffers / pageSize)}`,
            Markup.inlineKeyboard(buttons)
        );
    });

    bot.action(/sell_(BTC|LTC|USDT)/, async (ctx) => {
        const coin = ctx.match[1];
        if (!ctx.from?.id) return;

        const userId = ctx.from.id.toString();
        const user = await prisma.user.findUnique({ where: { chatId: userId } });
        if (!user?.fiatCurrency) return;

        await setState(userId, { coin, action: 'sell', fiatCurrency: user.fiatCurrency, page: 0 });

        const pageSize = 5;
        const skip = 0;

        const offers = await prisma.offer.findMany({
            where: {
                coin,
                type: 'sell',
                fiatCurrency: { has: user.fiatCurrency },
                status: 'open',
            },
            include: {
                warrantHolder: {
                    include: {
                        user: true,
                    },
                },
            },
        });

        const totalOffers = offers.length;
        const paginatedOffers = offers.slice(skip, skip + pageSize);

        if (paginatedOffers.length === 0) {
            await ctx.editMessageText('Нет доступных оферт', Markup.inlineKeyboard([]));
            return;
        }

        const buttons = paginatedOffers.map((offer) => [
            Markup.button.callback(
                `${offer.warrantHolder.user.username || 'Неизвестно'}: ${offer.minDealAmount} - ${offer.maxDealAmount} ${coin}`,
                `select_sell_${offer.id}`
            ),
        ]);

        if (totalOffers > pageSize) {
            buttons.push([Markup.button.callback('Вперед ▶️', 'next_sell')]);
        }

        buttons.push([Markup.button.callback('Отменить', 'cancel')]);

        await ctx.editMessageText(
            `Выберите подходящую оферту\nСтраница 1 из ${Math.ceil(totalOffers / pageSize)}`,
            Markup.inlineKeyboard(buttons)
        );
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
                status: 'open',
            },
            include: {
                warrantHolder: {
                    include: {
                        user: {
                            include: {
                                wallets: {
                                    where: {
                                        coin: state.coin,
                                    },
                                },
                            },
                        },
                    },
                },
            },
        });

        const filteredOffers = offers.filter((offer) =>
            offer.warrantHolder.user.wallets.some((wallet) => wallet.balance >= offer.maxDealAmount)
        );

        const totalFilteredOffers = filteredOffers.length;
        const paginatedOffers = filteredOffers.slice(skip, skip + pageSize);

        if (paginatedOffers.length === 0) {
            await ctx.editMessageText('Нет доступных оферт', Markup.inlineKeyboard([]));
            return;
        }

        const buttons = paginatedOffers.map((offer) => [
            Markup.button.callback(
                `${offer.warrantHolder.user.username || 'Неизвестно'}: ${offer.minDealAmount} - ${offer.maxDealAmount} ${state.coin}`,
                `select_buy_${offer.id}`
            ),
        ]);

        const totalPages = Math.ceil(totalFilteredOffers / pageSize);
        const currentPage = page;

        if (totalFilteredOffers > pageSize) {
            if (currentPage === 0) {
                buttons.push([Markup.button.callback('Вперед ▶️', 'next_buy')]);
            } else if (currentPage === totalPages - 1) {
                buttons.push([Markup.button.callback('◀️ Назад', 'prev_buy')]);
            } else {
                buttons.push([
                    Markup.button.callback('◀️ Назад', 'prev_buy'),
                    Markup.button.callback('Вперед ▶️', 'next_buy'),
                ]);
            }
        }

        buttons.push([Markup.button.callback('Отменить', 'cancel')]);

        await ctx.editMessageText(
            `Выберите подходящую оферту\nСтраница ${currentPage + 1} из ${totalPages}`,
            Markup.inlineKeyboard(buttons)
        );
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
                status: 'open',
            },
            include: {
                warrantHolder: {
                    include: {
                        user: {
                            include: {
                                wallets: {
                                    where: {
                                        coin: state.coin,
                                    },
                                },
                            },
                        },
                    },
                },
            },
        });

        const filteredOffers = offers.filter((offer) =>
            offer.warrantHolder.user.wallets.some((wallet) => wallet.balance >= offer.maxDealAmount)
        );

        const totalFilteredOffers = filteredOffers.length;
        const paginatedOffers = filteredOffers.slice(skip, skip + pageSize);

        if (paginatedOffers.length === 0) {
            await setState(userId, { page: page - 1 });
            await ctx.editMessageText('Нет доступных оферт на этой странице', Markup.inlineKeyboard([]));
            return;
        }

        await setState(userId, { page });

        const buttons = paginatedOffers.map((offer) => [
            Markup.button.callback(
                `${offer.warrantHolder.user.username || 'Неизвестно'}: ${offer.minDealAmount} - ${offer.maxDealAmount} ${state.coin}`,
                `select_buy_${offer.id}`
            ),
        ]);

        const totalPages = Math.ceil(totalFilteredOffers / pageSize);

        if (totalFilteredOffers > pageSize) {
            if (page === totalPages - 1) {
                buttons.push([Markup.button.callback('◀️ Назад', 'prev_buy')]);
            } else {
                buttons.push([
                    Markup.button.callback('◀️ Назад', 'prev_buy'),
                    Markup.button.callback('Вперед ▶️', 'next_buy'),
                ]);
            }
        }

        buttons.push([Markup.button.callback('Отменить', 'cancel')]);

        await ctx.editMessageText(
            `Выберите подходящую оферту\nСтраница ${page + 1} из ${totalPages}`,
            Markup.inlineKeyboard(buttons)
        );
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
                status: 'open',
            },
            include: {
                warrantHolder: {
                    include: {
                        user: true,
                    },
                },
            },
        });

        const totalOffers = offers.length;
        const paginatedOffers = offers.slice(skip, skip + pageSize);

        if (paginatedOffers.length === 0) {
            await ctx.editMessageText('Нет доступных оферт', Markup.inlineKeyboard([]));
            return;
        }

        const buttons = paginatedOffers.map((offer) => [
            Markup.button.callback(
                `${offer.warrantHolder.user.username || 'Неизвестно'}: ${offer.minDealAmount} - ${offer.maxDealAmount} ${state.coin}`,
                `select_sell_${offer.id}`
            ),
        ]);

        const totalPages = Math.ceil(totalOffers / pageSize);
        const currentPage = page;

        if (totalOffers > pageSize) {
            if (currentPage === 0) {
                buttons.push([Markup.button.callback('Вперед ▶️', 'next_sell')]);
            } else if (currentPage === totalPages - 1) {
                buttons.push([Markup.button.callback('◀️ Назад', 'prev_sell')]);
            } else {
                buttons.push([
                    Markup.button.callback('◀️ Назад', 'prev_sell'),
                    Markup.button.callback('Вперед ▶️', 'next_sell'),
                ]);
            }
        }

        buttons.push([Markup.button.callback('Отменить', 'cancel')]);

        await ctx.editMessageText(
            `Выберите подходящую оферту\nСтраница ${currentPage + 1} из ${totalPages}`,
            Markup.inlineKeyboard(buttons)
        );
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
                status: 'open',
            },
            include: {
                warrantHolder: {
                    include: {
                        user: true,
                    },
                },
            },
        });

        const totalOffers = offers.length;
        const paginatedOffers = offers.slice(skip, skip + pageSize);

        if (paginatedOffers.length === 0) {
            await setState(userId, { page: page - 1 });
            await ctx.editMessageText('Нет доступных оферт на этой странице', Markup.inlineKeyboard([]));
            return;
        }

        await setState(userId, { page });

        const buttons = paginatedOffers.map((offer) => [
            Markup.button.callback(
                `${offer.warrantHolder.user.username || 'Неизвестно'}: ${offer.minDealAmount} - ${offer.maxDealAmount} ${state.coin}`,
                `select_sell_${offer.id}`
            ),
        ]);

        const totalPages = Math.ceil(totalOffers / pageSize);

        if (totalOffers > pageSize) {
            if (page === totalPages - 1) {
                buttons.push([Markup.button.callback('◀️ Назад', 'prev_sell')]);
            } else {
                buttons.push([
                    Markup.button.callback('◀️ Назад', 'prev_sell'),
                    Markup.button.callback('Вперед ▶️', 'next_sell'),
                ]);
            }
        }

        buttons.push([Markup.button.callback('Отменить', 'cancel')]);

        await ctx.editMessageText(
            `Выберите подходящую оферту\nСтраница ${page + 1} из ${totalPages}`,
            Markup.inlineKeyboard(buttons)
        );
    });

    bot.action(/select_buy_(\d+)/, async (ctx) => {
        if (!ctx.from?.id) return;
        const offerId = parseInt(ctx.match[1], 10);
        const userId = ctx.from.id.toString();
        const state = await getState(userId);
        if (!state.coin || !state.fiatCurrency) return;

        const offer = await prisma.offer.findUnique({ where: { id: offerId } });
        if (!offer) return;

        await setState(userId, { offerId, action: 'buy_amount' });

        await ctx.editMessageText(
            `Введите сумму в ${state.coin}, которую хотите купить (${offer.minDealAmount} - ${offer.maxDealAmount} ${state.coin})`,
            Markup.inlineKeyboard([[Markup.button.callback('Отменить', 'cancel')]])
        );
    });

    bot.action(/select_sell_(\d+)/, async (ctx) => {
        if (!ctx.from?.id) return;
        const offerId = parseInt(ctx.match[1], 10);
        const userId = ctx.from.id.toString();
        const state = await getState(userId);
        if (!state.coin || !state.fiatCurrency) return;

        const offer = await prisma.offer.findUnique({
            where: { id: offerId },
            include: { warrantHolder: { include: { user: true } } }
        });
        if (!offer) return;

        const userBalance = await getWalletBalance(ctx.from.id, state.coin, false);
        if (userBalance.confirmed < offer.minDealAmount) {
            await ctx.editMessageText('Ваш баланс слишком мал для совершения обмена', Markup.inlineKeyboard([]));
            return;
        }

        await setState(userId, { offerId, action: 'sell_amount' });

        await ctx.editMessageText(
            `Введите сумму в ${state.coin}, которую хотите продать (${offer.minDealAmount} - ${offer.maxDealAmount} ${state.coin})`,
            Markup.inlineKeyboard([[Markup.button.callback('Отменить', 'cancel')]])
        );
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
            Markup.inlineKeyboard([
                [Markup.button.callback('Отменить', 'cancel')]
            ])
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

        const balance = await getWalletBalance(offer.warrantHolder.user.id, offer.coin, true);
        const totalAmount = await calculateClientTransaction('buy', state.coin, state.fiatCurrency, state.amount, offer.markupPercent);
        if (balance.confirmed < totalAmount) {
            await ctx.reply('Обмен не был создан. Баланс ордеродержателя меньше необходимого');
            return;
        }

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

        const index = offer.fiatCurrency.indexOf(deal.fiatCurrency);

        await ctx.editMessageText(
            `Обмен №${deal.id} создан. Реквизиты продавца ${offer.warrantHolderPaymentDetails[index]}. Переведите ${totalAmount} ${state.fiatCurrency} продавцу и нажмите кнопку "Оплатил"`,
            Markup.inlineKeyboard([
                [Markup.button.callback('Оплатил', `paid_${deal.id}`)],
                [Markup.button.callback('Написать ордеродержателю', `chat_to_warrant_${deal.id}`)],
                [Markup.button.callback('Отменить', 'cancel')]
            ])
        );
    });

    bot.action('own_wallet', async (ctx) => {
        if (!ctx.from?.id) return;
        const state = await getState(ctx.from.id.toString());
        await setState(ctx.from.id.toString(), { action: 'buy_wallet_address' });
        await ctx.editMessageText(
            `Введите адрес своего ${state.coin} кошелька. Вводите внимательно!`,
            Markup.inlineKeyboard([
                [Markup.button.callback('Отменить', 'cancel')]
            ])
        );
    });

    bot.action(/paid_(\d+)/, async (ctx) => {
        if (!ctx.from?.id) return;
        const dealId = parseInt(ctx.match[1], 10);

        const deal = await prisma.deal.findUnique({
            where: { id: dealId },
            include: { offer: { include: { warrantHolder: { include: { user: true } } } } }
        });

        if (!deal) return;

        if (deal.status === 'expired') {
            await ctx.editMessageText('Время обмена истекло', Markup.inlineKeyboard([]));
            return;
        }

        if (deal.status === 'blocked') {
            await ctx.editMessageText('Данный обмен в данный момент заблокирован', Markup.inlineKeyboard([]));
            return;
        }

        const updatedDeal = await prisma.deal.update({
            where: { id: dealId },
            data: { clientConfirmed: true },
            include: { offer: { include: { warrantHolder: { include: { user: true } } } } }
        });

        const totalAmount = await calculateClientTransaction(
            updatedDeal.offer.type,
            updatedDeal.offer.coin,
            updatedDeal.fiatCurrency,
            updatedDeal.amount,
            updatedDeal.markupPercent
        );

        await ctx.telegram.sendMessage(
            updatedDeal.offer.warrantHolder.user.chatId,
            `Пришла оплата обмена на покупку №${updatedDeal.id} на сумму ${totalAmount} ${updatedDeal.fiatCurrency}. Убедитесь в этом и нажмите кнопку "Получил"`,
            Markup.inlineKeyboard([
                [Markup.button.callback('Получил', `received_${updatedDeal.id}`)],
                [Markup.button.callback('Написать клиенту', `chat_to_client_${updatedDeal.id}`)]
            ])
        );

        await ctx.editMessageText(
            `Обмен №${deal.id}. Ожидайте подтверждения продавца`,
            Markup.inlineKeyboard([
                [Markup.button.callback('Написать ордеродержателю', `chat_to_warrant_${updatedDeal.id}`)],
                [Markup.button.callback('Отменить', 'cancel')]
            ])
        );
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

        if (deal.status === 'expired') {
            await ctx.editMessageText('Время обмена истекло', Markup.inlineKeyboard([]));
            return;
        }

        if (deal.status === 'blocked') {
            await ctx.editMessageText('Данный обмен в данный момент заблокирован', Markup.inlineKeyboard([]));
            return;
        }

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
        if (!client) return;

        let recipientAddress: string;
        let txId: string | undefined;

        if (deal.offer.type === "buy") {
            recipientAddress = deal.clientPaymentDetails || client.wallets[0].address;
            txId = await sendP2PTransaction(
                deal.amount,
                deal.offer.coin,
                warrantHolder.user.id,
                recipientAddress,
                "sell"
            );
        } else {
            const index = deal.offer.fiatCurrency.indexOf(deal.fiatCurrency);
            recipientAddress = deal.offer.warrantHolderPaymentDetails[index];
            txId = await sendP2PTransaction(
                deal.amount,
                deal.offer.coin,
                client.id,
                recipientAddress,
                "buy"
            );
        }

        if (!txId) {
            await ctx.reply('Ошибка при выполнении транзакции. Попробуйте снова');
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
                `Вам начислен реферальный бонус ${referralFee} ${deal.offer.coin} за обмен №${deal.id}!`
            );
        }

        const chain = deal.offer.coin === 'BTC' ? (config.NETWORK === 'main' ? 'btc/main' : 'btc/test3') : deal.offer.coin === 'LTC' ? 'ltc/main' : 'trx';
        const txLink = deal.offer.coin === 'USDT'
            ? (config.NETWORK === 'main' ? `https://tronscan.org/#/transaction/${txId}` : `https://shastascan.io/#/transaction/${txId}`)
            : `https://api.blockcypher.com/v1/${chain}/txs/${txId}`;

        await ctx.editMessageText(
            `Транзакция отправлена успешно!\nTxID: ${txId}\nLink: ${txLink}`,
            Markup.inlineKeyboard([
                [Markup.button.callback('Написать клиенту', `chat_to_client_${deal.id}`)]
            ])
        );
        await ctx.telegram.sendMessage(
            client.chatId,
            `Транзакция отправлена успешно!\n${txLink}`,
            Markup.inlineKeyboard([
                [Markup.button.callback('Написать ордеродержателю', `chat_to_warrant_${deal.id}`)]
            ])
        );
        await clearState(ctx.from.id.toString());
    });

    bot.action(/chat_to_warrant_(\d+)/, async (ctx) => {
        if (!ctx.from?.id) return;
        const dealId = parseInt(ctx.match[1], 10);
        const userId = ctx.from.id.toString();
        await setState(userId, { action: 'chat_to_warrant', dealId });
        await ctx.reply(
            'Напишите сообщение для ордеродержателя',
            Markup.inlineKeyboard([[Markup.button.callback('Отменить', 'cancel')]])
        );
    });

    bot.action(/chat_to_client_(\d+)/, async (ctx) => {
        if (!ctx.from?.id) return;
        const dealId = parseInt(ctx.match[1], 10);
        const userId = ctx.from.id.toString();
        await setState(userId, { action: 'chat_to_client', dealId });
        await ctx.reply(
            'Напишите сообщение для клиента',
            Markup.inlineKeyboard([[Markup.button.callback('Отменить', 'cancel')]])
        );
    });

    bot.action(/deal_reply_(\d+)/, async (ctx) => {
        if (!ctx.from?.id) return;
        const dealId = parseInt(ctx.match[1], 10);
        const userId = ctx.from.id.toString();
        const deal = await prisma.deal.findUnique({
            where: { id: dealId },
            include: { offer: true }
        });
        if (!deal) return;

        const isWarrantHolder = deal.offer.userId === ctx.from.id;
        await setState(userId, { action: isWarrantHolder ? 'chat_to_client' : 'chat_to_warrant', dealId });

        await ctx.editMessageText(
            `Напишите сообщение для ${isWarrantHolder ? 'клиента' : 'ордеродержателя'}`,
            Markup.inlineKeyboard([[Markup.button.callback('Отменить', 'cancel')]])
        );
    });

    bot.action(/close_chat_(\d+)/, async (ctx) => {
        if (!ctx.from?.id) return;
        const dealId = parseInt(ctx.match[1], 10);
        const deal = await prisma.deal.findUnique({
            where: { id: dealId },
            include: { offer: { include: { warrantHolder: { include: { user: true } } } }, client: true }
        });
        if (!deal) return;

        const isWarrantHolder = deal.offer.userId === ctx.from.id;
        const recipientId = isWarrantHolder ? deal.client.chatId : deal.offer.warrantHolder.user.chatId;

        await ctx.telegram.sendMessage(
            recipientId,
            `Пользователь закрыл чат по обмену №${deal.id} (${deal.offer.type === 'buy' ? 'покупка' : 'продажа'}, ${deal.offer.coin})`
        );
        await ctx.editMessageText('Чат закрыт', Markup.inlineKeyboard([]));
        await clearState(ctx.from.id.toString());
    });
}

export async function handleDealsText(ctx: BotContext) {
    if (!ctx.from?.id) return;
    const userId = ctx.from.id.toString();
    const state = ctx.state;

    if (state.action === 'buy_amount') {
        if (!('text' in ctx.message)) return;
        const amount = parseFloat(ctx.message.text);
        if (isNaN(amount)) {
            await ctx.reply('Ошибка: введите корректное число');
            return;
        }

        const offer = await prisma.offer.findUnique({
            where: { id: state.offerId },
            include: { warrantHolder: { include: { user: true } } }
        });
        if (!offer) return;

        if (amount < offer.minDealAmount || amount > offer.maxDealAmount) {
            await ctx.reply(
                `Ошибка: сумма должна быть в диапазоне ${offer.minDealAmount} - ${offer.maxDealAmount} ${offer.coin}`
            );
            return;
        }

        const totalAmount = await calculateClientTransaction('buy', state.coin, state.fiatCurrency, amount, offer.markupPercent);
        if (totalAmount < 0) {
            await ctx.reply('Выберите сумму выше. В данный момент сумма получится отрицательной');
            return;
        }

        await setState(userId, { amount });

        await ctx.reply(
            `Вы покупаете ${amount} ${offer.coin}. ` +
            `Итоговая сумма перевода ${totalAmount} ${state.fiatCurrency}. Готовы продолжить?`,
            Markup.inlineKeyboard([
                [Markup.button.callback('Отменить', 'cancel'), Markup.button.callback('Продолжить', 'confirm_buy')]
            ])
        );
    } else if (state.action === 'sell_amount') {
        if (!('text' in ctx.message)) return;
        const amount = parseFloat(ctx.message.text);
        if (isNaN(amount)) {
            await ctx.reply('Ошибка: введите корректное число');
            return;
        }

        const offer = await prisma.offer.findUnique({
            where: { id: state.offerId },
            include: { warrantHolder: { include: { user: true } } }
        });
        if (!offer) return;

        if (amount < offer.minDealAmount || amount > offer.maxDealAmount) {
            await ctx.reply(
                `Ошибка: сумма должна быть в диапазоне ${offer.minDealAmount} - ${offer.maxDealAmount} ${offer.coin}`
            );
            return;
        }

        const totalAmount = await calculateClientTransaction('sell', state.coin, state.fiatCurrency, amount, offer.markupPercent);
        if (totalAmount < 0) {
            await ctx.reply('Выберите сумму выше. В данный момент сумма получится отрицательной');
            return;
        }

        await setState(userId, { amount });

        await ctx.reply(
            `Вы продаете ${amount} ${offer.coin}. ` +
            `Вы получите ${totalAmount} ${state.fiatCurrency}. Готовы продолжить?`,
            Markup.inlineKeyboard([
                [Markup.button.callback('Отменить', 'cancel'), Markup.button.callback('Продолжить', `confirm_sell_${state.offerId}`)]
            ])
        );
    } else if (state.action === 'chat_to_warrant' || state.action === 'chat_to_client') {
        if (!('text' in ctx.message)) return;
        const message = ctx.message.text.trim();
        if (!message) {
            await ctx.reply('Ошибка: введите корректное сообщение');
            return;
        }

        const deal = await prisma.deal.findUnique({
            where: { id: state.dealId },
            include: { client: true, offer: { include: { warrantHolder: { include: { user: true } } } } }
        });
        if (!deal) return;

        const recipientId = state.action === 'chat_to_warrant' ? deal.offer.warrantHolder.user.chatId : deal.client.chatId;

        await ctx.telegram.sendMessage(
            recipientId,
            `${message}\n\nОбмен №${deal.id} (${deal.offer.type === 'buy' ? 'покупка' : 'продажа'}, ${deal.offer.coin})`,
            Markup.inlineKeyboard([
                [Markup.button.callback('Ответить', `deal_reply_${deal.id}`)],
                [Markup.button.callback('Закончить разговор', `close_chat_${deal.id}`)]
            ])
        );
        await ctx.reply('Сообщение отправлено', Markup.inlineKeyboard([]));
        await clearState(userId);
    } else if (state.action === 'sell_payment_details') {
        if (!('text' in ctx.message)) return;
        const paymentDetails = ctx.message.text.trim();
        const offer = await prisma.offer.findUnique({
            where: { id: state.offerId },
            include: { warrantHolder: { include: { user: true } } }
        });
        if (!offer) return;

        if (!paymentDetails) {
            await ctx.reply('Ошибка: введите корректные реквизиты');
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

        const client = await prisma.user.findUnique({
            where: { chatId: userId }
        });
        if (!client) return;

        const balance = await getWalletBalance(client.id, offer.coin, true);
        if (balance.confirmed < state.amount) {
            await ctx.reply('Обмен не был создан. Ваш баланс меньше необходимого');
            return;
        }

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
            `Пришла заявка на обмен №${deal.id} на продажу ${state.amount} ${offer.coin}. ` +
            `Реквизиты покупателя: ${paymentDetails}. Переведите ${totalAmount} ${state.fiatCurrency} покупателю и нажмите "Получил и отправил"`,
            Markup.inlineKeyboard([
                [Markup.button.callback('Получил и отправил', `received_${deal.id}`)],
                [Markup.button.callback('Написать клиенту', `chat_to_client_${deal.id}`)]
            ])
        );

        await ctx.reply(
            `Обмен №${deal.id} создан. Ожидайте подтверждения продавца`,
            Markup.inlineKeyboard([
                [Markup.button.callback('Написать ордеродержателю', `chat_to_warrant_${deal.id}`)],
                [Markup.button.callback('Отменить', 'cancel')]
            ])
        );
    } else if (state.action === 'buy_wallet_address') {
        if (!('text' in ctx.message)) return;
        const walletAddress = ctx.message.text.trim();
        const offer = await prisma.offer.findUnique({
            where: { id: state.offerId },
            include: { warrantHolder: { include: { user: true } } }
        });
        if (!offer) return;

        if (!walletAddress) {
            await ctx.reply('Ошибка: введите корректный адрес кошелька');
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

        const balance = await getWalletBalance(offer.warrantHolder.user.id, offer.coin, true);
        const totalAmount = await calculateClientTransaction('buy', state.coin, state.fiatCurrency, state.amount, offer.markupPercent);
        if (balance.confirmed < totalAmount) {
            await ctx.reply('Обмен не был создан. Баланс ордеродержателя меньше необходимого');
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

        const index = offer.fiatCurrency.indexOf(deal.fiatCurrency);

        await ctx.reply(
            `Реквизиты продавца ${offer.warrantHolderPaymentDetails[index]}. Переведите ${totalAmount} ${state.fiatCurrency} продавцу и нажмите кнопку "Оплатил"`,
            Markup.inlineKeyboard([
                [Markup.button.callback('Оплатил', `paid_${deal.id}`)],
                [Markup.button.callback('Написать ордеродержателю', `chat_to_warrant_${deal.id}`)],
                [Markup.button.callback('Отменить', 'cancel')]
            ])
        );
    }
}