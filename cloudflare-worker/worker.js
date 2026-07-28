/**
 * Comment + contact backend for bahaerdogan.com.
 *
 * Email is sent via Resend. The previous implementation called MailChannels'
 * free Cloudflare Workers endpoint, which was terminated on 30 June 2024 and
 * fully sunset on 31 August 2024. Because that call was awaited in the contact
 * handler, every visitor who submitted the form received an HTTP 500 and a
 * "Failed to send message" error.
 *
 * Required secret (set with `wrangler secret put <NAME>`):
 *   RESEND_API_KEY   — from https://resend.com/api-keys
 *
 * Optional vars (wrangler.toml [vars]):
 *   MAIL_FROM        — verified sender, e.g. "Bahaerdogan <no-reply@bahaerdogan.com>"
 *   MAIL_TO          — destination inbox
 *   TURNSTILE_SECRET — enables Cloudflare Turnstile verification when present
 */

const ALLOWED_ORIGINS = ['https://bahaerdogan.com', 'https://www.bahaerdogan.com'];

const LIMITS = {
  comment: { max: 3, windowMs: 60 * 60 * 1000 },
  contact: { max: 3, windowMs: 60 * 60 * 1000 },
};

/** Comments are capped so a single KV value cannot grow past the 25 MB limit. */
const MAX_COMMENTS_PER_POST = 500;

const MESSAGES = {
  en: {
    name: 'Name must be between 2 and 100 characters.',
    email: 'Please enter a valid email address.',
    subject: 'Subject must be between 2 and 200 characters.',
    message: 'Message must be between 10 and 5000 characters.',
    slug: 'Missing post identifier.',
    rate: (m) => `Too many submissions. Please try again in ${m} minute(s).`,
    spam: 'Could not verify that you are human. Please try again.',
    error: 'Something went wrong. Please try again later.',
    commentOk: 'Your comment has been posted.',
    contactOk: 'Your message has been sent. Thank you.',
  },
  tr: {
    name: 'İsim 2-100 karakter arasında olmalı.',
    email: 'Geçerli bir e-posta adresi girin.',
    subject: 'Konu 2-200 karakter arasında olmalı.',
    message: 'Mesaj 10-5000 karakter arasında olmalı.',
    slug: 'Gönderi kimliği eksik.',
    rate: (m) => `Çok fazla gönderim. Lütfen ${m} dakika sonra tekrar deneyin.`,
    spam: 'İnsan olduğunuz doğrulanamadı. Lütfen tekrar deneyin.',
    error: 'Bir hata oluştu. Lütfen daha sonra tekrar deneyin.',
    commentOk: 'Yorumunuz yayınlandı.',
    contactOk: 'Mesajınız gönderildi. Teşekkürler.',
  },
  de: {
    name: 'Der Name muss zwischen 2 und 100 Zeichen lang sein.',
    email: 'Bitte geben Sie eine gültige E-Mail-Adresse ein.',
    subject: 'Der Betreff muss zwischen 2 und 200 Zeichen lang sein.',
    message: 'Die Nachricht muss zwischen 10 und 5000 Zeichen lang sein.',
    slug: 'Beitragskennung fehlt.',
    rate: (m) => `Zu viele Übermittlungen. Bitte in ${m} Minute(n) erneut versuchen.`,
    spam: 'Wir konnten nicht überprüfen, ob Sie ein Mensch sind. Bitte erneut versuchen.',
    error: 'Etwas ist schiefgelaufen. Bitte später erneut versuchen.',
    commentOk: 'Ihr Kommentar wurde veröffentlicht.',
    contactOk: 'Ihre Nachricht wurde gesendet. Vielen Dank.',
  },
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const { method } = request;

    if (method === 'OPTIONS') return new Response(null, { headers: corsHeaders(request) });
    if (method === 'GET' && url.pathname === '/health') {
      return json({ ok: true, email: env.RESEND_API_KEY ? 'configured' : 'missing' }, 200, request);
    }
    if (method === 'POST' && url.pathname === '/comments') return handlePostComment(request, env, ctx);
    if (method === 'GET' && url.pathname.startsWith('/comments')) return handleGetComments(url, env, request);
    if (method === 'POST' && url.pathname === '/contact') return handleContactForm(request, env, ctx);

    return json({ error: 'Not found' }, 404, request);
  },
};

