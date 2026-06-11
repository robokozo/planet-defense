<script setup lang="ts">
import type Phaser from 'phaser'
import { onMounted, onUnmounted, ref } from 'vue'

import GameHud from '@/components/GameHud.vue'
import GameOverOverlay from '@/components/GameOverOverlay.vue'
import LevelUpOverlay from '@/components/LevelUpOverlay.vue'
import { createPlanetGame } from '@/game/createGame'
import { gameEventBus } from '@/game/eventBus'
import type { HudSnapshot, LevelUpOffer, RunResult } from '@/game/types'
import { buildStartingStats, stardustMultiplierFrom } from '@/skills/skillTree'
import { useMetaStore } from '@/stores/metaStore'

const metaStore = useMetaStore()

const gameContainer = ref<HTMLDivElement | null>(null)
const hud = ref<HudSnapshot | null>(null)
const levelUpOffer = ref<LevelUpOffer | null>(null)
const runResult = ref<RunResult | null>(null)
const isPaused = ref(false)
const speedMultiplier = ref(1)

const SPEED_CYCLE: Array<number> = [1, 2, 5]

let game: Phaser.Game | null = null
const busUnsubscribes: Array<() => void> = []

function startGame(): void {
  if (gameContainer.value === null) {
    return
  }
  const unlockedNodeIds = metaStore.unlockedNodeIds
  game = createPlanetGame({
    parent: gameContainer.value,
    sceneData: {
      startingStats: buildStartingStats({ unlockedNodeIds }),
      stardustMultiplier: stardustMultiplierFrom({ unlockedNodeIds }),
    },
  })
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
  speedMultiplier.value = 1
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

function togglePause(): void {
  // the level-up and game-over flows own the scene's pause state
  if (levelUpOffer.value !== null || runResult.value !== null) {
    return
  }
  isPaused.value = isPaused.value === false
  gameEventBus.emit({ event: 'set-paused', payload: { isPaused: isPaused.value } })
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
        class="cursor-pointer rounded-lg px-4 py-2 text-sm font-bold transition"
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
        class="cursor-pointer rounded-lg bg-slate-900/80 px-4 py-2 text-sm font-semibold text-slate-300 transition hover:bg-slate-800"
        @click="togglePause()"
      >
        {{ isPaused === true ? 'Resume' : 'Pause' }}
      </button>
      <RouterLink
        to="/"
        class="rounded-lg bg-slate-900/80 px-4 py-2 text-sm font-semibold text-slate-300 transition hover:bg-slate-800"
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
      @choose="(payload) => chooseUpgrade(payload)"
    />

    <GameOverOverlay v-if="runResult !== null" :result="runResult" @restart="() => restartRun()" />
  </main>
</template>
