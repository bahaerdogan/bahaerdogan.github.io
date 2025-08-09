const fs = require('fs');
const path = require('path');
const CleanCSS = require('clean-css');
const Terser = require('terser');
const glob = require('glob');
const { promisify } = require('util');
const stat = promisify(fs.stat);

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
        
        console.log('Build completed successfully!');
    } catch (error) {
        console.error('Build failed:', error);
        process.exit(1);
    }
}

build(); 