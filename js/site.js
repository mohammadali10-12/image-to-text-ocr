/** Shared behaviour for content pages that don't include the converter. */
import { initThemeToggle } from './theme.js';

const toggle = document.getElementById('theme-toggle');
if (toggle) initThemeToggle(toggle);

const year = document.getElementById('year');
if (year) year.textContent = String(new Date().getFullYear());
