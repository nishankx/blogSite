import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

export function getFrontendUrl() {
    return (process.env.FRONTEND_URL || 'http://localhost:5173').trim().replace(/\/+$/, '');
}

function getTransporter() {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_APP_PASSWORD) {
        return null;
    }
    return nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER.trim(),
            pass: process.env.EMAIL_APP_PASSWORD.replace(/\s+/g, ''),
        },
        connectionTimeout: 5000,
        greetingTimeout: 5000,
        socketTimeout: 8000,
    });
}

/**
 * Universal email dispatcher (supports Brevo HTTPS, Resend HTTPS, or Gmail SMTP)
 */
export async function sendEmail({ to, subject, html, text }) {
    const senderName = process.env.EMAIL_SENDER_NAME || 'Nishan Kashyap';
    const senderEmail = process.env.EMAIL_USER || 'nishankashyapofficial@gmail.com';
    // 1. If Brevo HTTP API is configured (HTTPS port 443 - works everywhere including Render Free Tier)
    if (process.env.BREVO_API_KEY) {
        try {
            const res = await fetch('https://api.brevo.com/v3/smtp/email', {
                method: 'POST',
                headers: {
                    'accept': 'application/json',
                    'api-key': process.env.BREVO_API_KEY.trim(),
                    'content-type': 'application/json',
                },
                body: JSON.stringify({
                    sender: { name: senderName, email: senderEmail },
                    to: [{ email: to }],
                    subject,
                    htmlContent: html,
                    textContent: text || '',
                }),
            });
            if (res.ok) {
                console.log(`[MailService via Brevo] Delivered to ${to}`);
                return true;
            }
        } catch (err) {
            console.error('[MailService Brevo Error]:', err.message);
        }
    }

    // 2. If Resend HTTP API is configured
    if (process.env.RESEND_API_KEY) {
        try {
            const res = await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${process.env.RESEND_API_KEY.trim()}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    from: `${senderName} <${process.env.RESEND_FROM || 'onboarding@resend.dev'}>`,
                    to: [to],
                    subject,
                    html,
                    text: text || '',
                }),
            });
            if (res.ok) {
                console.log(`[MailService via Resend] Delivered to ${to}`);
                return true;
            }
        } catch (err) {
            console.error('[MailService Resend Error]:', err.message);
        }
    }

    // 3. Gmail SMTP fallback via Nodemailer
    const transporter = getTransporter();
    if (transporter) {
        try {
            const info = await transporter.sendMail({
                from: `"${senderName}" <${senderEmail}>`,
                to,
                subject,
                text,
                html,
            });
            console.log(`[MailService via SMTP] Delivered to ${to} (MessageId: ${info.messageId})`);
            return true;
        } catch (err) {
            console.error(`[MailService SMTP Error] Failed sending to ${to}:`, err.message);
            return false;
        }
    }

    console.warn(`[MailService] No email credentials configured to send email to ${to}`);
    return false;
}

/**
 * Custom Welcome Onboarding Email
 */
