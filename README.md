# 🔄 Naukri Profile Auto-Updater

Automatically refresh your [Naukri.com](https://www.naukri.com) profile daily so it stays visible to recruiters — zero manual effort.

## What It Does

- **Logs into Naukri** with your credentials
- **Toggles the resume headline** (adds/removes a trailing space) to register a profile update
- **Optionally re-uploads your resume** PDF for a stronger refresh signal
- **Runs on a cron schedule** (default: daily at 10 AM IST)
- **Saves screenshots & logs** for debugging

## Quick Start

### 1. Install Dependencies

```bash
npm install
npx playwright install chromium
```

### 2. Configure

```bash
cp .env.example .env
```

Edit `.env` with your Naukri credentials:

```env
NAUKRI_EMAIL=your_email@example.com
NAUKRI_PASSWORD=your_password
```

### 3. Run Locally

```bash
# Run once (test mode)
npm run update:now

# Run with cron schedule
npm start
```

### 4. Run with Visible Browser (Debug)

Set `HEADLESS=false` in `.env` to watch the automation in action.

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `NAUKRI_EMAIL` | ✅ | — | Your Naukri login email |
| `NAUKRI_PASSWORD` | ✅ | — | Your Naukri password |
| `CRON_SCHEDULE` | ❌ | `0 10 * * *` | Cron expression (IST timezone) |
| `RESUME_PATH` | ❌ | — | Path to resume PDF for upload |
| `HEADLESS` | ❌ | `true` | Run browser in headless mode |
| `NAUKRI_RUN_ONCE` | ❌ | `false` | Run once and exit |

## Docker Deployment

### Build & Run

```bash
docker compose up -d
```

### Or manually:

```bash
docker build -t naukri-updater .
docker run -d --name naukri-updater --env-file .env naukri-updater
```

### View Logs

```bash
docker logs -f naukri-updater
```

## Cloud Deployment

This app is ready to deploy to any cloud that supports Docker containers:

### Railway / Render
1. Push to GitHub
2. Connect repo to Railway/Render
3. Set environment variables in the dashboard
4. Deploy

### AWS ECS / GCP Cloud Run / Azure Container Instances
1. Build and push the Docker image to your container registry
2. Create a task/service with the image
3. Set environment variables
4. The cron scheduler runs inside the container — no external scheduler needed

## Project Structure

```
├── src/
│   ├── index.js       # Entry point — cron scheduler
│   ├── config.js      # Environment config loader
│   ├── logger.js      # Winston logger
│   └── naukri.js      # Browser automation logic
├── logs/              # Generated log files
├── screenshots/       # Debug screenshots
├── Dockerfile
├── docker-compose.yml
├── .env.example
└── package.json
```

## Troubleshooting

- **Login fails?** → Check screenshots in `screenshots/` folder. Naukri may have changed their UI.
- **OTP required?** → This tool works with email+password login only. Disable OTP in Naukri settings.
- **Selectors broken?** → Naukri periodically updates their DOM. Update selectors in `src/naukri.js`.
