const STORAGE_KEY = 'itt-theme';

function readSavedTheme() {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function saveTheme(theme) {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    /* Ignore: the theme still applies for this visit. */
  }
}

/** Wires up the light/dark toggle button. */
export function initThemeToggle(button) {
  const root = document.documentElement;

  const apply = (theme) => {
    const isDark = theme === 'dark';
    root.setAttribute('data-theme', isDark ? 'dark' : 'light');
    button.setAttribute('aria-pressed', String(isDark));
    button.setAttribute('aria-label', isDark ? 'Switch to light mode' : 'Switch to dark mode');
  };

  apply(readSavedTheme() === 'dark' ? 'dark' : 'light');

  button.addEventListener('click', () => {
    const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    apply(next);
    saveTheme(next);
  });
}
