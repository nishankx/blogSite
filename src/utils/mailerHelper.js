import nodemailer from 'nodemailer';

/**
 * Low-level universal email dispatcher
 * Automatically chooses the best delivery method:
 * 1. Brevo HTTP API (Port 443 - Works on Render Free Tier without custom domain)
 * 2. Resend HTTP API (Port 443 - Works on Render Free Tier)
 * 3. Gmail SMTP Nodemailer (Port 465/587 - Works locally or on paid cloud tiers with strict timeout)
 */
export async function dispatchEmail({ to, subject, html, text }) {
    const senderName = process.env.EMAIL_SENDER_NAME || 'Nishan Kashyap';
    const senderEmail = process.env.EMAIL_USER || 'nishankashyapofficial@gmail.com';

    // 1. Check Brevo HTTP API (Port 443 HTTPS - Never blocked by Render firewall)
    if (process.env.BREVO_API_KEY) {
        try {
            const res = await fetch('https://api.brevo.com/v3/smtp/email', {
                method: 'POST',
                headers: {
                    'api-key': process.env.BREVO_API_KEY.trim(),
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    sender: { name: senderName, email: senderEmail },
                    to: [{ email: to }],
                    subject,
                    htmlContent: html,
                    textContent: text,
                }),
            });
            const data = await res.json();
            if (!res.ok) {
                console.error('[Brevo Error]:', data);
                return { success: false, error: data.message || 'Brevo API error' };
            }
            console.log(`[Mailer via Brevo] Delivered to ${to} (Message ID: ${data.messageId})`);
            return { success: true, messageId: data.messageId, provider: 'brevo' };
        } catch (err) {
            console.error('[Mailer via Brevo Exception]:', err.message);
            return { success: false, error: err.message };
        }
    }

    // 2. Check Resend HTTP API (Port 443 HTTPS - Never blocked by Render firewall)
    if (process.env.RESEND_API_KEY) {
        try {
            const fromField = process.env.RESEND_FROM_EMAIL || `Nishan <onboarding@resend.dev>`;
            const res = await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${process.env.RESEND_API_KEY.trim()}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    from: fromField,
                    to: [to],
                    subject,
                    html,
                    text,
                }),
            });
            const data = await res.json();
            if (!res.ok) {
                console.error('[Resend Error]:', data);
                return { success: false, error: data.message || 'Resend API error' };
            }
            console.log(`[Mailer via Resend] Delivered to ${to} (ID: ${data.id})`);
            return { success: true, messageId: data.id, provider: 'resend' };
        } catch (err) {
            console.error('[Mailer via Resend Exception]:', err.message);
            return { success: false, error: err.message };
        }
    }

    // 3. Fallback to Gmail SMTP (with strict 5-second socket timeout so it never hangs Render indefinitely)
    if (process.env.EMAIL_APP_PASSWORD) {
        const pass = process.env.EMAIL_APP_PASSWORD.trim().replace(/\s+/g, '');
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: senderEmail.trim(),
                pass,
            },
            connectionTimeout: 5000, // 5s timeout
            greetingTimeout: 5000,
            socketTimeout: 6000,
        });

        try {
            const info = await transporter.sendMail({
                from: `"${senderName}" <${senderEmail}>`,
                to,
                subject,
                html,
                text,
            });
            console.log(`[Mailer via Gmail SMTP] Delivered to ${to} (MessageId: ${info.messageId})`);
            return { success: true, messageId: info.messageId, provider: 'smtp' };
        } catch (err) {
            console.error(`[Mailer SMTP Error]: Failed sending to ${to}:`, err.message);
            if (err.code === 'ETIMEDOUT' || err.message?.includes('timeout') || err.message?.includes('Greeting never received')) {
                console.warn(
                    '[Render Firewall Notice] Outbound SMTP connection timed out. Render Free Tier blocks outbound ports 25, 465, and 587. To send emails from Render Free Tier, please add a BREVO_API_KEY or RESEND_API_KEY (which connect over HTTPS port 443).'
                );
            }
            return {
                success: false,
                error: err.code === 'ETIMEDOUT'
                    ? 'SMTP timed out. Note: Render Free Tier blocks outbound SMTP ports 465/587. Please use Brevo or Resend HTTP API.'
                    : err.message,
            };
        }
    }

    console.warn('[Mailer] No email credentials configured (neither BREVO_API_KEY, RESEND_API_KEY, nor EMAIL_APP_PASSWORD).');
    return { success: false, error: 'No email service configured.' };
}

/**
 * Send Onboarding / Welcome email to a newly subscribed user
 */
