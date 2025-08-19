import { Router } from 'express';
import { authMiddleware } from './middleware';
import {
    login,
    checkAuth,
    getUsers,
    updateUser,
    getOffers,
    createOffer,
    updateOffer,
    getDeals,
    updateDeal,
    getDealsFiltered,
    getWarrantHolders,
    createWarrantHolder,
    updateWarrantHolder,
    getSupportTickets,
    updateSupportTicket,
    getAmlVerifications,
    updateAmlVerification
} from './controllers';

export const router = Router();

router.post('/login', login);
router.get('/check-auth', checkAuth);

router.use(authMiddleware);

router.get('/users', getUsers);
router.put('/users/:id', updateUser);
router.get('/offers', getOffers);
router.post('/offers', createOffer);
router.put('/offers/:id', updateOffer);
router.get('/deals', getDeals);
router.get('/deals/filter', getDealsFiltered);
router.put('/deals/:id', updateDeal);
router.get('/warrant-holders', getWarrantHolders);
router.post('/warrant-holders', createWarrantHolder);
router.put('/warrant-holders/:id', updateWarrantHolder);
router.get('/support-tickets', getSupportTickets);
router.put('/support-tickets/:id', updateSupportTicket);
router.get('/aml-verifications', getAmlVerifications);
router.put('/aml-verifications/:id', updateAmlVerification);