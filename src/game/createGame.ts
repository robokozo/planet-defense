import Phaser from 'phaser'

import { ARENA, PRESTIGE } from '@/game/data/balance'
import { GameScene } from '@/game/scenes/GameScene'
import type { GameSceneData } from '@/game/types'

export function createPlanetGame({
  parent,
  sceneData,
}: {
  parent: HTMLElement
  sceneData: GameSceneData
}): Phaser.Game {
  // a portrait container (mobile) gets a portrait arena; the scene lays its
  // battlefield out from the actual arena size, so both shapes work
  const isPortrait = parent.clientHeight > parent.clientWidth
  // every prestige grows the logical arena; FIT scaling shows it all on the
  // same screen, so the world reads as the camera pulling further back
  const zoomOut = 1 + PRESTIGE.zoomOutPerLevel * (sceneData.prestigeLevel ?? 0)
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: Math.round((isPortrait === true ? ARENA.portraitWidth : ARENA.width) * zoomOut),
    height: Math.round((isPortrait === true ? ARENA.portraitHeight : ARENA.height) * zoomOut),
    backgroundColor: '#05060f',
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    // the training range keeps simulating in hidden/background tabs so
    // automated benchmarks can run unattended
    fps: sceneData.mode === 'sandbox' ? { forceSetTimeOut: true } : undefined,
  })
  if (sceneData.mode === 'sandbox') {
    // Phaser sleeps its loop when the document is hidden; the training range
    // overrides that so benchmarks keep simulating in background tabs
    game.events.on(Phaser.Core.Events.HIDDEN, () => {
      game.loop.wake()
    })
    game.events.once(Phaser.Core.Events.READY, () => {
      game.loop.wake()
    })
  }
  game.scene.add('game', GameScene, true, sceneData)
  return game
}
