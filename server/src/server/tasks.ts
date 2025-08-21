import { PrismaClient } from '@prisma/client';
import cron from 'node-cron';
import { bot } from "../bot/bot";
import { Markup } from 'telegraf';
import { config } from '../config/env';

const prisma = new PrismaClient();

async function checkAmlVerifications() {
    const openVerifications = await prisma.amlVerification.findMany({
        where: { status: 'open' },
        include: { user: true },
    });

    for (const verification of openVerifications) {
        const createdAt = new Date(verification.createdAt);
        const now = new Date();
        const oneHourPassed = now.getTime() - createdAt.getTime() > 60 * 60 * 1000;

        if (oneHourPassed) {
            await prisma.amlVerification.update({
                where: { id: verification.id },
                data: { status: 'rejected' },
            });
            await bot.telegram.sendMessage(
                verification.user.chatId,
                '🚫 Ваша AML-проверка была отклонена из-за превышения времени ожидания (1 час). Пожалуйста, обратитесь в поддержку для решения проблемы.',
                {
                    parse_mode: 'Markdown',
                    reply_markup: {
                        inline_keyboard: [[Markup.button.callback('Написать в поддержку', 'support_category_aml')]],
                    },
                }
            );
            continue;
        }

        await bot.telegram.sendMessage(
            verification.user.chatId,
            [
                'Мы заметили подозрительную активность в ваших действиях.',
                `Причина: "${verification.reason}".`,
                'Вам необходимо приложить документы (паспорт обязательно, подтверждение адреса, источник средств) для проверки.',
            ].join('\n'),
            {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [Markup.button.callback('Приложить документы', 'aml_start_verification')],
                        [Markup.button.callback('Написать в поддержку', 'support_category_aml')],
                    ],
                },
            }
        );
    }
}

async function updateExpiredDeals() {
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
    const expiredDeals = await prisma.deal.findMany({
        where: {
            OR: [{ status: 'pending' }],
            clientConfirmed: false,
            createdAt: { lte: fifteenMinutesAgo },
        },
        include: { client: true },
    });

    if (expiredDeals.length > 0) {
        await prisma.deal.updateMany({
            where: { id: { in: expiredDeals.map((deal) => deal.id) } },
            data: { status: 'expired' },
        });

        for (const deal of expiredDeals) {
            await bot.telegram.sendMessage(
                deal.client.chatId,
                `⏳ Время сделки №${deal.id} истекло. Вы не подтвердили обмен вовремя. Если это произошло по ошибке, пожалуйста, обратитесь в поддержку.`,
                {
                    parse_mode: 'Markdown',
                    reply_markup: {
                        inline_keyboard: [[Markup.button.callback('Написать в поддержку', 'support_category_deals')]],
                    },
                }
            );
        }
    }
}

export function startTasks() {
    cron.schedule('*/1 * * * *', async () => {
        try {
            await updateExpiredDeals();

            if (config.AML_VERIFICATION_ENABLED) {
                await checkAmlVerifications();
            }
        } catch (error) {
            console.error('Error in cron job:', error);
        }
    });
}