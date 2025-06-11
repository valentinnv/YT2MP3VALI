# Use Node.js 18 Alpine for smaller image size
FROM node:18-alpine

# Install system dependencies including yt-dlp via apk
RUN apk add --no-cache \
    ffmpeg \
    python3 \
    py3-pip \
    py3-setuptools \
    && apk add --no-cache --repository=http://dl-cdn.alpinelinux.org/alpine/edge/community \
    yt-dlp

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install npm dependencies
RUN npm ci --only=production

# Copy application code
COPY . .

# Create downloads directory
RUN mkdir -p downloads

# Expose port
EXPOSE 3000

# Start the application
CMD ["npm", "start"]