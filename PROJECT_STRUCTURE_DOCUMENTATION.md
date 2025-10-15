# 📁 Project Structure Documentation

**Project:** bahaerdogan.com  
**Documentation Date:** October 13, 2025  
**Version:** 1.0

---

## 📊 Overview

This document provides a comprehensive overview of the bahaerdogan.com project structure, including file organization, dependencies, and architectural patterns.

---

## 🏗️ Architecture Overview

```
bahaerdogan.com
├── Frontend (Static Site)
│   ├── HTML Pages (55 files)
│   ├── CSS Stylesheets (6 themes + minified)
│   ├── JavaScript (8 files + minified)
│   └── Images (85 files, PNG/JPG + WebP)
│
├── Backend (Cloudflare Workers)
│   ├── Comments System
│   ├── Contact Form Handler
│   └── MailChannels Email Integration
│
├── Build System (Node.js)
│   ├── CSS/JS Minification
│   ├── HTML Optimization
│   ├── WebP Conversion
│   ├── Sitemap Generation
│   └── i18n Meta Tag Injection
│
└── Infrastructure
    ├── GitHub Pages (Hosting)
    ├── Cloudflare CDN
    ├── Cloudflare KV (Storage)
    └── MailChannels (Email)
```

---

## 📂 Directory Structure

### Root Directory

```
bahaerdogan.com/
├── .git/                      # Git repository
├── .github/                   # GitHub configuration
├── .kiro/                     # Kiro IDE configuration
│   └── specs/                 # Feature specifications
│       └── project-audit-and-fixes/
│           ├── requirements.md
│           ├── design.md
│           └── tasks.md
├── .vscode/                   # VS Code configuration
├── .well-known/               # Security and verification files
│   └── security.txt           # Security contact information
├── cloudflare-worker/         # Cloudflare Worker backend
│   ├── worker.js              # Main worker code
│   ├── wrangler.toml          # Worker configuration
│   └── .wrangler/             # Wrangler build artifacts
├── css/                       # Stylesheets
│   ├── style.css              # Main stylesheet
│   ├── style.min.css          # Minified main stylesheet
│   ├── style-*.css            # Theme variations
│   └── style-*.min.css        # Minified theme variations
├── img/                       # Images
│   ├── *.png                  # PNG images
│   ├── *.jpg                  # JPEG images
│   ├── *.jpeg                 # JPEG images
│   └── *.webp                 # WebP images
├── js/                        # JavaScript files
│   ├── main.js                # Main JavaScript
│   ├── main.min.js            # Minified main JavaScript
│   ├── blog.js                # Blog functionality
│   ├── blog.min.js            # Minified blog JavaScript
│   ├── comments-system.js     # Comments system (English)
│   ├── comments-system.min.js # Minified comments (English)
│   ├── comments-system-tr.js  # Comments system (Turkish)
│   ├── comments-system-tr.min.js # Minified comments (Turkish)
│   ├── contact.js             # Contact form
│   └── contact.min.js         # Minified contact form
├── lib/                       # Third-party libraries
│   ├── animate/               # CSS animations
│   ├── bootstrap/             # Bootstrap framework
│   ├── counterup/             # Counter animations
│   ├── easing/                # Easing functions
│   ├── font-awesome/          # Font Awesome icons
│   ├── ionicons/              # Ionicons
│   ├── jquery/                # jQuery library
│   ├── lightbox/              # Lightbox gallery
│   ├── owlcarousel/           # Owl Carousel
│   ├── popper/                # Popper.js
│   └── typed/                 # Typed.js
├── node_modules/              # npm dependencies
├── *.html                     # HTML pages (55 files)
├── .gitignore                 # Git ignore rules
├── .htaccess                  # Apache configuration
├── _headers                   # Cloudflare Pages headers
├── build.js                   # Build script
├── CNAME                      # Custom domain configuration
├── feed.xml                   # RSS feed
├── package.json               # npm configuration
├── package-lock.json          # npm lock file
├── robots.txt                 # Search engine rules
└── sitemap.xml                # Site map
```

---

## 📄 File Purposes and Dependencies

### HTML Files (55 total)

#### Main Pages
- **index.html** - Homepage
  - Dependencies: main.js, style.css, Bootstrap, jQuery
  - Features: Hero section, portfolio, about, contact

