import { PrismaClient } from '@prisma/client';
import cron from 'node-cron';

const prisma = new PrismaClient();

export function startTasks() {
    cron.schedule('*/5 * * * *', async () => {
        try {
            const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);

            const expiredDeals = await prisma.deal.findMany({
                where: {
                    OR: [
                        { status: 'pending' }
                    ],
                    clientConfirmed: false,
                    createdAt: {
                        lte: fifteenMinutesAgo
                    }
                }
            });

            if (expiredDeals.length > 0) {
                await prisma.deal.updateMany({
                    where: {
                        id: {
                            in: expiredDeals.map(deal => deal.id)
                        }
                    },
                    data: {
                        status: 'expired'
                    }
                });
                console.log(`Updated ${expiredDeals.length} deals to expired status`);
            }
        } catch (error) {
            console.error('Error checking expired deals:', error);
        }
    });
}