<script>
  import { onDestroy } from 'svelte';
  import { apiBase, showToast } from './stores.js';
  import { t } from './i18n.js';
  import FluentIcon from './FluentIcon.svelte';
  export let task;
  export let provider;
  export let loading = false;
  let iconKey = 'other';
  let timeout;
  let controller;
  let generation = 0;

  $: scheduleIcon(task, provider);
  function scheduleIcon(value, selectedProvider) {
    clearTimeout(timeout);
    controller?.abort();
    const current = ++generation;
    iconKey = 'other';
    loading = !!value.trim();
    if (loading) timeout = setTimeout(() => loadIcon(value, selectedProvider, current), 500);
  }
  async function loadIcon(value, selectedProvider, current) {
    const request = new AbortController();
    controller = request;
    const deadline = setTimeout(() => request.abort('timeout'), 8000);
    try {
      const res = await fetch(`${$apiBase}/icon-suggest`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task: value, provider: selectedProvider }), signal: request.signal,
      });
      if (!res.ok) {
        const problem = await res.json().catch(() => ({}));
        throw Object.assign(new Error('Icon suggestion failed'), { code: problem.code });
      }
      const result = await res.json();
      if (current === generation) iconKey = result?.icon ?? 'other';
    } catch (error) {
      const message = { ICON_AUTH_FAILED: 'icon_auth_failed', ICON_CREDIT_REQUIRED: 'icon_credit_required',
        ICON_RATE_LIMITED: 'icon_busy', ICON_TIMEOUT: 'icon_timeout' }[error.code] || 'icon_suggest_failed';
      if (current === generation) showToast('error', $t(message));
    } finally {
      clearTimeout(deadline);
      if (current === generation) loading = false;
    }
  }
  onDestroy(() => {
    generation++;
    clearTimeout(timeout);
    controller?.abort();
    loading = false;
  });
</script>
<div class="task-item">
  <span class="task-icon" aria-hidden="true"><FluentIcon name={iconKey} /></span>
  <span class="task-text">{task}</span>
</div>
<style>
  .task-item { display: grid; grid-template-columns: 20px minmax(0, 1fr); align-items: start; gap: 8px; font-weight: 600; }
  .task-icon { display: flex; padding-top: 1px; }
</style>
