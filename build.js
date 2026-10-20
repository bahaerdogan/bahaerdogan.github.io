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

const GA_ID = 'G-ZGTWHSMVV7';

/**
 * The inline analytics bootstrap, with Consent Mode v2 established before the
 * first `config` call.
 *
 * Order matters and is the whole point of this block:
 *   1. define gtag/dataLayer
 *   2. `consent default` — everything non-essential denied
 *   3. replay a previously stored grant, so a returning visitor who opted in is
 *      not re-gated while the deferred banner script is still loading
 *   4. only then `config`, which is what emits page_view
 *
 * `wait_for_update` gives the banner a window to call `consent update` before
 * GA decides how to handle the hit.
 */
const GA_BOOTSTRAP = '<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}'
    + "gtag('consent','default',{ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',"
    + "analytics_storage:'denied',personalization_storage:'denied',functionality_storage:'granted',"
    + "security_storage:'granted',wait_for_update:500});"
    + "try{var c=JSON.parse(localStorage.getItem('cookie-consent'));"
    + "if(c&&c.analytics){gtag('consent','update',{analytics_storage:'granted'})}}catch(e){}"
    + `gtag('js',new Date);gtag('config','${GA_ID}')</script>`;

/** Matches the existing inline bootstrap in whatever form the last build left it. */
const GA_BOOTSTRAP_RE = new RegExp(
    `<script>(?:(?!<\\/script>)[\\s\\S])*?gtag\\((?:"|')config(?:"|'),\\s*(?:"|')${GA_ID}(?:"|')\\)[\\s\\S]*?<\\/script>`,
    'g'
);

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

// Icon fonts are gone. Font Awesome and Ionicons were together costing ~81 KB of
// render-blocking CSS and ~1.3 MB of font files to draw 23 glyphs; both are now
// inline SVG (see tools/replace-fontawesome.js and tools/replace-ionicons.js), so
// there is no @font-face left to patch font-display onto.

/**
 * Render the blog surfaces: the home page grid, and the blog index's featured
 * article, statistics, filter bar and card grid.
 *
 * Why this runs at build time rather than in the browser:
 *
 * BlogPosts.html was authored as a client-rendered page — `#blogGrid` (empty),
 * `#loadingSpinner` ("Loading articles…"), `#noResults`, `.filter-btn`
 * elements and four `.stat-number` divs hardcoded to 0 — but the script that was
 * meant to fill them was never written. Nothing in the repo referenced
 * `#blogGrid`, `#totalPosts` or `data-category`, so the page shipped a permanent
 * spinner and four zeros. That is the "0 posts" bug: not a broken pipeline, an
 * absent one.
 *
 * Rebuilding it client-side would have reintroduced the same class of failure
 * plus an empty grid until JS parses. Rendering here means the articles are in
 * the HTML for crawlers, the LCP image is discoverable by the preload scanner,
 * and every count comes from the file listing.
 */
async function renderBlogSurfaces() {
    const B = require('./tools/blog-render.js');
    const { parse } = require('node-html-parser');
    const { CATEGORIES, categoryLabel } = require('./tools/site-meta.js');

    const HOME = { 'index.html': 'en' };
    const INDEXES = { 'BlogPosts.html': 'en' };

    // --- Home page: newest six, in the existing #blog section ---
    for (const [file, lang] of Object.entries(HOME)) {
        if (!fs.existsSync(file)) continue;
        const html = await readFileAsync(file, 'utf8');
        const root = parse(html);
        const section = root.querySelector('#blog');
        if (!section) continue;

        const posts = B.collectPosts(lang);
        const dims = await B.probeDims(posts);

        // Keep the section's own title box; replace only the cards.
        //
        // The already-rendered `.post-grid` has to be matched first. Anchoring
        // solely on the legacy `.row` of `.card-blog` markup worked once and then
        // silently stopped: after the first build there was no such row left, so
        // the home grid froze at whatever six articles existed that day and never
        // picked up a new post again.
        const target = section.querySelector('.post-grid')
            || section.querySelectorAll('.container > .row').find((r) => r.querySelectorAll('article, .card-blog').length > 0);
        if (!target) continue;

        target.replaceWith(parse(B.renderHomeGrid(posts, lang, dims, 6)));

        await writeFileAsync(file, root.toString(), 'utf8');
        console.log(`  ${file}: home grid → ${Math.min(6, posts.length)} cards`);
    }

    // --- Blog index: featured + stats + toolbar + grid ---
    for (const [file, lang] of Object.entries(INDEXES)) {
        if (!fs.existsSync(file)) continue;
        const html = await readFileAsync(file, 'utf8');
        const root = parse(html);

        const posts = B.collectPosts(lang);
        if (!posts.length) continue;
        const dims = await B.probeDims(posts);
        const stats = B.statsFor(posts);

        // Statistics, derived. The markup keeps its ids so any external link or
        // style targeting them still resolves.
        const setStat = (id, n) => {
            const el = root.querySelector(`#${id}`);
            if (el) el.set_content(String(n));
        };
        setStat('totalPosts', stats.total);
        setStat('aiPosts', stats.AI);
        setStat('techPosts', stats.Technology);
        setStat('historyPosts', stats.History);

        // The hero's hand-written search box and category buttons are replaced by
        // the generated toolbar, whose labels carry live counts and whose
        // categories match the taxonomy rather than a stale guess.
        const searchContainer = root.querySelector('.blog-hero .search-container');
        if (searchContainer) searchContainer.remove();

        const grid = root.querySelector('.blog-grid .container');
        if (!grid) continue;

        const featured = posts[0];
        const rest = posts.slice(1);

        grid.set_content(
            B.renderFeatured(featured, lang, dims) +
            `<div class="blog-toolbar js-only"><div class="blog-toolbar__inner">` +
                B.renderFilters(posts, lang) +
                `<div class="blog-search">` +
                    `<svg class="icon blog-search__icon" viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>` +
                    `<label class="sr-only" for="blogFilterInput">${B.esc(B.t(lang, 'search'))}</label>` +
                    `<input id="blogFilterInput" class="blog-search__input" type="search" autocomplete="off" placeholder="${B.esc(B.t(lang, 'search'))}…">` +
                `</div>` +
            `</div></div>` +
            `<h2 class="sr-only">${B.esc(B.t(lang, 'latest'))}</h2>` +
            `<div class="post-grid" id="blogGrid">` +
                rest.map((p) => B.renderCard(p, lang, { dims })).join('') +
            `</div>` +
            `<p class="blog-empty" id="blogEmpty" hidden>${B.esc(B.t(lang, 'none'))}</p>` +
            `<div class="blog-loadmore js-only"><button type="button" class="blog-loadmore__btn" id="blogLoadMore">${B.esc(B.t(lang, 'more'))}</button></div>`
        );

        // Filter/search/load-more enhancement. Deferred, and purely additive:
        // every card is already in the DOM above.
        let out = root.toString();
        if (!/js\/blog-index\.min\.js/.test(out)) {
            out = out.replace(/<\/body>/i, '<script defer="defer" src="js/blog-index.min.js"></script></body>');
        }

        await writeFileAsync(file, out, 'utf8');
        console.log(`  ${file}: ${stats.total} posts (AI ${stats.AI}, Tech ${stats.Technology}, History ${stats.History}, Finance ${stats.Finance})`);
    }
}

/**
 * Unify all blog post pages onto a single canonical detail layout, header
 * banner (.intro-single with subtle eyebrow badge + breadcrumb), featured image
 * (.post-thumb), .post-meta with sole <h1>, and 2-column .row (.col-md-8 +
 * .col-md-4).
 */
