/**
 * Blog index enhancement: category filter, text filter, load-more.
 *
 * Every card is already in the DOM, rendered at build time. This only shows and
 * hides them, so the page is complete and navigable with JavaScript disabled or
 * still parsing — the previous version shipped an empty `#blogGrid` plus a
 * "Loading articles…" spinner and a renderer that was never written.
 *
 * No inline handlers: the Content-Security-Policy carries script hashes and
 * would refuse them.
 */
(function () {
  'use strict';

  var PAGE = 6; // cards revealed per "load more"

  function ready(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }

  ready(function () {
    var grid = document.getElementById('blogGrid');
    if (!grid) return;

    var cards = Array.prototype.slice.call(grid.querySelectorAll('.post-card'));
    // The featured post sits above the grid and is not paged, but it must still
    // answer to search and the category filter: it used to stay on screen next
    // to "no results" for any query.
    var featured = document.querySelector('.post-featured');
    var filterBtns = Array.prototype.slice.call(document.querySelectorAll('.blog-filter__btn'));
    var input = document.getElementById('blogFilterInput');
    var empty = document.getElementById('blogEmpty');
    var moreBtn = document.getElementById('blogLoadMore');

    var category = 'all';
    var query = '';
    var shown = PAGE;

    // Cache each card's searchable text once rather than re-reading the DOM on
    // every keystroke.
    cards.concat(featured ? [featured] : []).forEach(function (card) {
      // [data-cat]: the featured card's first badge is "Featured", not its category.
      var badge = card.querySelector('.post-card__badge[data-cat]');
      card.setAttribute('data-category', badge ? (badge.getAttribute('data-cat') || '') : '');
      // Tags live in the article's sidebar widget, not in the card, so the
      // visible text alone never matched a tag query — "orchestration" returned
      // nothing despite being a tag on two posts. The build emits them as
      // data-tags; they are appended to the haystack here.
      card._haystack = ((card.textContent || '') + ' ' + (card.getAttribute('data-tags') || '')).toLowerCase();
    });

    function matches(card) {
      if (category !== 'all' && card.getAttribute('data-category') !== category) return false;
      if (query && card._haystack.indexOf(query) === -1) return false;
      return true;
    }

    function apply(resetPaging) {
      if (resetPaging) shown = PAGE;

      var visible = 0;
      cards.forEach(function (card) {
        if (!matches(card)) {
          card.hidden = true;
          return;
        }
        visible++;
        card.hidden = visible > shown;
      });

      var featuredMatches = featured ? matches(featured) : false;
      if (featured) featured.hidden = !featuredMatches;

      var total = cards.filter(matches).length + (featuredMatches ? 1 : 0);
      if (empty) empty.hidden = total !== 0;
      if (moreBtn) moreBtn.parentNode.hidden = cards.filter(matches).length <= shown;
    }

    filterBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        category = btn.getAttribute('data-filter') || 'all';
        filterBtns.forEach(function (b) {
          var on = b === btn;
          b.classList.toggle('is-active', on);
          b.setAttribute('aria-pressed', String(on));
        });
        apply(true);
      });
    });

    if (input) {
      var timer;
      input.addEventListener('input', function () {
        clearTimeout(timer);
        timer = setTimeout(function () {
          query = input.value.toLowerCase().trim();
          apply(true);
        }, 120);
      });
    }

    if (moreBtn) {
      moreBtn.addEventListener('click', function () {
        shown += PAGE;
        apply(false);
        // Move focus to the first newly revealed card so keyboard and screen
        // reader users land on the new content instead of the page top.
        var next = cards.filter(function (c) { return !c.hidden; })[shown - PAGE];
        if (next) {
          var link = next.querySelector('a');
          if (link) link.focus({ preventScroll: true });
        }
      });
    }

    // Controls are inert until their handlers are bound, so they stay hidden
    // for JS-off visitors and reveal only once they actually work. The class is
    // removed rather than `style.display = ''`: clearing an inline style that was
    // never set left the stylesheet's `.js-only { display: none }` in force, so
    // search, the filters and "Load more" were never shown and 11 of 18 posts
    // could not be reached from this page.
    Array.prototype.slice.call(document.querySelectorAll('.js-only')).forEach(function (el) {
      el.classList.remove('js-only');
    });

    apply(true);
  });
})();
