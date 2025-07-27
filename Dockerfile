# Use Ubuntu 24.04 as base
FROM ubuntu:24.04

# Install Volta
RUN apt-get update && \
    apt-get install -y curl bash && \
    curl https://get.volta.sh | bash && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Add Volta to PATH
ENV VOLTA_HOME="/root/.volta"
ENV PATH="$VOLTA_HOME/bin:$PATH"


# Set working directory
WORKDIR /app

# Copy package files first for better layer caching
COPY package*.json ./

# Install Node.js and npm versions specified in package.json via Volta
RUN volta install node@$(node -p "require('./package.json').volta.node") && \
    volta install npm@$(node -p "require('./package.json').volta.npm")

# Copy source code
COPY . .

# Install dependencies with clean cache
RUN npm install
RUN npm build
# Expose port (adjust if needed)
EXPOSE 8081

# Use exec form for better signal handling
CMD ["npm", "run", "start"]