#### Blog Posts (English)
- **BlogPosts.html** - Blog listing page
- **AgenticAiExplained.html** - Agentic AI explanation
- **AgenticAiTechDepth.html** - Agentic AI technical depth
- **AgenticAivsGenAi.html** - Agentic AI vs Generative AI
- **TypesOfAgenticAi.html** - Types of Agentic AI
- **AI-Defense.html** - AI in defense
- **AlgorithmsExplained.html** - Algorithms explanation
- **MachineLearning-Explained.html** - Machine learning basics
- **MachineLearningAnomalyDetection.html** - ML anomaly detection
- **WhatAiMeansToYou.html** - AI impact
- **ai-and-human-job-competition.html** - AI and jobs
- **DeservingMoney.html** - Economics topic
- **DistanceCalculatingMethods.html** - Distance calculations
- **MacShortcuts.html** - Mac keyboard shortcuts
- **ValuePerKilogramForProsperity.html** - Export economics
- **PreciousMetalData.html** - Precious metals data
- **WhyToLearnHistory.html** - History importance

#### Blog Posts (Turkish - TR suffix)
- **AgenticAiExplainedTR.html**
- **AgenticAiTechDepthTR.html**
- **AgenticAivsGenAiTR.html**
- **TypesOfAgenticAiTR.html**
- **AI-DefenseTR.html**
- **AlgorithmsExplainedTR.html**
- **MachineLearning-ExplainedTR.html**
- **MachineLearningAnomalyDetectionTR.html**
- **WhatAiMeansToYouTR.html**
- **ai-and-human-job-competition-tr.html**
- **DeservingMoneyTR.html**
- **DistanceCalculatingMethodsTR.html**
- **MacShortcutsTR.html**
- **ValuePerKilogramForProsperityTR.html**
- **PreciousMetalDataTR.html**
- **WhyToLearnHistoryTR.html**
- **ErgenekonEpicTR.html**
- **OguzKaganEpicTR.html**

#### Blog Posts (German - DE suffix)
- **AgenticAiExplainedDE.html**
- **AgenticAiTechDepthDE.html**
- **AgenticAivsGenAiDE.html**
- **TypesOfAgenticAiDE.html**
- **AI-DefenseDE.html**
- **AlgorithmsExplainedDE.html**
- **MachineLearning-ExplainedDE.html**
- **MachineLearningAnomalyDetectionDE.html**
- **ValuePerKilogramForProsperityDE.html**

#### Templates
- **BlogTemplate.html** - English blog template
- **BlogTemplateTR.html** - Turkish blog template
- **BlogTemplateDE.html** - German blog template

---

### CSS Files

#### Main Stylesheets
- **css/style.css** - Main stylesheet (unminified)
  - Purpose: Core styles for the website
  - Dependencies: Bootstrap, Font Awesome, Ionicons
  - Size: ~50KB

- **css/style.min.css** - Minified main stylesheet
  - Purpose: Production version of main stylesheet
  - Generated by: build.js
  - Size: ~35KB

#### Theme Variations
- **css/style-green.css** / **css/style-green.min.css**
- **css/style-orange.css** / **css/style-orange.min.css**
- **css/style-purple.css** / **css/style-purple.min.css**
- **css/style-red.css** / **css/style-red.min.css**
- **css/style-sky-blue.css** / **css/style-sky-blue.min.css**

**Purpose**: Color theme variations  
**Usage**: Loaded conditionally based on user preference

---

### JavaScript Files

#### Core JavaScript
- **js/main.js** - Main JavaScript file
  - Purpose: Core functionality, navigation, animations
  - Dependencies: jQuery, Bootstrap, Typed.js, Owl Carousel
  - Features:
    - Navigation handling
    - Smooth scrolling
    - Portfolio filtering
    - Language switching
    - Cookie consent
    - Google Analytics integration
  - Size: ~15KB

- **js/main.min.js** - Minified version
  - Generated by: build.js
  - Size: ~8KB

#### Blog Functionality
- **js/blog.js** - Blog-specific functionality
  - Purpose: Blog search, filtering, category management
  - Dependencies: jQuery
  - Features:
    - Blog post search
    - Category filtering
    - Post sorting
  - Size: ~5KB

- **js/blog.min.js** - Minified version
  - Generated by: build.js
  - Size: ~3KB

#### Comments System
- **js/comments-system.js** - English comments system
  - Purpose: Handle comment submission and display
  - Dependencies: None (vanilla JavaScript)
  - Features:
    - Comment form validation
    - XSS protection
    - Rate limiting feedback
    - Comment display
    - Cloudflare Worker integration
  - API Endpoint: https://comment-handler.baha-erdogann.workers.dev
  - Size: ~8KB

