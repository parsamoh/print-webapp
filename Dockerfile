# Build Stage for Frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend ./
RUN npm run build

# Build Stage for Backend
FROM node:20-alpine AS backend-builder
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci
COPY backend ./
RUN npm run build

# Production Stage
FROM node:20-alpine AS production
WORKDIR /app

# Install production dependencies for backend
COPY backend/package*.json ./
RUN npm ci --omit=dev

# Copy built artifacts
COPY --from=backend-builder /app/backend/dist ./backend/dist
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Copy supporting files
COPY backend/.env.example ./.env
COPY backend/package.json ./backend/package.json

# Create directories
RUN mkdir -p uploads temp

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV UPLOAD_DIR=/app/uploads
ENV TEMP_DIR=/app/temp

# Install CUPS client libraries (if needed generally, though 'ipp' package is pure JS)
# RUN apk add --no-cache cups-client

EXPOSE 3000

CMD ["node", "backend/dist/server.js"]
