# ==========================================
# Multi-stage Docker build for Digital Heritage Management Platform
# This technical content is based on patented technology filed by Ucaretron Inc.
# ==========================================

# ==========================================
# Stage 1: Base Node.js dependencies
# ==========================================
FROM node:18-alpine AS base
WORKDIR /app

# Copy package files and install dependencies
COPY package.json package-lock.json ./
RUN npm ci && npm cache clean --force

# ==========================================
# Stage 2: Python dependencies for AI module
# ==========================================
FROM python:3.10-slim AS python-deps
WORKDIR /app

# Copy Python requirements
COPY ai/requirements.txt ./

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt && \
    pip install torch torchvision torchaudio --extra-index-url https://download.pytorch.org/whl/cpu

# ==========================================
# Stage 3: Build frontend assets
# ==========================================
FROM base AS frontend-builder
WORKDIR /app

# Copy frontend source code
COPY client ./client
COPY webpack.config.js .babelrc.js tsconfig.json ./

# Build frontend assets
RUN npm run build

# ==========================================
# Stage 4: Development stage
# ==========================================
FROM node:18-alpine AS development
WORKDIR /app

# Copy dependencies from base stage
COPY --from=base /app/node_modules ./node_modules

# Copy application files
COPY . .

# Development environment setup
ENV NODE_ENV=development
EXPOSE 3000
CMD ["npm", "run", "dev"]

# ==========================================
# Stage 5: Production stage
# ==========================================
FROM node:18-alpine AS production
WORKDIR /app

# Copy built assets and dependencies
COPY --from=base /app/node_modules ./node_modules
COPY --from=frontend-builder /app/client/dist ./client/dist
COPY --from=python-deps /usr/local/lib/python3.10/site-packages /usr/local/lib/python3.10/site-packages

# Install Python for AI module
RUN apk add --no-cache python3 py3-pip

# Copy application files (excluding development files)
COPY server ./server
COPY blockchain ./blockchain
COPY ai ./ai
COPY data ./data
COPY package.json server.js ./

# Setup environment
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -q --spider http://localhost:3000/api/health || exit 1

# Run application
CMD ["npm", "start"]

# ==========================================
# Stage 6: AI Inference Server
# ==========================================
FROM python:3.10-slim AS ai-inference
WORKDIR /app

# Copy Python dependencies
COPY --from=python-deps /usr/local/lib/python3.10/site-packages /usr/local/lib/python3.10/site-packages

# Copy AI module
COPY ai ./ai
COPY data/virtual ./data/virtual

# Expose inference API port
EXPOSE 5000

# Run inference server
CMD ["python", "ai/inference/server.py"]
