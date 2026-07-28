// Renders the LaTeX on the two pages that contain it.
//
// This used to be an `onload="renderMathInElement(...)"` attribute on the
// auto-render <script>. Inline event handlers do not run under a
// Content-Security-Policy that carries script hashes ('unsafe-inline' is
// ignored once a hash is present), so with CSP enforced the equations would
// have gone back to rendering as literal backslashes — the single most
// damaging finding in the original audit.
//
// Loaded with `defer` after katex.min.js and auto-render.min.js, so all three
// run in order before DOMContentLoaded.
(function () {
  function render() {
    if (typeof renderMathInElement !== 'function') return;
    renderMathInElement(document.body, {
      delimiters: [
        { left: '\\[', right: '\\]', display: true },
        { left: '\\(', right: '\\)', display: false }
      ],
      throwOnError: false
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', render);
  } else {
    render();
  }
})();
