# Use Node.js 18 LTS Alpine for smaller image size
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodeuser -u 1001

# Copy package files
COPY package*.json ./

# Install dependencies (including dev dependencies for any build steps)
RUN npm ci && npm cache clean --force

# Copy application code
COPY . .

# Change ownership to non-root user
RUN chown -R nodeuser:nodejs /app
USER nodeuser

# Expose port
EXPOSE 3000

# Health check - use 127.0.0.1 to be explicit
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:3000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })" || exit 1

# Start the application with explicit environment
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000
ENV SKIP_DB=false

# For health check testing, you can override: docker run -e SKIP_DB=true
CMD ["npm", "start"]
