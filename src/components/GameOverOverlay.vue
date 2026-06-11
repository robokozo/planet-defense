<script setup lang="ts">
import { computed } from 'vue'

import type { RunResult } from '@/game/types'

const { result } = defineProps<{ result: RunResult }>()

const emit = defineEmits<{
  restart: []
}>()

const durationLabel = computed(() => {
  const totalSeconds = Math.floor(result.elapsedMs / 1_000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}m ${seconds}s`
})
</script>

<template>
  <div
    class="absolute inset-0 z-20 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm"
  >
    <div
      class="flex w-full max-w-md flex-col items-center gap-6 rounded-2xl border border-red-500/30 bg-slate-900/90 p-8"
    >
      <h2 class="text-4xl font-black text-red-400">BASE LOST</h2>

      <dl class="grid w-full grid-cols-2 gap-x-6 gap-y-2 text-sm">
        <dt class="text-slate-400">Waves survived</dt>
        <dd class="text-right font-bold text-slate-100">{{ result.waveReached }}</dd>
        <dt class="text-slate-400">Enemies destroyed</dt>
        <dd class="text-right font-bold text-slate-100">{{ result.kills }}</dd>
        <dt class="text-slate-400">Level reached</dt>
        <dd class="text-right font-bold text-slate-100">{{ result.level }}</dd>
        <dt class="text-slate-400">Time held</dt>
        <dd class="text-right font-bold text-slate-100">{{ durationLabel }}</dd>
      </dl>

      <p
        class="flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-400/10 px-5 py-2 text-lg font-bold text-amber-300"
      >
        ✦ +{{ result.stardustEarned }} stardust
      </p>

      <div class="flex w-full flex-col gap-3">
        <button
          type="button"
          class="cursor-pointer rounded-xl bg-sky-500 px-6 py-3 font-bold text-slate-950 transition hover:bg-sky-400"
          @click="emit('restart')"
        >
          Run Again
        </button>
        <RouterLink
          to="/skills"
          class="rounded-xl border border-fuchsia-400/40 bg-fuchsia-500/10 px-6 py-3 text-center font-bold text-fuchsia-300 transition hover:bg-fuchsia-500/20"
        >
          Spend Stardust
        </RouterLink>
        <RouterLink
          to="/"
          class="rounded-xl border border-slate-600 px-6 py-3 text-center font-bold text-slate-300 transition hover:bg-slate-800"
        >
          Home
        </RouterLink>
      </div>
    </div>
  </div>
</template>
