<script>
  import { toasts } from './stores.js';
</script>
<div class="toast-wrapper" aria-live="polite" aria-relevant="additions">
  {#each $toasts as toast (toast.id)}
    <div class="toast {toast.type || 'info'}">{toast.message}</div>
  {/each}
</div>
<style>
  .toast-wrapper { position: fixed; inset: 16px 16px auto auto; display: flex; flex-direction: column; gap: 8px; z-index: 10; max-width: min(360px, calc(100vw - 32px)); pointer-events: none; }
  .toast { padding: 14px 16px; border-radius: 8px; color: var(--bg-base); background: var(--action); box-shadow: 0 6px 18px var(--shadow-medium); font-size: 14px; line-height: 1.5; overflow-wrap: anywhere; }
  .toast.success { background: var(--success); }
  .toast.error { background: var(--error); }
</style>
