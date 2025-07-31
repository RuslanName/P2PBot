import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config/env';

const prisma = new PrismaClient();

interface OfferData {
    type: string;
    coin: string;
    amount: number;
    minDealAmount: number;
    maxDealAmount: number;
    markupPercent: number;
}

interface WarrantHolderData {
    username?: string;
    chatId?: string;
}

interface TransactionFilters {
    userId?: number;
    coin?: string;
    status?: string;
    type?: string;
}

export async function login(username: string, password: string) {
    if (username === config.ADMIN_USERNAME && password === config.ADMIN_PASSWORD) {
        const token = jwt.sign({ role: 'admin' }, config.JWT_SECRET, { expiresIn: '1h' });
        return { token, role: 'admin' };
    }

    const warrantHolder = await prisma.warrantHolder.findFirst({
        where: {
            user: { username },
            password
        },
        include: { user: true }
    });

    if (!warrantHolder) {
        throw new Error('Invalid username or password');
    }

    const token = jwt.sign(
        { role: 'warrant-holder', id: warrantHolder.id },
        config.JWT_SECRET,
        { expiresIn: '1h' }
    );
    return { token, role: 'warrant-holder', id: warrantHolder.id };
}

export async function checkAuth(token: string | undefined) {
    if (!token) {
        return { isAuthenticated: false, role: '' };
    }

    try {
        const decoded = jwt.verify(token, config.JWT_SECRET) as { role: string; id?: number };
        return { isAuthenticated: true, role: decoded.role, id: decoded.id };
    } catch (error) {
        console.error('Check-auth error:', error);
        return { isAuthenticated: false, role: '' };
    }
}

export async function getUsers() {
    return prisma.user.findMany({ include: { wallets: true } });
}

export async function getOffers(token: string) {
    const decoded = jwt.verify(token, config.JWT_SECRET) as { role: string; id?: number };
    let offers;
    if (decoded.role === 'admin') {
        offers = await prisma.offer.findMany({
            include: { warrantHolder: { include: { user: { select: { username: true } } } } },
        });
    } else {
        if (!decoded.id) throw new Error('User ID not found');
        offers = await prisma.offer.findMany({
            where: { userId: decoded.id },
            include: { warrantHolder: { include: { user: { select: { username: true } } } } },
        });
    }
    return offers.map((offer) => ({
        ...offer,
        username: offer.warrantHolder?.user?.username,
    }));
}

export async function createOffer(token: string, data: OfferData) {
    if (!data.type || !data.coin || data.amount === undefined || data.minDealAmount === undefined || data.maxDealAmount === undefined || data.markupPercent === undefined) {
        const error = new Error('Missing required fields');
        (error as any).status = 400;
        throw error;
    }

    if (!['BTC', 'LTC', 'USDT', 'XMR'].includes(data.coin)) {
        const error = new Error('Invalid coin. Must be BTC, LTC, USDT, or XMR');
        (error as any).status = 400;
        throw error;
    }

    const decoded = jwt.verify(token, config.JWT_SECRET) as { role: string; id?: number };
    if (decoded.role === 'admin') {
        const error = new Error('Admins cannot create offers');
        (error as any).status = 403;
        throw error;
    }

    const userId = decoded.id;
    if (!userId) {
        const error = new Error('User ID not found');
        (error as any).status = 400;
        throw error;
    }

    const offer = await prisma.offer.create({
        data: {
            type: data.type,
            coin: data.coin,
            amount: parseFloat(data.amount.toString()),
            minDealAmount: parseFloat(data.minDealAmount.toString()),
            maxDealAmount: parseFloat(data.maxDealAmount.toString()),
            markupPercent: parseFloat(data.markupPercent.toString()),
            userId,
        },
        include: { warrantHolder: { include: { user: { select: { username: true } } } } },
    });

    return { ...offer, username: offer.warrantHolder?.user?.username };
}

