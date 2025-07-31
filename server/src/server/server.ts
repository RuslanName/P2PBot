import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { config } from '../config/env';
import { router } from './routes';

export const app = express();

app.use(express.json());
app.use(cors({
    origin: config.FRONTEND_URL,
    credentials: true,
}));
app.use(cookieParser());

app.use('/api', router);