<script lang="ts">
  import Icon from "@iconify/svelte";
  import { apiBase } from "./stores.js";
  import { ICONS } from "./icons.js";
  export let task: string;
  let timeout;
  let iconKey: string = "other"; // Fallback

  $: if (task) {
    clearTimeout(timeout);
    timeout = setTimeout(loadIcon, 500);
  }

  async function loadIcon() {
    try {
      const result = await fetchIcon(task);
      iconKey = result?.icon ?? "other";
    } catch (e) {
      console.error(e);
    }
  }

  import { showToast } from "./stores.js";

  async function fetchIcon(task) {
    try {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(`${$apiBase}/icon-suggest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task }),
        signal: controller.signal,
      });
      clearTimeout(id);
      if (!res.ok) {
        const txt = await res.text();
        console.error("icon-suggest failed", res.status, txt);
        showToast("error", "Icon suggestion failed");
        return null;
      }
      return res.json();
    } catch (e) {
      console.error("icon-suggest error", e);
      showToast("error", "Icon suggestion failed");
      return null;
    }
  }
</script>

<p class="task-item">
  <span class="task-icon">
    <Icon icon={ICONS[iconKey]} />
  </span>
  {task}
</p>

<style>
  .task-item {
    text-align: center;
    font-weight: 600;
  }

  .task-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    vertical-align: middle;
  }

  .task-icon :global(svg) {
    width: 20px;
    height: 20px;
  }
</style>
