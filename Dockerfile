# Use Bun runtime for our TypeScript application
FROM oven/bun:1.2-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json bun.lock* ./

# Install dependencies
RUN bun install --production --frozen-lockfile

# Copy TypeScript configuration
COPY tsconfig.json ./

# Copy source code
COPY src/ ./src/

# Copy domain directories if they exist
COPY domains/ ./domains/

# Create necessary directories
RUN mkdir -p logs config

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD bun run --bun src/health-check.ts || exit 1

# Set proper permissions
RUN chown -R bun:bun /app

# Switch to non-root user
USER bun

# Start the application
CMD ["bun", "run", "src/server.ts"]
