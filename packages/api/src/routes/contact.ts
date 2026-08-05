import { Router } from 'express';
import nodemailer from 'nodemailer';
import { createRateLimiter } from '../rateLimit';

export const contactRouter = Router();

const TO = process.env.CONTACT_TO ?? 'you@example.com';
// Shown in the From display name and the subject prefix, so a message is recognisable
// in an inbox that receives mail from more than one site.
const SITE_NAME = process.env.SITE_NAME ?? 'Portfolio';
const SITE_SLUG = process.env.SITE_SLUG ?? 'portfolio';

const LIMITS = { name: 100, email: 200, subject: 150, message: 5000 };
// Anything with a newline in it can inject extra mail headers, so these two fields — the
// only ones that reach a header — must be single-line.
const HEADER_SAFE = /^[^\r\n]+$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const rateLimited = createRateLimiter({ windowMs: 60 * 60 * 1000, max: 5 });

// Render's free tier blocks outbound traffic on ports 25, 465 and 587, so SMTP cannot work
// there at all — connections are dropped, surfacing as ETIMEDOUT at the CONN stage. Resend
// goes over HTTPS on 443 instead, which is not blocked. SMTP is kept as a fallback for
// local development and for paid plans, where it works fine.
async function sendViaResend(mail: {
  from: string;
  replyTo: string;
  subject: string;
  text: string;
}): Promise<void> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: mail.from,
      to: [TO],
      reply_to: mail.replyTo,
      subject: mail.subject,
      text: mail.text,
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    throw new Error(`resend ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
}

function transport() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;
  const port = Number(SMTP_PORT ?? 587);
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    secure: port === 465, // 465 is implicit TLS; 587 upgrades via STARTTLS
    auth: { user: SMTP_USER, pass: SMTP_PASS },
    // Nodemailer waits 2 minutes to connect by default. When the host cannot reach the
    // mail server at all, that leaves the visitor watching a spinner for the full two
    // minutes before it fails. Fail in seconds instead — a mail server that has not
    // answered in 15s is not going to.
    connectionTimeout: 15_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });
}

contactRouter.post('/', async (req, res) => {
  const body = req.body as Record<string, unknown>;
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const subject = typeof body.subject === 'string' ? body.subject.trim() : '';
  const message = typeof body.message === 'string' ? body.message.trim() : '';
  // Hidden field: a real person never fills it, most naive bots fill everything. Answer
  // 200 so the bot cannot tell it was rejected.
  if (typeof body.website === 'string' && body.website.trim() !== '') {
    res.json({ ok: true });
    return;
  }

  if (!name || !email || !subject || !message) {
    res.status(400).json({ error: 'All fields are required' });
    return;
  }
  if (
    name.length > LIMITS.name ||
    email.length > LIMITS.email ||
    subject.length > LIMITS.subject ||
    message.length > LIMITS.message
  ) {
    res.status(400).json({ error: 'One or more fields are too long' });
    return;
  }
  // name is included too: it lands in the From and Reply-To display names, so a newline in
  // it is just as good an injection vector as one in the subject.
  if (
    !EMAIL.test(email) ||
    !HEADER_SAFE.test(email) ||
    !HEADER_SAFE.test(subject) ||
    !HEADER_SAFE.test(name)
  ) {
    res.status(400).json({ error: 'Invalid name, email address or subject' });
    return;
  }

  const ip = req.ip ?? 'unknown';
  if (rateLimited(ip)) {
    res.status(429).json({ error: 'Too many messages, please try again later' });
    return;
  }

  const mailer = transport();
  const useResend = !!process.env.RESEND_API_KEY;
  if (!useResend && !mailer) {
    // Better a clear failure than pretending to send into a void.
    console.error('[contact] no mail transport configured; message not sent');
    res.status(503).json({ error: 'Mail is not configured' });
    return;
  }

  try {
    // Quotes would terminate the display name early, so swap them out.
    const display = name.replace(/"/g, "'");
    // The address must be one the provider will vouch for — the authenticated mailbox for
    // SMTP, a verified sender for Resend — because that is what SPF and DMARC check. Only
    // the display name is free, so the visitor's name goes there: the inbox reads
    // "Jane Doe (via Your Site)" rather than your own name against every enquiry.
    const fromAddress = useResend
      ? (process.env.RESEND_FROM ?? 'onboarding@resend.dev')
      : process.env.SMTP_USER;
    const mail = {
      from: `"${display} (via ${SITE_NAME})" <${fromAddress}>`,
      replyTo: `"${display}" <${email}>`,
      subject: `[${SITE_SLUG}] ${subject}`,
      text: `From: ${name} <${email}>\n\n${message}`,
    };

    if (useResend) await sendViaResend(mail);
    else await mailer!.sendMail({ to: TO, ...mail });
    res.json({ ok: true });
  } catch (err) {
    // Log the code and response explicitly: the bare error object renders as [Object] in
    // Render's log view, which hides exactly the part that identifies the cause
    // (ETIMEDOUT = cannot reach the server, EAUTH = credentials rejected, 5xx = refused).
    const e = err as { code?: string; command?: string; response?: string; message?: string };
    console.error(
      `[contact] send failed: code=${e.code ?? 'none'} command=${e.command ?? 'none'} response=${e.response ?? 'none'} message=${e.message ?? String(err)}`,
    );
    res.status(502).json({ error: 'Could not send the message' });
  }
});
