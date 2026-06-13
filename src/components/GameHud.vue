<script setup lang="ts">
import { computed } from 'vue'

import { findUpgradeDefinition } from '@/game/data/upgrades'
import type { HudSnapshot, UpgradeRarity } from '@/game/types'

const { hud } = defineProps<{ hud: HudSnapshot }>()

const RARITY_CHIP_CLASSES: Record<UpgradeRarity, string> = {
  common: 'border-slate-600/70 text-slate-200',
  rare: 'border-sky-400/60 text-sky-200',
  epic: 'border-fuchsia-400/60 text-fuchsia-200',
  legendary: 'border-orange-400/70 text-orange-200',
}

/** the run's current loadout from card stacks — weapons first, then synergy tactics */
const selectedCards = computed(() => {
  return Object.entries(hud.cardStacks)
    .map(([id, stacks]) => {
      const definition = findUpgradeDefinition({ upgradeId: id })
      if (definition === null) {
        return null
      }
      return {
        id,
        name: definition.name,
        rarity: definition.rarity,
        category: definition.category,
        stacks,
      }
    })
    .filter((card): card is NonNullable<typeof card> => card !== null && card.stacks > 0)
    .sort((a, b) => {
      // weapons (the core kit) ahead of tactics; otherwise keep acquisition order
      if (a.category !== b.category) {
        return a.category === 'weapon' ? -1 : 1
      }
      return 0
    })
})

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
    <!-- stacked top-left on phones so the chips stay clear of the buttons in the top-right -->
    <div
      class="flex flex-col items-start gap-1.5 text-sm font-semibold sm:flex-row sm:items-center sm:justify-between sm:gap-0"
    >
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

    <!-- the capacitor (keystone unlock): kills fill it; at full charge every weapon surges -->
    <div v-if="hud.capacitor !== null" class="mx-auto w-full max-w-xs">
      <div
        class="h-1.5 overflow-hidden rounded-full border bg-slate-900/80"
        :class="hud.isSurging === true ? 'border-yellow-300/80' : 'border-amber-500/30'"
      >
        <div
          class="h-full transition-[width] duration-150"
          :class="hud.isSurging === true ? 'animate-pulse bg-yellow-300' : 'bg-amber-400/80'"
          :style="{ width: `${Math.round(hud.capacitor * 100)}%` }"
        />
      </div>
      <p
        v-if="hud.isSurging === true"
        class="mt-0.5 animate-pulse text-center text-xs font-bold tracking-widest text-yellow-300"
      >
        ⚡ SURGE
      </p>
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

  <!-- the run's loadout: every card picked so far, with its tier. Pinned to the
       left edge clear of the centered bars and the cannons along the ground. -->
  <div
    v-if="selectedCards.length > 0"
    class="pointer-events-none absolute left-2 top-1/3 flex max-w-[44%] flex-col gap-1 sm:left-4"
  >
    <span class="text-[9px] font-bold uppercase tracking-widest text-slate-500">Loadout</span>
    <div
      v-for="card in selectedCards"
      :key="card.id"
      class="flex w-fit items-center gap-1.5 rounded-md border bg-slate-900/70 px-1.5 py-0.5"
      :class="RARITY_CHIP_CLASSES[card.rarity]"
    >
      <span class="text-[10px] font-semibold leading-none">{{ card.name }}</span>
      <span class="text-[9px] font-bold leading-none text-amber-300">★{{ card.stacks }}</span>
    </div>
  </div>
</template>
