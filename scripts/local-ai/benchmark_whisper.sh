#!/usr/bin/env bash
# Temporary CPU-only benchmark. No published ports or network access.
set -euo pipefail
root=$(realpath "${1:?Provide benchmark root containing audio and whisper-models}")
out="$root/whisper-results"
mkdir -p "$out"
image=ghcr.io/ggml-org/whisper.cpp@sha256:7a4e5f481192899f6c3853ff181ea6347b219ca2f388e1d84870b84ad80f6b7f
name=thermal-todo-whisper-benchmark-20261023
if docker container inspect "$name" >/dev/null 2>&1; then
  echo 'Benchmark container already exists; refusing to replace it' >&2
  exit 1
fi
cleanup() { docker rm -f "$name" >/dev/null 2>&1 || true; }
trap cleanup EXIT INT TERM
cat /proc/cpuinfo > "$out/cpuinfo.txt"
cat /proc/meminfo > "$out/memory-before.txt"
docker image inspect "$image" > "$out/image.json"
for model in ${BENCHMARK_MODELS:-tiny base base-q5_1 small-q5_1}; do
  directory="$out/$model"
  mkdir -p "$directory"
  begin=$(date +%s%N)
  docker run -d --name "$name" --network none --cpus 2 --memory 1g --memory-swap 1g \
    --read-only --tmpfs /tmp:rw,noexec,nosuid,size=64m \
    -v "$root/whisper-models:/models:ro" -v "$root/audio:/fixtures:ro" \
    --entrypoint whisper-server "$image" -m "/models/ggml-$model.bin" \
    --host 127.0.0.1 --port 8080 -l de -t 2 -ng -bs 1 -bo 1 >/dev/null
  ready=0
  for attempt in $(seq 1 60); do
    if docker exec "$name" curl --fail --silent http://127.0.0.1:8080/health >/dev/null 2>&1; then ready=1; break; fi
    sleep 0.25
  done
  if [ "$ready" -ne 1 ]; then docker logs "$name"; exit 1; fi
  finish=$(date +%s%N)
  echo "$((finish-begin))" > "$directory/start-to-ready-ns.txt"
  docker exec "$name" cat /proc/1/status > "$directory/process-ready.txt"
  # Measure preparation and request together, including docker-exec overhead.
  for round in 1 2; do
    for fixture in ${BENCHMARK_FIXTURES:-phrase-1 phrase-2 phrase-3 phrase-4 phrase-5 phrase-6 phrase-7 phrase-8 phrase-9 noise silence}; do
      begin=$(date +%s%N)
      docker exec "$name" ffmpeg -y -hide_banner -loglevel error \
        -i "/fixtures/$fixture.webm" -t 10 \
        -af 'silenceremove=start_periods=1:start_threshold=-35dB,areverse,silenceremove=start_periods=1:start_threshold=-35dB,areverse,loudnorm' \
        -ac 1 -ar 16000 -c:a pcm_s16le /tmp/clean.wav
      prepared=$(date +%s%N)
      # An empty preparation result is a valid no-speech outcome.
      bytes=$(docker exec "$name" stat -c %s /tmp/clean.wav)
      if [ "$bytes" -gt 80 ]; then
        docker exec "$name" curl --fail --silent --show-error http://127.0.0.1:8080/inference \
          -F file=@/tmp/clean.wav -F response_format=json -F language=de -F temperature=0 \
          > "$directory/$fixture-$round.json"
      else
        printf '{"text":"","no_speech_preprocessing":true}\n' > "$directory/$fixture-$round.json"
      fi
      finish=$(date +%s%N)
      printf '%s,%s,%s,%s,%s\n' "$fixture" "$round" "$((prepared-begin))" "$((finish-prepared))" "$((finish-begin))" >> "$directory/timings.csv"
      printf '%s %s round=%s total_ms=%s\n' "$model" "$fixture" "$round" "$(((finish-begin)/1000000))"
    done
  done
  docker exec "$name" cat /proc/1/status > "$directory/process-after.txt"
  docker exec "$name" sh -c 'for f in /sys/fs/cgroup/memory.current /sys/fs/cgroup/memory.peak /sys/fs/cgroup/memory.stat /sys/fs/cgroup/memory/memory.usage_in_bytes /sys/fs/cgroup/memory/memory.max_usage_in_bytes; do if [ -f "$f" ]; then echo "$f"; cat "$f"; fi; done' > "$directory/cgroup-memory.txt"
  docker logs "$name" > "$directory/server.log" 2>&1
  cleanup
done
