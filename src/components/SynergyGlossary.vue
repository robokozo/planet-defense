<script setup lang="ts">
import { computed } from 'vue'

import {
  UPGRADE_DEFINITIONS,
  findUpgradeDefinition,
  type UpgradeDefinition,
} from '@/game/data/upgrades'

const { stacks = null } = defineProps<{
  /** current run's card stacks — enables highlighting; omit for the static menu view */
  stacks?: Record<string, number> | null
}>()

const emit = defineEmits<{ close: [] }>()

interface ParentProgress {
  name: string
  need: number
  have: number
  isMet: boolean
}

type RowState = 'owned' | 'ready' | 'partial' | 'none'

interface GlossaryRow {
  definition: UpgradeDefinition
  parents: Array<ParentProgress>
  state: RowState
}

const STATE_ORDER: Record<RowState, number> = { owned: 0, ready: 1, partial: 2, none: 3 }

const ROW_CLASSES: Record<RowState, string> = {
  owned: 'border-lime-400/60 bg-lime-400/5',
  ready: 'border-fuchsia-400/70 bg-fuchsia-400/5 shadow-[0_0_14px_rgba(232,121,249,0.25)]',
  partial: 'border-slate-700 bg-slate-950/60',
  none: 'border-slate-800 bg-slate-950/60 opacity-60',
}

const rows = computed<Array<GlossaryRow>>(() => {
  const built = UPGRADE_DEFINITIONS.filter((definition) => definition.requires !== undefined).map(
    (definition) => {
      const parents = (definition.requires ?? []).map((requirement) => {
        const have = stacks?.[requirement.id] ?? 0
        return {
          name: findUpgradeDefinition({ upgradeId: requirement.id })?.name ?? requirement.id,
          need: requirement.stacks,
          have,
          isMet: have >= requirement.stacks,
        }
      })
      let state: RowState = 'none'
      if (stacks !== null) {
        if ((stacks[definition.id] ?? 0) > 0) {
          state = 'owned'
        } else if (parents.every((parent) => parent.isMet === true)) {
          state = 'ready'
        } else if (parents.some((parent) => parent.have > 0)) {
          state = 'partial'
        }
      }
      return { definition, parents, state }
    },
  )
  if (stacks === null) {
    return built.sort((a, b) => a.definition.name.localeCompare(b.definition.name))
  }
  return built.sort(
    (a, b) =>
      STATE_ORDER[a.state] - STATE_ORDER[b.state] ||
      a.definition.name.localeCompare(b.definition.name),
  )
})
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
        <span v-if="stacks !== null">
          Your arsenal: <span class="text-fuchsia-300">glowing = can appear now</span>,
          <span class="text-lime-300">green = owned</span>.
        </span>
      </p>
      <ul class="flex flex-col gap-2 overflow-y-auto p-5">
        <li
          v-for="row in rows"
          :key="row.definition.id"
          class="rounded-xl border p-3"
          :class="ROW_CLASSES[row.state]"
        >
          <div class="flex flex-wrap items-baseline justify-between gap-2">
            <span class="flex items-baseline gap-2 font-bold text-slate-100">
              {{ row.definition.name }}
              <span
                v-if="row.state === 'owned'"
                class="rounded bg-lime-400/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-lime-300"
              >
                Owned ★{{ stacks?.[row.definition.id] }}
              </span>
              <span
                v-else-if="row.state === 'ready'"
                class="animate-pulse rounded bg-fuchsia-400/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-fuchsia-300"
              >
                Can appear now
              </span>
            </span>
            <span class="flex items-center gap-1 text-xs font-semibold">
              <span class="text-slate-500">⛓</span>
              <template v-for="(parent, index) in row.parents" :key="parent.name">
                <span v-if="index > 0" class="text-slate-600">+</span>
                <span :class="parent.isMet === true ? 'text-lime-300' : 'text-slate-400'">
                  {{ parent.name }}
                  <template v-if="stacks !== null">★{{ parent.have }}/{{ parent.need }}</template>
                  <template v-else>★{{ parent.need }}</template>
                </span>
              </template>
            </span>
          </div>
          <p class="mt-1 text-sm leading-relaxed text-slate-400">
            {{ row.definition.description.replace('Synergy: ', '') }}
          </p>
        </li>
      </ul>
    </div>
  </div>
</template>
