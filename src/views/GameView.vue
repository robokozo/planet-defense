<script setup lang="ts">
import { useLocalStorage } from '@vueuse/core'
import type Phaser from 'phaser'
import { onMounted, onUnmounted, ref } from 'vue'

import GameHud from '@/components/GameHud.vue'
import GameOverOverlay from '@/components/GameOverOverlay.vue'
import LevelUpOverlay from '@/components/LevelUpOverlay.vue'
import SynergyGlossary from '@/components/SynergyGlossary.vue'
import { createPlanetGame } from '@/game/createGame'
import { gameEventBus } from '@/game/eventBus'
import { soundEngine } from '@/game/sound'
import type { HudSnapshot, LevelUpOffer, RunResult } from '@/game/types'
import { applyPrestige, buildStartingStats, stardustMultiplierFrom } from '@/skills/skillTree'
import { useMetaStore } from '@/stores/metaStore'

const metaStore = useMetaStore()

const gameContainer = ref<HTMLDivElement | null>(null)
const hud = ref<HudSnapshot | null>(null)
const levelUpOffer = ref<LevelUpOffer | null>(null)
const runResult = ref<RunResult | null>(null)
const isPaused = ref(false)
/** survives rounds and reloads — regulars shouldn't re-click ×5 every run */
const speedMultiplier = useLocalStorage<number>('pd-sim-speed', 1)
const isMuted = ref(soundEngine.muted())

function toggleMute(): void {
  isMuted.value = isMuted.value === false
  soundEngine.setMuted({ isMuted: isMuted.value })
}

const SPEED_CYCLE: Array<number> = [1, 2, 5]

let game: Phaser.Game | null = null
const busUnsubscribes: Array<() => void> = []

function startGame(): void {
  if (gameContainer.value === null) {
    return
  }
  const unlockedNodeIds = metaStore.unlockedNodeIds
  const prestigeLevel = metaStore.prestigeLevel
  game = createPlanetGame({
    parent: gameContainer.value,
    sceneData: {
      startingStats: applyPrestige({
        stats: buildStartingStats({ unlockedNodeIds }),
        prestigeLevel,
      }),
      stardustMultiplier: stardustMultiplierFrom({ unlockedNodeIds }),
      prestigeLevel,
    },
  })
  // a fresh scene boots at ×1 — re-apply the persisted speed once it is listening
  if (speedMultiplier.value !== 1) {
    setTimeout(() => {
      gameEventBus.emit({ event: 'set-speed', payload: { multiplier: speedMultiplier.value } })
    }, 600)
  }
}

function destroyGame(): void {
  if (game !== null) {
    game.destroy(true)
    game = null
  }
}

function restartRun(): void {
  destroyGame()
  hud.value = null
  levelUpOffer.value = null
  runResult.value = null
  isPaused.value = false
  startGame()
}

function cycleSpeed(): void {
  const currentIndex = SPEED_CYCLE.indexOf(speedMultiplier.value)
  speedMultiplier.value = SPEED_CYCLE[(currentIndex + 1) % SPEED_CYCLE.length]
  gameEventBus.emit({ event: 'set-speed', payload: { multiplier: speedMultiplier.value } })
}

function chooseUpgrade({ upgradeId }: { upgradeId: string }): void {
  levelUpOffer.value = null
  gameEventBus.emit({ event: 'upgrade-chosen', payload: { upgradeId } })
}

function requestReroll(): void {
  // the scene answers with a fresh 'level-up' event carrying new choices
  gameEventBus.emit({ event: 'reroll-requested', payload: {} })
}

function requestBanish({ upgradeId }: { upgradeId: string }): void {
  gameEventBus.emit({ event: 'banish-requested', payload: { upgradeId } })
}

function togglePause(): void {
  // the level-up and game-over flows own the scene's pause state
  if (levelUpOffer.value !== null || runResult.value !== null) {
    return
  }
  isPaused.value = isPaused.value === false
  gameEventBus.emit({ event: 'set-paused', payload: { isPaused: isPaused.value } })
}

// ── synergy glossary (pauses the run while reading) ───────────────────
const isGlossaryOpen = ref(false)
let didGlossaryPause = false

