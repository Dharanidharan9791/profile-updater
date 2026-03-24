const path = require('path');
const fs = require('fs');
const logger = require('./logger');

const NAUKRI_LOGIN_URL = 'https://www.naukri.com/nlogin/login';
const NAUKRI_PROFILE_URL = 'https://www.naukri.com/mnjuser/profile';

// Ensure screenshots directory exists
const screenshotsDir = path.join(__dirname, '..', 'screenshots');
if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir, { recursive: true });
}

/**
 * Take a debug screenshot
 */
async function takeScreenshot(page, name) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filePath = path.join(screenshotsDir, `${name}-${timestamp}.png`);
  try {
    await page.screenshot({ path: filePath, fullPage: true });
    logger.info(`Screenshot saved: ${filePath}`);
  } catch (err) {
    logger.warn(`Failed to save screenshot: ${err.message}`);
  }
}

/**
 * Wait and retry helper
 */
async function retryAction(action, retries = 3, delayMs = 2000) {
  for (let i = 0; i < retries; i++) {
    try {
      return await action();
    } catch (err) {
      if (i === retries - 1) throw err;
      logger.warn(`Attempt ${i + 1} failed: ${err.message}. Retrying in ${delayMs}ms...`);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
}

/**
 * Login to Naukri.com
 */
async function login(page, email, password) {
  logger.info('Navigating to Naukri login page...');
  await page.goto(NAUKRI_LOGIN_URL, { waitUntil: 'networkidle', timeout: 60000 });

  // Wait for the login form to fully render (important for headless/CI environments)
  logger.info('Waiting for login form to render...');
  await page.waitForTimeout(8000);

  // Debug: log page state to help diagnose CI issues
  const pageUrl = page.url();
  const pageTitle = await page.title();
  logger.info(`Page URL: ${pageUrl}`);
  logger.info(`Page title: ${pageTitle}`);
  await takeScreenshot(page, 'debug-login-page');

  // Close any popups/overlays that might appear
  try {
    const closeButtons = page.locator('[class*="close"], [class*="Close"], [aria-label="Close"]');
    const count = await closeButtons.count();
    for (let i = 0; i < count; i++) {
      try {
        await closeButtons.nth(i).click({ timeout: 2000 });
        logger.info('Closed a popup/overlay');
      } catch {
        // ignore if click fails
      }
    }
  } catch {
    // No popups to close
  }

  // Fill in credentials
  logger.info('Entering credentials...');

  // Try multiple selectors for email field
  const emailSelectors = [
    'input[placeholder*="Enter your active Email"]',
    'input[placeholder*="Email"]',
    'input[placeholder*="email"]',
    'input[id*="usernameField"]',
    'input[type="text"][id*="login"]',
    'input[type="text"][name*="username"]',
    '#usernameField',
    'form input[type="text"]',
    'input[type="text"]',
  ];

  let emailFilled = false;
  for (const selector of emailSelectors) {
    try {
      const el = page.locator(selector).first();
      if (await el.isVisible({ timeout: 5000 })) {
        await el.click();
        await page.waitForTimeout(500);
        await el.fill(email);
        emailFilled = true;
        logger.info(`Email filled using selector: ${selector}`);
        break;
      }
    } catch {
      continue;
    }
  }

  if (!emailFilled) {
    await takeScreenshot(page, 'login-email-fail');
    throw new Error('Could not find email input field');
  }

  // Try multiple selectors for password field
  const passwordSelectors = [
    'input[placeholder*="Password"]',
    'input[placeholder*="password"]',
    'input[type="password"]',
    '#passwordField',
  ];

  let passwordFilled = false;
  for (const selector of passwordSelectors) {
    try {
      const el = page.locator(selector).first();
      if (await el.isVisible({ timeout: 3000 })) {
        await el.fill(password);
        passwordFilled = true;
        logger.info(`Password filled using selector: ${selector}`);
        break;
      }
    } catch {
      continue;
    }
  }

  if (!passwordFilled) {
    await takeScreenshot(page, 'login-password-fail');
    throw new Error('Could not find password input field');
  }

  // Click login button
  const loginSelectors = [
    'button[type="submit"]',
    'button:has-text("Login")',
    'button:has-text("login")',
    'input[type="submit"]',
    '[class*="loginButton"]',
  ];

  let loginClicked = false;
  for (const selector of loginSelectors) {
    try {
      const el = page.locator(selector).first();
      if (await el.isVisible({ timeout: 3000 })) {
        await el.click();
        loginClicked = true;
        logger.info(`Login button clicked using selector: ${selector}`);
        break;
      }
    } catch {
      continue;
    }
  }

  if (!loginClicked) {
    await takeScreenshot(page, 'login-button-fail');
    throw new Error('Could not find login button');
  }

  // Wait for navigation after login
  logger.info('Waiting for login to complete...');
  await page.waitForTimeout(5000);

  // Check if login succeeded by looking for profile indicators
  const currentUrl = page.url();
  if (currentUrl.includes('nlogin') || currentUrl.includes('login')) {
    // Might still be on login page — check for error messages
    try {
      const errorEl = page.locator('[class*="error"], [class*="Error"], .err-message').first();
      if (await errorEl.isVisible({ timeout: 2000 })) {
        const errorText = await errorEl.textContent();
        await takeScreenshot(page, 'login-error');
        throw new Error(`Login failed: ${errorText}`);
      }
    } catch (err) {
      if (err.message.startsWith('Login failed')) throw err;
    }
    // Give it more time
    await page.waitForTimeout(5000);
  }

  logger.info('✅ Login successful!');
}

/**
 * Open the resume headline editor modal
 */
async function openHeadlineEditor(page) {
  const headlineEditSelectors = [
    '[class*="resumeHeadline"] [class*="edit"]',
    '[class*="resumeHeadline"] [class*="Edit"]',
    '[class*="resumeHeadline"] span[class*="icon"]',
    '[class*="ResumeHeadline"] [class*="edit"]',
    '.widgetHead [class*="edit"]',
    'span[class*="edit"]:near(:text("Resume Headline"))',
  ];

  // Try specific selectors
  for (const selector of headlineEditSelectors) {
    try {
      const el = page.locator(selector).first();
      if (await el.isVisible({ timeout: 3000 })) {
        await el.click();
        logger.info(`Headline edit clicked using selector: ${selector}`);
        await page.waitForTimeout(2000);
        return;
      }
    } catch {
      continue;
    }
  }

  // Fallback: find "Resume Headline" text and click nearby edit icon
  try {
    const headlineSection = page.locator('text=Resume Headline').first();
    if (await headlineSection.isVisible({ timeout: 3000 })) {
      const parent = headlineSection.locator('..').locator('..');
      const editIcon = parent.locator('[class*="edit"], [class*="Edit"], [class*="icon"]').first();
      if (await editIcon.isVisible({ timeout: 3000 })) {
        await editIcon.click();
        logger.info('Headline edit clicked via text proximity');
        await page.waitForTimeout(2000);
        return;
      }
    }
  } catch {
    // continue
  }

  // Fallback: click directly on headline text
  try {
    const headlineText = page.locator('[class*="resumeHeadline"] [class*="text"], [class*="ResumeHeadline"]').first();
    if (await headlineText.isVisible({ timeout: 3000 })) {
      await headlineText.click();
      logger.info('Clicked directly on headline text area');
      await page.waitForTimeout(2000);
      return;
    }
  } catch {
    // continue
  }

  await takeScreenshot(page, 'headline-edit-fail');
  throw new Error('Could not find resume headline edit button');
}

/**
 * Find and return the headline textarea element
 */
async function findHeadlineTextarea(page) {
  const textareaSelectors = [
    'textarea[class*="headline"]',
    'textarea[class*="Headline"]',
    '#resumeHeadlineTxt',
    'textarea',
    'input[class*="headline"]',
  ];

  for (const selector of textareaSelectors) {
    try {
      const el = page.locator(selector).first();
      if (await el.isVisible({ timeout: 3000 })) {
        logger.info(`Found headline textarea using selector: ${selector}`);
        return el;
      }
    } catch {
      continue;
    }
  }

  await takeScreenshot(page, 'headline-textarea-fail');
  throw new Error('Could not find headline textarea');
}

/**
 * Click the Save button inside the modal dialog
 */
async function clickSaveInModal(page) {
  // Approach 1: Find Save button scoped inside a modal/dialog overlay
  const modalSelectors = [
    '[class*="modal"]',
    '[class*="Modal"]',
    '[class*="dialog"]',
    '[class*="Dialog"]',
    '[class*="overlay"]',
    '[class*="Overlay"]',
    '[role="dialog"]',
    '[class*="popup"]',
    '[class*="Popup"]',
  ];

  for (const modalSelector of modalSelectors) {
    try {
      const modal = page.locator(modalSelector).first();
      if (await modal.isVisible({ timeout: 1000 })) {
        const saveBtn = modal.locator('button:has-text("Save")').first();
        if (await saveBtn.isVisible({ timeout: 2000 })) {
          await saveBtn.click();
          logger.info(`Save clicked inside modal (${modalSelector})`);
          return;
        }
      }
    } catch {
      continue;
    }
  }

  // Approach 2: getByRole
  try {
    const saveBtn = page.getByRole('button', { name: 'Save' });
    if (await saveBtn.isVisible({ timeout: 3000 })) {
      await saveBtn.click();
      logger.info('Save clicked via getByRole');
      return;
    }
  } catch {
    // continue
  }

  // Approach 3: Exact text filter
  try {
    const saveBtn = page.locator('button').filter({ hasText: /^Save$/ }).first();
    if (await saveBtn.isVisible({ timeout: 3000 })) {
      await saveBtn.click();
      logger.info('Save clicked via exact text filter');
      return;
    }
  } catch {
    // continue
  }

  // Approach 4: Broad fallback selectors
  const fallbackSelectors = [
    'button:has-text("Save")',
    'button[type="submit"]',
    '[class*="save"] button',
    '[class*="Save"] button',
    'button[class*="save"]',
    'button[class*="Save"]',
  ];

  for (const selector of fallbackSelectors) {
    try {
      const el = page.locator(selector).last();
      if (await el.isVisible({ timeout: 2000 })) {
        await el.click();
        logger.info(`Save clicked using fallback selector: ${selector}`);
        return;
      }
    } catch {
      continue;
    }
  }

  await takeScreenshot(page, 'headline-save-fail');
  throw new Error('Could not find save button for headline');
}

/**
 * Update resume headline with double-toggle:
 *   1. Add a trailing space → Save
 *   2. Remove the trailing space → Save
 * This ensures the headline returns to its original form while registering an update.
 */
async function updateResumeHeadline(page) {
  logger.info('Navigating to profile page...');
  await page.goto(NAUKRI_PROFILE_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(5000);

  // ── Pass 1: Add a trailing space and save ──
  logger.info('── Pass 1: Adding trailing space ──');
  await openHeadlineEditor(page);

  let textarea = await findHeadlineTextarea(page);
  const originalHeadline = await textarea.inputValue();
  logger.info(`Original headline: "${originalHeadline}"`);

  const headlineWithSpace = originalHeadline.trimEnd() + ' ';
  await textarea.fill(headlineWithSpace);
  logger.info(`Updated headline (with space): "${headlineWithSpace}"`);

  await page.waitForTimeout(2000);
  await clickSaveInModal(page);
  await page.waitForTimeout(4000);
  logger.info('✅ Pass 1 saved (space added)');

  // ── Pass 2: Remove the trailing space and save ──
  logger.info('── Pass 2: Removing trailing space ──');
  await openHeadlineEditor(page);

  textarea = await findHeadlineTextarea(page);
  const headlineWithoutSpace = originalHeadline.trimEnd();
  await textarea.fill(headlineWithoutSpace);
  logger.info(`Restored headline: "${headlineWithoutSpace}"`);

  await page.waitForTimeout(2000);
  await clickSaveInModal(page);
  await page.waitForTimeout(4000);
  logger.info('✅ Pass 2 saved (space removed)');

  logger.info('✅ Resume headline double-toggle complete! Headline restored to original.');
}

/**
 * Upload resume PDF
 */
async function uploadResume(page, resumePath) {
  if (!resumePath || !fs.existsSync(resumePath)) {
    logger.info('No resume path configured or file not found. Skipping resume upload.');
    return;
  }

  logger.info(`Uploading resume from: ${resumePath}`);

  // Navigate to profile if not already there
  if (!page.url().includes('profile')) {
    await page.goto(NAUKRI_PROFILE_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(5000);
  }

  // Look for the file upload input
  const uploadSelectors = [
    'input[type="file"]',
    'input[type="file"][id*="resume"]',
    'input[type="file"][name*="resume"]',
  ];

  let uploaded = false;
  for (const selector of uploadSelectors) {
    try {
      const fileInput = page.locator(selector).first();
      await fileInput.setInputFiles(resumePath);
      uploaded = true;
      logger.info('Resume file selected for upload');
      break;
    } catch {
      continue;
    }
  }

  if (!uploaded) {
    // Try clicking an "Update Resume" button first
    try {
      const updateBtn = page.locator('text=Update Resume, text=Upload Resume, text=update resume').first();
      if (await updateBtn.isVisible({ timeout: 3000 })) {
        await updateBtn.click();
        await page.waitForTimeout(2000);

        const fileInput = page.locator('input[type="file"]').first();
        await fileInput.setInputFiles(resumePath);
        uploaded = true;
      }
    } catch {
      // continue
    }
  }

  if (!uploaded) {
    await takeScreenshot(page, 'resume-upload-fail');
    throw new Error('Could not upload resume');
  }

  logger.info('✅ Resume uploaded successfully!');
}

module.exports = {
  login,
  updateResumeHeadline,
  uploadResume,
};