async function unifyBlogTemplates() {
    const B = require('./tools/blog-render.js');
    const { parse } = require('node-html-parser');
    const sharp = require('sharp');
    const pages = collectPages();

    const HOME_LBL = { en: 'Home', tr: 'Ana Sayfa', de: 'Startseite' };
    const SEARCH_LBL = {
        en: { title: 'Search', placeholder: 'Search for...' },
        tr: { title: 'Ara', placeholder: 'Blogda ara...' },
        de: { title: 'Suche', placeholder: 'Suchen...' },
    };
    const RECENT_LBL = { en: 'Recent Posts', tr: 'Son Yazılar', de: 'Neueste Beiträge' };
    const TAGS_LBL = { en: 'Tags', tr: 'Etiketler', de: 'Schlagwörter' };

    const dimCache = new Map();
    const getDim = async (relPath) => {
        if (dimCache.has(relPath)) return dimCache.get(relPath);
        try {
            const m = await sharp(relPath).metadata();
            const d = { width: m.width || 1536, height: m.height || 1024 };
            dimCache.set(relPath, d);
            return d;
        } catch {
            return { width: 1536, height: 1024 };
        }
    };

    let unified = 0;
    for (const [file, meta] of pages) {
        if (NOT_ARTICLES.has(file)) continue;
        const html = await readFileAsync(file, 'utf8');
        const root = parse(html);

        const htmlEl = root.querySelector('html');
        if (htmlEl) htmlEl.setAttribute('lang', meta.lang);

        const bodyEl = root.querySelector('body');
        if (bodyEl && !bodyEl.getAttribute('id')) bodyEl.setAttribute('id', 'page-top');

        const head = root.querySelector('head');
        if (head) {
            // Remove legacy inline <style> tags on blog post pages so all blog
            // pages rely on the unified stylesheet.
            head.querySelectorAll('style').forEach((s) => s.remove());
            if (!head.querySelector('link[href*="bootstrap.min.css"]')) {
                const styleLink = head.querySelector('link[href*="style.min.css"]');
                const bootTag = '<link href="lib/bootstrap/css/bootstrap.min.css" rel="stylesheet">';
                if (styleLink) styleLink.insertAdjacentHTML('beforebegin', bootTag);
                else head.insertAdjacentHTML('beforeend', bootTag);
            }
        }

        // Ensure #mainNav has the collapsible menu container and hamburger button
        // so normaliseNavigation, updateI18nHeadsAndToggle and applyThemeSystem
        // can populate every article's navbar.
        const navContainer = root.querySelector('#mainNav .container');
        if (navContainer && !navContainer.querySelector('#navbarDefault')) {
            navContainer.insertAdjacentHTML('beforeend',
                '<button class="collapsed navbar-toggler" type="button" aria-label="Toggle navigation" aria-controls="navbarDefault" aria-expanded="false" data-target="#navbarDefault" data-toggle="collapse"><span></span> <span></span> <span></span></button>' +
                '<div class="collapse justify-content-end navbar-collapse" id="navbarDefault"><ul class="navbar-nav"></ul></div>'
            );
        } else if (navContainer && !navContainer.querySelector('.navbar-toggler')) {
            const collapse = navContainer.querySelector('#navbarDefault');
            const togglerHtml = '<button class="collapsed navbar-toggler" type="button" aria-label="Toggle navigation" aria-controls="navbarDefault" aria-expanded="false" data-target="#navbarDefault" data-toggle="collapse"><span></span> <span></span> <span></span></button>';
            if (collapse) collapse.insertAdjacentHTML('beforebegin', togglerHtml);
            else navContainer.insertAdjacentHTML('beforeend', togglerHtml);
        }

        // Unify .intro-single header banner: replace generic "BLOG DETAILS" or
        // duplicate <h1> with a subtle eyebrow badge + accurate breadcrumb.
        const introSingle = root.querySelector('.intro-single');
        const homeLabel = HOME_LBL[meta.lang] || HOME_LBL.en;
        const eyebrow = meta.categoryLabel ? `Blog · ${meta.categoryLabel}` : 'Blog';
        const introInner =
            `<div class="overlay-mf"></div>` +
            `<div class="display-table intro-content"><div class="table-cell"><div class="container">` +
                `<span class="intro-eyebrow">${B.esc(eyebrow)}</span>` +
                `<ol class="breadcrumb d-flex justify-content-center">` +
                    `<li class="breadcrumb-item"><a href="index.html">${B.esc(homeLabel)}</a></li>` +
                    `<li class="breadcrumb-item"><a href="BlogPosts.html">Blog</a></li>` +
                    `<li class="breadcrumb-item active">${B.esc(meta.title)}</li>` +
                `</ol>` +
            `</div></div></div>`;

        if (introSingle) {
            introSingle.setAttribute('class', 'bg-image route intro intro-single');
            introSingle.setAttribute('style', "background-image:url('img/hero-article.webp')");
            introSingle.set_content(introInner);
        }

        // Normalize .blog-wrapper columns (.col-lg-8.col-md-12 -> .col-md-8, .col-md-12.col-lg-4 -> .col-md-4)
        const blogWrapper = root.querySelector('.blog-wrapper');
        if (blogWrapper) {
            const box = blogWrapper.querySelector('.post-box');
            if (box && box.parentNode) {
                box.parentNode.setAttribute('class', 'col-md-8');
            }
            const legacySide = blogWrapper.querySelector('.col-lg-4');
            if (legacySide) {
                legacySide.setAttribute('class', 'col-md-4');
            }

            // Ensure .post-box has .post-meta with <h1 class="article-title"> and .post-thumb
            if (box) {
                let postMeta = box.querySelector('.post-meta');
                if (!postMeta) {
                    const metaHtml =
                        `<div class="post-meta">` +
                            `<h1 class="article-title">${B.esc(meta.title)}</h1>` +
                            `<ul>` +
                                `<li><svg aria-hidden="true" class="icon" fill="none" focusable="false" height="1em" viewBox="0 0 24 24" width="1em" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" xmlns="http://www.w3.org/2000/svg"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg> <span class="tag">Baha Erdoğan</span></li>` +
                                `<li><svg aria-hidden="true" class="icon" fill="none" focusable="false" height="1em" viewBox="0 0 24 24" width="1em" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" xmlns="http://www.w3.org/2000/svg"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path><line x1="7" x2="7.01" y1="7" y2="7"></line></svg> <span class="tag">${B.esc(meta.categoryLabel || 'Technology')}</span></li>` +
                            `</ul>` +
                        `</div>`;
                    box.insertAdjacentHTML('afterbegin', metaHtml);
                } else {
                    const titleEl = postMeta.querySelector('.article-title, h1, h2');
                    if (titleEl && titleEl.tagName.toLowerCase() !== 'h1') {
                        titleEl.replaceWith(parse(`<h1 class="article-title">${titleEl.innerHTML}</h1>`));
                    }
                }

                let postThumb = box.querySelector('.post-thumb');
                const relImg = (meta.image || '').replace(`${BASE_URL}/`, '');
                const imgFile = relImg && fs.existsSync(relImg) ? relImg : 'img/AgenticAi1.webp';
                const dim = await getDim(imgFile);
                if (!postThumb) {
                    const thumbHtml =
                        `<div class="post-thumb">` +
                            `<img alt="${B.esc(meta.title)}" class="img-fluid" decoding="async" fetchpriority="high" data-no-lazy height="${dim.height}" src="${B.esc(imgFile)}" width="${dim.width}">` +
                        `</div>`;
                    box.insertAdjacentHTML('afterbegin', thumbHtml);
                } else {
                    const img = postThumb.querySelector('img');
                    if (img) {
                        if (!(img.getAttribute('alt') || '').trim()) img.setAttribute('alt', meta.title);
                        img.setAttribute('decoding', 'async');
                        img.setAttribute('fetchpriority', 'high');
                        img.setAttribute('data-no-lazy', '');
                        img.removeAttribute('loading');
                        if (!img.getAttribute('width') || !img.getAttribute('height')) {
                            img.setAttribute('width', String(dim.width));
                            img.setAttribute('height', String(dim.height));
                        }
                    }
                }
            }

            // Ensure .blog-wrapper .row has a .col-md-4 sidebar with Search, Recent Posts, and Tags
            const row = blogWrapper.querySelector('.container > .row');
            const S = SEARCH_LBL[meta.lang] || SEARCH_LBL.en;
            const R = RECENT_LBL[meta.lang] || RECENT_LBL.en;
            const T = TAGS_LBL[meta.lang] || TAGS_LBL.en;
            const defaultTags = meta.lang === 'tr'
                ? ['Yapay Zekâ', 'Makine Öğrenimi', 'Teknoloji', 'Veri Bilimi', 'İnovasyon']
                : meta.lang === 'de'
                    ? ['Künstliche Intelligenz', 'Machine Learning', 'Technologie']
                    : ['Artificial Intelligence', 'Machine Learning', 'Technology', 'Data Science', 'AI'];
            const tagItems = (meta.tags && meta.tags.length ? meta.tags : defaultTags)
                .map((t) => `<li><span class="tag">${B.esc(t)}</span></li>`).join('');
            const searchWidgetHtml =
                `<div class="widget-sidebar sidebar-search">` +
                    `<h3 class="sidebar-title">${B.esc(S.title)}</h3>` +
                    `<div class="sidebar-content"><form id="search-form"><div class="input-group">` +
                        `<input class="form-control" id="search-input" aria-label="${B.esc(S.placeholder)}" placeholder="${B.esc(S.placeholder)}">` +
                        `<span class="input-group-btn"><button class="btn btn-search btn-secondary" type="submit" aria-label="${B.esc(S.title)}"><svg aria-hidden="true" class="icon" fill="none" focusable="false" height="1em" viewBox="0 0 24 24" width="1em" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" xmlns="http://www.w3.org/2000/svg"><circle cx="11" cy="11" r="8"></circle><line x1="21" x2="16.65" y1="21" y2="16.65"></line></svg></button></span>` +
                    `</div></form></div>` +
                `</div>`;
            const tagsWidgetHtml =
                `<div class="widget-sidebar widget-tags"><h3 class="sidebar-title">${B.esc(T)}</h3><div class="sidebar-content"><ul>${tagItems}</ul></div></div>`;

            if (row && !row.querySelector('.col-md-4')) {
                const sidebarHtml =
                    `<div class="col-md-4">` +
                        searchWidgetHtml +
                        `<div class="widget-sidebar"><h3 class="sidebar-title">${B.esc(R)}</h3><div class="sidebar-content"><ul class="list-sidebar"></ul></div></div>` +
                        tagsWidgetHtml +
                    `</div>`;
                row.insertAdjacentHTML('beforeend', sidebarHtml);
            } else if (row) {
                const sideCol = row.querySelector('.col-md-4');
                if (sideCol && !sideCol.querySelector('.sidebar-search')) {
                    sideCol.insertAdjacentHTML('afterbegin', searchWidgetHtml);
                }
                if (sideCol && !sideCol.querySelector('.widget-tags')) {
                    const toc = sideCol.querySelector('.widget-toc');
                    if (toc) toc.insertAdjacentHTML('beforebegin', tagsWidgetHtml);
                    else sideCol.insertAdjacentHTML('beforeend', tagsWidgetHtml);
                }
            }
        }

        // Remove legacy template contact form / fake phone number inside article footers
        const footerParalax = root.querySelector('.footer-paralax');
        if (footerParalax) {
            const legacyContact = footerParalax.querySelector('.contact-mf');
            if (legacyContact) {
                const parentContainer = legacyContact.closest('.container');
                if (parentContainer && !parentContainer.querySelector('footer')) parentContainer.remove();
                else legacyContact.remove();
            }
            const credits = footerParalax.querySelector('.credits');
            if (credits) credits.set_content('');
        }

        // Normalize Leave a Reply & Comments wrapper column classes outside .blog-wrapper
        root.querySelectorAll('.col-md-8.offset-md-2').forEach((el) => {
            el.setAttribute('class', 'col-lg-8 col-md-10 mx-auto');
        });

        await writeFileAsync(file, root.toString(), 'utf8');
        unified++;
    }
    console.log(`  unified blog template structure across ${unified} article pages`);
}

