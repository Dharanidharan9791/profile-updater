FROM mcr.microsoft.com/playwright:v1.49.1-noble

WORKDIR /app

# Copy package files and install dependencies
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev && npx playwright install chromium --with-deps

# Copy application source
COPY src/ ./src/

# Create directories for logs and screenshots
RUN mkdir -p logs screenshots

# Run as non-root user (playwright image provides 'pwuser')
USER pwuser

CMD ["node", "src/index.js"]
