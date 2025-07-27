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
				var typed_strings = $('.text-slider-items').text();
				var strings = typed_strings.split(',').map(s => s.trim());
				
				var typed = new Typed('.text-slider', {
					strings: strings,
					typeSpeed: 60,
					loop: true,
					backDelay: 1500,
					backSpeed: 40,
					smartBackspace: true,
					showCursor: true,
					cursorChar: '|',
					fadeOut: false,
					fadeOutClass: 'typed-fade-out',
					fadeOutDelay: 500,
					onStringTyped: function(arrayPos, self) {
						// Ensure text stays on one line
						$('.text-slider').css('white-space', 'nowrap');
					}
				});
			} catch (e) {
				console.warn('Typed.js initialization failed:', e);
			}
		}
	};
	initTextSlider();

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
		}, 250);
	});

	// Initialize the blog carousel
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

	// Language toggle functionality
	const languageToggle = $('#language-toggle');
	
	if (languageToggle.length) {
		languageToggle.on('click', function(e) {
			e.preventDefault();
			
			// Get current page URL
			const currentPath = window.location.pathname;
			const filename = currentPath.split('/').pop();
			
			// Check if this is already the Turkish version
			if (filename.includes('TR.html')) {
				// If Turkish, switch to English
				const englishVersion = filename.replace('TR.html', '.html');
				window.location.href = englishVersion;
			} else {
				// If English, switch to Turkish
				const turkishVersion = filename.replace('.html', 'TR.html');
				window.location.href = turkishVersion;
			}
		});
	}

	// Google Analytics initialization
	const initGoogleAnalytics = () => {
		window.dataLayer = window.dataLayer || [];
		function gtag(){dataLayer.push(arguments);}
		gtag('js', new Date());
		gtag('config', 'G-ZGTWHSMVV7');
	};

	// EmailJS initialization
	const initEmailJS = () => {
		emailjs.init("sr9_9CUgd0L641ObN");
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
		
		if (commentForm) {
			commentForm.addEventListener('submit', handleCommentSubmission);
		}
		
		loadComments();
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
		initGoogleAnalytics();
		initEmailJS();
		initBlogSearch();
		initCommentSystem();
		// ... other existing initializations ...
	});

})(jQuery);