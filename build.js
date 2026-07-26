const fs = require('fs');
const path = require('path');
const CleanCSS = require('clean-css');
const Terser = require('terser');
const glob = require('glob');
const { minify: minifyHTML } = require('html-minifier-terser');
const { promisify } = require('util');
const stat = promisify(fs.stat);
const readFileAsync = promisify(fs.readFile);
const writeFileAsync = promisify(fs.writeFile);

// Basic XML escape for text and attribute values
function xmlEscape(value) {
    if (value == null) return '';
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

// Minify CSS files
async function minifyCSS() {
    const cssFiles = glob.sync('css/*.css', { ignore: ['css/*.min.css'] });
    const cssMinifier = new CleanCSS({
        level: 2,
        format: 'keep-breaks'
    });

    const results = await Promise.all(cssFiles.map(async (file) => {
        try {
            const css = await readFileAsync(file, 'utf8');
            const minified = cssMinifier.minify(css);
            
            if (minified.errors && minified.errors.length > 0) {
                console.error(`CSS minification errors in ${file}:`, minified.errors);
                return { file, success: false };
            }
            
            const outputPath = file.replace('.css', '.min.css');
            await writeFileAsync(outputPath, minified.styles, 'utf8');
            console.log(`Minified ${file} to ${outputPath}`);
            return { file, success: true };
        } catch (error) {
            console.error(`Failed to minify ${file}:`, error.message);
            return { file, success: false, error };
        }
    }));
    
    const failed = results.filter(r => !r.success);
    if (failed.length > 0) {
        console.warn(`CSS minification completed with ${failed.length} failures`);
    }
}

// Minify JavaScript files
async function minifyJS() {
    const jsFiles = glob.sync('js/*.js', { ignore: ['js/*.min.js'] });
    
    const results = await Promise.all(jsFiles.map(async (file) => {
        try {
            const js = await readFileAsync(file, 'utf8');
            const minified = await Terser.minify(js, {
                compress: true,
                mangle: true
            });
            
            if (minified.error) {
                console.error(`JS minification error in ${file}:`, minified.error);
                return { file, success: false };
            }
            
            const outputPath = file.replace('.js', '.min.js');
            await writeFileAsync(outputPath, minified.code, 'utf8');
            console.log(`Minified ${file} to ${outputPath}`);
            return { file, success: true };
        } catch (error) {
            console.error(`Failed to minify ${file}:`, error.message);
            return { file, success: false, error };
        }
    }));
    
    const failed = results.filter(r => !r.success);
    if (failed.length > 0) {
        console.warn(`JS minification completed with ${failed.length} failures`);
    }
}

// Convert images to WebP
async function convertToWebP() {
    const sharp = require('sharp');
    const imageFiles = glob.sync('img/*.{png,jpg,jpeg}');
    
    const results = await Promise.all(imageFiles.map(async (file) => {
        try {
            const outputPath = file.replace(/\.(png|jpg|jpeg)$/, '.webp');
            
            // Check if WebP already exists and is newer than source
            try {
                const [sourceStat, webpStat] = await Promise.all([
                    stat(file),
                    stat(outputPath)
                ]);
                
                if (webpStat.mtime >= sourceStat.mtime) {
                    // WebP is up to date, skip conversion
                    return { file, success: true, skipped: true };
                }
            } catch (err) {
                // WebP doesn't exist or stat failed, proceed with conversion
            }
            
            await sharp(file)
                .webp({ quality: 80 })
                .toFile(outputPath);
            console.log(`Converted ${file} to ${outputPath}`);
            return { file, success: true, skipped: false };
        } catch (error) {
            console.error(`Failed to convert ${file}:`, error.message);
            return { file, success: false, error };
        }
    }));
    
    const failed = results.filter(r => !r.success);
    const skipped = results.filter(r => r.skipped);
    if (skipped.length > 0) {
        console.log(`Skipped ${skipped.length} up-to-date WebP images`);
    }
    if (failed.length > 0) {
        console.warn(`WebP conversion completed with ${failed.length} failures`);
    }
}

// Tweak icon font CSS to avoid FOIT
async function tweakIconFontCSS() {
    const targets = [
        'lib/font-awesome/css/font-awesome.min.css',
        'lib/ionicons/css/ionicons.min.css'
    ];
    
    const results = await Promise.all(targets.map(async (file) => {
        try {
            const css = await readFileAsync(file, 'utf8');
            let updated = css;
            
            if (file.includes('font-awesome') && !/font-display\s*:\s*swap/.test(css)) {
                updated = updated.replace(/(@font-face\{[^}]*font-family:\s*'FontAwesome';)([^}]*\})/,
                    (m, p1, p2) => `${p1}font-display:swap;${p2}`);
            }
            if (file.includes('ionicons') && !/font-display\s*:\s*swap/.test(updated)) {
                updated = updated.replace(/(@font-face\{[^}]*font-family:\s*"Ionicons";)([^}]*\})/,
                    (m, p1, p2) => `${p1}font-display:swap;${p2}`);
            }
            
            if (updated !== css) {
                await writeFileAsync(file, updated, 'utf8');
                console.log(`Updated font-display: swap in ${file}`);
                return { file, success: true, modified: true };
            }
            return { file, success: true, modified: false };
        } catch (error) {
            console.error(`Failed to update font-display in ${file}:`, error.message);
            return { file, success: false, error };
        }
    }));
    
    const failed = results.filter(r => !r.success);
    if (failed.length > 0) {
        console.warn(`Font CSS updates completed with ${failed.length} failures`);
    }
}

