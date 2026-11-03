FROM node:20-alpine

# Install required system packages for media handling, stickers, and git
RUN apk add --no-cache \
    ffmpeg \
    imagemagick \
    libwebp-tools \
    git \
    curl \
    python3 \
    make \
    g++

# Set working directory
WORKDIR /app

# Copy package files first
COPY package*.json ./

# Install npm dependencies & PM2
RUN npm install --production=false && npm install -g pm2

# Copy bot source code
COPY . .

# Expose bot & live call ports
EXPOSE 9090 8000 3000

ENV PORT=9090
ENV CALL_PORT=3000

# Start both Bot & Live Call Bridge via PM2
CMD ["pm2-runtime", "start", "ecosystem.config.cjs"]
