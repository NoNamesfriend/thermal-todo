<script>
  import { createEventDispatcher } from 'svelte';
  import { t } from './i18n.js';

  export let speech;
  export let provider;
  export let icons;
  export let iconProvider;
  const dispatch = createEventDispatcher();
  let dialog;
  let draft;
  let iconDraft;
  export function open() {
    draft = provider;
    iconDraft = iconProvider;
    dialog.showModal();
  }
  function save() {
    if ((speech.defaultProvider && !speech[draft]) || !icons[iconDraft]) return;
    dispatch('save', { provider: draft, iconProvider: iconDraft });
    dialog.close();
  }
</script>

<dialog bind:this={dialog} aria-labelledby="settings-title" aria-describedby="settings-scope">
  <form on:submit|preventDefault={save}>
    <h2 id="settings-title">{$t('settings')}</h2>
    <fieldset>
      <legend>{$t('speech_recognition')}</legend>
      <label class:unavailable={!speech.local}>
        <input type="radio" name="speech-provider" value="local" bind:group={draft} disabled={!speech.local} />
        <span><strong>{$t('speech_local')}</strong><small>{$t(speech.local ? 'speech_local_description' : 'speech_local_unavailable')}</small></span>
      </label>
      <label class:unavailable={!speech.openai}>
        <input type="radio" name="speech-provider" value="openai" bind:group={draft} disabled={!speech.openai} />
        <span><strong>OpenAI Whisper</strong><small>{$t(speech.openai ? 'speech_openai_description' : 'speech_key_required')}</small></span>
      </label>
    </fieldset>
    <fieldset>
      <legend>{$t('icon_recognition')}</legend>
      <label class="icon-selection" for="icon-provider">{$t('icon_model')}</label>
      <select id="icon-provider" bind:value={iconDraft} aria-describedby="icon-provider-description">
        <option value="none">{$t('icon_none')}</option>
        <option value="mini" disabled={!icons.mini}>GPT-4.1 mini{!icons.mini ? ` · ${$t('openai_key_missing')}` : ''}</option>
        <option value="luna" disabled={!icons.luna}>GPT-6 Luna{!icons.luna ? ` · ${$t('openai_key_missing')}` : ''}</option>
        <option value="jev" disabled={!icons.jev}>Jev (TypeSafe){!icons.jev ? ` · ${$t('jev_key_missing')}` : ''}</option>
      </select>
      <p id="icon-provider-description">{$t(iconDraft === 'none' ? 'icon_none_description' : iconDraft === 'jev' ? 'icon_jev_description' : 'icon_openai_description')}</p>
      {#if iconDraft !== 'none' && !icons[iconDraft]}<p role="status">{$t('icon_provider_unavailable')}</p>{/if}
    </fieldset>
    <p id="settings-scope">{$t('settings_independent')}</p>
    <div class="actions">
      <button type="button" on:click={() => dialog.close()}>{$t('cancel')}</button>
      <button class="primary" type="submit" disabled={(!!speech.defaultProvider && !speech[draft]) || !icons[iconDraft]}>{$t('save')}</button>
    </div>
  </form>
</dialog>

<style>
  dialog { width: min(420px, calc(100% - 32px)); max-height: calc(100svh - 32px); padding: 24px;
    border: 1px solid var(--border); border-radius: 12px; color: var(--text); background: var(--bg-base); }
  dialog::backdrop { background: #0008; }
  form { display: flex; flex-direction: column; gap: 24px; }
  h2 { margin: 0; font-size: 20px; }
  fieldset { min-width: 0; margin: 0; padding: 0; border: 0; }
  legend { margin-bottom: 12px; font-weight: 700; font-size: 14px; }
  label { display: flex; align-items: flex-start; gap: 12px; padding: 12px 0; cursor: pointer; font-weight: 400; }
  input { flex-shrink: 0; width: 20px; height: 20px; margin: 1px 0 0; accent-color: var(--action); }
  .icon-selection { padding: 0; margin-bottom: 8px; font-size: 12px; }
  select { width: 100%; min-height: 44px; padding: 10px 8px; font: inherit; font-size: 14px;
    color: var(--text); background: var(--bg-base); border: 1px solid var(--border); border-radius: 6px; }
  #icon-provider-description { margin-top: 8px; }
  span { min-width: 0; }
  strong { display: block; font-size: 14px; line-height: 1.5; }
  small, p { display: block; color: var(--muted); font-size: 12px; line-height: 1.6; }
  small { margin-top: 4px; }
  p { margin: 0; }
  .unavailable { cursor: not-allowed; }
  .actions { display: flex; justify-content: flex-end; gap: 12px; }
  button { min-height: 44px; padding: 10px 12px; border: 1px solid var(--border); border-radius: 6px;
    font: inherit; font-size: 14px; cursor: pointer; background: var(--bg-base); color: var(--text); }
  button:hover { background: var(--bg-boost); }
  button.primary { background: var(--action); color: var(--bg-base); border-color: var(--action); }
  button.primary:hover { filter: brightness(0.9); }
  button:disabled { opacity: 0.6; cursor: not-allowed; }
</style>
