// Live API benchmark: only synthetic fixture tasks, never user recordings or keys in output.
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluateIcon } from '../../service/ai.js';
import { getIconCapabilities } from '../../service/icon-provider.js';

const args = process.argv.slice(2);
const option = (name, fallback) => args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
const providers = option('--providers', 'mini,luna,jev').split(',');
const limit = Number(option('--limit', '65'));
if (!Number.isInteger(limit) || limit < 1 || limit > 65) throw new Error('--limit must be between 1 and 65');
if (!providers.length || providers.some(p => !['mini', 'luna', 'jev'].includes(p)) || new Set(providers).size !== providers.length) {
  throw new Error('--providers must contain unique values from mini,luna,jev');
}
const available = getIconCapabilities();
for (const provider of providers) if (!available[provider]) throw new Error(`Missing server-side credential for ${provider}`);
const cases = JSON.parse(await readFile(new URL('./tasks.de.json', import.meta.url), 'utf8')).slice(0, limit);
const report = { createdAt: new Date().toISOString(), protocol: 'Unchanged synthetic German tasks; same 20 icon descriptions; no tuning; no retries; sequential live requests.', providers: {} };
const output = resolve(option('--output', resolve(dirname(fileURLToPath(import.meta.url)), '../../docs/local-ai/icon-comparison.json')));
const save = async () => { await mkdir(dirname(output), { recursive: true }); await writeFile(output, JSON.stringify(report, null, 2) + '\n'); };

for (const provider of providers) {
  const rows = [];
  report.providers[provider] = { results: rows };
  let consecutiveErrors = 0;
  for (const item of cases) {
    const started = performance.now();
    try {
      const result = await evaluateIcon(item.task, provider);
      rows.push({ ...item, ...result, seconds: (performance.now() - started) / 1000, correct: item.expected.includes(result.icon) });
      consecutiveErrors = 0;
    } catch (error) {
      rows.push({ ...item, seconds: (performance.now() - started) / 1000, error: error.code || 'ICON_REQUEST_FAILED', correct: false });
      consecutiveErrors++;
      if (['ICON_AUTH_FAILED', 'ICON_CREDIT_REQUIRED'].includes(error.code) || consecutiveErrors >= 3) break;
    }
    console.log(`${provider}: ${rows.length}/${cases.length}`);
    await save();
  }
  const clear = rows.filter(row => !row.ambiguous);
  const ambiguous = rows.filter(row => row.ambiguous);
  const latencies = rows.filter(row => !row.error).map(row => row.seconds).sort((a,b) => a-b);
  Object.assign(report.providers[provider], {
    clearCorrect: clear.filter(row => row.correct).length, clearAttempted: clear.length,
    ambiguousCorrect: ambiguous.filter(row => row.correct).length, ambiguousAttempted: ambiguous.length,
    errors: rows.filter(row => row.error).length, plannedCases: cases.length,
    inputTokens: rows.reduce((sum, row) => sum + (row.metadata?.inputTokens || 0), 0),
    outputTokens: rows.reduce((sum, row) => sum + (row.metadata?.outputTokens || 0), 0),
    medianSeconds: latencies.length ? (latencies[Math.floor((latencies.length-1)/2)] + latencies[Math.floor(latencies.length/2)]) / 2 : null,
    p95Seconds: latencies.length ? latencies[Math.min(latencies.length - 1, Math.floor(latencies.length * 0.95))] : null,
  });
  await save();
  console.log(JSON.stringify({ provider, ...Object.fromEntries(Object.entries(report.providers[provider]).filter(([key]) => key !== 'results')) }));
}
