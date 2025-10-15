# 🔧 Maintenance Guidelines

**Project:** bahaerdogan.com  
**Version:** 1.0  
**Last Updated:** October 13, 2025

---

## 📋 Overview

This document provides comprehensive maintenance guidelines for the bahaerdogan.com website, including regular audit schedules, build process documentation, monitoring procedures, and troubleshooting guides.

---

## 📅 Regular Audit Schedule

### Daily Maintenance

**Time Required**: 5-10 minutes

#### Tasks
- [ ] Check Cloudflare Worker logs for errors
- [ ] Monitor error rates in analytics
- [ ] Review rate limiting hits
- [ ] Check email delivery status

#### How to Check Cloudflare Worker Logs

**Option 1: Cloudflare Dashboard**
1. Log in to Cloudflare Dashboard
2. Navigate to Workers & Pages
3. Select "comment-handler" worker
4. Click "Logs" tab
5. Click "Begin log stream"
6. Monitor for errors (console.error entries)

**Option 2: Wrangler CLI**
```bash
cd cloudflare-worker
npx wrangler tail
```

#### What to Look For
- ❌ **Error patterns**: Repeated validation errors, rate limiting triggers
- ⚠️ **MailChannels failures**: Email delivery issues
- ⚠️ **KV storage errors**: Read/write failures
- ✅ **Success rates**: Comment and contact form submissions

---

### Weekly Maintenance

**Time Required**: 15-30 minutes

#### Tasks
- [ ] Review Google Analytics data
- [ ] Check for broken links
- [ ] Monitor Core Web Vitals
- [ ] Review security logs
- [ ] Check disk space usage
- [ ] Verify backup status

#### How to Check for Broken Links

