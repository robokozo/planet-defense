<script setup lang="ts">
import { ref } from 'vue'

import { damageNumbersEnabled, screenShakeEnabled } from '@/game/settings'
import { soundEngine } from '@/game/sound'
import { useMetaStore } from '@/stores/metaStore'

const metaStore = useMetaStore()

const isConfirmingReset = ref(false)

function onResetClick(): void {
  if (isConfirmingReset.value === false) {
    isConfirmingReset.value = true
    return
  }
  metaStore.resetAllProgress()
  isConfirmingReset.value = false
}

// ── settings ──────────────────────────────────────────────────────────
const isSettingsOpen = ref(false)
const volumePercent = ref(Math.round(soundEngine.volume() * 100))
const isMuted = ref(soundEngine.muted())
const isMusicOn = ref(soundEngine.musicEnabled())

function onVolumeInput(): void {
  soundEngine.setVolume({ volume: volumePercent.value / 100 })
}

function toggleMute(): void {
  isMuted.value = isMuted.value === false
  soundEngine.setMuted({ isMuted: isMuted.value })
}

function toggleMusic(): void {
  isMusicOn.value = isMusicOn.value === false
  soundEngine.setMusicEnabled({ isEnabled: isMusicOn.value })
}

// ── save transfer ─────────────────────────────────────────────────────
const exportedCode = ref('')
const importCode = ref('')
const importStatus = ref('')

async function onExportSave(): Promise<void> {
  exportedCode.value = metaStore.exportSave()
  try {
    await navigator.clipboard.writeText(exportedCode.value)
    importStatus.value = 'Save code copied to clipboard'
  } catch {
    importStatus.value = 'Copy the code below manually'
  }
}

function onImportSave(): void {
  if (importCode.value.trim() === '') {
    return
  }
  const didImport = metaStore.importSave({ code: importCode.value })
  importStatus.value = didImport === true ? 'Save imported!' : 'That code is not a valid save'
  if (didImport === true) {
    importCode.value = ''
  }
}
</script>

