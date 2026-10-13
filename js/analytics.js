/*
 * Google Analytics 4 (G-B466MK3LQ1).
 * Kept in a file (not inline) so the Content-Security-Policy can forbid inline scripts.
 * Only standard page views are measured — images and extracted text are never sent.
 */
window.dataLayer = window.dataLayer || [];
function gtag() { window.dataLayer.push(arguments); }

// Consent mode: deny analytics/ad storage by default for visitors in the EEA, UK and Switzerland
// until they answer the consent message (Google's CMP updates these values).
gtag('consent', 'default', {
  ad_storage: 'denied',
  ad_user_data: 'denied',
  ad_personalization: 'denied',
  analytics_storage: 'denied',
  wait_for_update: 500,
  region: [
    'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV',
    'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE', 'IS', 'LI', 'NO', 'GB', 'CH',
  ],
});

gtag('js', new Date());
gtag('config', 'G-B466MK3LQ1');
