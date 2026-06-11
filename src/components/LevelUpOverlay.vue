<script setup lang="ts">
import type { LevelUpOffer, UpgradeRarity } from '@/game/types'

const { offer } = defineProps<{ offer: LevelUpOffer }>()

const emit = defineEmits<{
  choose: [payload: { upgradeId: string }]
}>()

const RARITY_CARD_CLASSES: Record<UpgradeRarity, string> = {
  common: 'border-slate-500/50 hover:border-slate-300',
  rare: 'border-sky-400/60 shadow-[0_0_14px_rgba(56,189,248,0.2)] hover:border-sky-300 hover:shadow-[0_0_24px_rgba(56,189,248,0.45)]',
  epic: 'border-fuchsia-400/70 shadow-[0_0_18px_rgba(232,121,249,0.3)] hover:border-fuchsia-300 hover:shadow-[0_0_28px_rgba(232,121,249,0.55)]',
  legendary:
    'border-orange-400/80 shadow-[0_0_22px_rgba(251,146,60,0.4)] hover:border-orange-300 hover:shadow-[0_0_34px_rgba(251,146,60,0.65)]',
}

const RARITY_LABEL_CLASSES: Record<UpgradeRarity, string> = {
  common: 'text-slate-400',
  rare: 'text-sky-300',
  epic: 'text-fuchsia-300',
  legendary: 'text-orange-300',
}
</script>

<template>
  <div
    class="absolute inset-0 z-20 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm"
  >
    <div class="flex flex-col items-center gap-6 p-6">
      <h2 class="text-3xl font-black text-sky-300">Level {{ offer.level }}!</h2>
      <p class="-mt-4 flex items-center gap-3 text-sm text-slate-400">
        Choose an upgrade
        <span
          class="rounded-full border border-slate-600 bg-slate-900/80 px-3 py-0.5 text-xs font-semibold text-slate-300"
        >
          Weapon slots {{ offer.weaponSlotsUsed }} / {{ offer.weaponSlotsTotal }}
        </span>
      </p>
      <div class="flex flex-wrap items-stretch justify-center gap-4">
        <button
          v-for="choice in offer.choices"
          :key="choice.id"
          type="button"
          class="flex w-52 cursor-pointer flex-col gap-2 rounded-xl border bg-slate-900/90 p-5 text-left transition hover:-translate-y-1"
          :class="RARITY_CARD_CLASSES[choice.rarity]"
          @click="emit('choose', { upgradeId: choice.id })"
        >
          <span class="flex items-center justify-between gap-2">
            <span
              class="text-[10px] font-bold uppercase tracking-widest"
              :class="RARITY_LABEL_CLASSES[choice.rarity]"
            >
              {{ choice.rarity }}
            </span>
            <span
              v-if="choice.category === 'weapon'"
              class="rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider"
              :class="
                choice.currentStacks === 0
                  ? 'bg-amber-400/20 text-amber-300'
                  : 'bg-slate-700/60 text-slate-400'
              "
            >
              {{ choice.currentStacks === 0 ? 'Uses a slot' : 'Weapon' }}
            </span>
          </span>
          <span class="text-lg font-bold text-slate-100">{{ choice.name }}</span>
          <span class="text-sm text-slate-400">{{ choice.description }}</span>
          <span class="mt-auto text-sm tracking-widest" aria-label="tier progress">
            <template v-for="star in choice.maxStacks" :key="star">
              <span :class="star <= choice.currentStacks ? 'text-amber-300' : 'text-slate-600'">
                {{ star <= choice.currentStacks ? '★' : '☆' }}
              </span>
            </template>
          </span>
        </button>
      </div>
    </div>
  </div>
</template>
