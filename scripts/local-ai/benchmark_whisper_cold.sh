#!/usr/bin/env bash
set -euo pipefail
root=$(realpath "${1:?Benchmark root}")
image=ghcr.io/ggml-org/whisper.cpp@sha256:7a4e5f481192899f6c3853ff181ea6347b219ca2f388e1d84870b84ad80f6b7f
name=thermal-todo-whisper-cold-20261023
if docker container inspect "$name" >/dev/null 2>&1; then echo 'Container exists' >&2; exit 1; fi
trap 'docker rm -f "$name" >/dev/null 2>&1 || true' EXIT INT TERM
out="$root/whisper-cold-results"
mkdir -p "$out"
for model in ${BENCHMARK_MODELS:-tiny base-q5_1}; do
 mkdir -p "$out/$model"
 for fixture in ${BENCHMARK_FIXTURES:-phrase-1 phrase-4 phrase-8 phrase-9 noise silence}; do
  begin=$(date +%s%N)
  docker run --rm --name "$name" --network none --cpus 2 --memory 1g --memory-swap 1g \
   --read-only --tmpfs /tmp:rw,noexec,nosuid,size=64m \
   -v "$root/whisper-models:/models:ro" -v "$root/audio:/fixtures:ro" \
   --entrypoint sh "$image" -c '
    ffmpeg -y -hide_banner -loglevel error -i "/fixtures/$2.webm" -t 10 \
     -af "silenceremove=start_periods=1:start_threshold=-35dB,areverse,silenceremove=start_periods=1:start_threshold=-35dB,areverse,loudnorm" \
     -ac 1 -ar 16000 -c:a pcm_s16le /tmp/clean.wav
    if [ "$(stat -c %s /tmp/clean.wav)" -gt 80 ]; then
     whisper-cli -m "/models/ggml-$1.bin" -f /tmp/clean.wav -l de -t 2 -ng -bs 1 -bo 1 -nt
    fi
    for f in /sys/fs/cgroup/memory.peak /sys/fs/cgroup/memory/memory.max_usage_in_bytes; do
     if [ -f "$f" ]; then echo "CONTAINER_MEMORY_PEAK_BYTES=$(cat "$f")"; fi
    done
   ' benchmark "$model" "$fixture" > "$out/$model/$fixture.log" 2>&1
  finish=$(date +%s%N)
  printf '%s,%s\n' "$fixture" "$((finish-begin))" >> "$out/$model/timings.csv"
  printf 'cold %s %s total_ms=%s\n' "$model" "$fixture" "$(((finish-begin)/1000000))"
 done
done
