import { Request, Response } from 'express';
import * as services from './services';
import {
    CreateOfferDto,
    UpdateOfferDto,
    UpdateWarrantHolderDto,
    UpdateUserDto,
    UpdateDealDto,
    UpdateSupportTicketDto,
    UpdateAmlVerificationDto, SearchFilterParams
} from '../types';

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
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 10;
    const search = (req.query.search as string)?.replace(/[^a-zA-Z0-9\s]/g, '');
    const params: SearchFilterParams = {
        search: search || undefined,
        isBlocked: req.query.isBlocked === 'true' ? true : req.query.isBlocked === 'false' ? false : undefined,
        createdAtStart: req.query.createdAtStart as string,
        createdAtEnd: req.query.createdAtEnd as string
    };
    try {
        const result = await services.getUsers(page, pageSize, params);
        res.json(result);
    } catch (error: any) {
        console.error('Error fetching users:', error);
        res.status(400).json({ error: 'Некорректный запрос поиска. Проверьте параметры.' });
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
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 10;
    const search = (req.query.search as string)?.replace(/[^a-zA-Z0-9\s]/g, '');
    const params: SearchFilterParams = {
        search: search || undefined,
        status: req.query.status as string,
        type: req.query.type as string,
        fiatCurrency: req.query.fiatCurrency as string,
        createdAtStart: req.query.createdAtStart as string,
        createdAtEnd: req.query.createdAtEnd as string
    };
    try {
        const result = await services.getOffers(token, page, pageSize, params);
        res.json(result);
    } catch (error: any) {
        console.error('Error fetching offers:', error);
        res.status(400).json({ error: 'Некорректный запрос поиска. Проверьте параметры.' });
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
    const token = req.cookies.token;
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 10;
    const search = (req.query.search as string)?.replace(/[^a-zA-Z0-9\s]/g, '');
    const params: SearchFilterParams = {
        search: search || undefined,
        status: req.query.status as string,
        createdAtStart: req.query.createdAtStart as string,
        createdAtEnd: req.query.createdAtEnd as string
    };
    try {
        const result = await services.getDeals(token, page, pageSize, params);
        res.json(result);
    } catch (error: any) {
        console.error('Error fetching deals:', error);
        res.status(400).json({ error: 'Некорректный запрос поиска. Проверьте параметры.' });
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
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 10;
    const search = (req.query.search as string)?.replace(/[^a-zA-Z0-9\s]/g, '');
    const params: SearchFilterParams = {
        search: search || undefined,
        isBlocked: req.query.isBlocked === 'true' ? true : req.query.isBlocked === 'false' ? false : undefined,
        createdAtStart: req.query.createdAtStart as string,
        createdAtEnd: req.query.createdAtEnd as string
    };
    try {
        const { role, id } = (await services.checkAuth(token)) || {};
        const result = await services.getWarrantHolders(role || '', id, page, pageSize, params);
        res.json(result);
    } catch (error: any) {
        console.error('Error fetching warrant holders:', error);
        res.status(400).json({ error: 'Некорректный запрос поиска. Проверьте параметры.' });
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

export async function getSupportTickets(req: Request, res: Response) {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 10;
    const search = (req.query.search as string)?.replace(/[^a-zA-Z0-9\s]/g, '');
    const params: SearchFilterParams = {
        search: search || undefined,
        status: req.query.status as string,
        createdAtStart: req.query.createdAtStart as string,
        createdAtEnd: req.query.createdAtEnd as string
    };
    try {
        const result = await services.getSupportTickets(page, pageSize, params);
        res.json(result);
    } catch (error: any) {
        console.error('Error fetching support tickets:', error);
        res.status(400).json({ error: 'Некорректный запрос поиска. Проверьте параметры.' });
    }
}

export async function updateSupportTicket(req: Request, res: Response) {
    const { id } = req.params;
    const updateDto: UpdateSupportTicketDto = req.body;
    try {
        const updatedTicket = await services.updateSupportTicket(parseInt(id), updateDto);
        res.json(updatedTicket);
    } catch (error: any) {
        res.status(error.status || 500).json({ error: error.message });
    }
}

export async function getAmlVerifications(req: Request, res: Response) {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 10;
    const search = (req.query.search as string)?.replace(/[^a-zA-Z0-9\s]/g, '');
    const params: SearchFilterParams = {
        search: search || undefined,
        status: req.query.status as string,
        createdAtStart: req.query.createdAtStart as string,
        createdAtEnd: req.query.createdAtEnd as string
    };
    try {
        const result = await services.getAmlVerifications(page, pageSize, params);
        res.json(result);
    } catch (error: any) {
        console.error('Error fetching AML verifications:', error);
        res.status(400).json({ error: 'Некорректный запрос поиска. Проверьте параметры.' });
    }
}

export async function updateAmlVerification(req: Request, res: Response) {
    const { id } = req.params;
    const updateDto: UpdateAmlVerificationDto = req.body;
    try {
        const updatedVerification = await services.updateAmlVerification(parseInt(id), updateDto);
        res.json(updatedVerification);
    } catch (error: any) {
        res.status(error.status || 500).json({ error: error.message });
    }
}