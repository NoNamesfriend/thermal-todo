<script>
  import { toasts } from "./stores.js";
  import { fly, fade } from "svelte/transition";
</script>

<div class="toast-wrapper" aria-live="polite" aria-atomic="true">
  {#each $toasts as t (t.id)}
    <div class="toast {t.type || 'info'}" in:fly={{ x: 20, y: -8 }} out:fade>
      {#if t.title}
        <div class="title">{t.title}</div>
      {/if}
      <div class="msg">{t.message}</div>
    </div>
  {/each}
</div>

<style>
  .toast-wrapper {
    position: fixed;
    right: 16px;
    top: 16px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    z-index: 10000;
  }

  .toast {
    min-width: 200px;
    max-width: 360px;
    padding: 10px 14px;
    border-radius: 8px;
    color: var(--text);
    box-shadow: 0 6px 18px var(--shadow-medium);
    font-size: 14px;
  }

  .toast.info {
    background: var(--accent-3);
  }
  .toast.success {
    background: var(--accent-4);
  }
  .toast.error {
    background: var(--accent-2);
  }

  .toast .title {
    font-weight: 700;
    margin-bottom: 4px;
  }
  .toast .msg {
    line-height: 1.2;
  }
</style>
