import { PrismaClient } from '@prisma/client';
import {Markup, MiddlewareFn} from 'telegraf';
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
    if (userId && config.AML_VERIFICATION_ENABLED) {
        const user = await prisma.user.findUnique({
            where: { chatId: userId },
            select: { isBlocked: true },
        });
        if (user?.isBlocked) {
            await ctx.reply('🚫 Ваш аккаунт заблокирован!');
            return;
        }

        const openAmlVerification = await prisma.amlVerification.findFirst({
            where: {
                user: { chatId: userId },
                status: 'open',
            },
        });

        if (openAmlVerification) {
            await ctx.reply(
                '🚫 У вас есть незавершённая AML-проверка. Завершите её, чтобы продолжить операции обмена и вывода.',
                {
                    reply_markup: {
                        inline_keyboard: [[Markup.button.callback('Приложить документы', 'aml_start_verification')]],
                    },
                }
            );
            return;
        }

        ctx.state = await getState(userId);
    } else {
        ctx.state = {};
    }
    await next();
};