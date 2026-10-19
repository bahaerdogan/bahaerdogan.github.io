const fs = require('fs');
const path = require('path');
const glob = require('glob');
const { parse } = require('node-html-parser');

const files = glob.sync('*.html');
const allSlugs = new Set(files);
const issues = [];

function checkFile(file) {
    const content = fs.readFileSync(file, 'utf8');
    const root = parse(content);

    // 1. Check title & h1
    const h1s = root.querySelectorAll('h1');
    if (h1s.length !== 1) {
        issues.push({ file, type: 'h1_count', message: `Found ${h1s.length} h1 tags (expected 1)` });
    }

    // 2. Check broken images
    for (const img of root.querySelectorAll('img')) {
        const src = img.getAttribute('src');
        if (!src) {
            issues.push({ file, type: 'img_no_src', message: 'img tag with no src' });
            continue;
        }
        if (!src.startsWith('http') && !src.startsWith('data:')) {
            const cleanPath = src.split('?')[0].split('#')[0];
            if (!fs.existsSync(cleanPath)) {
                issues.push({ file, type: 'broken_img', message: `Image not found: ${src}` });
            }
        }
    }

    // 3. Check internal links
    for (const a of root.querySelectorAll('a')) {
        const href = a.getAttribute('href');
        if (!href) continue;
        if (href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('javascript:')) continue;
        if (!href.startsWith('http')) {
            const cleanHref = href.split('?')[0].split('#')[0];
            if (cleanHref && !allSlugs.has(cleanHref) && !fs.existsSync(cleanHref)) {
                issues.push({ file, type: 'broken_link', message: `Broken link: ${href}` });
            }
        }
    }

    // 4. Check for duplicated sidebar widgets
    const sidebars = root.querySelectorAll('.widget-sidebar');
    const titles = sidebars.map(s => s.querySelector('.sidebar-title, .w-title')?.text?.trim()).filter(Boolean);
    const seenTitles = new Set();
    for (const t of titles) {
        if (seenTitles.has(t)) {
            issues.push({ file, type: 'duplicate_sidebar', message: `Duplicate sidebar widget title: "${t}"` });
        }
        seenTitles.add(t);
    }

    // 5. Check for hardcoded dead href="#"
    for (const a of root.querySelectorAll('a[href="#"]')) {
        const cls = a.getAttribute('class') || '';
        if (!cls.includes('back-to-top') && !a.querySelector('svg')) {
            issues.push({ file, type: 'dead_hash_link', message: `Dead href="#" on text: "${a.text.trim()}"` });
        }
    }
}

for (const f of files) {
    checkFile(f);
}

console.log(`Audited ${files.length} pages. Found ${issues.length} issues:`);
for (const iss of issues) {
    console.log(`[${iss.type}] ${iss.file}: ${iss.message}`);
}