/**
 * Article page furniture: table of contents, share links, previous/next and
 * related articles.
 *
 * All four are generated here rather than in the browser, for the same reason
 * the card grids are: they are navigation, so they need to exist for crawlers
 * and for readers whose JS has not run. The only client-side part is the TOC's
 * active-section highlight and the copy-link button, both of which degrade to
 * a plain anchor list and a visible URL if the script never loads.
 */
async function enhanceArticlePages() {
    const B = require('./tools/blog-render.js');
    const { parse } = require('node-html-parser');
    const { categoryLabel } = require('./tools/site-meta.js');

    const LBL = {
        en: { toc: 'On this page', share: 'Share', copy: 'Copy link', copied: 'Link copied', prev: 'Previous', next: 'Next', related: 'Related articles', recent: 'Recent Posts' },
        tr: { toc: 'Bu sayfada', share: 'Paylaş', copy: 'Bağlantıyı kopyala', copied: 'Bağlantı kopyalandı', prev: 'Önceki', next: 'Sonraki', related: 'İlgili yazılar', recent: 'Son Yazılar' },
        de: { toc: 'Auf dieser Seite', share: 'Teilen', copy: 'Link kopieren', copied: 'Link kopiert', prev: 'Zurück', next: 'Weiter', related: 'Verwandte Artikel', recent: 'Neueste Beiträge' },
    };

    // Turkish letters must be mapped before NFD. `ı` (U+0131) has no canonical
    // decomposition, so stripping combining marks leaves it intact, and the
    // ASCII filter then deletes it outright: "Ağırlık ve Ölçüm" became
    // "ag-rl-k-ve-olcum". `İ` decomposes to "I" + a dot above, which is worse —
    // the dot survives as a separator. Both are pre-mapped here.
    const TR_MAP = { 'ı': 'i', 'İ': 'i', 'ğ': 'g', 'Ğ': 'g', 'ş': 's', 'Ş': 's',
                     'ç': 'c', 'Ç': 'c', 'ö': 'o', 'Ö': 'o', 'ü': 'u', 'Ü': 'u',
                     'ä': 'a', 'Ä': 'a', 'ß': 'ss' };
    const slug = (s) => s
        .replace(/[ıİğĞşŞçÇöÖüÜäÄß]/g, (c) => TR_MAP[c] || c)
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);

    let touched = 0;

    for (const lang of ['en', 'tr', 'de']) {
        const posts = B.collectPosts(lang);
        if (posts.length < 2) continue;
        const dims = await B.probeDims(posts);
        const recentPosts = posts.slice(0, 5);

        // Also include noindexed articles of this language for sidebar/recent-post cleanup
        const allLangFiles = glob.sync('*.html').filter((f) => !NOT_ARTICLES.has(f) && langOf(f) === lang);

        for (const file of allLangFiles) {
            const idx = posts.findIndex((p) => p.file === file);
            const post = idx >= 0 ? posts[idx] : readMeta(file, await readFileAsync(file, 'utf8'));
            const html = await readFileAsync(file, 'utf8');
            const root = parse(html);

            const box = root.querySelector('.post-box');
            if (!box) continue;

            // Some legacy DE pages shipped a second .col-md-4 with a duplicate
            // search/archive sidebar. Keep the first column (TOC lands here) and
            // drop any extras so the layout does not stack two sidebars.
            const articleRow = box.parentNode?.parentNode;
            if (articleRow) {
                const sideCols = articleRow.querySelectorAll(':scope > .col-md-4');
                for (let j = 1; j < sideCols.length; j++) sideCols[j].remove();
            }

            const sidebar = root.querySelector('.col-md-4');
            const L = LBL[lang] || LBL.en;

            if (sidebar) {
                // Remove duplicate "Archives" widget and trim "Recent Post" to 5 newest items
                const widgets = sidebar.querySelectorAll('.widget-sidebar');
                for (const w of widgets) {
                    const titleEl = w.querySelector('.sidebar-title, .w-title');
                    const tText = (titleEl?.text || '').trim().toLowerCase();
                    if (tText === 'archives' || tText === 'arşiv' || tText === 'archiv') {
                        w.remove();
                    } else if (
                        tText === 'recent post' ||
                        tText === 'recent posts' ||
                        tText === 'son yazılar' ||
                        tText === 'neueste beiträge'
                    ) {
                        if (titleEl) titleEl.set_content(B.esc(L.recent));
                        const ul = w.querySelector('.list-sidebar');
                        if (ul) {
                            ul.set_content(
                                recentPosts
                                    .map((rp) => `<li><a href="${B.esc(rp.file)}">${B.esc(B.displayTitle(rp))}</a></li>`)
                                    .join('')
                            );
                        }
                    }
                }
            }

            // --- Stable heading ids, then the TOC built from them ---
            let heads = box.querySelectorAll('h2, h3');
            if (heads.length < 3) heads = box.querySelectorAll('h2, h3, h4');
            const seen = new Set();
            const items = [];
            for (const h of heads) {
                const text = h.text.replace(/\s+/g, ' ').trim();
                if (!text) continue;
                let id = h.getAttribute('id') || slug(text);
                while (seen.has(id)) id += '-x';
                seen.add(id);
                h.setAttribute('id', id);
                items.push({ id, text, level: h.tagName.toLowerCase() === 'h4' ? 'h3' : h.tagName.toLowerCase() });
            }

            if (sidebar) {
                const existing = sidebar.querySelector('.widget-toc');
                if (existing) existing.remove();
                if (items.length >= 2) {
                    const toc = `<div class="widget-sidebar widget-toc">` +
                        `<h3 class="w-title">${B.esc(L.toc)}</h3>` +
                        `<nav aria-label="${B.esc(L.toc)}"><ul class="toc-list">` +
                        items.map((it) => `<li class="toc-item toc-item--${it.level}"><a href="#${B.esc(it.id)}">${B.esc(it.text)}</a></li>`).join('') +
                        `</ul></nav></div>`;
                    // Place TOC as the last widget in .col-md-4 so static widgets
                    // above it scroll naturally and never collide with the sticky TOC.
                    sidebar.insertAdjacentHTML('beforeend', toc);
                }
            }

            // --- Share links. No tracking scripts, just URLs. ---
            const shareUrl = encodeURIComponent(post.url);
            const shareText = encodeURIComponent(B.displayTitle(post));
            const shareBlock = `<div class="post-share">` +
                `<span class="post-share__label">${B.esc(L.share)}</span>` +
                `<a class="post-share__btn" href="https://www.linkedin.com/sharing/share-offsite/?url=${shareUrl}" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn">` +
                    `<svg class="icon" viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" aria-hidden="true" focusable="false"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>` +
                `</a>` +
                `<a class="post-share__btn" href="https://twitter.com/intent/tweet?url=${shareUrl}&amp;text=${shareText}" target="_blank" rel="noopener noreferrer" aria-label="X">` +
                    `<svg class="icon" viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" aria-hidden="true" focusable="false"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>` +
                `</a>` +
                `<button type="button" class="post-share__btn post-share__copy" data-url="${B.esc(post.url)}" data-copied="${B.esc(L.copied)}" aria-label="${B.esc(L.copy)}">` +
                    `<svg class="icon" viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>` +
                `</button>` +
            `</div>`;

            const oldShare = box.querySelector('.post-share');
            if (oldShare) oldShare.replaceWith(parse(shareBlock));
            else box.insertAdjacentHTML('beforeend', shareBlock);

            root.querySelectorAll('.post-nav, .post-related').forEach((n) => n.remove());

            if (idx >= 0) {
                // --- Previous / next, in the same reading order as the index ---
                const prev = posts[idx - 1]; // newer
                const next = posts[idx + 1]; // older
                const navLink = (p, dir, label) => p
                    ? `<a class="post-nav__link post-nav__link--${dir}" href="${B.esc(p.file)}" rel="${dir}">` +
                          `<span class="post-nav__dir">${B.esc(label)}</span>` +
                          `<span class="post-nav__title">${B.esc(B.displayTitle(p))}</span>` +
                      `</a>`
                    : `<span class="post-nav__link post-nav__link--empty"></span>`;
                const navBlock = `<nav class="post-nav" aria-label="${B.esc(L.prev)} / ${B.esc(L.next)}">` +
                    navLink(prev, 'prev', L.prev) + navLink(next, 'next', L.next) + `</nav>`;

                // --- Related: ranked by shared tags, then category, then recency ---
                const related = B.relatedTo(post, posts, 3);
                const relatedBlock = related.length
                    ? `<section class="post-related" aria-labelledby="related-h">` +
                          `<h2 class="post-related__title" id="related-h">${B.esc(L.related)}</h2>` +
                          `<div class="post-grid post-grid--related">` +
                          related.map((p) => B.renderCard(p, lang, { dims })).join('') +
                          `</div></section>`
                    : '';

                const col = box.parentNode;
                col.insertAdjacentHTML('beforeend', navBlock);
                // Place Related Articles outside the 2-column .row so the right
                // sidebar stops at the end of the article text and Related Articles
                // spans the full container width in a 3-column grid.
                const row = col.parentNode;
                if (relatedBlock && row) {
                    row.insertAdjacentHTML('afterend', relatedBlock);
                }
            }

            let out = root.toString();
            if (!/js\/article-extras\.min\.js/.test(out)) {
                out = out.replace(/<\/body>/i, '<script defer="defer" src="js/article-extras.min.js"></script></body>');
            }
            await writeFileAsync(file, out, 'utf8');
            touched++;
        }
    }

    console.log(`  enhanced ${touched} article pages (TOC, share, prev/next, related)`);
}

