const fs = require('fs');
const path = require('path');
const CleanCSS = require('clean-css');
const Terser = require('terser');
const glob = require('glob');
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

    for (const file of cssFiles) {
        const css = fs.readFileSync(file, 'utf8');
        const minified = cssMinifier.minify(css);
        const outputPath = file.replace('.css', '.min.css');
        fs.writeFileSync(outputPath, minified.styles);
        console.log(`Minified ${file} to ${outputPath}`);
    }
}

// Minify JavaScript files
async function minifyJS() {
    const jsFiles = glob.sync('js/*.js', { ignore: ['js/*.min.js'] });
    
    for (const file of jsFiles) {
        const js = fs.readFileSync(file, 'utf8');
        const minified = await Terser.minify(js, {
            compress: true,
            mangle: true
        });
        const outputPath = file.replace('.js', '.min.js');
        fs.writeFileSync(outputPath, minified.code);
        console.log(`Minified ${file} to ${outputPath}`);
    }
}

// Convert images to WebP
async function convertToWebP() {
    const sharp = require('sharp');
    const imageFiles = glob.sync('img/*.{png,jpg,jpeg}');
    
    for (const file of imageFiles) {
        const outputPath = file.replace(/\.(png|jpg|jpeg)$/, '.webp');
        await sharp(file)
            .webp({ quality: 80 })
            .toFile(outputPath);
        console.log(`Converted ${file} to ${outputPath}`);
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

        // Helper to safely inject into <head>
        const injectHead = (html, inserts) => {
            if (!html.includes('<head')) return html;
            const already = inserts.every(snip => html.includes(snip.trim().slice(0, Math.min(30, snip.length))));
            if (already) return html; // basic idempotency
            return html.replace(/<head>([\s\S]*?)<\/head>/i, (m) => {
                // place after opening <head>
                return m.replace('<head>', '<head>\n' + inserts.join('\n') + '\n');
            });
        };

        // Helper to inject language dropdown in navbar; idempotent
        const injectLanguageLinks = (html, links) => {
            if (!Array.isArray(links) || links.length === 0) return html;
            // Remove any existing single toggle or previous language blocks
            let updated = html
                .replace(/\n?\s*<li class=\"nav-item\">\s*<a[^>]*id=["']language-toggle["'][\s\S]*?<\/li>\s*/gi, '')
                .replace(/\n?\s*<li class=\"nav-item language-link\">[\s\S]*?<\/li>\s*/gi, '')
                .replace(/\n?\s*<li class=\"nav-item dropdown language-switcher\">[\s\S]*?<\/li>\s*/gi, '');

            // Sort links in desired order: Deutsch, English, Türkçe
            const order = { 'Deutsch': 1, 'English': 2, 'Türkçe': 3 };
            const sorted = links.slice().sort((a, b) => (order[a.label] || 99) - (order[b.label] || 99));
            const items = sorted.map(l => `<a class=\"dropdown-item\" href=\"${l.href}\">${l.label}</a>`).join('\n      ');
            const dropdown = `  <li class=\"nav-item dropdown language-switcher\">\n    <a class=\"nav-link dropdown-toggle\" href=\"#\" id=\"langDropdown\" role=\"button\" data-toggle=\"dropdown\" aria-haspopup=\"true\" aria-expanded=\"false\">\n      <i class=\"fa fa-language\"></i> Language\n    </a>\n    <div class=\"dropdown-menu dropdown-menu-right\" aria-labelledby=\"langDropdown\">\n      ${items}\n    </div>\n  </li>`;

            return updated.replace(/<ul class=\"navbar-nav\">([\s\S]*?)<\/ul>/i, (match) => match.replace('</ul>', dropdown + '\n</ul>'));
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

        console.log('Injecting i18n meta and toggles...');
        await updateI18nHeadsAndToggle();
        
        console.log('Build completed successfully!');
    } catch (error) {
        console.error('Build failed:', error);
        process.exit(1);
    }
}

build(); 