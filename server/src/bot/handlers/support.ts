import { Telegraf, Markup } from 'telegraf';
import { PrismaClient } from '@prisma/client';
import { BotContext } from '../bot';
import { getState, setState, clearState } from '../state';
import { config } from '../../config/env';

const prisma = new PrismaClient();
const SUPPORT_CHAT_ID = config.SUPPORT_CHAT_ID;

const categoryTranslations: Record<string, string> = {
    deals: 'Обмены',
    wallets: 'Кошельки',
    referral: 'Реферальная программа',
    withdraw: 'Вывод средств',
    aml: 'AML проверка',
    other: 'Другое',
};

export function handleSupport(bot: Telegraf<BotContext>) {
    bot.hears('🆘 Техническая поддержка', async (ctx) => {
        if (!ctx.from?.id) return;
        const userId = ctx.from.id.toString();
        await setState(userId, { action: 'support_select_category' });

        await ctx.reply(
            'По какой теме вопрос?',
            Markup.inlineKeyboard([
                [
                    Markup.button.callback('Обмены', 'support_category_deals'),
                    Markup.button.callback('Вывод средств', 'support_category_withdraw'),
                ],
                [
                    Markup.button.callback('Реферальная программа', 'support_category_referral'),
                    Markup.button.callback('Кошельки', 'support_category_wallets'),
                ],
                [
                    Markup.button.callback('AML проверка', 'support_category_aml'),
                    Markup.button.callback('Другое', 'support_category_other'),
                ],
                [Markup.button.callback('Отменить', 'support_cancel')],
            ])
        );
    });

    bot.action('support_cancel', async (ctx) => {
        if (!ctx.from?.id) return;
        const userId = ctx.from.id.toString();
        await clearState(userId);
        await ctx.editMessageText('Действие отменено', Markup.inlineKeyboard([]));
    });

    bot.action(/support_category_(deals|wallets|referral|withdraw|aml|other)/, async (ctx) => {
        if (!ctx.from?.id) return;
        const userId = ctx.from.id.toString();
        const category = ctx.match[1];

        if (category === 'deals') {
            const user = await prisma.user.findUnique({ where: { chatId: userId } });
            if (!user) {
                await ctx.editMessageText('Пользователь не найден', Markup.inlineKeyboard([]));
                return;
            }

            const deals = await prisma.deal.findMany({
                where: { userId: user.id },
                orderBy: [{ status: 'asc' }],
                include: { offer: true },
            });

            if (deals.length === 0) {
                await ctx.editMessageText(
                    'У вас нет обменов',
                    Markup.inlineKeyboard([[Markup.button.callback('Отменить', 'support_cancel')]])
                );
                return;
            }

            await setState(userId, { support: { category: 'deals' }, page: 0 });

            const pageSize = 5;
            const skip = 0;
            const paginatedDeals = deals.slice(skip, skip + pageSize);

            const buttons = paginatedDeals.map((deal) => [
                Markup.button.callback(
                    `Обмен №${deal.id} (${deal.offer.type === 'buy' ? 'покупка' : 'продажа'} ${deal.offer.coin}, ${
                        deal.status === 'pending' ? 'в обработке' :
                            deal.status === 'completed' ? 'завершён' :
                                deal.status === 'blocked' ? 'заблокирован' : 'просрочен'
                    })`,
                    `support_deal_${deal.id}`
                ),
            ]);

            const totalPages = Math.ceil(deals.length / pageSize);
            if (totalPages > 1) {
                buttons.push([
                    Markup.button.callback('Вперед ▶️', 'next_deals'),
                ]);
            }
            buttons.push([Markup.button.callback('Отменить', 'support_cancel')]);

            await ctx.editMessageText(
                `Выберите обмен\nСтраница 1 из ${totalPages}`,
                Markup.inlineKeyboard(buttons)
            );
        } else if (category === 'wallets') {
            await setState(userId, { support: { category: 'wallets' } });

            await ctx.editMessageText(
                'Выберите кошелёк',
                Markup.inlineKeyboard([
                    [
                        Markup.button.callback('BTC', 'support_wallet_BTC'),
                        Markup.button.callback('LTC', 'support_wallet_LTC'),
                        Markup.button.callback('USDT TRC20', 'support_wallet_USDT'),
                    ],
                    [Markup.button.callback('Отменить', 'support_cancel')],
                ])
            );
        } else if (category === 'aml') {
            const user = await prisma.user.findUnique({ where: { chatId: userId } });
            if (!user) {
                await ctx.editMessageText('Пользователь не найден', Markup.inlineKeyboard([]));
                return;
            }

            const amlVerification = await prisma.amlVerification.findFirst({
                where: {
                    userId: user.id,
                    status: { in: ['open', 'rejected'] }
                },
            });

            if (!amlVerification) {
                await ctx.editMessageText(
                    'В данный момент у вас нет AML проверок или она пройдена',
                    Markup.inlineKeyboard([[Markup.button.callback('Отменить', 'support_cancel')]])
                );
                return;
            }

            await setState(userId, {
                action: 'support_describe_problem',
                support: { category: 'aml' },
                amlVerificationId: amlVerification.id,
            });

            await ctx.editMessageText(
                'Подробно опишите проблему',
                Markup.inlineKeyboard([[Markup.button.callback('Отменить', 'support_cancel')]])
            );
        } else {
            await setState(userId, { support: { category } });
            await ctx.editMessageText(
                'Подробно опишите проблему',
                Markup.inlineKeyboard([[Markup.button.callback('Отменить', 'support_cancel')]])
            );
            await setState(userId, { action: 'support_describe_problem', support: { category } });
        }
    });

    bot.action('next_deals', async (ctx) => {
        if (!ctx.from?.id) return;
        const userId = ctx.from.id.toString();
        const state = await getState(userId);
        if (!state.support?.category || state.support.category !== 'deals') return;

        const user = await prisma.user.findUnique({ where: { chatId: userId } });
        if (!user) {
            await ctx.editMessageText('Пользователь не найден', Markup.inlineKeyboard([]));
            return;
        }

        const deals = await prisma.deal.findMany({
            where: { userId: user.id },
            orderBy: [{ status: 'asc' }],
            include: { offer: true },
        });

        const page = (state.page || 0) + 1;
        const pageSize = 5;
        const skip = page * pageSize;
        const paginatedDeals = deals.slice(skip, skip + pageSize);

        if (paginatedDeals.length === 0) {
            await setState(userId, { page: page - 1 });
            await ctx.editMessageText('Нет доступных обменов на этой странице', Markup.inlineKeyboard([
                [Markup.button.callback('◀️ Назад', 'prev_deals')],
                [Markup.button.callback('Отменить', 'support_cancel')]
            ]));
            return;
        }

        await setState(userId, { page });

        const buttons = paginatedDeals.map((deal) => [
            Markup.button.callback(
                `Обмен №${deal.id} (${deal.offer.type === 'buy' ? 'покупка' : 'продажа'} ${deal.offer.coin}, ${
                    deal.status === 'pending' ? 'в обработке' :
                        deal.status === 'completed' ? 'завершён' :
                            deal.status === 'blocked' ? 'заблокирован' : 'просрочен'
                })`,
                `support_deal_${deal.id}`
            ),
        ]);

        const totalPages = Math.ceil(deals.length / pageSize);
        if (totalPages > 1) {
            if (page === totalPages - 1) {
                buttons.push([Markup.button.callback('◀️ Назад', 'prev_deals')]);
            } else {
                buttons.push([
                    Markup.button.callback('◀️ Назад', 'prev_deals'),
                    Markup.button.callback('Вперед ▶️', 'next_deals'),
                ]);
            }
        }
        buttons.push([Markup.button.callback('Отменить', 'support_cancel')]);

        await ctx.editMessageText(
            `Выберите обмен\nСтраница ${page + 1} из ${totalPages}`,
            Markup.inlineKeyboard(buttons)
        );
    });

    bot.action('prev_deals', async (ctx) => {
        if (!ctx.from?.id) return;
        const userId = ctx.from.id.toString();
        const state = await getState(userId);
        if (!state.support?.category || state.support.category !== 'deals') return;

        const user = await prisma.user.findUnique({ where: { chatId: userId } });
        if (!user) {
            await ctx.editMessageText('Пользователь не найден', Markup.inlineKeyboard([]));
            return;
        }

        let page = (state.page || 0) - 1;
        if (page < 0) page = 0;

        await setState(userId, { page });

        const pageSize = 5;
        const skip = page * pageSize;
        const deals = await prisma.deal.findMany({
            where: { userId: user.id },
            orderBy: [{ status: 'asc' }],
            include: { offer: true },
        });

        const paginatedDeals = deals.slice(skip, skip + pageSize);

        const buttons = paginatedDeals.map((deal) => [
            Markup.button.callback(
                `Обмен №${deal.id} (${deal.offer.type === 'buy' ? 'покупка' : 'продажа'} ${deal.offer.coin}, ${
                    deal.status === 'pending' ? 'в обработке' :
                        deal.status === 'completed' ? 'завершён' : 'просрочен'
                })`,
                `support_deal_${deal.id}`
            ),
        ]);

        const totalPages = Math.ceil(deals.length / pageSize);
        if (totalPages > 1) {
            if (page === 0) {
                buttons.push([Markup.button.callback('Вперед ▶️', 'next_deals')]);
            } else {
                buttons.push([
                    Markup.button.callback('◀️ Назад', 'prev_deals'),
                    Markup.button.callback('Вперед ▶️', 'next_deals'),
                ]);
            }
        }
        buttons.push([Markup.button.callback('Отменить', 'support_cancel')]);

        await ctx.editMessageText(
            `Выберите обмен\nСтраница ${page + 1} из ${totalPages}`,
            Markup.inlineKeyboard(buttons)
        );
    });

    bot.action(/support_wallet_(BTC|LTC|USDT)/, async (ctx) => {
        if (!ctx.from?.id) return;
        const userId = ctx.from.id.toString();
        const walletType = ctx.match[1];

        await setState(userId, {
            action: 'support_describe_problem',
            support: { category: 'wallets', subCategory: walletType },
        });

        await ctx.editMessageText(
            `Вы выбрали кошелёк ${walletType}. Подробно опишите проблему.`,
            Markup.inlineKeyboard([[Markup.button.callback('Отменить', 'support_cancel')]])
        );
    });

    bot.action(/support_aml_(\d+)/, async (ctx) => {
        if (!ctx.from?.id) return;
        const userId = ctx.from.id.toString();
        const verificationId = parseInt(ctx.match[1], 10);

        await setState(userId, { action: 'aml_attach_images', amlVerificationId: verificationId });

        await ctx.editMessageText(
            'Приложите документы (паспорт, подтверждение адреса, источник средств) для AML-проверки или пропустите',
            Markup.inlineKeyboard([
                [Markup.button.callback('Пропустить и отправить', 'aml_skip_images')],
                [Markup.button.callback('Отменить', 'support_cancel')],
            ])
        );
    });

    bot.action('support_skip_images', async (ctx) => {
        if (!ctx.from?.id) return;
        const userId = ctx.from.id.toString();
        await submitSupportTicket(ctx, userId);
    });

    bot.action('aml_skip_images', async (ctx) => {
        if (!ctx.from?.id) return;
        const userId = ctx.from.id.toString();
        const state = await getState(userId);

        if (!state.amlVerificationId) {
            await ctx.editMessageText('Ошибка: AML-проверка не найдена', Markup.inlineKeyboard([]));
            return;
        }

        const verification = await prisma.amlVerification.findUnique({
            where: { id: state.amlVerificationId },
            include: { user: true },
        });

        if (!verification) {
            await ctx.editMessageText('Ошибка: AML-проверка не найдена', Markup.inlineKeyboard([]));
            return;
        }

        await prisma.amlVerification.update({
            where: { id: state.amlVerificationId },
            data: { verificationImagesPath: state.support?.images || [] },
        });

        const senderName = verification.user.username ? `@${verification.user.username}` : 'Неизвестно';
        const message = [
            `AML-проверка №${verification.id}`,
            `Пользователь: ${senderName}`,
            `Причина: ${verification.reason}`,
        ].join('\n');

        try {
            if (state.support?.images && state.support.images.length > 0) {
                await ctx.telegram.sendMediaGroup(SUPPORT_CHAT_ID, state.support.images.map((image, index) => ({
                    type: 'photo',
                    media: image,
                    caption: index === 0 ? message : undefined,
                })));
            } else {
                await ctx.telegram.sendMessage(SUPPORT_CHAT_ID, message, {
                    parse_mode: 'Markdown',
                    reply_markup: {
                        inline_keyboard: [
                            [
                                Markup.button.callback('Подтвердить', `aml_approve_${verification.id}`),
                                Markup.button.callback('Отклонить', `aml_reject_${verification.id}`),
                            ],
                        ],
                    },
                });
            }

            await ctx.editMessageText(
                'Ваши документы отправлены на AML-проверку. Ожидайте результата.',
                Markup.inlineKeyboard([])
            );

            await clearState(userId);
        } catch (error) {
            console.error('Ошибка при отправке AML-проверки:', error);
            await ctx.editMessageText(
                'Произошла ошибка при отправке документов. Пожалуйста, попробуйте позже.',
                Markup.inlineKeyboard([])
            );
        }
    });

    bot.action(/aml_approve_(\d+)/, async (ctx) => {
        if (!ctx.from?.id) return;
        const verificationId = parseInt(ctx.match[1], 10);

        const verification = await prisma.amlVerification.findUnique({
            where: { id: verificationId },
            include: { user: true },
        });

        if (!verification) {
            await ctx.editMessageText('Ошибка: AML-проверка не найдена', Markup.inlineKeyboard([]));
            return;
        }

        await prisma.amlVerification.update({
            where: { id: verificationId },
            data: { status: 'completed' },
        });

        await ctx.telegram.sendMessage(
            verification.user.chatId,
            '✅ Вы успешно прошли AML-проверку!'
        );

        await ctx.editMessageText('AML-проверка подтверждена', Markup.inlineKeyboard([]));
    });

    bot.action(/aml_reject_(\d+)/, async (ctx) => {
        if (!ctx.from?.id) return;
        const verificationId = parseInt(ctx.match[1], 10);

        const verification = await prisma.amlVerification.findUnique({
            where: { id: verificationId },
            include: { user: true },
        });

        if (!verification) {
            await ctx.editMessageText('Ошибка: AML-проверка не найдена', Markup.inlineKeyboard([]));
            return;
        }

        await prisma.amlVerification.update({
            where: { id: verificationId },
            data: { status: 'rejected' },
        });

        await ctx.telegram.sendMessage(
            verification.user.chatId,
            '🚫 Вы не прошли AML-проверку. Обратитесь в поддержку для решения проблемы.'
        );

        await ctx.editMessageText('AML-проверка отклонена', Markup.inlineKeyboard([]));
    });

    bot.on('photo', async (ctx) => {
        if (!ctx.from?.id) return;
        const userId = ctx.from.id.toString();
        const state = await getState(userId);

        if (state.action === 'support_attach_images') {
            const fileId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
            const currentImages = state.support?.images || [];
            const updatedImages = [...currentImages, fileId];

            await setState(userId, {
                action: 'support_attach_images',
                support: { ...state.support, images: updatedImages },
            });

            await ctx.reply(
                `Добавлено ${updatedImages.length} изображений. Приложите ещё или пропустите`,
                Markup.inlineKeyboard([
                    [Markup.button.callback('Пропустить и отправить', 'support_skip_images')],
                    [Markup.button.callback('Отменить', 'support_cancel')],
                ])
            );
        } else if (state.action === 'aml_attach_images') {
            const fileId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
            const currentImages = state.support?.images || [];
            const updatedImages = [...currentImages, fileId];

            await setState(userId, {
                action: 'aml_attach_images',
                support: { ...state.support, images: updatedImages },
                amlVerificationId: state.amlVerificationId,
            });

            await ctx.reply(
                `Добавлено ${updatedImages.length} изображений. Приложите ещё или пропустите`,
                Markup.inlineKeyboard([
                    [Markup.button.callback('Пропустить и отправить', 'aml_skip_images')],
                    [Markup.button.callback('Отменить', 'support_cancel')],
                ])
            );
        }
    });

    bot.on('document', async (ctx) => {
        if (!ctx.from?.id) return;
        const userId = ctx.from.id.toString();
        const state = await getState(userId);

        if (state.action === 'support_attach_images') {
            const fileId = ctx.message.document.file_id;
            const currentImages = state.support?.images || [];
            const updatedImages = [...currentImages, fileId];

            await setState(userId, {
                action: 'support_attach_images',
                support: { ...state.support, images: updatedImages },
            });

            await ctx.reply(
                `Добавлено ${updatedImages.length} изображений. Приложите ещё или пропустите`,
                Markup.inlineKeyboard([
                    [Markup.button.callback('Пропустить и отправить', 'support_skip_images')],
                    [Markup.button.callback('Отменить', 'support_cancel')],
                ])
            );
        } else if (state.action === 'aml_attach_images') {
            const fileId = ctx.message.document.file_id;
            const currentImages = state.support?.images || [];
            const updatedImages = [...currentImages, fileId];

            await setState(userId, {
                action: 'aml_attach_images',
                support: { ...state.support, images: updatedImages },
                amlVerificationId: state.amlVerificationId,
            });

            await ctx.reply(
                `Добавлено ${updatedImages.length} изображений. Приложите ещё или пропустите`,
                Markup.inlineKeyboard([
                    [Markup.button.callback('Пропустить и отправить', 'aml_skip_images')],
                    [Markup.button.callback('Отменить', 'support_cancel')],
                ])
            );
        }
    });
}

