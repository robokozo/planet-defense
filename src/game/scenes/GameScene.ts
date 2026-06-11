import Phaser from 'phaser'

import {
  AIRSTRIKE,
  ARENA,
  BATTERY,
  BFG,
  BULLET,
  CHAIN,
  CLOUD,
  FLAK,
  BOSS,
  CLUSTER_BOMBS,
  GROUND,
  LANCE,
  LOCKDOWN,
  MINES,
  NOVA,
  ORBITAL_LASER,
  SHATTERPOINT,
  STORM_FRONT,
  SYNERGIES,
  RAILGUN,
  ROCKET,
  STARDUST,
  WAVES,
  XP,
} from '@/game/data/balance'
import {
  ENEMY_DEFINITIONS,
  listSpawnableDefinitions,
  pickWeightedDefinition,
  type EnemyDefinition,
} from '@/game/data/enemies'
import { countOwnedWeapons, findUpgradeDefinition, rollUpgradeChoices } from '@/game/data/upgrades'
import { gameEventBus } from '@/game/eventBus'
import type { GameSceneData, RunStats, SandboxLayout } from '@/game/types'

interface EnemyUnit {
  image: Phaser.GameObjects.Image
  definition: EnemyDefinition
  hp: number
  speed: number
  contactDamage: number
  xpValue: number
  radius: number
  maxHp: number
  directionX: number
  directionY: number
  isSlowed: boolean
  frozenRemainingMs: number
  /** bosses periodically deploy adds */
  spawnerAccumulatorMs: number
  /** training dummies on patrol sweep side to side */
  patrol: { baseX: number; amplitudeX: number; phase: number } | null
  isDead: boolean
}

interface SweepBeam {
  x: number
  endX: number
  directionX: number
  damage: number
  hitEnemies: Set<EnemyUnit>
  isDead: boolean
}

interface MineUnit {
  image: Phaser.GameObjects.Image
  armRemainingMs: number
  isDead: boolean
}

interface OrbitalStrikeUnit {
  x: number
  y: number
  lockRemainingMs: number
  isDead: boolean
}

interface IonTrailUnit {
  startX: number
  startY: number
  directionX: number
  directionY: number
  length: number
  remainingMs: number
  totalMs: number
  hitEnemies: Set<EnemyUnit>
  isDead: boolean
}

interface BulletUnit {
  image: Phaser.GameObjects.Image
  /** which weapon fired it, for damage attribution */
  source: string
  velocityX: number
  velocityY: number
  damage: number
  pierceLeft: number
  traveledPx: number
  maxTravelPx: number
  /** proximity-fused: detonates into fragments when close to a invader */
  isFlakShell: boolean
  hitEnemies: Set<EnemyUnit>
  isDead: boolean
}

interface RocketUnit {
  image: Phaser.GameObjects.Image
  velocityX: number
  velocityY: number
  damage: number
  blastRadius: number
  trailAccumulatorMs: number
  isDead: boolean
}

interface CannonUnit {
  x: number
  y: number
  baseImage: Phaser.GameObjects.Image
  barrelImage: Phaser.GameObjects.Image
  rangeRing: Phaser.GameObjects.Arc
  fireAccumulatorMs: number
  /** per-weapon cooldown accumulators — every cannon runs its own instance of each owned weapon */
  cooldowns: Map<string, number>
}

interface PlaneUnit {
  image: Phaser.GameObjects.Image
  velocityX: number
  velocityY: number
  dropAccumulatorMs: number
  trailAccumulatorMs: number
  /** cloud seeding synergy */
  seedAccumulatorMs: number
  /** close air support synergy */
  casAccumulatorMs: number
  /** sorties strafe out and back — one pass in each direction */
  passesRemaining: number
  isDead: boolean
}

interface BombUnit {
  image: Phaser.GameObjects.Image
  /** inherited from the plane, so bombs strafe forward instead of dropping straight */
  velocityX: number
  fuseRemainingMs: number
  damage: number
  blastRadius: number
  isDead: boolean
}

interface BuildingUnit {
  x: number
  textureKey: string
  image: Phaser.GameObjects.Image
  isDestroyed: boolean
}

const GROUND_Y = ARENA.height - GROUND.height
const CANNON_Y = GROUND_Y - 16
const SPAWN_Y = -30
const BARREL_LENGTH = 30
/** deploy order for the primary cannon and the three Auxiliary Cannon upgrades */
const CANNON_X_POSITIONS = [640, 940, 280, 1180] as const
const BUILDING_X_POSITIONS = [190, 360, 520, 800, 1080] as const
const BUILDING_HEIGHTS = [62, 96, 74, 108, 84] as const
/** which building collapses first, second, … as integrity falls */
const BUILDING_DESTRUCTION_ORDER = [4, 0, 3, 1, 2] as const
const BULLET_CULL_MARGIN = 60
const HUD_EMIT_INTERVAL_MS = 100
const REGEN_TICK_MS = 1_000
const MAX_CONCURRENT_GEMS = 60
const LEVEL_UP_CHOICE_COUNT = 3
const AEGIS_MIN_ALPHA = 0.15
const AEGIS_MAX_ALPHA = 0.9
const MAX_NANITE_DRONES = 3
/** at high game speed the sim runs in sub-steps this size, so fast bullets cannot tunnel through enemies */
const MAX_SIM_STEP_MS = 20
/** seconds per full side-to-side sweep of a patrolling training dummy */
const DUMMY_PATROL_PERIOD_S = 5

const COOLDOWN_BAR_WIDTH = 30
const WEAPON_BAR_COLORS: Record<string, number> = {
  main: 0x22d3ee,
  nova: 0x67e8f9,
  rocket: 0xfb923c,
  chain: 0x93c5fd,
  flak: 0xfdba74,
  lockdown: 0x7dd3fc,
  railgun: 0xe879f9,
  airstrike: 0xa3e635,
  bfg: 0x4ade80,
  lance: 0xf87171,
  mines: 0xfde047,
  'orbital-laser': 0xf43f5e,
  aegis: 0x38bdf8,
}
const WEAPON_BAR_LABELS: Record<string, string> = {
  main: 'GUN',
  nova: 'NOVA',
  rocket: 'RKT',
  chain: 'ARC',
  flak: 'FLAK',
  lockdown: 'LOCK',
  railgun: 'RAIL',
  airstrike: 'AIR',
  bfg: 'BFG',
  lance: 'LANCE',
  mines: 'MINE',
  'orbital-laser': 'ORB',
  aegis: 'AEGIS',
}

const DEPTHS = {
  sky: 0,
  clouds: 0.5,
  rangeRing: 1,
  ground: 2,
  buildings: 3,
  shield: 3.5,
  barrel: 4,
  units: 4.5,
  cannonBase: 5,
  bullets: 5.5,
  effects: 6,
} as const

export class GameScene extends Phaser.Scene {
  private stats!: RunStats
  private stardustMultiplier = 1

  private hp = 0
  private level = 1
  private xp = 0
  private xpToNext = 0
  private wave = 1
  private kills = 0
  private elapsedMs = 0

  private enemies: Array<EnemyUnit> = []
  private bullets: Array<BulletUnit> = []
  private rockets: Array<RocketUnit> = []
  private cannons: Array<CannonUnit> = []
  private buildings: Array<BuildingUnit> = []
  private cloudImages: Array<{ image: Phaser.GameObjects.Image; speed: number }> = []
  private gemCount = 0

  private spawnAccumulatorMs = 0
  private waveAccumulatorMs = 0
  private regenAccumulatorMs = 0
  private airstrikeAccumulatorMs = 0
  private bfgAccumulatorMs = 0
  private lanceAccumulatorMs = 0
  private mineAccumulatorMs = 0
  private orbitalAccumulatorMs = 0
  private stormAccumulatorMs = 0
  private aegisAccumulatorMs = 0
  private hudAccumulatorMs = 0

  private upgradeStacks = new Map<string, number>()
  private pendingLevelUps = 0
  private hasActiveOffer = false
  private isRunOver = false
  private speedMultiplier = 1

  /** training-range mode: static invincible dummies, no waves, dps reporting */
  private isSandbox = false
  private sandboxLayout: SandboxLayout = { formation: 'field', spread: 1, isMoving: false }
  private damageBySource = new Map<string, number>()
  private sandboxStatsAccumulatorMs = 0

  private planes: Array<PlaneUnit> = []
  private bombs: Array<BombUnit> = []
  private sweeps: Array<SweepBeam> = []
  private sweepGraphics!: Phaser.GameObjects.Graphics
  private mines: Array<MineUnit> = []
  private orbitalStrikes: Array<OrbitalStrikeUnit> = []
  private ionTrails: Array<IonTrailUnit> = []
  private naniteDrones: Array<Phaser.GameObjects.Image> = []
  private shieldImage!: Phaser.GameObjects.Image
  private cooldownBars!: Phaser.GameObjects.Graphics
  private barLabels = new Map<string, Phaser.GameObjects.Text>()
  private busUnsubscribes: Array<() => void> = []

  constructor() {
    super({ key: 'game' })
  }

  init(data: GameSceneData): void {
    this.stats = { ...data.startingStats }
    this.stardustMultiplier = data.stardustMultiplier
    this.hp = this.stats.maxHp
    this.xpToNext = this.xpRequiredForLevel({ level: this.level })
    this.isSandbox = data.mode === 'sandbox'
    this.sandboxLayout = data.sandboxLayout ?? { formation: 'field', spread: 1, isMoving: false }
    if (data.initialCardStacks !== undefined) {
      for (const [cardId, stacks] of Object.entries(data.initialCardStacks)) {
        if (stacks > 0) {
          this.upgradeStacks.set(cardId, stacks)
        }
      }
    }
  }

