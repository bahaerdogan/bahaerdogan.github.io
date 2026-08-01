/**
 * Article page extras: table-of-contents highlighting and the copy-link button.
 *
 * Both are enhancements over markup that already works. The TOC is a plain
 * anchor list without this file; the copy button falls back to selecting the URL
 * so it can be copied manually. No inline handlers — the CSP carries script
 * hashes and would refuse them.
 */
(function () {
  'use strict';

  function ready(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }

  ready(function () {
    // --- Copy link ---
    var copyBtn = document.querySelector('.post-share__copy');
    if (copyBtn) {
      copyBtn.addEventListener('click', function () {
        var url = copyBtn.getAttribute('data-url') || location.href;
        var done = function () {
          copyBtn.classList.add('is-copied');
          copyBtn.setAttribute('aria-label', copyBtn.getAttribute('data-copied') || 'Copied');
          setTimeout(function () { copyBtn.classList.remove('is-copied'); }, 1800);
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(url).then(done, function () { window.prompt('', url); });
        } else {
          window.prompt('', url);
        }
      });
    }

    // --- TOC active-section highlight ---
    var links = Array.prototype.slice.call(document.querySelectorAll('.toc-list a'));
    if (!links.length || !('IntersectionObserver' in window)) return;

    var byId = {};
    var targets = [];
    links.forEach(function (a) {
      var id = decodeURIComponent((a.getAttribute('href') || '').slice(1));
      var el = id && document.getElementById(id);
      if (!el) return;
      byId[id] = a;
      targets.push(el);
    });
    if (!targets.length) return;

    var current = null;
    function setActive(a) {
      if (a === current) return;
      if (current) current.classList.remove('is-active');
      if (a) a.classList.add('is-active');
      current = a;
    }

    var visible = new Set();
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) visible.add(e.target);
        else visible.delete(e.target);
      });
      // Highlight the heading nearest the top of the viewport.
      var best = null;
      visible.forEach(function (el) {
        if (!best || el.getBoundingClientRect().top < best.getBoundingClientRect().top) best = el;
      });
      if (best) setActive(byId[best.id]);
    }, { rootMargin: '-80px 0px -70% 0px', threshold: 0 });

    targets.forEach(function (el) { observer.observe(el); });
  });
})();