export async function handleSupportText(ctx: BotContext) {
    if (!ctx.from?.id) return;
    const userId = ctx.from.id.toString();
    const state = await getState(userId);

    if (state.action === 'support_describe_problem') {
        if (!('text' in ctx.message)) return;
        const description = ctx.message.text.trim();
        if (!description) {
            await ctx.reply('Ошибка: введите корректное описание проблемы');
            return;
        }

        await setState(userId, {
            action: 'support_attach_images',
            support: { ...state.support, description, images: [] },
        });

        await ctx.reply(
            'Приложите скриншоты проблемы или пропустите',
            Markup.inlineKeyboard([
                [Markup.button.callback('Пропустить и отправить', 'support_skip_images')],
                [Markup.button.callback('Отменить', 'support_cancel')],
            ])
        );
    } else if (state.action?.startsWith('support_reply_')) {
        if (!('text' in ctx.message)) return;
        const ticketId = parseInt(state.action.split('_')[2], 10);
        const ticket = await prisma.supportTicket.findUnique({
            where: { id: ticketId },
            include: { user: true },
        });

        if (!ticket || ticket.status === 'closed') {
            await ctx.reply('Ошибка: тикет закрыт или не найден');
            return;
        }

        const message = ctx.message.text.trim();
        if (!message) {
            await ctx.reply('Ошибка: введите корректное сообщение');
            return;
        }

        const sender = await prisma.user.findUnique({ where: { chatId: userId } });
        if (!sender) {
            await ctx.reply('Пользователь не найден');
            return;
        }

        const recipientId = userId === SUPPORT_CHAT_ID ? ticket.user.chatId : SUPPORT_CHAT_ID;

        try {
            await ctx.telegram.sendMessage(
                recipientId,
                `Тикет №${ticketId}\n${message}`,
                Markup.inlineKeyboard([
                    [Markup.button.callback('Ответить', `support_reply_${ticketId}`)],
                    [Markup.button.callback('Закончить разговор', `support_close_${ticketId}`)],
                ])
            );

            await ctx.reply('Сообщение отправлено');
        } catch (error) {
            console.error('Ошибка при отправке сообщения:', error);
            await ctx.reply('Произошла ошибка при отправке сообщения. Пожалуйста, попробуйте позже.');
        }
    }
}

