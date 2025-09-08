(function ($) {
	"use strict";
	var nav = $('nav');
	var navHeight = nav.outerHeight();
	
	// Navbar toggle handler with improved functionality
	$('.navbar-toggler').on('click', function() {
		if (!$('#mainNav').hasClass('navbar-reduce')) {
			$('#mainNav').addClass('navbar-reduce');
		}
	});

	// Preloader with improved fade animation
	$(window).on('load', function () {
		if ($('#preloader').length) {
			$('#preloader').delay(100).fadeOut('slow', function () {
				$(this).remove();
			});
		}
	});

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
		$('html, body').animate({scrollTop: 0}, 1500, 'easeInOutExpo');
		return false;
	});

	// Improved scroll to top functionality
	$('.scrolltop-mf').on("click", function (e) {
		e.preventDefault();
		$('html, body').animate({
			scrollTop: 0
		}, 1000);
	});

	// Counter initialization with viewport check
	const initCounter = () => {
		if ($('.counter').length) {
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

	// Enhanced smooth scrolling navigation
	$('a.js-scroll').on("click", function (e) {
		e.preventDefault();
		const href = $(this).attr('href');
		
		// If it's an external link (contains index.html)
		if (href.includes('index.html')) {
			// If it has a hash, we need to handle the scroll after page load
			if (href.includes('#')) {
				const [url, hash] = href.split('#');
				window.location.href = url;
				// The target page will handle the scroll to the section
			} else {
				// Just a regular link to index.html
				window.location.href = href;
			}
		} else {
			// Internal page scrolling
			if (location.pathname.replace(/^\//, '') == this.pathname.replace(/^\//, '') && location.hostname == this.hostname) {
				var target = $(this.hash);
				target = target.length ? target : $('[name=' + this.hash.slice(1) + ']');
				if (target.length) {
					$('html, body').animate({
						scrollTop: (target.offset().top - navHeight + 5)
					}, 1000, "easeInOutExpo");
					return false;
				}
			}
		}
	});

	// Responsive menu handling
	$('.js-scroll').on("click", function () {
		$('.navbar-collapse').collapse('hide');
	});

	// Enhanced scrollspy with error handling
	try {
		$('body').scrollspy({
			target: '#mainNav',
			offset: navHeight
		});
	} catch (e) {
		console.warn('Scrollspy initialization failed:', e);
	}

	// Improved navbar animation
	$(window).trigger('scroll');
	$(window).on('scroll', function () {
		var pixels = 50;
		var top = 1200;
		var scroll = $(window).scrollTop();

		if (scroll > pixels) {
			$('.navbar-expand-md').addClass('navbar-reduce').removeClass('navbar-trans');
		} else {
			$('.navbar-expand-md').addClass('navbar-trans').removeClass('navbar-reduce');
		}

		if (scroll > top) {
			$('.scrolltop-mf').fadeIn(1000, "easeInOutExpo");
		} else {
			$('.scrolltop-mf').fadeOut(1000, "easeInOutExpo");
		}
	});

	// Enhanced text slider initialization with mobile optimization
	const initTextSlider = () => {
		if ($('.text-slider').length === 1) {
			try {
				var strings = [
					'Computer Engineer',
					'AI Enthusiast', 
					'Problem Solver'
				];
				
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
			navHeight = nav.outerHeight();
			$('body').scrollspy('refresh');
			
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
			window.dataLayer = window.dataLayer || [];
			function gtag(){dataLayer.push(arguments);}
			window.gtag = gtag;
			
			// Default consent state (denied for regions requiring consent)
			gtag('consent', 'default', {
				ad_storage: 'denied',
				analytics_storage: 'denied',
				personalization_storage: 'denied',
				functionality_storage: 'granted',
				security_storage: 'granted'
			});
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
					close: 'Close'
				},
				tr: {
					message: 'Bu web sitesi deneyiminizi iyileştirmek ve trafiği analiz etmek için çerezler kullanır.',
					accept: 'Tümünü Kabul Et',
					reject: 'Tümünü Reddet',
					settings: 'Ayarlar', 
					necessary: 'Gerekli',
					analytics: 'Analitik',
					save: 'Tercihleri Kaydet',
					close: 'Kapat'
				},
				de: {
					message: 'Diese Website verwendet Cookies, um Ihre Erfahrung zu verbessern und den Verkehr zu analysieren.',
					accept: 'Alle akzeptieren',
					reject: 'Alle ablehnen',
					settings: 'Einstellungen',
					necessary: 'Notwendig', 
					analytics: 'Analytik',
					save: 'Einstellungen speichern',
					close: 'Schließen'
				}
			};
			
			const currentLang = this.detectLanguage();
			const lang = languages[currentLang] || languages.en;
			
			const bannerHTML = `
				<div id="cookie-banner" class="cookie-banner" style="display: none;">
					<div class="cookie-content">
						<p>${lang.message}</p>
						<div class="cookie-buttons">
							<button class="cookie-btn accept" onclick="CookieConsent.acceptAll()">${lang.accept}</button>
							<button class="cookie-btn reject" onclick="CookieConsent.rejectAll()">${lang.reject}</button>
							<button class="cookie-btn settings" onclick="CookieConsent.showSettings()">${lang.settings}</button>
						</div>
					</div>
				</div>
				
				<div id="cookie-settings" class="cookie-modal" style="display: none;">
					<div class="cookie-modal-content">
						<div class="cookie-modal-header">
							<h3>Cookie Settings</h3>
							<button class="cookie-close" onclick="CookieConsent.hideSettings()">&times;</button>
						</div>
						<div class="cookie-modal-body">
							<div class="cookie-category">
								<label><input type="checkbox" checked disabled> ${lang.necessary}</label>
								<small>Required for basic site functionality</small>
							</div>
							<div class="cookie-category">
								<label><input type="checkbox" id="analytics-consent"> ${lang.analytics}</label>
								<small>Help us understand how visitors interact with our website</small>
							</div>
						</div>
						<div class="cookie-modal-footer">
							<button class="cookie-btn" onclick="CookieConsent.savePreferences()">${lang.save}</button>
						</div>
					</div>
				</div>
			`;
			
			document.body.insertAdjacentHTML('beforeend', bannerHTML);
			this.addStyles();
		},
		
		addStyles() {
			const styles = `
				.cookie-banner {
					position: fixed;
					bottom: 0;
					left: 0;
					right: 0;
					background: #2c3e50;
					color: white;
					padding: 20px;
					z-index: 10000;
					box-shadow: 0 -2px 10px rgba(0,0,0,0.1);
				}
				.cookie-content {
					max-width: 1200px;
					margin: 0 auto;
					display: flex;
					justify-content: space-between;
					align-items: center;
					flex-wrap: wrap;
					gap: 15px;
				}
				.cookie-content p {
					margin: 0;
					flex: 1;
					min-width: 300px;
				}
				.cookie-buttons {
					display: flex;
					gap: 10px;
					flex-wrap: wrap;
				}
				.cookie-btn {
					padding: 10px 20px;
					border: none;
					border-radius: 4px;
					cursor: pointer;
					font-size: 14px;
					transition: all 0.3s;
				}
				.cookie-btn.accept {
					background: #27ae60;
					color: white;
				}
				.cookie-btn.accept:hover {
					background: #229954;
				}
				.cookie-btn.reject {
					background: #e74c3c;
					color: white;
				}
				.cookie-btn.reject:hover {
					background: #c0392b;
				}
				.cookie-btn.settings {
					background: #34495e;
					color: white;
				}
				.cookie-btn.settings:hover {
					background: #2c3e50;
				}
				.cookie-modal {
					position: fixed;
					top: 0;
					left: 0;
					right: 0;
					bottom: 0;
					background: rgba(0,0,0,0.7);
					z-index: 10001;
					display: flex;
					align-items: center;
					justify-content: center;
				}
				.cookie-modal-content {
					background: white;
					border-radius: 8px;
					max-width: 500px;
					width: 90%;
					max-height: 80vh;
					overflow-y: auto;
				}
				.cookie-modal-header {
					padding: 20px;
					border-bottom: 1px solid #eee;
					display: flex;
					justify-content: space-between;
					align-items: center;
				}
				.cookie-modal-header h3 {
					margin: 0;
				}
				.cookie-close {
					background: none;
					border: none;
					font-size: 24px;
					cursor: pointer;
				}
				.cookie-modal-body {
					padding: 20px;
				}
				.cookie-category {
					margin-bottom: 20px;
				}
				.cookie-category label {
					display: flex;
					align-items: center;
					gap: 10px;
					font-weight: bold;
					margin-bottom: 5px;
				}
				.cookie-category small {
					color: #666;
					display: block;
					margin-left: 30px;
				}
				.cookie-modal-footer {
					padding: 20px;
					border-top: 1px solid #eee;
					text-align: right;
				}
				@media (max-width: 768px) {
					.cookie-content {
						flex-direction: column;
						text-align: center;
					}
					.cookie-content p {
						min-width: auto;
					}
					.cookie-buttons {
						justify-content: center;
					}
				}
			`;
			
			const styleSheet = document.createElement('style');
			styleSheet.textContent = styles;
			document.head.appendChild(styleSheet);
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
			if (typeof gtag === 'function') {
				gtag('consent', 'update', {
					analytics_storage: analytics ? 'granted' : 'denied'
				});
				
				if (analytics) {
					this.initGoogleAnalytics();
				}
			}
		},
		
		initGoogleAnalytics() {
			try {
				gtag('js', new Date());
				gtag('config', 'G-ZGTWHSMVV7', {
					page_title: document.title,
					page_location: window.location.href,
					page_path: window.location.pathname,
					send_page_view: true
				});
			} catch (err) {
				console.warn('GA init failed:', err);
			}
		}
	};
	
	// Make CookieConsent globally available
	window.CookieConsent = CookieConsent;

	// EmailJS initialization
    const initEmailJS = () => {
        if (typeof emailjs !== 'undefined' && emailjs && typeof emailjs.init === 'function') {
            try { emailjs.init("sr9_9CUgd0L641ObN"); } catch (e) { console.warn('EmailJS init failed:', e); }
        }
    };

	// Blog search functionality
	const initBlogSearch = () => {
		const blogPosts = [
			{ title: "One of the precious metals, Data", url: "PreciousMetalData.html", keywords: ["data", "technology", "ai", "artificial intelligence", "precious"] },
			{ title: "Why is knowing history important?", url: "WhyToLearnHistory.html", keywords: ["history", "learning", "knowledge", "importance"] },
			// ... existing blog posts ...
		];

		window.handleSearch = (event) => {
			event.preventDefault();
			const searchTerm = document.getElementById('search-input').value.toLowerCase();
			
			if (!searchTerm.trim()) {
				return false;
			}

			const results = blogPosts.filter(post => {
				const titleMatch = post.title.toLowerCase().includes(searchTerm);
				const keywordMatch = post.keywords.some(keyword => keyword.includes(searchTerm));
				return titleMatch || keywordMatch;
			});

			if (results.length > 0) {
				window.location.href = results[0].url;
			} else {
				alert('No matching posts found.');
			}

			return false;
		};
	};

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

	const handleCommentSubmission = async (event) => {
		event.preventDefault();
		
		const submitButton = event.target.querySelector('button[type="submit"]');
		const originalButtonText = submitButton.textContent;
		
		try {
			submitButton.textContent = "Submitting...";
			submitButton.disabled = true;
			
			const formData = {
				from_name: document.getElementById('comment-name').value,
				from_email: document.getElementById('comment-email').value,
				message: document.getElementById('comment-text').value,
				blog_title: "What's machine learning, really?"
			};
			
			await emailjs.send('service_lhjdfqw', 'template_bha2val', formData);
			
			saveComment(formData.from_name, formData.message, new Date().toLocaleDateString());
			displayComment(formData.from_name, formData.message, new Date().toLocaleDateString());
			
			event.target.reset();
			document.getElementById('comment-success').classList.remove('d-none');
			
		} catch (error) {
			console.error('EmailJS Error:', error);
			document.getElementById('comment-error').classList.remove('d-none');
		} finally {
			submitButton.textContent = originalButtonText;
			submitButton.disabled = false;
		}
	};

	// Handle scroll to section when page loads with hash
	$(window).on('load', function() {
		if (window.location.hash) {
			const hash = window.location.hash;
			const target = $(hash);
			if (target.length) {
				$('html, body').animate({
					scrollTop: (target.offset().top - navHeight + 5)
				}, 1000, "easeInOutExpo");
			}
		}
	});

	// Initialize all components
	document.addEventListener('DOMContentLoaded', () => {
		CookieConsent.init();
		initEmailJS();
		initBlogSearch();
		initCommentSystem();
		// ... other existing initializations ...
	});

})(jQuery);