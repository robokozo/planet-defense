import Phaser from 'phaser'

import { ARENA } from '@/game/data/balance'
import { GameScene } from '@/game/scenes/GameScene'
import type { GameSceneData } from '@/game/types'

export function createPlanetGame({
  parent,
  sceneData,
}: {
  parent: HTMLElement
  sceneData: GameSceneData
}): Phaser.Game {
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: ARENA.width,
    height: ARENA.height,
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
