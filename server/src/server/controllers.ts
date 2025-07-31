import { Request, Response } from 'express';
import * as services from './services';

export async function login(req: Request, res: Response) {
    const { username, password } = req.body;
    try {
        const result = await services.login(username, password);
        res.cookie('token', result.token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 3600000
        });
        res.json({
            success: true,
            isAuthenticated: true,
            role: result.role,
            id: result.id
        });
    } catch (error: any) {
        res.status(401).json({ error: error.message });
    }
}

export async function checkAuth(req: Request, res: Response) {
    const token = req.cookies.token;
    try {
        const result = await services.checkAuth(token);
        res.json(result);
    } catch (error: any) {
        res.json({ isAuthenticated: false, role: '' });
    }
}

export async function getUsers(req: Request, res: Response) {
    try {
        const users = await services.getUsers();
        res.json(users);
    } catch (error: any) {
        res.status(500).json({ error: 'Failed to fetch users' });
    }
}

export async function getOffers(req: Request, res: Response) {
    const token = req.cookies.token;
    try {
        const offers = await services.getOffers(token);
        res.json(offers);
    } catch (error: any) {
        res.status(500).json({ error: 'Failed to fetch offers' });
    }
}

export async function createOffer(req: Request, res: Response) {
    const token = req.cookies.token;
    const { type, coin, amount, minDealAmount, maxDealAmount, markupPercent } = req.body;
    try {
        const offer = await services.createOffer(token, { type, coin, amount, minDealAmount, maxDealAmount, markupPercent });
        res.json(offer);
    } catch (error: any) {
        res.status(error.status || 500).json({ error: error.message });
    }
}

export async function updateOffer(req: Request, res: Response) {
    const token = req.cookies.token;
    const { id } = req.params;
    const { type, coin, amount, minDealAmount, maxDealAmount, markupPercent } = req.body;
    try {
        const updatedOffer = await services.updateOffer(token, parseInt(id), { type, coin, amount, minDealAmount, maxDealAmount, markupPercent });
        res.json(updatedOffer);
    } catch (error: any) {
        res.status(error.status || 500).json({ error: error.message });
    }
}

export async function deleteOffer(req: Request, res: Response) {
    const token = req.cookies.token;
    const { id } = req.params;
    try {
        await services.deleteOffer(token, parseInt(id));
        res.json({ success: true });
    } catch (error: any) {
        res.status(error.status || 500).json({ error: error.message });
    }
}

export async function getDeals(req: Request, res: Response) {
    try {
        const deals = await services.getDeals();
        res.json(deals);
    } catch (error: any) {
        res.status(500).json({ error: 'Failed to fetch deals' });
    }
}

export async function getTransaction(req: Request, res: Response) {
    try {
        const transaction = await services.getTransaction(parseInt(req.params.id));
        res.json(transaction);
    } catch (error: any) {
        res.status(error.status || 500).json({ error: error.message });
    }
}

export async function getTransactions(req: Request, res: Response) {
    const { userId, coin, status, type } = req.query;
    try {
        const transactions = await services.getTransactions({
            userId: userId ? parseInt(userId as string) : undefined,
            coin: coin as string | undefined,
            status: status as string | undefined,
            type: type as string | undefined
        });
        res.json(transactions);
    } catch (error: any) {
        res.status(500).json({ error: 'Failed to fetch transactions' });
    }
}

export async function getWarrantHolders(req: Request, res: Response) {
    try {
        const warrantHolders = await services.getWarrantHolders();
        res.json(warrantHolders);
    } catch (error: any) {
        res.status(500).json({ error: 'Failed to fetch warrant holders' });
    }
}

export async function createWarrantHolder(req: Request, res: Response) {
    const { username, chatId } = req.body;
    try {
        const warrantHolder = await services.createWarrantHolder({ username, chatId });
        res.json(warrantHolder);
    } catch (error: any) {
        res.status(error.status || 500).json({ error: error.message });
    }
}

export async function updateWarrantHolderPassword(req: Request, res: Response) {
    const { id } = req.params;
    try {
        const updatedWarrantHolder = await services.updateWarrantHolderPassword(parseInt(id));
        res.json(updatedWarrantHolder);
    } catch (error: any) {
        res.status(error.status || 500).json({ error: error.message });
    }
}