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
	$('a.js-scroll[href*="#"]:not([href="#"])').on("click", function (e) {
		e.preventDefault();
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

	// Enhanced text slider initialization
	const initTextSlider = () => {
		if ($('.text-slider').length === 1) {
			try {
				var typed_strings = $('.text-slider-items').text();
				var typed = new Typed('.text-slider', {
					strings: typed_strings.split(','),
					typeSpeed: 80,
					loop: true,
					backDelay: 1100,
					backSpeed: 30,
					smartBackspace: true,
					showCursor: true,
					cursorChar: '|'
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

})(jQuery);



// Add this to your main.js file
$(document).ready(function() {
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
  });









  // Language handling functionality
document.addEventListener('DOMContentLoaded', function() {
	// Set default language or get from localStorage
	let currentLang = localStorage.getItem('preferredLanguage') || 'en';
	
	// Apply initial language
	applyLanguage(currentLang);
	
	// Language switcher event listeners
	document.querySelectorAll('.lang-switch').forEach(item => {
	  item.addEventListener('click', function(e) {
		e.preventDefault();
		const newLang = this.getAttribute('data-lang');
		localStorage.setItem('preferredLanguage', newLang);
		applyLanguage(newLang);
	  });
	});
	
	function applyLanguage(lang) {
	  // Update active state in dropdown
	  document.querySelectorAll('.lang-switch').forEach(el => {
		el.classList.remove('active');
		if (el.getAttribute('data-lang') === lang) {
		  el.classList.add('active');
		}
	  });
	  
	  // Apply translations to all elements with data-i18n attribute
	  document.querySelectorAll('[data-i18n]').forEach(el => {
		const key = el.getAttribute('data-i18n');
		if (translations[lang] && translations[lang][key]) {
		  el.innerHTML = translations[lang][key];
		}
	  });
	  
	  // For input placeholders
	  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
		const key = el.getAttribute('data-i18n-placeholder');
		if (translations[lang] && translations[lang][key]) {
		  el.setAttribute('placeholder', translations[lang][key]);
		}
	  });
	  
	  // Update HTML lang attribute
	  document.documentElement.lang = lang;
	}
  });