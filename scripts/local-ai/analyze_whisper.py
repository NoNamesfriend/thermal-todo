"""Summarize saved Whisper measurements without making inference requests."""
import argparse
import csv
import json
from pathlib import Path
import re
import statistics

parser = argparse.ArgumentParser()
parser.add_argument('--results', type=Path, required=True)
parser.add_argument('--output', type=Path, required=True)
args = parser.parse_args()
fixtures = {r['id']: r for name in ['speech.de.json', 'human-speech.de.json']
            for r in json.loads((Path(__file__).parent / name).read_text(encoding='utf-8-sig'))}
fixtures['phrase-9'] = {**fixtures['phrase-8'], 'id': 'phrase-9', 'rate': -3}
fixtures['noise'] = {**fixtures['phrase-4'], 'id': 'noise', 'noise': 'seed=42, amplitude=0.01'}
fixtures['silence'] = {'id': 'silence', 'text': ''}

def tokens(text):
    return re.findall(r'\w+', text.casefold(), re.UNICODE)

def distance(a, b):
    row = list(range(len(b) + 1))
    for i, word in enumerate(a, 1):
        nxt = [i]
        for j, actual in enumerate(b, 1):
            nxt.append(min(nxt[-1] + 1, row[j] + 1, row[j-1] + (word != actual)))
        row = nxt
    return row[-1]

report = {'measurement': 'Unraid CPU-only; two threads, two CPU quota; preprocessing and docker-exec overhead included; network upload excluded', 'models': {}}
for directory in sorted((args.results / 'whisper-results').iterdir()):
    if not directory.is_dir():
        continue
    rows = []
    for fixture, round_, prep, request, total in csv.reader((directory / 'timings.csv').open()):
        text = json.loads((directory / f'{fixture}-{round_}.json').read_text(encoding='utf-8'))['text'].strip()
        ref = fixtures[fixture]['text']
        expected = tokens(ref)
        rows.append({'fixture': fixture, 'round': int(round_), 'seconds': int(total)/1e9,
                     'preparation_seconds': int(prep)/1e9, 'request_seconds': int(request)/1e9,
                     'reference': ref, 'text': text, 'word_errors': distance(expected, tokens(text)),
                     'reference_words': len(expected)})
    spoken = [r for r in rows if r['fixture'] != 'silence']
    stats = {name: {'median_seconds': statistics.median(r['seconds'] for r in subset),
                    'max_seconds': max(r['seconds'] for r in subset),
                    'word_errors': sum(r['word_errors'] for r in subset),
                    'reference_words': sum(r['reference_words'] for r in subset)}
             for name, subset in [('all_speech', spoken),
                                  ('synthetic', [r for r in spoken if not r['fixture'].startswith('human')]),
                                  ('human', [r for r in spoken if r['fixture'].startswith('human')])] if subset}
    status = (directory / 'process-after.txt').read_text(encoding='utf-8')
    memory = {key: int(re.search(rf'^{key}:\s+(\d+)', status, re.M)[1]) * 1024
              for key in ['VmRSS', 'VmHWM']}
    cg = [int(x) for x in (directory / 'cgroup-memory.txt').read_text(encoding='utf-8').splitlines() if x.isdigit()]
    report['models'][directory.name] = {'statistics': stats,
        'last_start_to_ready_seconds': int((directory / 'start-to-ready-ns.txt').read_text(encoding='utf-8'))/1e9,
        'server_memory_bytes': memory, 'cgroup_current_and_peak_bytes': cg[:2], 'requests': rows}
report['cold'] = {}
for directory in sorted((args.results / 'whisper-cold-results').iterdir()):
    rows = []
    for fixture, ns in csv.reader((directory / 'timings.csv').open()):
        log = (directory / f'{fixture}.log').read_text(encoding='utf-8')
        peak = re.search(r'CONTAINER_MEMORY_PEAK_BYTES=(\d+)', log)
        transcript = re.search(r'main: processing [^\n]+\n(.*)', log, re.S)
        # stdout may flush after stderr timings, including without a final newline.
        text = re.sub(r'whisper_print_timings:[^\n]*|CONTAINER_MEMORY_PEAK_BYTES=\d+',
                      '', transcript[1]).strip() if transcript else ''
        if not transcript and fixture != 'silence':
            raise ValueError(f'CLI transcript missing: {directory.name}/{fixture}')
        ref = fixtures[fixture]['text']
        rows.append({'fixture': fixture, 'seconds': int(ns)/1e9,
                     'container_memory_peak_bytes': int(peak[1]) if peak else None,
                     'text': text, 'reference': ref,
                     'word_errors': distance(tokens(ref), tokens(text)),
                     'reference_words': len(tokens(ref))})
    report['cold'][directory.name] = {'max_seconds': max(r['seconds'] for r in rows), 'requests': rows}
args.output.parent.mkdir(parents=True, exist_ok=True)
args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2)+'\n',encoding='utf-8')
print(json.dumps({k: {n: {a:b for a,b in v.items() if a != 'requests'} for n,v in value.items()}
                  if isinstance(value, dict) else value for k,value in report.items()}, indent=2))
