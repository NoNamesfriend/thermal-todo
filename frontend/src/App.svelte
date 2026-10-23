<script>
  import TaskItem from './lib/TaskItem.svelte';
  import PrintButton from './lib/PrintButton.svelte';
  import Toast from './lib/Toast.svelte';
  import FluentIcon from './lib/FluentIcon.svelte';
  import SettingsDialog from './lib/SettingsDialog.svelte';
  import { showToast } from './lib/stores.js';
  import { onMount, onDestroy, tick } from 'svelte';
  import { t, locale } from './lib/i18n.js';

  let icons = { mini: false, luna: false, jev: false, none: true, defaultProvider: 'none' };
  let iconProvider = 'none';
  const iconPreferenceKey = 'thermal-todo.icon-provider';
  $: iconEnabled = iconProvider !== 'none' && !!icons[iconProvider];
  let configLoading = true;
  let taskText = '';
  let textareaEl;
  let state = 'idle';
  let mediaRecorder;
  let stream;
  let stopTimeout;
  let wantsRecording = false;
  let destroyed = false;
  let iconLoading = false;
  let recordingSupported = false;
  let speech = { local: false, openai: false, defaultProvider: null };
  let speechProvider = null;
  let settingsDialog;
  const preferenceKey = 'thermal-todo.speech-provider';
  $: speechEnabled = !!speech[speechProvider];
  const configController = new AbortController();
  let transcriptionController;

  onMount(async () => {
    recordingSupported = !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined';
    const timeout = setTimeout(() => configController.abort(), 10_000);
    try {
      const res = await fetch('/config', { signal: configController.signal });
      if (!res.ok) throw new Error('Config unavailable');
      const data = await res.json();
      icons = data.icons || icons;
      let savedIcon;
      try { savedIcon = localStorage.getItem(iconPreferenceKey); } catch {}
      iconProvider = ['mini', 'luna', 'jev', 'none'].includes(savedIcon) ? savedIcon : icons.defaultProvider;
      speech = data.speech || speech;
      let saved;
      try { saved = localStorage.getItem(preferenceKey); } catch {}
      // Preserve an explicit choice even if unavailable; never silently switch to cloud.
      speechProvider = ['local', 'openai'].includes(saved) ? saved : speech.defaultProvider;
      if (Number.isFinite(data.labelWidthMm) && data.labelWidthMm > 0) {
        document.documentElement.style.setProperty('--label-width-mm', `${data.labelWidthMm}mm`);
        document.documentElement.style.setProperty('--label-width-px', `${data.labelWidthMm * 96 / 25.4}px`);
      }
    } catch (error) {
      if (!destroyed) showToast('error', $t('config_failed'));
    } finally {
      clearTimeout(timeout);
      configLoading = false;
      resizeTextarea();
    }
  });

  function saveSettings(event) {
    speechProvider = event.detail.provider;
    iconProvider = event.detail.iconProvider;
    try {
      localStorage.setItem(preferenceKey, speechProvider);
      localStorage.setItem(iconPreferenceKey, iconProvider);
    }
    catch { showToast('error', $t('settings_not_persisted')); }
  }

  function resizeTextarea() {
    if (!textareaEl) return;
    textareaEl.style.height = 'auto';
    textareaEl.style.height = `${textareaEl.scrollHeight}px`;
  }
  function releaseMicrophone() {
    clearTimeout(stopTimeout);
    stream?.getTracks().forEach(track => track.stop());
    stream = undefined;
  }
  onDestroy(() => {
    destroyed = true;
    wantsRecording = false;
    configController.abort();
    transcriptionController?.abort();
    if (mediaRecorder?.state === 'recording') mediaRecorder.stop();
    releaseMicrophone();
  });

  async function startRecording() {
    if (state !== 'idle' || !recordingSupported || !speechEnabled) return;
    wantsRecording = true;
    state = 'requesting';
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!wantsRecording || destroyed) {
        releaseMicrophone();
        state = 'idle';
        return;
      }
      const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find(type => MediaRecorder.isTypeSupported(type));
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorder = recorder;
      const chunks = [];
      let failed = false;
      const started = Date.now();
      recorder.ondataavailable = event => {
        if (event.data.size) chunks.push(event.data);
      };
      recorder.onerror = () => {
        failed = true;
        wantsRecording = false;
        releaseMicrophone();
        state = 'idle';
        showToast('error', $t('microphone_access_failed'));
      };
      recorder.onstop = async () => {
        releaseMicrophone();
        if (destroyed || failed) return;
        if (Date.now() - started < 1000 || !chunks.length) {
          state = 'idle';
          showToast('error', $t('recording_too_short'));
          return;
        }
        state = 'transcribing';
        transcriptionController = new AbortController();
        const blob = new Blob(chunks, { type: recorder.mimeType || mimeType || 'audio/webm' });
        const form = new FormData();
        form.append('audio', blob, blob.type.includes('mp4') ? 'task.mp4' : 'task.webm');
        const timeout = setTimeout(() => transcriptionController.abort(), 60_000);
        try {
          const res = await fetch(`/whisper?provider=${speechProvider}`, { method: 'POST', body: form, signal: transcriptionController.signal });
          if (!res.ok) {
            const message = { 400: 'audio_no_speech', 429: 'speech_busy', 503: 'speech_unavailable', 504: 'speech_timeout' }[res.status] || 'transcription_failed';
            showToast('error', $t(message));
          } else {
            const data = await res.json();
            if (data.text?.trim()) {
              taskText = data.text.slice(0, 4000);
              await tick();
              resizeTextarea();
            } else showToast('error', $t('audio_no_speech'));
          }
        } catch (error) {
          if (!destroyed) showToast('error', $t('transcription_failed'));
        } finally {
          clearTimeout(timeout);
          state = 'idle';
        }
      };
      recorder.start(1000);
      state = 'recording';
      stopTimeout = setTimeout(stopRecording, 10_000);
    } catch (error) {
      releaseMicrophone();
      state = 'idle';
      wantsRecording = false;
      if (!destroyed) showToast('error', $t('microphone_access_failed'));
    }
  }
  function stopRecording() {
    wantsRecording = false;
    clearTimeout(stopTimeout);
    if (mediaRecorder?.state === 'recording') mediaRecorder.stop();
  }
  function pointerStart(event) {
    if (event.button !== 0 || state !== 'idle') return;
    event.currentTarget.setPointerCapture(event.pointerId);
    startRecording();
  }
  function keyboardClick(event) {
    if (event.detail !== 0) return;
    if (state === 'recording' || state === 'requesting') stopRecording();
    else startRecording();
  }
