# Use official Node.js image instead of Ubuntu + NVM
FROM node:22.13.1-alpine

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

# Set working directory
WORKDIR /app

# Copy package files first for better layer caching
COPY package*.json ./

# Install dependencies with clean cache
RUN npm ci --only=production && \
    npm cache clean --force

# Copy source code
COPY . .

# Change ownership to non-root user
RUN chown -R nextjs:nodejs /app

# Switch to non-root user
USER nextjs

# Expose port (adjust if needed)
EXPOSE 8081

# Use exec form for better signal handling
CMD ["npm", "run", "start"]