  create(): void {
    this.generateTextures()
    this.drawSky()
    this.spawnClouds()
    this.drawGround()
    this.spawnBuildings()

    // the shield ring is the aegis keystone made visible: hidden without it,
    // dim while recharging, bright when a block is ready
    this.shieldImage = this.add
      .image(CANNON_X_POSITIONS[0], CANNON_Y, 'shield')
      .setDepth(DEPTHS.shield)
      .setVisible(this.stats.aegisIntervalMs !== null)
      .setAlpha(AEGIS_MIN_ALPHA)
    this.syncCannons()
    this.cooldownBars = this.add.graphics().setDepth(DEPTHS.effects)
    this.sweepGraphics = this.add.graphics().setDepth(DEPTHS.effects)

    if (this.isSandbox === true) {
      this.spawnTrainingDummies()
      this.syncNaniteDrones()
      this.syncCloudCover()
    }

    this.busUnsubscribes.push(
      gameEventBus.on({
        event: 'upgrade-chosen',
        handler: (payload) => {
          this.applyUpgrade({ upgradeId: payload.upgradeId })
        },
      }),
      gameEventBus.on({
        event: 'set-paused',
        handler: (payload) => {
          this.setPausedFromUi({ isPaused: payload.isPaused })
        },
      }),
      gameEventBus.on({
        event: 'set-speed',
        handler: (payload) => {
          this.speedMultiplier = payload.multiplier
          this.tweens.timeScale = payload.multiplier
          this.time.timeScale = payload.multiplier
        },
      }),
      gameEventBus.on({
        event: 'sandbox-fastforward',
        handler: (payload) => {
          if (this.isSandbox === false) {
            return
          }
          let remainingMs = payload.gameMs
          while (remainingMs > 0) {
            const stepMs = Math.min(remainingMs, MAX_SIM_STEP_MS)
            this.simulateStep({ delta: stepMs })
            remainingMs -= stepMs
          }
          this.emitSandboxStats()
        },
      }),
      gameEventBus.on({
        event: 'sandbox-configure',
        handler: (payload) => {
          if (this.isSandbox === false) {
            return
          }
          this.resetSandbox(payload)
        },
      }),
    )

    const unsubscribeAll = (): void => {
      for (const unsubscribe of this.busUnsubscribes) {
        unsubscribe()
      }
      this.busUnsubscribes = []
    }
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      unsubscribeAll()
    })
    this.events.once(Phaser.Scenes.Events.DESTROY, () => {
      unsubscribeAll()
    })

    this.emitHudSnapshot()
  }

  override update(_time: number, delta: number): void {
    if (this.isRunOver === true) {
      return
    }

    let remainingMs = delta * this.speedMultiplier
    while (remainingMs > 0 && this.canSimulate() === true) {
      const stepMs = Math.min(remainingMs, MAX_SIM_STEP_MS)
      this.simulateStep({ delta: stepMs })
      remainingMs -= stepMs
    }

    this.drawCooldownBars()
    this.drawSweepBeams()

    this.hudAccumulatorMs += delta
    if (this.hudAccumulatorMs >= HUD_EMIT_INTERVAL_MS) {
      this.hudAccumulatorMs = 0
      this.emitHudSnapshot()
    }

    if (this.isSandbox === true) {
      this.sandboxStatsAccumulatorMs += delta
      if (this.sandboxStatsAccumulatorMs >= 500) {
        this.sandboxStatsAccumulatorMs = 0
        this.emitSandboxStats()
      }
    }
  }

  private emitSandboxStats(): void {
    const elapsedSeconds = Math.max(0.001, this.elapsedMs / 1_000)
    const entries = [...this.damageBySource.entries()]
      .map(([source, total]) => ({ source, total, dps: total / elapsedSeconds }))
      .sort((a, b) => b.dps - a.dps)
    gameEventBus.emit({
      event: 'sandbox-stats',
      payload: { entries, elapsedMs: this.elapsedMs },
    })
  }

  /** tear down every dynamic object and rebuild with a new loadout, all synchronously */
  private resetSandbox({
    stats,
    cardStacks,
    layout,
  }: {
    stats: RunStats
    cardStacks: Record<string, number>
    layout: SandboxLayout
  }): void {
    this.tweens.killAll()

    for (const enemy of this.enemies) {
      enemy.image.destroy()
    }
    this.enemies = []
    for (const bullet of this.bullets) {
      bullet.image.destroy()
    }
    this.bullets = []
    for (const rocket of this.rockets) {
      rocket.image.destroy()
    }
    this.rockets = []
    for (const plane of this.planes) {
      plane.image.destroy()
    }
    this.planes = []
    for (const bomb of this.bombs) {
      bomb.image.destroy()
    }
    this.bombs = []
    for (const mine of this.mines) {
      mine.image.destroy()
    }
    this.mines = []
    for (const drone of this.naniteDrones) {
      drone.destroy()
    }
    this.naniteDrones = []
    for (const cannon of this.cannons) {
      cannon.baseImage.destroy()
      cannon.barrelImage.destroy()
      cannon.rangeRing.destroy()
    }
    this.cannons = []
    for (const cloud of this.cloudImages) {
      cloud.image.destroy()
    }
    this.cloudImages = []
    this.sweeps = []
    this.orbitalStrikes = []
    this.ionTrails = []

    this.stats = { ...stats }
    this.sandboxLayout = layout
    this.upgradeStacks = new Map(Object.entries(cardStacks).filter(([, stacks]) => stacks > 0))
    this.hp = this.stats.maxHp
    this.elapsedMs = 0
    this.damageBySource = new Map()
    this.airstrikeAccumulatorMs = 0
    this.bfgAccumulatorMs = 0
    this.lanceAccumulatorMs = 0
    this.mineAccumulatorMs = 0
    this.orbitalAccumulatorMs = 0
    this.stormAccumulatorMs = 0
    this.aegisAccumulatorMs = 0

    this.shieldImage.setVisible(this.stats.aegisIntervalMs !== null).setAlpha(AEGIS_MIN_ALPHA)
    this.spawnClouds()
    this.syncCannons()
    this.spawnTrainingDummies()
    this.syncNaniteDrones()
    this.syncCloudCover()
    this.emitSandboxStats()
  }

  private spawnTrainingDummies(): void {
    const layout = this.sandboxLayout

    if (layout.formation === 'boss') {
      this.spawnDummy({
        x: ARENA.width / 2,
        y: 300,
        radius: 40,
        scale: 2.5,
        patrolAmplitude: layout.isMoving === true ? 150 : 0,
        patrolPhase: 0,
      })
      return
    }

    const rows = [
      { y: 250, count: 6 },
      { y: 400, count: 6 },
      { y: 550, count: 4 },
    ]
    let dummyIndex = 0
    for (const row of rows) {
      for (let index = 0; index < row.count; index += 1) {
        const offsetFromCenter = (index - (row.count - 1) / 2) * 190 * layout.spread
        dummyIndex += 1
        this.spawnDummy({
          x: ARENA.width / 2 + offsetFromCenter,
          y: row.y,
          radius: ENEMY_DEFINITIONS.dummy.radius,
          scale: 1,
          patrolAmplitude: layout.isMoving === true ? 80 * layout.spread : 0,
          patrolPhase: dummyIndex * 1.3,
        })
      }
    }
  }

  private spawnDummy({
    x,
    y,
    radius,
    scale,
    patrolAmplitude,
    patrolPhase,
  }: {
    x: number
    y: number
    radius: number
    scale: number
    patrolAmplitude: number
    patrolPhase: number
  }): void {
    const image = this.add.image(x, y, 'enemy-dummy').setScale(scale).setDepth(DEPTHS.units)
    this.enemies.push({
      image,
      definition: ENEMY_DEFINITIONS.dummy,
      hp: Number.POSITIVE_INFINITY,
      maxHp: Number.POSITIVE_INFINITY,
      speed: 0,
      contactDamage: 0,
      xpValue: 0,
      radius,
      directionX: 0,
      directionY: 0,
      isSlowed: false,
      frozenRemainingMs: 0,
      spawnerAccumulatorMs: 0,
      patrol:
        patrolAmplitude > 0 ? { baseX: x, amplitudeX: patrolAmplitude, phase: patrolPhase } : null,
      isDead: false,
    })
  }

  private canSimulate(): boolean {
    return this.isRunOver === false && this.hasActiveOffer === false
  }

  private simulateStep({ delta }: { delta: number }): void {
    this.elapsedMs += delta

    this.driftClouds({ delta })
    if (this.isSandbox === false) {
      this.advanceWaveClock({ delta })
      this.spawnFromClock({ delta })
    }
    this.fireFromClock({ delta })
    this.moveBullets({ delta })
    this.moveEnemies({ delta })
    this.updateCannonWeapons({ delta })
    this.moveRockets({ delta })
    this.updateAirstrike({ delta })
    this.updateBfg({ delta })
    this.updateThermalLance({ delta })
    this.updateMines({ delta })
    this.updateOrbitalLaser({ delta })
    this.updateStormFront({ delta })
    this.updateIonTrails({ delta })
    this.updateBossSpawners({ delta })
    this.updateAegis({ delta })
    this.checkFlakFuses()
    this.collideBulletsWithEnemies()
    this.collideEnemiesWithGround()
    this.applyRegen({ delta })
    this.syncBuildings()
    this.cullDeadUnits()
  }

  // ── clocks ─────────────────────────────────────────────────────────

  private advanceWaveClock({ delta }: { delta: number }): void {
    this.waveAccumulatorMs += delta
    if (this.waveAccumulatorMs >= WAVES.durationMs) {
      this.waveAccumulatorMs -= WAVES.durationMs
      this.wave += 1
      if (this.wave % BOSS.everyNWaves === 0) {
        this.spawnEnemy({
          definition: ENEMY_DEFINITIONS.mothership,
          spawnX: ARENA.width / 2 + (Math.random() * 2 - 1) * 200,
          impactX: CANNON_X_POSITIONS[0],
        })
      } else if (this.wave % WAVES.eliteEveryNWaves === 0) {
        this.spawnEnemy({ definition: ENEMY_DEFINITIONS.elite })
      }
    }
  }

  private spawnFromClock({ delta }: { delta: number }): void {
    const interval = Math.max(
      WAVES.minSpawnIntervalMs,
      WAVES.initialSpawnIntervalMs - (this.wave - 1) * WAVES.spawnIntervalStepMs,
    )
    this.spawnAccumulatorMs += delta
    while (this.spawnAccumulatorMs >= interval) {
      this.spawnAccumulatorMs -= interval
      const definitions = listSpawnableDefinitions({ wave: this.wave })
      const definition = pickWeightedDefinition({ definitions, roll: Math.random() })
      this.spawnEnemy({ definition })
    }
  }

  private fireFromClock({ delta }: { delta: number }): void {
    for (const cannon of this.cannons) {
      cannon.fireAccumulatorMs += delta
      if (cannon.fireAccumulatorMs < this.stats.fireIntervalMs) {
        continue
      }
      const targets = this.findMostUrgentEnemiesInRange({
        originX: cannon.x,
        originY: cannon.y,
        count: this.stats.projectileCount,
      })
      if (targets.length === 0) {
        cannon.fireAccumulatorMs = this.stats.fireIntervalMs
        continue
      }
      while (cannon.fireAccumulatorMs >= this.stats.fireIntervalMs) {
        cannon.fireAccumulatorMs -= this.stats.fireIntervalMs
        this.fireVolley({ cannon, targets })
      }
    }
  }

  private applyRegen({ delta }: { delta: number }): void {
    if (this.stats.regenPerSecond <= 0) {
      return
    }
    this.regenAccumulatorMs += delta
    while (this.regenAccumulatorMs >= REGEN_TICK_MS) {
      this.regenAccumulatorMs -= REGEN_TICK_MS
      this.hp = Math.min(this.stats.maxHp, this.hp + this.stats.regenPerSecond)
    }
  }

  // ── spawning and movement ──────────────────────────────────────────

  private listImpactTargetXs(): Array<number> {
    const targets: Array<number> = []
    for (const building of this.buildings) {
      if (building.isDestroyed === false) {
        targets.push(building.x)
      }
    }
    for (const cannon of this.cannons) {
      targets.push(cannon.x)
    }
    return targets
  }

  private spawnEnemy({
    definition,
    spawnX,
    spawnY,
    impactX,
  }: {
    definition: EnemyDefinition
    spawnX?: number
    spawnY?: number
    impactX?: number
  }): void {
    const x = spawnX ?? Math.random() * ARENA.width
    const y = spawnY ?? SPAWN_Y
    const targetXs = this.listImpactTargetXs()
    const targetX = targetXs[Math.floor(Math.random() * targetXs.length)]
    const resolvedImpactX = impactX ?? targetX + (Math.random() * 2 - 1) * 40

    const waveScale = Math.pow(WAVES.hpGrowthPerWave, this.wave - 1)
    const speedScale = Math.min(2, Math.pow(WAVES.speedGrowthPerWave, this.wave - 1))

    const fallAngle = Math.atan2(GROUND_Y - y, resolvedImpactX - x)
    const image = this.add
      .image(x, y, definition.textureKey)
      .setDepth(DEPTHS.units)
      .setRotation(definition.kind === 'mothership' ? 0 : fallAngle)

    const hp = definition.hp * waveScale
    this.enemies.push({
      image,
      definition,
      hp,
      maxHp: hp,
      speed: definition.speed * speedScale,
      contactDamage: definition.contactDamage,
      xpValue: definition.xpValue,
      radius: definition.radius,
      directionX: Math.cos(fallAngle),
      directionY: Math.sin(fallAngle),
      isSlowed: false,
      frozenRemainingMs: 0,
      spawnerAccumulatorMs: 0,
      patrol: null,
      isDead: false,
    })
  }

  private cloudSlowFactor(): number {
    if (this.stats.cloudLevel <= 0) {
      return 1
    }
    return Math.max(
      CLOUD.slowFactorMin,
      CLOUD.slowFactorBase - CLOUD.slowFactorPerLevel * (this.stats.cloudLevel - 1),
    )
  }

  /** current real speed in px/s — 0 while frozen, reduced inside clouds */
  private effectiveEnemySpeed({ enemy }: { enemy: EnemyUnit }): number {
    if (enemy.frozenRemainingMs > 0) {
      return 0
    }
    if (enemy.isSlowed === true) {
      return enemy.speed * this.cloudSlowFactor()
    }
    return enemy.speed
  }

  private moveEnemies({ delta }: { delta: number }): void {
    const seconds = delta / 1_000
    const hasCloudCover = this.stats.cloudLevel > 0

    for (const enemy of this.enemies) {
      if (enemy.isDead === true) {
        continue
      }

      if (enemy.frozenRemainingMs > 0) {
        enemy.frozenRemainingMs -= delta
        if (enemy.frozenRemainingMs <= 0 && enemy.image.tintMode === Phaser.TintModes.MULTIPLY) {
          enemy.image.clearTint()
          enemy.isSlowed = false
        }
        continue
      }

      if (enemy.patrol !== null) {
        // sine patrol with honest velocity, so intercept prediction stays fair
        const omega = (Math.PI * 2) / DUMMY_PATROL_PERIOD_S
        const t = this.elapsedMs / 1_000
        enemy.image.x =
          enemy.patrol.baseX + Math.sin(t * omega + enemy.patrol.phase) * enemy.patrol.amplitudeX
        const velocityX = enemy.patrol.amplitudeX * omega * Math.cos(t * omega + enemy.patrol.phase)
        enemy.speed = Math.abs(velocityX)
        enemy.directionX = velocityX >= 0 ? 1 : -1
        enemy.directionY = 0
        continue
      }

      const isSlowed =
        hasCloudCover === true &&
        this.isInsideAnyCloud({ x: enemy.image.x, y: enemy.image.y }) === true
      if (isSlowed !== enemy.isSlowed && enemy.image.tintMode === Phaser.TintModes.MULTIPLY) {
        if (isSlowed === true) {
          enemy.image.setTint(0xa8c8f8)
        } else {
          enemy.image.clearTint()
        }
      }
      enemy.isSlowed = isSlowed
      const speed = this.effectiveEnemySpeed({ enemy })
      enemy.image.x += enemy.directionX * speed * seconds
      enemy.image.y += enemy.directionY * speed * seconds
    }
  }

  private isInsideAnyCloud({ x, y }: { x: number; y: number }): boolean {
    for (const cloud of this.cloudImages) {
      const halfWidth = cloud.image.displayWidth * 0.45
      const halfHeight = cloud.image.displayHeight * 0.55
      if (Math.abs(x - cloud.image.x) <= halfWidth && Math.abs(y - cloud.image.y) <= halfHeight) {
        return true
      }
    }
    return false
  }

  private moveBullets({ delta }: { delta: number }): void {
    const seconds = delta / 1_000
    for (const bullet of this.bullets) {
      if (bullet.isDead === true) {
        continue
      }
      bullet.image.x += bullet.velocityX * seconds
      bullet.image.y += bullet.velocityY * seconds
      bullet.traveledPx += Math.hypot(bullet.velocityX, bullet.velocityY) * seconds
      const isOutOfBounds =
        bullet.image.x < -BULLET_CULL_MARGIN ||
        bullet.image.x > ARENA.width + BULLET_CULL_MARGIN ||
        bullet.image.y < -BULLET_CULL_MARGIN ||
        bullet.image.y > GROUND_Y
      if (bullet.traveledPx >= bullet.maxTravelPx || isOutOfBounds === true) {
        if (bullet.isFlakShell === true) {
          // the timed fuse: burst at end of flight instead of fizzling
          this.detonateFlakShell({ bullet, triggerEnemy: null })
        } else {
          bullet.isDead = true
        }
      }
    }
  }

  // ── weapons ────────────────────────────────────────────────────────

  /** the falling enemies closest to the ground win; ties to the base's fate are settled low */
  private findMostUrgentEnemiesInRange({
    originX,
    originY,
    count,
  }: {
    originX: number
    originY: number
    count: number
  }): Array<EnemyUnit> {
    const rangeSq = this.stats.range ** 2
    const inRange = this.enemies.filter((enemy) => {
      if (enemy.isDead === true) {
        return false
      }
      const distanceSq = (enemy.image.x - originX) ** 2 + (enemy.image.y - originY) ** 2
      return distanceSq <= rangeSq
    })
    inRange.sort((a, b) => b.image.y - a.image.y)
    return inRange.slice(0, count)
  }

  /**
   * Where the shot will meet the falling target, not where it is now.
   * Solves |targetPos + targetVel·t − muzzle| = bulletSpeed·t for the
   * soonest positive t; null when no solution exists.
   */
  private computeInterceptPoint({
    originX,
    originY,
    target,
    projectileSpeed,
  }: {
    originX: number
    originY: number
    target: EnemyUnit
    projectileSpeed: number
  }): { x: number; y: number } | null {
    const deltaX = target.image.x - originX
    const deltaY = target.image.y - originY
    const targetSpeed = this.effectiveEnemySpeed({ enemy: target })
    const velocityX = target.directionX * targetSpeed
    const velocityY = target.directionY * targetSpeed
    const bulletSpeed = projectileSpeed

    const a = velocityX ** 2 + velocityY ** 2 - bulletSpeed ** 2
    const b = 2 * (deltaX * velocityX + deltaY * velocityY)
    const c = deltaX ** 2 + deltaY ** 2

    let interceptTime: number | null = null
    if (Math.abs(a) < 1e-6) {
      if (Math.abs(b) > 1e-6) {
        const t = -c / b
        interceptTime = t > 0 ? t : null
      }
    } else {
      const discriminant = b ** 2 - 4 * a * c
      if (discriminant >= 0) {
        const sqrtDiscriminant = Math.sqrt(discriminant)
        const t1 = (-b - sqrtDiscriminant) / (2 * a)
        const t2 = (-b + sqrtDiscriminant) / (2 * a)
        const candidates = [t1, t2].filter((t) => t > 0)
        interceptTime = candidates.length > 0 ? Math.min(...candidates) : null
      }
    }

    if (interceptTime === null) {
      return null
    }
    return {
      x: target.image.x + velocityX * interceptTime,
      y: target.image.y + velocityY * interceptTime,
    }
  }

  /** intercept aim angle; falls back to the target's current position if no solution */
  private computeInterceptAngle({
    originX,
    originY,
    target,
    projectileSpeed,
  }: {
    originX: number
    originY: number
    target: EnemyUnit
    projectileSpeed: number
  }): number {
    const point = this.computeInterceptPoint({ originX, originY, target, projectileSpeed })
    if (point === null) {
      return Math.atan2(target.image.y - originY, target.image.x - originX)
    }
    return Math.atan2(point.y - originY, point.x - originX)
  }

  private fireVolley({ cannon, targets }: { cannon: CannonUnit; targets: Array<EnemyUnit> }): void {
    const muzzleY = cannon.y - 6
    const count = this.stats.projectileCount
    /* example jitter when shots double up on a target: ±0.035 rad ≈ ±2° */
    const doubledUpJitterRad = 0.035

    for (let index = 0; index < count; index += 1) {
      const target = targets[index % targets.length]
      const isDoubledUp = index >= targets.length
      const interceptAngle = this.computeInterceptAngle({
        originX: cannon.x,
        originY: muzzleY,
        target,
        projectileSpeed: this.stats.projectileSpeed,
      })
      const angle =
        isDoubledUp === true
          ? interceptAngle + (Math.random() * 2 - 1) * doubledUpJitterRad
          : interceptAngle
      if (index === 0) {
        cannon.barrelImage.setRotation(angle)
      }
      const isCrit = Math.random() < this.stats.critChance
      const damage =
        isCrit === true ? this.stats.damage * this.stats.critMultiplier : this.stats.damage

      const image = this.add
        .image(
          cannon.x + Math.cos(angle) * BARREL_LENGTH,
          muzzleY + Math.sin(angle) * BARREL_LENGTH,
          'bullet',
        )
        .setDepth(DEPTHS.bullets)
      if (isCrit === true) {
        image.setScale(1.5).setTint(0xfde047)
      }

      this.bullets.push({
        image,
        source: 'main',
        velocityX: Math.cos(angle) * this.stats.projectileSpeed,
        velocityY: Math.sin(angle) * this.stats.projectileSpeed,
        damage,
        pierceLeft: this.stats.pierce,
        traveledPx: 0,
        maxTravelPx: this.stats.range,
        isFlakShell: false,
        hitEnemies: new Set(),
        isDead: false,
      })
    }
  }

  // ── flak gun ───────────────────────────────────────────────────────

  private fireFlakShell({ cannon }: { cannon: CannonUnit }): boolean {
    // flak barrage synergy: the fire-control computer hands the gun extra targets
    const targetCount = 1 + SYNERGIES.barrage.extraTargetsPerLevel * this.stats.barrageLevel
    const targets = this.findMostUrgentEnemiesInRange({
      originX: cannon.x,
      originY: cannon.y,
      count: targetCount,
    })
    if (targets.length === 0) {
      return false
    }

    const muzzleY = cannon.y - 6
    const shellSpeed = this.stats.projectileSpeed * FLAK.shellSpeedFactor
    for (const target of targets) {
      const interceptPoint = this.computeInterceptPoint({
        originX: cannon.x,
        originY: muzzleY,
        target,
        projectileSpeed: shellSpeed,
      }) ?? { x: target.image.x, y: target.image.y }
      const angle = Math.atan2(interceptPoint.y - muzzleY, interceptPoint.x - cannon.x)
      cannon.barrelImage.setRotation(angle)
      const image = this.add
        .image(
          cannon.x + Math.cos(angle) * BARREL_LENGTH,
          muzzleY + Math.sin(angle) * BARREL_LENGTH,
          'flak-shell',
        )
        .setScale(1 + 0.1 * (this.stats.flakLevel - 1))
        .setDepth(DEPTHS.bullets)

      // timed fuse: if the proximity trigger never fires, the shell bursts
      // right where the target was predicted to be
      const fuseTravelPx = Math.min(
        this.stats.range,
        Math.hypot(interceptPoint.x - cannon.x, interceptPoint.y - muzzleY) + FLAK.fuseOvershootPx,
      )

      this.bullets.push({
        image,
        source: 'flak',
        velocityX: Math.cos(angle) * shellSpeed,
        velocityY: Math.sin(angle) * shellSpeed,
        damage: this.stats.damage,
        pierceLeft: 0,
        traveledPx: 0,
        maxTravelPx: fuseTravelPx,
        isFlakShell: true,
        hitEnemies: new Set(),
        isDead: false,
      })
    }
    return true
  }

  private checkFlakFuses(): void {
    if (this.stats.flakLevel <= 0) {
      return
    }
    for (const bullet of this.bullets) {
      if (bullet.isDead === true || bullet.isFlakShell === false) {
        continue
      }
      for (const enemy of this.enemies) {
        if (enemy.isDead === true) {
          continue
        }
        const fuseRange = enemy.radius + FLAK.fuseDistancePx
        const distanceSq =
          (enemy.image.x - bullet.image.x) ** 2 + (enemy.image.y - bullet.image.y) ** 2
        if (distanceSq <= fuseRange ** 2) {
          this.detonateFlakShell({ bullet, triggerEnemy: enemy })
          break
        }
      }
    }
  }

  private detonateFlakShell({
    bullet,
    triggerEnemy,
  }: {
    bullet: BulletUnit
    triggerEnemy: EnemyUnit | null
  }): void {
    bullet.isDead = true
    const burstX = bullet.image.x
    const burstY = bullet.image.y

    // the shell itself wounds whatever tripped the fuse; fragments are the bonus
    if (triggerEnemy !== null) {
      this.damageEnemy({ enemy: triggerEnemy, amount: bullet.damage, source: 'flak' })
    }

    const flash = this.add
      .circle(burstX, burstY, 8)
      .setStrokeStyle(2 + 0.6 * (this.stats.flakLevel - 1), 0xfdba74, 0.9)
      .setDepth(DEPTHS.effects)
    this.tweens.add({
      targets: flash,
      radius: 26 + 5 * (this.stats.flakLevel - 1),
      alpha: 0,
      duration: 180,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        flash.destroy()
      },
    })

    const fragmentCount = FLAK.baseFragments + FLAK.fragmentsPerLevel * (this.stats.flakLevel - 1)
    const fragmentDamage =
      (bullet.damage *
        (FLAK.baseDamagePercent + FLAK.damagePercentPerLevel * (this.stats.flakLevel - 1))) /
      100
    const baseFragmentSpeed = this.stats.projectileSpeed * FLAK.fragmentSpeedFactor
    // one fragment is aimed straight at the invader that tripped the fuse (with
    // barely any scatter); the rest spray out in a roughly even but messy ring.
    // a timed-fuse burst has no trigger — it sprays around the flight direction
    const aimedAngle =
      triggerEnemy !== null
        ? Math.atan2(triggerEnemy.image.y - burstY, triggerEnemy.image.x - burstX)
        : Math.atan2(bullet.velocityY, bullet.velocityX)
    const ringSpacing = (Math.PI * 2) / fragmentCount

    for (let index = 0; index < fragmentCount; index += 1) {
      const isAimedFragment = index === 0
      const angleJitter = isAimedFragment === true ? 0.06 : ringSpacing * 0.45
      const angle = aimedAngle + index * ringSpacing + (Math.random() * 2 - 1) * angleJitter
      const fragmentSpeed = baseFragmentSpeed * (0.75 + Math.random() * 0.5)
      const travelJitter = isAimedFragment === true ? 1 : 0.65 + Math.random() * 0.7
      const image = this.add.image(burstX, burstY, 'flak-frag').setDepth(DEPTHS.bullets)
      this.bullets.push({
        image,
        source: 'flak',
        velocityX: Math.cos(angle) * fragmentSpeed,
        velocityY: Math.sin(angle) * fragmentSpeed,
        damage: fragmentDamage,
        pierceLeft: 0,
        traveledPx: 0,
        maxTravelPx: FLAK.fragmentTravelPx * travelJitter,
        isFlakShell: false,
        hitEnemies: new Set(),
        isDead: false,
      })
    }
  }

  private fireNova({
    cannon,
    damageMultiplier = 1,
  }: {
    cannon: CannonUnit
    damageMultiplier?: number
  }): boolean {
    const novaStacks = Math.max(1, this.upgradeStacks.get('nova') ?? 1)
    const originX = cannon.x
    const ring = this.add
      .circle(originX, CANNON_Y, BATTERY.shieldRadius)
      .setStrokeStyle(4 + 1.5 * (novaStacks - 1), 0x67e8f9, 0.9)
      .setDepth(DEPTHS.effects)
    this.tweens.add({
      targets: ring,
      radius: NOVA.maxRadius,
      alpha: 0,
      duration: NOVA.expandDurationMs,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        ring.destroy()
      },
    })

    const stasisFreezeMs =
      this.stats.stasisLevel > 0
        ? SYNERGIES.stasis.freezeMsBase +
          SYNERGIES.stasis.freezeMsPerLevel * (this.stats.stasisLevel - 1)
        : 0
    for (const enemy of this.enemies) {
      if (enemy.isDead === true) {
        continue
      }
      const distanceSq = (enemy.image.x - originX) ** 2 + (enemy.image.y - CANNON_Y) ** 2
      if (distanceSq <= (NOVA.maxRadius + enemy.radius) ** 2) {
        if (stasisFreezeMs > 0) {
          this.applyFreeze({ enemy, durationMs: stasisFreezeMs })
        }
        this.damageEnemy({
          enemy,
          amount: this.stats.novaDamage * damageMultiplier,
          source: 'nova',
        })
      }
    }
    return true
  }

  private applyFreeze({ enemy, durationMs }: { enemy: EnemyUnit; durationMs: number }): void {
    enemy.frozenRemainingMs = Math.max(enemy.frozenRemainingMs, durationMs)
    if (enemy.image.tintMode === Phaser.TintModes.MULTIPLY) {
      enemy.image.setTint(0xbae6fd)
    }
  }

  // ── rockets ────────────────────────────────────────────────────────

  private rocketBlastRadius(): number {
    return ROCKET.baseRadius + ROCKET.radiusPerLevel * (this.stats.rocketLevel - 1)
  }

  private moveRockets({ delta }: { delta: number }): void {
    const seconds = delta / 1_000
    for (const rocket of this.rockets) {
      if (rocket.isDead === true) {
        continue
      }
      rocket.image.x += rocket.velocityX * seconds
      rocket.image.y += rocket.velocityY * seconds
      rocket.trailAccumulatorMs += delta
      if (rocket.trailAccumulatorMs >= 45) {
        rocket.trailAccumulatorMs = 0
        const speed = Math.hypot(rocket.velocityX, rocket.velocityY)
        this.spawnExhaustPuff({
          x: rocket.image.x - (rocket.velocityX / speed) * 12,
          y: rocket.image.y - (rocket.velocityY / speed) * 12,
          color: Math.random() < 0.5 ? 0xfb923c : 0x94a3b8,
        })
      }

      for (const enemy of this.enemies) {
        if (enemy.isDead === true) {
          continue
        }
        const hitRange = enemy.radius + 8
        const distanceSq =
          (enemy.image.x - rocket.image.x) ** 2 + (enemy.image.y - rocket.image.y) ** 2
        if (distanceSq <= hitRange ** 2) {
          this.explodeRocket({ rocket })
          break
        }
      }
      if (rocket.isDead === false && rocket.image.y >= GROUND_Y - 6) {
        this.explodeRocket({ rocket })
      }
      const isOutOfBounds =
        rocket.image.x < -BULLET_CULL_MARGIN ||
        rocket.image.x > ARENA.width + BULLET_CULL_MARGIN ||
        rocket.image.y < -BULLET_CULL_MARGIN
      if (rocket.isDead === false && isOutOfBounds === true) {
        rocket.isDead = true
      }
    }
  }

  /** the enemy with the most neighbors inside the blast radius — densest cluster */
  private findClusterTarget({ pool }: { pool?: Array<EnemyUnit> } = {}): EnemyUnit | null {
    const candidates = pool ?? this.enemies
    const blastRadiusSq = this.rocketBlastRadius() ** 2
    let bestTarget: EnemyUnit | null = null
    let bestNeighborCount = -1
    for (const candidate of candidates) {
      if (candidate.isDead === true) {
        continue
      }
      let neighborCount = 0
      for (const other of this.enemies) {
        if (other.isDead === true || other === candidate) {
          continue
        }
        const distanceSq =
          (other.image.x - candidate.image.x) ** 2 + (other.image.y - candidate.image.y) ** 2
        if (distanceSq <= blastRadiusSq) {
          neighborCount += 1
        }
      }
      const isBetter =
        neighborCount > bestNeighborCount ||
        (neighborCount === bestNeighborCount &&
          bestTarget !== null &&
          candidate.image.y > bestTarget.image.y)
      if (isBetter === true) {
        bestNeighborCount = neighborCount
        bestTarget = candidate
      }
    }
    return bestTarget
  }

  private fireRocket({ cannon }: { cannon: CannonUnit }): boolean {
    const target = this.findClusterTarget()
    if (target === null) {
      return false
    }
    this.launchRocket({ originX: cannon.x, originY: cannon.y - 6, target })
    return true
  }

  private launchRocket({
    originX,
    originY,
    target,
  }: {
    originX: number
    originY: number
    target: EnemyUnit
  }): void {
    const angle = this.computeInterceptAngle({
      originX,
      originY,
      target,
      projectileSpeed: ROCKET.speed,
    })
    const image = this.add
      .image(
        originX + Math.cos(angle) * BARREL_LENGTH,
        originY + Math.sin(angle) * BARREL_LENGTH,
        'rocket',
      )
      .setRotation(angle)
      .setScale(1 + 0.12 * (this.stats.rocketLevel - 1))
      .setDepth(DEPTHS.bullets)

    this.rockets.push({
      image,
      velocityX: Math.cos(angle) * ROCKET.speed,
      velocityY: Math.sin(angle) * ROCKET.speed,
      damage:
        this.stats.damage *
        (ROCKET.baseDamageMult + ROCKET.damageMultPerLevel * (this.stats.rocketLevel - 1)),
      blastRadius: this.rocketBlastRadius(),
      trailAccumulatorMs: 0,
      isDead: false,
    })
  }

  private explodeRocket({ rocket }: { rocket: RocketUnit }): void {
    rocket.isDead = true
    const blastX = rocket.image.x
    const blastY = rocket.image.y

    const fireball = this.add.circle(blastX, blastY, 12, 0xfb923c, 0.7).setDepth(DEPTHS.effects)
    const shockRing = this.add
      .circle(blastX, blastY, 12)
      .setStrokeStyle(3, 0xfdba74, 0.9)
      .setDepth(DEPTHS.effects)
    this.tweens.add({
      targets: fireball,
      radius: rocket.blastRadius * 0.7,
      alpha: 0,
      duration: 320,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        fireball.destroy()
      },
    })
    this.tweens.add({
      targets: shockRing,
      radius: rocket.blastRadius,
      alpha: 0,
      duration: 380,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        shockRing.destroy()
      },
    })
    this.cameras.main.shake(90, 0.003)

    for (const enemy of this.enemies) {
      if (enemy.isDead === true) {
        continue
      }
      const distanceSq = (enemy.image.x - blastX) ** 2 + (enemy.image.y - blastY) ** 2
      if (distanceSq <= (rocket.blastRadius + enemy.radius) ** 2) {
        this.damageEnemy({ enemy, amount: rocket.damage, source: 'rocket' })
      }
    }

    // mirv warheads synergy: scatter armed mines across the blast zone
    if (this.stats.mirvLevel > 0) {
      const mineCount = Math.min(
        SYNERGIES.mirv.maxPerBlast,
        SYNERGIES.mirv.minesPerBlastBase +
          SYNERGIES.mirv.minesPerBlastPerLevel * (this.stats.mirvLevel - 1),
      )
      for (let index = 0; index < mineCount; index += 1) {
        if (this.mines.length >= this.maxActiveMines()) {
          break
        }
        this.deployMine({
          x: blastX + (Math.random() * 2 - 1) * rocket.blastRadius,
          y: Math.min(GROUND_Y - 80, blastY + (Math.random() * 2 - 1) * rocket.blastRadius * 0.6),
        })
      }
    }
  }

  // ── tesla arc ──────────────────────────────────────────────────────

  private fireTeslaArc({ cannon }: { cannon: CannonUnit }): boolean {
    const seeds = this.findMostUrgentEnemiesInRange({
      originX: cannon.x,
      originY: cannon.y,
      count: 1,
    })
    if (seeds.length === 0) {
      return false
    }

    const maxStruck = CHAIN.baseChains + CHAIN.chainsPerLevel * (this.stats.chainLevel - 1)
    const struck: Array<EnemyUnit> = [seeds[0]]
    while (struck.length < maxStruck) {
      const tail = struck[struck.length - 1]
      const next = this.findNearestChainTarget({ from: tail, exclude: struck })
      if (next === null) {
        break
      }
      struck.push(next)
    }

    const boltPoints = [
      { x: cannon.x, y: cannon.y - 20 },
      ...struck.map((enemy) => ({ x: enemy.image.x, y: enemy.image.y })),
    ]
    this.drawLightningBolt({ points: boltPoints })

    const chainDamage =
      this.stats.damage *
      (CHAIN.baseDamageMult + CHAIN.damageMultPerLevel * (this.stats.chainLevel - 1))
    for (const enemy of struck) {
      this.damageEnemy({ enemy, amount: chainDamage, source: 'chain' })
    }
    return true
  }

  private findNearestChainTarget({
    from,
    exclude,
  }: {
    from: EnemyUnit
    exclude: Array<EnemyUnit>
  }): EnemyUnit | null {
    let nearest: EnemyUnit | null = null
    let nearestDistanceSq = CHAIN.jumpRadius ** 2
    for (const enemy of this.enemies) {
      if (enemy.isDead === true || exclude.includes(enemy) === true) {
        continue
      }
      const distanceSq = (enemy.image.x - from.image.x) ** 2 + (enemy.image.y - from.image.y) ** 2
      if (distanceSq <= nearestDistanceSq) {
        nearestDistanceSq = distanceSq
        nearest = enemy
      }
    }
    return nearest
  }

  private drawLightningBolt({ points }: { points: Array<{ x: number; y: number }> }): void {
    const level = Math.max(1, this.stats.chainLevel)
    const graphics = this.add.graphics().setDepth(DEPTHS.effects)
    // higher tiers arc fatter, brighter, and with a second offset filament
    graphics.lineStyle(6 + 2 * (level - 1), 0x60a5fa, 0.3)
    this.traceJaggedPath({ graphics, points })
    if (level >= 3) {
      graphics.lineStyle(3, 0x93c5fd, 0.5)
      this.traceJaggedPath({ graphics, points })
    }
    graphics.lineStyle(2 + 0.5 * (level - 1), 0xdbeafe, 1)
    this.traceJaggedPath({ graphics, points })
    this.tweens.add({
      targets: graphics,
      alpha: 0,
      duration: 260 + 30 * (level - 1),
      ease: 'Cubic.easeOut',
      onComplete: () => {
        graphics.destroy()
      },
    })
  }

  private traceJaggedPath({
    graphics,
    points,
  }: {
    graphics: Phaser.GameObjects.Graphics
    points: Array<{ x: number; y: number }>
  }): void {
    const segmentsPerHop = 4
    for (let index = 0; index < points.length - 1; index += 1) {
      const from = points[index]
      const to = points[index + 1]
      const hopLengthX = to.x - from.x
      const hopLengthY = to.y - from.y
      const hopLength = Math.hypot(hopLengthX, hopLengthY)
      if (hopLength < 1) {
        continue
      }
      const perpX = -hopLengthY / hopLength
      const perpY = hopLengthX / hopLength
      let previousX = from.x
      let previousY = from.y
      for (let segment = 1; segment <= segmentsPerHop; segment += 1) {
        const progress = segment / segmentsPerHop
        const isEndpoint = segment === segmentsPerHop
        const jitter = isEndpoint === true ? 0 : (Math.random() * 2 - 1) * 9
        const nextX = from.x + hopLengthX * progress + perpX * jitter
        const nextY = from.y + hopLengthY * progress + perpY * jitter
        graphics.lineBetween(previousX, previousY, nextX, nextY)
        previousX = nextX
        previousY = nextY
      }
    }
  }

  // ── per-cannon weapon engine ───────────────────────────────────────
  // every owned weapon runs on EVERY cannon, each instance with its own
  // cooldown. battlefield-wide systems (airstrike, bfg, aegis) stay single.

  private listPerCannonWeaponIds(): Array<string> {
    const weaponIds: Array<string> = []
    if (this.stats.flakLevel > 0) {
      weaponIds.push('flak')
    }
    if (this.stats.rocketLevel > 0) {
      weaponIds.push('rocket')
    }
    if (this.stats.chainLevel > 0) {
      weaponIds.push('chain')
    }
    if (this.stats.novaIntervalMs !== null) {
      weaponIds.push('nova')
    }
    if (this.stats.lockdownLevel > 0) {
      weaponIds.push('lockdown')
    }
    if (this.stats.railgunLevel > 0) {
      weaponIds.push('railgun')
    }
    return weaponIds.sort((a, b) => a.localeCompare(b))
  }

  private weaponIntervalMs({ weaponId }: { weaponId: string }): number {
    if (weaponId === 'flak') {
      return Math.max(
        FLAK.minIntervalMs,
        FLAK.baseIntervalMs - FLAK.intervalStepMs * (this.stats.flakLevel - 1),
      )
    }
    if (weaponId === 'rocket') {
      return Math.max(
        ROCKET.minIntervalMs,
        ROCKET.baseIntervalMs - ROCKET.intervalStepMs * (this.stats.rocketLevel - 1),
      )
    }
    if (weaponId === 'chain') {
      return Math.max(
        CHAIN.minIntervalMs,
        CHAIN.baseIntervalMs - CHAIN.intervalStepMs * (this.stats.chainLevel - 1),
      )
    }
    if (weaponId === 'nova') {
      return this.stats.novaIntervalMs ?? Number.POSITIVE_INFINITY
    }
    if (weaponId === 'lockdown') {
      return Math.max(
        LOCKDOWN.minIntervalMs,
        LOCKDOWN.baseIntervalMs - LOCKDOWN.intervalStepMs * (this.stats.lockdownLevel - 1),
      )
    }
    if (weaponId === 'railgun') {
      return Math.max(
        RAILGUN.minIntervalMs,
        RAILGUN.baseIntervalMs - RAILGUN.intervalStepMs * (this.stats.railgunLevel - 1),
      )
    }
    if (weaponId === 'airstrike') {
      return Math.max(
        AIRSTRIKE.minIntervalMs,
        AIRSTRIKE.baseIntervalMs - AIRSTRIKE.intervalStepMs * (this.stats.airstrikeLevel - 1),
      )
    }
    if (weaponId === 'bfg') {
      return Math.max(
        BFG.minIntervalMs,
        BFG.baseIntervalMs - BFG.intervalStepMs * (this.stats.bfgLevel - 1),
      )
    }
    if (weaponId === 'lance') {
      return Math.max(
        LANCE.minIntervalMs,
        LANCE.baseIntervalMs - LANCE.intervalStepMs * (this.stats.lanceLevel - 1),
      )
    }
    if (weaponId === 'mines') {
      return Math.max(
        MINES.minIntervalMs,
        MINES.baseIntervalMs - MINES.intervalStepMs * (this.stats.mineLevel - 1),
      )
    }
    if (weaponId === 'orbital-laser') {
      return Math.max(
        ORBITAL_LASER.minIntervalMs,
        ORBITAL_LASER.baseIntervalMs -
          ORBITAL_LASER.intervalStepMs * (this.stats.orbitalLaserLevel - 1),
      )
    }
    if (weaponId === 'aegis') {
      return this.stats.aegisIntervalMs ?? Number.POSITIVE_INFINITY
    }
    return Number.POSITIVE_INFINITY
  }

  private updateCannonWeapons({ delta }: { delta: number }): void {
    const weaponIds = this.listPerCannonWeaponIds()
    for (const cannon of this.cannons) {
      for (const weaponId of weaponIds) {
        const interval = this.weaponIntervalMs({ weaponId })
        const accumulated = (cannon.cooldowns.get(weaponId) ?? 0) + delta
        if (accumulated < interval) {
          cannon.cooldowns.set(weaponId, accumulated)
          continue
        }
        const didFire = this.fireCannonWeapon({ cannon, weaponId })
        cannon.cooldowns.set(weaponId, didFire === true ? 0 : interval)
      }
    }
  }

  private fireCannonWeapon({
    cannon,
    weaponId,
  }: {
    cannon: CannonUnit
    weaponId: string
  }): boolean {
    if (weaponId === 'flak') {
      return this.fireFlakShell({ cannon })
    }
    if (weaponId === 'rocket') {
      return this.fireRocket({ cannon })
    }
    if (weaponId === 'chain') {
      return this.fireTeslaArc({ cannon })
    }
    if (weaponId === 'nova') {
      return this.fireNova({ cannon })
    }
    if (weaponId === 'lockdown') {
      return this.fireLockdown({ cannon })
    }
    if (weaponId === 'railgun') {
      return this.fireRailgun({ cannon })
    }
    return false
  }

  // ── lock down ──────────────────────────────────────────────────────

  private fireLockdown({ cannon }: { cannon: CannonUnit }): boolean {
    const targetCount =
      LOCKDOWN.baseTargets + LOCKDOWN.targetsPerLevel * (this.stats.lockdownLevel - 1)
    const targets = this.findMostUrgentEnemiesInRange({
      originX: cannon.x,
      originY: cannon.y,
      count: targetCount,
    }).filter((enemy) => enemy.frozenRemainingMs <= 0)
    if (targets.length === 0) {
      return false
    }

    const freezeMs =
      LOCKDOWN.baseFreezeMs + LOCKDOWN.freezeMsPerLevel * (this.stats.lockdownLevel - 1)
    for (const enemy of targets) {
      this.applyFreeze({ enemy, durationMs: freezeMs })
      const stasisRing = this.add
        .circle(enemy.image.x, enemy.image.y, enemy.radius + 4)
        .setStrokeStyle(2 + 0.6 * (this.stats.lockdownLevel - 1), 0x7dd3fc, 0.95)
        .setDepth(DEPTHS.effects)
      this.tweens.add({
        targets: stasisRing,
        radius: enemy.radius + 12 + 3 * (this.stats.lockdownLevel - 1),
        alpha: 0,
        duration: 420,
        ease: 'Cubic.easeOut',
        onComplete: () => {
          stasisRing.destroy()
        },
      })
    }
    return true
  }

  // ── rail gun ───────────────────────────────────────────────────────

  private fireRailgun({ cannon }: { cannon: CannonUnit }): boolean {
    // twin rails synergy: the fire-control computer splits the shot
    const beamCount = 1 + SYNERGIES.twinRail.extraBeamsPerLevel * this.stats.twinRailLevel
    const targets = this.findMostUrgentEnemiesInRange({
      originX: cannon.x,
      originY: cannon.y,
      count: beamCount,
    })
    if (targets.length === 0) {
      return false
    }
    for (const target of targets) {
      this.fireRailBeam({ cannon, target })
    }
    return true
  }

  private fireRailBeam({ cannon, target }: { cannon: CannonUnit; target: EnemyUnit }): void {
    const level = this.stats.railgunLevel
    const muzzleY = cannon.y - 6
    const angle = Math.atan2(target.image.y - muzzleY, target.image.x - cannon.x)
    cannon.barrelImage.setRotation(angle)
    const directionX = Math.cos(angle)
    const directionY = Math.sin(angle)
    const beamLength = this.stats.range
    const startX = cannon.x + directionX * BARREL_LENGTH
    const startY = muzzleY + directionY * BARREL_LENGTH
    const endX = startX + directionX * beamLength
    const endY = startY + directionY * beamLength

    // the beam is instant: damage everything whose center sits near the segment
    const beamHalfWidth = RAILGUN.beamHalfWidthPx + 1.5 * (level - 1)
    const beamDamage =
      this.stats.damage * (RAILGUN.baseDamageMult + RAILGUN.damageMultPerLevel * (level - 1))
    for (const enemy of this.enemies) {
      if (enemy.isDead === true) {
        continue
      }
      const toEnemyX = enemy.image.x - startX
      const toEnemyY = enemy.image.y - startY
      const along = toEnemyX * directionX + toEnemyY * directionY
      if (along < 0 || along > beamLength) {
        continue
      }
      const perpendicular = Math.abs(toEnemyX * directionY - toEnemyY * directionX)
      if (perpendicular <= enemy.radius + beamHalfWidth) {
        this.damageEnemy({ enemy, amount: beamDamage, source: 'railgun' })
      }
    }

    const beam = this.add.graphics().setDepth(DEPTHS.effects)
    beam.lineStyle(7 + 3 * (level - 1), 0xe879f9, 0.25)
    beam.lineBetween(startX, startY, endX, endY)
    beam.lineStyle(2 + 0.8 * (level - 1), 0xfdf4ff, 1)
    beam.lineBetween(startX, startY, endX, endY)
    this.tweens.add({
      targets: beam,
      alpha: 0,
      duration: 220,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        beam.destroy()
      },
    })

    // ion rail synergy: the shot leaves an ionized line that zaps crossers
    if (this.stats.ionLevel > 0) {
      const durationMs =
        SYNERGIES.ion.durationMsBase + SYNERGIES.ion.durationMsPerLevel * (this.stats.ionLevel - 1)
      this.ionTrails.push({
        startX,
        startY,
        directionX,
        directionY,
        length: beamLength,
        remainingMs: durationMs,
        totalMs: durationMs,
        hitEnemies: new Set(),
        isDead: false,
      })
    }
  }

  /** ion rail synergy: lingering ionized lines zap invaders that cross them */
  private updateIonTrails({ delta }: { delta: number }): void {
    if (this.ionTrails.length === 0) {
      return
    }
    const zapDamage =
      this.stats.damage *
      (SYNERGIES.ion.damageMultBase + SYNERGIES.ion.damageMultPerLevel * (this.stats.ionLevel - 1))
    for (const trail of this.ionTrails) {
      trail.remainingMs -= delta
      if (trail.remainingMs <= 0) {
        trail.isDead = true
        continue
      }
      for (const enemy of this.enemies) {
        if (enemy.isDead === true || trail.hitEnemies.has(enemy) === true) {
          continue
        }
        const toEnemyX = enemy.image.x - trail.startX
        const toEnemyY = enemy.image.y - trail.startY
        const along = toEnemyX * trail.directionX + toEnemyY * trail.directionY
        if (along < 0 || along > trail.length) {
          continue
        }
        const perpendicular = Math.abs(toEnemyX * trail.directionY - toEnemyY * trail.directionX)
        if (perpendicular <= enemy.radius + RAILGUN.beamHalfWidthPx) {
          trail.hitEnemies.add(enemy)
          this.drawLightningBolt({
            points: [
              {
                x: trail.startX + trail.directionX * along,
                y: trail.startY + trail.directionY * along,
              },
              { x: enemy.image.x, y: enemy.image.y },
            ],
          })
          this.damageEnemy({ enemy, amount: zapDamage, source: 'ion' })
        }
      }
    }
    this.ionTrails = this.ionTrails.filter((trail) => trail.isDead === false)
  }

  // ── strafing run ───────────────────────────────────────────────────

  private updateAirstrike({ delta }: { delta: number }): void {
    if (this.stats.airstrikeLevel > 0) {
      this.airstrikeAccumulatorMs += delta
      const interval = this.weaponIntervalMs({ weaponId: 'airstrike' })
      if (this.airstrikeAccumulatorMs >= interval) {
        const hasEnemies = this.enemies.some((enemy) => enemy.isDead === false)
        if (hasEnemies === false) {
          this.airstrikeAccumulatorMs = interval
        } else {
          this.airstrikeAccumulatorMs = 0
          this.spawnStrafingPlane()
        }
      }
    }

    const seconds = delta / 1_000

    for (const plane of this.planes) {
      if (plane.isDead === true) {
        continue
      }
      plane.image.x += plane.velocityX * seconds
      plane.image.y += plane.velocityY * seconds
      plane.trailAccumulatorMs += delta
      if (plane.trailAccumulatorMs >= 70) {
        plane.trailAccumulatorMs = 0
        this.spawnExhaustPuff({
          x: plane.image.x - Math.sign(plane.velocityX) * 22,
          y: plane.image.y,
          color: 0xcbd5e1,
        })
      }
      const isOverField = plane.image.x > 40 && plane.image.x < ARENA.width - 40
      if (isOverField === true) {
        plane.dropAccumulatorMs += delta
        if (plane.dropAccumulatorMs >= AIRSTRIKE.dropIntervalMs) {
          plane.dropAccumulatorMs = 0
          this.dropFlakBomb({
            x: plane.image.x,
            y: plane.image.y + 10,
            velocityX: plane.velocityX * 0.35,
          })
        }
        // cloud seeding synergy: the pass leaves fresh vapor behind it
        if (this.stats.seedingLevel > 0) {
          plane.seedAccumulatorMs += delta
          const seedInterval = Math.max(
            400,
            SYNERGIES.seeding.dropIntervalMsBase -
              SYNERGIES.seeding.dropIntervalStepMs * (this.stats.seedingLevel - 1),
          )
          if (plane.seedAccumulatorMs >= seedInterval) {
            plane.seedAccumulatorMs = 0
            this.spawnSeededCloud({ x: plane.image.x, y: plane.image.y })
          }
        }
        // close air support synergy: the jet fires rockets mid-pass
        if (this.stats.casLevel > 0) {
          plane.casAccumulatorMs += delta
          const launchInterval = Math.max(
            600,
            SYNERGIES.cas.launchIntervalMsBase -
              SYNERGIES.cas.launchIntervalStepMs * (this.stats.casLevel - 1),
          )
          if (plane.casAccumulatorMs >= launchInterval) {
            plane.casAccumulatorMs = 0
            const target = this.findClusterTarget()
            if (target !== null) {
              this.launchRocket({ originX: plane.image.x, originY: plane.image.y + 8, target })
            }
          }
        }
      }
      const isOffscreen = plane.image.x < -80 || plane.image.x > ARENA.width + 80
      if (isOffscreen === true) {
        if (plane.passesRemaining > 1) {
          // bank around and strafe back the other way on a fresh diagonal
          plane.passesRemaining -= 1
          plane.velocityX = -plane.velocityX
          plane.velocityY = plane.velocityX * (Math.random() * 0.36 - 0.18)
          plane.image.y = Phaser.Math.Clamp(
            plane.image.y + (Math.random() * 2 - 1) * 80,
            110,
            GROUND_Y - 220,
          )
          plane.image.setRotation(Math.atan2(plane.velocityY, plane.velocityX))
          plane.image.setFlipY(plane.velocityX < 0)
        } else {
          plane.isDead = true
          plane.image.destroy()
        }
      }
    }
    this.planes = this.planes.filter((plane) => plane.isDead === false)

    for (const bomb of this.bombs) {
      if (bomb.isDead === true) {
        continue
      }
      bomb.image.x += bomb.velocityX * seconds
      bomb.image.y += AIRSTRIKE.bombFallSpeedPxPerSec * seconds
      bomb.fuseRemainingMs -= delta
      if (bomb.fuseRemainingMs <= 0 || bomb.image.y >= GROUND_Y - 4) {
        bomb.isDead = true
        this.spawnBlast({
          x: bomb.image.x,
          y: bomb.image.y,
          blastRadius: bomb.blastRadius,
          damage: bomb.damage,
          source: 'airstrike',
        })
        if (this.stats.clusterLevel > 0) {
          this.burstClusterFragments({ x: bomb.image.x, y: bomb.image.y })
        }
        bomb.image.destroy()
      }
    }
    this.bombs = this.bombs.filter((bomb) => bomb.isDead === false)
  }

  private spawnStrafingPlane(): void {
    const level = Math.max(1, this.stats.airstrikeLevel)
    const isLeftToRight = Math.random() < 0.5
    const startX = isLeftToRight === true ? -60 : ARENA.width + 60
    const velocityX =
      isLeftToRight === true ? AIRSTRIKE.planeSpeedPxPerSec : -AIRSTRIKE.planeSpeedPxPerSec
    // each sortie crosses on its own diagonal: climbing, level, or diving
    const velocityY = velocityX * (Math.random() * 0.36 - 0.18)
    const altitude = AIRSTRIKE.planeAltitudeY + (Math.random() * 2 - 1) * 110
    const image = this.add
      .image(startX, altitude, 'aircraft')
      .setRotation(Math.atan2(velocityY, velocityX))
      .setFlipY(isLeftToRight === false)
      .setScale(1 + 0.18 * (level - 1))
      .setDepth(DEPTHS.units)
    this.planes.push({
      image,
      velocityX,
      velocityY,
      dropAccumulatorMs: 0,
      trailAccumulatorMs: 0,
      seedAccumulatorMs: 0,
      casAccumulatorMs: 0,
      passesRemaining: 2,
      isDead: false,
    })
  }

  /** cloud seeding synergy: spawn a small active cloud where the jet flew */
  private spawnSeededCloud({ x, y }: { x: number; y: number }): void {
    if (this.cloudImages.length >= CLOUD.maxClouds + SYNERGIES.seeding.extraCloudCap) {
      return
    }
    const textureKey = `cloud-${Math.floor(Math.random() * 3)}`
    const image = this.add
      .image(x, y, textureKey)
      .setAlpha(0)
      .setScale(0.7 + Math.random() * 0.4)
      .setDepth(DEPTHS.clouds)
    this.tweens.add({ targets: image, alpha: CLOUD.activeAlpha, duration: 800 })
    this.cloudImages.push({ image, speed: 6 + Math.random() * 14 })
  }

  private dropFlakBomb({ x, y, velocityX }: { x: number; y: number; velocityX: number }): void {
    const image = this.add
      .image(x, y, 'bomb')
      .setScale(1 + 0.15 * (this.stats.airstrikeLevel - 1))
      .setDepth(DEPTHS.bullets)
    this.bombs.push({
      image,
      velocityX,
      fuseRemainingMs: AIRSTRIKE.bombFuseMs * (0.8 + Math.random() * 0.5),
      damage:
        this.stats.damage *
        (AIRSTRIKE.baseDamageMult + AIRSTRIKE.damageMultPerLevel * (this.stats.airstrikeLevel - 1)),
      blastRadius:
        AIRSTRIKE.baseBlastRadius + AIRSTRIKE.blastRadiusPerLevel * (this.stats.airstrikeLevel - 1),
      isDead: false,
    })
  }

  private spawnBlast({
    x,
    y,
    blastRadius,
    damage,
    source,
  }: {
    x: number
    y: number
    blastRadius: number
    damage: number
    source: string
  }): void {
    const fireball = this.add.circle(x, y, 10, 0xfb923c, 0.7).setDepth(DEPTHS.effects)
    const shockRing = this.add
      .circle(x, y, 10)
      .setStrokeStyle(3, 0xfdba74, 0.9)
      .setDepth(DEPTHS.effects)
    this.tweens.add({
      targets: fireball,
      radius: blastRadius * 0.7,
      alpha: 0,
      duration: 300,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        fireball.destroy()
      },
    })
    this.tweens.add({
      targets: shockRing,
      radius: blastRadius,
      alpha: 0,
      duration: 360,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        shockRing.destroy()
      },
    })

    for (const enemy of this.enemies) {
      if (enemy.isDead === true) {
        continue
      }
      const distanceSq = (enemy.image.x - x) ** 2 + (enemy.image.y - y) ** 2
      if (distanceSq <= (blastRadius + enemy.radius) ** 2) {
        this.damageEnemy({ enemy, amount: damage, source })
      }
    }
  }

  // ── bfg ────────────────────────────────────────────────────────────

  private updateBfg({ delta }: { delta: number }): void {
    if (this.stats.bfgLevel <= 0) {
      return
    }
    this.bfgAccumulatorMs += delta
    const interval = this.weaponIntervalMs({ weaponId: 'bfg' })
    if (this.bfgAccumulatorMs < interval) {
      return
    }
    const hasEnemies = this.enemies.some((enemy) => enemy.isDead === false)
    if (hasEnemies === false) {
      this.bfgAccumulatorMs = interval
      return
    }
    this.bfgAccumulatorMs = 0

    const level = this.stats.bfgLevel
    const mainCannon = this.cannons[0]
    const orb = this.add
      .circle(mainCannon.x, mainCannon.y - 24, 6, 0x4ade80, 0.95)
      .setDepth(DEPTHS.effects)
    this.tweens.add({
      targets: orb,
      radius: 30 + 10 * (level - 1),
      duration: 280,
      ease: 'Cubic.easeIn',
      onComplete: () => {
        orb.destroy()
      },
    })
    const flash = this.add
      .rectangle(
        ARENA.width / 2,
        GROUND_Y / 2,
        ARENA.width,
        GROUND_Y,
        0x4ade80,
        Math.min(0.5, 0.28 + 0.06 * (level - 1)),
      )
      .setDepth(DEPTHS.effects)
    this.tweens.add({
      targets: flash,
      alpha: 0,
      delay: 220,
      duration: 420,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        flash.destroy()
      },
    })
    this.cameras.main.shake(300, 0.008)

    const bfgDamage =
      this.stats.damage * (BFG.baseDamageMult + BFG.damageMultPerLevel * (this.stats.bfgLevel - 1))
    for (const enemy of this.enemies) {
      if (enemy.isDead === true) {
        continue
      }
      this.damageEnemy({ enemy, amount: bfgDamage, source: 'bfg' })
    }

    // capacitor dump synergy: the discharge sets off a boosted nova on every cannon
    if (this.stats.capdumpLevel > 0) {
      const novaMultiplier =
        SYNERGIES.capdump.novaDamageMultBase +
        SYNERGIES.capdump.novaDamageMultPerLevel * (this.stats.capdumpLevel - 1)
      for (const cannon of this.cannons) {
        this.fireNova({ cannon, damageMultiplier: novaMultiplier })
      }
    }
  }

  // ── thermal lance ──────────────────────────────────────────────────

  private updateThermalLance({ delta }: { delta: number }): void {
    if (this.stats.lanceLevel > 0) {
      this.lanceAccumulatorMs += delta
      const interval = this.weaponIntervalMs({ weaponId: 'lance' })
      if (this.lanceAccumulatorMs >= interval) {
        const target = this.findClusterTarget()
        if (target === null) {
          this.lanceAccumulatorMs = interval
        } else {
          this.lanceAccumulatorMs = 0
          this.fireThermalLance({ centerX: target.image.x })
        }
      }
    }

    const seconds = delta / 1_000
    for (const sweep of this.sweeps) {
      if (sweep.isDead === true) {
        continue
      }
      sweep.x += LANCE.sweepSpeedPxPerSec * seconds * sweep.directionX
      const isFinished = sweep.directionX > 0 ? sweep.x >= sweep.endX : sweep.x <= sweep.endX
      if (isFinished === true) {
        sweep.isDead = true
        continue
      }
      for (const enemy of this.enemies) {
        if (enemy.isDead === true || sweep.hitEnemies.has(enemy) === true) {
          continue
        }
        if (Math.abs(enemy.image.x - sweep.x) <= enemy.radius + LANCE.beamHalfWidthPx) {
          sweep.hitEnemies.add(enemy)
          this.damageEnemy({ enemy, amount: sweep.damage, source: 'lance' })
        }
      }
    }
    this.sweeps = this.sweeps.filter((sweep) => sweep.isDead === false)
  }

  private fireThermalLance({ centerX }: { centerX: number }): void {
    const level = this.stats.lanceLevel
    const span = LANCE.sweepSpanBase + LANCE.sweepSpanPerLevel * (level - 1)
    const directionX = Math.random() < 0.5 ? 1 : -1
    const startX = centerX - (span / 2) * directionX
    this.sweeps.push({
      x: startX,
      endX: startX + span * directionX,
      directionX,
      damage: this.stats.damage * (LANCE.baseDamageMult + LANCE.damageMultPerLevel * (level - 1)),
      hitEnemies: new Set(),
      isDead: false,
    })
  }

  /** redrawn every frame: a column of light from orbit down to the ground */
  private drawSweepBeams(): void {
    this.sweepGraphics.clear()
    const level = Math.max(1, this.stats.lanceLevel)
    for (const sweep of this.sweeps) {
      if (sweep.isDead === true) {
        continue
      }
      this.sweepGraphics.fillStyle(0xf87171, 0.16)
      this.sweepGraphics.fillRect(
        sweep.x - LANCE.beamHalfWidthPx - 3 * level,
        0,
        (LANCE.beamHalfWidthPx + 3 * level) * 2,
        GROUND_Y,
      )
      this.sweepGraphics.fillStyle(0xfecaca, 0.55)
      this.sweepGraphics.fillRect(sweep.x - 3, 0, 6, GROUND_Y)
      this.sweepGraphics.fillStyle(0xffffff, 0.95)
      this.sweepGraphics.fillRect(sweep.x - 1, 0, 2, GROUND_Y)
      // molten glow where the beam meets the ground
      this.sweepGraphics.fillStyle(0xfb923c, 0.7)
      this.sweepGraphics.fillEllipse(sweep.x, GROUND_Y, 26 + 6 * level, 10)
    }

    // ion rail lines linger and fade where rail beams fired
    for (const trail of this.ionTrails) {
      if (trail.isDead === true) {
        continue
      }
      const fade = trail.remainingMs / trail.totalMs
      this.sweepGraphics.lineStyle(4, 0xc084fc, 0.22 * fade)
      this.sweepGraphics.lineBetween(
        trail.startX,
        trail.startY,
        trail.startX + trail.directionX * trail.length,
        trail.startY + trail.directionY * trail.length,
      )
      this.sweepGraphics.lineStyle(1, 0xe9d5ff, 0.45 * fade)
      this.sweepGraphics.lineBetween(
        trail.startX,
        trail.startY,
        trail.startX + trail.directionX * trail.length,
        trail.startY + trail.directionY * trail.length,
      )
    }

    // orbital laser lock-on reticles: pulse tighter as the strike charges
    for (const strike of this.orbitalStrikes) {
      if (strike.isDead === true) {
        continue
      }
      const chargeFraction = 1 - strike.lockRemainingMs / ORBITAL_LASER.lockOnMs
      const reticleRadius = 44 - 22 * chargeFraction
      this.sweepGraphics.lineStyle(2, 0xf43f5e, 0.5 + 0.5 * chargeFraction)
      this.sweepGraphics.strokeCircle(strike.x, strike.y, reticleRadius)
      this.sweepGraphics.lineBetween(
        strike.x - reticleRadius - 8,
        strike.y,
        strike.x + reticleRadius + 8,
        strike.y,
      )
      this.sweepGraphics.lineBetween(
        strike.x,
        strike.y - reticleRadius - 8,
        strike.x,
        strike.y + reticleRadius + 8,
      )
    }
  }

  // ── mine layer ─────────────────────────────────────────────────────

  private updateMines({ delta }: { delta: number }): void {
    if (this.stats.mineLevel > 0) {
      this.mineAccumulatorMs += delta
      const interval = this.weaponIntervalMs({ weaponId: 'mines' })
      if (this.mineAccumulatorMs >= interval) {
        if (this.mines.length >= this.maxActiveMines()) {
          this.mineAccumulatorMs = interval
        } else {
          this.mineAccumulatorMs = 0
          const dropCount =
            MINES.minesPerDrop +
            MINES.minesPerDropPerLevel * (this.stats.mineLevel - 1) +
            SYNERGIES.fabricators.extraMinesPerDropPerLevel * this.stats.fabricatorLevel
          for (let index = 0; index < dropCount; index += 1) {
            if (this.mines.length >= this.maxActiveMines()) {
              break
            }
            this.deployMine()
          }
        }
      }
    }

    for (const mine of this.mines) {
      if (mine.isDead === true) {
        continue
      }
      if (mine.armRemainingMs > 0) {
        mine.armRemainingMs -= delta
        continue
      }
      for (const enemy of this.enemies) {
        if (enemy.isDead === true) {
          continue
        }
        const triggerRange = enemy.radius + MINES.proximityPx
        const distanceSq = (enemy.image.x - mine.image.x) ** 2 + (enemy.image.y - mine.image.y) ** 2
        if (distanceSq <= triggerRange ** 2) {
          mine.isDead = true
          this.spawnBlast({
            x: mine.image.x,
            y: mine.image.y,
            blastRadius: MINES.blastRadius + MINES.blastRadiusPerLevel * (this.stats.mineLevel - 1),
            damage:
              this.stats.damage *
              (MINES.baseDamageMult + MINES.damageMultPerLevel * (this.stats.mineLevel - 1)),
            source: 'mines',
          })
          mine.image.destroy()
          break
        }
      }
    }
    this.mines = this.mines.filter((mine) => mine.isDead === false)
  }

  /** auto-fabricators synergy raises the active-mine ceiling */
  private maxActiveMines(): number {
    return (
      MINES.maxActive + SYNERGIES.fabricators.extraMaxActivePerLevel * this.stats.fabricatorLevel
    )
  }

  private deployMine({ x: atX, y: atY }: { x?: number; y?: number } = {}): void {
    const x = atX ?? 120 + Math.random() * (ARENA.width - 240)
    const y = atY ?? 230 + Math.random() * (GROUND_Y - 360)
    const image = this.add
      .image(x, y - 30, 'mine')
      .setAlpha(0)
      .setDepth(DEPTHS.units)
    this.tweens.add({ targets: image, alpha: 1, y, duration: 400, ease: 'Sine.easeOut' })
    // blinking arming light
    this.tweens.add({
      targets: image,
      alpha: 0.55,
      delay: 500,
      duration: 420,
      yoyo: true,
      repeat: -1,
    })
    this.mines.push({ image, armRemainingMs: MINES.armDelayMs, isDead: false })
  }

  // ── orbital laser ──────────────────────────────────────────────────

  private updateOrbitalLaser({ delta }: { delta: number }): void {
    if (this.stats.orbitalLaserLevel > 0) {
      this.orbitalAccumulatorMs += delta
      const interval = this.weaponIntervalMs({ weaponId: 'orbital-laser' })
      if (this.orbitalAccumulatorMs >= interval) {
        // painted target synergy: frozen clusters are priority-painted, locks are faster
        let target: EnemyUnit | null = null
        let lockOnMs = ORBITAL_LASER.lockOnMs
        if (this.stats.paintedLevel > 0) {
          const frozenPool = this.enemies.filter(
            (enemy) => enemy.isDead === false && enemy.frozenRemainingMs > 0,
          )
          if (frozenPool.length > 0) {
            target = this.findClusterTarget({ pool: frozenPool })
          }
          lockOnMs *=
            SYNERGIES.painted.lockOnFactorBase -
            SYNERGIES.painted.lockOnFactorPerLevel * (this.stats.paintedLevel - 1)
        }
        target = target ?? this.findClusterTarget()
        if (target === null) {
          this.orbitalAccumulatorMs = interval
        } else {
          this.orbitalAccumulatorMs = 0
          this.orbitalStrikes.push({
            x: target.image.x,
            y: target.image.y,
            lockRemainingMs: lockOnMs,
            isDead: false,
          })
        }
      }
    }

    for (const strike of this.orbitalStrikes) {
      if (strike.isDead === true) {
        continue
      }
      strike.lockRemainingMs -= delta
      if (strike.lockRemainingMs <= 0) {
        strike.isDead = true
        this.fireOrbitalStrike({ strike })
      }
    }
    this.orbitalStrikes = this.orbitalStrikes.filter((strike) => strike.isDead === false)
  }

  private fireOrbitalStrike({ strike }: { strike: OrbitalStrikeUnit }): void {
    const level = this.stats.orbitalLaserLevel
    let radius = ORBITAL_LASER.strikeRadius + ORBITAL_LASER.strikeRadiusPerLevel * (level - 1)
    if (this.stats.paintedLevel > 0) {
      radius *=
        1 +
        SYNERGIES.painted.radiusBonusBase +
        SYNERGIES.painted.radiusBonusPerLevel * (this.stats.paintedLevel - 1)
    }
    const damage =
      this.stats.damage *
      (ORBITAL_LASER.baseDamageMult + ORBITAL_LASER.damageMultPerLevel * (level - 1))

    // the column of light from orbit down to the strike point
    const column = this.add
      .rectangle(strike.x, strike.y / 2, 22 + 6 * (level - 1), strike.y, 0xfecdd3, 0.85)
      .setDepth(DEPTHS.effects)
    this.tweens.add({
      targets: column,
      alpha: 0,
      scaleX: 0.3,
      duration: 380,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        column.destroy()
      },
    })
    this.cameras.main.shake(180, 0.006)
    this.spawnBlast({
      x: strike.x,
      y: strike.y,
      blastRadius: radius,
      damage,
      source: 'orbital-laser',
    })
  }

  // ── storm front (tesla arc × cloud cover synergy) ──────────────────

  private updateStormFront({ delta }: { delta: number }): void {
    if (this.stats.stormLevel <= 0) {
      return
    }
    this.stormAccumulatorMs += delta
    const interval = Math.max(
      STORM_FRONT.minIntervalMs,
      STORM_FRONT.baseIntervalMs - STORM_FRONT.intervalStepMs * (this.stats.stormLevel - 1),
    )
    if (this.stormAccumulatorMs < interval) {
      return
    }

    const boltDamage =
      this.stats.damage *
      (STORM_FRONT.baseDamageMult + STORM_FRONT.damageMultPerLevel * (this.stats.stormLevel - 1))
    let didStrike = false
    for (const cloud of this.cloudImages) {
      for (const enemy of this.enemies) {
        if (enemy.isDead === true) {
          continue
        }
        if (this.isInsideAnyCloud({ x: enemy.image.x, y: enemy.image.y }) === false) {
          continue
        }
        const isUnderThisCloud =
          Math.abs(enemy.image.x - cloud.image.x) <= cloud.image.displayWidth * 0.45 &&
          Math.abs(enemy.image.y - cloud.image.y) <= cloud.image.displayHeight * 0.55
        if (isUnderThisCloud === false) {
          continue
        }
        this.drawLightningBolt({
          points: [
            { x: cloud.image.x, y: cloud.image.y },
            { x: enemy.image.x, y: enemy.image.y },
          ],
        })
        this.damageEnemy({ enemy, amount: boltDamage, source: 'storm' })
        didStrike = true
        break
      }
    }
    this.stormAccumulatorMs = didStrike === true ? 0 : interval
  }

  // ── boss motherships ───────────────────────────────────────────────

  private updateBossSpawners({ delta }: { delta: number }): void {
    for (const enemy of this.enemies) {
      if (enemy.isDead === true || enemy.definition.kind !== 'mothership') {
        continue
      }
      enemy.spawnerAccumulatorMs += delta
      if (enemy.spawnerAccumulatorMs >= BOSS.addSpawnIntervalMs) {
        enemy.spawnerAccumulatorMs = 0
        this.spawnEnemy({
          definition: ENEMY_DEFINITIONS.drifter,
          spawnX: enemy.image.x + (Math.random() * 2 - 1) * 30,
          spawnY: enemy.image.y + enemy.radius,
        })
        this.spawnImpactFlash({ x: enemy.image.x, y: enemy.image.y + enemy.radius, radius: 18 })
      }
    }
  }

  // ── death effects and exhaust trails ───────────────────────────────

  private spawnDeathBurst({ enemy }: { enemy: EnemyUnit }): void {
    const colors: Record<string, number> = {
      drifter: 0xef4444,
      speeder: 0xfacc15,
      tank: 0xa855f7,
      elite: 0xf97316,
      splitter: 0xec4899,
      shardling: 0xf472b6,
      mothership: 0x94a3b8,
    }
    const color = colors[enemy.definition.kind] ?? 0xef4444
    const shardCount = Math.min(10, 4 + Math.floor(enemy.radius / 6))

    const flash = this.add
      .circle(enemy.image.x, enemy.image.y, enemy.radius * 0.7, color, 0.55)
      .setDepth(DEPTHS.effects)
    this.tweens.add({
      targets: flash,
      radius: enemy.radius * 1.6,
      alpha: 0,
      duration: 200,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        flash.destroy()
      },
    })

    for (let index = 0; index < shardCount; index += 1) {
      const angle = Math.random() * Math.PI * 2
      const distance = enemy.radius + 14 + Math.random() * 26
      const shard = this.add
        .circle(enemy.image.x, enemy.image.y, 1.5 + Math.random() * 2, color, 0.9)
        .setDepth(DEPTHS.effects)
      this.tweens.add({
        targets: shard,
        x: enemy.image.x + Math.cos(angle) * distance,
        y: enemy.image.y + Math.sin(angle) * distance + 12,
        alpha: 0,
        duration: 320 + Math.random() * 200,
        ease: 'Cubic.easeOut',
        onComplete: () => {
          shard.destroy()
        },
      })
    }
  }

  /** cluster bombs synergy: each blast also sprays short-lived flak fragments */
  private burstClusterFragments({ x, y }: { x: number; y: number }): void {
    const fragmentCount =
      CLUSTER_BOMBS.baseFragments + CLUSTER_BOMBS.fragmentsPerLevel * (this.stats.clusterLevel - 1)
    const fragmentDamage =
      this.stats.damage *
      (CLUSTER_BOMBS.baseDamageMult +
        CLUSTER_BOMBS.damageMultPerLevel * (this.stats.clusterLevel - 1))
    const fragmentSpeed = this.stats.projectileSpeed * 0.6
    const startAngle = Math.random() * Math.PI * 2
    for (let index = 0; index < fragmentCount; index += 1) {
      const angle = startAngle + (index * Math.PI * 2) / fragmentCount
      const image = this.add.image(x, y, 'flak-frag').setDepth(DEPTHS.bullets)
      this.bullets.push({
        image,
        source: 'cluster',
        velocityX: Math.cos(angle) * fragmentSpeed,
        velocityY: Math.sin(angle) * fragmentSpeed,
        damage: fragmentDamage,
        pierceLeft: 0,
        traveledPx: 0,
        maxTravelPx: CLUSTER_BOMBS.fragmentTravelPx,
        isFlakShell: false,
        hitEnemies: new Set(),
        isDead: false,
      })
    }
  }

  private spawnExhaustPuff({ x, y, color }: { x: number; y: number; color: number }): void {
    const puff = this.add.circle(x, y, 2 + Math.random() * 2, color, 0.5).setDepth(DEPTHS.clouds)
    this.tweens.add({
      targets: puff,
      radius: 6 + Math.random() * 4,
      y: y - 4 + Math.random() * 8,
      alpha: 0,
      duration: 450 + Math.random() * 250,
      ease: 'Sine.easeOut',
      onComplete: () => {
        puff.destroy()
      },
    })
  }

  // ── cooldown bars ──────────────────────────────────────────────────

  private drawCooldownBars(): void {
    this.cooldownBars.clear()
    const perCannonWeaponIds = this.listPerCannonWeaponIds()

    for (let cannonIndex = 0; cannonIndex < this.cannons.length; cannonIndex += 1) {
      const cannon = this.cannons[cannonIndex]
      const rows: Array<{ key: string; weaponId: string; fraction: number }> = [
        {
          key: `main-${cannonIndex}`,
          weaponId: 'main',
          fraction: cannon.fireAccumulatorMs / this.stats.fireIntervalMs,
        },
        ...perCannonWeaponIds.map((weaponId) => ({
          key: `${weaponId}-${cannonIndex}`,
          weaponId,
          fraction: (cannon.cooldowns.get(weaponId) ?? 0) / this.weaponIntervalMs({ weaponId }),
        })),
      ]

      // battlefield-wide systems report on the main cannon
      if (cannonIndex === 0) {
        if (this.stats.airstrikeLevel > 0) {
          rows.push({
            key: 'airstrike',
            weaponId: 'airstrike',
            fraction:
              this.airstrikeAccumulatorMs / this.weaponIntervalMs({ weaponId: 'airstrike' }),
          })
        }
        if (this.stats.bfgLevel > 0) {
          rows.push({
            key: 'bfg',
            weaponId: 'bfg',
            fraction: this.bfgAccumulatorMs / this.weaponIntervalMs({ weaponId: 'bfg' }),
          })
        }
        if (this.stats.lanceLevel > 0) {
          rows.push({
            key: 'lance',
            weaponId: 'lance',
            fraction: this.lanceAccumulatorMs / this.weaponIntervalMs({ weaponId: 'lance' }),
          })
        }
        if (this.stats.mineLevel > 0) {
          rows.push({
            key: 'mines',
            weaponId: 'mines',
            fraction: this.mineAccumulatorMs / this.weaponIntervalMs({ weaponId: 'mines' }),
          })
        }
        if (this.stats.orbitalLaserLevel > 0) {
          rows.push({
            key: 'orbital-laser',
            weaponId: 'orbital-laser',
            fraction:
              this.orbitalAccumulatorMs / this.weaponIntervalMs({ weaponId: 'orbital-laser' }),
          })
        }
        if (this.stats.aegisIntervalMs !== null) {
          rows.push({
            key: 'aegis',
            weaponId: 'aegis',
            fraction: this.aegisAccumulatorMs / this.stats.aegisIntervalMs,
          })
        }
      }

      for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
        const { key, weaponId, fraction } = rows[rowIndex]
        const clamped = Math.max(0, Math.min(1, fraction))
        const color = WEAPON_BAR_COLORS[weaponId] ?? 0x94a3b8
        const barX = cannon.x - COOLDOWN_BAR_WIDTH / 2 + 8
        const barY = cannon.y + 26 + rowIndex * 7

        this.cooldownBars.fillStyle(0x0f172a, 0.85)
        this.cooldownBars.fillRect(barX, barY, COOLDOWN_BAR_WIDTH, 3)
        this.cooldownBars.fillStyle(color, clamped >= 1 ? 1 : 0.55)
        this.cooldownBars.fillRect(barX, barY, COOLDOWN_BAR_WIDTH * clamped, 3)

        this.positionBarLabel({ key, weaponId, x: barX - 3, y: barY - 3 })
      }
    }
  }

  private positionBarLabel({
    key,
    weaponId,
    x,
    y,
  }: {
    key: string
    weaponId: string
    x: number
    y: number
  }): void {
    let label = this.barLabels.get(key) ?? null
    if (label === null) {
      const color = WEAPON_BAR_COLORS[weaponId] ?? 0x94a3b8
      label = this.add
        .text(0, 0, WEAPON_BAR_LABELS[weaponId] ?? weaponId.toUpperCase(), {
          fontFamily: 'Segoe UI, system-ui, sans-serif',
          fontSize: '8px',
          color: `#${color.toString(16).padStart(6, '0')}`,
        })
        .setOrigin(1, 0.05)
        .setAlpha(0.85)
        .setDepth(DEPTHS.effects)
      this.barLabels.set(key, label)
    }
    label.setPosition(x, y)
  }

  // ── nanite repair drones ───────────────────────────────────────────

  private syncNaniteDrones(): void {
    const targetCount = Math.min(this.upgradeStacks.get('nanite') ?? 0, MAX_NANITE_DRONES)
    while (this.naniteDrones.length < targetCount) {
      const drone = this.add
        .image(CANNON_X_POSITIONS[0], CANNON_Y - 60, 'nanite-drone')
        .setDepth(DEPTHS.units)
        .setScale(0)
      this.tweens.add({ targets: drone, scale: 1, duration: 300, ease: 'Back.easeOut' })
      this.naniteDrones.push(drone)
      this.sendDroneToNextJob({ drone })
    }
  }

  /** fly to a building (favoring damaged ones), hover while "repairing", repeat */
  private sendDroneToNextJob({ drone }: { drone: Phaser.GameObjects.Image }): void {
    if (drone.active === false) {
      return
    }
    const damaged = this.buildings.filter((building) => building.isDestroyed === true)
    const pool = damaged.length > 0 && Math.random() < 0.7 ? damaged : this.buildings
    const building = pool[Math.floor(Math.random() * pool.length)]
    const hoverX = building.x + (Math.random() * 2 - 1) * 24
    const hoverY = GROUND_Y - building.image.height - 26 - Math.random() * 18

    const travelPx = Math.hypot(drone.x - hoverX, drone.y - hoverY)
    this.tweens.add({
      targets: drone,
      x: hoverX,
      y: hoverY,
      duration: 600 + travelPx * 2.2,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        this.emitRepairSparkles({ x: hoverX, y: hoverY + 10 })
        this.tweens.add({
          targets: drone,
          y: hoverY - 6,
          duration: 450,
          yoyo: true,
          repeat: 2,
          ease: 'Sine.easeInOut',
          onComplete: () => {
            this.sendDroneToNextJob({ drone })
          },
        })
      },
    })
  }

  private emitRepairSparkles({ x, y }: { x: number; y: number }): void {
    for (let index = 0; index < 3; index += 1) {
      const sparkle = this.add
        .circle(x + (Math.random() * 2 - 1) * 14, y + Math.random() * 16, 2, 0x4ade80, 0.9)
        .setDepth(DEPTHS.effects)
      this.tweens.add({
        targets: sparkle,
        y: sparkle.y - 14,
        alpha: 0,
        delay: index * 180,
        duration: 500,
        ease: 'Sine.easeOut',
        onComplete: () => {
          sparkle.destroy()
        },
      })
    }
  }

  // ── aegis shield ───────────────────────────────────────────────────

  private updateAegis({ delta }: { delta: number }): void {
    if (this.stats.aegisIntervalMs === null) {
      return
    }
    this.aegisAccumulatorMs = Math.min(this.stats.aegisIntervalMs, this.aegisAccumulatorMs + delta)
    const chargeFraction = this.aegisAccumulatorMs / this.stats.aegisIntervalMs
    this.shieldImage.setAlpha(
      AEGIS_MIN_ALPHA + (AEGIS_MAX_ALPHA - AEGIS_MIN_ALPHA) * chargeFraction,
    )
  }

  private tryAegisBlock({ x }: { x: number }): boolean {
    if (this.stats.aegisIntervalMs === null) {
      return false
    }
    if (this.aegisAccumulatorMs < this.stats.aegisIntervalMs) {
      return false
    }
    this.aegisAccumulatorMs = 0

    const blockFlash = this.add
      .circle(x, GROUND_Y, 10)
      .setStrokeStyle(3, 0x38bdf8, 0.95)
      .setDepth(DEPTHS.effects)
    this.tweens.add({
      targets: blockFlash,
      radius: 44,
      alpha: 0,
      duration: 340,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        blockFlash.destroy()
      },
    })
    this.shieldImage.setAlpha(1)
    return true
  }

  // ── collisions ─────────────────────────────────────────────────────

  private collideBulletsWithEnemies(): void {
    for (const bullet of this.bullets) {
      if (bullet.isDead === true) {
        continue
      }
      for (const enemy of this.enemies) {
        if (enemy.isDead === true || bullet.hitEnemies.has(enemy) === true) {
          continue
        }
        const hitRange = BULLET.radius + enemy.radius
        const distanceSq =
          (enemy.image.x - bullet.image.x) ** 2 + (enemy.image.y - bullet.image.y) ** 2
        if (distanceSq > hitRange ** 2) {
          continue
        }
        bullet.hitEnemies.add(enemy)
        this.damageEnemy({ enemy, amount: bullet.damage, source: bullet.source })
        if (bullet.pierceLeft <= 0) {
          bullet.isDead = true
          break
        }
        bullet.pierceLeft -= 1
      }
    }
  }

  private collideEnemiesWithGround(): void {
    for (const enemy of this.enemies) {
      if (enemy.isDead === true) {
        continue
      }
      if (enemy.image.y + enemy.radius < GROUND_Y) {
        continue
      }
      enemy.isDead = true
      if (this.tryAegisBlock({ x: enemy.image.x }) === true) {
        continue
      }
      this.spawnImpactFlash({ x: enemy.image.x, y: GROUND_Y, radius: 34 })
      this.hp -= enemy.contactDamage
      this.cameras.main.shake(120, 0.004)
      if (this.hp <= 0) {
        this.hp = 0
        this.endRun()
        return
      }
    }
  }

  private damageEnemy({
    enemy,
    amount,
    source,
  }: {
    enemy: EnemyUnit
    amount: number
    source: string
  }): void {
    if (enemy.isDead === true) {
      return
    }
    let finalAmount = amount
    if (this.stats.shatterLevel > 0 && enemy.frozenRemainingMs > 0) {
      finalAmount *=
        1 + SHATTERPOINT.baseBonus + SHATTERPOINT.bonusPerLevel * (this.stats.shatterLevel - 1)
    }
    this.damageBySource.set(source, (this.damageBySource.get(source) ?? 0) + finalAmount)
    enemy.hp -= finalAmount
    enemy.image.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL)
    this.time.delayedCall(40, () => {
      if (enemy.image.active === true) {
        enemy.image.clearTint()
        enemy.image.setTintMode(Phaser.TintModes.MULTIPLY)
      }
    })
    if (enemy.hp <= 0) {
      enemy.isDead = true
      this.kills += 1
      this.spawnDeathBurst({ enemy })

      if (enemy.definition.kind === 'splitter') {
        for (let index = 0; index < 3; index += 1) {
          this.spawnEnemy({
            definition: ENEMY_DEFINITIONS.shardling,
            spawnX: enemy.image.x + (Math.random() * 2 - 1) * 12,
            spawnY: enemy.image.y,
            impactX: enemy.image.x + (Math.random() * 2 - 1) * 120,
          })
        }
      }
      if (enemy.definition.kind === 'mothership') {
        this.cameras.main.shake(500, 0.012)
        this.spawnBlast({
          x: enemy.image.x,
          y: enemy.image.y,
          blastRadius: 150,
          damage: 0,
          source: 'boss',
        })
        for (let index = 0; index < BOSS.xpGems; index += 1) {
          this.dropGem({
            x: enemy.image.x + (Math.random() * 2 - 1) * 50,
            y: enemy.image.y + (Math.random() * 2 - 1) * 30,
            xpValue: BOSS.xpPerGem,
          })
        }
        return
      }

      if (enemy.xpValue > 0) {
        this.dropGem({ x: enemy.image.x, y: enemy.image.y, xpValue: enemy.xpValue })
      }
    }
  }

  // ── xp and leveling ────────────────────────────────────────────────

  private dropGem({ x, y, xpValue }: { x: number; y: number; xpValue: number }): void {
    if (this.gemCount >= MAX_CONCURRENT_GEMS) {
      this.addXp({ amount: xpValue })
      return
    }
    this.gemCount += 1
    const gem = this.add.image(x, y, 'gem').setDepth(DEPTHS.bullets)
    this.tweens.add({
      targets: gem,
      x: CANNON_X_POSITIONS[0],
      y: CANNON_Y,
      scale: 0.5,
      delay: 150,
      duration: 420,
      ease: 'Cubic.easeIn',
      onComplete: () => {
        gem.destroy()
        this.gemCount -= 1
        this.addXp({ amount: xpValue })
      },
    })
  }

  private xpRequiredForLevel({ level }: { level: number }): number {
    return Math.floor(XP.base * Math.pow(level, XP.exponent))
  }

  private addXp({ amount }: { amount: number }): void {
    if (this.isRunOver === true) {
      return
    }
    this.xp += amount * this.stats.xpMultiplier
    while (this.xp >= this.xpToNext) {
      this.xp -= this.xpToNext
      this.level += 1
      this.xpToNext = this.xpRequiredForLevel({ level: this.level })
      this.pendingLevelUps += 1
    }
    if (this.pendingLevelUps > 0 && this.hasActiveOffer === false) {
      this.presentLevelUpOffer()
    }
  }

  private presentLevelUpOffer(): void {
    this.hasActiveOffer = true
    const choices = rollUpgradeChoices({
      stacks: this.upgradeStacks,
      roll: () => Math.random(),
      count: LEVEL_UP_CHOICE_COUNT,
      wave: this.wave,
      luck: this.stats.luck,
      weaponSlots: this.stats.weaponSlots,
      weaponTierBonus: this.stats.weaponTierBonus,
    })
    gameEventBus.emit({
      event: 'level-up',
      payload: {
        level: this.level,
        choices,
        weaponSlotsUsed: countOwnedWeapons({ stacks: this.upgradeStacks }),
        weaponSlotsTotal: this.stats.weaponSlots,
      },
    })
    this.scene.pause()
  }

  private applyUpgrade({ upgradeId }: { upgradeId: string }): void {
    const definition = findUpgradeDefinition({ upgradeId })
    if (definition === null || this.hasActiveOffer === false) {
      return
    }

    this.upgradeStacks.set(upgradeId, (this.upgradeStacks.get(upgradeId) ?? 0) + 1)
    this.stats = definition.apply(this.stats)

    if (upgradeId === 'nanite') {
      this.syncNaniteDrones()
    }
    if (upgradeId === 'cloud') {
      this.syncCloudCover()
    }
    for (const cannon of this.cannons) {
      cannon.rangeRing.radius = this.stats.range
    }
    this.syncBuildings()

    this.pendingLevelUps -= 1
    this.emitHudSnapshot()

    if (this.pendingLevelUps > 0) {
      this.presentLevelUpOffer()
      return
    }
    this.hasActiveOffer = false
    this.scene.resume()
  }

  private syncCannons(): void {
    const targetCount = Math.min(this.stats.cannonCount, CANNON_X_POSITIONS.length)
    while (this.cannons.length < targetCount) {
      const x = CANNON_X_POSITIONS[this.cannons.length]
      const rangeRing = this.add
        .circle(x, CANNON_Y, this.stats.range)
        .setStrokeStyle(2, 0x38bdf8, 0.1)
        .setDepth(DEPTHS.rangeRing)
      const barrelImage = this.add
        .image(x, CANNON_Y - 6, 'battery-barrel')
        .setOrigin(0.12, 0.5)
        .setRotation(-Math.PI / 2)
        .setDepth(DEPTHS.barrel)
      const baseImage = this.add.image(x, CANNON_Y, 'battery-base').setDepth(DEPTHS.cannonBase)

      const isReinforcement = this.cannons.length > 0
      if (isReinforcement === true) {
        baseImage.setScale(0)
        barrelImage.setScale(0)
        this.tweens.add({
          targets: [baseImage, barrelImage],
          scale: 1,
          duration: 350,
          ease: 'Back.easeOut',
        })
      }

      this.cannons.push({
        x,
        y: CANNON_Y,
        baseImage,
        barrelImage,
        rangeRing,
        fireAccumulatorMs: 0,
        cooldowns: new Map(),
      })
    }
  }

  // ── buildings ──────────────────────────────────────────────────────

  private spawnBuildings(): void {
    this.buildings = BUILDING_X_POSITIONS.map((x, index) => {
      const textureKey = `building-${index}`
      return {
        x,
        textureKey,
        image: this.add
          .image(x, GROUND_Y + 4, textureKey)
          .setOrigin(0.5, 1)
          .setDepth(DEPTHS.buildings),
        isDestroyed: false,
      }
    })
  }

  private syncBuildings(): void {
    const hpFraction = this.stats.maxHp > 0 ? Math.max(0, this.hp / this.stats.maxHp) : 0
    const destroyedCount = Math.min(
      this.buildings.length,
      this.buildings.length - Math.ceil(hpFraction * this.buildings.length),
    )
    for (let orderIndex = 0; orderIndex < BUILDING_DESTRUCTION_ORDER.length; orderIndex += 1) {
      const building = this.buildings[BUILDING_DESTRUCTION_ORDER[orderIndex]]
      const shouldBeDestroyed = orderIndex < destroyedCount
      if (building.isDestroyed === shouldBeDestroyed) {
        continue
      }
      building.isDestroyed = shouldBeDestroyed
      if (shouldBeDestroyed === true) {
        building.image.setTexture('building-rubble')
        this.spawnImpactFlash({ x: building.x, y: GROUND_Y - 12, radius: 48 })
        this.cameras.main.shake(200, 0.006)
      } else {
        // nanite regen brought it back
        building.image.setTexture(building.textureKey)
      }
    }
  }

  // ── run lifecycle ──────────────────────────────────────────────────

  private setPausedFromUi({ isPaused }: { isPaused: boolean }): void {
    if (this.hasActiveOffer === true || this.isRunOver === true) {
      return
    }
    if (isPaused === true) {
      this.scene.pause()
      return
    }
    this.scene.resume()
  }

  private endRun(): void {
    this.isRunOver = true
    this.syncBuildings()
    const stardustEarned = Math.round(
      (this.kills * STARDUST.perKill +
        this.wave * STARDUST.perWave +
        this.level * STARDUST.perLevel) *
        this.stardustMultiplier,
    )

    const cannonImages = this.cannons.flatMap((cannon) => [
      cannon.baseImage,
      cannon.barrelImage,
      cannon.rangeRing,
    ])
    this.tweens.add({
      targets: [...cannonImages, this.shieldImage],
      scale: 1.6,
      alpha: 0,
      duration: 700,
      ease: 'Cubic.easeOut',
    })
    this.cameras.main.shake(400, 0.01)
    this.emitHudSnapshot()

    this.time.delayedCall(750, () => {
      gameEventBus.emit({
        event: 'run-ended',
        payload: {
          waveReached: this.wave,
          kills: this.kills,
          level: this.level,
          elapsedMs: this.elapsedMs,
          stardustEarned,
        },
      })
      this.scene.pause()
    })
  }

  private emitHudSnapshot(): void {
    let boss: { hp: number; maxHp: number } | null = null
    for (const enemy of this.enemies) {
      if (enemy.isDead === false && enemy.definition.kind === 'mothership') {
        boss = { hp: Math.ceil(enemy.hp), maxHp: Math.ceil(enemy.maxHp) }
        break
      }
    }
    gameEventBus.emit({
      event: 'hud-update',
      payload: {
        hp: Math.ceil(this.hp),
        maxHp: Math.round(this.stats.maxHp),
        level: this.level,
        xp: Math.floor(this.xp),
        xpToNext: this.xpToNext,
        wave: this.wave,
        kills: this.kills,
        elapsedMs: this.elapsedMs,
        boss,
      },
    })
  }

  private cullDeadUnits(): void {
    let hasDeadEnemy = false
    for (const enemy of this.enemies) {
      if (enemy.isDead === true) {
        enemy.image.destroy()
        hasDeadEnemy = true
      }
    }
    if (hasDeadEnemy === true) {
      this.enemies = this.enemies.filter((enemy) => enemy.isDead === false)
    }

    let hasDeadBullet = false
    for (const bullet of this.bullets) {
      if (bullet.isDead === true) {
        bullet.image.destroy()
        hasDeadBullet = true
      }
    }
    if (hasDeadBullet === true) {
      this.bullets = this.bullets.filter((bullet) => bullet.isDead === false)
    }

    let hasDeadRocket = false
    for (const rocket of this.rockets) {
      if (rocket.isDead === true) {
        rocket.image.destroy()
        hasDeadRocket = true
      }
    }
    if (hasDeadRocket === true) {
      this.rockets = this.rockets.filter((rocket) => rocket.isDead === false)
    }
  }

  private spawnImpactFlash({ x, y, radius }: { x: number; y: number; radius: number }): void {
    const flash = this.add.circle(x, y, 6, 0xf87171, 0.9).setDepth(DEPTHS.effects)
    this.tweens.add({
      targets: flash,
      radius,
      alpha: 0,
      duration: 260,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        flash.destroy()
      },
    })
  }

  // ── scenery ────────────────────────────────────────────────────────

  private drawSky(): void {
    const graphics = this.add.graphics().setDepth(DEPTHS.sky)

    // night gradient: deep space at the top fading to a violet glow at the horizon
    graphics.fillGradientStyle(0x020409, 0x020409, 0x1e1b4b, 0x1e1b4b, 1)
    graphics.fillRect(0, 0, ARENA.width, GROUND_Y)
    graphics.fillGradientStyle(0x1e1b4b, 0x1e1b4b, 0x4c1d95, 0x4c1d95, 0.5)
    graphics.fillRect(0, GROUND_Y - 90, ARENA.width, 90)

    // stars, denser near the top
    for (let index = 0; index < 130; index += 1) {
      const x = Math.random() * ARENA.width
      const y = Math.random() ** 1.6 * (GROUND_Y - 40)
      const size = Math.random() < 0.85 ? 1 : 2
      graphics.fillStyle(0xffffff, 0.2 + Math.random() * 0.6)
      graphics.fillRect(x, y, size, size)
    }

    // moon with a soft halo and craters
    const moonX = 1080
    const moonY = 110
    graphics.fillStyle(0xfef9c3, 0.08)
    graphics.fillCircle(moonX, moonY, 52)
    graphics.fillStyle(0xfef9c3, 0.95)
    graphics.fillCircle(moonX, moonY, 30)
    graphics.fillStyle(0xd6d3b1, 0.6)
    graphics.fillCircle(moonX - 10, moonY - 6, 5)
    graphics.fillCircle(moonX + 8, moonY + 10, 4)
    graphics.fillCircle(moonX + 12, moonY - 12, 3)
  }

  private spawnClouds(): void {
    const cloudConfigs = [
      { textureKey: 'cloud-0', x: 200, y: 130, speed: 7, alpha: 0.14, scale: 1.2 },
      { textureKey: 'cloud-1', x: 620, y: 220, speed: 11, alpha: 0.1, scale: 0.9 },
      { textureKey: 'cloud-2', x: 980, y: 320, speed: 15, alpha: 0.12, scale: 1 },
      { textureKey: 'cloud-1', x: 380, y: 420, speed: 19, alpha: 0.08, scale: 1.4 },
    ]
    this.cloudImages = cloudConfigs.map((config) => ({
      image: this.add
        .image(config.x, config.y, config.textureKey)
        .setAlpha(config.alpha)
        .setScale(config.scale)
        .setDepth(DEPTHS.clouds),
      speed: config.speed,
    }))
  }

  /** cloud cover: existing clouds turn active (denser), seeding adds new ones */
  private syncCloudCover(): void {
    if (this.stats.cloudLevel <= 0) {
      return
    }
    for (const cloud of this.cloudImages) {
      cloud.image.setAlpha(CLOUD.activeAlpha)
    }
    const desiredCount = Math.min(
      CLOUD.maxClouds,
      4 + (this.stats.cloudLevel - 1) * CLOUD.cloudsPerStack,
    )
    while (this.cloudImages.length < desiredCount) {
      const textureKey = `cloud-${Math.floor(Math.random() * 3)}`
      const image = this.add
        .image(Math.random() * ARENA.width, 90 + Math.random() * 360, textureKey)
        .setAlpha(0)
        .setScale(0.9 + Math.random() * 0.6)
        .setDepth(DEPTHS.clouds)
      this.tweens.add({ targets: image, alpha: CLOUD.activeAlpha, duration: 900 })
      this.cloudImages.push({ image, speed: 6 + Math.random() * 14 })
    }
  }

  private driftClouds({ delta }: { delta: number }): void {
    const seconds = delta / 1_000
    for (const cloud of this.cloudImages) {
      cloud.image.x += cloud.speed * seconds
      if (cloud.image.x > ARENA.width + 160) {
        cloud.image.x = -160
      }
    }
  }

  private drawGround(): void {
    const graphics = this.add.graphics().setDepth(DEPTHS.ground)

    graphics.fillGradientStyle(0x166534, 0x166534, 0x052e16, 0x052e16, 1)
    graphics.fillRect(0, GROUND_Y, ARENA.width, GROUND.height)
    graphics.lineStyle(2, 0x4ade80, 0.45)
    graphics.lineBetween(0, GROUND_Y, ARENA.width, GROUND_Y)

    // faint horizontal contours suggest depth receding toward the horizon
    graphics.lineStyle(1, 0x14532d, 0.8)
    graphics.lineBetween(0, GROUND_Y + 14, ARENA.width, GROUND_Y + 14)
    graphics.lineStyle(1, 0x14532d, 0.5)
    graphics.lineBetween(0, GROUND_Y + 32, ARENA.width, GROUND_Y + 32)
  }

  // ── generated textures ─────────────────────────────────────────────

  private generateTextures(): void {
    if (this.textures.exists('battery-base') === true) {
      return
    }
    const graphics = this.make.graphics({ x: 0, y: 0 }, false)

    this.generateBatteryTextures({ graphics })
    this.generateBuildingTextures({ graphics })
    this.generateCloudTextures({ graphics })
    this.generateUnitTextures({ graphics })

    graphics.destroy()
  }

  private generateBatteryTextures({ graphics }: { graphics: Phaser.GameObjects.Graphics }): void {
    // base: elliptical platform (perspective) with a domed emplacement
    graphics.fillStyle(0x1e293b)
    graphics.fillEllipse(32, 34, 60, 14)
    graphics.fillStyle(0x475569)
    graphics.fillEllipse(32, 31, 54, 12)
    graphics.fillStyle(0x64748b)
    graphics.fillCircle(32, 24, 14)
    graphics.fillStyle(0x94a3b8)
    graphics.fillCircle(28, 20, 5)
    graphics.generateTexture('battery-base', 64, 44)
    graphics.clear()

    // barrel: rectangle pointing +x, pivot near the left end, lit tip
    graphics.fillStyle(0x94a3b8)
    graphics.fillRect(0, 2, 34, 6)
    graphics.fillStyle(0x22d3ee)
    graphics.fillRect(28, 1, 6, 8)
    graphics.lineStyle(1, 0x334155)
    graphics.strokeRect(0, 2, 34, 6)
    graphics.generateTexture('battery-barrel', 36, 10)
    graphics.clear()

    // shield ring
    graphics.lineStyle(3, 0x38bdf8, 0.5)
    graphics.strokeCircle(60, 60, BATTERY.shieldRadius)
    graphics.lineStyle(8, 0x38bdf8, 0.12)
    graphics.strokeCircle(60, 60, BATTERY.shieldRadius)
    graphics.generateTexture('shield', 120, 120)
    graphics.clear()
  }

  private generateBuildingTextures({ graphics }: { graphics: Phaser.GameObjects.Graphics }): void {
    const frontWidth = 52
    const sideDepth = 14
    const sideRise = 9

    for (let index = 0; index < BUILDING_HEIGHTS.length; index += 1) {
      const height = BUILDING_HEIGHTS[index]
      const textureHeight = height + sideRise + 2
      const top = sideRise + 1

      // side face (parallelogram receding up-right, darkest)
      graphics.fillStyle(0x0f172a)
      graphics.beginPath()
      graphics.moveTo(frontWidth, top)
      graphics.lineTo(frontWidth + sideDepth, top - sideRise)
      graphics.lineTo(frontWidth + sideDepth, top - sideRise + height)
      graphics.lineTo(frontWidth, top + height)
      graphics.closePath()
      graphics.fillPath()

      // roof (parallelogram, mid tone catches the moonlight)
      graphics.fillStyle(0x475569)
      graphics.beginPath()
      graphics.moveTo(0, top)
      graphics.lineTo(sideDepth, top - sideRise)
      graphics.lineTo(frontWidth + sideDepth, top - sideRise)
      graphics.lineTo(frontWidth, top)
      graphics.closePath()
      graphics.fillPath()

      // front face
      graphics.fillStyle(0x1e293b)
      graphics.fillRect(0, top, frontWidth, height)
      graphics.lineStyle(1, 0x0f172a)
      graphics.strokeRect(0, top, frontWidth, height)

      // lit windows on the front, sparser dim ones on the side
      for (let column = 0; column < 4; column += 1) {
        for (let row = 0; row < Math.floor(height / 16); row += 1) {
          if (Math.random() < 0.55) {
            graphics.fillStyle(0xfbbf24, 0.35 + Math.random() * 0.45)
            graphics.fillRect(5 + column * 12, top + 6 + row * 16, 5, 7)
          }
        }
      }
      for (let row = 0; row < Math.floor(height / 20); row += 1) {
        if (Math.random() < 0.4) {
          graphics.fillStyle(0xfbbf24, 0.15)
          graphics.fillRect(frontWidth + 4, top - 4 + row * 20, 4, 6)
        }
      }

      graphics.generateTexture(`building-${index}`, frontWidth + sideDepth + 1, textureHeight)
      graphics.clear()
    }

    // rubble: collapsed mound with debris chunks
    graphics.fillStyle(0x1e293b)
    graphics.fillTriangle(2, 26, 30, 6, 62, 26)
    graphics.fillStyle(0x0f172a)
    graphics.fillTriangle(18, 26, 40, 12, 58, 26)
    graphics.fillStyle(0x475569)
    graphics.fillRect(8, 20, 8, 6)
    graphics.fillRect(40, 18, 10, 8)
    graphics.fillRect(26, 22, 6, 4)
    graphics.generateTexture('building-rubble', 66, 28)
    graphics.clear()
  }

  private generateCloudTextures({ graphics }: { graphics: Phaser.GameObjects.Graphics }): void {
    const cloudShapes: Array<Array<[number, number, number]>> = [
      [
        [40, 26, 22],
        [70, 20, 26],
        [104, 24, 20],
        [82, 32, 24],
        [54, 34, 18],
      ],
      [
        [30, 18, 16],
        [56, 14, 20],
        [82, 18, 15],
        [56, 24, 22],
      ],
      [
        [36, 22, 18],
        [64, 16, 22],
        [94, 22, 18],
        [120, 26, 12],
        [78, 30, 20],
      ],
    ]
    for (let index = 0; index < cloudShapes.length; index += 1) {
      for (const [x, y, radius] of cloudShapes[index]) {
        graphics.fillStyle(0xe2e8f0, 0.5)
        graphics.fillCircle(x, y, radius)
      }
      graphics.generateTexture(`cloud-${index}`, 140, 52)
      graphics.clear()
    }
  }

  private generateUnitTextures({ graphics }: { graphics: Phaser.GameObjects.Graphics }): void {
    // drifter: red invader
    graphics.fillStyle(0xef4444)
    graphics.fillCircle(14, 14, 12)
    graphics.lineStyle(2, 0x7f1d1d)
    graphics.strokeCircle(14, 14, 12)
    graphics.fillStyle(0x7f1d1d)
    graphics.fillCircle(14, 14, 4)
    graphics.generateTexture('enemy-drifter', 28, 28)
    graphics.clear()

    // speeder: yellow dart pointing +x
    graphics.fillStyle(0xfacc15)
    graphics.fillTriangle(24, 12, 2, 2, 2, 22)
    graphics.lineStyle(2, 0x854d0e)
    graphics.strokeTriangle(24, 12, 2, 2, 2, 22)
    graphics.generateTexture('enemy-speeder', 26, 24)
    graphics.clear()

    // tank: purple hexagon
    this.drawRegularPolygon({
      graphics,
      sides: 6,
      radius: 18,
      centerX: 20,
      centerY: 20,
      fillColor: 0xa855f7,
      strokeColor: 0x581c87,
    })
    graphics.generateTexture('enemy-tank', 40, 40)
    graphics.clear()

    // elite: orange octagon with core
    this.drawRegularPolygon({
      graphics,
      sides: 8,
      radius: 26,
      centerX: 28,
      centerY: 28,
      fillColor: 0xf97316,
      strokeColor: 0x7c2d12,
    })
    graphics.fillStyle(0x7c2d12)
    graphics.fillCircle(28, 28, 9)
    graphics.generateTexture('enemy-elite', 56, 56)
    graphics.clear()

    // splitter: magenta blob carrying its shardlings
    graphics.fillStyle(0xec4899)
    graphics.fillCircle(16, 16, 15)
    graphics.lineStyle(2, 0x831843)
    graphics.strokeCircle(16, 16, 15)
    graphics.fillStyle(0xf9a8d4)
    graphics.fillCircle(11, 13, 4)
    graphics.fillCircle(21, 13, 4)
    graphics.fillCircle(16, 22, 4)
    graphics.generateTexture('enemy-splitter', 32, 32)
    graphics.clear()

    // shardling: tiny pink dart
    graphics.fillStyle(0xf472b6)
    graphics.fillTriangle(14, 7, 2, 2, 2, 12)
    graphics.lineStyle(1, 0x831843)
    graphics.strokeTriangle(14, 7, 2, 2, 2, 12)
    graphics.generateTexture('enemy-shardling', 16, 14)
    graphics.clear()

    // mothership: broad saucer with dome and running lights
    graphics.fillStyle(0x334155)
    graphics.fillEllipse(44, 30, 84, 26)
    graphics.fillStyle(0x475569)
    graphics.fillEllipse(44, 24, 56, 20)
    graphics.fillStyle(0x94a3b8)
    graphics.fillCircle(44, 18, 11)
    graphics.lineStyle(2, 0x1e293b)
    graphics.strokeEllipse(44, 30, 84, 26)
    for (let lightIndex = 0; lightIndex < 5; lightIndex += 1) {
      graphics.fillStyle(lightIndex % 2 === 0 ? 0xf87171 : 0x67e8f9, 0.95)
      graphics.fillCircle(14 + lightIndex * 15, 33, 2.5)
    }
    graphics.generateTexture('enemy-mothership', 88, 48)
    graphics.clear()

    // training dummy: bullseye target board
    graphics.fillStyle(0x475569)
    graphics.fillCircle(18, 18, 16)
    graphics.fillStyle(0xe2e8f0)
    graphics.fillCircle(18, 18, 11)
    graphics.fillStyle(0xef4444)
    graphics.fillCircle(18, 18, 6)
    graphics.lineStyle(2, 0x1e293b)
    graphics.strokeCircle(18, 18, 16)
    graphics.generateTexture('enemy-dummy', 36, 36)
    graphics.clear()

    // bullet
    graphics.fillStyle(0x22d3ee)
    graphics.fillCircle(6, 6, BULLET.radius)
    graphics.lineStyle(2, 0xa5f3fc, 0.7)
    graphics.strokeCircle(6, 6, BULLET.radius + 1)
    graphics.generateTexture('bullet', 12, 12)
    graphics.clear()

    // xp gem: green diamond
    graphics.fillStyle(0x4ade80)
    graphics.fillTriangle(7, 0, 14, 9, 0, 9)
    graphics.fillTriangle(0, 9, 14, 9, 7, 18)
    graphics.lineStyle(1, 0x166534)
    graphics.strokeTriangle(7, 0, 14, 9, 0, 9)
    graphics.generateTexture('gem', 14, 18)
    graphics.clear()

    // strafing aircraft: slate jet pointing +x with cockpit and engine glow
    graphics.fillStyle(0x64748b)
    graphics.fillTriangle(36, 7, 6, 2, 6, 12)
    graphics.fillStyle(0x475569)
    graphics.fillRect(0, 5, 10, 4)
    graphics.fillTriangle(16, 7, 8, 0, 8, 7)
    graphics.fillTriangle(16, 7, 8, 14, 8, 7)
    graphics.fillStyle(0xbae6fd)
    graphics.fillCircle(26, 6, 2)
    graphics.fillStyle(0xfbbf24, 0.9)
    graphics.fillCircle(1, 7, 2)
    graphics.generateTexture('aircraft', 38, 14)
    graphics.clear()

    // flak bomb: dark pellet with an orange tip
    graphics.fillStyle(0x1e293b)
    graphics.fillEllipse(4, 5, 7, 9)
    graphics.fillStyle(0xfb923c)
    graphics.fillCircle(4, 9, 2)
    graphics.generateTexture('bomb', 8, 12)
    graphics.clear()

    // nanite repair drone: pale green hover-bot with side rotors
    graphics.fillStyle(0x4ade80)
    graphics.fillRect(0, 6, 4, 2)
    graphics.fillRect(12, 6, 4, 2)
    graphics.fillStyle(0xd1fae5)
    graphics.fillEllipse(8, 8, 10, 7)
    graphics.fillStyle(0x166534)
    graphics.fillCircle(8, 8, 2)
    graphics.generateTexture('nanite-drone', 16, 14)
    graphics.clear()

    // sky mine: dark spiked sphere with a warning light
    graphics.fillStyle(0x334155)
    for (let spikeIndex = 0; spikeIndex < 8; spikeIndex += 1) {
      const spikeAngle = (spikeIndex / 8) * Math.PI * 2
      graphics.fillCircle(9 + Math.cos(spikeAngle) * 8, 9 + Math.sin(spikeAngle) * 8, 2)
    }
    graphics.fillStyle(0x475569)
    graphics.fillCircle(9, 9, 7)
    graphics.fillStyle(0xfde047)
    graphics.fillCircle(9, 9, 2.5)
    graphics.generateTexture('mine', 18, 18)
    graphics.clear()

    // flak shell: stubby orange proximity charge
    graphics.fillStyle(0xfb923c)
    graphics.fillCircle(6, 6, 5)
    graphics.fillStyle(0x7c2d12)
    graphics.fillCircle(6, 6, 2)
    graphics.lineStyle(1, 0xfdba74, 0.9)
    graphics.strokeCircle(6, 6, 5)
    graphics.generateTexture('flak-shell', 12, 12)
    graphics.clear()

    // flak fragment: tiny hot ember
    graphics.fillStyle(0xfdba74)
    graphics.fillCircle(3, 3, 2)
    graphics.lineStyle(1, 0xfb923c, 0.8)
    graphics.strokeCircle(3, 3, 3)
    graphics.generateTexture('flak-frag', 6, 6)
    graphics.clear()

    // rocket: pale body, orange nose, tail fins, exhaust glow — pointing +x
    graphics.fillStyle(0x94a3b8)
    graphics.fillRect(0, 1, 5, 3)
    graphics.fillRect(0, 8, 5, 3)
    graphics.fillStyle(0xe2e8f0)
    graphics.fillRect(2, 3, 15, 6)
    graphics.fillStyle(0xfb923c)
    graphics.fillTriangle(23, 6, 17, 2, 17, 10)
    graphics.fillStyle(0x67e8f9, 0.9)
    graphics.fillCircle(1, 6, 2)
    graphics.generateTexture('rocket', 24, 12)
    graphics.clear()
  }

  private drawRegularPolygon({
    graphics,
    sides,
    radius,
    centerX,
    centerY,
    fillColor,
    strokeColor,
  }: {
    graphics: Phaser.GameObjects.Graphics
    sides: number
    radius: number
    centerX: number
    centerY: number
    fillColor: number
    strokeColor: number
  }): void {
    const points: Array<Phaser.Math.Vector2> = []
    for (let index = 0; index < sides; index += 1) {
      const angle = (index / sides) * Math.PI * 2 - Math.PI / 2
      points.push(
        new Phaser.Math.Vector2(
          centerX + Math.cos(angle) * radius,
          centerY + Math.sin(angle) * radius,
        ),
      )
    }
    graphics.fillStyle(fillColor)
    graphics.fillPoints(points, true)
    graphics.lineStyle(2, strokeColor)
    graphics.strokePoints(points, true)
  }
}
