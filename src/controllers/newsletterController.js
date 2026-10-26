import Subscriber from '../models/Subscriber.js';
import { sendWelcomeEmail } from '../utils/mailService.js';

export async function subscribe(req, res) {
    try {
        const { email } = req.body;

        if (!email || typeof email !== 'string' || !/^\S+@\S+\.\S+$/.test(email.trim())) {
            return res.status(400).json({
                success: false,
                message: 'Please provide a valid email address.',
            });
        }

        const normalizedEmail = email.trim().toLowerCase();

        // Upsert subscriber in MongoDB
        const subscriber = await Subscriber.findOneAndUpdate(
            { email: normalizedEmail },
            { status: 'active' },
            { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
        );

        // Send HTTP response IMMEDIATELY so the client never waits or hangs
        res.status(200).json({
            success: true,
            message: 'Thank you for subscribing! Check your inbox for confirmation.',
            subscriber,
        });

        // Trigger welcome email in the background asynchronously
        sendWelcomeEmail(normalizedEmail).catch((err) => {
            console.error('[Newsletter Welcome Email Background Error]:', err.message);
        });
    } catch (err) {
        console.error('Error in subscribe controller:', err);
        return res.status(500).json({
            success: false,
            message: 'Failed to process subscription. Please try again.',
        });
    }
}

export async function getSubscribers(req, res) {
    try {
        const subscribers = await Subscriber.find().sort({ createdAt: -1 });
        const activeCount = subscribers.filter((s) => s.status === 'active').length;

        res.status(200).json({
            success: true,
            total: subscribers.length,
            activeCount,
            subscribers,
        });
    } catch (err) {
        console.error('Error in getSubscribers controller:', err);
        res.status(500).json({ success: false, message: 'Failed to fetch subscribers' });
    }
}
