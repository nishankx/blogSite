import { Resend } from 'resend';
import Subscriber from '../models/Subscriber.js';

const getResendClient = () => {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) return null;
    return new Resend(apiKey);
};

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
        let isNewSubscriber = false;

        if (subscriber) {
            if (subscriber.status === 'active') {
                return res.status(200).json({
                    success: true,
                    alreadySubscribed: true,
                    message: "You're already subscribed to the newsletter!",
                });
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
            isNewSubscriber = true;
        }

        // 2. Resend Integration
        const resend = getResendClient();
        let resendContactId = null;

        if (resend) {
            // Add to Audience if RESEND_AUDIENCE_ID is provided
            if (process.env.RESEND_AUDIENCE_ID) {
                try {
                    const contactRes = await resend.contacts.create({
                        email: normalizedEmail,
                        unsubscribed: false,
                        audienceId: process.env.RESEND_AUDIENCE_ID,
                    });
                    if (contactRes?.data?.id) {
                        resendContactId = contactRes.data.id;
                        subscriber.resendContactId = resendContactId;
                        await subscriber.save();
                    }
                } catch (contactErr) {
                    console.warn("Resend contact creation notice:", contactErr.message);
                }
            }

            // Send Welcome Email
            try {
                // Resend requires a verified custom domain. If a free provider like @gmail.com is set,
                // fallback to Resend's default onboarding address to prevent 403 validation errors.
                let fromEmail = process.env.RESEND_FROM_EMAIL || 'Nishan <onboarding@resend.dev>';
                if (/@(gmail|yahoo|outlook|hotmail)\.com/i.test(fromEmail)) {
                    fromEmail = 'Nishan <onboarding@resend.dev>';
                }

                await resend.emails.send({
                    from: fromEmail,
                    to: normalizedEmail,
                    reply_to: process.env.RESEND_REPLY_TO || 'nishankashyapofficial@gmail.com',
                    subject: "Welcome to my newsletter! ✨",
                    html: `
                        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 580px; margin: 0 auto; padding: 36px 24px; background-color: #0d0d0e; color: #ffffff; border-radius: 16px; border: 1px solid #27272a;">
                            <div style="margin-bottom: 24px;">
                                <span style="font-family: monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 0.25em; color: #a1a1aa;">
                                    NEWSLETTER SUBSCRIPTION
                                </span>
                                <h1 style="font-size: 28px; font-weight: 700; margin: 8px 0 16px; color: #ffffff;">
                                    Welcome aboard! 🚀
                                </h1>
                            </div>
                            <p style="font-size: 15px; line-height: 1.6; color: #d4d4d8; margin-bottom: 20px;">
                                Thank you for subscribing. You'll get fresh write-ups, engineering deep dives, and ideas on modern web development directly to your inbox.
                            </p>
                            <p style="font-size: 15px; line-height: 1.6; color: #d4d4d8; margin-bottom: 28px;">
                                No spam, no fluff — only thoughtful articles and insights whenever a new piece is published.
                            </p>
                            <div style="padding: 16px 20px; background: rgba(255, 255, 255, 0.05); border-radius: 12px; border-left: 3px solid #ffffff; margin-bottom: 28px;">
                                <p style="font-size: 13px; color: #e4e4e7; margin: 0; font-style: italic;">
                                    "Documenting the questions I ask, the things I build, and the ideas I explore along the way."
                                </p>
                            </div>
                            <div style="border-top: 1px solid #27272a; padding-top: 20px; font-size: 12px; color: #71717a;">
                                <p style="margin: 0;">Sent with care from Nishan's Portfolio & Blog.</p>
                            </div>
                        </div>
                    `,
                });
            } catch (emailErr) {
                console.warn("Resend email dispatch notice:", emailErr.message);
            }
        } else {
            console.log("[Newsletter] RESEND_API_KEY not configured. Subscriber safely stored in MongoDB.");
        }

        return res.status(200).json({
            success: true,
            message: "Thank you for subscribing! Check your inbox for updates.",
            subscriber: {
                email: subscriber.email,
                subscribedAt: subscriber.createdAt,
            },
        });
    } catch (error) {
        console.error("Error in subscribeNewsletter:", error);
        return res.status(500).json({
            success: false,
            message: error.message || "Failed to process newsletter subscription.",
        });
    }
}