export async function updateOffer(token: string, id: number, data: OfferData) {
    if (!data.type || !data.coin || data.amount === undefined || data.minDealAmount === undefined || data.maxDealAmount === undefined || data.markupPercent === undefined) {
        const error = new Error('Missing required fields');
        (error as any).status = 400;
        throw error;
    }

    if (!['BTC', 'LTC', 'USDT', 'XMR'].includes(data.coin)) {
        const error = new Error('Invalid coin. Must be BTC, LTC, USDT, or XMR');
        (error as any).status = 400;
        throw error;
    }

    const decoded = jwt.verify(token, config.JWT_SECRET) as { role: string; id?: number };
    if (decoded.role === 'admin') {
        const error = new Error('Admins cannot update offers');
        (error as any).status = 403;
        throw error;
    }

    const userId = decoded.id;
    if (!userId) {
        const error = new Error('User ID not found');
        (error as any).status = 400;
        throw error;
    }

    const offer = await prisma.offer.findUnique({ where: { id } });
    if (!offer) {
        const error = new Error('Offer not found');
        (error as any).status = 404;
        throw error;
    }
    if (offer.userId !== userId) {
        const error = new Error('Unauthorized to update this offer');
        (error as any).status = 403;
        throw error;
    }

    const updatedOffer = await prisma.offer.update({
        where: { id },
        data: {
            type: data.type,
            coin: data.coin,
            amount: parseFloat(data.amount.toString()),
            minDealAmount: parseFloat(data.minDealAmount.toString()),
            maxDealAmount: parseFloat(data.maxDealAmount.toString()),
            markupPercent: parseFloat(data.markupPercent.toString()),
            userId,
        },
        include: { warrantHolder: { include: { user: { select: { username: true } } } } },
    });

    return { ...updatedOffer, username: updatedOffer.warrantHolder?.user?.username };
}

export async function deleteOffer(token: string, id: number) {
    const decoded = jwt.verify(token, config.JWT_SECRET) as { role: string; id?: number };
    const offer = await prisma.offer.findUnique({ where: { id } });
    if (!offer) {
        const error = new Error('Offer not found');
        (error as any).status = 404;
        throw error;
    }
    if (decoded.role !== 'admin' && offer.userId !== decoded.id) {
        const error = new Error('Unauthorized to delete this offer');
        (error as any).status = 403;
        throw error;
    }

    await prisma.offer.delete({ where: { id } });
}

export async function getDeals() {
    return prisma.deal.findMany();
}

export async function getTransaction(id: number) {
    const transaction = await prisma.transaction.findUnique({ where: { id } });
    if (!transaction) {
        const error = new Error('Transaction not found');
        (error as any).status = 404;
        throw error;
    }
    return transaction;
}

export async function getTransactions(filters: TransactionFilters) {
    return prisma.transaction.findMany({
        where: {
            userId: filters.userId,
            coin: filters.coin,
            status: filters.status,
            type: filters.type
        }
    });
}

export async function getWarrantHolders() {
    const warrantHolders = await prisma.warrantHolder.findMany({
        include: {
            user: {
                select: {
                    username: true,
                    wallets: true
                }
            }
        }
    });
    return warrantHolders.map(holder => ({
        ...holder,
        username: holder.user.username,
        wallets: holder.user.wallets
    }));
}

export async function createWarrantHolder(data: WarrantHolderData) {
    if (!data.username && !data.chatId) {
        const error = new Error('Either username or chatId is required');
        (error as any).status = 400;
        throw error;
    }

    let user = await prisma.user.findFirst({
        where: {
            OR: [
                data.username ? { username: data.username } : {},
                data.chatId ? { chatId: data.chatId } : {}
            ].filter(Boolean)
        }
    });

    if (!user) {
        user = await prisma.user.create({
            data: {
                username: data.username || `user_${uuidv4().slice(0, 8)}`,
                chatId: data.chatId || `chat_${uuidv4().slice(0, 8)}`,
                firstName: '',
                lastName: '',
                createdAt: new Date()
            }
        });
    }

    const existingHolder = await prisma.warrantHolder.findUnique({
        where: { userId: user.id }
    });
    if (existingHolder) {
        const error = new Error('User is already a warrant holder');
        (error as any).status = 400;
        throw error;
    }

    const password = uuidv4();
    const warrantHolder = await prisma.warrantHolder.create({
        data: {
            password,
            userId: user.id,
            createdAt: new Date()
        },
        include: { user: { select: { username: true, wallets: true } } }
    });

    return {
        ...warrantHolder,
        username: warrantHolder.user.username,
        wallets: warrantHolder.user.wallets
    };
}

export async function updateWarrantHolderPassword(id: number) {
    const warrantHolder = await prisma.warrantHolder.findUnique({
        where: { id }
    });
    if (!warrantHolder) {
        const error = new Error('Warrant holder not found');
        (error as any).status = 404;
        throw error;
    }

    const newPassword = uuidv4();
    const updatedWarrantHolder = await prisma.warrantHolder.update({
        where: { id },
        data: { password: newPassword },
        include: { user: { select: { username: true, wallets: true } } }
    });

    return {
        ...updatedWarrantHolder,
        username: updatedWarrantHolder.user.username,
        wallets: updatedWarrantHolder.user.wallets
    };
}