export async function sendOnboardingEmail(recipientEmail, options = {}) {
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
                <div style="background-color: #0b0b0e; border: 1px solid #27272a; border-radius: 24px; padding: 40px 32px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7);">
                    
                    <div style="border-bottom: 1px solid #1f1f23; padding-bottom: 24px; margin-bottom: 32px;">
                        <span style="font-family: monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 0.25em; color: #10b981; font-weight: 700;">
                            ● DISPATCHES & BUILDS
                        </span>
                        <div style="font-size: 20px; font-weight: 800; color: #ffffff; margin-top: 4px; letter-spacing: -0.02em;">
                            NISHAN KASHYAP
                        </div>
                    </div>

                    <h1 style="font-size: 32px; font-weight: 800; line-height: 1.15; margin: 0 0 16px; color: #ffffff; letter-spacing: -0.03em;">
                        Welcome aboard! 🚀
                    </h1>

                    <p style="font-size: 15px; line-height: 1.65; color: #d4d4d8; margin-bottom: 20px;">
                        Thank you for subscribing to my newsletter. You're now on the list to receive engineering deep dives, software design insights, interactive UI craft, and unfiltered build logs directly to your inbox.
                    </p>

                    <div style="background: rgba(255, 255, 255, 0.03); border: 1px solid #27272a; border-radius: 16px; padding: 22px; margin: 28px 0;">
                        <div style="font-family: monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 0.2em; color: #a1a1aa; margin-bottom: 12px; font-weight: 600;">
                            WHAT YOU'LL GET
                        </div>
                        <ul style="margin: 0; padding-left: 20px; color: #e4e4e7; font-size: 14px; line-height: 1.8;">
                            <li><strong>Engineering Deep Dives:</strong> Real architecture patterns, debugging sagas, and full-stack solutions.</li>
                            <li><strong>UI & Interaction Craft:</strong> Behind-the-scenes teardowns of modern web applications.</li>
                            <li><strong>Upcoming Project Sneak Peeks:</strong> Early previews of what I'm building before it drops.</li>
                            <li><strong>Zero Spam:</strong> Sent only when there is something genuinely insightful to share.</li>
                        </ul>
                    </div>

                    <div style="padding: 16px 20px; background: rgba(16, 185, 129, 0.05); border-radius: 12px; border-left: 3px solid #10b981; margin: 28px 0;">
                        <p style="font-size: 13.5px; line-height: 1.6; color: #d1fae5; margin: 0; font-style: italic;">
                            "I believe the best way to master something is to build it, break it, and document the lessons openly."
                        </p>
                    </div>

                    <div style="margin: 32px 0 28px;">
                        <a href="${blogsUrl}" style="display: inline-block; background-color: #ffffff; color: #000000; font-family: monospace; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; padding: 14px 28px; border-radius: 12px; text-decoration: none; margin-right: 12px; margin-bottom: 10px;">
                            Explore Published Blogs →
                        </a>
                        <a href="${frontendBase}" style="display: inline-block; background-color: rgba(255, 255, 255, 0.08); color: #ffffff; border: 1px solid #27272a; font-family: monospace; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em; padding: 14px 24px; border-radius: 12px; text-decoration: none;">
                            View Portfolio
                        </a>
                    </div>

                    <p style="font-size: 14px; line-height: 1.6; color: #a1a1aa; margin-top: 24px;">
                        Have questions or ideas on what you'd like me to write about? Simply reply directly to this email — I personally read and respond to every note.
                    </p>

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

Explore recent write-ups: ${blogsUrl}
Visit portfolio: ${frontendBase}

Feel free to reply directly to this email anytime.
- Nishan
    `.trim();

    return await dispatchEmail({
        to: recipientEmail,
        subject: "Welcome to my newsletter! 🚀",
        html: htmlContent,
        text: textContent,
    });
}

/**
 * Broadcast an email for an upcoming blog sneak peek or new published blog to all active subscribers
 */
export async function broadcastBlogEmail(blog, subscribers, options = {}) {
    if (!subscribers || subscribers.length === 0) {
        console.log('[Mailer] No active subscribers found to broadcast to.');
        return 0;
    }

    const { isUpcoming = false, customSubject = '', customNote = '' } = options;
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

    let sentCount = 0;
    for (const sub of subscribers) {
        try {
            const res = await dispatchEmail({
                to: sub.email,
                subject,
                html: htmlContent,
            });
            if (res.success) sentCount++;
        } catch (err) {
            console.error(`[Mailer Broadcast Error] Failed sending to ${sub.email}:`, err.message);
        }
    }

    console.log(`[Mailer] Broadcasted "${blog.title}" (${isUpcoming ? 'upcoming' : 'published'}) to ${sentCount}/${subscribers.length} subscriber(s).`);
    return sentCount;
}
