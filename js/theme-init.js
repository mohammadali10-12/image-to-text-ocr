// Runs before first paint: applies a previously saved theme. Light is the default.
(function () {
  try {
    if (localStorage.getItem('itt-theme') === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
    }
  } catch (e) {
    /* Storage unavailable (private mode or blocked) — keep the light theme. */
  }
})();
