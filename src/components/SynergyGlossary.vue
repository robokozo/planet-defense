<script setup lang="ts">
import { computed } from 'vue'

import {
  UPGRADE_DEFINITIONS,
  describeSynergyRequirements,
  type UpgradeDefinition,
} from '@/game/data/upgrades'

const emit = defineEmits<{ close: [] }>()

interface GlossaryRow {
  definition: UpgradeDefinition
  requirements: string
}

const rows = computed<Array<GlossaryRow>>(() =>
  UPGRADE_DEFINITIONS.filter((definition) => definition.requires !== undefined)
    .map((definition) => ({
      definition,
      requirements: describeSynergyRequirements({ definition }) ?? '',
    }))
    .sort((a, b) => a.requirements.localeCompare(b.requirements)),
)
</script>

<template>
  <div
    class="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/80 p-4"
    @click.self="emit('close')"
  >
    <div
      class="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl"
    >
      <div class="flex items-center justify-between border-b border-slate-800 px-5 py-3">
        <h2 class="text-lg font-black tracking-wider text-fuchsia-300">⛓ SYNERGY GLOSSARY</h2>
        <button
          type="button"
          class="cursor-pointer rounded-lg bg-slate-800 px-3 py-1.5 text-sm font-semibold text-slate-300 hover:bg-slate-700"
          @click="emit('close')"
        >
          Close ✕
        </button>
      </div>
      <p class="px-5 pt-3 text-xs text-slate-500">
        Synergy cards are only offered once both parent cards reach the listed tier.
      </p>
      <ul class="flex flex-col gap-2 overflow-y-auto p-5">
        <li
          v-for="row in rows"
          :key="row.definition.id"
          class="rounded-xl border border-slate-800 bg-slate-950/60 p-3"
        >
          <div class="flex flex-wrap items-baseline justify-between gap-2">
            <span class="font-bold text-slate-100">{{ row.definition.name }}</span>
            <span class="text-xs font-semibold text-fuchsia-300">⛓ {{ row.requirements }}</span>
          </div>
          <p class="mt-1 text-sm leading-relaxed text-slate-400">
            {{ row.definition.description.replace('Synergy: ', '') }}
          </p>
        </li>
      </ul>
    </div>
  </div>
</template>