- **js/comments-system-tr.js** - Turkish comments system
  - Purpose: Same as English version with Turkish messages
  - Size: ~8KB

- **js/comments-system.min.js** - Minified English version
- **js/comments-system-tr.min.js** - Minified Turkish version

#### Contact Form
- **js/contact.js** - Contact form handler
  - Purpose: Handle contact form submission
  - Dependencies: None (vanilla JavaScript)
  - Features:
    - Form validation
    - Email sending via Cloudflare Worker
    - Rate limiting feedback
    - Success/error messages
  - API Endpoint: https://comment-handler.baha-erdogann.workers.dev/contact
  - Size: ~5KB

- **js/contact.min.js** - Minified version
  - Generated by: build.js
  - Size: ~3KB

---

### Third-Party Libraries

#### Bootstrap 4.x
- **lib/bootstrap/css/bootstrap.min.css** - Bootstrap CSS
- **lib/bootstrap/js/bootstrap.min.js** - Bootstrap JavaScript
- **Purpose**: Responsive grid, components, utilities
- **Usage**: Core framework for layout and components

#### jQuery 3.x
- **lib/jquery/jquery.min.js** - jQuery library
- **lib/jquery/jquery-migrate.min.js** - jQuery migration helper
- **Purpose**: DOM manipulation, AJAX, animations
- **Usage**: Required by Bootstrap and custom scripts