export async function sendWelcomeEmail(toEmail) {
    const baseUrl = getFrontendUrl();
    const blogsUrl = `${baseUrl}/blogs`;
    const subject = "Welcome to Nishan's Newsletter 🚀";

    const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to the Newsletter</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #050505; color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #050505; padding: 40px 15px;">
            <tr>
                <td align="center">
                    <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 580px; background-color: #0d0d0f; border: 1px solid #27272a; border-radius: 16px; overflow: hidden; padding: 36px 30px;">
                        <tr>
                            <td>
                                <div style="display: inline-block; padding: 4px 12px; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); border-radius: 999px; font-size: 11px; font-family: monospace; letter-spacing: 0.15em; text-transform: uppercase; color: #a1a1aa; margin-bottom: 20px;">
                                    WELCOME ABOARD
                                </div>
                                <h1 style="margin: 0 0 16px 0; font-size: 26px; font-weight: 700; color: #ffffff; letter-spacing: -0.02em;">
                                    Hey there! Glad to have you here.
                                </h1>

                                <div style="margin: 20px 0 24px 0; padding: 18px 22px; background: rgba(255, 255, 255, 0.04); border-left: 3px solid #ffffff; border-radius: 8px;">
                                    <p style="margin: 0; font-size: 16px; font-style: italic; color: #f4f4f5; line-height: 1.6;">
                                        “Documenting the questions I ask, the things I build, the ideas I explore, and the person I become along the way.”
                                    </p>
                                </div>

                                <p style="font-size: 15px; line-height: 1.6; color: #a1a1aa; margin: 0 0 16px 0;">
                                    Thank you for subscribing to my newsletter. You're now on the list to receive engineering write-ups, deep dives into full-stack systems, machine learning ideas, and unfiltered build logs straight to your inbox.
                                </p>
                                <p style="font-size: 15px; line-height: 1.6; color: #a1a1aa; margin: 0 0 28px 0;">
                                    I only write when I have something meaningful and practical to share — no spam, no fluff.
                                </p>
                                <div style="margin-bottom: 16px;">
                                    <a href="${blogsUrl}" target="_blank" rel="noopener noreferrer" style="display: inline-block; background-color: #ffffff; color: #000000; font-weight: 600; font-size: 14px; text-decoration: none; padding: 12px 26px; border-radius: 10px; box-shadow: 0 4px 12px rgba(255, 255, 255, 0.15);">
                                        Explore the Articles →
                                    </a>
                                </div>
                                <p style="font-size: 12px; color: #71717a; margin: 0 0 28px 0; word-break: break-all;">
                                    Direct link: <a href="${blogsUrl}" target="_blank" rel="noopener noreferrer" style="color: #a1a1aa; text-decoration: underline;">${blogsUrl}</a>
                                </p>
                                <hr style="border: none; border-top: 1px solid #27272a; margin: 28px 0;" />
                                <p style="font-size: 12px; color: #71717a; margin: 0; line-height: 1.6;">
                                    Sent with ❤️ by <strong>Nishan Kashyap</strong><br />
                                    Software Engineer & Builder • <a href="${baseUrl}" target="_blank" rel="noopener noreferrer" style="color: #a1a1aa; text-decoration: underline;">Portfolio</a>
                                </p>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
    </body>
    </html>
    `;

    return sendEmail({
        to: toEmail,
        subject,
        html,
        text: `Hey there! Glad to have you here.\n\n"Documenting the questions I ask, the things I build, the ideas I explore, and the person I become along the way."\n\nThank you for subscribing to my newsletter. You will receive engineering deep dives and build logs straight to your inbox.\n\nVisit ${blogsUrl} to read existing articles.\n\n— Nishan Kashyap`,
    });
}

/**
 * Broadcast an email to all active subscribers when a new post is published
 */
export async function broadcastPostEmail(blog, subscribers) {
    if (!subscribers || subscribers.length === 0) {
        console.log('[MailService] No active subscribers to broadcast to.');
        return 0;
    }

    const baseUrl = getFrontendUrl();
    const postUrl = `${baseUrl}/blogs/${blog.slug || blog._id}`;
    const subject = `New Article: ${blog.title}`;

    const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${blog.title}</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #050505; color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #050505; padding: 40px 15px;">
            <tr>
                <td align="center">
                    <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 580px; background-color: #0d0d0f; border: 1px solid #27272a; border-radius: 16px; overflow: hidden; padding: 36px 30px;">
                        <tr>
                            <td>
                                <div style="display: inline-block; padding: 4px 12px; background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 999px; font-size: 11px; font-family: monospace; letter-spacing: 0.15em; text-transform: uppercase; color: #34d399; margin-bottom: 20px;">
                                    NEW ARTICLE PUBLISHED
                                </div>
                                <h1 style="margin: 0 0 16px 0; font-size: 24px; font-weight: 700; color: #ffffff; letter-spacing: -0.02em; line-height: 1.3;">
                                    <a href="${postUrl}" target="_blank" rel="noopener noreferrer" style="color: #ffffff; text-decoration: none;">
                                        ${blog.title}
                                    </a>
                                </h1>
                                ${blog.excerpt ? `
                                <p style="font-size: 15px; line-height: 1.6; color: #d4d4d8; margin: 0 0 24px 0; font-style: italic;">
                                    "${blog.excerpt}"
                                </p>` : ''}
                                <div style="margin-bottom: 16px;">
                                    <a href="${postUrl}" target="_blank" rel="noopener noreferrer" style="display: inline-block; background-color: #ffffff; color: #000000; font-weight: 600; font-size: 14px; text-decoration: none; padding: 12px 26px; border-radius: 10px; box-shadow: 0 4px 12px rgba(255, 255, 255, 0.15);">
                                        Read Full Article →
                                    </a>
                                </div>
                                <p style="font-size: 12px; color: #71717a; margin: 0 0 26px 0; word-break: break-all;">
                                    Direct link: <a href="${postUrl}" target="_blank" rel="noopener noreferrer" style="color: #a1a1aa; text-decoration: underline;">${postUrl}</a>
                                </p>
                                <hr style="border: none; border-top: 1px solid #27272a; margin: 28px 0;" />
                                <p style="font-size: 12px; color: #71717a; margin: 0; line-height: 1.5;">
                                    You received this email because you subscribed to Nishan Kashyap's newsletter.<br />
                                    <a href="${baseUrl}/blogs" target="_blank" rel="noopener noreferrer" style="color: #a1a1aa; text-decoration: underline;">View All Articles</a>
                                </p>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
    </body>
    </html>
    `;

    let sentCount = 0;
    for (const sub of subscribers) {
        try {
            await sendEmail({
                to: sub.email,
                subject,
                html,
                text: `New Article: ${blog.title}\n\n${blog.excerpt || ''}\n\nRead more at: ${postUrl}`,
            });
            sentCount++;
        } catch (err) {
            console.error(`[MailService Broadcast Error] Failed sending to ${sub.email}:`, err.message);
        }
    }

    console.log(`[MailService Broadcast Complete] Dispatched to ${sentCount}/${subscribers.length} subscriber(s).`);
    return sentCount;
}
