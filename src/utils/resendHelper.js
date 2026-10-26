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
    if (!audienceId) {
        console.warn('[Resend Audience] RESEND_AUDIENCE_ID is not configured.');
        return { success: false, error: 'RESEND_AUDIENCE_ID not configured' };
    }

    const resend = getResendClient();
    if (!resend) {
        console.warn('[Resend Audience] RESEND_API_KEY is not configured.');
        return { success: false, error: 'RESEND_API_KEY not configured' };
    }

    try {
        const contactRes = await resend.contacts.create({
            email,
            unsubscribed: false,
            audienceId,
        });

        if (contactRes.error) {
            console.warn(`[Resend Audience Notice] Adding ${email} failed:`, contactRes.error.message);
            const isRestricted =
                contactRes.error.name === 'restricted_api_key' ||
                contactRes.error.statusCode === 401 ||
                /restricted/i.test(contactRes.error.message || '');

            return {
                success: false,
                error: contactRes.error.message,
                isRestrictedKey: isRestricted,
            };
        }

        console.log(`[Resend Audience] Successfully added ${email} (Contact ID: ${contactRes.data?.id})`);
        return {
            success: true,
            contactId: contactRes.data?.id || null,
        };
    } catch (err) {
        console.warn(`[Resend Audience] Unexpected error adding ${email}:`, err.message);
        return { success: false, error: err.message };
    }
}

/**
 * Send an Onboarding / Welcome email to a new newsletter subscriber
 */
