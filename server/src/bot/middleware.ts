import { PrismaClient } from '@prisma/client';
import { Markup, MiddlewareFn } from 'telegraf';
import { getState } from './state';
import { config } from '../config/env';
import { BotContext } from "./bot";

const prisma = new PrismaClient();

export const checkBlockedMiddleware: MiddlewareFn<BotContext> = async (ctx, next) => {
    const userId = ctx.from?.id.toString();
    if (userId) {
        const user = await prisma.user.findUnique({
            where: { chatId: userId },
            select: { isBlocked: true }
        });
        if (user?.isBlocked) {
            await ctx.reply('🚫 Ваш аккаунт заблокирован!');
            return;
        }
        ctx.state = await getState(userId);
    } else {
        ctx.state = {};
    }
    await next();
};

export const amlMiddleware: MiddlewareFn<BotContext> = async (ctx, next) => {
    const userId = ctx.from?.id.toString();

    if (!userId || !config.AML_VERIFICATION_ENABLED) {
        ctx.state = await getState(userId || '');
        await next();
        return;
    }

    const updateType = Object.keys(ctx.update)[1];

    const allowedUpdateTypes = ['callback_query', 'message'];
    const isAllowedUpdateType = allowedUpdateTypes.includes(updateType);

    if (isAllowedUpdateType) {
        let isAllowedAction = false;

        if (updateType === 'callback_query') {
            const callbackData = (ctx.update as any).callback_query?.data;
            const allowedCallbacks = [
                'support_select_category',
                'support_category_',
                'support_',
                'aml_',
                'support_cancel'
            ];

            isAllowedAction = allowedCallbacks.some(action =>
                callbackData?.startsWith(action)
            );
        } else if (updateType === 'message') {
            const state = await getState(userId);
            isAllowedAction = state.action?.startsWith('support_') ||
                state.action?.startsWith('aml_');
        }

        if (isAllowedAction) {
            ctx.state = await getState(userId);
            await next();
            return;
        }
    }

    const openAmlVerification = await prisma.amlVerification.findFirst({
        where: {
            user: { chatId: userId },
            status: { in: ['open', 'rejected'] },
        },
    });

    if (openAmlVerification) {
        await ctx.reply(
            '🚫 У вас есть незавершённая или отклонённая AML-проверка. Решите проблему, чтобы продолжить пользоваться ботом.',
            {
                reply_markup: {
                    inline_keyboard: [
                        [Markup.button.callback('Приложить документы', 'aml_start_verification')],
                        [Markup.button.callback('Написать в поддержку', 'support_category_aml')],
                    ],
                },
            }
        );
        return;
    }

    ctx.state = await getState(userId);
    await next();
};