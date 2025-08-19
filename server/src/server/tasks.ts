import { PrismaClient } from '@prisma/client';
import cron from 'node-cron';
import { bot } from "../bot/bot";
import { Markup } from 'telegraf';

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
                '🚫 Ваша AML-проверка была отклонена из-за превышения времени ожидания (1 час). Пожалуйста, обратитесь в поддержку для решения проблемы.'
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
                    inline_keyboard: [[Markup.button.callback('Приложить документы', 'aml_start_verification')]],
                },
            }
        );
    }
}

export function startTasks() {
    cron.schedule('*/5 * * * *', async () => {
        try {
            const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
            const expiredDeals = await prisma.deal.findMany({
                where: {
                    OR: [{ status: 'pending' }],
                    clientConfirmed: false,
                    createdAt: { lte: fifteenMinutesAgo },
                },
            });

            if (expiredDeals.length > 0) {
                await prisma.deal.updateMany({
                    where: { id: { in: expiredDeals.map((deal) => deal.id) } },
                    data: { status: 'expired' },
                });
                console.log(`Updated ${expiredDeals.length} deals to status expired`);
            }

            await checkAmlVerifications();
        } catch (error) {
            console.error('Error in cron job:', error);
        }
    });
}