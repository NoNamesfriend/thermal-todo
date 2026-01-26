<script>
  import html2canvas from "html2canvas";
  import { apiBase, showToast } from "./stores.js";
  import Icon from "@iconify/svelte";
  import { onMount } from "svelte";

  let loading = false;

  async function print() {
    loading = true;
    try {
      const element = document.getElementById("print-area");
      if (!element) {
        console.warn("print-area element not found");
        showToast("error", "Print area not found");
        return;
      }

      const canvas = await html2canvas(element, { backgroundColor: "white", scale: 2 });
      const image = canvas.toDataURL("image/png");

      const res = await fetch(`${$apiBase}/print`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image }),
      });

      if (!res.ok) {
        console.warn("print request failed", res.status);
        showToast("error", "Print request failed");
      } else {
        showToast("success", "Print sent");
      }
    } catch (err) {
      console.error("print failed", err);
      showToast("error", "Print failed");
    } finally {
      loading = false;
    }
  }
</script>

<button class="btn-gradient" on:click={print} disabled={loading} aria-busy={loading}>
  {#if loading}
    <span class="spinner" aria-hidden="true"></span>
    Wird gedruckt
  {:else}
    <Icon icon="fluent:print-24-regular" />
    Drucken
  {/if}
</button>

<style>
  .btn-gradient {
    display: grid;
    grid-auto-flow: column;
    place-items: center;
    place-content: center;
    gap: 8px;
    padding: 12px 28px;
    font-family: var(--font-family);
    font-size: 16px;
    font-weight: bold;
    color: var(--bg-base);
    border: none;
    border-radius: 8px;
    cursor: pointer;
    background: linear-gradient(45deg, var(--accent-1), var(--accent-2), var(--accent-3), var(--accent-4));
    background-size: 300% 300%;
    transition:
      background-position 1s ease,
      transform 0.2s ease;
    box-shadow: 0 4px 12px var(--shadow-medium);
  }

  .btn-gradient:hover {
    background-position: 100% 0;
    transform: translateY(-2px);
  }

  button:disabled {
    opacity: 0.7;
    cursor: wait;
    transform: none;
    pointer-events: none;
  }

  .spinner {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    border: 2px solid rgba(255, 255, 255, 0.25);
    border-top-color: rgba(255, 255, 255, 0.95);
    animation: spin 0.8s linear infinite;
    display: inline-block;
    vertical-align: middle;
    margin-right: 8px;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
