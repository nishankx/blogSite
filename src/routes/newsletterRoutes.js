import express from 'express';
import { subscribe, getSubscribers } from '../controllers/newsletterController.js';
import { requireAdminAuth } from '../middleware/authMiddleware.js';

const router = express.Router();

// Public subscription endpoint
router.post('/subscribe', subscribe);

// Admin-only subscribers list endpoint
router.get('/subscribers', requireAdminAuth, getSubscribers);

export default router;
