const fs = require('fs');
const path = require('path');
const CleanCSS = require('clean-css');
const Terser = require('terser');
const glob = require('glob');

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
        
        console.log('Build completed successfully!');
    } catch (error) {
        console.error('Build failed:', error);
        process.exit(1);
    }
}

build(); 