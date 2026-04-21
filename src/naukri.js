const logger = require('./logger');

/**
 * Common headers to mimic a real browser
 */
function getHeaders(extraHeaders = {}) {
  return {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/json',
    'Accept-Language': 'en-US,en;q=0.9,hi;q=0.8',
    'Connection': 'keep-alive',
    'Origin': 'https://www.naukri.com',
    'Referer': 'https://www.naukri.com/mnjuser/profile',
    ...extraHeaders,
  };
}

/**
 * Parse Set-Cookie headers into a cookie string
 */
function parseCookies(setCookieHeaders) {
  if (!setCookieHeaders) return '';
  const headers = Array.isArray(setCookieHeaders) ? setCookieHeaders : [setCookieHeaders];
  return headers.map((cookie) => cookie.split(';')[0]).join('; ');
}

/**
 * Merge new cookies into existing cookie string
 */
function mergeCookies(existingCookies, newCookies) {
  const map = {};
  const parse = (str) => {
    if (!str) return;
    const parts = Array.isArray(str) ? str : [str];
    parts.forEach((part) => {
      part.split('; ').forEach((c) => {
        const mainPart = c.split(';')[0];
        const [key, ...val] = mainPart.split('=');
        if (key?.trim()) map[key.trim()] = val.join('=');
      });
    });
  };
  parse(existingCookies);
  parse(newCookies);
  return Object.entries(map).map(([k, v]) => `${k}=${v}`).join('; ');
}

/**
 * Login to Naukri.com via the central login API
 */
async function login(email, password) {
  logger.info('Logging in to Naukri...');

  // Step 1: Get initial cookies from the login page
  const pageRes = await fetch('https://www.naukri.com/nlogin/login', {
    headers: getHeaders(),
    redirect: 'follow',
  });
  let cookies = parseCookies(pageRes.headers.getSetCookie?.() || []);

  // Step 2: Authenticate via central login API
  const loginRes = await fetch('https://www.naukri.com/central-login-services/v1/login', {
    method: 'POST',
    headers: {
      ...getHeaders({
        'Content-Type': 'application/json',
        'Cookie': cookies,
        'appId': '105',
        'systemId': 'jobseeker',
      }),
    },
    body: JSON.stringify({ username: email, password: password }),
    redirect: 'follow',
  });

  cookies = mergeCookies(cookies, loginRes.headers.getSetCookie?.() || []);
  const loginData = await loginRes.json().catch(() => null);

  if (!loginRes.ok) {
    const msg = loginData?.message || `HTTP ${loginRes.status}`;
    throw new Error(`Login failed: ${msg}`);
  }

  // Merge auth cookies from JSON response body
  if (loginData?.cookies?.length) {
    const bodyCookies = loginData.cookies.map((c) => `${c.name}=${c.value}`);
    cookies = mergeCookies(cookies, bodyCookies);
    logger.info(`Auth cookies merged: ${loginData.cookies.length}`);
  }

  logger.info('✅ Login successful!');
  return cookies;
}

/**
 * Update resume headline via the mnjuser profile endpoint
 */
async function postHeadlineUpdate(cookies, headline) {
  const response = await fetch('https://www.naukri.com/mnjuser/profile?action=resumeHeadline', {
    method: 'POST',
    headers: {
      ...getHeaders({
        'Content-Type': 'application/json',
        'Cookie': cookies,
        'X-Requested-With': 'XMLHttpRequest',
        'appId': '105',
        'systemId': 'jobseeker',
      }),
    },
    body: JSON.stringify({ resumeHeadline: headline }),
    redirect: 'follow',
  });

  logger.info(`Update response: ${response.status}`);

  if (!response.ok) {
    throw new Error(`Headline update failed: HTTP ${response.status}`);
  }

  return true;
}

/**
 * Update resume headline to trigger a profile refresh.
 * Adds a trailing space then removes it — profile ends up unchanged
 * but Naukri registers two updates.
 */
async function updateResumeHeadline(cookies, headline) {
  if (!headline) {
    throw new Error('NAUKRI_HEADLINE environment variable is required. Set it to your current resume headline.');
  }

  const cleanHeadline = headline.trim();

  // Pass 1: Add trailing space
  logger.info('── Pass 1: Adding trailing space ──');
  await postHeadlineUpdate(cookies, cleanHeadline + ' ');
  logger.info('✅ Pass 1 done');

  await new Promise((r) => setTimeout(r, 3000));

  // Pass 2: Remove trailing space (restore original)
  logger.info('── Pass 2: Restoring original ──');
  await postHeadlineUpdate(cookies, cleanHeadline);
  logger.info('✅ Pass 2 done');

  logger.info('✅ Profile refreshed! Headline restored to original.');
}

module.exports = { login, updateResumeHeadline };
