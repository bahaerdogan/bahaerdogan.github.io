const fs = require('fs');
const path = require('path');
const CleanCSS = require('clean-css');
const Terser = require('terser');
const glob = require('glob');
const { promisify } = require('util');
const stat = promisify(fs.stat);
const readFileAsync = promisify(fs.readFile);
const writeFileAsync = promisify(fs.writeFile);

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

    // Build language groups: { base: { en: file, tr: trFile } }
    const groups = {};
    for (const file of htmlFiles) {
        const isIndex = file.toLowerCase() === 'index.html';
        if (isIndex) continue; // will handle index separately
        const isTr = /TR\.html$/i.test(file);
        const base = isTr ? file.replace(/TR\.html$/i, '') : file.replace(/\.html$/i, '');
        groups[base] = groups[base] || {};
        if (isTr) groups[base].tr = file; else groups[base].en = file;
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
        const lastStatFile = trFile || enFile; // pick one existing to time-stamp
        try {
            const stats = await stat(lastStatFile);
            const lastmod = new Date(stats.mtime).toISOString();
            const enLoc = enFile ? `${baseUrl}/${enFile}` : undefined;
            const trLoc = trFile ? `${baseUrl}/${trFile}` : undefined;
            const alternates = [];
            if (enLoc) alternates.push({ hreflang: 'en', href: enLoc });
            if (trLoc) alternates.push({ hreflang: 'tr', href: trLoc });
            const xDefault = enLoc || trLoc;
            if (xDefault) alternates.push({ hreflang: 'x-default', href: xDefault });

            urlEntries.push({ enLoc: enLoc || trLoc, trLoc, lastmod, alternates });
        } catch (_) {
            // ignore
        }
    }

    const sitemap = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
        ...urlEntries.map(u => {
            const loc = u.enLoc || u.trLoc;
            const alt = (u.alternates || []).map(a => `    <xhtml:link rel="alternate" hreflang="${a.hreflang}" href="${a.href}" />`).join('\n');
            return `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${u.lastmod}</lastmod>\n${alt}\n    <changefreq>weekly</changefreq>\n    <priority>${loc.endsWith('/') ? '1.0' : '0.7'}</priority>\n  </url>`;
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
            `    <item>\n      <title><![CDATA[${i.title}]]></title>\n      <link>${i.link}</link>\n      <guid>${i.link}</guid>\n      <pubDate>${i.pubDate}</pubDate>\n      <description><![CDATA[${i.description}]]></description>\n    </item>`
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

    // Group EN/TR pairs
    const groups = {};
    for (const file of htmlFiles) {
        const isTr = /TR\.html$/i.test(file);
        const base = isTr ? file.replace(/TR\.html$/i, '') : file.replace(/\.html$/i, '');
        groups[base] = groups[base] || {};
        if (isTr) groups[base].tr = file; else groups[base].en = file;
    }

    for (const [base, langs] of Object.entries(groups)) {
        const enFile = langs.en;
        const trFile = langs.tr;
        if (!enFile && !trFile) continue;

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

        // Helper to add language toggle in navbar if missing
        const injectToggle = (html, targetHref, label) => {
            if (html.includes('id="language-toggle"')) return html;
            return html.replace(/<ul class="navbar-nav">([\s\S]*?)<\/ul>/i, (match) => {
                const li = `  <li class="nav-item">\n    <a class="nav-link" id="language-toggle" href="${targetHref}">\n      <i class="fa fa-language"></i> ${label}\n    </a>\n  </li>`;
                return match.replace('</ul>', li + '\n</ul>');
            });
        };

        // Read EN/TR files
        let enHtml = enFile ? await readFileAsync(enFile, 'utf8') : null;
        let trHtml = trFile ? await readFileAsync(trFile, 'utf8') : null;

        // Derive titles
        const extractTitle = (html) => {
            const m = html && html.match(/<title>([\s\S]*?)<\/title>/i);
            return m ? m[1].trim() : '';
        };
        const enTitle = enHtml ? extractTitle(enHtml) : '';
        const trTitle = trHtml ? extractTitle(trHtml) : '';

        // Build meta blocks
        const enUrl = enFile ? (enFile.toLowerCase() === 'index.html' ? `${baseUrl}/` : `${baseUrl}/${enFile}`) : null;
        const trUrl = trFile ? `${baseUrl}/${trFile}` : null;
        const alternates = [];
        if (enUrl) alternates.push(`<link rel="alternate" hreflang="en" href="${enUrl}">`);
        if (trUrl) alternates.push(`<link rel="alternate" hreflang="tr" href="${trUrl}">`);
        const xDefault = enUrl || trUrl;
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
        if (enHtml && (trUrl || enUrl)) {
            const enInserts = [enCanonical, ...alternates].filter(Boolean);
            enHtml = injectHead(enHtml, enInserts);
            const trPath = trFile || (base + 'TR.html');
            if (trPath) enHtml = injectToggle(enHtml, trPath, 'Türkçe');
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
                const ogUrl = trUrl || enUrl;
                if (ogUrl) {
                    trInserts.push(
                        `<meta property="og:title" content="${ogTitle}">`,
                        `<meta property="og:description" content="${ogDesc}">`,
                        `<meta property="og:url" content="${ogUrl}">`,
                        `<meta property="og:type" content="article">`
                    );
                }
            }
            // Inject into head and add toggle
            trHtml = injectHead(trHtml, trInserts);
            const enPath = enFile || (base + '.html');
            if (enPath) trHtml = injectToggle(trHtml, enPath, 'English');
            await writeFileAsync(trFile, trHtml, 'utf8');
        }
    }

    console.log('Updated head tags and language toggles for EN↔TR pages');
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