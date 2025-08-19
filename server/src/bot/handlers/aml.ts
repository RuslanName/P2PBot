import { Telegraf, Markup } from 'telegraf';
import { PrismaClient } from '@prisma/client';
import { BotContext } from '../bot';
import { getState, setState, clearState } from '../state';
import { config } from '../../config/env';

const prisma = new PrismaClient();
const SUPPORT_CHAT_ID = config.SUPPORT_CHAT_ID;

export function handleAml(bot: Telegraf<BotContext>) {
    bot.action('aml_start_verification', async (ctx) => {
        if (!ctx.from?.id) return;
        const userId = ctx.from.id.toString();
        const state = await getState(userId);

        if (!state.amlVerificationId) {
            await ctx.editMessageText('Ошибка: AML-проверка не найдена', Markup.inlineKeyboard([]));
            return;
        }

        await setState(userId, {
            action: 'aml_attach_documents',
            amlVerificationId: state.amlVerificationId,
            support: { images: [] },
        });

        await ctx.editMessageText(
            'Приложите документы (паспорт обязательно, подтверждение адреса, источник средств) для AML-проверки или пропустите',
            Markup.inlineKeyboard([
                [Markup.button.callback('Пропустить и отправить', 'aml_submit_documents')],
                [Markup.button.callback('Отменить', 'aml_cancel')],
            ])
        );
    });

    bot.action('aml_submit_documents', async (ctx) => {
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

    bot.action('aml_cancel', async (ctx) => {
        if (!ctx.from?.id) return;
        const userId = ctx.from.id.toString();
        await clearState(userId);
        await ctx.editMessageText('AML-проверка отменена', Markup.inlineKeyboard([]));
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

        if (state.action === 'aml_attach_documents') {
            const fileId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
            const currentImages = state.support?.images || [];
            const updatedImages = [...currentImages, fileId];

            await setState(userId, {
                action: 'aml_attach_documents',
                support: { images: updatedImages },
                amlVerificationId: state.amlVerificationId,
            });

            await ctx.reply(
                `Добавлено ${updatedImages.length} изображений. Приложите ещё или отправьте`,
                Markup.inlineKeyboard([
                    [Markup.button.callback('Пропустить и отправить', 'aml_submit_documents')],
                    [Markup.button.callback('Отменить', 'aml_cancel')],
                ])
            );
        }
    });

    bot.on('document', async (ctx) => {
        if (!ctx.from?.id) return;
        const userId = ctx.from.id.toString();
        const state = await getState(userId);

        if (state.action === 'aml_attach_documents') {
            const fileId = ctx.message.document.file_id;
            const currentImages = state.support?.images || [];
            const updatedImages = [...currentImages, fileId];

            await setState(userId, {
                action: 'aml_attach_documents',
                support: { images: updatedImages },
                amlVerificationId: state.amlVerificationId,
            });

            await ctx.reply(
                `Добавлено ${updatedImages.length} документов. Приложите ещё или отправьте`,
                Markup.inlineKeyboard([
                    [Markup.button.callback('Пропустить и отправить', 'aml_submit_documents')],
                    [Markup.button.callback('Отменить', 'aml_cancel')],
                ])
            );
        }
    });
}