function openGlossary(): void {
  isGlossaryOpen.value = true
  if (isPaused.value === false && levelUpOffer.value === null && runResult.value === null) {
    didGlossaryPause = true
    isPaused.value = true
    gameEventBus.emit({ event: 'set-paused', payload: { isPaused: true } })
  }
}

function closeGlossary(): void {
  isGlossaryOpen.value = false
  if (didGlossaryPause === true) {
    didGlossaryPause = false
    isPaused.value = false
    gameEventBus.emit({ event: 'set-paused', payload: { isPaused: false } })
  }
}

onMounted(() => {
  busUnsubscribes.push(
    gameEventBus.on({
      event: 'hud-update',
      handler: (snapshot) => {
        hud.value = snapshot
      },
    }),
    gameEventBus.on({
      event: 'level-up',
      handler: (offer) => {
        levelUpOffer.value = offer
      },
    }),
    gameEventBus.on({
      event: 'run-ended',
      handler: (result) => {
        runResult.value = result
        metaStore.recordRun({ result })
      },
    }),
  )
  startGame()
})

onUnmounted(() => {
  destroyGame()
  for (const unsubscribe of busUnsubscribes) {
    unsubscribe()
  }
})
</script>

<template>
  <main class="relative flex min-h-screen items-center justify-center">
    <div ref="gameContainer" class="h-screen w-screen overflow-hidden" />

    <GameHud v-if="hud !== null" :hud="hud" />

    <div class="absolute right-4 top-4 z-10 flex gap-2">
      <button
        type="button"
        class="cursor-pointer rounded-lg px-3 py-2 text-sm font-bold transition sm:px-4"
        :class="
          speedMultiplier === 1
            ? 'bg-slate-900/80 text-slate-300 hover:bg-slate-800'
            : 'bg-amber-500/90 text-slate-950 hover:bg-amber-400'
        "
        @click="cycleSpeed()"
      >
        ×{{ speedMultiplier }}
      </button>
      <button
        type="button"
        class="cursor-pointer rounded-lg bg-slate-900/80 px-3 py-2 text-sm font-semibold text-slate-300 transition hover:bg-slate-800 sm:px-4"
        @click="togglePause()"
      >
        {{ isPaused === true ? 'Resume' : 'Pause' }}
      </button>
      <button
        type="button"
        class="cursor-pointer rounded-lg bg-slate-900/80 px-3 py-2 text-sm font-semibold text-slate-300 transition hover:bg-slate-800 sm:px-4"
        aria-label="Synergy glossary"
        @click="openGlossary()"
      >
        ⛓
      </button>
      <button
        type="button"
        class="cursor-pointer rounded-lg bg-slate-900/80 px-3 py-2 text-sm font-semibold text-slate-300 transition hover:bg-slate-800 sm:px-4"
        :aria-label="isMuted === true ? 'Unmute sound' : 'Mute sound'"
        @click="toggleMute()"
      >
        {{ isMuted === true ? '🔇' : '🔊' }}
      </button>
      <RouterLink
        to="/"
        class="rounded-lg bg-slate-900/80 px-3 py-2 text-sm font-semibold text-slate-300 transition hover:bg-slate-800 sm:px-4"
      >
        Abandon
      </RouterLink>
    </div>

    <div
      v-if="isPaused === true"
      class="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-slate-950/60"
    >
      <p class="text-3xl font-black tracking-widest text-slate-300">PAUSED</p>
    </div>

    <LevelUpOverlay
      v-if="levelUpOffer !== null"
      :offer="levelUpOffer"
      :stacks="hud?.cardStacks ?? null"
      @choose="(payload) => chooseUpgrade(payload)"
      @reroll="() => requestReroll()"
      @banish="(payload) => requestBanish(payload)"
    />

    <GameOverOverlay v-if="runResult !== null" :result="runResult" @restart="() => restartRun()" />

    <SynergyGlossary
      v-if="isGlossaryOpen === true"
      :stacks="hud?.cardStacks ?? null"
      @close="closeGlossary()"
    />
  </main>
</template>