</script>

<main aria-label="Thermal ToDo">
  <div class="app-header">
    <img src="/logo_dark.svg" alt="Thermal ToDo" class="logo" width="1729" height="262" />
    <button class="settings-trigger" type="button" on:click={() => settingsDialog.open()}
      disabled={configLoading || state !== 'idle'} aria-label={$t('settings')} title={$t('settings')}>
      <FluentIcon name="settings" />
    </button>
  </div>
  <div class="composer">
    <label for="task-input">{$t('task_label')}</label>
    <div class="input-container">
      <textarea id="task-input" bind:this={textareaEl} bind:value={taskText}
        placeholder={$t('placeholder')} rows="2" maxlength="4000"
        on:input={resizeTextarea} disabled={state !== 'idle'} aria-describedby="input-status"></textarea>
      {#if speechEnabled}
        <button class="mic-btn" class:stop={state === 'recording'}
          on:pointerdown={pointerStart} on:pointerup={stopRecording} on:pointercancel={stopRecording}
          on:click={keyboardClick} disabled={!recordingSupported || state === 'transcribing'}
          aria-pressed={state === 'recording'}
          aria-label={$t(state === 'recording' ? 'mic_stop' : 'mic_start')}>
          <FluentIcon name={state === 'recording' ? 'stop' : 'mic'} />
        </button>
      {/if}
    </div>
    <p id="input-status" class="input-status" role="status">
      {#if configLoading}{$t('config_loading')}
      {:else if state === 'requesting'}{$t('mic_permission')}
      {:else if state === 'recording'}{$t('recording_active')}
      {:else if state === 'transcribing'}{$t('transcribing')}
      {:else if speechEnabled}{$t(recordingSupported ? 'mic_hint' : 'mic_unavailable')}
      {:else if speechProvider}{$t('speech_unavailable')}
      {/if}
    </p>
  </div>
  <div class="receipt-wrapper" aria-label={$t('preview_label')}>
    <div class="paper" id="print-area">
      <div class="subheader">{new Date().toLocaleDateString($locale)}</div>
      <div class="separator"></div>
      {#if taskText.trim()}
        {#if iconEnabled}<TaskItem task={taskText} provider={iconProvider} bind:loading={iconLoading} />
        {:else}<div class="task-text">{taskText}</div>{/if}
      {:else}<div class="empty-preview">{$t('preview_empty')}</div>{/if}
      <div class="separator"></div>
      <div class="footer">{$t('footer')}</div>
    </div>
  </div>
  <PrintButton disabled={!taskText.trim() || configLoading || state !== 'idle' || iconLoading} />
</main>
<SettingsDialog bind:this={settingsDialog} {speech} provider={speechProvider} {icons} {iconProvider} on:save={saveSettings} />
<Toast />
