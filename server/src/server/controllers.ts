import { Request, Response } from 'express';
import * as services from './services';
import {CreateOfferDto, UpdateOfferDto, UpdateWarrantHolderDto, UpdateUserDto, UpdateDealDto} from '../types';

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
        res.status(500).json({ error: 'Failed to fetch usersTable' });
    }
}

export async function updateUser(req: Request, res: Response) {
    const { id } = req.params;
    const updateDto: UpdateUserDto = req.body;
    try {
        const updatedUser = await services.updateUser(parseInt(id), updateDto);
        res.json(updatedUser);
    } catch (error: any) {
        res.status(error.status || 500).json({ error: error.message });
    }
}

export async function getOffers(req: Request, res: Response) {
    const token = req.cookies.token;
    try {
        const offers = await services.getOffers(token);
        res.json(offers);
    } catch (error: any) {
        res.status(500).json({ error: 'Failed to fetch offersTable' });
    }
}

export async function createOffer(req: Request, res: Response) {
    const token = req.cookies.token;
    const offerDto: CreateOfferDto = req.body;
    try {
        if (offerDto.fiatCurrency.length !== offerDto.warrantHolderPaymentDetails.length) {
            return res.status(400).json({ error: 'Количество реквизитов должно соответствовать количеству фиатных валют' });
        }
        const offer = await services.createOffer(token, offerDto);
        res.json(offer);
    } catch (error: any) {
        res.status(error.status || 500).json({ error: error.message });
    }
}

export async function updateOffer(req: Request, res: Response) {
    const token = req.cookies.token;
    const { id } = req.params;
    const offerDto: UpdateOfferDto = req.body;
    try {
        if (offerDto.fiatCurrency && offerDto.warrantHolderPaymentDetails &&
            offerDto.fiatCurrency.length !== offerDto.warrantHolderPaymentDetails.length) {
            return res.status(400).json({ error: 'Количество реквизитов должно соответствовать количеству фиатных валют' });
        }
        const updatedOffer = await services.updateOffer(token, parseInt(id), offerDto);
        res.json(updatedOffer);
    } catch (error: any) {
        res.status(error.status || 500).json({ error: error.message });
    }
}

export async function getDeals(req: Request, res: Response) {
    try {
        const deals = await services.getDeals();
        res.json(deals);
    } catch (error: any) {
        res.status(500).json({ error: 'Failed to fetch dealsTable' });
    }
}

export async function getDealsFiltered(req: Request, res: Response) {
    try {
        const deals = await services.getDealsFiltered(req.query);
        res.json(deals);
    } catch (error: any) {
        res.status(500).json({ error: 'Failed to fetch dealsTable' });
    }
}

export async function updateDeal(req: Request, res: Response) {
    const { id } = req.params;
    const updateDto: UpdateDealDto = req.body;
    try {
        const updatedDeal = await services.updateDeal(parseInt(id), updateDto);
        res.json(updatedDeal);
    } catch (error: any) {
        res.status(error.status || 500).json({ error: error.message });
    }
}

export async function getWarrantHolders(req: Request, res: Response) {
    const token = req.cookies.token;
    const { role, id } = (await services.checkAuth(token)) || {};
    try {
        const warrantHolders = await services.getWarrantHolders(role || '', id);
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

export async function updateWarrantHolder(req: Request, res: Response) {
    const { id } = req.params;
    const updateDto: UpdateWarrantHolderDto = req.body;
    try {
        const updatedWarrantHolder = await services.updateWarrantHolder(parseInt(id), updateDto);
        res.json(updatedWarrantHolder);
    } catch (error: any) {
        res.status(error.status || 500).json({ error: error.message });
    }
}