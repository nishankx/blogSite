import express from 'express';
import {
    subscribeNewsletter,
    syncSubscribersToAudience,
    getSubscribersStats,
} from '../controllers/newsletterController.js';
import { requireAdminAuth } from '../middleware/authMiddleware.js';

const router = express.Router();

// Public subscription route
router.post('/subscribe', subscribeNewsletter);

// Admin-protected routes
router.post('/sync-audience', requireAdminAuth, syncSubscribersToAudience);
router.get('/stats', requireAdminAuth, getSubscribersStats);

export default router;
