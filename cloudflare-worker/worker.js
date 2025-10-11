export default {
    async fetch(request, env, ctx) {
      const url = new URL(request.url);
      const method = request.method;
  
      if (method === "OPTIONS") return handleOptions();
  
      if (method === "POST" && url.pathname === "/comments") {
        return await handlePostComment(request, env);
      }
  
      if (method === "GET" && url.pathname.startsWith("/comments")) {
        return await handleGetComments(url, env);
      }
  
      if (method === "GET" && url.pathname === "/health") {
        return new Response("OK", { status: 200 });
      }
  
      return new Response("Not found", { status: 404 });
    },
  };
  
  // --- Handlers ---
  async function handlePostComment(request, env) {
    try {
      // Rate limiting check
      const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';
      const rateLimitKey = `ratelimit:${clientIP}`;
      const rateLimitData = await env.KV_COMMENTS.get(rateLimitKey, 'json') || { count: 0, timestamp: Date.now() };
      
      const now = Date.now();
      const RATE_LIMIT_WINDOW = 3600000; // 1 hour
      const MAX_COMMENTS = 3;
      
      if (now - rateLimitData.timestamp < RATE_LIMIT_WINDOW) {
        if (rateLimitData.count >= MAX_COMMENTS) {
          const minutesLeft = Math.ceil((RATE_LIMIT_WINDOW - (now - rateLimitData.timestamp)) / 60000);
          return json({ error: `Rate limit aşıldı. Lütfen ${minutesLeft} dakika sonra tekrar deneyin.` }, 429);
        }
      } else {
        rateLimitData.count = 0;
        rateLimitData.timestamp = now;
      }
      
      const data = await request.json();
      const { name, email, message, slug } = data;
  
      // Validation
      if (!name || name.trim().length < 2 || name.trim().length > 100)
        return json({ error: "İsim 2-100 karakter arasında olmalı" }, 400);
        
      if (!email || !isValidEmail(email))
        return json({ error: "Geçerli bir email adresi girin" }, 400);
        
      if (!message || message.trim().length < 10 || message.trim().length > 5000)
        return json({ error: "Mesaj 10-5000 karakter arasında olmalı" }, 400);
        
      if (!slug)
        return json({ error: "Slug gerekli" }, 400);
  
      const sanitized = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: sanitize(name.trim()),
        email: email.trim().toLowerCase(),
        message: sanitize(message.trim()),
        date: new Date().toISOString(),
        timestamp: Date.now(),
        ip: clientIP
      };
  
      // Store in KV (using KV_COMMENTS binding)
      const key = `comments:${slug}`;
      const existing = (await env.KV_COMMENTS.get(key, "json")) || [];
      existing.push(sanitized);
      await env.KV_COMMENTS.put(key, JSON.stringify(existing), {
        expirationTtl: 31536000 // 1 year
      });
      
      // Update rate limit
      rateLimitData.count++;
      await env.KV_COMMENTS.put(rateLimitKey, JSON.stringify(rateLimitData), {
        expirationTtl: Math.ceil(RATE_LIMIT_WINDOW / 1000)
      });
  
      // Send email notification (async, don't wait)
      // ctx.waitUntil(sendEmail(env, slug, sanitized)); // Bu Cloudflare Dashboard'da manuel deployment'ta çalışmaz
      sendEmail(env, slug, sanitized).catch(err => console.error('Email error:', err));
      
      // Return public-safe data
      const publicComment = {
        id: sanitized.id,
        name: sanitized.name,
        message: sanitized.message,
        date: formatDate(sanitized.date),
        timestamp: sanitized.timestamp
      };
  
      return json({ success: true, comment: publicComment, message: 'Yorumunuz başarıyla gönderildi!' });
    } catch (err) {
      return json({ error: err.message }, 500);
    }
  }
  
  async function handleGetComments(url, env) {
    const slug = url.pathname.split('/comments/')[1];
    if (!slug) return json({ error: "Slug gerekli" }, 400);
  
    const comments = (await env.KV_COMMENTS.get(`comments:${slug}`, "json")) || [];
    
    // Return only public data, sorted newest first
    const publicComments = comments
      .map(c => ({
        id: c.id,
        name: c.name,
        message: c.message,
        date: formatDate(c.date),
        timestamp: c.timestamp
      }))
      .sort((a, b) => b.timestamp - a.timestamp);
    
    return json({ comments: publicComments });
  }
  
  // --- Email with MailChannels ---
  async function sendEmail(env, slug, comment) {
    const payload = {
      personalizations: [{ to: [{ email: "baha@bahaerdogan.com" }] }],
      from: { email: "no-reply@bahaerdogan.com" },
      subject: `💬 New Comment on ${slug}`,
      content: [
        {
          type: "text/plain",
          value: `${comment.name} wrote:\n\n${comment.message}\n\n${comment.date}`,
        },
      ],
    };
  
    await fetch("https://api.mailchannels.net/tx/v1/send", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
  }
  
  // --- Helpers ---
  function sanitize(str) {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#x27;',
      '/': '&#x2F;'
    };
    return str.replace(/[&<>"'/]/g, char => map[char]);
  }
  
  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }
  
  function formatDate(isoDate) {
    const date = new Date(isoDate);
    return date.toLocaleDateString('tr-TR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
  
  function json(obj, status = 200) {
    return new Response(JSON.stringify(obj), {
      status,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "https://bahaerdogan.com",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }
  
  function handleOptions() {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "https://bahaerdogan.com",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }
  