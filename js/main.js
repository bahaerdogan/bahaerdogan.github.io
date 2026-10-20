(function ($) {
	"use strict";
	var nav = $('#mainNav');
	if (!nav.length) nav = $('nav').first();
	var navHeight = nav.outerHeight() || 70;
	var easeName = ($.easing && $.easing.easeInOutExpo) ? "easeInOutExpo" : "swing";

	// Keep the address bar clean (/ and /#section) when served over HTTP(S),
	// while using relative index.html links in markup so file:// and subdirectory
	// previews work natively without broken root links.
	if ((window.location.protocol === 'http:' || window.location.protocol === 'https:') && /\/index\.html$/i.test(window.location.pathname)) {
		try {
			window.history.replaceState(null, '', window.location.pathname.replace(/\/index\.html$/i, '/') + window.location.search + window.location.hash);
		} catch (e) {}
	}
	if (window.location.protocol === 'file:') {
		$('a[href="/"], a[href^="/#"]').each(function () {
			var h = $(this).attr('href');
			if (h === '/') $(this).attr('href', 'index.html');
			else if (h && h.indexOf('/#') === 0) $(this).attr('href', 'index.html' + h.slice(1));
		});
	}
	
	// Navbar toggle handler with improved functionality
	$('.navbar-toggler').on('click', function() {
		if (!$('#mainNav').hasClass('navbar-reduce')) {
			$('#mainNav').addClass('navbar-reduce');
		}
	});

	// The preloader was removed: it was an opaque full-screen overlay that only
	// faded on window.load, so the page stayed blank until every stylesheet,
	// script and image had finished — and stayed blank forever if JS failed.

	// Back to top button with smooth animation
	$(window).scroll(function() {
		if ($(this).scrollTop() > 100) {
			$('.back-to-top').fadeIn('slow');
		} else {
			$('.back-to-top').fadeOut('slow');
		}
	});

	$('.back-to-top').click(function(e){
		e.preventDefault();
		$('html, body').animate({scrollTop: 0}, 1500, easeName);
		return false;
	});

	// Improved scroll to top functionality.
	// `.floating-action-btn` is included because its markup called an inline
	// onclick="scrollToTop()" that was never defined anywhere — the button threw
	// a ReferenceError on every click. Inline handlers are also blocked by a CSP
	// that carries script hashes, so the binding belongs here either way.
	$('.scrolltop-mf, .floating-action-btn').on("click", function (e) {
		e.preventDefault();
		$('html, body').animate({
			scrollTop: 0
		}, 1000);
	});

	// Counter initialization with viewport check
	const initCounter = () => {
		if ($('.counter').length && $.fn.counterUp) {
			$('.counter').counterUp({
				delay: 15,
				time: 2000
			});
		}
	};
	
	// Initialize counter when element is in viewport
	$(window).on('scroll', function() {
		initCounter();
	});

	// Enhanced smooth scrolling navigation (only for in-page #hash links;
	// cross-page links like index.html#about must navigate normally)
	$('a.js-scroll').on("click", function (e) {
		const rawHref = $(this).attr('href') || '';
		if (!rawHref.startsWith('#') || rawHref === '#') return;
		var target = $(this.hash);
		target = target.length ? target : $('[name=' + this.hash.slice(1) + ']');
		if (target.length) {
			e.preventDefault();
			navHeight = nav.outerHeight() || 70;
			$('html, body').animate({
				scrollTop: (target.offset().top - navHeight + 5)
			}, 1000, easeName);
			return false;
		}
	});

	// Responsive menu handling
	$('.js-scroll').on("click", function () {
		if ($.fn && $.fn.collapse) {
			$('.navbar-collapse').collapse('hide');
		}
	});

	// Only initialize scrollspy on pages whose navbar has in-page section anchors
	// (index.html). On blog pages, scrollspy has 0 targets and its _clear()
	// strips the .active class from the Blog nav item and Language dropdown.
	const hasInPageNav = $('#mainNav a.nav-link[href^="#"]:not([href="#"])').length > 0;
	if (hasInPageNav && $.fn && $.fn.scrollspy) {
		try {
			$('body').scrollspy({
				target: '#mainNav',
				offset: navHeight
			});
		} catch (e) {
			console.warn('Scrollspy initialization failed:', e);
		}
	}

	// Improved navbar animation
	$(window).trigger('scroll');
	$(window).on('scroll', function () {
		var pixels = 50;
		var top = 1200;
		var scroll = $(window).scrollTop();

		if (scroll > pixels) {
			$('#mainNav').addClass('navbar-reduce').removeClass('navbar-trans');
		} else {
			$('#mainNav').addClass('navbar-trans').removeClass('navbar-reduce');
		}

		if (scroll > top) {
			$('.scrolltop-mf').fadeIn(1000, easeName);
		} else {
			$('.scrolltop-mf').fadeOut(1000, easeName);
		}
	});

	// Enhanced text slider initialization with mobile optimization
	const initTextSlider = () => {
		if ($('.text-slider').length === 1) {
			try {
				// Roles come from the markup so the typed copy matches what
				// crawlers read in .text-slider-items.
				var strings = $('.text-slider-items').text().split(',')
					.map(function(s) { return s.trim(); })
					.filter(Boolean);
				if (!strings.length) {
					strings = ['Computer Engineer', 'AI R&D Specialist', 'Problem Solver'];
				}

				// No endless retyping for reduced-motion users: show the roles once.
				if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
					$('.text-slider').text(strings.join(' · ')).css('white-space', 'normal').show();
					return;
				}

				// Destroy existing instance if it exists
				if (window.typedInstance) {
					window.typedInstance.destroy();
				}
				
				// Mobile-specific settings
                const isMobile = window.innerWidth <= 768;
                const typeSpeed = isMobile ? 60 : 60;
                const backSpeed = isMobile ? 45 : 40;
                const backDelay = isMobile ? 2200 : 1500;
				
				window.typedInstance = new Typed('.text-slider', {
					strings: strings,
					typeSpeed: typeSpeed,
					loop: true,
					backDelay: backDelay,
					backSpeed: backSpeed,
					smartBackspace: true,
					showCursor: true,
					cursorChar: '|',
					fadeOut: false,
					autoInsertCss: true,
                    onStringTyped: function() {
                        $('.text-slider').css({
                            'white-space': 'nowrap',
                            'display': 'inline-block',
                            'vertical-align': 'baseline',
                            'line-height': '1'
                        });
                    },
					onBegin: function(self) {
						// Ensure proper initialization
						$('.text-slider-items').hide();
						$('.text-slider').show();
					},
					onComplete: function(self) {
						// Ensure cursor is visible
						$('.typed-cursor').show();
					}
				});
			} catch (e) {
				console.warn('Typed.js initialization failed:', e);
				// Fallback: show static text
				$('.text-slider-items').show();
				$('.text-slider').hide();
			}
		}
	};
	
	// Initialize text slider after page load
	$(document).ready(function() {
		// Small delay to ensure DOM is ready
		setTimeout(initTextSlider, 100);
	});

	// Improved testimonial carousel
	if ($('#testimonial-mf').length) {
		$('#testimonial-mf').owlCarousel({
			margin: 20,
			autoplay: true,
			autoplayTimeout: 4000,
			autoplayHoverPause: true,
			responsive: {
				0: {
					items: 1,
				},
				768: {
					items: 2,
				},
				992: {
					items: 3,
				}
			},
			nav: true,
			dots: true,
			loop: true,
			navText: [
				'<i class="ion-chevron-left"></i>',
				'<i class="ion-chevron-right"></i>'
			]
		});
	}

	// Handle window resize events
	let resizeTimer;
	$(window).on('resize', function() {
		clearTimeout(resizeTimer);
		resizeTimer = setTimeout(function() {
			navHeight = nav.outerHeight() || 70;
			if (hasInPageNav && $.fn && $.fn.scrollspy && $('body').data('bs.scrollspy')) {
				$('body').scrollspy('refresh');
			}
			
			// Reinitialize text slider on resize for better mobile sync
			if (window.innerWidth <= 768) {
				setTimeout(initTextSlider, 100);
			}
		}, 250);
	});

	// Initialize the blog carousel (only if plugin and element exist)
	if ($.fn && $.fn.owlCarousel && $(".blog-carousel").length) {
		$(".blog-carousel").owlCarousel({
			loop: true,
			margin: 20,
			nav: true,
			dots: true,
			autoplay: true,
			autoplayTimeout: 5000,
			autoplayHoverPause: true,
			responsive: {
				0: {
					items: 1
				},
				768: {
					items: 2
				},
				992: {
					items: 3
				}
			}
		});
	}

	// Language toggle functionality
	const languageToggle = $('#language-toggle');
	
    if (languageToggle.length) {
        languageToggle.on('click', function(e) {
            const href = $(this).attr('href');
            // If href is provided and not a placeholder, follow it
            if (href && href !== '#' && href.trim() !== '') {
                // allow default navigation
                return;
            }
            // Otherwise compute fallback based on current file
            e.preventDefault();
            const currentPath = window.location.pathname;
            const filename = currentPath.split('/').pop();
            if (filename.includes('TR.html')) {
                const englishVersion = filename.replace('TR.html', '.html');
                window.location.href = englishVersion;
            } else {
                const turkishVersion = filename.replace('.html', 'TR.html');
                window.location.href = turkishVersion;
            }
        });
    }

	// Cookie Consent System
	const CookieConsent = {
		STORAGE_KEY: 'cookie-consent',
		
		init() {
			this.setupGoogleConsentMode();
			this.checkExistingConsent();
			this.createConsentBanner();
		},
		
		setupGoogleConsentMode() {
			// `consent default` is issued by the inline snippet in <head>, before
			// gtag's `config` call. It cannot be done here: this file is deferred,
			// so it runs after the page_view has already been sent, and a default
			// arriving that late is ignored. Only the shim is guaranteed here.
			window.dataLayer = window.dataLayer || [];
			if (typeof window.gtag !== 'function') {
				window.gtag = function () { window.dataLayer.push(arguments); };
			}
		},
		
		checkExistingConsent() {
			const consent = localStorage.getItem(this.STORAGE_KEY);
			if (consent) {
				const consentData = JSON.parse(consent);
				this.updateConsent(consentData.analytics);
				return;
			}
			// Show banner if no consent found
			setTimeout(() => this.showBanner(), 1000);
		},
		
		createConsentBanner() {
			const languages = {
				en: {
					message: 'This website uses cookies to improve your experience and analyze traffic.',
					accept: 'Accept All',
					reject: 'Reject All', 
					settings: 'Settings',
					necessary: 'Necessary',
					analytics: 'Analytics',
					save: 'Save Preferences',
					close: 'Close',
					title: 'Cookie Settings',
					necessaryDesc: 'Required for basic site functionality',
					analyticsDesc: 'Help us understand how visitors interact with our website'
				},
				tr: {
					message: 'Bu web sitesi deneyiminizi iyileştirmek ve trafiği analiz etmek için çerezler kullanır.',
					accept: 'Tümünü Kabul Et',
					reject: 'Tümünü Reddet',
					settings: 'Ayarlar', 
					necessary: 'Gerekli',
					analytics: 'Analitik',
					save: 'Tercihleri Kaydet',
					close: 'Kapat',
					title: 'Çerez Ayarları',
					necessaryDesc: 'Sitenin temel işlevleri için gereklidir',
					analyticsDesc: 'Ziyaretçilerin siteyi nasıl kullandığını anlamamıza yardımcı olur'
				},
				de: {
					message: 'Diese Website verwendet Cookies, um Ihre Erfahrung zu verbessern und den Verkehr zu analysieren.',
					accept: 'Alle akzeptieren',
					reject: 'Alle ablehnen',
					settings: 'Einstellungen',
					necessary: 'Notwendig', 
					analytics: 'Analytik',
					save: 'Einstellungen speichern',
					close: 'Schließen',
					title: 'Cookie-Einstellungen',
					necessaryDesc: 'Für die grundlegenden Funktionen der Website erforderlich',
					analyticsDesc: 'Hilft uns zu verstehen, wie Besucher die Website nutzen'
				}
			};
			
			const currentLang = this.detectLanguage();
			const lang = languages[currentLang] || languages.en;
			
			const bannerHTML = `
				<div id="cookie-banner" class="cookie-banner" style="display: none;">
					<div class="cookie-content">
						<p>${lang.message}</p>
						<div class="cookie-buttons">
							<button class="cookie-btn accept" data-cookie-action="acceptAll">${lang.accept}</button>
							<button class="cookie-btn reject" data-cookie-action="rejectAll">${lang.reject}</button>
							<button class="cookie-btn settings" data-cookie-action="showSettings">${lang.settings}</button>
						</div>
					</div>
				</div>
				
				<div id="cookie-settings" class="cookie-modal" style="display: none;" role="dialog" aria-modal="true" aria-labelledby="cookie-settings-title">
					<div class="cookie-modal-content">
						<div class="cookie-modal-header">
							<h3 id="cookie-settings-title">${lang.title}</h3>
							<button class="cookie-close" data-cookie-action="hideSettings" aria-label="${lang.close}">&times;</button>
						</div>
						<div class="cookie-modal-body">
							<div class="cookie-category">
								<label><input type="checkbox" checked disabled> ${lang.necessary}</label>
								<small>${lang.necessaryDesc}</small>
							</div>
							<div class="cookie-category">
								<label><input type="checkbox" id="analytics-consent"> ${lang.analytics}</label>
								<small>${lang.analyticsDesc}</small>
							</div>
						</div>
						<div class="cookie-modal-footer">
							<button class="cookie-btn accept" data-cookie-action="savePreferences">${lang.save}</button>
						</div>
					</div>
				</div>
			`;
			
			document.body.insertAdjacentHTML('beforeend', bannerHTML);
			// Bound here, not with onclick="" attributes: the page's Content-Security-Policy
			// blocks inline event handlers, which left every button dead and analytics
			// consent permanently denied.
			['cookie-banner', 'cookie-settings'].forEach((id) => {
				document.getElementById(id).addEventListener('click', (event) => {
					const button = event.target.closest('[data-cookie-action]');
					if (button) this[button.dataset.cookieAction]();
				});
			});
		},
		
		detectLanguage() {
			const path = window.location.pathname;
			if (path.includes('TR.html')) return 'tr';
			if (path.includes('DE.html')) return 'de';
			return 'en';
		},
		
		showBanner() {
			const banner = document.getElementById('cookie-banner');
			if (banner) banner.style.display = 'block';
		},
		
		hideBanner() {
			const banner = document.getElementById('cookie-banner');
			if (banner) banner.style.display = 'none';
		},
		
		showSettings() {
			const modal = document.getElementById('cookie-settings');
			if (modal) modal.style.display = 'flex';
		},
		
		hideSettings() {
			const modal = document.getElementById('cookie-settings');
			if (modal) modal.style.display = 'none';
		},
		
		acceptAll() {
			this.saveConsent(true);
			this.updateConsent(true);
			this.hideBanner();
		},
		
		rejectAll() {
			this.saveConsent(false);
			this.updateConsent(false);
			this.hideBanner();
		},
		
		savePreferences() {
			const analyticsConsent = document.getElementById('analytics-consent').checked;
			this.saveConsent(analyticsConsent);
			this.updateConsent(analyticsConsent);
			this.hideSettings();
			this.hideBanner();
		},
		
		saveConsent(analytics) {
			const consent = {
				analytics: analytics,
				timestamp: new Date().toISOString()
			};
			localStorage.setItem(this.STORAGE_KEY, JSON.stringify(consent));
		},
		
		updateConsent(analytics) {
			if (typeof gtag !== 'function') return;
			// `consent update` is all that is needed: gtag replays the hit it was
			// already holding. Re-running `config` here used to send a *second*
			// page_view — once when consent was granted, and again on every
			// subsequent page load for a returning visitor who had accepted.
			gtag('consent', 'update', {
				analytics_storage: analytics ? 'granted' : 'denied',
				ad_storage: analytics ? 'granted' : 'denied',
				ad_user_data: analytics ? 'granted' : 'denied',
				ad_personalization: analytics ? 'granted' : 'denied'
			});
		},
		
	};
	
	// Make CookieConsent globally available
	window.CookieConsent = CookieConsent;

	// EmailJS removed - now using Cloudflare Workers for comments and contact form

	// Blog search lives in the generated js/blog-search*.min.js, which carries the
	// real post index and binds the form itself. The version that used to live here
	// shadowed it with a hardcoded two-entry list, so most searches found nothing.

	// Comment system functionality
	const initCommentSystem = () => {
		const commentForm = document.getElementById('comment-form');
		const successMessage = document.getElementById('comment-success');
		const errorMessage = document.getElementById('comment-error');
		const commentsContainer = document.getElementById('comments-container');
		
        if (commentForm && typeof handleCommentSubmission === 'function') {
            commentForm.addEventListener('submit', handleCommentSubmission);
        }
        if (typeof loadComments === 'function') {
            loadComments();
        }
	};

	// Comment submission is now handled by comments-system.js using Cloudflare Workers
	const handleCommentSubmission = async (event) => {
		event.preventDefault();
		// Comment submission handled by comments-system.js
	};

	// Handle scroll to section when page loads with hash
	$(window).on('load', function() {
		if (window.location.hash) {
			const hash = window.location.hash;
			const target = $(hash);
			if (target.length) {
				navHeight = nav.outerHeight() || 70;
				$('html, body').animate({
					scrollTop: (target.offset().top - navHeight + 5)
				}, 1000, easeName);
			}
		}
	});

	// Initialize all components
	document.addEventListener('DOMContentLoaded', () => {
		CookieConsent.init();
		initCommentSystem();
		// ... other existing initializations ...
	});

})(jQuery);