#### Font Awesome
- **lib/font-awesome/css/font-awesome.min.css** - Font Awesome CSS
- **lib/font-awesome/fonts/** - Font files
- **Purpose**: Icon fonts
- **Usage**: Icons throughout the site

#### Ionicons
- **lib/ionicons/css/ionicons.min.css** - Ionicons CSS
- **lib/ionicons/fonts/** - Font files
- **Purpose**: Additional icon fonts
- **Usage**: Social media icons, UI elements

#### Animate.css
- **lib/animate/animate.min.css** - Animation library
- **Purpose**: CSS animations
- **Usage**: Page transitions, element animations

#### Owl Carousel
- **lib/owlcarousel/owl.carousel.min.js** - Carousel JavaScript
- **lib/owlcarousel/assets/owl.carousel.min.css** - Carousel CSS
- **Purpose**: Responsive carousel/slider
- **Usage**: Portfolio slider, testimonials

#### Lightbox
- **lib/lightbox/js/lightbox.min.js** - Lightbox JavaScript
- **lib/lightbox/css/lightbox.min.css** - Lightbox CSS
- **Purpose**: Image gallery lightbox
- **Usage**: Portfolio image viewing

#### Typed.js
- **lib/typed/typed.min.js** - Typing animation
- **Purpose**: Animated typing effect
- **Usage**: Homepage hero section

#### CounterUp
- **lib/counterup/jquery.counterup.min.js** - Counter animation
- **lib/counterup/jquery.waypoints.min.js** - Waypoints for triggering
- **Purpose**: Animated number counters
- **Usage**: Statistics section

#### Easing
- **lib/easing/easing.min.js** - Easing functions
- **Purpose**: Smooth animation easing
- **Usage**: Scroll animations, transitions

#### Popper.js
- **lib/popper/popper.min.js** - Positioning engine
- **Purpose**: Tooltip and popover positioning
- **Usage**: Required by Bootstrap

---

### Images

#### Total: 85 images
- **PNG**: 30 files
- **JPG/JPEG**: 13 files
- **WebP**: 42 files (converted versions)

#### Categories

**Blog Post Images**:
- AgenticAi*.png/webp - Agentic AI illustrations
- machinelearning*.jpeg/webp - ML illustrations
- AlgorithmsExplained.png/webp - Algorithm diagrams
- defenseai.png/webp - Defense AI illustration
- aivshumanjobraceopart.png/webp - AI vs human jobs

**Cultural Content**:
- OguzKagan.jpeg/webp - Historical figure
- ergenekon.jpeg/webp - Historical topic
- ErgenekonEpic images

**Economics/Data**:
- CubistExportPerKG.png/webp - Export data visualization
- moneyearn.png/webp - Economics illustration
- datamine.png/webp - Data mining illustration

**UI Elements**:
- favicon.png/webp - Site favicon
- apple-touch-icon.png/webp - iOS icon
- intro-bg.jpg/webp - Background image
- overlay-bg.jpg/webp - Overlay background
- mainphotomobile.png/webp - Mobile hero image

**Portfolio**:
- post-*.png/webp - Portfolio items
- testimonial-*.jpg/webp - Testimonial images

---

### Cloudflare Worker

#### worker.js
**Purpose**: Backend API for comments and contact form  
**Size**: ~12KB  
**Language**: JavaScript (ES6+)

**Endpoints**:
- `GET /health` - Health check
- `GET /comments/:slug` - Fetch comments for a blog post
- `POST /comments` - Submit a new comment
- `POST /contact` - Submit contact form

**Features**:
- Input validation and sanitization
- XSS protection
- Rate limiting (3 requests/hour per IP)
- CORS configuration (www and non-www)
- MailChannels email integration
- Cloudflare KV storage
- Comprehensive error handling

**Dependencies**:
- Cloudflare Workers runtime
- Cloudflare KV (KV_COMMENTS namespace)
- MailChannels API

#### wrangler.toml
**Purpose**: Cloudflare Worker configuration  
**Contents**:
- Worker name: comment-handler
- Compatibility date
- KV namespace bindings
- Environment variables

---

### Build System

#### build.js
**Purpose**: Build and optimization script  
**Size**: ~20KB  
**Language**: Node.js

**Functions**:

1. **CSS Minification**
   - Minifies all CSS files in css/ directory
   - Uses clean-css library
   - Parallel processing
   - Generates .min.css files

2. **JavaScript Minification**
   - Minifies all JS files in js/ directory
   - Uses terser library
   - Parallel processing
   - Generates .min.js files

3. **HTML Optimization**
   - Minifies HTML files
   - Injects i18n meta tags (canonical, hreflang)
   - Updates language toggle links
   - Uses html-minifier-terser
   - Parallel processing

4. **WebP Conversion**
   - Converts PNG/JPG to WebP
   - Quality: 80%
   - Idempotent (skips if up-to-date)
   - Uses sharp library
   - Concurrent processing

5. **Sitemap Generation**
   - Generates sitemap.xml
   - Groups pages by content
   - Adds hreflang alternates
   - Uses actual file modification times

6. **Font CSS Updates**
   - Updates font-display property
   - Ensures font-display: swap

**Dependencies**:
- clean-css - CSS minification
- terser - JavaScript minification
- html-minifier-terser - HTML minification
- sharp - Image processing
- fs/promises - File system operations

---

### Configuration Files

#### package.json
**Purpose**: npm package configuration  
**Scripts**:
- `build` - Run build.js
- `test` - Run tests (if any)

**Dependencies** (71 production):
- clean-css: ^5.3.3
- terser: ^5.31.0
- html-minifier-terser: ^7.2.0
- sharp: ^0.33.4

**DevDependencies** (28):
- Various testing and development tools

#### .gitignore
**Purpose**: Git ignore rules  
**Ignores**:
- node_modules/
- .DS_Store
- .env files
- .wrangler/
- Build artifacts

#### .htaccess
**Purpose**: Apache server configuration  
**Contents**:
- Redirect rules
- Security headers
- MIME types
- Caching rules

**Note**: Not used on Cloudflare Pages, but kept for compatibility

#### _headers
**Purpose**: Cloudflare Pages security headers  
**Contents**:
- X-Frame-Options: DENY
- X-Content-Type-Options: nosniff
- Referrer-Policy: strict-origin-when-cross-origin
- Permissions-Policy
- Content-Security-Policy

#### CNAME
**Purpose**: Custom domain configuration  
**Contents**: bahaerdogan.com

#### robots.txt
**Purpose**: Search engine crawler rules  
**Contents**:
- Allow all crawlers
- Sitemap location

#### sitemap.xml
**Purpose**: Site structure for search engines  
**Contents**:
- 22 URL entries
- 73 hreflang alternates
- Last modification dates
- Priority values

#### feed.xml
**Purpose**: RSS feed for blog posts  
**Contents**:
- Blog post listings
- Publication dates
- Descriptions

---

## 🔗 Dependencies and Relationships

### Frontend Dependencies

```
HTML Pages
├── CSS
│   ├── Bootstrap (framework)
│   ├── Font Awesome (icons)
│   ├── Ionicons (icons)
│   ├── Animate.css (animations)
│   ├── Owl Carousel (carousel)
│   ├── Lightbox (gallery)
│   └── Custom styles (style.css)
│
└── JavaScript
    ├── jQuery (required by Bootstrap)
    ├── Popper.js (required by Bootstrap)
    ├── Bootstrap (framework)
    ├── Typed.js (typing animation)
    ├── CounterUp (counter animation)
    ├── Waypoints (scroll triggers)
    ├── Easing (smooth animations)
    ├── Owl Carousel (carousel)
    ├── Lightbox (gallery)
    └── Custom scripts
        ├── main.js (core functionality)
        ├── blog.js (blog features)
        ├── comments-system.js (comments)
        └── contact.js (contact form)
```

### Backend Dependencies

```
Cloudflare Worker (worker.js)
├── Cloudflare Workers Runtime
├── Cloudflare KV (KV_COMMENTS namespace)
│   ├── Comment storage
│   └── Rate limiting data
└── MailChannels API
    └── Email delivery
```

### Build System Dependencies

```
build.js
├── Node.js Runtime
├── fs/promises (file operations)
├── clean-css (CSS minification)
├── terser (JS minification)
├── html-minifier-terser (HTML minification)
└── sharp (image processing)
```

---

## 🔄 Data Flow

### Comment Submission Flow

```
User Browser
    ↓ (1) Submit comment form
js/comments-system.js
    ↓ (2) Validate input
    ↓ (3) POST to /comments
Cloudflare Worker (worker.js)
    ↓ (4) Validate input
    ↓ (5) Check rate limit (KV)
    ↓ (6) Sanitize input
    ↓ (7) Store comment (KV)
    ↓ (8) Send email (MailChannels)
    ↓ (9) Return success
js/comments-system.js
    ↓ (10) Display success message
    ↓ (11) Refresh comments
User Browser
```

### Contact Form Flow

```
User Browser
    ↓ (1) Submit contact form
js/contact.js
    ↓ (2) Validate input
    ↓ (3) POST to /contact
Cloudflare Worker (worker.js)
    ↓ (4) Validate input
    ↓ (5) Check rate limit (KV)
    ↓ (6) Sanitize input
    ↓ (7) Send email (MailChannels)
    ↓ (8) Return success
js/contact.js
    ↓ (9) Display success message
User Browser
```

### Build Process Flow

```
Developer
    ↓ (1) Run npm run build
build.js
    ↓ (2) Minify CSS (parallel)
    ↓ (3) Minify JS (parallel)
    ↓ (4) Optimize HTML (parallel)
    ↓ (5) Convert to WebP (concurrent)
    ↓ (6) Generate sitemap
    ↓ (7) Update font CSS
    ↓ (8) Complete
Optimized Files
    ↓ (9) git commit
    ↓ (10) git push
GitHub
    ↓ (11) Trigger deployment
Cloudflare Pages
    ↓ (12) Deploy
Production Site
```

---

## 🌐 Deployment Architecture

### Hosting Stack

```
User Request
    ↓
Cloudflare CDN
    ├── Cache static assets
    ├── Apply security headers
    ├── DDoS protection
    └── SSL/TLS termination
    ↓
GitHub Pages (Origin)
    ├── Serve HTML/CSS/JS
    ├── Serve images
    └── Serve static files
    ↓
User Browser
```

### API Stack

```
User Request (API)
    ↓
Cloudflare CDN
    ├── Route to Worker
    └── Apply CORS headers
    ↓
Cloudflare Worker
    ├── Handle request
    ├── Validate input
    ├── Check rate limit (KV)
    ├── Process data
    └── Send email (MailChannels)
    ↓
Response to User
```

---

## 📊 File Size Summary

### HTML Files
- Total: 55 files
- Average size: ~30KB per file
- Total size: ~1.65MB

### CSS Files
- Unminified: ~300KB
- Minified: ~210KB
- Savings: ~30%

### JavaScript Files
- Unminified: ~50KB
- Minified: ~30KB
- Savings: ~40%

### Images
- Original (PNG/JPG): ~700MB
- WebP: ~85MB
- Savings: ~88%

### Third-Party Libraries
- Total: ~500KB (minified)
- Bootstrap: ~150KB
- jQuery: ~90KB
- Font Awesome: ~80KB
- Other libraries: ~180KB

### Total Project Size
- With node_modules: ~247MB
- Without node_modules: ~800MB
- Production assets: ~2.5MB

---

## 🔐 Security Architecture

### Frontend Security
- HTTPS enforced
- Content Security Policy
- XSS protection (input sanitization)
- CORS headers
- Security headers (_headers file)
- No exposed credentials

### Backend Security
- Rate limiting (3 requests/hour per IP)
- Input validation (client + server)
- XSS protection (HTML escaping)
- CORS whitelist
- IP-based tracking
- KV storage encryption
- No SQL injection risk (NoSQL KV)

### Infrastructure Security
- Cloudflare DDoS protection
- Worker isolation
- KV namespace isolation
- Automatic HTTPS
- Security.txt file

---

## 🎯 Performance Optimizations

### Frontend Optimizations
- Minified CSS/JS
- WebP images (88% size reduction)
- Lazy loading images
- Font-display: swap
- Async/defer script loading
- CDN delivery (Cloudflare)

### Backend Optimizations
- Cloudflare Workers (edge computing)
- KV storage (low latency)
- Rate limiting (prevents abuse)
- Efficient data structures
- Minimal API calls

### Build Optimizations
- Parallel processing
- Idempotent operations
- Incremental builds
- Efficient file operations
- Smart caching

---

## 📝 Maintenance Guidelines

### Regular Tasks

**Daily**:
- Monitor Cloudflare Worker logs
- Check error rates

**Weekly**:
- Review analytics
- Check for broken links
- Monitor performance metrics

**Monthly**:
- Run npm audit
- Update dependencies
- Review security logs
- Check for unused files

**Quarterly**:
- Full security audit
- Performance audit
- Code quality review
- Update documentation

**Annually**:
- Comprehensive project review
- Technology stack evaluation
- Architecture review
- Long-term planning

### Build Process

**Before Deployment**:
1. Run `npm run build`
2. Test locally
3. Verify no errors
4. Check file sizes
5. Review changes

**Deployment**:
1. Commit changes
2. Push to GitHub
3. Verify deployment
4. Test production site
5. Monitor for errors

### Monitoring

**Metrics to Track**:
- Page load times
- Error rates
- API response times
- Rate limiting hits
- Email delivery success
- User engagement

**Tools**:
- Cloudflare Analytics
- Google Analytics
- Cloudflare Worker logs
- GitHub Actions (if configured)

---

## 🔄 Version Control

### Git Structure

**Branches**:
- `main` - Production branch
- `develop` - Development branch (if used)
- Feature branches (as needed)

**Commit Guidelines**:
- Clear, descriptive messages
- Reference issue numbers
- Group related changes
- Test before committing

### Deployment Process

**GitHub Pages**:
- Automatic deployment from `main` branch
- Cloudflare CDN in front
- Custom domain: bahaerdogan.com

**Cloudflare Worker**:
- Manual deployment via wrangler
- Command: `npx wrangler deploy`
- Environment: production

---

## 📞 Support and Contact

### Project Maintainer
- **Name**: Baha Erdogan
- **Email**: baha@bahaerdogan.com
- **Website**: https://bahaerdogan.com
- **GitHub**: https://github.com/bahaerdogan

### Documentation
- **Project Structure**: This document
- **Security**: SECURITY_AUDIT_REPORT.md
- **Build Process**: BUILD_OPTIMIZATION_SUMMARY.md
- **Testing**: MANUAL_TESTING_GUIDE.md
- **Final Audit**: FINAL_AUDIT_REPORT.md

---

## 🎓 Technology Stack Summary

### Frontend
- **HTML5** - Markup
- **CSS3** - Styling
- **JavaScript (ES6+)** - Interactivity
- **Bootstrap 4.x** - Framework
- **jQuery 3.x** - DOM manipulation

### Backend
- **Cloudflare Workers** - Serverless functions
- **Cloudflare KV** - NoSQL storage
- **MailChannels** - Email delivery

### Build Tools
- **Node.js** - Runtime
- **npm** - Package manager
- **clean-css** - CSS minification
- **terser** - JS minification
- **html-minifier-terser** - HTML minification
- **sharp** - Image processing

### Infrastructure
- **GitHub Pages** - Hosting
- **Cloudflare CDN** - Content delivery
- **GitHub** - Version control
- **Git** - Source control

---

## 📊 Project Statistics

- **Total Files**: 247MB
- **HTML Pages**: 55
- **CSS Files**: 12 (6 themes × 2 versions)
- **JavaScript Files**: 16 (8 files × 2 versions)
- **Images**: 85
- **Third-Party Libraries**: 11
- **npm Dependencies**: 119
- **Lines of Code**: ~15,000 (estimated)
- **Languages**: 3 (English, Turkish, German)
- **Blog Posts**: 35+ across all languages

---

**Documentation Version**: 1.0  
**Last Updated**: October 13, 2025  
**Next Review**: January 13, 2026

---

**End of Project Structure Documentation**
