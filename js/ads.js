/**
 * Google AdSense Ad Manager
 * Handles ad placement, loading, and consent-aware display.
 */

// Replace with your actual AdSense publisher ID
const ADSENSE_PUB_ID = 'ca-pub-XXXXXXXXXX';

// Ad unit configurations
const AD_UNITS = {
  homepage_top: { slot: '1234567890', format: 'horizontal', size: '728x90' },
  homepage_mid: { slot: '1234567891', format: 'rectangle', size: '336x280' },
  game_top: { slot: '1234567892', format: 'horizontal', size: '728x90' },
  game_bottom: { slot: '1234567893', format: 'rectangle', size: '300x250' },
  game_sidebar: { slot: '1234567894', format: 'vertical', size: '160x600' },
};

/**
 * Insert an ad unit into a container element.
 */
function insertAd(containerId, adType) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const config = AD_UNITS[adType];
  if (!config) return;

  // Check if user has ad consent (cookie consent)
  const hasConsent = localStorage.getItem('cookie-consent') === 'accepted';

  // Create AdSense ins element
  const adEl = document.createElement('ins');
  adEl.className = 'adsbygoogle';
  adEl.style.display = 'block';
  adEl.style.textAlign = 'center';
  adEl.style.margin = '20px auto';

  if (config.format === 'horizontal') {
    adEl.setAttribute('data-ad-format', 'horizontal');
    adEl.setAttribute('data-full-width-responsive', 'true');
  } else {
    adEl.style.width = config.size.split('x')[0] + 'px';
    adEl.style.height = config.size.split('x')[1] + 'px';
  }

  adEl.setAttribute('data-ad-client', ADSENSE_PUB_ID);
  adEl.setAttribute('data-ad-slot', config.slot);

  if (!hasConsent) {
    adEl.setAttribute('data-ad-format', 'auto');
    adEl.setAttribute('data-non-personalized-ads', 'true');
  }

  container.appendChild(adEl);

  // Push to AdSense
  try {
    (window.adsbygoogle = window.adsbygoogle || []).push({});
  } catch (e) {
    console.log('AdSense not loaded');
  }
}

/**
 * Initialize ads on page load.
 */
function initAds() {
  // Detect page type
  const path = window.location.pathname;
  const isHomepage = path === '/' || path.endsWith('/index.html') || path.endsWith('/Games-/');
  const isGamePage = path.includes('/games/');

  if (isHomepage) {
    insertAd('ad-slot-top', 'homepage_top');
    insertAd('ad-slot-mid', 'homepage_mid');
  } else if (isGamePage) {
    insertAd('ad-slot-game-top', 'game_top');
    insertAd('ad-slot-game-bottom', 'game_bottom');
  }
}

/**
 * Cookie consent functions
 */
function acceptCookies() {
  localStorage.setItem('cookie-consent', 'accepted');
  document.getElementById('cookie-banner').style.display = 'none';
  initAds(); // Load personalized ads
}

function rejectCookies() {
  localStorage.setItem('cookie-consent', 'essential');
  document.getElementById('cookie-banner').style.display = 'none';
  initAds(); // Load non-personalized ads
}

/**
 * Show cookie banner if no consent recorded
 */
function initCookieBanner() {
  if (!localStorage.getItem('cookie-consent')) {
    const banner = document.getElementById('cookie-banner');
    if (banner) banner.style.display = 'block';
  } else {
    // Consent already given, load ads immediately
    initAds();
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initCookieBanner);
} else {
  initCookieBanner();
}