// Optimize and minify HTML files
async function optimizeHTML() {
    const htmlFiles = glob.sync('*.html');
    
    const results = await Promise.all(htmlFiles.map(async (file) => {
        try {
            let html = await readFileAsync(file, 'utf8');

            // Site-wide: prefer WebP footer background
            html = html.replace(/background-image:\s*url\(['"]img\/overlay-bg\.jpg['"]\)/gi, "background-image: url('img/overlay-bg.webp')");

            // Remove unused heavy libs when not referenced by markup
            const usesCarousel = /class=["'][^"']*blog-carousel[^"']*["']/.test(html);
            if (!usesCarousel) {
                html = html.replace(/\n?\s*<script[^>]*src=["']lib\/owlcarousel\/owl\.carousel\.min\.js["'][^>]*><\/script>/gi, '');
            }
            const usesLightbox = /data-lightbox=|class=["'][^"']*lightbox[^"']*["']/.test(html);
            if (!usesLightbox) {
                html = html.replace(/\n?\s*<script[^>]*src=["']lib\/lightbox\/js\/lightbox\.min\.js["'][^>]*><\/script>/gi, '');
            }
            const usesTyped = /class=["'][^"']*text-slider[^"']*["']/.test(html);
            if (!usesTyped) {
                html = html.replace(/\n?\s*<script[^>]*src=["']lib\/typed\/typed\.min\.js["'][^>]*><\/script>/gi, '');
            }
            // Blog listing script only needed on BlogPosts.html
            if (!/BlogPosts\.html$/i.test(file)) {
                html = html.replace(/\n?\s*<script[^>]*src=["']js\/blog\.min\.js["'][^>]*><\/script>/gi, '');
            }

            // EmailJS has been removed - now using Cloudflare Workers

            // Add defer to non-async scripts (preserve order)
            html = html.replace(/<script(\s+[^>]*?)src=("|')(.*?)(\2)([^>]*)><\/script>/gi, (match, preAttrs = '', q, src, _q2, postAttrs = '') => {
                const tag = `<script${preAttrs || ''}src=${q}${src}${q}${postAttrs || ''}></script>`;
                const isGA = /googletagmanager\.com\/gtag\//i.test(src);
                const isAsync = /\basync\b/i.test(preAttrs + postAttrs);
                const hasDefer = /\bdefer\b/i.test(preAttrs + postAttrs);
                if (isGA || isAsync || hasDefer) return tag; // leave as-is
                return `<script defer${preAttrs || ''} src=${q}${src}${q}${postAttrs || ''}></script>`;
            });

            // Add lazy-loading to images lacking it
            html = html.replace(/<img(?![^>]*\bloading=)([^>]*?)>/gi, (m, attrs) => {
                // Skip if explicitly marked eager
                if (/\bdata-no-lazy\b/i.test(attrs)) return `<img${attrs}>`;
                // Add decoding async as well
                let updated = attrs;
                updated += ' loading="lazy" decoding="async"';
                return `<img${updated}>`;
            });

            // Minify HTML
            const minified = await minifyHTML(html, {
                collapseWhitespace: true,
                removeComments: true,
                removeRedundantAttributes: true,
                removeScriptTypeAttributes: true,
                removeStyleLinkTypeAttributes: true,
                minifyCSS: true,
                minifyJS: true,
                sortAttributes: true,
                sortClassName: true,
            });
            await writeFileAsync(file, minified, 'utf8');
            console.log(`Optimized ${file}`);
            return { file, success: true };
        } catch (err) {
            console.error(`HTML optimize failed for ${file}:`, err.message);
            return { file, success: false, error: err };
        }
    }));
    
    const failed = results.filter(r => !r.success);
    if (failed.length > 0) {
        console.warn(`HTML optimization completed with ${failed.length} failures`);
        throw new Error(`Failed to optimize ${failed.length} HTML files`);
    }
}

// Generate sitemap.xml and robots.txt
async function generateSitemapAndRobots() {
    const baseUrl = 'https://bahaerdogan.com';
    const htmlFiles = glob.sync('*.html');

    // Build language groups: { base: { en: file, tr: trFile, de: deFile } }
    const groups = {};
    for (const file of htmlFiles) {
        const isIndex = file.toLowerCase() === 'index.html';
        if (isIndex) continue; // will handle index separately
        const isTr = /TR\.html$/i.test(file);
        const isDe = /DE\.html$/i.test(file);
        const base = isTr
            ? file.replace(/TR\.html$/i, '')
            : isDe
                ? file.replace(/DE\.html$/i, '')
                : file.replace(/\.html$/i, '');
        groups[base] = groups[base] || {};
        if (isTr) groups[base].tr = file; else if (isDe) groups[base].de = file; else groups[base].en = file;
    }

    const urlEntries = [];
    // Add index
    try {
        const stats = await stat('index.html');
        urlEntries.push({
            enLoc: `${baseUrl}/`,
            lastmod: new Date(stats.mtime).toISOString(),
            alternates: [
                { hreflang: 'en', href: `${baseUrl}/` },
                { hreflang: 'x-default', href: `${baseUrl}/` }
            ]
        });
    } catch (_) {}

    for (const [base, langs] of Object.entries(groups)) {
        const enFile = langs.en;
        const trFile = langs.tr;
        const deFile = langs.de;
        const lastStatFile = trFile || enFile; // pick one existing to time-stamp
        try {
            const stats = await stat(lastStatFile);
            const lastmod = new Date(stats.mtime).toISOString();
            const enLoc = enFile ? `${baseUrl}/${enFile}` : undefined;
            const trLoc = trFile ? `${baseUrl}/${trFile}` : undefined;
            const deLoc = deFile ? `${baseUrl}/${deFile}` : undefined;
            const alternates = [];
            if (enLoc) alternates.push({ hreflang: 'en', href: enLoc });
            if (trLoc) alternates.push({ hreflang: 'tr', href: trLoc });
            if (deLoc) alternates.push({ hreflang: 'de', href: deLoc });
            const xDefault = enLoc || trLoc || deLoc;
            if (xDefault) alternates.push({ hreflang: 'x-default', href: xDefault });

            urlEntries.push({ enLoc: enLoc || trLoc || deLoc, trLoc, lastmod, alternates });
        } catch (_) {
            // ignore
        }
    }

    const sitemap = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
        ...urlEntries.map(u => {
            const loc = u.enLoc || u.trLoc;
            const alt = (u.alternates || []).map(a => `    <xhtml:link rel="alternate" hreflang="${xmlEscape(a.hreflang)}" href="${xmlEscape(a.href)}" />`).join('\n');
            return `  <url>\n    <loc>${xmlEscape(loc)}</loc>\n    <lastmod>${xmlEscape(u.lastmod)}</lastmod>\n${alt}\n    <changefreq>weekly</changefreq>\n    <priority>${(loc || '').endsWith('/') ? '1.0' : '0.7'}</priority>\n  </url>`;
        }),
        '</urlset>'
    ].join('\n');

    fs.writeFileSync('sitemap.xml', sitemap);

    const robots = [
        'User-agent: *',
        'Allow: /',
        `Sitemap: ${baseUrl}/sitemap.xml`
    ].join('\n');

    fs.writeFileSync('robots.txt', robots);

    console.log('Generated sitemap.xml and robots.txt');
}

// Generate RSS feed
async function generateRSS() {
    const baseUrl = 'https://bahaerdogan.com';
    const htmlFiles = glob.sync('*.html', { ignore: ['index.html', 'BlogPosts.html'] });
    const items = [];

    for (const file of htmlFiles) {
        try {
            const content = fs.readFileSync(file, 'utf8');
            const titleMatch = content.match(/<title>([^<]+)<\/title>/i);
            const descMatch = content.match(/<meta[^>]+name=["']description["'][^>]*content=["']([^"']+)["'][^>]*>/i) || content.match(/<meta[^>]+content=["']([^"']+)["'][^>]*name=["']description["'][^>]*>/i);
            const stats = await stat(file);
            const lastmod = new Date(stats.mtime).toUTCString();
            const link = file.toLowerCase() === 'index.html' ? `${baseUrl}/` : `${baseUrl}/${file}`;
            items.push({
                title: titleMatch ? titleMatch[1] : file.replace('.html', ''),
                description: descMatch ? descMatch[1] : '',
                link,
                pubDate: lastmod
            });
        } catch (_) {
            // ignore
        }
    }

    const rss = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<rss version="2.0">',
        '  <channel>',
        '    <title>Baha Erdoğan Blog</title>',
        `    <link>${baseUrl}</link>`,
        '    <description>Articles on AI, technology, history and more</description>',
        ...items.map(i => (
            `    <item>\n      <title><![CDATA[${i.title}]]></title>\n      <link>${xmlEscape(i.link)}</link>\n      <guid>${xmlEscape(i.link)}</guid>\n      <pubDate>${xmlEscape(i.pubDate)}</pubDate>\n      <description><![CDATA[${i.description}]]></description>\n    </item>`
        )),
        '  </channel>',
        '</rss>'
    ].join('\n');

    fs.writeFileSync('feed.xml', rss);
    console.log('Generated feed.xml');
}

// Inject hreflang, canonical, OG meta, and language toggle links
async function updateI18nHeadsAndToggle() {
    const baseUrl = 'https://bahaerdogan.com';
    const htmlFiles = glob.sync('*.html');

    // Group EN/TR/DE triplets
    const groups = {};
    for (const file of htmlFiles) {
        const isTr = /TR\.html$/i.test(file);
        const isDe = /DE\.html$/i.test(file);
        const base = isTr
            ? file.replace(/TR\.html$/i, '')
            : isDe
                ? file.replace(/DE\.html$/i, '')
                : file.replace(/\.html$/i, '');
        groups[base] = groups[base] || {};
        if (isTr) groups[base].tr = file; else if (isDe) groups[base].de = file; else groups[base].en = file;
    }

    for (const [base, langs] of Object.entries(groups)) {
        const enFile = langs.en;
        const trFile = langs.tr;
        const deFile = langs.de;
        if (!enFile && !trFile && !deFile) continue;

        // Helper to safely inject into <head> with proper duplicate detection
        const injectHead = (html, inserts) => {
            if (!html.includes('<head')) return html;
            
            // Clean before inject: remove existing canonical and hreflang tags
            let cleaned = html.replace(/<link\s+[^>]*rel=["']canonical["'][^>]*>/gi, '');
            cleaned = cleaned.replace(/<link\s+[^>]*rel=["']alternate["'][^>]*hreflang=["'][^"']+["'][^>]*>/gi, '');
            
            // Also remove any OG meta tags that we'll be re-injecting
            cleaned = cleaned.replace(/<meta\s+[^>]*property=["']og:(title|description|url|type)["'][^>]*>/gi, '');
            
            // Now inject the new tags
            return cleaned.replace(/<head>([\s\S]*?)<\/head>/i, (m) => {
                // Place after opening <head>
                return m.replace('<head>', '<head>\n' + inserts.join('\n') + '\n');
            });
        };

        // Helper to inject language dropdown in navbar; idempotent with improved cleaning
        const injectLanguageLinks = (html, links) => {
            if (!Array.isArray(links) || links.length === 0) return html;
            
            // Remove any existing language switcher elements more thoroughly
            let updated = html
                // Remove old single toggle links
                .replace(/\n?\s*<li\s+class=["']nav-item["']>\s*<a[^>]*id=["']language-toggle["'][^>]*>[\s\S]*?<\/a>\s*<\/li>\s*/gi, '')
                // Remove old language-link items
                .replace(/\n?\s*<li\s+class=["']nav-item\s+language-link["'][^>]*>[\s\S]*?<\/li>\s*/gi, '')
                // Remove existing language-switcher dropdowns (more flexible pattern)
                .replace(/\n?\s*<li\s+class=["'][^"']*language-switcher[^"']*["'][^>]*>[\s\S]*?<\/li>\s*(?=\s*<\/ul>|\s*<li)/gi, '');

            // Sort links in desired order: Deutsch, English, Türkçe
            const order = { 'Deutsch': 1, 'English': 2, 'Türkçe': 3 };
            const sorted = links.slice().sort((a, b) => (order[a.label] || 99) - (order[b.label] || 99));
            const items = sorted.map(l => `<a class=\"dropdown-item\" href=\"${l.href}\">${l.label}</a>`).join('\n      ');
            const dropdown = `  <li class=\"nav-item dropdown language-switcher\">\n    <a class=\"nav-link dropdown-toggle\" href=\"#\" id=\"langDropdown\" role=\"button\" data-toggle=\"dropdown\" aria-haspopup=\"true\" aria-expanded=\"false\">\n      <i class=\"fa fa-language\"></i> Language\n    </a>\n    <div class=\"dropdown-menu dropdown-menu-right\" aria-labelledby=\"langDropdown\">\n      ${items}\n    </div>\n  </li>`;

            // Insert before closing </ul> in navbar-nav
            return updated.replace(/(<ul\s+class=["']navbar-nav["'][^>]*>[\s\S]*?)(<\/ul>)/i, (match, before, closing) => {
                // Check if dropdown already exists (shouldn't after cleaning, but safety check)
                if (before.includes('language-switcher')) return match;
                return before + '\n' + dropdown + '\n' + closing;
            });
        };

        // Read EN/TR/DE files
        let enHtml = enFile ? await readFileAsync(enFile, 'utf8') : null;
        let trHtml = trFile ? await readFileAsync(trFile, 'utf8') : null;
        let deHtml = deFile ? await readFileAsync(deFile, 'utf8') : null;

        // Derive titles
        const extractTitle = (html) => {
            const m = html && html.match(/<title>([\s\S]*?)<\/title>/i);
            return m ? m[1].trim() : '';
        };
        const enTitle = enHtml ? extractTitle(enHtml) : '';
        const trTitle = trHtml ? extractTitle(trHtml) : '';
        const deTitle = deHtml ? extractTitle(deHtml) : '';

        // Build meta blocks
        const enUrl = enFile ? (enFile.toLowerCase() === 'index.html' ? `${baseUrl}/` : `${baseUrl}/${enFile}`) : null;
        const trUrl = trFile ? `${baseUrl}/${trFile}` : null;
        const deUrl = deFile ? `${baseUrl}/${deFile}` : null;
        const alternates = [];
        if (enUrl) alternates.push(`<link rel="alternate" hreflang="en" href="${enUrl}">`);
        if (trUrl) alternates.push(`<link rel="alternate" hreflang="tr" href="${trUrl}">`);
        if (deUrl) alternates.push(`<link rel=\"alternate\" hreflang=\"de\" href=\"${deUrl}\">`);
        const xDefault = enUrl || trUrl || deUrl;
        if (xDefault) alternates.push(`<link rel="alternate" hreflang="x-default" href="${xDefault}">`);

        // Canonicals
        const enCanonical = enUrl ? `<link rel="canonical" href="${enUrl}">` : '';
        const trCanonical = trUrl ? `<link rel="canonical" href="${trUrl}">` : '';

        // OG meta for TR (simple CTR-friendly description)
        const buildTrDescription = (title) => {
            const clean = title.replace(/\s*\|\s*Türkçe/i, '').trim();
            return clean ? `Bu yazıda “${clean}” konusunu sade ve anlaşılır bir dille ele alıyorum. Örneklerle, pratik ipuçlarıyla ve net açıklamalarla hızlıca fikir sahibi olun.`
                         : 'Bu yazıda konuyu sade ve anlaşılır bir dille ele alıyorum. Örnekler ve pratik ipuçlarıyla hızlıca fikir sahibi olun.';
        };

        // Update EN
        if (enHtml && (trUrl || deUrl || enUrl)) {
            const enInserts = [enCanonical, ...alternates].filter(Boolean);
            enHtml = injectHead(enHtml, enInserts);
            enHtml = injectLanguageLinks(enHtml, [
                ...(trFile ? [{ href: trFile, label: 'Türkçe' }] : []),
                ...(deFile ? [{ href: deFile, label: 'Deutsch' }] : [])
            ]);
            await writeFileAsync(enFile, enHtml, 'utf8');
        }

        // Update TR
        if (trHtml) {
            const trInserts = [trCanonical, ...alternates].filter(Boolean);
            // Add/update meta description if missing or empty
            if (!/name=["']description["']/i.test(trHtml)) {
                trInserts.push(`<meta name="description" content="${buildTrDescription(trTitle || enTitle)}">`);
            }
            // Add OG tags if missing basic OG
            if (!/property=["']og:title["']/i.test(trHtml)) {
                const ogTitle = (trTitle || enTitle || '').replace(/\s*\|\s*Türkçe/i, '') || 'Baha Erdoğan';
                const ogDesc = buildTrDescription(trTitle || enTitle);
                const ogUrl = trUrl || enUrl || deUrl;
                if (ogUrl) {
                    trInserts.push(
                        `<meta property="og:title" content="${ogTitle}">`,
                        `<meta property="og:description" content="${ogDesc}">`,
                        `<meta property="og:url" content="${ogUrl}">`,
                        `<meta property="og:type" content="article">`
                    );
                }
            }
            // Inject into head and add language links
            trHtml = injectHead(trHtml, trInserts);
            trHtml = injectLanguageLinks(trHtml, [
                ...(enFile ? [{ href: enFile, label: 'English' }] : []),
                ...(deFile ? [{ href: deFile, label: 'Deutsch' }] : [])
            ]);
            await writeFileAsync(trFile, trHtml, 'utf8');
        }

        // Update DE
        if (deHtml) {
            const deCanonical = deUrl ? `<link rel="canonical" href="${deUrl}">` : '';
            const deInserts = [deCanonical, ...alternates].filter(Boolean);
            const buildDeDescription = (title) => {
                const clean = (title || '').replace(/\s*\|\s*Deutsch/i, '').trim();
                return clean ? `In diesem Beitrag behandle ich „${clean}“ prägnant und verständlich. Mit Beispielen, praktischen Tipps und klaren Erklärungen.`
                             : 'In diesem Beitrag wird das Thema prägnant und verständlich erklärt – mit Beispielen und praktischen Tipps.';
            };
            if (!/name=["']description["']/i.test(deHtml)) {
                deInserts.push(`<meta name="description" content="${buildDeDescription(deTitle || enTitle || trTitle)}">`);
            }
            if (!/property=["']og:title["']/i.test(deHtml)) {
                const ogTitleDe = (deTitle || enTitle || trTitle || '').replace(/\s*\|\s*Deutsch/i, '') || 'Baha Erdoğan';
                const ogDescDe = buildDeDescription(deTitle || enTitle || trTitle);
                const ogUrlDe = deUrl || enUrl || trUrl;
                if (ogUrlDe) {
                    deInserts.push(
                        `<meta property="og:title" content="${ogTitleDe}">`,
                        `<meta property="og:description" content="${ogDescDe}">`,
                        `<meta property="og:url" content="${ogUrlDe}">`,
                        `<meta property="og:type" content="article">`
                    );
                }
            }
            deHtml = injectHead(deHtml, deInserts);
            deHtml = injectLanguageLinks(deHtml, [
                ...(enFile ? [{ href: enFile, label: 'English' }] : []),
                ...(trFile ? [{ href: trFile, label: 'Türkçe' }] : [])
            ]);
            await writeFileAsync(deFile, deHtml, 'utf8');
        }
    }

    console.log('Updated head tags and language links for EN↔TR↔DE pages');
}

// Enrich Blog SEO, BreadcrumbList & Article Schema, and normalize heading hierarchy across all articles
async function enrichBlogSEOAndSchema() {
    const htmlFiles = glob.sync('*.html');
    const baseUrl = 'https://bahaerdogan.com';

    for (const file of htmlFiles) {
        if (file === 'index.html' || file === 'BlogPosts.html') continue;
        try {
            let html = await readFileAsync(file, 'utf8');

            const titleMatch = html.match(/<title>(.*?)<\/title>/i);
            const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["'](.*?)["']/i);
            const imageMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["'](.*?)["']/i);
            
            const rawTitle = titleMatch ? titleMatch[1].trim() : '';
            const title = rawTitle.replace(/\s*\|\s*(Bahaerdogan|Baha Erdoğan|Deutsch|Türkçe|Opinion|AI Technology Guide|Computer Vision Guide|Data Science Guide|AI Development Guide|Historical Perspective Guide)/gi, '').trim() || 'Article';
            const description = descMatch ? descMatch[1].trim() : '';
            const imageUrl = imageMatch ? imageMatch[1].trim() : `${baseUrl}/img/AgenticAi1.webp`;
            const articleUrl = `${baseUrl}/${file}`;

            const lang = file.endsWith('TR.html') || file.endsWith('-tr.html') ? 'tr' : (file.endsWith('DE.html') ? 'de' : 'en');

            const schemaGraph = {
                "@context": "https://schema.org",
                "@graph": [
                    {
                        "@type": "BlogPosting",
                        "@id": `${articleUrl}#article`,
                        "isPartOf": {
                            "@type": "WebPage",
                            "@id": articleUrl
                        },
                        "headline": title,
                        "description": description,
                        "image": imageUrl,
                        "inLanguage": lang,
                        "mainEntityOfPage": articleUrl,
                        "datePublished": "2024-03-20",
                        "dateModified": "2026-07-26",
                        "author": {
                            "@type": "Person",
                            "@id": "https://bahaerdogan.com/#person",
                            "name": "Baha Erdoğan",
                            "url": "https://bahaerdogan.com",
                            "jobTitle": "Computer Engineer & AI R&D Specialist"
                        },
                        "publisher": {
                            "@type": "Person",
                            "@id": "https://bahaerdogan.com/#person",
                            "name": "Baha Erdoğan"
                        }
                    },
                    {
                        "@type": "BreadcrumbList",
                        "@id": `${articleUrl}#breadcrumb`,
                        "itemListElement": [
                            {
                                "@type": "ListItem",
                                "position": 1,
                                "name": "Home",
                                "item": `${baseUrl}/`
                            },
                            {
                                "@type": "ListItem",
                                "position": 2,
                                "name": "Blog",
                                "item": `${baseUrl}/BlogPosts.html`
                            },
                            {
                                "@type": "ListItem",
                                "position": 3,
                                "name": title,
                                "item": articleUrl
                            }
                        ]
                    }
                ]
            };

            const jsonLdTag = `<script type="application/ld+json">${JSON.stringify(schemaGraph)}</script>`;

            html = html.replace(/<script[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi, '');
            html = html.replace('</head>', `${jsonLdTag}</head>`);

            html = html.replace(/<h2[^>]*class=["'][^"']*intro-title[^"']*["'][^>]*>([\s\S]*?)<\/h2>/gi, '<div class="mb-4 intro-title h2 display-4 font-weight-bold text-white">$1</div>');
            html = html.replace(/<h5([^>]*class=["'][^"']*sidebar-title[^"']*["'][^>]*)>([\s\S]*?)<\/h5>/gi, '<h3$1>$2</h3>');

            await writeFileAsync(file, html, 'utf8');
        } catch (e) {
            console.error(`Error enriching schema for ${file}:`, e.message);
        }
    }
    console.log('Enriched JSON-LD Article & BreadcrumbList schema and corrected heading hierarchy for all blog pages');
}

// Generate llms.txt and llms-full.txt for AI Search engines (GEO)
async function generateLlmsTxt() {
    const htmlFiles = glob.sync('*.html');
    const articles = [];

    for (const file of htmlFiles) {
        if (file === 'index.html' || file === 'BlogPosts.html' || file.startsWith('BlogTemplate')) continue;
        try {
            const html = await readFileAsync(file, 'utf8');
            const titleMatch = html.match(/<title>(.*?)<\/title>/i);
            const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["'](.*?)["']/i);
            const title = titleMatch ? titleMatch[1].replace(/\s*\|\s*(Bahaerdogan|Baha Erdoğan|Deutsch|Türkçe)/gi, '').trim() : file;
            const description = descMatch ? descMatch[1].trim() : '';
            articles.push({ file, title, description });
        } catch (e) {}
    }

    const llmsTxtContent = `# Baha Erdoğan
> Computer Engineer & AI R&D Specialist at Huawei R&D

- Website: https://bahaerdogan.com
- Author: Baha Erdoğan
- Focus Areas: Artificial Intelligence, Computer Vision, Machine Learning, C++, Python, Deep Learning, Software Architecture
- GitHub: https://github.com/bahaerdogan
- LinkedIn: https://www.linkedin.com/in/bahaerdogan/

## Publications & Engineering Notes

${articles.map(a => `- [${a.title}](https://bahaerdogan.com/${a.file}): ${a.description}`).join('\n')}
`;

    await writeFileAsync('llms.txt', llmsTxtContent, 'utf8');
    await writeFileAsync('llms-full.txt', llmsTxtContent, 'utf8');
    console.log('Generated llms.txt and llms-full.txt for AI Search Engines');
}

// Main build process
async function build() {
    try {
        console.log('Starting build process...');
        
        console.log('Minifying CSS files...');
        await minifyCSS();
        
        console.log('Minifying JavaScript files...');
        await minifyJS();
        
        console.log('Converting images to WebP...');
        await convertToWebP();

        console.log('Generating sitemap and robots.txt...');
        await generateSitemapAndRobots();

        console.log('Generating RSS feed...');
        await generateRSS();

        console.log('Enriching Blog SEO, Schema & Headings...');
        await enrichBlogSEOAndSchema();

        console.log('Generating llms.txt for AI search engines...');
        await generateLlmsTxt();

        console.log('Injecting i18n meta and toggles...');
        await updateI18nHeadsAndToggle();

        console.log('Tweaking icon font CSS (font-display: swap)...');
        await tweakIconFontCSS();

        console.log('Optimizing and minifying HTML...');
        await optimizeHTML();
        
        console.log('Build completed successfully!');
    } catch (error) {
        console.error('Build failed:', error);
        process.exit(1);
    }
}

build(); 