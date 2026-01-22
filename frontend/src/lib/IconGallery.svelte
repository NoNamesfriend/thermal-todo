<script>
  import { ICONS } from "./icons.js";
  import Icon from "@iconify/svelte";
</script>

<section style="margin-top:1rem">
  <h3>Icon Gallery</h3>
  <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:8px;align-items:center;">
    {#each Object.entries(ICONS) as [key, name]}
      <div
        style="display:flex;flex-direction:column;align-items:center;padding:8px;border:1px solid var(--muted);border-radius:8px;"
      >
        <Icon icon={name} width="28" height="28" />
        <div style="margin-top:6px;font-size:12px;color:var(--muted)">{key}</div>
        <div style="font-size:11px;color:var(--muted)">{name}</div>
      </div>
    {/each}
  </div>
</section>
