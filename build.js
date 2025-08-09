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
    const urlEntries = [];

    for (const file of htmlFiles) {
        try {
            const stats = await stat(file);
            const lastmod = new Date(stats.mtime).toISOString();
            const loc = file.toLowerCase() === 'index.html' ? `${baseUrl}/` : `${baseUrl}/${file}`;
            urlEntries.push({ loc, lastmod });
        } catch (_) {
            // ignore
        }
    }

    const sitemap = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
        ...urlEntries.map(u => (
            `  <url>\n    <loc>${u.loc}</loc>\n    <lastmod>${u.lastmod}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>${u.loc.endsWith('/') ? '1.0' : '0.7'}</priority>\n  </url>`
        )),
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