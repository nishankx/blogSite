import express from 'express';
import { subscribeNewsletter } from '../controllers/newsletterController.js';

const router = express.Router();

// Public subscription route
router.post('/subscribe', subscribeNewsletter);

export default router;