**Option 1: Online Tools**
- Use [W3C Link Checker](https://validator.w3.org/checklink)
- Enter: https://bahaerdogan.com
- Review results

**Option 2: Command Line**
```bash
# Install linkchecker (if not installed)
pip install linkchecker

# Check website
linkchecker https://bahaerdogan.com
```

#### How to Monitor Core Web Vitals

**Option 1: Google Search Console**
1. Log in to Google Search Console
2. Navigate to "Core Web Vitals" report
3. Review LCP, FID, CLS metrics
4. Address any issues

**Option 2: PageSpeed Insights**
1. Visit [PageSpeed Insights](https://pagespeed.web.dev/)
2. Enter: https://bahaerdogan.com
3. Review mobile and desktop scores
4. Implement recommendations

---

### Monthly Maintenance

**Time Required**: 1-2 hours

#### Tasks
- [ ] Run npm audit and fix vulnerabilities
- [ ] Update npm dependencies
- [ ] Review and remove unused files
- [ ] Check for outdated content
- [ ] Review security headers
- [ ] Test all interactive features
- [ ] Backup project files
- [ ] Review rate limiting effectiveness

#### How to Update Dependencies

**Check for Outdated Packages**
```bash
npm outdated
```

**Update Packages**
```bash
# Update all packages to latest compatible versions
npm update

# Or update specific package
npm update <package-name>

# For major version updates
npm install <package-name>@latest
```

**Security Audit**
```bash
# Check for vulnerabilities
npm audit

# Fix vulnerabilities automatically
npm audit fix

# Fix with breaking changes (use caution)
npm audit fix --force
```

#### How to Test Interactive Features

**Comments System**
1. Navigate to a blog post
2. Submit a test comment
3. Verify comment appears
4. Test rate limiting (submit 4 comments)
5. Verify error message on 4th attempt

**Contact Form**
1. Navigate to contact page
2. Submit test message
3. Verify success message
4. Check email delivery
5. Test rate limiting

**Language Switching**
1. Click language toggle
2. Verify correct language loads
3. Test on multiple pages

**Blog Search**
1. Navigate to BlogPosts.html
2. Enter search term
3. Verify results
4. Test category filters

---

### Quarterly Maintenance

**Time Required**: 4-6 hours

#### Tasks
- [ ] Full security audit
- [ ] Performance audit
- [ ] Code quality review
- [ ] Update documentation
- [ ] Review and optimize images
- [ ] Test on multiple browsers
- [ ] Review SEO performance
- [ ] Update sitemap if needed
- [ ] Review and update CSP
- [ ] Test disaster recovery

#### How to Run Security Audit

**Automated Scan**
```bash
# Run the audit script
node audit-script.js
```

**Manual Review**
- [ ] Check for exposed credentials
- [ ] Review security headers
- [ ] Test XSS protection
- [ ] Verify CORS configuration
- [ ] Test rate limiting
- [ ] Review error handling
- [ ] Check for information disclosure

**Security Checklist**
- [ ] No API keys in code
- [ ] No console.log in production
- [ ] Security headers present
- [ ] CSP properly configured
- [ ] HTTPS enforced
- [ ] Rate limiting working
- [ ] Input validation working
- [ ] XSS protection working

#### How to Run Performance Audit

**Lighthouse Audit**
```bash
# Install Lighthouse CLI (if not installed)
npm install -g lighthouse

# Run audit
lighthouse https://bahaerdogan.com --output html --output-path ./lighthouse-report.html

# Open report
open lighthouse-report.html
```

**Performance Checklist**
- [ ] Page load time < 3 seconds
- [ ] First Contentful Paint < 1.8s
- [ ] Largest Contentful Paint < 2.5s
- [ ] Cumulative Layout Shift < 0.1
- [ ] Time to Interactive < 3.8s
- [ ] Total Blocking Time < 200ms

---

### Annual Maintenance

**Time Required**: 1-2 days

#### Tasks
- [ ] Comprehensive project review
- [ ] Technology stack evaluation
- [ ] Architecture review
- [ ] Long-term planning
- [ ] Major dependency updates
- [ ] Redesign consideration
- [ ] Feature roadmap planning
- [ ] Backup and disaster recovery test

---

## 🔨 Build Process Documentation

### Prerequisites

**Required Software**:
- Node.js (v14 or higher)
- npm (v6 or higher)
- Git

**Installation**:
```bash
# Clone repository
git clone https://github.com/bahaerdogan/bahaerdogan.github.io.git
cd bahaerdogan.github.io

# Install dependencies
npm install
```

---

### Build Commands

#### Full Build
```bash
npm run build
```

**What it does**:
1. Minifies all CSS files
2. Minifies all JavaScript files
3. Optimizes all HTML files
4. Converts images to WebP
5. Generates sitemap.xml
6. Updates font CSS

**Duration**: 30-60 seconds

---

### Build Process Steps

#### 1. CSS Minification

**Input**: `css/*.css` (unminified)  
**Output**: `css/*.min.css` (minified)  
**Tool**: clean-css

**Process**:
- Reads all CSS files in css/ directory
- Minifies each file in parallel
- Removes comments and whitespace
- Optimizes CSS rules
- Saves as .min.css

**Verification**:
```bash
# Check file sizes
ls -lh css/*.css css/*.min.css

# Verify minified files exist
ls css/*.min.css
```

---

#### 2. JavaScript Minification

**Input**: `js/*.js` (unminified)  
**Output**: `js/*.min.js` (minified)  
**Tool**: terser

**Process**:
- Reads all JS files in js/ directory
- Minifies each file in parallel
- Removes comments and whitespace
- Optimizes code
- Saves as .min.js

**Verification**:
```bash
# Check file sizes
ls -lh js/*.js js/*.min.js

# Verify minified files exist
ls js/*.min.js
```

---

#### 3. HTML Optimization

**Input**: `*.html` (all HTML files)  
**Output**: Same files (optimized in place)  
**Tool**: html-minifier-terser

**Process**:
- Reads all HTML files
- Injects i18n meta tags (canonical, hreflang)
- Updates language toggle links
- Minifies HTML
- Processes files in parallel

**Verification**:
```bash
# Check for canonical tags
grep -r "rel=\"canonical\"" *.html | head -5

# Check for hreflang tags
grep -r "hreflang" *.html | head -5

# Verify no duplicates
grep -c "rel=\"canonical\"" index.html
# Should return 1, not 7+
```

---

#### 4. WebP Conversion

**Input**: `img/*.png`, `img/*.jpg`, `img/*.jpeg`  
**Output**: `img/*.webp`  
**Tool**: sharp

**Process**:
- Scans img/ directory for images
- Checks if WebP exists and is up-to-date
- Skips conversion if WebP is newer
- Converts images to WebP (quality: 80%)
- Processes images concurrently

**Verification**:
```bash
# Run verification script
node verify-webp.js

# Check WebP files
ls -lh img/*.webp | wc -l
# Should show 42 files

# Compare sizes
du -sh img/*.png img/*.jpg img/*.jpeg
du -sh img/*.webp
```

---

#### 5. Sitemap Generation

**Input**: All HTML files  
**Output**: `sitemap.xml`

**Process**:
- Scans all HTML files
- Groups by content (removes language suffixes)
- Adds hreflang alternates
- Uses file modification times for lastmod
- Generates XML sitemap

**Verification**:
```bash
# Run verification script
node verify-sitemap.js

# Check sitemap
cat sitemap.xml | grep "<url>" | wc -l
# Should show 22 URLs

# Check hreflang
cat sitemap.xml | grep "hreflang" | wc -l
# Should show 73 alternates
```

---

#### 6. Font CSS Updates

**Input**: Font library CSS files  
**Output**: Updated CSS with font-display: swap

**Process**:
- Updates Font Awesome CSS
- Updates Ionicons CSS
- Adds font-display: swap property
- Improves font loading performance

**Verification**:
```bash
# Check for font-display
grep "font-display" lib/font-awesome/css/font-awesome.min.css
grep "font-display" lib/ionicons/css/ionicons.min.css
```

---

### Build Troubleshooting

#### Issue: Build fails with "Cannot find module"

**Solution**:
```bash
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

---

#### Issue: WebP conversion fails

**Solution**:
```bash
# Check sharp installation
npm list sharp

# Reinstall sharp
npm uninstall sharp
npm install sharp
```

---

#### Issue: Duplicate tags still appearing

**Solution**:
```bash
# Clean existing duplicates first
# Manually remove duplicate tags from HTML files

# Then run build
npm run build

# Verify no duplicates
grep -c "rel=\"canonical\"" index.html
```

---

#### Issue: Build is slow

**Solution**:
- Build uses parallel processing, but large projects take time
- WebP conversion is idempotent (skips up-to-date files)
- First build is slower, subsequent builds are faster

---

### Build Best Practices

1. **Always test locally before deploying**
   ```bash
   npm run build
   # Test in browser
   # Verify no errors
   ```

2. **Commit minified files**
   - Minified files should be committed to Git
   - GitHub Pages serves these files directly

3. **Run build before every deployment**
   ```bash
   npm run build
   git add .
   git commit -m "Build: Update minified files"
   git push
   ```

4. **Verify idempotency**
   ```bash
   # Run build twice
   npm run build
   npm run build
   
   # Check for changes
   git status
   # Should show no changes
   ```

5. **Monitor build output**
   - Check for errors in console
   - Verify all files processed
   - Check for warnings

---

## 📊 Monitoring Procedures

### Cloudflare Worker Monitoring

#### Real-Time Monitoring

**Cloudflare Dashboard**:
1. Navigate to Workers & Pages
2. Select "comment-handler"
3. Click "Logs" tab
4. Monitor real-time logs

**What to Monitor**:
- Error rates
- Response times
- Rate limiting hits
- Email delivery success

---

#### Metrics to Track

**Request Metrics**:
- Total requests per day
- Success rate (200 responses)
- Error rate (400, 500 responses)
- Rate limit hits (429 responses)

**Performance Metrics**:
- Average response time
- P95 response time
- P99 response time

**Email Metrics**:
- Email delivery success rate
- MailChannels errors
- Email notification delays

---

### Website Monitoring

#### Uptime Monitoring

**Tools**:
- [UptimeRobot](https://uptimerobot.com/) (free)
- [Pingdom](https://www.pingdom.com/)
- Cloudflare Analytics

**Setup**:
1. Create account
2. Add monitor for https://bahaerdogan.com
3. Set check interval (5 minutes)
4. Configure alerts (email, SMS)

---

#### Performance Monitoring

**Google Analytics**:
- Page load times
- Bounce rate
- User engagement
- Traffic sources

**Cloudflare Analytics**:
- Bandwidth usage
- Request count
- Cache hit rate
- Threat detection

**Core Web Vitals**:
- Largest Contentful Paint (LCP)
- First Input Delay (FID)
- Cumulative Layout Shift (CLS)

---

#### Error Monitoring

**Browser Console Errors**:
- Check for JavaScript errors
- Monitor network failures
- Watch for CORS issues

**Server Errors**:
- Monitor Cloudflare Worker logs
- Track 500 errors
- Review error patterns

---

### Alert Configuration

#### Critical Alerts (Immediate Action)

**Triggers**:
- Website down (5+ minutes)
- Error rate > 10%
- Email delivery failure rate > 50%
- Security breach detected

**Actions**:
- Send email alert
- Send SMS alert
- Check Cloudflare status
- Review logs immediately

---

#### Warning Alerts (Review Within 24 Hours)

**Triggers**:
- Error rate > 5%
- Response time > 3 seconds
- Rate limiting hits > 100/day
- Email delivery failure rate > 20%

**Actions**:
- Send email alert
- Review logs
- Investigate root cause
- Plan fixes

---

#### Info Alerts (Review Weekly)

**Triggers**:
- Traffic spike (2x normal)
- New error patterns
- Unusual user behavior
- Performance degradation

**Actions**:
- Log for review
- Analyze trends
- Consider optimizations

---

## 🔍 Troubleshooting Guide

### Common Issues

#### Issue: Comments not submitting

**Symptoms**:
- Form submission fails
- Error message displayed
- No comment appears

**Diagnosis**:
1. Check browser console for errors
2. Check Cloudflare Worker logs
3. Verify rate limiting not triggered
4. Test API endpoint directly

**Solutions**:
```bash
# Test API endpoint
curl -X POST https://comment-handler.baha-erdogann.workers.dev/comments \
  -H "Content-Type: application/json" \
  -H "Origin: https://bahaerdogan.com" \
  -d '{"name":"Test","email":"test@example.com","message":"Test message","slug":"test-post"}'

# Check response
# Should return 200 or specific error
```

**Common Causes**:
- Rate limiting (wait 1 hour)
- Validation errors (check input)
- KV storage issues (check Cloudflare status)
- CORS errors (check origin)

---

#### Issue: Contact form not sending emails

**Symptoms**:
- Form submits successfully
- No email received
- MailChannels errors in logs

**Diagnosis**:
1. Check Cloudflare Worker logs for MailChannels errors
2. Verify DNS records
3. Test email delivery

**Solutions**:
```bash
# Check DNS records
dig TXT _mailchannels.bahaerdogan.com
dig TXT bahaerdogan.com | grep spf

# Test contact form
curl -X POST https://comment-handler.baha-erdogann.workers.dev/contact \
  -H "Content-Type: application/json" \
  -H "Origin: https://bahaerdogan.com" \
  -d '{"name":"Test","email":"test@example.com","subject":"Test","message":"Test message"}'
```

**Common Causes**:
- DNS records not propagated (wait 24-48 hours)
- MailChannels API issues (check status)
- Invalid email format
- Rate limiting

---

#### Issue: Build process fails

**Symptoms**:
- npm run build fails
- Error messages in console
- Files not generated

**Diagnosis**:
1. Check error message
2. Verify Node.js version
3. Check dependencies

**Solutions**:
```bash
# Check Node.js version
node --version
# Should be v14 or higher

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install

# Run build with verbose output
npm run build --verbose
```

**Common Causes**:
- Missing dependencies
- Outdated Node.js
- File permission issues
- Disk space full

---

#### Issue: Images not loading

**Symptoms**:
- Broken image icons
- 404 errors in console
- Images missing on page

**Diagnosis**:
1. Check browser console for 404 errors
2. Verify image paths
3. Check file exists

**Solutions**:
```bash
# Check if image exists
ls -la img/image-name.webp

# Check image references in HTML
grep -r "image-name" *.html

# Verify WebP conversion
node verify-webp.js
```

**Common Causes**:
- Incorrect file path
- Image not converted to WebP
- File not committed to Git
- Caching issues (clear cache)

---

#### Issue: Language switching not working

**Symptoms**:
- Language toggle doesn't work
- Wrong language loads
- 404 errors

**Diagnosis**:
1. Check browser console for errors
2. Verify language file exists
3. Check hreflang tags

**Solutions**:
```bash
# Check if language file exists
ls -la *TR.html *DE.html

# Verify hreflang tags
grep "hreflang" index.html

# Test language toggle
# Click language button in browser
# Check URL changes
```

**Common Causes**:
- Language file doesn't exist
- Incorrect file naming
- JavaScript error
- Hreflang tags missing

---

### Emergency Procedures

#### Website Down

**Immediate Actions**:
1. Check Cloudflare status: https://www.cloudflarestatus.com/
2. Check GitHub Pages status: https://www.githubstatus.com/
3. Verify DNS: `dig bahaerdogan.com`
4. Check SSL certificate: `openssl s_client -connect bahaerdogan.com:443`

**Recovery Steps**:
1. If Cloudflare issue: Wait for resolution
2. If GitHub issue: Wait for resolution
3. If DNS issue: Check DNS provider
4. If SSL issue: Renew certificate

---

#### Data Loss

**Immediate Actions**:
1. Stop all operations
2. Assess extent of loss
3. Check Git history
4. Check backups

**Recovery Steps**:
```bash
# Restore from Git
git log --all --oneline
git checkout <commit-hash> -- <file>

# Or restore entire project
git reset --hard <commit-hash>
```

---

#### Security Breach

**Immediate Actions**:
1. Take website offline (if necessary)
2. Change all credentials
3. Review access logs
4. Identify breach source

**Recovery Steps**:
1. Patch vulnerability
2. Restore from clean backup
3. Update security measures
4. Monitor for further issues
5. Notify users if necessary

---

## 📚 Documentation Maintenance

### Documentation Files

**Core Documentation**:
- README.md - Project overview
- MAINTENANCE_GUIDELINES.md - This document
- PROJECT_STRUCTURE_DOCUMENTATION.md - Project structure
- FINAL_AUDIT_REPORT.md - Audit results

**Security Documentation**:
- SECURITY_AUDIT_REPORT.md - Security audit
- CSP_UPDATE_SUMMARY.md - CSP updates
- INLINE_SCRIPTS_ANALYSIS.md - Inline scripts

**Build Documentation**:
- BUILD_OPTIMIZATION_SUMMARY.md - Build improvements
- sitemap-validation-report.md - Sitemap verification
- webp-conversion-report.md - WebP conversion

**Testing Documentation**:
- MANUAL_TESTING_GUIDE.md - Testing procedures
- FEATURE_TESTING_SUMMARY.md - Feature tests
- TESTING_QUICK_REFERENCE.md - Quick reference

---

### Documentation Update Schedule

**After Every Major Change**:
- Update relevant documentation
- Update version numbers
- Update last modified dates

**Monthly**:
- Review all documentation
- Update outdated information
- Add new procedures

**Quarterly**:
- Comprehensive documentation review
- Reorganize if needed
- Archive old versions

---

## 🎯 Performance Targets

### Page Load Performance

**Targets**:
- First Contentful Paint: < 1.8s
- Largest Contentful Paint: < 2.5s
- Time to Interactive: < 3.8s
- Total Blocking Time: < 200ms
- Cumulative Layout Shift: < 0.1

**How to Measure**:
```bash
lighthouse https://bahaerdogan.com --output html
```

---

### API Performance

**Targets**:
- Average response time: < 200ms
- P95 response time: < 500ms
- P99 response time: < 1000ms
- Error rate: < 1%
- Uptime: > 99.9%

**How to Measure**:
- Cloudflare Analytics
- Worker logs
- Custom monitoring

---

### Build Performance

**Targets**:
- Full build time: < 60s
- Incremental build: < 10s
- WebP conversion: < 30s
- Sitemap generation: < 5s

**How to Measure**:
```bash
time npm run build
```

---

## 📞 Support Contacts

### Technical Support

**Project Maintainer**:
- Name: Baha Erdogan
- Email: baha@bahaerdogan.com
- GitHub: @bahaerdogan

**Service Providers**:
- Cloudflare Support: https://support.cloudflare.com/
- GitHub Support: https://support.github.com/
- MailChannels Support: https://mailchannels.com/support/

---

### Emergency Contacts

**Critical Issues**:
- Email: baha@bahaerdogan.com
- Response Time: Within 24 hours

**Non-Critical Issues**:
- GitHub Issues: https://github.com/bahaerdogan/bahaerdogan.github.io/issues
- Response Time: Within 1 week

---

## 🔄 Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2025-10-13 | Initial maintenance guidelines |

---

## 📝 Appendix

### Useful Commands

**Git Commands**:
```bash
# Check status
git status

# Commit changes
git add .
git commit -m "Description"
git push

# View history
git log --oneline

# Undo changes
git checkout -- <file>
```

**npm Commands**:
```bash
# Install dependencies
npm install

# Update packages
npm update

# Check for vulnerabilities
npm audit

# Run build
npm run build
```

**Cloudflare Commands**:
```bash
# Deploy worker
cd cloudflare-worker
npx wrangler deploy

# View logs
npx wrangler tail

# Check status
npx wrangler whoami
```

---

### Useful Links

**Documentation**:
- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [GitHub Pages Docs](https://docs.github.com/en/pages)
- [MailChannels Docs](https://mailchannels.com/docs/)

**Tools**:
- [PageSpeed Insights](https://pagespeed.web.dev/)
- [W3C Validator](https://validator.w3.org/)
- [Lighthouse](https://developers.google.com/web/tools/lighthouse)

**Monitoring**:
- [Cloudflare Dashboard](https://dash.cloudflare.com/)
- [Google Analytics](https://analytics.google.com/)
- [Google Search Console](https://search.google.com/search-console)

---

**Document Version**: 1.0  
**Last Updated**: October 13, 2025  
**Next Review**: January 13, 2026

---

**End of Maintenance Guidelines**