/**
 * Theme system: font preload, the FOUC-free theme bootstrap, and the nav toggle.
 *
 * The bootstrap has to be inline and synchronous in <head>. Deferring it — or
 * moving it to an external file — means the browser paints the light theme,
 * then repaints dark once the script runs, which is a full-page flash on every
 * navigation for anyone using dark mode. It is deliberately the only inline
 * script added here; generateCSP() runs afterwards and hashes it automatically.
 */
async function applyThemeSystem() {
    const { parse } = require('node-html-parser');

    // Kept on one line: this string is hashed into the CSP, so any whitespace
    // change invalidates the hash. generateCSP() recomputes it each build.
    const BOOTSTRAP = `(function(){try{var t=localStorage.getItem('theme');`
        + `if(t==='dark'||t==='light'){document.documentElement.setAttribute('data-theme',t);}}catch(e){}})();`;

    const TOGGLE = '<button type="button" class="theme-toggle" aria-pressed="false" aria-label="Switch to dark theme">'
        + '<svg class="icon theme-toggle__moon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>'
        + '<svg class="icon theme-toggle__sun" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>'
        + '</button>';

    let touched = 0;

    for (const file of glob.sync('*.html')) {
        const html = await readFileAsync(file, 'utf8');
        const root = parse(html);
        const head = root.querySelector('head');
        if (!head) continue;

        let changed = false;

        // Preload only the latin subset. latin-ext is Turkish-only and is
        // fetched on demand by unicode-range; preloading it would download
        // 74 KB that an English page never draws a glyph from.
        if (!root.querySelector('link[href*="inter-latin-wght"]')) {
            head.insertAdjacentHTML('afterbegin',
                '<link rel="preload" href="lib/fonts/inter-latin-wght.woff2" as="font" type="font/woff2" crossorigin>');
            changed = true;
        }

        // Bootstrap must run before the stylesheet paints, so it goes first.
        //
        // Guarded by a marker attribute, never by the script's own source text.
        // The first version of this tested for `localStorage.getItem('theme')`,
        // but html-minifier rewrites the literal to double quotes, so the guard
        // stopped matching after the first build and a fresh copy was appended
        // every run — 2 bootstraps, then 4. Attributes survive minification.
        //
        // Existing copies are removed first, so a tree that already accumulated
        // duplicates is repaired by the next build rather than needing a manual
        // pass.
        // Matched two ways: by marker (current form) and by content (copies the
        // earlier, unmarked version left behind, in either quoting style).
        const priorInits = root.querySelectorAll('script').filter((n) =>
            n.hasAttribute('data-theme-init') ||
            (!n.getAttribute('src') && /localStorage\.getItem\(.theme.\)/.test(n.text)));

        priorInits.forEach((n) => n.remove());
        head.insertAdjacentHTML('afterbegin', `<script data-theme-init>${BOOTSTRAP}</script>`);
        if (priorInits.length !== 1) changed = true;

        // Toggle sits beside the hamburger rather than inside the collapse, so
        // it stays reachable on mobile without opening the menu.
        const toggler = root.querySelector('.navbar-toggler');
        if (toggler && !root.querySelector('.theme-toggle')) {
            toggler.insertAdjacentHTML('beforebegin', TOGGLE);
            changed = true;
        }

        // Per-page <style> blocks sit after the external stylesheet, so at equal
        // specificity they win — `section.blog-grid { background: #f5f5f5 }` was
        // painting a light slab behind the whole card grid in dark mode, and no
        // amount of extra rules in style.css could override it without an
        // !important arms race. The declarations are rewritten to tokens at the
        // source instead, so they follow the theme like everything else.
        const SURFACE_MAP = [
            [/background(-color)?:\s*#f5f5f5\b/gi, 'background$1: var(--surface-page)'],
            [/background(-color)?:\s*#f8f9fa\b/gi, 'background$1: var(--surface-sunken)'],
            [/background(-color)?:\s*(#fff(fff)?|white)\b/gi, 'background$1: var(--surface)'],
        ];

        for (const styleEl of root.querySelectorAll('style')) {
            let css = styleEl.text;
            if (!css || !/background/i.test(css)) continue;
            const before = css;
            // Skip gradients: their stops are brand colours, not surfaces.
            css = css.split(/(?=[^{}]*\{)/).map((rule) =>
                /gradient\(/i.test(rule) ? rule : SURFACE_MAP.reduce((acc, [re, to]) => acc.replace(re, to), rule)
            ).join('');
            if (css !== before) { styleEl.set_content(css); changed = true; }
        }

        let out = root.toString();
        if (!/js\/theme-toggle\.min\.js/.test(out)) {
            out = out.replace(/<\/body>/i, '<script defer="defer" src="js/theme-toggle.min.js"></script></body>');
            changed = true;
        }

        if (changed) { await writeFileAsync(file, out, 'utf8'); touched++; }
    }

    console.log(`  theme system applied to ${touched} pages`);
}

/**
 * Photo hero: full-screen landscape, dark overlay, Typed.js cycling the roles.
 *
 * Between 2026-10-11 and 2026-10-20 the homepage used a typography-only
 * `.hero-modern` instead. The photo version is the preferred look, so this
 * rewrites either variant back to it, keeping what the rework fixed:
 *   - the comma-joined roles stay hidden until Typed.js runs (.text-slider-items
 *     is display:none), and main.js reads them from that markup;
 *   - reduced-motion users get the roles as static text (main.js);
 *   - the hero image is preloaded per breakpoint, so phones fetch only the
 *     portrait crop the stylesheet swaps in below 769px instead of both.
 *
 * Idempotent: re-running rebuilds the hero and its preloads from the same
 * source values rather than appending.
 */
const HERO_DESKTOP_IMG = 'img/hero-home.webp';
const HERO_MOBILE_IMG = 'img/mainphotomobile.webp'; // set in style.css @media (max-width: 768px)

async function restorePhotoHero() {
    const { parse } = require('node-html-parser');
    let touched = 0;

    for (const file of glob.sync('*.html')) {
        const html = await readFileAsync(file, 'utf8');
        const root = parse(html);
        const intro = root.querySelector('.intro');
        if (!intro || !root.querySelector('.text-slider-items, .hero-modern')) continue;

        const name = (root.querySelector('.intro-title')?.text || 'Baha Erdoğan').trim();

        const sliderText = root.querySelector('.text-slider-items')?.text
            || root.querySelector('.hero-modern__roles')?.getAttribute('data-roles')
            || 'Computer Engineer,AI R&D Specialist,Problem Solver';
        const roles = sliderText.split(',').map((r) => r.trim()).filter(Boolean);

        const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');

        intro.setAttribute('class', 'route bg-image intro');
        intro.setAttribute('style', `background-image:url('${HERO_DESKTOP_IMG}')`);

        intro.set_content(
            '<div class="overlay-itro"></div>' +
            '<div class="display-table intro-content"><div class="table-cell"><div class="container">' +
                `<h1 class="intro-title mb-4">${esc(name)}</h1>` +
                '<p class="intro-subtitle">' +
                    `<span class="text-slider-items">${esc(roles.join(','))}</span>` +
                    '<span class="text-slider"></span>' +
                '</p>' +
            '</div></div></div>'
        );

        // A CSS background is invisible to the preload scanner, so without these
        // the LCP image would only start downloading once style.min.css parsed.
        root.querySelectorAll('link[rel="preload"][as="image"]')
            .filter((l) => /hero-home\.webp|mainphotomobile/.test(l.getAttribute('href') || ''))
            .forEach((l) => l.remove());
        const firstSheet = root.querySelector('head link[rel="stylesheet"]');
        const preloads =
            `<link rel="preload" as="image" href="${HERO_DESKTOP_IMG}" media="(min-width: 769px)" fetchpriority="high">` +
            `<link rel="preload" as="image" href="${HERO_MOBILE_IMG}" media="(max-width: 768px)" fetchpriority="high">`;
        if (firstSheet) firstSheet.insertAdjacentHTML('beforebegin', preloads);
        else root.querySelector('head')?.insertAdjacentHTML('beforeend', preloads);

        let out = root.toString();
        // Typed.js drives the hero; main.js must load after it.
        if (!/lib\/typed\/typed\.min\.js/.test(out)) {
            out = out.replace(/(<script[^>]*src=["']js\/main\.min\.js["'])/i,
                '<script defer="defer" src="lib/typed/typed.min.js"></script>$1');
        }

        await writeFileAsync(file, out, 'utf8');
        touched++;
    }

    console.log(`  photo hero on ${touched} page(s)`);
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
                // Skip if explicitly marked eager. `fetchpriority="high"` is the
                // LCP marker the card renderer emits: lazy-loading an image that
                // was just declared the highest-priority fetch is contradictory,
                // and it is exactly the H2 defect the audit raised.
                if (/\bdata-no-lazy\b/i.test(attrs)) return `<img${attrs}>`;
                if (/\bfetchpriority\s*=\s*["']?high\b/i.test(attrs)) return `<img${attrs}>`;
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

    // Group EN/TR/DE triplets using groupKeyOf & langOf (handles both XxxTR.html and xxx-tr.html)
    const groups = {};
    for (const file of htmlFiles) {
        const key = groupKeyOf(file);
        const lang = langOf(file);
        groups[key] = groups[key] || {};
        groups[key][lang] = file;
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
            const items = sorted.map(l => `<a class="dropdown-item${l.active ? ' active' : ''}" href="${l.href}">${l.label}</a>`).join('\n      ');
            const dropdown = `  <li class="nav-item dropdown language-switcher">\n    <a class="nav-link dropdown-toggle" href="#" id="langDropdown" role="button" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false">\n      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false" class="icon"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg> Language\n    </a>\n    <div class="dropdown-menu dropdown-menu-right" aria-labelledby="langDropdown">\n      ${items}\n    </div>\n  </li>`;

            // Insert before closing </ul> in navbar-nav
            return updated.replace(/(<ul\s+class=["']navbar-nav["'][^>]*>[\s\S]*?)(<\/ul>)/i, (match, before, closing) => {
                if (before.includes('language-switcher')) return match;
                return before + '\n' + dropdown + '\n' + closing;
            });
        };

        const enHref = enFile || null;
        const buildDropdownLinks = (currentLang) => {
            if (!trFile && !deFile) {
                // Standalone pages (index.html, BlogPosts.html, BlogTemplate.html)
                return [
                    { href: enHref || 'index.html', label: 'English', active: currentLang === 'en' },
                    { href: 'WhyBuildingAiStartupIsHardTR.html', label: 'Türkçe', active: false },
                    { href: 'AI-DefenseDE.html', label: 'Deutsch', active: false },
                ];
            }
            return [
                ...(enHref ? [{ href: enHref, label: 'English', active: currentLang === 'en' }] : []),
                ...(trFile ? [{ href: trFile, label: 'Türkçe', active: currentLang === 'tr' }] : []),
                ...(deFile ? [{ href: deFile, label: 'Deutsch', active: currentLang === 'de' }] : []),
            ];
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
        if (deUrl) alternates.push(`<link rel="alternate" hreflang="de" href="${deUrl}">`);
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
            enHtml = injectLanguageLinks(enHtml, buildDropdownLinks('en'));
            await writeFileAsync(enFile, enHtml, 'utf8');
        }

        // Update TR
        if (trHtml) {
            const trInserts = [trCanonical, ...alternates].filter(Boolean);
            if (!/name=["']description["']/i.test(trHtml)) {
                trInserts.push(`<meta name="description" content="${buildTrDescription(trTitle || enTitle)}">`);
            }
            trHtml = injectHead(trHtml, trInserts);
            trHtml = injectLanguageLinks(trHtml, buildDropdownLinks('tr'));
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
            deHtml = injectHead(deHtml, deInserts);
            deHtml = injectLanguageLinks(deHtml, buildDropdownLinks('de'));
            await writeFileAsync(deFile, deHtml, 'utf8');
        }
    }

    console.log('Updated head tags and language links for EN↔TR↔DE pages');
}

// Enrich Blog SEO, BreadcrumbList & Article Schema, and normalize heading hierarchy across all articles
async function enrichBlogSEOAndSchema() {
    const pages = collectPages();

    for (const [file, meta] of pages) {
        // These two carry hand-authored schema and are left alone.
        if (file === 'index.html' || file === 'BlogPosts.html') continue;
        // Everything else still gets OpenGraph and a schema node — a legal page
        // is not a BlogPosting, but it is not exempt from having a share card.
        const isArticle = !NOT_ARTICLES.has(file);
        try {
            let html = await readFileAsync(file, 'utf8');

            const primary = isArticle
                ? {
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
                }
                : {
                    "@type": "WebPage",
                    "@id": `${meta.url}#webpage`,
                    "name": meta.title,
                    "description": meta.description,
                    "inLanguage": meta.lang,
                    "url": meta.url,
                    "dateModified": meta.dateModified,
                    "publisher": PERSON
                };

            const graph = [
                primary,
                {
                    "@type": "BreadcrumbList",
                    "@id": `${meta.url}#breadcrumb`,
                    "itemListElement": isArticle
                        ? [
                            { "@type": "ListItem", "position": 1, "name": "Home", "item": `${BASE_URL}/` },
                            { "@type": "ListItem", "position": 2, "name": "Blog", "item": `${BASE_URL}/BlogPosts.html` },
                            { "@type": "ListItem", "position": 3, "name": meta.title, "item": meta.url }
                        ]
                        : [
                            { "@type": "ListItem", "position": 1, "name": "Home", "item": `${BASE_URL}/` },
                            { "@type": "ListItem", "position": 2, "name": meta.title, "item": meta.url }
                        ]
                }
            ];

            const jsonLdTag = `<script type="application/ld+json">${JSON.stringify({ "@context": "https://schema.org", "@graph": graph })}</script>`;

            // OpenGraph and Twitter were previously limited to og:image, so every
            // share fell back to whatever the crawler could guess.
            const social = [
                ['property', 'og:type', isArticle ? 'article' : 'website'],
                ['property', 'og:title', meta.title],
                ['property', 'og:description', meta.description],
                ['property', 'og:url', meta.url],
                ['property', 'og:locale', meta.lang === 'tr' ? 'tr_TR' : meta.lang === 'de' ? 'de_DE' : 'en_US'],
                // article:* is meaningless on a non-article and Facebook ignores it.
                ...(isArticle ? [
                    ['property', 'article:published_time', meta.datePublished],
                    ['property', 'article:modified_time', meta.dateModified],
                    ['property', 'article:author', 'https://www.linkedin.com/in/bahaerdogan/'],
                ] : []),
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
  function searchBlog() {
    var input = document.getElementById('search-input');
    if (!input) return false;
    var q = input.value.toLowerCase().trim();
    if (!q) return false;
    var hit = blogPosts.filter(function (p) {
      return p.title.toLowerCase().indexOf(q) !== -1 || p.keywords.some(function (k) { return k.indexOf(q) !== -1; });
    })[0];
    if (hit) { window.location.href = hit.url; } else { alert(${JSON.stringify(notFound)}); }
    return false;
  }
  window.searchBlog = searchBlog;

  // Bound here rather than with an inline onsubmit attribute, which a
  // Content-Security-Policy that carries script hashes will refuse to run.
  // The markup previously called handleSearch(), a *different* function in
  // main.js built on a hardcoded two-entry list, so the sidebar search could
  // only ever find two of the ${posts.length} posts and reported every other
  // query as "not found".
  document.addEventListener('DOMContentLoaded', function () {
    var form = document.getElementById('search-form');
    if (form) form.addEventListener('submit', function (e) { e.preventDefault(); searchBlog(); });
  });
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

        if (html.includes('id="search-form"') && fs.existsSync(src) && !html.includes(`src="${src}"`)) {
            html = html.replace(/<\/body>/i, `<script src="${src}" defer="defer"></script></body>`);
        }

        // GA4 already records document.title, so the hardcoded page_title/page_location
        // object only served to make every page's inline script unique.
        html = html.replace(/(gtag\("config","G-ZGTWHSMVV7")\s*,\s*\{[\s\S]*?\}(\))/g, '$1$2');

        // Inline event handlers cannot run under a CSP that carries script
        // hashes ('unsafe-inline' is ignored once a hash or nonce is present).
        // These are all bound from real script files instead:
        //   onsubmit="return handleSearch(event)"  -> js/blog-search*.js
        //   onclick="scrollToTop()"                -> js/main.js
        //   onload="renderMathInElement(...)"      -> js/katex-init.js
        html = html.replace(/\s+onsubmit="return handleSearch\(event\)"/g, '');
        html = html.replace(/\s+onclick="scrollToTop\(\)"/g, '');
        html = html.replace(
            /(<script[^>]*auto-render\.min\.js[^>]*?)\s+onload=(?:"[^"]*"|'[^']*')([^>]*><\/script>)/g,
            '$1$2<script defer="defer" src="js/katex-init.min.js"></script>'
        );

        // Consent Mode v2 must be established *before* the first `config` call.
        // The banner in main.js set `consent default` correctly but shipped with
        // `defer`, so it ran after this head snippet had already sent a page_view
        // — analytics fired ungated on every first visit. Rewriting the whole
        // bootstrap here keeps the ordering guarantee in one place, and the CSP
        // hash for it is regenerated further down the build.
        html = html.replace(GA_BOOTSTRAP_RE, GA_BOOTSTRAP);

        if (html !== before) await writeFileAsync(file, html, 'utf8');
    }
    console.log('Externalised inline search data and normalised the analytics snippet');
}

/**
 * Link the web app manifest from every page.
 *
 * The pages already declared `theme-color` and `apple-mobile-web-app-capable`
 * but there was no manifest for them to belong to — a half-configured PWA that
 * Lighthouse flags and that gives Android no icon to install with.
 */
async function linkManifest() {
    const tag = '<link href="manifest.webmanifest" rel="manifest">';
    let changed = 0;
    for (const file of glob.sync('*.html')) {
        const html = await readFileAsync(file, 'utf8');
        if (html.includes('rel="manifest"')) continue;
        const updated = html.replace(/(<link href="img\/favicon\.png" rel="icon">)/, `$1${tag}`);
        if (updated !== html) {
            await writeFileAsync(file, updated, 'utf8');
            changed++;
        }
    }
    console.log(`Linked the web app manifest from ${changed} pages`);
}

/**
 * Turn dead `href="#"` anchors into plain text.
 *
 * Every article page carried an anchor for its category and five for its tags,
 * none of which led anywhere. For a keyboard user that is six focusable
 * elements per page that do nothing except scroll the page back to the top.
 *
 * The Bootstrap dropdown toggle and the back-to-top control also use href="#",
 * but both are wired to real behaviour, so they are left alone.
 */
async function removeDeadAnchors() {
    const { parse } = require('node-html-parser');

    let changed = 0;
    let removed = 0;
    for (const file of glob.sync('*.html')) {
        const html = await readFileAsync(file, 'utf8');
        const root = parse(html);

        const dead = [
            ...root.querySelectorAll('.widget-tags ul li a'),
            ...root.querySelectorAll('.post-meta a'),
        ].filter((a) => (a.getAttribute('href') || '').trim() === '#');
        if (!dead.length) continue;

        let updated = html;
        for (const a of dead) {
            updated = updated.replace(a.outerHTML, `<span class="tag">${a.innerHTML}</span>`);
        }
        if (updated !== html) {
            await writeFileAsync(file, updated, 'utf8');
            changed++;
            removed += dead.length;
        }
    }
    console.log(`Replaced ${removed} dead href="#" anchors with text across ${changed} pages`);
}

/**
 * Give every page the same primary navigation.
 *
 * The site shipped nine different nav sets: the homepage had Experience but the
 * articles did not, the articles ordered Voluntary before Projects, BlogPosts
 * dropped Voluntary, and TypesOfAgenticAiDE had lost everything except "Blog".
 * That is a WCAG 2.2 SC 3.2.3 (Consistent Navigation) failure and it makes the
 * site feel like several sites.
 *
 * Labels stay localised — that is better for the reader — but the item set and
 * their order are now identical everywhere. The language-switcher <li> is owned
 * by updateI18nHeadsAndToggle and is carried across untouched.
 */
async function normaliseNavigation() {
    const LABELS = {
        en: ['Home', 'About', 'Blog', 'Experience', 'Projects', 'Voluntary', 'Contact'],
        tr: ['Ana Sayfa', 'Hakkında', 'Blog', 'Deneyim', 'Projeler', 'Gönüllülük', 'İletişim'],
        de: ['Startseite', 'Über mich', 'Blog', 'Erfahrung', 'Projekte', 'Ehrenamt', 'Kontakt'],
    };
    const SECTIONS = ['home', 'about', 'blog', 'experience', 'projects', 'voluntary', 'contact'];

    // Operated on the raw string, not a parsed tree: node-html-parser re-serialises
    // the switcher's inline SVG (`<circle/>` becomes `<circle></circle>`), so the
    // node's outerHTML never appears verbatim in the file and a replace() against
    // it silently matches nothing.
    const NAV_RE = /<ul class="navbar-nav">([\s\S]*?)<\/ul>/;
    const SWITCHER_RE = /<li class="nav-item dropdown language-switcher"[\s\S]*$/;

    let changed = 0;
    for (const file of glob.sync('*.html')) {
        const html = await readFileAsync(file, 'utf8');
        const m = html.match(NAV_RE);
        if (!m) continue;

        const isHome = file === 'index.html';
        const labels = LABELS[langOf(file)] || LABELS.en;

        // The language switcher is always the final <li>; keep it byte-for-byte.
        const switcherMatch = m[1].match(SWITCHER_RE);
        const switcher = switcherMatch ? switcherMatch[0] : '';

        const items = SECTIONS.map((section, i) => {
            let href;
            if (section === 'blog') href = isHome ? '#blog' : 'BlogPosts.html';
            else if (isHome) href = `#${section}`;
            else href = section === 'home' ? 'index.html' : `index.html#${section}`;

            const active = (isHome && section === 'home') || (!isHome && section === 'blog') ? ' active' : '';
            return `<li class="nav-item"><a href="${href}" class="js-scroll nav-link${active}">${labels[i]}</a></li>`;
        }).join('');

        const rebuilt = `<ul class="navbar-nav">${items}${switcher}</ul>`;
        let updated = html.replace(NAV_RE, () => rebuilt);

        // Use relative index.html / index.html#... links in markup so navigation
        // works across file://, subdirectory previews, and root servers alike
        // (js/main.js cleans /index.html in the address bar via history.replaceState on HTTP/S).
        if (!isHome) {
            updated = updated.replace(/(<a[^>]*class="[^"]*navbar-brand[^"]*"[^>]*href=")[^"]*(")/gi, '$1index.html$2');
            updated = updated.replace(/(<a[^>]*href=")[^"]*("[^>]*class="[^"]*navbar-brand[^"]*")/gi, '$1index.html$2');
        }
        updated = updated.replace(/href="\/#([^"]+)"/gi, 'href="index.html#$1"');
        updated = updated.replace(/href="\/"/gi, 'href="index.html"');

        // Ensure every page with #mainNav loads the full Bootstrap 4 + easing + main.js
        // dependency chain so mobile collapse, the Language dropdown (requires Popper.js),
        // and smooth-scroll / navbar-reduce work on every page.
        if (updated.includes('id="mainNav"')) {
            if (!updated.includes('lib/jquery/jquery.min.js')) {
                const navScripts =
                    '<script defer="defer" src="lib/jquery/jquery.min.js"></script>' +
                    '<script defer="defer" src="lib/popper/popper.min.js"></script>' +
                    '<script defer="defer" src="lib/bootstrap/js/bootstrap.min.js"></script>' +
                    '<script defer="defer" src="lib/easing/easing.min.js"></script>' +
                    '<script defer="defer" src="js/main.min.js"></script>';
                updated = updated.replace(/<\/body>/i, `${navScripts}</body>`);
            } else {
                if (updated.includes('lib/bootstrap/js/bootstrap.min.js') && !updated.includes('lib/popper/popper.min.js')) {
                    updated = updated.replace(
                        /(<script[^>]*src=["']lib\/bootstrap\/js\/bootstrap\.min\.js["'][^>]*>)/i,
                        '<script defer="defer" src="lib/popper/popper.min.js"></script>$1'
                    );
                }
                if (updated.includes('js/main.min.js') && !updated.includes('lib/easing/easing.min.js')) {
                    updated = updated.replace(
                        /(<script[^>]*src=["']js\/main\.min\.js["'][^>]*>)/i,
                        '<script defer="defer" src="lib/easing/easing.min.js"></script>$1'
                    );
                }
            }
        }

        // Clean up unminified or duplicate comment scripts on TR pages
        updated = updated.replace(/src=["']js\/comments-system-tr\.js["']/gi, 'src="js/comments-system-tr.min.js"');
        if (updated.includes('js/comments-system-tr.min.js') && updated.includes('js/comments-system.min.js')) {
            updated = updated.replace(/<script[^>]*src=["']js\/comments-system\.min\.js["'][^>]*><\/script>/gi, '');
        }

        if (updated === html) continue;
        await writeFileAsync(file, updated, 'utf8');
        changed++;
    }
    console.log(`Normalised primary navigation on ${changed} pages`);
}

/**
 * Use one spelling of the name everywhere.
 *
 * The site shipped three variants: "Bahaerdogan" in the navbar, the <title>
 * suffix, the footer and og:site_name, but "Baha Erdoğan" in JSON-LD and
 * llms.txt. The homepage — the page that anchors the entity for Google's
 * Knowledge Graph and for LLM retrieval — used the wrong one.
 *
 * Only the capitalised form is rewritten; the lowercase "bahaerdogan" inside
 * bahaerdogan.com, github.com/bahaerdogan and the LinkedIn URL is left intact.
 */
async function unifyBrandName() {
    let changed = 0;
    for (const file of glob.sync('*.html')) {
        const html = await readFileAsync(file, 'utf8');
        const updated = html.replace(/Bahaerdogan/g, 'Baha Erdoğan');
        if (updated !== html) {
            await writeFileAsync(file, updated, 'utf8');
            changed++;
        }
    }
    console.log(`Unified the brand name to "Baha Erdoğan" across ${changed} pages`);
}

/**
 * Repair visible breadcrumbs that describe a different article.
 *
 * Several pages carried a breadcrumb copy-pasted from whichever page they were
 * cloned from: the export-economics essay and the blog template both read
 * "Anomaly Detection in Machine Learning", and the macOS cheatsheet and the
 * earnings essay both read "Data". Google flags a visible/markup mismatch, and
 * the label is simply wrong for the reader.
 *
 * Only breadcrumbs that share *no* significant word with the page title are
 * rewritten. A deliberately shortened label ("The Role of AI in Defense
 * Technologies" for a longer headline) is good UX and is left alone.
 */
async function fixVisibleBreadcrumbs() {
    const { parse } = require('node-html-parser');
    const significant = (s) => new Set(
        s.toLowerCase()
            .normalize('NFD').replace(/[̀-ͯ]/g, '')
            .replace(/[^\p{L}\p{N}\s]/gu, ' ')
            .split(/\s+/)
            .filter((w) => w.length > 3)
    );

    let fixed = 0;
    for (const file of glob.sync('*.html')) {
        const html = await readFileAsync(file, 'utf8');
        const root = parse(html);
        const crumbs = root.querySelectorAll('.breadcrumb .breadcrumb-item');
        if (!crumbs.length) continue;

        const last = crumbs[crumbs.length - 1];
        const current = last.text.trim();
        const title = (root.querySelector('title')?.text || '').replace(/\s*\|.*$/, '').trim();
        if (!current || !title) continue;

        // A word counts as shared if either form starts with the other, so German
        // compounds match their base ("Verteidigung" / "Verteidigungstechnologien")
        // and a legitimately shortened label is not treated as a wrong one.
        const a = [...significant(current)];
        const b = [...significant(title)];
        const overlaps = a.some((w) => b.some((v) => v.startsWith(w) || w.startsWith(v)));
        if (overlaps) continue;

        const escaped = title.replace(/&/g, '&amp;').replace(/</g, '&lt;');
        const updated = html.replace(last.outerHTML, last.outerHTML.replace(current, escaped));
        if (updated !== html) {
            await writeFileAsync(file, updated, 'utf8');
            console.log(`  breadcrumb in ${file}: "${current}" -> "${title}"`);
            fixed++;
        }
    }
    console.log(`Corrected ${fixed} breadcrumbs that named a different article`);
}

/**
 * Guarantee every page has a footer, and link the privacy policy from it in the
 * page's own language.
 *
 * A policy nobody can reach is not a policy, and this is its only permanent
 * link, so the page stays discoverable to crawlers. Four pages (BlogPosts and
 * the three privacy pages cloned from it) had no <footer> element at all.
 */
async function ensureFooterAndLegalLink() {
    const LABEL = { en: 'Privacy Policy', tr: 'Gizlilik Politikası', de: 'Datenschutz' };
    const HREF = { en: 'privacy.html', tr: 'privacy-tr.html', de: 'privacy-de.html' };

    const footerFor = (inner) =>
        `<footer><div class="container"><div class="row"><div class="col-sm-12">`
        + `<div class="copyright-box">${inner}</div></div></div></div></footer>`;

    let linked = 0;
    let added = 0;

    for (const file of glob.sync('*.html')) {
        let html = await readFileAsync(file, 'utf8');
        const before = html;
        const lang = langOf(file);
        const link = `<p class="legal-link"><a href="${HREF[lang]}">${LABEL[lang]}</a></p>`;
        const copyright = '<p class="copyright">&copy; Copyright <strong>Baha Erdoğan </strong>All Rights Reserved</p>';

        if (!/<footer[\s>]/i.test(html)) {
            // Footer belongs after the main landmark, not inside it.
            if (html.includes('</main>')) {
                html = html.replace('</main>', `</main>${footerFor(copyright + link)}`);
                added++;
            }
        } else if (!html.includes('class="legal-link"')) {
            html = html.replace(/(<p class="copyright">[\s\S]*?<\/p>)/, `$1${link}`);
            linked++;
        }

        if (html !== before) await writeFileAsync(file, html, 'utf8');
    }
    console.log(`Privacy policy linked from ${linked} footers; added ${added} missing footers`);
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

    // The site is served by GitHub Pages, which reads neither `_headers`
    // (Cloudflare Pages / Netlify) nor `.htaccess` (Apache) — verified against
    // production, where no security header is present at all. Until the host
    // changes, the <meta> element is the only way any of this policy takes
    // effect, so it is emitted as well and kept byte-identical to the header.
    //
    // `frame-ancestors` is dropped: it is invalid in a meta policy and browsers
    // log a console error for it. Clickjacking therefore still needs a real
    // header (X-Frame-Options / frame-ancestors) from the host.
    const metaCsp = csp
        .split('; ')
        .filter((d) => !/^frame-ancestors\b/.test(d))
        .join('; ');
    const metaTag = `<meta http-equiv="Content-Security-Policy" content="${metaCsp.replace(/"/g, '&quot;')}">`;

    let injected = 0;
    for (const file of glob.sync('*.html')) {
        let html = await readFileAsync(file, 'utf8');
        const before = html;
        // Attribute-order-independent on purpose: html-minifier-terser runs with
        // sortAttributes, so after one pass the tag is
        // `<meta content="…" http-equiv="…">`. Anchoring on http-equiv being
        // first is what made an earlier version of this append a second policy
        // on every build — the same class of bug as the og:image regex that the
        // audit traced the fabricated schema back to.
        html = html.replace(/<meta[^>]*http-equiv=["']Content-Security-Policy["'][^>]*>/gi, '');
        // Must be the first thing in <head>: a meta policy only governs content
        // that appears after it.
        html = html.replace(/<head>/i, `<head>${metaTag}`);
        if (html !== before) {
            await writeFileAsync(file, html, 'utf8');
            injected++;
        }
    }

    console.log(`Regenerated CSP (${hashes.size} inline-script hashes) in _headers and ${injected} <meta> tags`);
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
/**
 * Snapshot every file the build is about to mutate, so a validation failure can
 * be rolled back instead of leaving a half-written tree.
 *
 * A true src/ -> dist/ split is the right long-term answer, but this repo is
 * served from its own root by GitHub Pages: introducing dist/ changes the
 * deployment contract, not just the build. This gives the property that
 * actually matters in the meantime — validation gates the result, and a failing
 * build leaves the working tree exactly as it found it, rather than reporting
 * damage it has already done.
 */
async function withRollback(run) {
    const tracked = glob.sync('*.html')
        .concat(glob.sync('{sitemap.xml,feed.xml,llms.txt,llms-full.txt,robots.txt}'));

    const snapshot = new Map();
    for (const f of tracked) {
        try { snapshot.set(f, fs.readFileSync(f)); } catch { /* not yet present */ }
    }

    try {
        return await run();
    } catch (err) {
        let restored = 0;
        for (const [f, buf] of snapshot) {
            try {
                if (!fs.readFileSync(f).equals(buf)) { fs.writeFileSync(f, buf); restored++; }
            } catch { /* file vanished; nothing to restore onto */ }
        }
        console.error(`\n  Rolled back ${restored} file(s) — the working tree is unchanged.`);
        throw err;
    }
}

async function build() {
    try {
        console.log('Starting build process...');

        await withRollback(async () => {
        
        console.log('Minifying CSS files...');
        await minifyCSS();
        
        console.log('Minifying JavaScript files...');
        await minifyJS();
        
        console.log('Converting images to WebP...');
        await convertToWebP();

        console.log('Unifying blog post templates...');
        await unifyBlogTemplates();

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

        console.log('Rendering blog surfaces (home grid, featured, stats, cards)...');
        await renderBlogSurfaces();

        console.log('Enhancing article pages (TOC, share, prev/next, related)...');
        await enhanceArticlePages();

        console.log('Restoring photo hero...');
        await restorePhotoHero();

        console.log('Applying theme system (font preload, theme bootstrap, toggle)...');
        await applyThemeSystem();

        console.log('Generating search scripts...');
        await generateSearchScripts();

        console.log('Externalising inline scripts...');
        await externaliseInlineScripts();

        // Icon-font replacement runs every build, not once by hand: a page
        // restored from git history came back carrying <span class="ion-…">
        // and a stylesheet link to a directory that no longer exists.
        console.log('Replacing any icon-font markup with inline SVG...');
        require('child_process').execFileSync(process.execPath, ['tools/replace-fontawesome.js'], { stdio: 'inherit' });
        require('child_process').execFileSync(process.execPath, ['tools/replace-ionicons.js'], { stdio: 'inherit' });

        console.log('Ensuring footers and privacy link...');
        await ensureFooterAndLegalLink();

        console.log('Normalising navigation, brand name, breadcrumbs and dead links...');
        await normaliseNavigation();
        await unifyBrandName();
        await fixVisibleBreadcrumbs();
        await removeDeadAnchors();
        await linkManifest();

        console.log('Optimizing and minifying HTML...');
        await optimizeHTML();

        console.log('Regenerating Content-Security-Policy...');
        await generateCSP();

        console.log('Verifying output...');
        await verify();

        console.log('Validating articles...');
        require('./tools/validate-articles.js').validateArticles();
        });

        console.log('Build completed successfully!');
    } catch (error) {
        console.error('Build failed:', error);
        process.exit(1);
    }
}

build(); 