<script>
  import TaskItem from "./lib/TaskItem.svelte";
  import PrintButton from "./lib/PrintButton.svelte";
  import Toast from "./lib/Toast.svelte";
  import { apiBase, showToast } from "./lib/stores.js";
  import Icon from "@iconify/svelte";
  import IconGallery from "./lib/IconGallery.svelte";

  const API_BASE = `http://${location.hostname}:3000`;
  // initialize global store value
  apiBase.set(API_BASE);

  let taskText = "";

  let recording = false;
  let mediaRecorder;
  let chunks = [];
  let stopTimeout;
  let recordStart = 0;
  const MAX_RECORD_MS = 10_000;

  async function startRecording() {
    if (recording) return;
    chunks = [];
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      console.log("got stream", stream);
      // expose for debugging in console
      window["__stream"] = stream;

      // prefer opus/webm when available
      let options;
      try {
        if (MediaRecorder && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
          options = { mimeType: "audio/webm;codecs=opus" };
        } else if (MediaRecorder && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported("audio/webm")) {
          options = { mimeType: "audio/webm" };
        }
      } catch (e) {
        console.warn("mime check failed", e);
      }

      mediaRecorder = options ? new MediaRecorder(stream, options) : new MediaRecorder(stream);
      window["__mediaRecorder"] = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        console.log("dataavailable", e.data && e.data.size);
        if (e.data && e.data.size) chunks.push(e.data);
      };

      mediaRecorder.onstart = () => console.log("recorder start", mediaRecorder.state);
      mediaRecorder.onpause = () => console.log("recorder pause");
      mediaRecorder.onresume = () => console.log("recorder resume");
      mediaRecorder.onerror = (e) => console.error("recorder error", e);

      mediaRecorder.onstop = async () => {
        console.log("recorder stop", chunks.length);
        clearTimeout(stopTimeout);
        const durationMs = Date.now() - recordStart;
        if (durationMs < 1000) {
          console.warn("Recording too short (", durationMs, "ms). Ignoring.");
          showToast("error", "Recording too short");
          // cleanup tracks
          try {
            stream.getTracks().forEach((t) => t.stop());
          } catch (e) {
            console.warn("stopping tracks failed", e);
          }
          chunks = [];
          recording = false;
          return;
        }
        const blob = new Blob(chunks, { type: "audio/webm" });
        const form = new FormData();
        form.append("audio", blob, "task.webm");

        try {
          const res = await fetch(`${API_BASE}/whisper`, {
            method: "POST",
            body: form,
          });

          if (!res.ok) {
            const txt = await res.text();
            console.error("Whisper response error", res.status, txt);
            showToast("error", "Audio contains no speech");
          } else {
            const data = await res.json();
            taskText = data.text || "";
          }
        } catch (err) {
          console.error("Error sending to Whisper:", err);
          showToast("error", "Transcription failed");
        }

        // cleanup tracks
        try {
          stream.getTracks().forEach((t) => t.stop());
        } catch (e) {
          console.warn("stopping tracks failed", e);
        }
        // reset chunks
        chunks = [];
      };

      // record start timestamp, then call start with timeslice so ondataavailable fires periodically
      recordStart = Date.now();
      mediaRecorder.start(1000);
      recording = true;

      // safety timeout: auto-stop after MAX_RECORD_MS
      stopTimeout = setTimeout(() => {
        if (mediaRecorder && mediaRecorder.state === "recording") {
          console.warn("Auto-stopping recording after", MAX_RECORD_MS, "ms");
          try {
            mediaRecorder.stop();
          } catch (e) {
            console.error("auto stop failed", e);
          }
          recording = false;
        }
      }, MAX_RECORD_MS);
    } catch (err) {
      console.error("Microphone access failed:", err);
      showToast("error", "Microphone access failed");
    }
  }

  function stopRecording() {
    if (!recording) return;
    try {
      if (mediaRecorder && mediaRecorder.state === "recording") {
        mediaRecorder.stop();
      } else {
        console.warn("stopRecording called but recorder state is", mediaRecorder && mediaRecorder.state);
      }
    } catch (err) {
      console.error("Error stopping recorder:", err);
    }
    // ensure tracks are stopped and timeout cleared
    try {
      if (window["__stream"]) window["__stream"].getTracks().forEach((t) => t.stop());
    } catch (e) {}
    clearTimeout(stopTimeout);
    recording = false;
  }

  function handleKeyDownToggle(e) {
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      if (recording) stopRecording();
      else startRecording();
    }
  }
</script>

<div class="input-container">
  <input type="text" bind:value={taskText} placeholder="Aufgabe eingeben..." />
  {#if recording}
    <button
      class="mic-btn stop"
      on:pointerdown|preventDefault={startRecording}
      on:pointerup={stopRecording}
      on:pointercancel={stopRecording}
      on:pointerleave={stopRecording}
      on:touchstart|preventDefault={startRecording}
      on:touchend={stopRecording}
      on:mousedown|preventDefault={startRecording}
      on:mouseup={stopRecording}
      on:keydown={handleKeyDownToggle}
    >
      <Icon icon="fluent:mic-24-regular" />
    </button>
  {:else}
    <button
      class="mic-btn"
      on:pointerdown|preventDefault={startRecording}
      on:pointerup={stopRecording}
      on:pointercancel={stopRecording}
      on:pointerleave={stopRecording}
      on:touchstart|preventDefault={startRecording}
      on:touchend={stopRecording}
      on:mousedown|preventDefault={startRecording}
      on:mouseup={stopRecording}
      on:keydown={handleKeyDownToggle}
    >
      <Icon icon="fluent:mic-24-regular" />
    </button>
  {/if}
</div>

<div class="receipt-wrapper">
  <div class="paper" id="print-area">
    <div class="header">HEUTE</div>
    <div class="subheader">{new Date().toLocaleDateString()}</div>

    <div class="separator">--------------------</div>

    <TaskItem task={taskText} />

    <div class="separator">--------------------</div>

    <div class="footer">Fokus • Kein Multitasking</div>
  </div>
</div>

<PrintButton />

<!-- Icon gallery for quick inspection (component) -->
<!-- <IconGallery /> -->

<!-- Toast notifications (global) -->
<Toast />