<template>
  <main class="flex min-h-screen flex-col items-center justify-center gap-10 p-8">
    <header class="text-center">
      <h1
        class="text-5xl font-black tracking-widest text-sky-300 drop-shadow-[0_0_18px_rgba(56,189,248,0.45)]"
      >
        LAST HORIZON
      </h1>
      <p class="mt-3 text-slate-400">The invasion has begun. Hold the line.</p>
    </header>

    <section
      class="flex items-center gap-3 rounded-full border border-amber-400/30 bg-amber-400/10 px-6 py-2"
    >
      <span class="text-2xl">✦</span>
      <span class="text-xl font-bold text-amber-300">{{ Math.floor(metaStore.stardust) }}</span>
      <span class="text-sm text-amber-200/70">stardust</span>
    </section>

    <nav class="flex flex-col items-center gap-4">
      <RouterLink
        to="/game"
        class="w-64 rounded-xl bg-sky-500 px-8 py-4 text-center text-xl font-bold text-slate-950 transition hover:bg-sky-400 hover:shadow-[0_0_24px_rgba(56,189,248,0.5)]"
      >
        Launch Run
      </RouterLink>
      <RouterLink
        to="/skills"
        class="w-64 rounded-xl border border-fuchsia-400/40 bg-fuchsia-500/10 px-8 py-4 text-center text-xl font-bold text-fuchsia-300 transition hover:bg-fuchsia-500/20"
      >
        Paragon Tree
      </RouterLink>
      <RouterLink
        to="/lab"
        class="w-64 rounded-xl border border-lime-400/40 bg-lime-500/10 px-8 py-4 text-center text-xl font-bold text-lime-300 transition hover:bg-lime-500/20"
      >
        Training Range
      </RouterLink>
    </nav>

    <section class="grid grid-cols-4 gap-6 text-center text-sm">
      <div>
        <p class="text-2xl font-bold text-slate-200">{{ metaStore.lifetime.runs }}</p>
        <p class="text-slate-500">runs</p>
      </div>
      <div>
        <p class="text-2xl font-bold text-slate-200">{{ metaStore.lifetime.bestWave }}</p>
        <p class="text-slate-500">best wave</p>
      </div>
      <div>
        <p class="text-2xl font-bold text-slate-200">{{ metaStore.lifetime.kills }}</p>
        <p class="text-slate-500">kills</p>
      </div>
      <div>
        <p class="text-2xl font-bold text-slate-200">
          {{ Math.floor(metaStore.lifetime.totalStardustEarned) }}
        </p>
        <p class="text-slate-500">stardust earned</p>
      </div>
    </section>

    <section class="flex w-full max-w-md flex-col items-center gap-3">
      <div class="flex items-center gap-5">
        <button
          type="button"
          class="cursor-pointer text-xs font-semibold text-slate-500 transition hover:text-slate-300"
          @click="isSettingsOpen = isSettingsOpen === false"
        >
          ⚙ Settings &amp; save {{ isSettingsOpen === true ? '▴' : '▾' }}
        </button>
        <RouterLink
          to="/patch-notes"
          class="text-xs font-semibold text-slate-500 transition hover:text-slate-300"
        >
          📜 Patch notes
        </RouterLink>
      </div>

      <div
        v-if="isSettingsOpen === true"
        class="flex w-full flex-col gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-sm"
      >
        <label class="flex items-center gap-3 text-slate-300">
          <span class="w-28 shrink-0 text-slate-400">Volume</span>
          <input
            v-model.number="volumePercent"
            type="range"
            min="0"
            max="100"
            step="5"
            class="flex-1 accent-sky-400"
            @input="onVolumeInput()"
          />
          <span class="w-10 text-right font-bold">{{ volumePercent }}%</span>
        </label>

        <div class="flex flex-wrap gap-2">
          <button
            type="button"
            class="cursor-pointer rounded-lg px-3 py-1.5 text-xs font-semibold transition"
            :class="
              isMuted === false
                ? 'bg-sky-500/20 text-sky-300'
                : 'bg-slate-800 text-slate-500 hover:text-slate-300'
            "
            @click="toggleMute()"
          >
            {{ isMuted === true ? '🔇 Muted' : '🔊 Sound on' }}
          </button>
          <button
            type="button"
            class="cursor-pointer rounded-lg px-3 py-1.5 text-xs font-semibold transition"
            :class="
              isMusicOn === true
                ? 'bg-sky-500/20 text-sky-300'
                : 'bg-slate-800 text-slate-500 hover:text-slate-300'
            "
            @click="toggleMusic()"
          >
            ♫ Music {{ isMusicOn === true ? 'on' : 'off' }}
          </button>
          <button
            type="button"
            class="cursor-pointer rounded-lg px-3 py-1.5 text-xs font-semibold transition"
            :class="
              screenShakeEnabled === true
                ? 'bg-sky-500/20 text-sky-300'
                : 'bg-slate-800 text-slate-500 hover:text-slate-300'
            "
            @click="screenShakeEnabled = screenShakeEnabled === false"
          >
            Screen shake {{ screenShakeEnabled === true ? 'on' : 'off' }}
          </button>
          <button
            type="button"
            class="cursor-pointer rounded-lg px-3 py-1.5 text-xs font-semibold transition"
            :class="
              damageNumbersEnabled === true
                ? 'bg-sky-500/20 text-sky-300'
                : 'bg-slate-800 text-slate-500 hover:text-slate-300'
            "
            @click="damageNumbersEnabled = damageNumbersEnabled === false"
          >
            Damage numbers {{ damageNumbersEnabled === true ? 'on' : 'off' }}
          </button>
        </div>

        <div class="flex flex-col gap-2 border-t border-slate-800 pt-3">
          <div class="flex gap-2">
            <button
              type="button"
              class="cursor-pointer rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-700"
              @click="onExportSave()"
            >
              Export save
            </button>
            <input
              v-model="importCode"
              type="text"
              placeholder="paste a save code…"
              class="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-300 placeholder:text-slate-600"
            />
            <button
              type="button"
              class="cursor-pointer rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-700"
              @click="onImportSave()"
            >
              Import
            </button>
          </div>
          <textarea
            v-if="exportedCode !== ''"
            :value="exportedCode"
            readonly
            rows="2"
            class="w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 font-mono text-[10px] text-slate-400"
            @focus="($event.target as HTMLTextAreaElement).select()"
          />
          <p v-if="importStatus !== ''" class="text-xs text-slate-500">{{ importStatus }}</p>
        </div>

        <div class="flex items-center gap-3 border-t border-slate-800 pt-3">
          <button
            type="button"
            class="cursor-pointer rounded-lg border px-4 py-1.5 text-xs font-semibold transition"
            :class="
              isConfirmingReset === true
                ? 'border-red-500 bg-red-500/20 text-red-300 hover:bg-red-500/30'
                : 'border-red-500/30 text-red-400/70 hover:bg-red-500/10 hover:text-red-400'
            "
            @click="onResetClick()"
          >
            {{
              isConfirmingReset === true ? 'Click again to wipe everything' : 'Reset all progress'
            }}
          </button>
          <button
            v-if="isConfirmingReset === true"
            type="button"
            class="cursor-pointer rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-400 hover:text-slate-200"
            @click="isConfirmingReset = false"
          >
            Cancel
          </button>
        </div>
      </div>
    </section>
  </main>
</template>
