import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { config } from '../config/env';

const prisma = new PrismaClient();

export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
    const token = req.cookies.token || req.headers.authorization?.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'No token provided' });
    }

    try {
        const decoded = jwt.verify(token, config.JWT_SECRET) as { role: string; id?: number };

        if (decoded.role === 'warrant-holder' && decoded.id) {
            const warrantHolder = await prisma.warrantHolder.findUnique({
                where: { id: decoded.id }
            });

            if (warrantHolder?.isBlocked) {
                return res.status(403).json({ error: 'Account is blocked' });
            }
        }

        next();
    } catch (error) {
        console.error('Token verification error:', error);
        res.status(401).json({ error: 'Invalid token' });
    }
}