// --- handlers ---

async function handlePostComment(request, env, ctx) {
  const t = messagesFor(request);
  try {
    const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';

    const limited = await checkRateLimit(env, `ratelimit:${await ipKey(clientIP)}`, LIMITS.comment);
    if (limited) return json({ error: t.rate(limited) }, 429, request);

    const data = await readJson(request);
    if (!data) return json({ error: t.error }, 400, request);

    const { name, email, message, slug, turnstileToken } = data;

    if (!isLength(name, 2, 100)) return json({ error: t.name }, 400, request);
    if (!isValidEmail(email)) return json({ error: t.email }, 400, request);
    if (!isLength(message, 10, 5000)) return json({ error: t.message }, 400, request);
    if (!isSafeSlug(slug)) return json({ error: t.slug }, 400, request);

    if (!(await verifyTurnstile(env, turnstileToken, clientIP))) {
      return json({ error: t.spam }, 403, request);
    }

    // Store raw text. The previous version HTML-escaped on write and the client
    // escaped again on render, so every apostrophe reached the reader as
    // "&#x27;" and every URL as "https:&#x2F;&#x2F;". Escaping belongs at the
    // render layer only — the client already escapes before innerHTML.
    //
    // The commenter's email and IP are deliberately not stored. They were
    // previously kept in KV for a year with no privacy policy and no stated
    // lawful basis; the email is only needed for the notification below.
    const comment = {
      id: `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
      name: name.trim(),
      message: message.trim(),
      date: new Date().toISOString(),
      timestamp: Date.now(),
    };

    const key = `comments:${slug}`;
    const existing = (await env.KV_COMMENTS.get(key, 'json')) || [];
    existing.push(comment);
    while (existing.length > MAX_COMMENTS_PER_POST) existing.shift();
    await env.KV_COMMENTS.put(key, JSON.stringify(existing));

    ctx.waitUntil(sendEmail(env, {
      subject: `New comment on ${slug}`,
      rows: [['Post', slug], ['From', comment.name], ['Email', email.trim()], ['Date', comment.date]],
      body: comment.message,
      replyTo: email.trim(),
    }).catch((err) => console.error('comment notification failed:', err.message)));

    return json({ success: true, comment: publicView(comment), message: t.commentOk }, 200, request);
  } catch (err) {
    console.error('comment submission error:', err);
    return json({ error: t.error }, 500, request);
  }
}

async function handleGetComments(url, env, request) {
  const t = messagesFor(request);
  const slug = url.pathname.split('/comments/')[1];
  if (!isSafeSlug(slug)) return json({ error: t.slug }, 400, request);

  const comments = (await env.KV_COMMENTS.get(`comments:${slug}`, 'json')) || [];
  const list = comments.map(publicView).sort((a, b) => b.timestamp - a.timestamp);
  return json({ comments: list }, 200, request);
}

async function handleContactForm(request, env, ctx) {
  const t = messagesFor(request);
  try {
    const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';

    const limited = await checkRateLimit(env, `contact:${await ipKey(clientIP)}`, LIMITS.contact);
    if (limited) return json({ error: t.rate(limited) }, 429, request);

    const data = await readJson(request);
    if (!data) return json({ error: t.error }, 400, request);

    const { name, email, subject, message, turnstileToken } = data;

    if (!isLength(name, 2, 100)) return json({ error: t.name }, 400, request);
    if (!isValidEmail(email)) return json({ error: t.email }, 400, request);
    if (!isLength(subject, 2, 200)) return json({ error: t.subject }, 400, request);
    if (!isLength(message, 10, 5000)) return json({ error: t.message }, 400, request);

    if (!(await verifyTurnstile(env, turnstileToken, clientIP))) {
      return json({ error: t.spam }, 403, request);
    }

    await sendEmail(env, {
      subject: `Contact form: ${subject.trim()}`,
      rows: [['From', name.trim()], ['Email', email.trim()], ['Subject', subject.trim()]],
      body: message.trim(),
      replyTo: email.trim(),
    });

    return json({ success: true, message: t.contactOk }, 200, request);
  } catch (err) {
    console.error('contact form error:', err);
    return json({ error: t.error }, 500, request);
  }
}

// --- email ---

async function sendEmail(env, { subject, rows, body, replyTo }) {
  if (!env.RESEND_API_KEY) throw new Error('RESEND_API_KEY is not configured');

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));

  const html = `
    <div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:600px;margin:0 auto">
      <h2 style="color:#0a5fc4;margin:0 0 16px">${esc(subject)}</h2>
      <table style="background:#f5f5f5;border-radius:8px;padding:16px;width:100%;border-collapse:collapse">
        ${rows.map(([k, v]) => `<tr><td style="padding:4px 8px"><strong>${esc(k)}</strong></td><td style="padding:4px 8px">${esc(v)}</td></tr>`).join('')}
      </table>
      <div style="background:#fff;border:1px solid #ddd;border-radius:8px;padding:16px;margin-top:16px">
        <p style="white-space:pre-wrap;margin:0">${esc(body)}</p>
      </div>
    </div>`;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: env.MAIL_FROM || 'Bahaerdogan <no-reply@bahaerdogan.com>',
      to: [env.MAIL_TO || 'baha@bahaerdogan.com'],
      reply_to: replyTo,
      subject,
      html,
    }),
  });

  if (!response.ok) {
    throw new Error(`Resend error ${response.status}: ${await response.text()}`);
  }
}

// --- helpers ---

/** The API previously answered every request in Turkish, on a trilingual site. */
function messagesFor(request) {
  const referer = request.headers.get('Referer') || '';
  if (/TR\.html|-tr\.html/i.test(referer)) return MESSAGES.tr;
  if (/DE\.html|-de\.html/i.test(referer)) return MESSAGES.de;
  return MESSAGES.en;
}

async function readJson(request) {
  if (!/application\/json/i.test(request.headers.get('Content-Type') || '')) return null;
  try {
    return await request.json();
  } catch (_) {
    return null;
  }
}

/**
 * Rate-limit bucket derived from the caller's IP.
 *
 * The IP itself is never written to KV: the key is a truncated SHA-256 digest,
 * which still separates callers but is not personal data at rest. Buckets carry
 * a one-hour TTL, so nothing survives the rate-limit window either way.
 */
async function ipKey(ip) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`rl:${ip}`));
  return [...new Uint8Array(digest)].slice(0, 12).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Returns minutes remaining if the caller is over the limit, otherwise null. */
async function checkRateLimit(env, key, { max, windowMs }) {
  const now = Date.now();
  const record = (await env.KV_COMMENTS.get(key, 'json')) || { count: 0, timestamp: now };

  if (now - record.timestamp >= windowMs) {
    record.count = 0;
    record.timestamp = now;
  }
  if (record.count >= max) {
    return Math.ceil((windowMs - (now - record.timestamp)) / 60000);
  }

  record.count += 1;
  await env.KV_COMMENTS.put(key, JSON.stringify(record), { expirationTtl: Math.ceil(windowMs / 1000) });
  return null;
}

/** Skipped when TURNSTILE_SECRET is unset, so the form keeps working before setup. */
async function verifyTurnstile(env, token, ip) {
  if (!env.TURNSTILE_SECRET) return true;
  if (!token) return false;
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: env.TURNSTILE_SECRET, response: token, remoteip: ip }),
    });
    return (await res.json()).success === true;
  } catch (_) {
    return false;
  }
}

const publicView = (c) => ({ id: c.id, name: c.name, message: c.message, date: c.date, timestamp: c.timestamp });

const isLength = (v, min, max) => typeof v === 'string' && v.trim().length >= min && v.trim().length <= max;
const isValidEmail = (e) => typeof e === 'string' && e.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());
const isSafeSlug = (s) => typeof s === 'string' && /^[A-Za-z0-9._-]{1,120}$/.test(s);

function corsHeaders(request) {
  const origin = request.headers.get('Origin');
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function json(obj, status = 200, request = null) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...(request ? corsHeaders(request) : {}),
    },
  });
}
