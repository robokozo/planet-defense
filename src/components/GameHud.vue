<script setup lang="ts">
import { computed } from 'vue'

import type { HudSnapshot } from '@/game/types'

const { hud } = defineProps<{ hud: HudSnapshot }>()

const hpPercent = computed(() => {
  if (hud.maxHp <= 0) {
    return 0
  }
  return Math.max(0, Math.min(100, (hud.hp / hud.maxHp) * 100))
})

const xpPercent = computed(() => {
  if (hud.xpToNext <= 0) {
    return 0
  }
  return Math.max(0, Math.min(100, (hud.xp / hud.xpToNext) * 100))
})

const elapsedLabel = computed(() => {
  const totalSeconds = Math.floor(hud.elapsedMs / 1_000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
})
</script>

<template>
  <div class="pointer-events-none absolute inset-x-0 top-0 flex flex-col gap-2 p-4">
    <div class="flex items-center justify-between text-sm font-semibold">
      <span class="rounded bg-slate-900/80 px-3 py-1 text-sky-300">Wave {{ hud.wave }}</span>
      <span class="rounded bg-slate-900/80 px-3 py-1 text-slate-300">{{ elapsedLabel }}</span>
      <span class="rounded bg-slate-900/80 px-3 py-1 text-red-300">{{ hud.kills }} kills</span>
    </div>

    <div class="mx-auto w-full max-w-xl">
      <div class="h-3 overflow-hidden rounded-full border border-emerald-500/40 bg-slate-900/80">
        <div
          class="h-full bg-emerald-500 transition-[width] duration-150"
          :style="{ width: `${hpPercent}%` }"
        />
      </div>
      <p class="mt-0.5 text-center text-xs text-emerald-300/80">
        {{ hud.hp }} / {{ hud.maxHp }} integrity
      </p>
    </div>

    <div class="mx-auto w-full max-w-xl">
      <div class="h-2 overflow-hidden rounded-full border border-sky-500/40 bg-slate-900/80">
        <div
          class="h-full bg-sky-400 transition-[width] duration-150"
          :style="{ width: `${xpPercent}%` }"
        />
      </div>
      <p class="mt-0.5 text-center text-xs text-sky-300/80">Level {{ hud.level }}</p>
    </div>

    <div v-if="hud.boss !== null" class="mx-auto w-full max-w-md">
      <p class="mb-0.5 text-center text-xs font-bold tracking-widest text-red-400">MOTHERSHIP</p>
      <div class="h-2.5 overflow-hidden rounded-full border border-red-500/50 bg-slate-900/80">
        <div
          class="h-full bg-red-500 transition-[width] duration-150"
          :style="{ width: `${Math.max(0, (hud.boss.hp / hud.boss.maxHp) * 100)}%` }"
        />
      </div>
    </div>
  </div>
</template>
