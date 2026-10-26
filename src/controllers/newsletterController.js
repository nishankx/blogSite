import Subscriber from '../models/Subscriber.js';
import {
    getResendClient,
    getSafeFromEmail,
    getReplyToEmail,
    addContactToAudience,
    sendOnboardingEmail,
} from '../utils/resendHelper.js';

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

        // 1. Check / Save in MongoDB
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

        // If user is already active, we can still re-send or sync, but return friendly note
        if (isExistingActive) {
            return res.status(200).json({
                success: true,
                alreadySubscribed: true,
                message: "You're already subscribed to the newsletter! We'll keep you posted.",
            });
        }

        // 2. Resend Audience Sync
        let audienceResult = { success: false };
        const audienceId = process.env.RESEND_AUDIENCE_ID;
        if (audienceId) {
            audienceResult = await addContactToAudience(normalizedEmail, audienceId);
            if (audienceResult.success && audienceResult.contactId) {
                subscriber.resendContactId = audienceResult.contactId;
                await subscriber.save();
            }
        }

        // 3. Send Onboarding / Welcome Email
        const onboardingResult = await sendOnboardingEmail(normalizedEmail, {
            source: subscriber.source,
        });

        return res.status(200).json({
            success: true,
            message: "Thank you for subscribing! Check your inbox for your welcome email.",
            subscriber: {
                email: subscriber.email,
                subscribedAt: subscriber.createdAt,
            },
            audienceSynced: Boolean(audienceResult.success),
            welcomeEmailSent: Boolean(onboardingResult.success),
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
 * Sync all existing MongoDB subscribers to a Resend Audience
 */
export async function syncSubscribersToAudience(req, res) {
    try {
        const audienceId = process.env.RESEND_AUDIENCE_ID;
        if (!audienceId) {
            return res.status(400).json({
                success: false,
                message: "RESEND_AUDIENCE_ID is not configured in backend environment variables.",
            });
        }

        const activeSubscribers = await Subscriber.find({ status: 'active' });
        if (activeSubscribers.length === 0) {
            return res.status(200).json({
                success: true,
                message: "No active subscribers found in database to sync.",
                totalActive: 0,
                syncedCount: 0,
            });
        }

        let syncedCount = 0;
        let alreadyHasIdCount = 0;
        let lastError = null;
        let isRestricted = false;

        for (const sub of activeSubscribers) {
            const result = await addContactToAudience(sub.email, audienceId);
            if (result.success && result.contactId) {
                sub.resendContactId = result.contactId;
                await sub.save();
                syncedCount++;
            } else {
                if (result.isRestrictedKey) {
                    isRestricted = true;
                    lastError = "Resend API key is restricted to sending emails only.";
                    break;
                }
                if (result.error) {
                    lastError = result.error;
                }
            }
        }

        if (isRestricted) {
            return res.status(403).json({
                success: false,
                message:
                    "Your RESEND_API_KEY only has 'Sending access'. To sync audiences & contacts, create a new API key with 'Full access' in the Resend dashboard (https://resend.com/api-keys) and update backend/.env.",
                totalActive: activeSubscribers.length,
                syncedCount,
            });
        }

        return res.status(200).json({
            success: true,
            message: `Successfully synced ${syncedCount} of ${activeSubscribers.length} subscriber(s) to Resend Audience.`,
            totalActive: activeSubscribers.length,
            syncedCount,
            lastNotice: lastError,
        });
    } catch (error) {
        console.error("Error in syncSubscribersToAudience:", error);
        return res.status(500).json({
            success: false,
            message: error.message || "Failed to sync subscribers to Resend Audience.",
        });
    }
}

/**
 * Send a Test Onboarding Email (Admin Protected)
 */
export async function sendTestOnboardingEmail(req, res) {
    try {
        const targetEmail = req.body.email || process.env.RESEND_REPLY_TO || 'nishankashyapofficial@gmail.com';
        const result = await sendOnboardingEmail(targetEmail, { isTest: true });

        if (!result.success) {
            return res.status(400).json({
                success: false,
                message: result.error || "Failed to deliver test onboarding email.",
            });
        }

        return res.status(200).json({
            success: true,
            message: `Test onboarding email dispatched to ${targetEmail}! Check your inbox.`,
            targetEmail,
            emailId: result.emailId,
        });
    } catch (error) {
        return res.status(500).json({
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
            .select('email createdAt source resendContactId');

        return res.status(200).json({
            success: true,
            total,
            active,
            unsubscribed,
            audienceConfigured: Boolean(process.env.RESEND_AUDIENCE_ID),
            subscribers: recent,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message || "Failed to fetch subscriber stats.",
        });
    }
}
