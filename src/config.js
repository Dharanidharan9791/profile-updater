const dotenv = require('dotenv');

dotenv.config();

const config = {
  naukri: {
    email: process.env.NAUKRI_EMAIL,
    password: process.env.NAUKRI_PASSWORD,
    headline: process.env.NAUKRI_HEADLINE,
  },
  cron: {
    schedule: process.env.CRON_SCHEDULE || '0 10 * * *', // Default: 10 AM daily
  },
  runOnce: process.env.NAUKRI_RUN_ONCE === 'true',
};

// Validate required fields
function validate() {
  const errors = [];
  if (!config.naukri.email) errors.push('NAUKRI_EMAIL is required');
  if (!config.naukri.password) errors.push('NAUKRI_PASSWORD is required');

  if (errors.length > 0) {
    throw new Error(
      `Configuration errors:\n${errors.map((e) => `  - ${e}`).join('\n')}\n\nCopy .env.example to .env and fill in your credentials.`
    );
  }
}

module.exports = { config, validate };
