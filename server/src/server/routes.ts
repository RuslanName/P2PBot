import { Router } from 'express';
import { authMiddleware } from './middleware';
import { login, checkAuth, getUsers, getOffers, createOffer, updateOffer, deleteOffer, getDeals, getTransaction, getTransactions, getWarrantHolders, createWarrantHolder, updateWarrantHolderPassword } from './controllers';

export const router = Router();

router.post('/login', login);
router.get('/check-auth', checkAuth);

router.use(authMiddleware);

router.get('/users', getUsers);
router.get('/offers', getOffers);
router.post('/offers', createOffer);
router.put('/offers/:id', updateOffer);
router.delete('/offers/:id', deleteOffer);
router.get('/deals', getDeals);
router.get('/transactions/:id', getTransaction);
router.get('/transactions', getTransactions);
router.get('/warrant-holders', getWarrantHolders);
router.post('/warrant-holders', createWarrantHolder);
router.put('/warrant-holders/:id/password', updateWarrantHolderPassword);