import Subscriber from '../models/Subscriber.js';
import { sendOnboardingEmail } from '../utils/mailerHelper.js';

/**
 * Public Newsletter Subscription Endpoint
 * Saves subscriber in MongoDB and dispatches the welcome onboarding email
 */
export async function subscribeNewsletter(req, res) {
    try {
        const { email, source } = req.body;

        if (!email || typeof email !== 'string' || !email.trim()) {
            return res.status(400).json({
                success: false,
                message: "A valid email address is required.",
            });
        }

        const normalizedEmail = email.trim().toLowerCase();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(normalizedEmail)) {
            return res.status(400).json({
                success: false,
                message: "Please enter a valid email format.",
            });
        }

        // 1. Check & Save in MongoDB
        let subscriber = await Subscriber.findOne({ email: normalizedEmail });
        let isExistingActive = false;

        if (subscriber) {
            if (subscriber.status === 'active') {
                isExistingActive = true;
            } else {
                subscriber.status = 'active';
                await subscriber.save();
            }
        } else {
            subscriber = new Subscriber({
                email: normalizedEmail,
                source: source || 'blog',
                status: 'active',
            });
            await subscriber.save();
        }

        if (isExistingActive) {
            return res.status(200).json({
                success: true,
                alreadySubscribed: true,
                message: "You're already subscribed to the newsletter! We'll keep you posted.",
            });
        }

        // 2. Dispatch Onboarding Welcome Email in background (non-blocking so API responds immediately)
        sendOnboardingEmail(normalizedEmail, { source: subscriber.source }).catch((err) => {
            console.error('[Newsletter Onboarding Background Error]:', err.message);
        });

        // 3. Return success immediately without waiting for SMTP/mail network
        return res.status(200).json({
            success: true,
            message: "Thank you for subscribing! Check your inbox for your welcome email.",
            subscriber: {
                email: subscriber.email,
                subscribedAt: subscriber.createdAt,
            },
            welcomeEmailSent: true,
        });
    } catch (error) {
        console.error("Error in subscribeNewsletter:", error);
        return res.status(500).json({
            success: false,
            message: error.message || "Failed to process newsletter subscription.",
        });
    }
}

/**
 * Send a Test Onboarding Email (Admin Protected)
 */
export async function sendTestOnboardingEmail(req, res) {
    try {
        const targetEmail = req.body.email || process.env.EMAIL_USER || 'nishankashyapofficial@gmail.com';

        // Set a strict 7-second safety timeout so it never hangs indefinitely on Render
        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Email dispatch timed out after 7s. On Render Free Tier, outgoing SMTP ports 25, 465, and 587 are blocked. Consider using an HTTP-based provider like Brevo or Resend.')), 7000)
        );

        const result = await Promise.race([
            sendOnboardingEmail(targetEmail, { isTest: true }),
            timeoutPromise,
        ]);

        if (!result.success) {
            return res.status(400).json({
                success: false,
                message: result.error || "Failed to deliver test onboarding email.",
            });
        }

        return res.status(200).json({
            success: true,
            message: `Test onboarding email delivered to ${targetEmail}! Check your inbox.`,
            targetEmail,
            messageId: result.messageId,
            provider: result.provider,
        });
    } catch (error) {
        return res.status(400).json({
            success: false,
            message: error.message || "Failed to send test onboarding email.",
        });
    }
}

/**
 * Get subscriber statistics (Admin protected)
 */
export async function getSubscribersStats(req, res) {
    try {
        const total = await Subscriber.countDocuments({});
        const active = await Subscriber.countDocuments({ status: 'active' });
        const unsubscribed = await Subscriber.countDocuments({ status: 'unsubscribed' });
        const recent = await Subscriber.find({ status: 'active' })
            .sort({ createdAt: -1 })
            .limit(20)
            .select('email createdAt source');

        return res.status(200).json({
            success: true,
            total,
            active,
            unsubscribed,
            subscribers: recent,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message || "Failed to fetch subscriber stats.",
        });
    }
}
