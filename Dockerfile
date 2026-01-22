# Multi-stage build: build frontend and run service in one container with system ffmpeg

FROM node:20-bullseye AS build
WORKDIR /app

# Install frontend deps and build
COPY frontend/package.json frontend/package-lock.json* ./frontend/
RUN npm ci --prefix frontend
COPY frontend/ ./frontend/
RUN npm run build --prefix frontend

# Install service dependencies
COPY service/package.json service/package-lock.json* ./service/
RUN npm ci --prefix service --production
COPY service/ ./service/

# Final image based on node with ffmpeg installed
FROM node:20-bullseye
WORKDIR /usr/src/app

# install ffmpeg
RUN apt-get update && apt-get install -y ffmpeg && rm -rf /var/lib/apt/lists/*

# copy service code
COPY --from=build /app/service/ ./

# copy built frontend into service public folder
COPY --from=build /app/frontend/dist ./public

ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "index.js"]
