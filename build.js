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

const {
    BASE_URL, EXCLUDED, NOT_ARTICLES, PERSON,
    groupKeyOf, langOf, readMeta,
} = require('./tools/site-meta');

/** Load every page's real metadata once per build. */
function collectPages() {
    const pages = new Map();
    for (const file of glob.sync('*.html')) {
        try {
            pages.set(file, readMeta(file, fs.readFileSync(file, 'utf8')));
        } catch (e) {
            console.error(`Could not read metadata for ${file}:`, e.message);
        }
    }
    return pages;
}

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
        throw new Error(`CSS minification failed for: ${failed.map(f => f.file).join(', ')}`);
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
        // Previously this only warned, so the build continued and shipped the
        // previous .min.js — stale code reaching production with no signal.
        throw new Error(`JS minification failed for: ${failed.map(f => f.file).join(', ')}`);
    }
}

// Convert images to WebP
async function convertToWebP() {
    const sharp = require('sharp');
    // Originals live in img/_originals/ and are not deployed: they were ~55 MB of
    // multi-megabyte PNGs sitting next to the WebP versions actually being served.
    const imageFiles = glob.sync('img/{,_originals/}*.{png,jpg,jpeg}');

    const results = await Promise.all(imageFiles.map(async (file) => {
        try {
            const outputPath = file
                .replace('img/_originals/', 'img/')
                .replace(/\.(png|jpg|jpeg)$/, '.webp');
            
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
        'lib/ionicons/css/ionicons.min.css'
    ];
    
    const results = await Promise.all(targets.map(async (file) => {
        try {
            const css = await readFileAsync(file, 'utf8');
            let updated = css;
            
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

            // The stylesheets for the libraries stripped above were still being
            // shipped in the critical path, along with animate.css (no animate__
            // classes exist anywhere in the markup).
            for (const dead of [
                'lib/animate/animate.min.css',
                'lib/owlcarousel/assets/owl.carousel.min.css',
                'lib/lightbox/css/lightbox.min.css',
            ]) {
                html = html.replace(new RegExp(`<link[^>]*href=["']${dead.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}["'][^>]*>`, 'gi'), '');
            }

            // Nothing is served from jsDelivr except KaTeX, on the two pages that need it.
            if (!/katex/i.test(html)) {
                html = html.replace(/<link[^>]*rel=["']preconnect["'][^>]*cdn\.jsdelivr\.net[^>]*>|<link[^>]*cdn\.jsdelivr\.net[^>]*rel=["']preconnect["'][^>]*>/gi, '');
            }

            // Never re-introduce the full-screen preloader overlay: it gated first
            // paint on window.load and left a blank page whenever JS failed.
            html = html.replace(/<div\s+id=["']preloader["']\s*>\s*<\/div>/gi, '');

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
    const pages = collectPages();

    // Group translations. groupKeyOf handles both `XxxTR.html` and `xxx-tr.html`;
    // the old /TR\.html$/i test silently split the -tr pages into their own group.
    const groups = new Map();
    for (const [file, meta] of pages) {
        if (file === 'index.html') continue;
        if (meta.noindex) continue;
        const key = groupKeyOf(file);
        if (!groups.has(key)) groups.set(key, {});
        groups.get(key)[meta.lang] = meta;
    }

    const entries = [];
    const home = pages.get('index.html');
    if (home) {
        entries.push({
            loc: `${BASE_URL}/`,
            lastmod: home.lastmod,
            priority: '1.0',
            alternates: [{ hreflang: 'en', href: `${BASE_URL}/` }, { hreflang: 'x-default', href: `${BASE_URL}/` }],
        });
    }

    for (const langs of groups.values()) {
        const alternates = [];
        for (const l of ['en', 'tr', 'de']) if (langs[l]) alternates.push({ hreflang: l, href: langs[l].url });
        const xDefault = (langs.en || langs.tr || langs.de);
        if (xDefault) alternates.push({ hreflang: 'x-default', href: xDefault.url });

        for (const l of ['en', 'tr', 'de']) {
            if (!langs[l]) continue;
            entries.push({ loc: langs[l].url, lastmod: langs[l].lastmod, priority: '0.7', alternates });
        }
    }

    const sitemap = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
        ...entries.map(u => {
            const alt = (u.alternates || []).map(a => `    <xhtml:link rel="alternate" hreflang="${xmlEscape(a.hreflang)}" href="${xmlEscape(a.href)}" />`).join('\n');
            return `  <url>\n    <loc>${xmlEscape(u.loc)}</loc>\n    <lastmod>${xmlEscape(u.lastmod)}</lastmod>\n${alt}\n    <priority>${u.priority}</priority>\n  </url>`;
        }),
        '</urlset>'
    ].join('\n');

    fs.writeFileSync('sitemap.xml', sitemap + '\n');

    const disallow = [...EXCLUDED].sort().map(f => `Disallow: /${f}`);
    const robots = [
        'User-agent: *',
        'Allow: /',
        ...disallow,
        '',
        `Sitemap: ${BASE_URL}/sitemap.xml`,
        ''
    ].join('\n');
    fs.writeFileSync('robots.txt', robots);

    const skipped = [...pages.values()].filter(m => m.noindex).length;
    console.log(`Generated sitemap.xml (${entries.length} urls, ${skipped} excluded) and robots.txt`);
}

// Generate RSS feed
async function generateRSS() {
    const pages = collectPages();
    const items = [...pages.values()]
        .filter(m => !NOT_ARTICLES.has(m.file) && !m.noindex && m.lang === 'en')
        .sort((a, b) => (a.datePublished < b.datePublished ? 1 : -1));

    const rfc822 = (iso) => new Date(iso).toUTCString();

    const rss = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
        '  <channel>',
        '    <title>Baha Erdoğan — Engineering Notes</title>',
        `    <link>${BASE_URL}/</link>`,
        `    <atom:link href="${BASE_URL}/feed.xml" rel="self" type="application/rss+xml" />`,
        '    <description>Articles on AI, computer vision, engineering and technology.</description>',
        '    <language>en</language>',
        `    <lastBuildDate>${rfc822(items[0] ? items[0].dateModified : new Date())}</lastBuildDate>`,
        ...items.map(i => (
            `    <item>\n      <title><![CDATA[${i.title}]]></title>\n      <link>${xmlEscape(i.url)}</link>\n      <guid isPermaLink="true">${xmlEscape(i.url)}</guid>\n` +
            // pubDate is the real first-commit date, so subscribers stop seeing
            // the entire archive republished on every deploy.
            `      <pubDate>${rfc822(i.datePublished)}</pubDate>\n      <description><![CDATA[${i.description}]]></description>\n    </item>`
        )),
        '  </channel>',
        '</rss>'
    ].join('\n');

    fs.writeFileSync('feed.xml', rss + '\n');
    console.log(`Generated feed.xml (${items.length} English articles)`);
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
            
            // OpenGraph and Twitter tags are owned entirely by
            // enrichBlogSEOAndSchema, which runs after this step and derives them
            // from parsed page metadata. This function used to strip them here and
            // only re-add them for TR/DE pages, so every English page silently lost
            // og:title, og:description, og:url and og:type.

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
            const dropdown = `  <li class=\"nav-item dropdown language-switcher\">\n    <a class=\"nav-link dropdown-toggle\" href=\"#\" id=\"langDropdown\" role=\"button\" data-toggle=\"dropdown\" aria-haspopup=\"true\" aria-expanded=\"false\">\n      <svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" width=\"1em\" height=\"1em\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\" focusable=\"false\" class=\"icon\"><circle cx=\"12\" cy=\"12\" r=\"10\"/><line x1=\"2\" y1=\"12\" x2=\"22\" y2=\"12\"/><path d=\"M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z\"/></svg> Language\n    </a>\n    <div class=\"dropdown-menu dropdown-menu-right\" aria-labelledby=\"langDropdown\">\n      ${items}\n    </div>\n  </li>`;

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
    const pages = collectPages();

    for (const [file, meta] of pages) {
        if (NOT_ARTICLES.has(file)) continue;
        try {
            let html = await readFileAsync(file, 'utf8');

            const graph = [
                {
                    "@type": "BlogPosting",
                    "@id": `${meta.url}#article`,
                    "isPartOf": { "@type": "WebPage", "@id": meta.url },
                    "headline": meta.title,
                    "description": meta.description,
                    "image": meta.image,
                    "inLanguage": meta.lang,
                    "mainEntityOfPage": meta.url,
                    // Real dates, from git history. Never hardcode these again.
                    "datePublished": meta.datePublished,
                    "dateModified": meta.dateModified,
                    // The full Person node is inlined, not referenced by @id from
                    // another page: Google parses each page independently, so a
                    // cross-page @id reference resolves to nothing.
                    "author": PERSON,
                    "publisher": PERSON
                },
                {
                    "@type": "BreadcrumbList",
                    "@id": `${meta.url}#breadcrumb`,
                    "itemListElement": [
                        { "@type": "ListItem", "position": 1, "name": "Home", "item": `${BASE_URL}/` },
                        { "@type": "ListItem", "position": 2, "name": "Blog", "item": `${BASE_URL}/BlogPosts.html` },
                        { "@type": "ListItem", "position": 3, "name": meta.title, "item": meta.url }
                    ]
                }
            ];

            const jsonLdTag = `<script type="application/ld+json">${JSON.stringify({ "@context": "https://schema.org", "@graph": graph })}</script>`;

            // OpenGraph and Twitter were previously limited to og:image, so every
            // share fell back to whatever the crawler could guess.
            const social = [
                ['property', 'og:type', 'article'],
                ['property', 'og:title', meta.title],
                ['property', 'og:description', meta.description],
                ['property', 'og:url', meta.url],
                ['property', 'og:locale', meta.lang === 'tr' ? 'tr_TR' : meta.lang === 'de' ? 'de_DE' : 'en_US'],
                ['property', 'article:published_time', meta.datePublished],
                ['property', 'article:modified_time', meta.dateModified],
                ['property', 'article:author', 'https://www.linkedin.com/in/bahaerdogan/'],
                ['name', 'twitter:card', 'summary_large_image'],
                ['name', 'twitter:title', meta.title],
                ['name', 'twitter:description', meta.description],
                ['name', 'twitter:image', meta.image],
            ];
            // Strip every tag this function owns, then re-insert the whole block in
            // a fixed order. Replacing tags in place while also re-appending the
            // JSON-LD made the output order flip on alternate runs, so consecutive
            // builds produced different bytes for identical input.
            for (const [attr, key] of social) {
                html = html.replace(new RegExp(`<meta[^>]*${attr}=["']${key.replace(/:/g, '\\:')}["'][^>]*>`, 'gi'), '');
            }
            html = html.replace(/<script[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi, '');

            const socialTags = social
                .filter(([, , value]) => value)
                .map(([attr, key, value]) => {
                    const esc = String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
                    return `<meta content="${esc}" ${attr}="${key}">`;
                })
                .join('');

            html = html.replace('</head>', `${socialTags}${jsonLdTag}</head>`);

            html = html.replace(/<h5([^>]*class=["'][^"']*sidebar-title[^"']*["'][^>]*)>([\s\S]*?)<\/h5>/gi, '<h3$1>$2</h3>');

            await writeFileAsync(file, html, 'utf8');
        } catch (e) {
            console.error(`Error enriching schema for ${file}:`, e.message);
        }
    }
    console.log(`Enriched schema, OpenGraph and Twitter cards for ${pages.size} pages (real dates, per-page images)`);
}

// Generate llms.txt (index) and llms-full.txt (actual full text) for AI search engines
async function generateLlmsTxt() {
    const pages = collectPages();
    const articles = [...pages.values()]
        .filter(m => !NOT_ARTICLES.has(m.file) && !m.noindex)
        .sort((a, b) => (a.datePublished < b.datePublished ? 1 : -1));

    const header = [
        '# Baha Erdoğan',
        '> Computer Engineer & AI R&D Specialist at Huawei R&D.',
        '',
        `- Website: ${BASE_URL}`,
        '- Author: Baha Erdoğan',
        '- Focus areas: Artificial Intelligence, Computer Vision, Machine Learning, C++, Python, Deep Learning, Software Architecture',
        '- GitHub: https://github.com/bahaerdogan',
        '- LinkedIn: https://www.linkedin.com/in/bahaerdogan/',
        '- Languages: English, Türkçe, Deutsch',
        ''
    ];

    // llms.txt: a link index.
    const index = [
        ...header,
        '## Publications & Engineering Notes',
        '',
        ...articles.map(a => `- [${a.title}](${a.url}) — ${a.description || 'No description available.'}`),
        ''
    ].join('\n');
    await writeFileAsync('llms.txt', index, 'utf8');

    // llms-full.txt: the actual article text. The previous build wrote the exact
    // same string to both files, which made llms-full.txt worthless.
    const full = [
        ...header,
        '## Full text of all publications',
        '',
        ...articles.map(a => [
            `---`,
            ``,
            `# ${a.title}`,
            ``,
            `URL: ${a.url}`,
            `Language: ${a.lang}`,
            `Published: ${a.datePublished}`,
            `Modified: ${a.dateModified}`,
            ``,
            a.text,
            ``
        ].join('\n')),
        ''
    ].join('\n');
    await writeFileAsync('llms-full.txt', full, 'utf8');

    const kb = (s) => `${Math.round(Buffer.byteLength(s) / 1024)} KB`;
    console.log(`Generated llms.txt (${articles.length} entries, ${kb(index)}) and llms-full.txt (${kb(full)} of article text)`);
}

/**
 * Generate the sidebar search script as an external file, per language.
 *
 * Every page previously carried this list inline, hardcoded and slightly
 * different, which produced ~65 distinct inline scripts. Combined with the
 * per-page GA config below, the CSP needed 90 SHA-256 hashes and broke whenever
 * any page changed. Now there are three cacheable files and one hash.
 */
async function generateSearchScripts() {
    const pages = collectPages();
    const KEYWORDS = (title) => [...new Set(
        title.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(w => w.length > 3)
    )];

    for (const lang of ['en', 'tr', 'de']) {
        const posts = [...pages.values()]
            .filter(m => !NOT_ARTICLES.has(m.file) && !m.noindex && m.lang === lang)
            .map(m => ({ title: m.title, url: m.file, keywords: KEYWORDS(m.title) }));
        if (!posts.length) continue;

        const notFound = { en: 'No matching posts found.', tr: 'Eşleşen yazı bulunamadı.', de: 'Keine passenden Beiträge gefunden.' }[lang];

        const code = `// Generated by build.js — do not edit.
(function () {
  var blogPosts = ${JSON.stringify(posts)};
  window.searchBlog = function () {
    var input = document.getElementById('search-input');
    if (!input) return false;
    var q = input.value.toLowerCase().trim();
    if (!q) return false;
    var hit = blogPosts.filter(function (p) {
      return p.title.toLowerCase().indexOf(q) !== -1 || p.keywords.some(function (k) { return k.indexOf(q) !== -1; });
    })[0];
    if (hit) { window.location.href = hit.url; } else { alert(${JSON.stringify(notFound)}); }
    return false;
  };
})();
`;
        const file = `js/blog-search${lang === 'en' ? '' : '-' + lang}.js`;
        await writeFileAsync(file, code, 'utf8');
        const min = await Terser.minify(code, { compress: true, mangle: true });
        await writeFileAsync(file.replace('.js', '.min.js'), min.code, 'utf8');
    }
    console.log('Generated external blog-search scripts (replaces ~65 distinct inline scripts)');
}

/**
 * Replace the per-page inline search data and the per-page GA config with
 * references that are byte-identical across the site.
 */
async function externaliseInlineScripts() {
    for (const file of glob.sync('*.html')) {
        let html = await readFileAsync(file, 'utf8');
        const before = html;
        const lang = langOf(file);
        const src = `js/blog-search${lang === 'en' ? '' : '-' + lang}.min.js`;

        html = html.replace(/<script(?![^>]*\ssrc=)[^>]*>\s*(?:const|var)\s+blogPosts\s*=[\s\S]*?<\/script>/gi,
            fs.existsSync(src) ? `<script src="${src}" defer="defer"></script>` : '');

        // GA4 already records document.title, so the hardcoded page_title/page_location
        // object only served to make every page's inline script unique.
        html = html.replace(/(gtag\("config","G-ZGTWHSMVV7")\s*,\s*\{[\s\S]*?\}(\))/g, '$1$2');

        if (html !== before) await writeFileAsync(file, html, 'utf8');
    }
    console.log('Externalised inline search data and normalised the analytics snippet');
}

/**
 * Regenerate the Content-Security-Policy in _headers from the inline scripts
 * that are actually present.
 *
 * The hashes were previously maintained by hand, so any edit to any page
 * silently invalidated the policy. `<script type="application/ld+json">` is a
 * data block, not executable script, so it is deliberately excluded — hashing
 * per-page JSON-LD is what pushed the old policy to 90 hashes.
 */
async function generateCSP() {
    const crypto = require('crypto');
    const hashes = new Set();

    for (const file of glob.sync('*.html')) {
        const html = await readFileAsync(file, 'utf8');
        for (const m of html.matchAll(/<script(?![^>]*\ssrc=)([^>]*)>([\s\S]*?)<\/script>/gi)) {
            const [, attrs, body] = m;
            if (!body.trim() || /ld\+json/i.test(attrs)) continue;
            hashes.add(`'sha256-${crypto.createHash('sha256').update(body, 'utf8').digest('base64')}'`);
        }
    }

    const csp = [
        "default-src 'self'",
        "img-src 'self' data: https:",
        "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
        "font-src 'self' data: https://cdn.jsdelivr.net",
        `script-src 'self' https://www.googletagmanager.com https://www.google-analytics.com https://cdn.jsdelivr.net ${[...hashes].sort().join(' ')}`,
        "connect-src 'self' https://www.google-analytics.com https://www.googletagmanager.com https://comment-handler.baha-erdogann.workers.dev",
        "frame-ancestors 'self'",
        "base-uri 'self'",
        "form-action 'self'",
    ].join('; ') + ';';

    const headersPath = '_headers';
    let headers = await readFileAsync(headersPath, 'utf8');
    headers = headers.replace(/^(\s*)Content-Security-Policy:.*$/m, `$1Content-Security-Policy: ${csp}`);
    await writeFileAsync(headersPath, headers, 'utf8');

    console.log(`Regenerated CSP in _headers (${hashes.size} inline-script hashes)`);
}

/**
 * Fail the build on the defect classes that previously shipped to production
 * unnoticed. Each check corresponds to a real bug found in the audit.
 */
async function verify() {
    const problems = [];
    const files = glob.sync('*.html');

    for (const file of files) {
        const html = fs.readFileSync(file, 'utf8');

        if (!/<body/i.test(html)) problems.push(`${file}: no <body> element (page renders blank)`);
        if (!/<main/i.test(html)) problems.push(`${file}: no <main> landmark`);
        if (/user-scalable\s*=\s*no|maximum-scale\s*=\s*1/i.test(html)) problems.push(`${file}: viewport blocks pinch-zoom (WCAG 1.4.4)`);
        if (/id=["']preloader["']/.test(html)) problems.push(`${file}: preloader overlay reintroduced`);
        if (/class="[^"]*\bfa-[a-z]/.test(html)) problems.push(`${file}: Font Awesome class reintroduced but the stylesheet is gone`);

        const h1 = (html.match(/<h1\b/gi) || []).length;
        if (h1 !== 1) problems.push(`${file}: ${h1} <h1> elements, expected exactly 1`);

        // Duplicate script tags double-fired analytics and double-bound handlers.
        const srcs = [...html.matchAll(/<script[^>]*\bsrc=["']([^"']+)["']/gi)].map(m => m[1].split('?')[0]);
        const dupes = srcs.filter((s, i) => srcs.indexOf(s) !== i);
        if (dupes.length) problems.push(`${file}: duplicate script src ${[...new Set(dupes)].join(', ')}`);

        // Images without intrinsic size are the site's main layout-shift source.
        for (const tag of html.match(/<img\b[^>]*>/gi) || []) {
            if (!/\bwidth=/.test(tag) || !/\bheight=/.test(tag)) {
                problems.push(`${file}: <img> without width/height — ${tag.slice(0, 70)}…`);
                break;
            }
        }

        // Referenced local assets must exist.
        for (const m of html.matchAll(/(?:src|href)=["'](img\/[^"']+)["']/gi)) {
            if (!fs.existsSync(decodeURIComponent(m[1]))) problems.push(`${file}: missing asset ${m[1]}`);
        }

        // LaTeX with no math renderer renders as literal backslashes.
        if (/\\\(|\\\[/.test(html.replace(/<[^>]+>/g, ' ')) && !/katex|mathjax/i.test(html)) {
            problems.push(`${file}: contains LaTeX but loads no math renderer`);
        }

        for (const ld of html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi) || []) {
            const json = ld.replace(/^<script[^>]*>/, '').replace(/<\/script>$/, '');
            let parsed;
            try { parsed = JSON.parse(json); } catch (e) { problems.push(`${file}: invalid JSON-LD (${e.message})`); continue; }
            for (const node of parsed['@graph'] || [parsed]) {
                if (node['@type'] !== 'BlogPosting') continue;
                if (!node.description) problems.push(`${file}: BlogPosting schema has an empty description`);
                if (node.datePublished === '2024-03-20') problems.push(`${file}: hardcoded placeholder datePublished`);
            }
        }
    }

    if (problems.length) {
        console.error(`\nBuild verification found ${problems.length} problem(s):`);
        for (const p of problems.slice(0, 40)) console.error(`  ✗ ${p}`);
        if (problems.length > 40) console.error(`  … and ${problems.length - 40} more`);
        throw new Error('Build verification failed');
    }
    console.log(`Verification passed: ${files.length} pages clean`);
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


        console.log('Generating llms.txt for AI search engines...');
        await generateLlmsTxt();

        console.log('Injecting i18n meta and toggles...');
        await updateI18nHeadsAndToggle();

        console.log('Enriching Blog SEO, Schema & Headings...');
        await enrichBlogSEOAndSchema();

        console.log('Tweaking icon font CSS (font-display: swap)...');
        await tweakIconFontCSS();

        console.log('Generating search scripts...');
        await generateSearchScripts();

        console.log('Externalising inline scripts...');
        await externaliseInlineScripts();

        console.log('Optimizing and minifying HTML...');
        await optimizeHTML();

        console.log('Regenerating Content-Security-Policy...');
        await generateCSP();

        console.log('Verifying output...');
        await verify();

        console.log('Build completed successfully!');
    } catch (error) {
        console.error('Build failed:', error);
        process.exit(1);
    }
}

build(); 