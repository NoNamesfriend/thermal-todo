# Compile the exact whisper.cpp source used in the Unraid benchmark.
FROM node:24.22.1-bookworm-slim AS whisper-build
ARG WHISPER_REVISION=231638a0717b7822784297e5980965ffcec05810
RUN apt-get update && apt-get install -y --no-install-recommends build-essential cmake curl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /whisper
RUN curl -fsSL "https://codeload.github.com/ggml-org/whisper.cpp/tar.gz/${WHISPER_REVISION}" | tar -xz --strip-components=1 \
    && cmake -B build -DCMAKE_BUILD_TYPE=Release -DGGML_NATIVE=OFF -DBUILD_SHARED_LIBS=OFF -DWHISPER_BUILD_TESTS=OFF -DWHISPER_BUILD_SERVER=OFF \
    && cmake --build build --config Release --target whisper-cli -j 2
RUN curl -fsSL --retry 3 "https://huggingface.co/ggerganov/whisper.cpp/resolve/5359861c739e955e79d9a303bcbc70fb988958b1/ggml-base.bin" -o ggml-base.bin \
    && echo "60ed5bc3dd14eea856493d334349b405782ddcaf0028d4b5df4088345fba2efe  ggml-base.bin" | sha256sum -c -

# Build frontend and run service in one container with system ffmpeg.

FROM node:24.22.1-bookworm-slim AS build
WORKDIR /app

# Install frontend deps and build
COPY frontend/package.json frontend/package-lock.json* ./frontend/
RUN npm ci --prefix frontend
COPY frontend/ ./frontend/
RUN npm run build --prefix frontend

# Install service dependencies
COPY service/package.json service/package-lock.json* ./service/
RUN npm ci --prefix service --omit=dev
# Copy executable sources explicitly so local settings or credentials cannot enter the image.
COPY service/*.js ./service/

# Final image based on node with ffmpeg installed
FROM node:24.22.1-bookworm-slim
WORKDIR /usr/src/app

# install ffmpeg
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg libgomp1 && rm -rf /var/lib/apt/lists/*
COPY --from=whisper-build /whisper/build/bin/whisper-cli /usr/local/bin/whisper-cli
COPY --from=whisper-build /whisper/ggml-base.bin /opt/whisper/ggml-base.bin
COPY --from=whisper-build /whisper/LICENSE /usr/share/licenses/whisper.cpp/LICENSE
COPY licenses/whisper-model.txt /usr/share/licenses/whisper-model/LICENSE

# copy service code
COPY --from=build /app/service/ ./

# copy built frontend into service public folder
COPY --from=build /app/frontend/dist ./public

# Healthcheck to monitor if the service is running
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD node -e "fetch('http://localhost:'+(process.env.PORT||3000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "index.js"]
