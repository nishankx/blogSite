import { Resend } from 'resend';

export const getResendClient = () => {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) return null;
    return new Resend(apiKey);
};

export const getSafeFromEmail = () => {
    let fromEmail = process.env.RESEND_FROM_EMAIL || 'Nishan <onboarding@resend.dev>';
    // If a free email provider (like @gmail.com) is supplied without custom domain verification,
    // fallback safely to onboarding@resend.dev to prevent 403 API validation errors.
    if (/@(gmail|yahoo|outlook|hotmail)\.com/i.test(fromEmail)) {
        fromEmail = 'Nishan <onboarding@resend.dev>';
    }
    return fromEmail;
};

export const getReplyToEmail = () => {
    return process.env.RESEND_REPLY_TO || 'nishankashyapofficial@gmail.com';
};

/**
 * Add or sync an email to a Resend Audience
 */
export async function addContactToAudience(email, audienceId = process.env.RESEND_AUDIENCE_ID) {
    if (!audienceId) return null;
    const resend = getResendClient();
    if (!resend) return null;

    try {
        const contactRes = await resend.contacts.create({
            email,
            unsubscribed: false,
            audienceId,
        });
        return contactRes?.data?.id || null;
    } catch (err) {
        console.warn(`[Resend Audience] Failed to add ${email}:`, err.message);
        return null;
    }
}

/**
 * Broadcast an announcement email for a newly published blog to all active subscribers
 */
export async function broadcastBlogEmail(blog, subscribers) {
    const resend = getResendClient();
    if (!resend) {
        console.log("[Newsletter] RESEND_API_KEY not configured. Skipping email broadcast.");
        return 0;
    }

    if (!subscribers || subscribers.length === 0) {
        console.log("[Newsletter] No active subscribers to notify.");
        return 0;
    }

    const fromEmail = getSafeFromEmail();
    const replyTo = getReplyToEmail();
    const frontendBase = process.env.FRONTEND_URL || 'https://blogsite-jyzb.onrender.com';
    const articleUrl = blog.slug
        ? `${frontendBase}/blogs/${blog.slug}`
        : `${frontendBase}/blogs/${blog._id}`;

    const tagsHtml = Array.isArray(blog.tags) && blog.tags.length > 0
        ? `<div style="margin-top: 8px; font-family: monospace; font-size: 11px; color: #a1a1aa;">TAGS: ${blog.tags.join(', ')}</div>`
        : '';

    const coverImageHtml = blog.coverImage
        ? `<div style="margin: 20px 0; border-radius: 12px; overflow: hidden; border: 1px solid #27272a;">
             <img src="${blog.coverImage}" alt="${blog.title}" style="width: 100%; max-height: 280px; object-fit: cover; display: block;" />
           </div>`
        : '';

    const htmlContent = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 36px 24px; background-color: #0a0a0b; color: #ffffff; border-radius: 20px; border: 1px solid #27272a;">
            <div style="margin-bottom: 20px;">
                <span style="font-family: monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 0.3em; color: #34d399;">
                    ● NEW WRITE-UP PUBLISHED
                </span>
                <h1 style="font-size: 28px; font-weight: 800; line-height: 1.25; margin: 12px 0 8px; color: #ffffff;">
                    ${blog.title}
                </h1>
                <div style="font-size: 12px; color: #a1a1aa; font-family: monospace;">
                    ${blog.readTime || '3 min read'}
                </div>
                ${tagsHtml}
            </div>

            ${coverImageHtml}

            <p style="font-size: 15px; line-height: 1.6; color: #d4d4d8; margin: 20px 0 28px;">
                ${blog.excerpt || 'A new article has just been published on Nishan\'s blog. Click below to read the full write-up.'}
            </p>

            <div style="margin-bottom: 36px;">
                <a href="${articleUrl}" style="display: inline-block; background-color: #ffffff; color: #000000; font-family: monospace; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; padding: 14px 28px; border-radius: 12px; text-decoration: none;">
                    Read Full Article →
                </a>
            </div>

            <div style="border-top: 1px solid #27272a; padding-top: 20px; font-size: 12px; color: #71717a; line-height: 1.5;">
                <p style="margin: 0 0 6px;">You received this email because you subscribed to Nishan's newsletter.</p>
                <p style="margin: 0;">Sent with care from Nishan's Portfolio & Blog.</p>
            </div>
        </div>
    `;

    // Prepare individual email payloads
    const emailPayloads = subscribers.map((sub) => ({
        from: fromEmail,
        to: sub.email,
        reply_to: replyTo,
        subject: `New Post: ${blog.title} 🚀`,
        html: htmlContent,
    }));

    let sentCount = 0;
    // Resend batch endpoint allows up to 100 emails per batch
    for (let i = 0; i < emailPayloads.length; i += 100) {
        const chunk = emailPayloads.slice(i, i + 100);
        try {
            const batchRes = await resend.batch.send(chunk);
            if (batchRes?.data) {
                sentCount += chunk.length;
            }
        } catch (batchErr) {
            console.error(`[Newsletter Broadcast Error on batch ${i / 100 + 1}]:`, batchErr.message);
        }
    }

    console.log(`[Newsletter] Broadcasted "${blog.title}" to ${sentCount}/${subscribers.length} subscriber(s).`);
    return sentCount;
}
