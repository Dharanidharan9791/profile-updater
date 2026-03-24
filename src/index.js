const { chromium } = require('playwright');
const cron = require('node-cron');
const { config, validate } = require('./config');
const logger = require('./logger');
const { login, updateResumeHeadline, uploadResume } = require('./naukri');

/**
 * Perform the full profile update flow
 */
async function performUpdate() {
  const startTime = Date.now();
  logger.info('='.repeat(60));
  logger.info('🚀 Starting Naukri profile update...');
  logger.info('='.repeat(60));

  let browser = null;

  try {
    // Launch browser
    browser = await chromium.launch({
      headless: config.browser.headless,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-features=VizDisplayCompositor',
      ],
    });

    const context = await browser.newContext({
      viewport: { width: 1366, height: 768 },
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      locale: 'en-IN',
      timezoneId: 'Asia/Kolkata',
    });

    const page = await context.newPage();

    // Set default timeouts
    page.setDefaultTimeout(30000);
    page.setDefaultNavigationTimeout(60000);

    // Step 1: Login
    await login(page, config.naukri.email, config.naukri.password);

    // Step 2: Update resume headline
    await updateResumeHeadline(page);

    // Step 3: Upload resume (optional)
    if (config.resume.path) {
      await uploadResume(page, config.resume.path);
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    logger.info('='.repeat(60));
    logger.info(`✅ Profile update completed successfully in ${elapsed}s`);
    logger.info('='.repeat(60));
  } catch (error) {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    logger.error(`❌ Profile update failed after ${elapsed}s: ${error.message}`);
    logger.error(error);
  } finally {
    if (browser) {
      await browser.close();
      logger.info('Browser closed.');
    }
  }
}

/**
 * Main entry point
 */
async function main() {
  logger.info('🔧 Naukri Profile Auto-Updater starting...');
  logger.info(`   Mode: ${config.runOnce ? 'Single run' : 'Cron scheduled'}`);
  logger.info(`   Headless: ${config.browser.headless}`);
  logger.info(`   Schedule: ${config.cron.schedule}`);
  logger.info(`   Resume upload: ${config.resume.path ? 'Yes' : 'No'}`);

  // Validate config
  validate();

  if (config.runOnce) {
    // Run once and exit
    await performUpdate();
    logger.info('Single run mode — exiting.');
    process.exit(0);
  }

  // Run immediately on startup
  logger.info('Running initial update...');
  await performUpdate();

  // Schedule cron job
  if (!cron.validate(config.cron.schedule)) {
    logger.error(`Invalid cron schedule: "${config.cron.schedule}"`);
    process.exit(1);
  }

  const job = cron.schedule(
    config.cron.schedule,
    async () => {
      logger.info(`⏰ Cron triggered at ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`);
      await performUpdate();
    },
    {
      timezone: 'Asia/Kolkata',
    }
  );

  logger.info(`📅 Cron job scheduled: "${config.cron.schedule}" (IST)`);
  logger.info('Waiting for next scheduled run... (Press Ctrl+C to stop)');

  // Graceful shutdown
  const shutdown = (signal) => {
    logger.info(`\n${signal} received. Shutting down gracefully...`);
    job.stop();
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  logger.error(`Fatal error: ${err.message}`);
  logger.error(err);
  process.exit(1);
});