export async function sendOnboardingEmail(recipientEmail, options = {}) {
    const resend = getResendClient();
    if (!resend) {
        console.log("[Newsletter] RESEND_API_KEY not configured. Skipping onboarding email.");
        return { success: false, error: "RESEND_API_KEY not configured" };
    }

    const fromEmail = getSafeFromEmail();
    const replyTo = getReplyToEmail();
    const frontendBase = process.env.FRONTEND_URL || 'https://blogsite-jyzb.onrender.com';
    const blogsUrl = `${frontendBase}/blogs`;

    const htmlContent = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Welcome to Nishan's Newsletter</title>
        </head>
        <body style="margin: 0; padding: 0; background-color: #050507; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #ffffff;">
            <div style="max-width: 600px; margin: 30px auto; padding: 0 16px;">
                <!-- Main Container Card -->
                <div style="background-color: #0b0b0e; border: 1px solid #27272a; border-radius: 24px; padding: 40px 32px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7);">
                    
                    <!-- Top Branding Bar -->
                    <div style="border-bottom: 1px solid #1f1f23; padding-bottom: 24px; margin-bottom: 32px; display: flex; align-items: center; justify-content: space-between;">
                        <div>
                            <span style="font-family: monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 0.25em; color: #10b981; font-weight: 700;">
                                ● DISPATCHES & BUILDS
                            </span>
                            <div style="font-size: 18px; font-weight: 800; color: #ffffff; margin-top: 4px; letter-spacing: -0.02em;">
                                NISHAN KASHYAP
                            </div>
                        </div>
                    </div>

                    <!-- Welcome Title -->
                    <h1 style="font-size: 32px; font-weight: 800; line-height: 1.15; margin: 0 0 16px; color: #ffffff; letter-spacing: -0.03em;">
                        Welcome aboard! 🚀
                    </h1>

                    <p style="font-size: 15px; line-height: 1.65; color: #d4d4d8; margin-bottom: 20px;">
                        Thank you for subscribing to my newsletter. You're now on the list to receive engineering deep dives, software design insights, interactive UI craft, and unfiltered build logs directly to your inbox.
                    </p>

                    <!-- What to Expect Box -->
                    <div style="background: rgba(255, 255, 255, 0.03); border: 1px solid #27272a; border-radius: 16px; padding: 22px; margin: 28px 0;">
                        <div style="font-family: monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 0.2em; color: #a1a1aa; margin-bottom: 12px; font-weight: 600;">
                            WHAT YOU'LL GET
                        </div>
                        <ul style="margin: 0; padding-left: 20px; color: #e4e4e7; font-size: 14px; line-height: 1.8;">
                            <li><strong>In-depth Engineering Write-ups:</strong> Real architecture patterns, debugging sagas, and full-stack solutions.</li>
                            <li><strong>UI & Interaction Craft:</strong> Behind-the-scenes teardowns of slick animations and modern design.</li>
                            <li><strong>Upcoming Project Sneak Peeks:</strong> Early previews of what I'm building before it launches.</li>
                            <li><strong>Zero Spam:</strong> Sent only when there's something meaningful and practical to share.</li>
                        </ul>
                    </div>

                    <!-- Personal note quote -->
                    <div style="padding: 16px 20px; background: rgba(16, 185, 129, 0.05); border-radius: 12px; border-left: 3px solid #10b981; margin: 28px 0;">
                        <p style="font-size: 13.5px; line-height: 1.6; color: #d1fae5; margin: 0; font-style: italic;">
                            "I believe the best way to master something is to build it, break it, and document the lessons openly."
                        </p>
                    </div>

                    <!-- Call to Action Buttons -->
                    <div style="margin: 32px 0 28px; text-align: left;">
                        <a href="${blogsUrl}" style="display: inline-block; background-color: #ffffff; color: #000000; font-family: monospace; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; padding: 14px 28px; border-radius: 12px; text-decoration: none; margin-right: 12px; margin-bottom: 10px;">
                            Explore Published Blogs →
                        </a>
                        <a href="${frontendBase}" style="display: inline-block; background-color: rgba(255, 255, 255, 0.08); color: #ffffff; border: 1px solid #27272a; font-family: monospace; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em; padding: 14px 24px; border-radius: 12px; text-decoration: none;">
                            View Portfolio
                        </a>
                    </div>

                    <p style="font-size: 14px; line-height: 1.6; color: #a1a1aa; margin-top: 24px;">
                        Have questions, thoughts, or ideas on what you'd like me to write about? Simply reply directly to this email — I personally read every reply.
                    </p>

                    <!-- Footer -->
                    <div style="border-top: 1px solid #1f1f23; margin-top: 36px; padding-top: 20px; font-size: 12px; color: #71717a; line-height: 1.6;">
                        <p style="margin: 0 0 6px;">You received this email because you subscribed on Nishan's Portfolio & Blog.</p>
                        <p style="margin: 0;">Sent with care &bull; <a href="${frontendBase}" style="color: #a1a1aa; text-decoration: none;">nishankashyap.dev</a></p>
                    </div>
                </div>
            </div>
        </body>
        </html>
    `;

    const textContent = `
Welcome to Nishan's Newsletter!

Thank you for subscribing. You'll receive practical software engineering write-ups, architecture breakdowns, UI craft, and build logs.

Explore the latest write-ups: ${blogsUrl}
Visit portfolio: ${frontendBase}

Feel free to reply directly to this email anytime.
- Nishan
    `.trim();

    try {
        const sendRes = await resend.emails.send({
            from: fromEmail,
            to: recipientEmail,
            reply_to: replyTo,
            subject: "Welcome to my newsletter! 🚀",
            html: htmlContent,
            text: textContent,
        });

        if (sendRes.error) {
            console.warn(`[Resend Onboarding Error] Failed to send welcome email to ${recipientEmail}:`, sendRes.error.message);
            if (sendRes.error.statusCode === 403 && /onboarding@resend\.dev/i.test(fromEmail)) {
                console.info(`[Resend Free Tier Info] Resend free testing sender (onboarding@resend.dev) restricts delivery to your registered Resend account email. Verify your domain at resend.com/domains to send to any recipient.`);
            }
            return { success: false, error: sendRes.error.message };
        }

        console.log(`[Newsletter] Onboarding email successfully sent to ${recipientEmail} (ID: ${sendRes.data?.id})`);
        return { success: true, emailId: sendRes.data?.id };
    } catch (err) {
        console.warn(`[Newsletter] Unexpected exception sending onboarding email to ${recipientEmail}:`, err.message);
        return { success: false, error: err.message };
    }
}

/**
 * Broadcast an email for an upcoming blog preview or newly published blog to subscribers
 * @param {Object} blog - The blog document
 * @param {Array} subscribers - List of subscriber documents
 * @param {Object} options - { isUpcoming: boolean, customSubject: string, customNote: string }
 */
export async function broadcastBlogEmail(blog, subscribers, options = {}) {
    const resend = getResendClient();
    if (!resend) {
        console.log("[Newsletter] RESEND_API_KEY not configured. Skipping email broadcast.");
        return 0;
    }

    if (!subscribers || subscribers.length === 0) {
        console.log("[Newsletter] No active subscribers to notify.");
        return 0;
    }

    const { isUpcoming = false, customSubject = '', customNote = '' } = options;

    const fromEmail = getSafeFromEmail();
    const replyTo = getReplyToEmail();
    const frontendBase = process.env.FRONTEND_URL || 'https://blogsite-jyzb.onrender.com';
    const articleUrl = blog.slug
        ? `${frontendBase}/blogs/${blog.slug}`
        : `${frontendBase}/blogs/${blog._id}`;

    const badgeLabel = isUpcoming ? "🔮 UPCOMING ARTICLE SNEAK PEEK" : "● NEW WRITE-UP PUBLISHED";
    const badgeColor = isUpcoming ? "#f59e0b" : "#34d399";
    const defaultSubject = isUpcoming
        ? `Sneak Peek: ${blog.title} [Upcoming] 🚀`
        : `New Post: ${blog.title} 🚀`;
    const subject = customSubject.trim() || defaultSubject;

    const tagsHtml = Array.isArray(blog.tags) && blog.tags.length > 0
        ? `<div style="margin-top: 10px; font-family: monospace; font-size: 11px; color: #a1a1aa; letter-spacing: 0.05em;">TAGS: ${blog.tags.map(t => `#${t}`).join(' ')}</div>`
        : '';

    const coverImageHtml = blog.coverImage
        ? `<div style="margin: 24px 0; border-radius: 14px; overflow: hidden; border: 1px solid #27272a;">
             <img src="${blog.coverImage}" alt="${blog.title}" style="width: 100%; max-height: 300px; object-fit: cover; display: block;" />
           </div>`
        : '';

    const customNoteHtml = customNote && customNote.trim()
        ? `<div style="padding: 16px 20px; background: rgba(255, 255, 255, 0.04); border-radius: 12px; border-left: 3px solid #ffffff; margin: 24px 0; font-size: 14px; line-height: 1.6; color: #f4f4f5;">
             <div style="font-family: monospace; font-size: 10px; text-transform: uppercase; letter-spacing: 0.2em; color: #a1a1aa; margin-bottom: 6px;">NOTE FROM NISHAN</div>
             ${customNote.trim()}
           </div>`
        : '';

    const ctaText = isUpcoming ? "Read Early Preview →" : "Read Full Article →";

    const htmlContent = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${blog.title}</title>
        </head>
        <body style="margin: 0; padding: 0; background-color: #050507; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #ffffff;">
            <div style="max-width: 620px; margin: 30px auto; padding: 0 16px;">
                <div style="background-color: #0b0b0e; border: 1px solid #27272a; border-radius: 24px; padding: 40px 32px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7);">
                    
                    <!-- Header pill -->
                    <div style="margin-bottom: 20px;">
                        <span style="font-family: monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 0.25em; color: ${badgeColor}; font-weight: 700;">
                            ${badgeLabel}
                        </span>
                        <h1 style="font-size: 30px; font-weight: 800; line-height: 1.25; margin: 12px 0 8px; color: #ffffff; letter-spacing: -0.02em;">
                            ${blog.title}
                        </h1>
                        <div style="font-size: 12px; color: #a1a1aa; font-family: monospace;">
                            ${blog.readTime || '3 min read'} &bull; Nishan Kashyap
                        </div>
                        ${tagsHtml}
                    </div>

                    ${coverImageHtml}
                    ${customNoteHtml}

                    <p style="font-size: 15.5px; line-height: 1.65; color: #d4d4d8; margin: 20px 0 28px;">
                        ${blog.excerpt || (blog.content ? blog.content.substring(0, 200) + '...' : 'A new article has just been announced on the blog. Check it out using the link below.')}
                    </p>

                    <div style="margin: 32px 0 36px;">
                        <a href="${articleUrl}" style="display: inline-block; background-color: #ffffff; color: #000000; font-family: monospace; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; padding: 15px 30px; border-radius: 12px; text-decoration: none; box-shadow: 0 10px 20px rgba(0,0,0,0.3);">
                            ${ctaText}
                        </a>
                    </div>

                    <div style="border-top: 1px solid #1f1f23; padding-top: 22px; font-size: 12px; color: #71717a; line-height: 1.6;">
                        <p style="margin: 0 0 6px;">You received this broadcast because you subscribed to Nishan's newsletter.</p>
                        <p style="margin: 0;">Sent with care from Nishan's Portfolio & Blog.</p>
                    </div>
                </div>
            </div>
        </body>
        </html>
    `;

    // Prepare individual email payloads
    const emailPayloads = subscribers.map((sub) => ({
        from: fromEmail,
        to: sub.email,
        reply_to: replyTo,
        subject,
        html: htmlContent,
    }));

    let sentCount = 0;
    // Resend batch endpoint accepts up to 100 emails per batch
    for (let i = 0; i < emailPayloads.length; i += 100) {
        const chunk = emailPayloads.slice(i, i + 100);
        try {
            const batchRes = await resend.batch.send(chunk);
            if (batchRes?.data) {
                sentCount += chunk.length;
            } else if (batchRes?.error) {
                console.error(`[Newsletter Broadcast Error on batch ${i / 100 + 1}]:`, batchRes.error.message);
            }
        } catch (batchErr) {
            console.error(`[Newsletter Broadcast Exception on batch ${i / 100 + 1}]:`, batchErr.message);
        }
    }

    console.log(`[Newsletter] Broadcasted "${blog.title}" (${isUpcoming ? 'upcoming' : 'published'}) to ${sentCount}/${subscribers.length} subscriber(s).`);
    return sentCount;
}
