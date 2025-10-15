export default {
    async fetch(request, env, ctx) {
      const url = new URL(request.url);
      const method = request.method;
  
      if (method === "OPTIONS") return handleOptions(request);
  
      if (method === "POST" && url.pathname === "/comments") {
        return await handlePostComment(request, env);
      }
  
      if (method === "GET" && url.pathname.startsWith("/comments")) {
        return await handleGetComments(url, env, request);
      }
  
      if (method === "POST" && url.pathname === "/contact") {
        return await handleContactForm(request, env);
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
          return json({ error: `Rate limit aşıldı. Lütfen ${minutesLeft} dakika sonra tekrar deneyin.` }, 429, request);
        }
      } else {
        rateLimitData.count = 0;
        rateLimitData.timestamp = now;
      }
      
      const data = await request.json();
      const { name, email, message, slug } = data;
  
      // Validation
      if (!name || name.trim().length < 2 || name.trim().length > 100)
        return json({ error: "İsim 2-100 karakter arasında olmalı" }, 400, request);
        
      if (!email || !isValidEmail(email))
        return json({ error: "Geçerli bir email adresi girin" }, 400, request);
        
      if (!message || message.trim().length < 10 || message.trim().length > 5000)
        return json({ error: "Mesaj 10-5000 karakter arasında olmalı" }, 400, request);
        
      if (!slug)
        return json({ error: "Slug gerekli" }, 400, request);
  
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
  
      return json({ success: true, comment: publicComment, message: 'Yorumunuz başarıyla gönderildi!' }, 200, request);
    } catch (err) {
      console.error('Comment submission error:', err);
      return json({ error: 'Bir hata oluştu. Lütfen daha sonra tekrar deneyin.' }, 500, request);
    }
  }
  
  async function handleGetComments(url, env, request) {
    const slug = url.pathname.split('/comments/')[1];
    if (!slug) return json({ error: "Slug gerekli" }, 400, request);
  
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
    
    return json({ comments: publicComments }, 200, request);
  }
  
  // --- Email with MailChannels ---
  async function sendEmail(env, slug, comment) {
    const payload = {
      personalizations: [{ to: [{ email: "baha@bahaerdogan.com" }] }],
      from: { 
        email: "no-reply@bahaerdogan.com",
        name: "Bahaerdogan Blog Comments"
      },
      subject: `💬 New Comment on ${slug}`,
      content: [
        {
          type: "text/html",
          value: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #0078ff;">💬 New Comment</h2>
              <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <p><strong>Blog Post:</strong> ${slug}</p>
                <p><strong>From:</strong> ${comment.name}</p>
                <p><strong>Date:</strong> ${comment.date}</p>
              </div>
              <div style="background: white; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
                <h3 style="margin-top: 0;">Comment:</h3>
                <p style="white-space: pre-wrap;">${comment.message}</p>
              </div>
              <p style="color: #666; font-size: 12px; margin-top: 20px;">
                IP Address: ${comment.ip}<br>
                Comment ID: ${comment.id}
              </p>
            </div>
          `,
        },
      ],
    };
  
    const response = await fetch("https://api.mailchannels.net/tx/v1/send", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('MailChannels error for comment:', response.status, errorText);
      throw new Error(`MailChannels error: ${response.status} - ${errorText}`);
    }
    
    console.log('Comment email sent successfully for:', slug);
  }
  
  // --- Helpers ---
  function getCorsHeaders(request) {
    const allowedOrigins = [
      'https://bahaerdogan.com',
      'https://www.bahaerdogan.com'
    ];
    
    const origin = request.headers.get('Origin');
    
    // If origin is in allowed list, use it; otherwise use default
    const allowOrigin = allowedOrigins.includes(origin) 
      ? origin 
      : allowedOrigins[0];
    
    return {
      "Access-Control-Allow-Origin": allowOrigin,
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400", // Cache preflight for 24 hours
      "Vary": "Origin" // Tell CDN to cache per origin
    };
  }

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
  
  function json(obj, status = 200, request = null) {
    const corsHeaders = request ? getCorsHeaders(request) : {
      "Access-Control-Allow-Origin": "https://bahaerdogan.com",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };
    
    return new Response(JSON.stringify(obj), {
      status,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  }
  
  // --- Contact Form Handler ---
  async function handleContactForm(request, env) {
    try {
      // Rate limiting check
      const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';
      const rateLimitKey = `contact:${clientIP}`;
      const rateLimitData = await env.KV_COMMENTS.get(rateLimitKey, 'json') || { count: 0, timestamp: Date.now() };
      
      const now = Date.now();
      const RATE_LIMIT_WINDOW = 3600000; // 1 hour
      const MAX_CONTACTS = 3;
      
      if (now - rateLimitData.timestamp < RATE_LIMIT_WINDOW) {
        if (rateLimitData.count >= MAX_CONTACTS) {
          const minutesLeft = Math.ceil((RATE_LIMIT_WINDOW - (now - rateLimitData.timestamp)) / 60000);
          return json({ error: `Rate limit exceeded. Please try again in ${minutesLeft} minute(s).` }, 429, request);
        }
      } else {
        rateLimitData.count = 0;
        rateLimitData.timestamp = now;
      }
      
      const data = await request.json();
      const { name, email, subject, message } = data;
  
      // Validation
      if (!name || name.trim().length < 2 || name.trim().length > 100)
        return json({ error: "Name must be between 2-100 characters" }, 400, request);
        
      if (!email || !isValidEmail(email))
        return json({ error: "Please enter a valid email address" }, 400, request);
        
      if (!subject || subject.trim().length < 2 || subject.trim().length > 200)
        return json({ error: "Subject must be between 2-200 characters" }, 400, request);
        
      if (!message || message.trim().length < 10 || message.trim().length > 5000)
        return json({ error: "Message must be between 10-5000 characters" }, 400, request);
  
      const sanitizedData = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: sanitize(name.trim()),
        email: email.trim().toLowerCase(),
        subject: sanitize(subject.trim()),
        message: sanitize(message.trim()),
        date: new Date().toISOString(),
        timestamp: Date.now(),
        ip: clientIP
      };
  
      // Update rate limit
      rateLimitData.count++;
      await env.KV_COMMENTS.put(rateLimitKey, JSON.stringify(rateLimitData), {
        expirationTtl: Math.ceil(RATE_LIMIT_WINDOW / 1000)
      });
  
      // Send email notification
      await sendContactEmail(env, sanitizedData);
      
      return json({ 
        success: true, 
        message: 'Your message has been sent successfully! Thank you for contacting us.'
      }, 200, request);
    } catch (err) {
      console.error('Contact form error:', err);
      return json({ error: 'Failed to send message. Please try again later.' }, 500, request);
    }
  }
  
  // --- Contact Email with MailChannels ---
  async function sendContactEmail(env, data) {
    const payload = {
      personalizations: [{ to: [{ email: "baha@bahaerdogan.com" }] }],
      from: { 
        email: "no-reply@bahaerdogan.com",
        name: "Bahaerdogan Website Contact Form"
      },
      reply_to: {
        email: data.email,
        name: data.name
      },
      subject: `📧 Contact Form: ${data.subject}`,
      content: [
        {
          type: "text/html",
          value: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #0078ff;">New Contact Form Submission</h2>
              <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <p><strong>From:</strong> ${data.name}</p>
                <p><strong>Email:</strong> <a href="mailto:${data.email}">${data.email}</a></p>
                <p><strong>Subject:</strong> ${data.subject}</p>
                <p><strong>Date:</strong> ${new Date(data.date).toLocaleString()}</p>
              </div>
              <div style="background: white; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
                <h3 style="margin-top: 0;">Message:</h3>
                <p style="white-space: pre-wrap;">${data.message}</p>
              </div>
              <p style="color: #666; font-size: 12px; margin-top: 20px;">
                IP Address: ${data.ip}<br>
                Timestamp: ${data.timestamp}
              </p>
            </div>
          `,
        },
      ],
    };
  
    const response = await fetch("https://api.mailchannels.net/tx/v1/send", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('MailChannels error for contact form:', response.status, errorText);
      throw new Error(`MailChannels error: ${response.status} - ${errorText}`);
    }
    
    console.log('Contact form email sent successfully');
  }
  
  function handleOptions(request) {
    return new Response(null, {
      headers: getCorsHeaders(request),
    });
  }
  