async function submitSupportTicket(ctx: BotContext, userId: string) {
    const state = await getState(userId);
    const support = state.support;

    if (!support || !support.category || !support.description) {
        await ctx.editMessageText('Ошибка: не удалось создать запрос', Markup.inlineKeyboard([]));
        return;
    }

    const user = await prisma.user.findUnique({ where: { chatId: userId } });
    if (!user) {
        await ctx.editMessageText('Пользователь не найден', Markup.inlineKeyboard([]));
        return;
    }

    const categoryTranslated = categoryTranslations[support.category] || support.category;
    const reason = support.subCategory
        ? `${categoryTranslated}: ${support.subCategory}`
        : categoryTranslated;

    const ticket = await prisma.supportTicket.create({
        data: {
            user: { connect: { id: user.id } },
            reason,
            description: support.description,
            imagesPath: support.images || [],
            status: 'open',
        },
    });

    const senderName = user.username ? `@${user.username}` : 'Неизвестно';
    const message = [
        `Тикет №${ticket.id}`,
        `Тема: "${reason}"`,
        `${support.description}`,
        `Пользователь: ${senderName}`,
    ].join('\n');

    try {
        if (support.images && support.images.length > 0) {
            await ctx.telegram.sendMediaGroup(SUPPORT_CHAT_ID, support.images.map((image, index) => ({
                type: 'photo',
                media: image,
                caption: index === 0 ? message : undefined,
            })));
        } else {
            await ctx.telegram.sendMessage(SUPPORT_CHAT_ID, message, {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [Markup.button.callback('Ответить', `support_reply_${ticket.id}`)],
                        [Markup.button.callback('Закончить разговор', `support_close_${ticket.id}`)],
                    ],
                },
            });
        }

        await ctx.editMessageText(
            'Ваш запрос в техническую поддержку отправлен. Мы свяжемся с вами в ближайшее время.',
            Markup.inlineKeyboard([])
        );
    } catch (error) {
        console.error('Ошибка при отправке тикета:', error);
        await ctx.editMessageText(
            'Произошла ошибка при отправке запроса. Пожалуйста, попробуйте позже.',
            Markup.inlineKeyboard([])
        );
    }
}