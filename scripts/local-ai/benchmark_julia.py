"""Measure a locally downloaded Julia checkpoint; never calls an inference API."""
import argparse
import hashlib
import importlib.metadata
import json
import os
from pathlib import Path
import platform
import statistics
import sys
import threading
import time

parser = argparse.ArgumentParser()
parser.add_argument('--model', type=Path, required=True)
parser.add_argument('--output', type=Path, required=True)
parser.add_argument('--threads', type=int, default=2)
args = parser.parse_args()
os.environ.update(OMP_NUM_THREADS=str(args.threads), MKL_NUM_THREADS=str(args.threads),
                  JULIA_CPU_THREADS=str(args.threads), HF_HUB_OFFLINE='1',
                  TRANSFORMERS_OFFLINE='1', USE_TF='0', TOKENIZERS_PARALLELISM='false')

import psutil
process = psutil.Process()
peak_rss = 0
stopped = threading.Event()

def sample():
    global peak_rss
    while not stopped.is_set():
        peak_rss = max(peak_rss, process.memory_info().rss)
        stopped.wait(0.01)

threading.Thread(target=sample, daemon=True).start()
started = time.perf_counter()
sys.path.insert(0, str(args.model.resolve()))
import torch
from julia import load_model

torch.set_num_threads(args.threads)
torch.set_num_interop_threads(1)
engine = load_model(str(args.model), device='cpu', max_length=1024, head_length=512,
                    strict_encoding=True, backend='torch', batch_size=1)
loaded = time.perf_counter()
root = Path(__file__).parent
criteria = json.loads((root / 'icons.json').read_text(encoding='utf-8-sig'))
cases = json.loads((root / 'tasks.de.json').read_text(encoding='utf-8-sig'))
question = {'icon': {'type': 'choice', 'instructions': 'Which category best describes this task?',
                     'criteria': criteria}}

def predict(task):
    return engine.predict(state=task, questions=question)['answers']['icon']

first_started = time.perf_counter()
first = predict('Milch einkaufen')
first_seconds = time.perf_counter() - first_started
results = []
for case in cases:
    start = time.perf_counter()
    prediction = predict(case['task'])
    results.append({**case, 'prediction': prediction, 'seconds': time.perf_counter() - start,
                    'correct': prediction['choice'] in case['expected']})
    print(json.dumps({'id': case['id'], 'choice': prediction['choice'], 'correct': results[-1]['correct'],
                      'seconds': results[-1]['seconds']}), flush=True)

rss_loaded = process.memory_info().rss
idle_cpu_start = process.cpu_times()
time.sleep(3)
idle_cpu_end = process.cpu_times()
stopped.set()
latencies = sorted(row['seconds'] for row in results)
clear = [row for row in results if not row.get('ambiguous')]
report = {
    'platform': platform.platform(), 'python': sys.version, 'cpu': platform.processor(),
    'threads': args.threads, 'torch': torch.__version__,
    'transformers': importlib.metadata.version('transformers'),
    'model_weights_sha256': hashlib.sha256((args.model / 'model.safetensors').read_bytes()).hexdigest(),
    'protocol': 'Hand-authored synthetic German tasks; incumbent category descriptions; no tuning on results.',
    'load_seconds_including_imports': loaded - started,
    'first_inference_seconds': first_seconds, 'cold_to_first_result_seconds': loaded - started + first_seconds,
    'first_prediction': first, 'warm_median_seconds': statistics.median(latencies),
    'warm_p95_seconds': latencies[min(len(latencies)-1, int(len(latencies)*0.95))],
    'warm_max_seconds': max(latencies), 'rss_after_requests_bytes': rss_loaded,
    'sampled_peak_rss_bytes': peak_rss,
    'idle_cpu_seconds_over_3_seconds': (idle_cpu_end.user + idle_cpu_end.system - idle_cpu_start.user - idle_cpu_start.system),
    'clear_correct': sum(row['correct'] for row in clear), 'clear_total': len(clear),
    'results': results,
}
args.output.parent.mkdir(parents=True, exist_ok=True)
args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps({key: value for key, value in report.items() if key != 'results'}, indent=2), flush=True)
