/**
 * Light/dark toggle.
 *
 * The *initial* theme is applied by a tiny synchronous snippet in <head> — not
 * here — because anything deferred paints the light theme first and then
 * repaints dark, which is the flash this design is meant to avoid. This file
 * only handles the click, so it can safely load late.
 *
 * Three states matter: "follow the OS" (no stored value), explicit light, and
 * explicit dark. Toggling always writes an explicit value, so a visitor on a
 * dark OS can still choose light and have it stick.
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'theme';
  var root = document.documentElement;

  function systemPrefersDark() {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  function effectiveTheme() {
    var explicit = root.getAttribute('data-theme');
    if (explicit === 'dark' || explicit === 'light') return explicit;
    return systemPrefersDark() ? 'dark' : 'light';
  }

  function label(theme) {
    var lang = (root.getAttribute('lang') || 'en').slice(0, 2);
    var copy = {
      en: { dark: 'Switch to light theme', light: 'Switch to dark theme' },
      tr: { dark: 'Açık temaya geç', light: 'Koyu temaya geç' },
      de: { dark: 'Zum hellen Design wechseln', light: 'Zum dunklen Design wechseln' }
    };
    return (copy[lang] || copy.en)[theme];
  }

  function sync(btn) {
    var theme = effectiveTheme();
    btn.setAttribute('aria-pressed', String(theme === 'dark'));
    btn.setAttribute('aria-label', label(theme));
    btn.setAttribute('title', label(theme));
  }

  function ready(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }

  ready(function () {
    var btn = document.querySelector('.theme-toggle');
    if (!btn) return;

    sync(btn);

    btn.addEventListener('click', function () {
      var next = effectiveTheme() === 'dark' ? 'light' : 'dark';

      // Suppress transitions for the duration of the swap. Without this the
      // template's `a { transition: all .25s }` animates every link colour
      // separately, which reads as a smear rather than a theme change.
      root.classList.add('theme-switching');
      root.setAttribute('data-theme', next);
      // Force a style flush so the class is applied with the new theme before
      // it is removed, rather than being coalesced away.
      void root.offsetHeight;
      setTimeout(function () { root.classList.remove('theme-switching'); }, 0);

      try { localStorage.setItem(STORAGE_KEY, next); } catch (e) { /* private mode */ }
      sync(btn);
    });

    // Follow the OS while the visitor has not made an explicit choice.
    if (window.matchMedia) {
      var mq = window.matchMedia('(prefers-color-scheme: dark)');
      var onChange = function () {
        var stored = null;
        try { stored = localStorage.getItem(STORAGE_KEY); } catch (e) { /* ignore */ }
        if (stored !== 'dark' && stored !== 'light') sync(btn);
      };
      if (mq.addEventListener) mq.addEventListener('change', onChange);
      else if (mq.addListener) mq.addListener(onChange);
    }
  });
})();
