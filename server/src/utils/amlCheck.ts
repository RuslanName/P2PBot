import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function checkAmlLimits(userId: string): Promise<boolean> {
    const hasCompletedVerification = await prisma.amlVerification.findFirst({
        where: {
            userId: parseInt(userId),
            status: 'completed',
        },
    });

    if (hasCompletedVerification) {
        return false;
    }

    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 1000);
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 1000);

    const dealsInHour = await prisma.deal.count({
        where: {
            userId: parseInt(userId),
            createdAt: { gte: oneHourAgo },
        },
    });

    if (dealsInHour > 3) {
        await prisma.amlVerification.create({
            data: {
                userId: parseInt(userId),
                reason: 'Слишком много сделок за час',
                verificationImagesPath: [],
                status: 'open',
            },
        });
        return true;
    }

    const withdrawalsInHour = await prisma.deal.count({
        where: {
            userId: parseInt(userId),
            txId: { not: null },
            createdAt: { gte: oneHourAgo },
        },
    });

    if (withdrawalsInHour > 3) {
        await prisma.amlVerification.create({
            data: {
                userId: parseInt(userId),
                reason: 'Слишком много различных выводов за час',
                verificationImagesPath: [],
                status: 'open',
            },
        });
        return true;
    }

    const withdrawalsInDay = await prisma.deal.count({
        where: {
            userId: parseInt(userId),
            txId: { not: null },
            createdAt: { gte: oneDayAgo },
        },
    });

    if (withdrawalsInDay > 7) {
        await prisma.amlVerification.create({
            data: {
                userId: parseInt(userId),
                reason: 'Слишком много выводов за день',
                verificationImagesPath: [],
                status: 'open',
            },
        });
        return true;
    }

    const withdrawalsInWeek = await prisma.deal.count({
        where: {
            userId: parseInt(userId),
            txId: { not: null },
            createdAt: { gte: oneWeekAgo },
        },
    });

    if (withdrawalsInWeek > 20) {
        await prisma.amlVerification.create({
            data: {
                userId: parseInt(userId),
                reason: 'Слишком много выводов за неделю',
                verificationImagesPath: [],
                status: 'open',
            },
        });
        return true;
    }

    const uniqueWalletsDay = await prisma.deal.groupBy({
        by: ['clientPaymentDetails'],
        where: {
            userId: parseInt(userId),
            txId: { not: null },
            createdAt: { gte: oneDayAgo },
        },
    });

    if (uniqueWalletsDay.length > 3) {
        await prisma.amlVerification.create({
            data: {
                userId: parseInt(userId),
                reason: 'Слишком много различных кошельков за день',
                verificationImagesPath: [],
                status: 'open',
            },
        });
        return true;
    }

    const uniqueWalletsWeek = await prisma.deal.groupBy({
        by: ['clientPaymentDetails'],
        where: {
            userId: parseInt(userId),
            txId: { not: null },
            createdAt: { gte: oneWeekAgo },
        },
    });

    if (uniqueWalletsWeek.length > 5) {
        await prisma.amlVerification.create({
            data: {
                userId: parseInt(userId),
                reason: 'Слишком много различных кошельков за неделю',
                verificationImagesPath: [],
                status: 'open',
            },
        });
        return true;
    }

    const dealsInDay = await prisma.deal.count({
        where: {
            userId: parseInt(userId),
            createdAt: { gte: oneDayAgo },
        },
    });

    if (dealsInDay > 7) {
        await prisma.amlVerification.create({
            data: {
                userId: parseInt(userId),
                reason: 'Слишком много сделок за день',
                verificationImagesPath: [],
                status: 'open',
            },
        });
        return true;
    }

    const dealsInWeek = await prisma.deal.count({
        where: {
            userId: parseInt(userId),
            createdAt: { gte: oneWeekAgo },
        },
    });

    if (dealsInWeek > 20) {
        await prisma.amlVerification.create({
            data: {
                userId: parseInt(userId),
                reason: 'Слишком много сделок за неделю',
                verificationImagesPath: [],
                status: 'open',
            },
        });
        return true;
    }

    return false;
}