# Use Ubuntu 24.04 as base
FROM ubuntu:24.04

# Install dependencies first
RUN apt-get update && \
    apt-get install -y curl bash && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Create non-root user with home directory
RUN groupadd -g 1001 nodejs && \
    useradd -r -u 1001 -g nodejs -m nextjs

# Switch to non-root user for Volta installation
USER nextjs

# Install Volta as the nextjs user
RUN curl https://get.volta.sh | bash

# Add Volta to PATH for nextjs user
ENV VOLTA_HOME="/home/nextjs/.volta"
ENV PATH="$VOLTA_HOME/bin:$PATH"

# Set working directory
WORKDIR /app

# Copy package files first for better layer caching
COPY --chown=nextjs:nodejs package*.json ./

# Install Node.js and npm versions specified in package.json via Volta
RUN volta install node@22.12.0 && \
    volta install npm@10.9.0

# Install all dependencies (including dev dependencies for build)
RUN npm install && \
    npm cache clean --force

# Copy source code
COPY --chown=nextjs:nodejs . .

# Build the application
RUN npm run build

# Remove dev dependencies after build to reduce image size
RUN npm prune --omit=dev

# Expose port (adjust if needed)
EXPOSE 8081

# Use exec form for better signal handling
CMD ["npm", "run", "start"]