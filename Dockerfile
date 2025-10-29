# Multi-stage build for production
FROM node:20-alpine AS builder

WORKDIR /app

# Update npm to latest version for better compatibility
RUN npm install -g npm@latest

# Copy package files
COPY package*.json ./
COPY tsconfig*.json ./
COPY nest-cli.json ./

# Install all dependencies (including dev for build)
# Try npm ci first, fallback to npm install if lock file is out of sync
RUN npm ci || (npm install && npm cache clean --force)

# Copy source code
COPY src ./src

# Build the application
RUN npm run build

# Production stage
FROM node:20-alpine AS production

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init \
    && addgroup -g 1001 -S nodejs \
    && adduser -S nodejs -u 1001

WORKDIR /app

# Update npm to latest version
RUN npm install -g npm@latest

# Copy package files
COPY package*.json ./

# Install only production dependencies
# Try npm ci first, fallback to npm install if lock file is out of sync
RUN npm ci --only=production || (npm install --only=production && npm cache clean --force)

# Copy built application from builder
COPY --from=builder /app/dist ./dist

# Create logs directory
RUN mkdir -p logs && chown -R nodejs:nodejs logs

# Change to non-root user
USER nodejs

# Expose port
EXPOSE 3000

# Environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "dist/main.js"]
