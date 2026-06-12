import Phaser from 'phaser'

import {
  AIRSTRIKE,
  ARENA,
  BASE_RUN_STATS,
  BATTERY,
  BFG,
  BULLET,
  CHAIN,
  CLOUD,
  DEVOURER,
  ELITE_AFFIXES,
  ENEMY_AURAS,
  FLAK,
  FLAME,
  BOSS,
  CLUSTER_BOMBS,
  FILLER_REWARDS,
  GROUND,
  LANCE,
  LOCKDOWN,
  MINES,
  NOVA,
  ORBITAL_LASER,
  SHATTERPOINT,
  STORM_FRONT,
  SALVO,
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
import {
  countOwnedWeapons,
  fillerStardustReward,
  findUpgradeDefinition,
  isFillerUpgradeId,
  rollUpgradeChoices,
} from '@/game/data/upgrades'
import { gameEventBus } from '@/game/eventBus'
import { damageNumbersEnabled, screenShakeEnabled } from '@/game/settings'
import { soundEngine } from '@/game/sound'
import type { GameSceneData, RunStats, SandboxLayout } from '@/game/types'

type EliteAffix = 'swift' | 'regen' | 'split'

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
  /** burning DoT — re-igniting refreshes the clock, the strongest dps wins */
  burning: { dps: number; remainingMs: number; tickAccumulatorMs: number } | null
  /** lightning stun: a dead stop, shorter than a freeze */
  stunnedRemainingMs: number
  /** cryo chill: a timed slow, separate from cloud cover's positional slow */
  chilledRemainingMs: number
  /** concussive shove still in flight — decays to null */
  knockback: { velocityX: number; velocityY: number; remainingMs: number } | null
  /** bosses periodically deploy adds */
  spawnerAccumulatorMs: number
  /** shared timer for periodic behaviors: boss bolts, mender heals, elite regen */
  attackAccumulatorMs: number
  /** wardens spawn with a shield that absorbs the first hit outright */
  hasShield: boolean
  /** dancers weave side to side while falling — breaks intercept prediction */
  zigzag: { baseX: number; amplitudeX: number; omegaRadPerSec: number; phase: number } | null
  /** elites roll a random modifier */
  affix: EliteAffix | null
  /** training dummies on patrol sweep side to side */
  patrol: { baseX: number; amplitudeX: number; phase: number } | null
  isDead: boolean
}

/** a plasma bolt dropped by a hovering mothership */
interface BossBoltUnit {
  image: Phaser.GameObjects.Image
  velocityY: number
  isDead: boolean
}

/** a stasis missile in flight — detonates into a freezing pulse on contact */
interface StasisMissileUnit {
  image: Phaser.GameObjects.Image
  velocityX: number
  velocityY: number
  trailAccumulatorMs: number
  isDead: boolean
}

/** a devourer payload in flight, before it finds a host */
interface NaniteShotUnit {
  image: Phaser.GameObjects.Image
  velocityX: number
  velocityY: number
  budget: number
  isDead: boolean
}

/** a devourer swarm eating its host; leaps onward when the host dies */
interface SwarmUnit {
  host: EnemyUnit
  remainingBudget: number
  /** last known host position, so the swarm can leap even after the corpse is culled */
  x: number
  y: number
  puffAccumulatorMs: number
  isDead: boolean
}

/** a thermal lance beam anchored at the main cannon, sweeping an arc across the sky */
interface SweepBeam {
  originX: number
  originY: number
  angleRad: number
  endAngleRad: number
  directionSign: 1 | -1
  damage: number
  hitEnemies: Set<EnemyUnit>
  /** how far the beam reaches this frame — full range, or cut short by the invader blocking it */
  currentLengthPx: number
  isDead: boolean
}

interface MineUnit {
  image: Phaser.GameObjects.Image
  /** the balloon holding the mine on station */
  balloonImage: Phaser.GameObjects.Image
  /** the mine's logical altitude — the balloon slowly lifts it toward the ceiling */
  baseY: number
  /** randomizes the bobbing motion so mines don't sway in lockstep */
  bobPhase: number
  armRemainingMs: number
  /** static mines synergy: time since the mine last zapped something */
  zapAccumulatorMs: number
  isDead: boolean
}

/** a mine lobbed from a cannon, arcing under gravity toward its station point */
interface MineShellUnit {
  image: Phaser.GameObjects.Image
  velocityX: number
  velocityY: number
  targetX: number
  targetY: number
  remainingMs: number
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
  /** main-gun bullets roll their crit at fire time; carried for the damage popup */
  isCrit: boolean
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

const SPAWN_Y = -30
const BARREL_LENGTH = 30
/** deploy order for the primary cannon and the three Auxiliary Cannon upgrades, as fractions of arena width */
const CANNON_X_FRACTIONS = [0.5, 0.734, 0.219, 0.922] as const
const BUILDING_X_FRACTIONS = [0.148, 0.281, 0.406, 0.625, 0.844] as const
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
/** largest real-time frame delta the sim honors — a backgrounded tab hiccups one frame instead of fast-forwarding the whole pause */
const MAX_FRAME_DELTA_MS = 100
/** seconds per full side-to-side sweep of a patrolling training dummy */
const DUMMY_PATROL_PERIOD_S = 5
/** killable training dummies pop back up after this long */
const DUMMY_RESPAWN_MS = 1_500
/** how long a concussive shove takes to play out */
const KNOCKBACK_DURATION_MS = 250
/** gravity pulling lobbed mine shells back down, px/s² */
const MINE_SHELL_GRAVITY = 700
/** how far above its mine the balloon floats */
const MINE_BALLOON_OFFSET_Y = 24
/** balloons slowly lift their mines, then hold just under the top of the sky */
const MINE_RISE_SPEED_PX_PER_SEC = 12
const MINE_CEILING_Y = 80

const COOLDOWN_BAR_WIDTH = 30
const WEAPON_BAR_COLORS: Record<string, number> = {
  main: 0x22d3ee,
  nova: 0x67e8f9,
  rocket: 0xfb923c,
  chain: 0x93c5fd,
  flak: 0xfdba74,
  flame: 0xf97316,
  devourer: 0x86efac,
  lockdown: 0x7dd3fc,
  railgun: 0xe879f9,
  airstrike: 0xa3e635,
  bfg: 0x4ade80,
  lance: 0xfacc15,
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
  flame: 'FIRE',
  devourer: 'SWRM',
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

  // battlefield layout, derived from the actual arena size (portrait or landscape)
  private arenaWidth: number = ARENA.width
  private arenaHeight: number = ARENA.height
  private groundY: number = ARENA.height - GROUND.height
  private cannonY: number = ARENA.height - GROUND.height - 16
  private cannonXs: Array<number> = []
  private buildingXs: Array<number> = []

  private hp = 0
  private level = 1
  private xp = 0
  private xpToNext = 0
  private wave = 1
  private kills = 0
  private elapsedMs = 0
  /** banked by Stardust Cache filler picks, paid out at run end */
  private bonusStardust = 0

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
  private orbitalAccumulatorMs = 0
  private stormAccumulatorMs = 0
  private aegisAccumulatorMs = 0
  private hudAccumulatorMs = 0

  private upgradeStacks = new Map<string, number>()
  private pendingLevelUps = 0
  private hasActiveOffer = false
  /** run-wide reroll budget: base stats plus the paragon reroll nodes */
  private runRerollsLeft = 0
  /** run-wide banish budget — zero unless paragon banish nodes are unlocked */
  private runBanishesLeft = 0
  /** card ids struck from this run's pool */
  private banishedCardIds = new Set<string>()
  private isRunOver = false
  private speedMultiplier = 1

  /** training-range mode: static invincible dummies, no waves, dps reporting */
  private isSandbox = false
  private sandboxLayout: SandboxLayout = {
    formation: 'field',
    spread: 1,
    isMoving: false,
    isMainGunEnabled: true,
    dummyHp: null,
  }
  private damageBySource = new Map<string, number>()
  private sandboxStatsAccumulatorMs = 0
  private floatingTextCount = 0
  /** killed dummies queue up here and pop back at their station */
  private dummyRespawnQueue: Array<{
    x: number
    y: number
    radius: number
    scale: number
    patrolAmplitude: number
    patrolPhase: number
    remainingMs: number
  }> = []

  private planes: Array<PlaneUnit> = []
  private bombs: Array<BombUnit> = []
  private sweeps: Array<SweepBeam> = []
  private sweepGraphics!: Phaser.GameObjects.Graphics
  private mines: Array<MineUnit> = []
  private mineShells: Array<MineShellUnit> = []
  private bossBolts: Array<BossBoltUnit> = []
  private naniteShots: Array<NaniteShotUnit> = []
  private swarms: Array<SwarmUnit> = []
  private stasisMissiles: Array<StasisMissileUnit> = []
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
    this.arenaWidth = this.scale.width
    this.arenaHeight = this.scale.height
    this.groundY = this.arenaHeight - GROUND.height
    this.cannonY = this.groundY - 16
    this.cannonXs = CANNON_X_FRACTIONS.map((fraction) => Math.round(fraction * this.arenaWidth))
    this.buildingXs = BUILDING_X_FRACTIONS.map((fraction) => Math.round(fraction * this.arenaWidth))
    this.stats = { ...data.startingStats }
    this.stardustMultiplier = data.stardustMultiplier
    this.runRerollsLeft = this.stats.rerollsPerRun
    this.runBanishesLeft = this.stats.banishesPerRun
    this.hp = this.stats.maxHp
    this.xpToNext = this.xpRequiredForLevel({ level: this.level })
    this.isSandbox = data.mode === 'sandbox'
    this.sandboxLayout = data.sandboxLayout ?? {
      formation: 'field',
      spread: 1,
      isMoving: false,
      isMainGunEnabled: true,
      dummyHp: null,
    }
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
      .image(this.cannonXs[0], this.cannonY, 'shield')
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
        event: 'reroll-requested',
        handler: () => {
          this.rerollActiveOffer()
        },
      }),
      gameEventBus.on({
        event: 'banish-requested',
        handler: (payload) => {
          this.banishCard({ upgradeId: payload.upgradeId })
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
          soundEngine.setSuppressed({ isSuppressed: true })
          let remainingMs = payload.gameMs
          while (remainingMs > 0) {
            const stepMs = Math.min(remainingMs, MAX_SIM_STEP_MS)
            this.simulateStep({ delta: stepMs })
            remainingMs -= stepMs
          }
          soundEngine.setSuppressed({ isSuppressed: false })
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
      soundEngine.stopMusic()
    }
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      unsubscribeAll()
    })
    this.events.once(Phaser.Scenes.Events.DESTROY, () => {
      unsubscribeAll()
    })

    soundEngine.startMusic()
    this.emitHudSnapshot()
  }

  override update(_time: number, delta: number): void {
    if (this.isRunOver === true) {
      return
    }

    let remainingMs = Math.min(delta, MAX_FRAME_DELTA_MS) * this.speedMultiplier
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
      mine.balloonImage.destroy()
    }
    this.mines = []
    for (const shell of this.mineShells) {
      shell.image.destroy()
    }
    this.mineShells = []
    for (const bolt of this.bossBolts) {
      bolt.image.destroy()
    }
    this.bossBolts = []
    for (const shot of this.naniteShots) {
      shot.image.destroy()
    }
    this.naniteShots = []
    this.swarms = []
    for (const missile of this.stasisMissiles) {
      missile.image.destroy()
    }
    this.stasisMissiles = []
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
    this.dummyRespawnQueue = []

    this.stats = { ...stats }
    this.sandboxLayout = layout
    this.upgradeStacks = new Map(Object.entries(cardStacks).filter(([, stacks]) => stacks > 0))
    this.hp = this.stats.maxHp
    this.elapsedMs = 0
    this.damageBySource = new Map()
    this.airstrikeAccumulatorMs = 0
    this.bfgAccumulatorMs = 0
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
        x: this.arenaWidth / 2,
        // same clamp as the real boss: keep the big dummy inside gun range
        y: Math.max(300, this.cannonY - this.stats.range * 0.8),
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
          x: this.arenaWidth / 2 + offsetFromCenter,
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
    const hp = this.sandboxLayout.dummyHp ?? Number.POSITIVE_INFINITY
    const image = this.add.image(x, y, 'enemy-dummy').setScale(scale).setDepth(DEPTHS.units)
    this.enemies.push({
      image,
      definition: ENEMY_DEFINITIONS.dummy,
      hp,
      maxHp: hp,
      speed: 0,
      contactDamage: 0,
      xpValue: 0,
      radius,
      directionX: 0,
      directionY: 0,
      isSlowed: false,
      frozenRemainingMs: 0,
      burning: null,
      stunnedRemainingMs: 0,
      chilledRemainingMs: 0,
      knockback: null,
      spawnerAccumulatorMs: 0,
      attackAccumulatorMs: 0,
      hasShield: false,
      zigzag: null,
      affix: null,
      patrol:
        patrolAmplitude > 0 ? { baseX: x, amplitudeX: patrolAmplitude, phase: patrolPhase } : null,
      isDead: false,
    })
  }

  /** runs on sim time, so respawns also work inside synchronous fast-forwards */
  private tickDummyRespawns({ delta }: { delta: number }): void {
    if (this.dummyRespawnQueue.length === 0) {
      return
    }
    const due: Array<(typeof this.dummyRespawnQueue)[number]> = []
    for (const pending of this.dummyRespawnQueue) {
      pending.remainingMs -= delta
      if (pending.remainingMs <= 0) {
        due.push(pending)
      }
    }
    if (due.length === 0) {
      return
    }
    this.dummyRespawnQueue = this.dummyRespawnQueue.filter((pending) => pending.remainingMs > 0)
    for (const pending of due) {
      this.spawnDummy(pending)
    }
  }

  private canSimulate(): boolean {
    return this.isRunOver === false && this.hasActiveOffer === false
  }

  /** all camera shake funnels through here so the settings toggle can disable it */
  private shakeCamera({ durationMs, intensity }: { durationMs: number; intensity: number }): void {
    if (screenShakeEnabled.value === false) {
      return
    }
    this.cameras.main.shake(durationMs, intensity)
  }

  private simulateStep({ delta }: { delta: number }): void {
    this.elapsedMs += delta

    this.driftClouds({ delta })
    if (this.isSandbox === false) {
      this.advanceWaveClock({ delta })
      this.spawnFromClock({ delta })
    } else {
      this.tickDummyRespawns({ delta })
    }
    this.fireFromClock({ delta })
    this.moveBullets({ delta })
    this.moveEnemies({ delta })
    this.updateCannonWeapons({ delta })
    this.updateDevourerSwarms({ delta })
    this.moveStasisMissiles({ delta })
    this.moveRockets({ delta })
    this.updateAirstrike({ delta })
    this.updateBfg({ delta })
    this.updateLanceSweeps({ delta })
    this.updateBurning({ delta })
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
          spawnX: this.arenaWidth / 2 + (Math.random() * 2 - 1) * 200,
        })
      } else if (this.wave % WAVES.eliteEveryNWaves === 0) {
        const affixes: Array<EliteAffix> = ['swift', 'regen', 'split']
        this.spawnEnemy({
          definition: ENEMY_DEFINITIONS.elite,
          affix: affixes[Math.floor(Math.random() * affixes.length)],
        })
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
    // the training range can silence the main guns to isolate one ability
    if (this.isSandbox === true && this.sandboxLayout.isMainGunEnabled === false) {
      return
    }
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
    affix = null,
  }: {
    definition: EnemyDefinition
    spawnX?: number
    spawnY?: number
    impactX?: number
    affix?: EliteAffix | null
  }): void {
    const x = spawnX ?? Math.random() * this.arenaWidth
    const y = spawnY ?? SPAWN_Y
    const targetXs = this.listImpactTargetXs()
    const targetX = targetXs[Math.floor(Math.random() * targetXs.length)]
    const resolvedImpactX = impactX ?? targetX + (Math.random() * 2 - 1) * 40

    const waveScale = Math.pow(WAVES.hpGrowthPerWave, this.wave - 1)
    const speedScale = Math.min(2, Math.pow(WAVES.speedGrowthPerWave, this.wave - 1))

    // dancers fall straight down and weave; motherships descend to a hover
    const fallsStraight = definition.kind === 'dancer' || definition.kind === 'mothership'
    const fallAngle =
      fallsStraight === true ? Math.PI / 2 : Math.atan2(this.groundY - y, resolvedImpactX - x)
    const image = this.add
      .image(x, y, definition.textureKey)
      .setDepth(DEPTHS.units)
      .setRotation(definition.kind === 'mothership' || definition.kind === 'dancer' ? 0 : fallAngle)

    let hp = definition.hp * waveScale
    let speed = definition.speed * speedScale
    if (affix === 'swift') {
      speed *= ELITE_AFFIXES.swift.speedMult
      hp *= ELITE_AFFIXES.swift.hpMult
    }

    this.enemies.push({
      image,
      definition,
      hp,
      maxHp: hp,
      speed,
      contactDamage: definition.contactDamage,
      xpValue: definition.xpValue,
      radius: definition.radius,
      directionX: Math.cos(fallAngle),
      directionY: Math.sin(fallAngle),
      isSlowed: false,
      frozenRemainingMs: 0,
      burning: null,
      stunnedRemainingMs: 0,
      chilledRemainingMs: 0,
      knockback: null,
      spawnerAccumulatorMs: 0,
      attackAccumulatorMs: 0,
      hasShield: definition.kind === 'warden',
      zigzag:
        definition.kind === 'dancer'
          ? {
              baseX: x,
              amplitudeX: 50 + Math.random() * 45,
              omegaRadPerSec: 2.6 + Math.random() * 1.4,
              phase: Math.random() * Math.PI * 2,
            }
          : null,
      affix,
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

  /** current real speed in px/s — 0 while frozen or stunned, reduced by clouds and chill */
  private effectiveEnemySpeed({ enemy }: { enemy: EnemyUnit }): number {
    if (enemy.frozenRemainingMs > 0 || enemy.stunnedRemainingMs > 0) {
      return 0
    }
    let speed = enemy.speed
    if (enemy.isSlowed === true) {
      speed *= this.cloudSlowFactor()
    }
    if (enemy.chilledRemainingMs > 0) {
      speed *= SYNERGIES.cryoshells.chillSlowFactor
    }
    return speed
  }

  private moveEnemies({ delta }: { delta: number }): void {
    const seconds = delta / 1_000
    const hasCloudCover = this.stats.cloudLevel > 0

    for (const enemy of this.enemies) {
      if (enemy.isDead === true) {
        continue
      }

      if (enemy.stunnedRemainingMs > 0) {
        enemy.stunnedRemainingMs -= delta
      }
      if (enemy.chilledRemainingMs > 0) {
        enemy.chilledRemainingMs -= delta
      }
      // a concussive shove moves even frozen or stunned targets
      if (enemy.knockback !== null) {
        enemy.knockback.remainingMs -= delta
        const shoveX = enemy.knockback.velocityX * seconds
        enemy.image.x = Phaser.Math.Clamp(
          enemy.image.x + shoveX,
          enemy.radius,
          this.arenaWidth - enemy.radius,
        )
        enemy.image.y += enemy.knockback.velocityY * seconds
        // weavers and patrollers compute x from a base — shift it so the shove sticks
        if (enemy.zigzag !== null) {
          enemy.zigzag.baseX = Phaser.Math.Clamp(
            enemy.zigzag.baseX + shoveX,
            enemy.radius,
            this.arenaWidth - enemy.radius,
          )
        }
        if (enemy.patrol !== null) {
          enemy.patrol.baseX += shoveX
        }
        if (enemy.knockback.remainingMs <= 0) {
          enemy.knockback = null
        }
      }

      if (enemy.frozenRemainingMs > 0) {
        enemy.frozenRemainingMs -= delta
        if (enemy.frozenRemainingMs <= 0 && enemy.image.tintMode === Phaser.TintModes.MULTIPLY) {
          enemy.image.clearTint()
          enemy.isSlowed = false
        }
        continue
      }

      if (enemy.stunnedRemainingMs > 0) {
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
      // affix tint survives the white damage flash by re-applying every frame
      if (
        enemy.affix !== null &&
        enemy.isSlowed === false &&
        enemy.image.tintMode === Phaser.TintModes.MULTIPLY
      ) {
        enemy.image.setTint(ELITE_AFFIXES[enemy.affix].tint)
      }
      const speed = this.effectiveEnemySpeed({ enemy })

      // the mothership descends to its hover line, then drifts and bombards
      if (enemy.definition.kind === 'mothership') {
        if (enemy.image.y < this.bossHoverY()) {
          enemy.directionX = 0
          enemy.directionY = 1
          enemy.image.y += speed * seconds
        } else {
          if (enemy.directionY !== 0 || enemy.directionX === 0) {
            enemy.directionY = 0
            enemy.directionX = Math.random() < 0.5 ? -1 : 1
            enemy.speed = BOSS.driftSpeedPxPerSec
          }
          if (enemy.image.x < 140) {
            enemy.directionX = 1
          } else if (enemy.image.x > this.arenaWidth - 140) {
            enemy.directionX = -1
          }
          enemy.image.x += enemy.directionX * speed * seconds
        }
        continue
      }

      // dancers: vertical fall with a sideways weave the intercept solver can't pin
      if (enemy.zigzag !== null) {
        const speedFraction = enemy.speed > 0 ? speed / enemy.speed : 0
        enemy.zigzag.phase += enemy.zigzag.omegaRadPerSec * speedFraction * seconds
        enemy.image.y += speed * seconds
        enemy.image.x = enemy.zigzag.baseX + Math.sin(enemy.zigzag.phase) * enemy.zigzag.amplitudeX
        // expose the instantaneous velocity so intercepts stay honest
        const velocityX =
          enemy.zigzag.amplitudeX *
          enemy.zigzag.omegaRadPerSec *
          speedFraction *
          Math.cos(enemy.zigzag.phase)
        const totalSpeed = Math.hypot(velocityX, speed)
        if (totalSpeed > 0) {
          enemy.directionX = velocityX / totalSpeed
          enemy.directionY = speed / totalSpeed
        }
        continue
      }

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
        bullet.image.x > this.arenaWidth + BULLET_CULL_MARGIN ||
        bullet.image.y < -BULLET_CULL_MARGIN ||
        bullet.image.y > this.groundY
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

  /** enemies above the top edge haven't entered the battlefield yet — weapons hold fire */
  private isEnemyOnField({ enemy }: { enemy: EnemyUnit }): boolean {
    return enemy.image.y + enemy.radius > 0
  }

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
      if (enemy.isDead === true || this.isEnemyOnField({ enemy }) === false) {
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
    soundEngine.play({ name: 'shot' })
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
      // salvo: only the first shot of a volley hits at full strength
      const salvoFactor = index === 0 ? 1 : SALVO.extraShotDamageFactor
      const baseDamage = this.stats.damage * salvoFactor
      const damage = isCrit === true ? baseDamage * this.stats.critMultiplier : baseDamage

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
        isCrit,
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
        isCrit: false,
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

  // ── devourer swarm ─────────────────────────────────────────────────

  private fireDevourer({ cannon }: { cannon: CannonUnit }): boolean {
    // prefer a fresh host: the most urgent enemy not already being devoured
    const hosted = new Set(
      this.swarms.filter((swarm) => swarm.isDead === false).map((swarm) => swarm.host),
    )
    const candidates = this.findMostUrgentEnemiesInRange({
      originX: cannon.x,
      originY: cannon.y,
      count: 8,
    })
    if (candidates.length === 0) {
      return false
    }
    const target = candidates.find((enemy) => hosted.has(enemy) === false) ?? candidates[0]

    const muzzleY = cannon.y - 6
    const angle = this.computeInterceptAngle({
      originX: cannon.x,
      originY: muzzleY,
      target,
      projectileSpeed: DEVOURER.projectileSpeed,
    })
    cannon.barrelImage.setRotation(angle)
    soundEngine.play({ name: 'launch' })
    const level = this.stats.devourerLevel
    const image = this.add
      .image(
        cannon.x + Math.cos(angle) * BARREL_LENGTH,
        muzzleY + Math.sin(angle) * BARREL_LENGTH,
        'nanite-shot',
      )
      .setDepth(DEPTHS.bullets)
    this.naniteShots.push({
      image,
      velocityX: Math.cos(angle) * DEVOURER.projectileSpeed,
      velocityY: Math.sin(angle) * DEVOURER.projectileSpeed,
      budget:
        this.stats.damage * (DEVOURER.baseBudgetMult + DEVOURER.budgetMultPerLevel * (level - 1)),
      isDead: false,
    })
    return true
  }

  private devourerLeapRadius(): number {
    const base =
      DEVOURER.leapRadiusPx + DEVOURER.leapRadiusPerLevel * (this.stats.devourerLevel - 1)
    if (this.stats.mitosisLevel <= 0) {
      return base
    }
    return base * (1 + SYNERGIES.mitosis.leapRadiusBonusPerLevel * (this.stats.mitosisLevel - 1))
  }

  private attachSwarm({ host, budget }: { host: EnemyUnit; budget: number }): void {
    this.swarms.push({
      host,
      remainingBudget: budget,
      x: host.image.x,
      y: host.image.y,
      puffAccumulatorMs: 0,
      isDead: false,
    })
  }

  private updateDevourerSwarms({ delta }: { delta: number }): void {
    const seconds = delta / 1_000

    // payloads in flight: straight line until they touch any living invader
    for (const shot of this.naniteShots) {
      if (shot.isDead === true) {
        continue
      }
      shot.image.x += shot.velocityX * seconds
      shot.image.y += shot.velocityY * seconds
      const isOutOfBounds =
        shot.image.x < -BULLET_CULL_MARGIN ||
        shot.image.x > this.arenaWidth + BULLET_CULL_MARGIN ||
        shot.image.y < -BULLET_CULL_MARGIN ||
        shot.image.y > this.groundY
      if (isOutOfBounds === true) {
        shot.isDead = true
        shot.image.destroy()
        continue
      }
      for (const enemy of this.enemies) {
        if (enemy.isDead === true) {
          continue
        }
        const hitRange = enemy.radius + 6
        const distanceSq = (enemy.image.x - shot.image.x) ** 2 + (enemy.image.y - shot.image.y) ** 2
        if (distanceSq <= hitRange ** 2) {
          shot.isDead = true
          shot.image.destroy()
          this.attachSwarm({ host: enemy, budget: shot.budget })
          break
        }
      }
    }
    this.naniteShots = this.naniteShots.filter((shot) => shot.isDead === false)

    if (this.swarms.length === 0) {
      return
    }
    const drainPerSecond =
      this.stats.damage *
      (DEVOURER.baseDrainMult + DEVOURER.drainMultPerLevel * (this.stats.devourerLevel - 1))
    const spawnedSwarms: Array<SwarmUnit> = []

    for (const swarm of this.swarms) {
      if (swarm.isDead === true) {
        continue
      }

      if (swarm.host.isDead === false) {
        swarm.x = swarm.host.image.x
        swarm.y = swarm.host.image.y
        const tick = drainPerSecond * seconds
        const hostHpBefore = swarm.host.hp
        this.damageEnemy({ enemy: swarm.host, amount: tick, source: 'devourer' })
        // the budget is spent on hp actually consumed — overkill carries over
        swarm.remainingBudget -= Math.min(tick, Math.max(0, hostHpBefore))
        if (swarm.remainingBudget <= 0) {
          swarm.isDead = true
          continue
        }
        swarm.puffAccumulatorMs += delta
        if (swarm.puffAccumulatorMs >= 160) {
          swarm.puffAccumulatorMs = 0
          this.spawnExhaustPuff({
            x: swarm.x + (Math.random() * 2 - 1) * swarm.host.radius,
            y: swarm.y + (Math.random() * 2 - 1) * swarm.host.radius,
            color: 0x4ade80,
          })
        }
      }

      // host died (by us or anything else): the leftovers leap onward
      if (swarm.host.isDead === true) {
        swarm.isDead = true
        // salvage protocol synergy: the consumed host bursts into flak fragments
        if (this.stats.salvageLevel > 0) {
          this.spawnFragmentRing({
            x: swarm.x,
            y: swarm.y,
            count:
              SYNERGIES.salvage.fragmentsBase +
              SYNERGIES.salvage.fragmentsPerLevel * (this.stats.salvageLevel - 1),
            damage:
              this.stats.damage *
              (SYNERGIES.salvage.damageMultBase +
                SYNERGIES.salvage.damageMultPerLevel * (this.stats.salvageLevel - 1)),
            source: 'flak',
            travelPx: FLAK.fragmentTravelPx,
          })
        }
        if (swarm.remainingBudget <= 0) {
          continue
        }
        const liveSwarmCount =
          this.swarms.filter((candidate) => candidate.isDead === false).length +
          spawnedSwarms.length
        const splitCount =
          this.stats.mitosisLevel > 0 && liveSwarmCount < DEVOURER.maxActiveSwarms
            ? SYNERGIES.mitosis.splitCount
            : 1
        const nextHosts = this.findLeapTargets({
          x: swarm.x,
          y: swarm.y,
          count: splitCount,
          exclude: spawnedSwarms.map((candidate) => candidate.host),
        })
        for (const nextHost of nextHosts) {
          this.drawSwarmLeap({
            fromX: swarm.x,
            fromY: swarm.y,
            toX: nextHost.image.x,
            toY: nextHost.image.y,
          })
          // mitosis: every child carries the FULL remaining budget
          spawnedSwarms.push({
            host: nextHost,
            remainingBudget: swarm.remainingBudget,
            x: nextHost.image.x,
            y: nextHost.image.y,
            puffAccumulatorMs: 0,
            isDead: false,
          })
        }
      }
    }

    this.swarms = [...this.swarms.filter((swarm) => swarm.isDead === false), ...spawnedSwarms]
  }

  /** nearest living invaders within leap range, preferring distinct fresh hosts */
  private findLeapTargets({
    x,
    y,
    count,
    exclude,
  }: {
    x: number
    y: number
    count: number
    exclude: Array<EnemyUnit>
  }): Array<EnemyUnit> {
    const leapRadiusSq = this.devourerLeapRadius() ** 2
    const inRange = this.enemies
      .filter((enemy) => {
        if (enemy.isDead === true || exclude.includes(enemy) === true) {
          return false
        }
        return (enemy.image.x - x) ** 2 + (enemy.image.y - y) ** 2 <= leapRadiusSq
      })
      .sort(
        (a, b) =>
          (a.image.x - x) ** 2 +
          (a.image.y - y) ** 2 -
          ((b.image.x - x) ** 2 + (b.image.y - y) ** 2),
      )
    return inRange.slice(0, count)
  }

  /** a green streak as the swarm leaps between hosts */
  private drawSwarmLeap({
    fromX,
    fromY,
    toX,
    toY,
  }: {
    fromX: number
    fromY: number
    toX: number
    toY: number
  }): void {
    const dot = this.add.circle(fromX, fromY, 4, 0x4ade80, 0.95).setDepth(DEPTHS.effects)
    this.tweens.add({
      targets: dot,
      x: toX,
      y: toY,
      duration: 140,
      ease: 'Cubic.easeIn',
      onComplete: () => {
        dot.destroy()
      },
    })
    const trail = this.add.graphics().setDepth(DEPTHS.effects)
    trail.lineStyle(2, 0x86efac, 0.6)
    trail.lineBetween(fromX, fromY, toX, toY)
    this.tweens.add({
      targets: trail,
      alpha: 0,
      duration: 240,
      onComplete: () => {
        trail.destroy()
      },
    })
  }

  // ── flamethrower ───────────────────────────────────────────────────

  /** a short-range cone burst: instant damage plus a gout of flame particles */
  private fireFlamethrower({ cannon }: { cannon: CannonUnit }): boolean {
    const level = this.stats.flameLevel
    const reach = FLAME.rangePx + FLAME.rangePerLevel * (level - 1)
    const muzzleY = cannon.y - 6

    // aim at the most urgent enemy inside the flamethrower's own short reach
    let target: EnemyUnit | null = null
    for (const enemy of this.enemies) {
      if (enemy.isDead === true) {
        continue
      }
      const distanceSq = (enemy.image.x - cannon.x) ** 2 + (enemy.image.y - muzzleY) ** 2
      if (distanceSq > reach ** 2) {
        continue
      }
      if (target === null || enemy.image.y > target.image.y) {
        target = enemy
      }
    }
    if (target === null) {
      return false
    }

    const aimAngle = Math.atan2(target.image.y - muzzleY, target.image.x - cannon.x)
    cannon.barrelImage.setRotation(aimAngle)
    soundEngine.play({ name: 'flame' })

    const damage =
      this.stats.damage * (FLAME.baseDamageMult + FLAME.damageMultPerLevel * (level - 1))
    const burnDps =
      this.stats.damage * (FLAME.burnDpsMultBase + FLAME.burnDpsMultPerLevel * (level - 1))
    for (const enemy of this.enemies) {
      if (enemy.isDead === true) {
        continue
      }
      const deltaX = enemy.image.x - cannon.x
      const deltaY = enemy.image.y - muzzleY
      if (deltaX ** 2 + deltaY ** 2 > (reach + enemy.radius) ** 2) {
        continue
      }
      const offAxis = Math.abs(Phaser.Math.Angle.Wrap(Math.atan2(deltaY, deltaX) - aimAngle))
      if (offAxis <= FLAME.coneHalfAngleRad) {
        this.damageEnemy({ enemy, amount: damage, source: 'flame' })
        this.igniteEnemy({ enemy, dps: burnDps })
      }
    }

    // the gout: flame puffs racing out along the cone
    const puffCount = 9 + 2 * (level - 1)
    const flameColors = [0xfde047, 0xfb923c, 0xef4444]
    for (let index = 0; index < puffCount; index += 1) {
      const puffAngle = aimAngle + (Math.random() * 2 - 1) * FLAME.coneHalfAngleRad
      const distance = reach * (0.25 + Math.random() * 0.75)
      const puff = this.add
        .circle(
          cannon.x + Math.cos(aimAngle) * BARREL_LENGTH,
          muzzleY + Math.sin(aimAngle) * BARREL_LENGTH,
          3 + Math.random() * 3,
          flameColors[Math.floor(Math.random() * flameColors.length)],
          0.85,
        )
        .setDepth(DEPTHS.effects)
      this.tweens.add({
        targets: puff,
        x: cannon.x + Math.cos(puffAngle) * distance,
        y: muzzleY + Math.sin(puffAngle) * distance,
        radius: 8 + Math.random() * 7,
        alpha: 0,
        duration: 280 + Math.random() * 160,
        ease: 'Cubic.easeOut',
        onComplete: () => {
          puff.destroy()
        },
      })
    }
    return true
  }

  // ── burning ────────────────────────────────────────────────────────

  /** apply or refresh a burn — the strongest dps wins, the clock always resets */
  private igniteEnemy({ enemy, dps }: { enemy: EnemyUnit; dps: number }): void {
    if (enemy.isDead === true || dps <= 0) {
      return
    }
    // thermal shock synergy: igniting a frozen invader detonates both statuses
    if (enemy.frozenRemainingMs > 0 && this.tryThermalShock({ enemy }) === true) {
      return
    }
    if (enemy.burning === null) {
      enemy.burning = { dps, remainingMs: FLAME.burnDurationMs, tickAccumulatorMs: 0 }
    } else {
      enemy.burning.dps = Math.max(enemy.burning.dps, dps)
      enemy.burning.remainingMs = FLAME.burnDurationMs
    }
  }

  private updateBurning({ delta }: { delta: number }): void {
    for (const enemy of this.enemies) {
      if (enemy.isDead === true || enemy.burning === null) {
        continue
      }
      const burning = enemy.burning
      burning.remainingMs -= delta
      burning.tickAccumulatorMs += delta
      while (burning.tickAccumulatorMs >= FLAME.burnTickMs && enemy.isDead === false) {
        burning.tickAccumulatorMs -= FLAME.burnTickMs
        this.spawnEmber({ enemy })
        this.damageEnemy({
          enemy,
          amount: burning.dps * (FLAME.burnTickMs / 1_000),
          source: 'burn',
          canCrit: false,
        })
      }
      if (enemy.isDead === false && burning.remainingMs <= 0) {
        enemy.burning = null
      }
    }
  }

  /** a fleck of fire drifting up off a burning invader */
  private spawnEmber({ enemy }: { enemy: EnemyUnit }): void {
    const ember = this.add
      .circle(
        enemy.image.x + (Math.random() * 2 - 1) * enemy.radius * 0.7,
        enemy.image.y + (Math.random() * 2 - 1) * enemy.radius * 0.5,
        2 + Math.random() * 2,
        Math.random() < 0.5 ? 0xfb923c : 0xfde047,
        0.9,
      )
      .setDepth(DEPTHS.effects)
    this.tweens.add({
      targets: ember,
      y: ember.y - 14 - Math.random() * 12,
      alpha: 0,
      duration: 380,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        ember.destroy()
      },
    })
  }

  /** wildfire synergy: a burning casualty's fire leaps to everything nearby */
  private spreadWildfire({ from }: { from: EnemyUnit }): void {
    const burning = from.burning
    if (burning === null) {
      return
    }
    const radius =
      SYNERGIES.wildfire.spreadRadiusBase +
      SYNERGIES.wildfire.spreadRadiusPerLevel * (this.stats.wildfireLevel - 1)
    const ring = this.add
      .circle(from.image.x, from.image.y, 10)
      .setStrokeStyle(2, 0xfb923c, 0.8)
      .setDepth(DEPTHS.effects)
    this.tweens.add({
      targets: ring,
      radius,
      alpha: 0,
      duration: 320,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        ring.destroy()
      },
    })
    for (const enemy of this.enemies) {
      if (enemy.isDead === true || enemy === from) {
        continue
      }
      const distanceSq = (enemy.image.x - from.image.x) ** 2 + (enemy.image.y - from.image.y) ** 2
      if (distanceSq <= (radius + enemy.radius) ** 2) {
        this.igniteEnemy({ enemy, dps: burning.dps })
      }
    }
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
    soundEngine.play({ name: 'flak' })
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
        isCrit: false,
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
    soundEngine.play({ name: 'nova' })
    const novaStacks = Math.max(1, this.upgradeStacks.get('nova') ?? 1)
    const originX = cannon.x
    const ring = this.add
      .circle(originX, this.cannonY, BATTERY.shieldRadius)
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
    const knockbackPx =
      this.stats.concussiveLevel > 0
        ? SYNERGIES.concussive.knockbackPxBase +
          SYNERGIES.concussive.knockbackPxPerLevel * (this.stats.concussiveLevel - 1)
        : 0
    for (const enemy of this.enemies) {
      if (enemy.isDead === true) {
        continue
      }
      const distanceSq = (enemy.image.x - originX) ** 2 + (enemy.image.y - this.cannonY) ** 2
      if (distanceSq <= (NOVA.maxRadius + enemy.radius) ** 2) {
        if (stasisFreezeMs > 0) {
          this.applyFreeze({ enemy, durationMs: stasisFreezeMs })
        }
        // concussive pulse synergy: the wavefront shoves everything outward
        if (knockbackPx > 0) {
          this.applyKnockback({
            enemy,
            angleRad: Math.atan2(enemy.image.y - this.cannonY, enemy.image.x - originX),
            distancePx: knockbackPx,
          })
        }
        this.damageEnemy({
          enemy,
          // novaDamage is a flat base — global damage bonuses scale it like every other weapon
          amount:
            this.stats.novaDamage * damageMultiplier * (this.stats.damage / BASE_RUN_STATS.damage),
          source: 'nova',
        })
      }
    }
    return true
  }

  private applyFreeze({ enemy, durationMs }: { enemy: EnemyUnit; durationMs: number }): void {
    // thermal shock synergy: freezing a burning invader detonates both statuses
    if (enemy.burning !== null && this.tryThermalShock({ enemy }) === true) {
      return
    }
    enemy.frozenRemainingMs = Math.max(enemy.frozenRemainingMs, durationMs)
    if (enemy.image.tintMode === Phaser.TintModes.MULTIPLY) {
      enemy.image.setTint(0xbae6fd)
    }
  }

  /** lightning's status: a dead stop, shorter and cheaper than a freeze */
  private applyStun({ enemy, durationMs }: { enemy: EnemyUnit; durationMs: number }): void {
    if (enemy.isDead === true) {
      return
    }
    enemy.stunnedRemainingMs = Math.max(enemy.stunnedRemainingMs, durationMs)
    // a little jolt star over the head sells the stun
    const jolt = this.add
      .circle(enemy.image.x, enemy.image.y - enemy.radius - 8, 3, 0xfde047, 0.95)
      .setDepth(DEPTHS.effects)
    this.tweens.add({
      targets: jolt,
      y: jolt.y - 8,
      radius: 5,
      alpha: 0,
      duration: 260,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        jolt.destroy()
      },
    })
  }

  /** cryo shells' status: a timed slow that stacks with cloud cover */
  private applyChill({ enemy, durationMs }: { enemy: EnemyUnit; durationMs: number }): void {
    if (enemy.isDead === true) {
      return
    }
    enemy.chilledRemainingMs = Math.max(enemy.chilledRemainingMs, durationMs)
    this.spawnExhaustPuff({ x: enemy.image.x, y: enemy.image.y, color: 0x67e8f9 })
  }

  /** a decaying shove — push direction and strength chosen by the caller */
  private applyKnockback({
    enemy,
    angleRad,
    distancePx,
  }: {
    enemy: EnemyUnit
    angleRad: number
    distancePx: number
  }): void {
    // the mothership is far too heavy to shove
    if (enemy.isDead === true || enemy.definition.kind === 'mothership') {
      return
    }
    const speed = distancePx / (KNOCKBACK_DURATION_MS / 1_000)
    enemy.knockback = {
      velocityX: Math.cos(angleRad) * speed,
      velocityY: Math.sin(angleRad) * speed,
      remainingMs: KNOCKBACK_DURATION_MS,
    }
  }

  /**
   * thermal shock synergy: opposing statuses annihilate — both are consumed
   * and the target takes a burst. Returns false when the synergy isn't owned.
   */
  private tryThermalShock({ enemy }: { enemy: EnemyUnit }): boolean {
    if (this.stats.thermalShockLevel <= 0) {
      return false
    }
    enemy.burning = null
    enemy.frozenRemainingMs = 0
    if (enemy.image.tintMode === Phaser.TintModes.MULTIPLY) {
      enemy.image.clearTint()
    }
    const flash = this.add
      .circle(enemy.image.x, enemy.image.y, enemy.radius + 4)
      .setStrokeStyle(3, 0xfef3c7, 0.95)
      .setDepth(DEPTHS.effects)
    this.tweens.add({
      targets: flash,
      radius: enemy.radius + 26,
      alpha: 0,
      duration: 280,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        flash.destroy()
      },
    })
    const burst =
      this.stats.damage *
      (SYNERGIES.thermalshock.burstDamageMultBase +
        SYNERGIES.thermalshock.burstDamageMultPerLevel * (this.stats.thermalShockLevel - 1))
    this.damageEnemy({ enemy, amount: burst, source: 'shock' })
    return true
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
      if (rocket.isDead === false && rocket.image.y >= this.groundY - 6) {
        this.explodeRocket({ rocket })
      }
      const isOutOfBounds =
        rocket.image.x < -BULLET_CULL_MARGIN ||
        rocket.image.x > this.arenaWidth + BULLET_CULL_MARGIN ||
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
      if (candidate.isDead === true || this.isEnemyOnField({ enemy: candidate }) === false) {
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
    // only aim at clusters inside the cannon's targeting range
    const rangeSq = this.stats.range ** 2
    const inRange = this.enemies.filter((enemy) => {
      if (enemy.isDead === true) {
        return false
      }
      return (enemy.image.x - cannon.x) ** 2 + (enemy.image.y - (cannon.y - 6)) ** 2 <= rangeSq
    })
    const target = inRange.length > 0 ? this.findClusterTarget({ pool: inRange }) : null
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
    soundEngine.play({ name: 'explosion' })
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
    this.shakeCamera({ durationMs: 90, intensity: 0.003 })

    // napalm warheads synergy: the blast zone is soaked in burning fuel
    const napalmDps =
      this.stats.napalmLevel > 0
        ? this.stats.damage *
          (SYNERGIES.napalm.burnDpsMultBase +
            SYNERGIES.napalm.burnDpsMultPerLevel * (this.stats.napalmLevel - 1))
        : 0
    for (const enemy of this.enemies) {
      if (enemy.isDead === true) {
        continue
      }
      const distanceSq = (enemy.image.x - blastX) ** 2 + (enemy.image.y - blastY) ** 2
      if (distanceSq <= (rocket.blastRadius + enemy.radius) ** 2) {
        this.damageEnemy({ enemy, amount: rocket.damage, source: 'rocket' })
        this.igniteEnemy({ enemy, dps: napalmDps })
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
          y: Math.min(
            this.groundY - 80,
            blastY + (Math.random() * 2 - 1) * rocket.blastRadius * 0.6,
          ),
        })
      }
    }
  }

  // ── tesla arc ──────────────────────────────────────────────────────

  private fireTeslaArc({ cannon }: { cannon: CannonUnit }): boolean {
    const anchors = this.findMostUrgentEnemiesInRange({
      originX: cannon.x,
      originY: cannon.y,
      count: 1,
    })
    if (anchors.length === 0) {
      return false
    }

    let maxStruck = CHAIN.baseChains + CHAIN.chainsPerLevel * (this.stats.chainLevel - 1)
    // static discharge synergy: afflictions on the anchor conduct extra links
    if (this.stats.dischargeLevel > 0) {
      const anchor = anchors[0]
      const statusCount =
        (anchor.burning !== null ? 1 : 0) +
        (anchor.frozenRemainingMs > 0 ? 1 : 0) +
        (anchor.chilledRemainingMs > 0 ? 1 : 0)
      maxStruck +=
        statusCount * SYNERGIES.discharge.linksPerStatusPerLevel * this.stats.dischargeLevel
    }
    const struck: Array<EnemyUnit> = [anchors[0]]
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
    const stunMs = CHAIN.stunMsBase + CHAIN.stunMsPerLevel * (this.stats.chainLevel - 1)
    for (const enemy of struck) {
      this.damageEnemy({ enemy, amount: chainDamage, source: 'chain' })
      this.applyStun({ enemy, durationMs: stunMs })
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
    soundEngine.play({ name: 'zap' })
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
    if (this.stats.flameLevel > 0) {
      weaponIds.push('flame')
    }
    if (this.stats.devourerLevel > 0) {
      weaponIds.push('devourer')
    }
    if (this.stats.mineLevel > 0) {
      weaponIds.push('mines')
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
    if (this.stats.lanceLevel > 0) {
      weaponIds.push('lance')
    }
    return weaponIds.sort((a, b) => a.localeCompare(b))
  }

  private weaponIntervalMs({ weaponId }: { weaponId: string }): number {
    const base = this.baseWeaponIntervalMs({ weaponId })
    // the aegis shield is defensive, not a weapon system — autoloaders skip it
    if (weaponId === 'aegis') {
      return base
    }
    return base * this.stats.weaponCooldownFactor
  }

  private baseWeaponIntervalMs({ weaponId }: { weaponId: string }): number {
    if (weaponId === 'flak') {
      return Math.max(
        FLAK.minIntervalMs,
        FLAK.baseIntervalMs - FLAK.intervalStepMs * (this.stats.flakLevel - 1),
      )
    }
    if (weaponId === 'flame') {
      return Math.max(
        FLAME.minIntervalMs,
        FLAME.baseIntervalMs - FLAME.intervalStepMs * (this.stats.flameLevel - 1),
      )
    }
    if (weaponId === 'devourer') {
      return Math.max(
        DEVOURER.minIntervalMs,
        DEVOURER.baseIntervalMs - DEVOURER.intervalStepMs * (this.stats.devourerLevel - 1),
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
    if (weaponId === 'flame') {
      return this.fireFlamethrower({ cannon })
    }
    if (weaponId === 'devourer') {
      return this.fireDevourer({ cannon })
    }
    if (weaponId === 'mines') {
      return this.fireMineSalvo({ cannon })
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
    if (weaponId === 'lance') {
      return this.fireLance({ cannon })
    }
    return false
  }

  // ── lock down ──────────────────────────────────────────────────────

  /** launches a stasis missile at the most urgent unfrozen invader */
  private fireLockdown({ cannon }: { cannon: CannonUnit }): boolean {
    const targets = this.findMostUrgentEnemiesInRange({
      originX: cannon.x,
      originY: cannon.y,
      count: 6,
    }).filter((enemy) => enemy.frozenRemainingMs <= 0)
    if (targets.length === 0) {
      return false
    }

    const target = targets[0]
    const muzzleY = cannon.y - 6
    const angle = this.computeInterceptAngle({
      originX: cannon.x,
      originY: muzzleY,
      target,
      projectileSpeed: LOCKDOWN.missileSpeedPxPerSec,
    })
    cannon.barrelImage.setRotation(angle)
    soundEngine.play({ name: 'launch' })
    const image = this.add
      .image(
        cannon.x + Math.cos(angle) * BARREL_LENGTH,
        muzzleY + Math.sin(angle) * BARREL_LENGTH,
        'stasis-missile',
      )
      .setRotation(angle)
      .setDepth(DEPTHS.bullets)
    this.stasisMissiles.push({
      image,
      velocityX: Math.cos(angle) * LOCKDOWN.missileSpeedPxPerSec,
      velocityY: Math.sin(angle) * LOCKDOWN.missileSpeedPxPerSec,
      trailAccumulatorMs: 0,
      isDead: false,
    })
    return true
  }

  private moveStasisMissiles({ delta }: { delta: number }): void {
    const seconds = delta / 1_000
    for (const missile of this.stasisMissiles) {
      if (missile.isDead === true) {
        continue
      }
      missile.image.x += missile.velocityX * seconds
      missile.image.y += missile.velocityY * seconds
      missile.trailAccumulatorMs += delta
      if (missile.trailAccumulatorMs >= 60) {
        missile.trailAccumulatorMs = 0
        this.spawnExhaustPuff({ x: missile.image.x, y: missile.image.y, color: 0x7dd3fc })
      }

      for (const enemy of this.enemies) {
        if (enemy.isDead === true) {
          continue
        }
        const hitRange = enemy.radius + 8
        const distanceSq =
          (enemy.image.x - missile.image.x) ** 2 + (enemy.image.y - missile.image.y) ** 2
        if (distanceSq <= hitRange ** 2) {
          this.detonateStasisPulse({ missile })
          break
        }
      }
      if (missile.isDead === false && missile.image.y >= this.groundY - 6) {
        this.detonateStasisPulse({ missile })
      }
      const isOutOfBounds =
        missile.image.x < -BULLET_CULL_MARGIN ||
        missile.image.x > this.arenaWidth + BULLET_CULL_MARGIN ||
        missile.image.y < -BULLET_CULL_MARGIN
      if (missile.isDead === false && isOutOfBounds === true) {
        missile.isDead = true
        missile.image.destroy()
      }
    }
    this.stasisMissiles = this.stasisMissiles.filter((missile) => missile.isDead === false)
  }

  /** the visible pulse: an expanding ring that flash-freezes everything it washes over */
  private detonateStasisPulse({ missile }: { missile: StasisMissileUnit }): void {
    missile.isDead = true
    const pulseX = missile.image.x
    const pulseY = missile.image.y
    missile.image.destroy()
    soundEngine.play({ name: 'freeze' })

    const level = this.stats.lockdownLevel
    const pulseRadius = LOCKDOWN.pulseRadius + LOCKDOWN.pulseRadiusPerLevel * (level - 1)
    const freezeMs = LOCKDOWN.baseFreezeMs + LOCKDOWN.freezeMsPerLevel * (level - 1)

    const flash = this.add.circle(pulseX, pulseY, 10, 0xbae6fd, 0.6).setDepth(DEPTHS.effects)
    const ring = this.add
      .circle(pulseX, pulseY, 10)
      .setStrokeStyle(3 + 0.8 * (level - 1), 0x7dd3fc, 0.95)
      .setDepth(DEPTHS.effects)
    this.tweens.add({
      targets: flash,
      radius: pulseRadius * 0.7,
      alpha: 0,
      duration: 320,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        flash.destroy()
      },
    })
    this.tweens.add({
      targets: ring,
      radius: pulseRadius,
      alpha: 0,
      duration: 420,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        ring.destroy()
      },
    })

    for (const enemy of this.enemies) {
      if (enemy.isDead === true) {
        continue
      }
      const distanceSq = (enemy.image.x - pulseX) ** 2 + (enemy.image.y - pulseY) ** 2
      if (distanceSq <= (pulseRadius + enemy.radius) ** 2) {
        this.applyFreeze({ enemy, durationMs: freezeMs })
      }
    }
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
    soundEngine.play({ name: 'railgun' })
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
      // hard altitude floor/ceiling: a diving sortie levels off instead of
      // flying into the ground (or off the top of the sky)
      const minAltitudeY = 90
      const maxAltitudeY = this.groundY - 150
      if (plane.image.y < minAltitudeY || plane.image.y > maxAltitudeY) {
        plane.image.y = Phaser.Math.Clamp(plane.image.y, minAltitudeY, maxAltitudeY)
        plane.velocityY = 0
        plane.image.setRotation(Math.atan2(0, plane.velocityX))
        plane.image.setFlipY(plane.velocityX < 0)
      }
      plane.trailAccumulatorMs += delta
      if (plane.trailAccumulatorMs >= 70) {
        plane.trailAccumulatorMs = 0
        this.spawnExhaustPuff({
          x: plane.image.x - Math.sign(plane.velocityX) * 22,
          y: plane.image.y,
          color: 0xcbd5e1,
        })
      }
      const isOverField = plane.image.x > 40 && plane.image.x < this.arenaWidth - 40
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
      const isOffscreen = plane.image.x < -80 || plane.image.x > this.arenaWidth + 80
      if (isOffscreen === true) {
        if (plane.passesRemaining > 1) {
          // bank around and strafe back the other way on a fresh diagonal
          plane.passesRemaining -= 1
          plane.velocityX = -plane.velocityX
          plane.velocityY = plane.velocityX * (Math.random() * 0.36 - 0.18)
          plane.image.y = Phaser.Math.Clamp(
            plane.image.y + (Math.random() * 2 - 1) * 80,
            110,
            this.groundY - 220,
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
      if (bomb.fuseRemainingMs <= 0 || bomb.image.y >= this.groundY - 4) {
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
    const startX = isLeftToRight === true ? -60 : this.arenaWidth + 60
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

  /** an extra active cloud — used by cloud seeding and smokescreen mines */
  private spawnSeededCloud({ x, y }: { x: number; y: number }): void {
    const cloudCap =
      CLOUD.maxClouds +
      SYNERGIES.seeding.extraCloudCap +
      SYNERGIES.smokescreen.extraCloudCapPerLevel * this.stats.smokescreenLevel
    if (this.cloudImages.length >= cloudCap) {
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
    soundEngine.play({ name: 'explosion' })
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

  /** battlefield-wide discharge, like the orbital cannon — one charge no matter how many guns */
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
    soundEngine.play({ name: 'bfg' })

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
        this.arenaWidth / 2,
        this.groundY / 2,
        this.arenaWidth,
        this.groundY,
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
    this.shakeCamera({ durationMs: 300, intensity: 0.008 })

    const bfgDamage =
      this.stats.damage * (BFG.baseDamageMult + BFG.damageMultPerLevel * (this.stats.bfgLevel - 1))
    for (const enemy of this.enemies) {
      if (enemy.isDead === true) {
        continue
      }
      this.damageEnemy({ enemy, amount: bfgDamage, source: 'bfg' })
    }

    // emp discharge synergy: the blast doubles as an EMP, flash-freezing the field
    if (this.stats.empLevel > 0) {
      const freezeMs =
        SYNERGIES.emp.freezeMsBase + SYNERGIES.emp.freezeMsPerLevel * (this.stats.empLevel - 1)
      for (const enemy of this.enemies) {
        if (enemy.isDead === false) {
          this.applyFreeze({ enemy, durationMs: freezeMs })
        }
      }
    }

    // arc capacitor synergy: residual charge arcs stunning lightning into survivors
    if (this.stats.arcCapLevel > 0) {
      const survivors = this.enemies.filter((enemy) => enemy.isDead === false)
      const boltCount = Math.min(
        survivors.length,
        SYNERGIES.arccap.boltsBase + SYNERGIES.arccap.boltsPerLevel * (this.stats.arcCapLevel - 1),
      )
      const boltDamage =
        this.stats.damage *
        (SYNERGIES.arccap.damageMultBase +
          SYNERGIES.arccap.damageMultPerLevel * (this.stats.arcCapLevel - 1))
      const stunMs =
        CHAIN.stunMsBase + CHAIN.stunMsPerLevel * Math.max(0, this.stats.chainLevel - 1)
      for (let index = 0; index < boltCount; index += 1) {
        const enemy = survivors.splice(Math.floor(Math.random() * survivors.length), 1)[0]
        this.drawLightningBolt({
          points: [
            { x: mainCannon.x, y: mainCannon.y - 20 },
            { x: enemy.image.x, y: enemy.image.y },
          ],
        })
        this.damageEnemy({ enemy, amount: boltDamage, source: 'chain' })
        this.applyStun({ enemy, durationMs: stunMs })
      }
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

  /** each gun ignites its own lance at the densest cluster within its reach */
  private fireLance({ cannon }: { cannon: CannonUnit }): boolean {
    // the lance only reaches as far as the cannon's targeting range
    const rangeSq = this.stats.range ** 2
    const inRange = this.enemies.filter((enemy) => {
      if (enemy.isDead === true) {
        return false
      }
      return (enemy.image.x - cannon.x) ** 2 + (enemy.image.y - (cannon.y - 10)) ** 2 <= rangeSq
    })
    const target = inRange.length > 0 ? this.findClusterTarget({ pool: inRange }) : null
    if (target === null) {
      return false
    }
    this.fireThermalLance({ cannon, target })
    return true
  }

  private updateLanceSweeps({ delta }: { delta: number }): void {
    const seconds = delta / 1_000
    for (const sweep of this.sweeps) {
      if (sweep.isDead === true) {
        continue
      }
      sweep.angleRad +=
        Phaser.Math.DegToRad(LANCE.sweepSpeedDegPerSec) * seconds * sweep.directionSign
      const isFinished =
        sweep.directionSign > 0
          ? sweep.angleRad >= sweep.endAngleRad
          : sweep.angleRad <= sweep.endAngleRad
      if (isFinished === true) {
        sweep.isDead = true
        continue
      }
      // ray test: the beam stops at the first invader it touches — no piercing
      // (overwatch synergy: frozen invaders are glassed straight through instead)
      const directionX = Math.cos(sweep.angleRad)
      const directionY = Math.sin(sweep.angleRad)
      let blocker: EnemyUnit | null = null
      let blockerAlong = Number.POSITIVE_INFINITY
      const piercedFrozen: Array<{ enemy: EnemyUnit; along: number }> = []
      for (const enemy of this.enemies) {
        if (enemy.isDead === true) {
          continue
        }
        const toEnemyX = enemy.image.x - sweep.originX
        const toEnemyY = enemy.image.y - sweep.originY
        const along = toEnemyX * directionX + toEnemyY * directionY
        if (along < BARREL_LENGTH || along > this.stats.range + enemy.radius) {
          continue
        }
        const perpendicular = Math.abs(toEnemyX * directionY - toEnemyY * directionX)
        if (perpendicular > enemy.radius + LANCE.beamHalfWidthPx) {
          continue
        }
        if (this.stats.overwatchLevel > 0 && enemy.frozenRemainingMs > 0) {
          piercedFrozen.push({ enemy, along })
          continue
        }
        if (along < blockerAlong) {
          blocker = enemy
          blockerAlong = along
        }
      }
      sweep.currentLengthPx = blocker === null ? this.stats.range : blockerAlong
      const thermiteDps =
        this.stats.thermiteLevel > 0
          ? this.stats.damage *
            (SYNERGIES.thermite.burnDpsMultBase +
              SYNERGIES.thermite.burnDpsMultPerLevel * (this.stats.thermiteLevel - 1))
          : 0
      if (blocker !== null && sweep.hitEnemies.has(blocker) === false) {
        sweep.hitEnemies.add(blocker)
        this.damageEnemy({ enemy: blocker, amount: sweep.damage, source: 'lance' })
        // thermite beam synergy: everything the lance sears keeps burning
        this.igniteEnemy({ enemy: blocker, dps: thermiteDps })
      }
      const overwatchBonus =
        1 +
        SYNERGIES.overwatch.frozenDamageBonusBase +
        SYNERGIES.overwatch.frozenDamageBonusPerLevel * Math.max(0, this.stats.overwatchLevel - 1)
      for (const pierced of piercedFrozen) {
        // only frozen targets the (possibly shortened) beam still reaches
        if (pierced.along > sweep.currentLengthPx + pierced.enemy.radius) {
          continue
        }
        if (sweep.hitEnemies.has(pierced.enemy) === true) {
          continue
        }
        sweep.hitEnemies.add(pierced.enemy)
        this.damageEnemy({
          enemy: pierced.enemy,
          amount: sweep.damage * overwatchBonus,
          source: 'lance',
        })
        this.igniteEnemy({ enemy: pierced.enemy, dps: thermiteDps })
      }
    }
    this.sweeps = this.sweeps.filter((sweep) => sweep.isDead === false)
  }

  /** ignite the lance at the firing cannon, sweeping its arc across the target cluster */
  private fireThermalLance({ cannon, target }: { cannon: CannonUnit; target: EnemyUnit }): void {
    soundEngine.play({ name: 'lance' })
    const level = this.stats.lanceLevel
    const originX = cannon.x
    const originY = cannon.y - 10

    const spanRad = Phaser.Math.DegToRad(
      LANCE.sweepArcDegBase + LANCE.sweepArcDegPerLevel * (level - 1),
    )
    const centerAngle = Math.atan2(target.image.y - originY, target.image.x - originX)
    const directionSign: 1 | -1 = Math.random() < 0.5 ? 1 : -1
    // keep the whole arc pointed into the sky (angles between just-above-horizon left and right)
    const clampAngle = (angle: number): number => Phaser.Math.Clamp(angle, -Math.PI + 0.12, -0.12)

    // ignition flare at the muzzle
    const flare = this.add.circle(originX, originY, 10, 0xfefce8, 0.95).setDepth(DEPTHS.effects)
    this.tweens.add({
      targets: flare,
      radius: 26 + 5 * level,
      alpha: 0,
      duration: 320,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        flare.destroy()
      },
    })
    this.shakeCamera({ durationMs: 140, intensity: 0.004 })

    const sweepDamage =
      this.stats.damage * (LANCE.baseDamageMult + LANCE.damageMultPerLevel * (level - 1))
    this.sweeps.push({
      originX,
      originY,
      angleRad: clampAngle(centerAngle - (spanRad / 2) * directionSign),
      endAngleRad: clampAngle(centerAngle + (spanRad / 2) * directionSign),
      directionSign,
      damage: sweepDamage,
      hitEnemies: new Set(),
      currentLengthPx: this.stats.range,
      isDead: false,
    })

    // refraction synergy: the cloud bank splits off a second, weaker sweep
    if (this.stats.refractionLevel > 0 && this.cloudImages.length > 0) {
      let nearestCloud = this.cloudImages[0]
      let nearestDistanceSq = Number.POSITIVE_INFINITY
      for (const cloud of this.cloudImages) {
        const distanceSq =
          (cloud.image.x - target.image.x) ** 2 + (cloud.image.y - target.image.y) ** 2
        if (distanceSq < nearestDistanceSq) {
          nearestDistanceSq = distanceSq
          nearestCloud = cloud
        }
      }
      const echoOriginX = nearestCloud.image.x
      const echoOriginY = nearestCloud.image.y
      const echoCenter = Math.atan2(target.image.y - echoOriginY, target.image.x - echoOriginX)
      const echoSpan = spanRad * SYNERGIES.refraction.arcFactor
      const echoFlare = this.add
        .circle(echoOriginX, echoOriginY, 8, 0xfefce8, 0.9)
        .setDepth(DEPTHS.effects)
      this.tweens.add({
        targets: echoFlare,
        radius: 18,
        alpha: 0,
        duration: 300,
        ease: 'Cubic.easeOut',
        onComplete: () => {
          echoFlare.destroy()
        },
      })
      this.sweeps.push({
        originX: echoOriginX,
        originY: echoOriginY,
        // a cloud can fire downward — no sky clamp on the refracted beam
        angleRad: echoCenter - (echoSpan / 2) * directionSign,
        endAngleRad: echoCenter + (echoSpan / 2) * directionSign,
        directionSign,
        damage:
          sweepDamage *
          (SYNERGIES.refraction.damageFactorBase +
            SYNERGIES.refraction.damageFactorPerLevel * (this.stats.refractionLevel - 1)),
        hitEnemies: new Set(),
        currentLengthPx: this.stats.range,
        isDead: false,
      })
    }
  }

  /** redrawn every frame: the lance is a laser firing out of the gun, sweeping the sky */
  private drawSweepBeams(): void {
    this.sweepGraphics.clear()
    const level = Math.max(1, this.stats.lanceLevel)
    for (const sweep of this.sweeps) {
      if (sweep.isDead === true) {
        continue
      }
      // the drawn beam ends where its reach does — the blocking invader, or targeting range
      const endX = sweep.originX + Math.cos(sweep.angleRad) * sweep.currentLengthPx
      const endY = sweep.originY + Math.sin(sweep.angleRad) * sweep.currentLengthPx
      // rail-gun-width beam, but yellow: soft glow plus a bright core
      this.sweepGraphics.lineStyle(7 + 3 * (level - 1), 0xfde047, 0.3)
      this.sweepGraphics.lineBetween(sweep.originX, sweep.originY, endX, endY)
      this.sweepGraphics.lineStyle(2 + 0.8 * (level - 1), 0xfefce8, 1)
      this.sweepGraphics.lineBetween(sweep.originX, sweep.originY, endX, endY)
      // hot muzzle point where the beam leaves the gun
      this.sweepGraphics.fillStyle(0xfefce8, 0.95)
      this.sweepGraphics.fillCircle(sweep.originX, sweep.originY, 5 + level)
      this.sweepGraphics.fillStyle(0xfde047, 0.35)
      this.sweepGraphics.fillCircle(sweep.originX, sweep.originY, 10 + 2 * level)
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

  /** one cannon's mine volley — runs on the per-cannon weapon engine */
  private fireMineSalvo({ cannon }: { cannon: CannonUnit }): boolean {
    if (this.mines.length + this.mineShells.length >= this.maxActiveMines()) {
      return false
    }
    const dropCount = Math.floor(
      MINES.minesPerDrop +
        MINES.minesPerDropPerLevel * (this.stats.mineLevel - 1) +
        SYNERGIES.fabricators.extraMinesPerDropPerLevel * this.stats.fabricatorLevel,
    )
    for (let index = 0; index < dropCount; index += 1) {
      if (this.mines.length + this.mineShells.length >= this.maxActiveMines()) {
        break
      }
      this.launchMineShell({
        cannon,
        x: 120 + Math.random() * (this.arenaWidth - 240),
        y: 230 + Math.random() * (this.groundY - 360),
      })
    }
    return true
  }

  private updateMines({ delta }: { delta: number }): void {
    // shells arc under gravity, then pop a balloon mine at their station point
    const seconds = delta / 1_000
    for (const shell of this.mineShells) {
      if (shell.isDead === true) {
        continue
      }
      shell.remainingMs -= delta
      if (shell.remainingMs <= 0) {
        shell.isDead = true
        shell.image.destroy()
        this.deployMine({ x: shell.targetX, y: shell.targetY })
        continue
      }
      shell.image.x += shell.velocityX * seconds
      shell.image.y += shell.velocityY * seconds
      shell.velocityY += MINE_SHELL_GRAVITY * seconds
      shell.image.rotation += 4 * seconds
    }
    this.mineShells = this.mineShells.filter((shell) => shell.isDead === false)

    for (const mine of this.mines) {
      if (mine.isDead === true) {
        continue
      }
      // the balloon slowly lifts the mine, holding just under the top of the sky
      if (mine.baseY > MINE_CEILING_Y) {
        mine.baseY = Math.max(MINE_CEILING_Y, mine.baseY - MINE_RISE_SPEED_PX_PER_SEC * seconds)
      }
      const bobOffsetY = Math.sin((this.elapsedMs / 1_000) * 1.6 + mine.bobPhase) * 3
      mine.image.y = mine.baseY + bobOffsetY
      mine.balloonImage.y = mine.baseY + bobOffsetY - MINE_BALLOON_OFFSET_Y
      if (mine.armRemainingMs > 0) {
        mine.armRemainingMs -= delta
        continue
      }
      // static mines synergy: a waiting mine zaps and stuns whatever drifts near
      if (this.stats.staticMinesLevel > 0) {
        mine.zapAccumulatorMs += delta
        if (mine.zapAccumulatorMs >= SYNERGIES.staticmines.zapIntervalMs) {
          let zapTarget: EnemyUnit | null = null
          let zapDistanceSq = SYNERGIES.staticmines.zapRadiusPx ** 2
          for (const enemy of this.enemies) {
            if (enemy.isDead === true) {
              continue
            }
            const distanceSq =
              (enemy.image.x - mine.image.x) ** 2 + (enemy.image.y - mine.image.y) ** 2
            if (distanceSq <= zapDistanceSq) {
              zapDistanceSq = distanceSq
              zapTarget = enemy
            }
          }
          if (zapTarget === null) {
            mine.zapAccumulatorMs = SYNERGIES.staticmines.zapIntervalMs
          } else {
            mine.zapAccumulatorMs = 0
            this.drawLightningBolt({
              points: [
                { x: mine.image.x, y: mine.image.y },
                { x: zapTarget.image.x, y: zapTarget.image.y },
              ],
            })
            this.damageEnemy({
              enemy: zapTarget,
              amount:
                this.stats.damage *
                (SYNERGIES.staticmines.damageMultBase +
                  SYNERGIES.staticmines.damageMultPerLevel * (this.stats.staticMinesLevel - 1)),
              source: 'mines',
            })
            this.applyStun({ enemy: zapTarget, durationMs: CHAIN.stunMsBase })
          }
        }
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
          // smokescreen synergy: the detonation leaves a slowing smoke bank
          if (this.stats.smokescreenLevel > 0) {
            this.spawnSeededCloud({ x: mine.image.x, y: mine.image.y })
          }
          this.destroyMine({ mine })
          break
        }
      }
    }
    this.mines = this.mines.filter((mine) => mine.isDead === false)
  }

  private destroyMine({ mine }: { mine: MineUnit }): void {
    this.tweens.killTweensOf(mine.image)
    this.tweens.killTweensOf(mine.balloonImage)
    mine.image.destroy()
    mine.balloonImage.destroy()
  }

  /** ceiling grows with every deployed cannon; auto-fabricators raises it further */
  private maxActiveMines(): number {
    return (
      MINES.maxActivePerCannon * this.cannons.length +
      SYNERGIES.fabricators.extraMaxActivePerLevel * this.stats.fabricatorLevel
    )
  }

  /** lob a mine from the firing cannon on a parabolic arc to its station point */
  private launchMineShell({ cannon, x, y }: { cannon: CannonUnit; x: number; y: number }): void {
    const originX = cannon.x
    const originY = cannon.y - 6
    const flightSeconds = 0.8 + Math.random() * 0.4
    const velocityX = (x - originX) / flightSeconds
    // solve the parabola so the shell lands exactly on target after flightSeconds
    const velocityY = (y - originY) / flightSeconds - 0.5 * MINE_SHELL_GRAVITY * flightSeconds
    cannon.barrelImage.setRotation(Math.atan2(velocityY, velocityX))
    soundEngine.play({ name: 'launch' })
    const image = this.add.image(originX, originY, 'mine').setScale(0.7).setDepth(DEPTHS.bullets)
    this.mineShells.push({
      image,
      velocityX,
      velocityY,
      targetX: x,
      targetY: y,
      remainingMs: flightSeconds * 1_000,
      isDead: false,
    })
  }

  private deployMine({ x: atX, y: atY }: { x?: number; y?: number } = {}): void {
    const x = atX ?? 120 + Math.random() * (this.arenaWidth - 240)
    const y = atY ?? 230 + Math.random() * (this.groundY - 360)
    const balloonImage = this.add
      .image(x, y - MINE_BALLOON_OFFSET_Y, 'balloon')
      .setScale(0)
      .setDepth(DEPTHS.units)
    const image = this.add.image(x, y, 'mine').setScale(0).setDepth(DEPTHS.units)
    this.tweens.add({
      targets: [balloonImage, image],
      scale: 1,
      duration: 250,
      ease: 'Back.easeOut',
    })
    // blinking arming light (bobbing and rising are simulated in updateMines)
    this.tweens.add({
      targets: image,
      alpha: 0.55,
      delay: 500,
      duration: 420,
      yoyo: true,
      repeat: -1,
    })
    this.mines.push({
      image,
      balloonImage,
      baseY: y,
      bobPhase: Math.random() * Math.PI * 2,
      armRemainingMs: MINES.armDelayMs,
      zapAccumulatorMs: 0,
      isDead: false,
    })
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
        // target uplink synergy: drone spotters paint elites first and speed the lock
        if (this.stats.uplinkLevel > 0) {
          if (target === null) {
            const elitePool = this.enemies.filter(
              (enemy) =>
                enemy.isDead === false &&
                (enemy.affix !== null || enemy.definition.kind === 'mothership'),
            )
            if (elitePool.length > 0) {
              target = this.findClusterTarget({ pool: elitePool })
            }
          }
          lockOnMs *=
            SYNERGIES.uplink.lockOnFactorBase -
            SYNERGIES.uplink.lockOnFactorPerLevel * (this.stats.uplinkLevel - 1)
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
    this.shakeCamera({ durationMs: 180, intensity: 0.006 })
    this.spawnBlast({
      x: strike.x,
      y: strike.y,
      blastRadius: radius,
      damage,
      source: 'orbital-laser',
    })

    // glassed sky synergy: the strike leaves its blast zone burning
    if (this.stats.glassedLevel > 0) {
      const burnDps =
        this.stats.damage *
        (SYNERGIES.glassed.burnDpsMultBase +
          SYNERGIES.glassed.burnDpsMultPerLevel * (this.stats.glassedLevel - 1))
      for (const enemy of this.enemies) {
        if (enemy.isDead === true) {
          continue
        }
        const distanceSq = (enemy.image.x - strike.x) ** 2 + (enemy.image.y - strike.y) ** 2
        if (distanceSq <= (radius + enemy.radius) ** 2) {
          this.igniteEnemy({ enemy, dps: burnDps })
        }
      }
    }
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

  /**
   * the mothership's hover altitude — at most 80% of the guns' reach above
   * them, so tall portrait arenas pull the boss down into targeting range
   */
  private bossHoverY(): number {
    return Math.max(BOSS.hoverY, this.cannonY - this.stats.range * 0.8)
  }

  private updateBossSpawners({ delta }: { delta: number }): void {
    for (const enemy of this.enemies) {
      if (enemy.isDead === true) {
        continue
      }

      if (enemy.definition.kind === 'mothership') {
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
        // the boss never crashes into the city — it bombards from its hover
        if (enemy.image.y >= this.bossHoverY()) {
          enemy.attackAccumulatorMs += delta
          if (enemy.attackAccumulatorMs >= BOSS.boltIntervalMs) {
            enemy.attackAccumulatorMs = 0
            this.dropBossBolt({ x: enemy.image.x, y: enemy.image.y + enemy.radius })
          }
        }
        continue
      }

      // menders pulse healing into nearby invaders
      if (enemy.definition.kind === 'mender') {
        enemy.attackAccumulatorMs += delta
        if (enemy.attackAccumulatorMs >= ENEMY_AURAS.menderIntervalMs) {
          enemy.attackAccumulatorMs = 0
          this.pulseMenderHeal({ mender: enemy })
        }
        continue
      }

      // regenerating elites knit themselves back together
      if (enemy.affix === 'regen' && enemy.hp < enemy.maxHp) {
        enemy.hp = Math.min(
          enemy.maxHp,
          enemy.hp + enemy.maxHp * ENEMY_AURAS.eliteRegenFractionPerSec * (delta / 1_000),
        )
      }
    }

    const seconds = delta / 1_000
    for (const bolt of this.bossBolts) {
      if (bolt.isDead === true) {
        continue
      }
      bolt.image.y += bolt.velocityY * seconds
      if (bolt.image.y >= this.groundY - 4) {
        bolt.isDead = true
        bolt.image.destroy()
        if (this.tryAegisBlock({ x: bolt.image.x }) === false) {
          this.spawnImpactFlash({ x: bolt.image.x, y: this.groundY, radius: 30 })
          soundEngine.play({ name: 'impact' })
          this.hp -= BOSS.boltIntegrityDamage
          this.shakeCamera({ durationMs: 100, intensity: 0.003 })
          if (this.hp <= 0) {
            this.hp = 0
            this.endRun()
            return
          }
        }
      }
    }
    this.bossBolts = this.bossBolts.filter((bolt) => bolt.isDead === false)
  }

  private dropBossBolt({ x, y }: { x: number; y: number }): void {
    const image = this.add.image(x, y, 'boss-bolt').setDepth(DEPTHS.bullets)
    this.tweens.add({
      targets: image,
      scaleX: 1.3,
      scaleY: 1.3,
      duration: 220,
      yoyo: true,
      repeat: -1,
    })
    this.bossBolts.push({ image, velocityY: BOSS.boltSpeedPxPerSec, isDead: false })
  }

  /** mender aura: heal every other invader inside the radius for a slice of max hp */
  private pulseMenderHeal({ mender }: { mender: EnemyUnit }): void {
    let didHeal = false
    for (const other of this.enemies) {
      if (other.isDead === true || other === mender || other.hp >= other.maxHp) {
        continue
      }
      const distanceSq =
        (other.image.x - mender.image.x) ** 2 + (other.image.y - mender.image.y) ** 2
      if (distanceSq > ENEMY_AURAS.menderRadiusPx ** 2) {
        continue
      }
      other.hp = Math.min(other.maxHp, other.hp + other.maxHp * ENEMY_AURAS.menderHealFraction)
      didHeal = true
    }
    if (didHeal === true) {
      const ring = this.add
        .circle(mender.image.x, mender.image.y, mender.radius)
        .setStrokeStyle(2, 0x4ade80, 0.8)
        .setDepth(DEPTHS.effects)
      this.tweens.add({
        targets: ring,
        radius: ENEMY_AURAS.menderRadiusPx,
        alpha: 0,
        duration: 500,
        ease: 'Cubic.easeOut',
        onComplete: () => {
          ring.destroy()
        },
      })
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
      warden: 0x3b82f6,
      dancer: 0x2dd4bf,
      mender: 0x4ade80,
      mothership: 0x94a3b8,
      dummy: 0xe2e8f0,
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
    this.spawnFragmentRing({
      x,
      y,
      count:
        CLUSTER_BOMBS.baseFragments +
        CLUSTER_BOMBS.fragmentsPerLevel * (this.stats.clusterLevel - 1),
      damage:
        this.stats.damage *
        (CLUSTER_BOMBS.baseDamageMult +
          CLUSTER_BOMBS.damageMultPerLevel * (this.stats.clusterLevel - 1)),
      source: 'cluster',
      travelPx: CLUSTER_BOMBS.fragmentTravelPx,
    })
  }

  /** an even ring of flak fragments — cluster bombs and salvage bursts share it */
  private spawnFragmentRing({
    x,
    y,
    count,
    damage,
    source,
    travelPx,
  }: {
    x: number
    y: number
    count: number
    damage: number
    source: string
    travelPx: number
  }): void {
    const fragmentSpeed = this.stats.projectileSpeed * 0.6
    const startAngle = Math.random() * Math.PI * 2
    for (let index = 0; index < count; index += 1) {
      const angle = startAngle + (index * Math.PI * 2) / count
      const image = this.add.image(x, y, 'flak-frag').setDepth(DEPTHS.bullets)
      this.bullets.push({
        image,
        source,
        velocityX: Math.cos(angle) * fragmentSpeed,
        velocityY: Math.sin(angle) * fragmentSpeed,
        damage,
        isCrit: false,
        pierceLeft: 0,
        traveledPx: 0,
        maxTravelPx: travelPx,
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
        .image(this.cannonXs[0], this.cannonY - 60, 'nanite-drone')
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
    const hoverY = this.groundY - building.image.height - 26 - Math.random() * 18

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
      .circle(x, this.groundY, 10)
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
        this.damageEnemy({
          enemy,
          amount: bullet.damage,
          source: bullet.source,
          canCrit: bullet.source !== 'main',
          isPreRolledCrit: bullet.isCrit,
        })
        // incendiary rounds synergy: tracer ammo sets its targets burning
        if (this.stats.incendiaryLevel > 0 && bullet.source === 'main') {
          this.igniteEnemy({
            enemy,
            dps:
              this.stats.damage *
              (SYNERGIES.incendiary.burnDpsMultBase +
                SYNERGIES.incendiary.burnDpsMultPerLevel * (this.stats.incendiaryLevel - 1)),
          })
        }
        // cryo shells synergy: flak fragments chill what they strike
        if (this.stats.cryoLevel > 0 && bullet.source === 'flak') {
          this.applyChill({
            enemy,
            durationMs:
              SYNERGIES.cryoshells.chillMsBase +
              SYNERGIES.cryoshells.chillMsPerLevel * (this.stats.cryoLevel - 1),
          })
        }
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
      if (enemy.image.y + enemy.radius < this.groundY) {
        continue
      }
      enemy.isDead = true
      if (this.tryAegisBlock({ x: enemy.image.x }) === true) {
        continue
      }
      this.spawnImpactFlash({ x: enemy.image.x, y: this.groundY, radius: 34 })
      soundEngine.play({ name: 'impact' })
      this.hp -= enemy.contactDamage
      this.shakeCamera({ durationMs: 120, intensity: 0.004 })
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
    canCrit = true,
    isPreRolledCrit = false,
  }: {
    enemy: EnemyUnit
    amount: number
    source: string
    /** main-gun bullets roll their crit at fire time — don't roll twice */
    canCrit?: boolean
    /** the fire-time crit verdict, so the damage popup still shows it */
    isPreRolledCrit?: boolean
  }): void {
    if (enemy.isDead === true) {
      return
    }
    // a warden's shield absorbs the first hit outright, whatever it was
    if (enemy.hasShield === true) {
      enemy.hasShield = false
      enemy.image.setTexture('enemy-warden-broken')
      soundEngine.play({ name: 'freeze' })
      const shieldRing = this.add
        .circle(enemy.image.x, enemy.image.y, enemy.radius + 6)
        .setStrokeStyle(3, 0x38bdf8, 0.95)
        .setDepth(DEPTHS.effects)
      this.tweens.add({
        targets: shieldRing,
        radius: enemy.radius + 20,
        alpha: 0,
        duration: 300,
        ease: 'Cubic.easeOut',
        onComplete: () => {
          shieldRing.destroy()
        },
      })
      return
    }
    let finalAmount = amount
    // crit chance applies to every weapon system, rolled per hit
    let isCrit = isPreRolledCrit
    if (canCrit === true && Math.random() < this.stats.critChance) {
      finalAmount *= this.stats.critMultiplier
      isCrit = true
    }
    if (this.stats.shatterLevel > 0 && enemy.frozenRemainingMs > 0) {
      finalAmount *=
        1 + SHATTERPOINT.baseBonus + SHATTERPOINT.bonusPerLevel * (this.stats.shatterLevel - 1)
    }
    this.damageBySource.set(source, (this.damageBySource.get(source) ?? 0) + finalAmount)
    enemy.hp -= finalAmount
    this.spawnDamageNumber({ x: enemy.image.x, y: enemy.image.y, amount: finalAmount, isCrit })
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
      soundEngine.play({ name: 'kill' })
      this.spawnDeathBurst({ enemy })

      // wildfire synergy: a burning casualty's fire leaps to its neighbors
      if (this.stats.wildfireLevel > 0 && enemy.burning !== null) {
        this.spreadWildfire({ from: enemy })
      }

      // momentum synergy: a main-gun kill feeds the rocket autoloader
      if (this.stats.momentumLevel > 0 && this.stats.rocketLevel > 0 && source === 'main') {
        const refundMs =
          SYNERGIES.momentum.cooldownRefundMsBase +
          SYNERGIES.momentum.cooldownRefundMsPerLevel * (this.stats.momentumLevel - 1)
        for (const cannon of this.cannons) {
          cannon.cooldowns.set('rocket', (cannon.cooldowns.get('rocket') ?? 0) + refundMs)
        }
      }

      // killable training dummies pop back up at their station shortly after
      if (this.isSandbox === true && enemy.definition.kind === 'dummy') {
        this.dummyRespawnQueue.push({
          x: enemy.patrol?.baseX ?? enemy.image.x,
          y: enemy.image.y,
          radius: enemy.radius,
          scale: enemy.image.scaleX,
          patrolAmplitude: enemy.patrol?.amplitudeX ?? 0,
          patrolPhase: enemy.patrol?.phase ?? 0,
          remainingMs: DUMMY_RESPAWN_MS,
        })
        return
      }

      const shardlingCount =
        (enemy.definition.kind === 'splitter' ? 3 : 0) +
        (enemy.affix === 'split' ? ELITE_AFFIXES.split.shardlings : 0)
      for (let index = 0; index < shardlingCount; index += 1) {
        this.spawnEnemy({
          definition: ENEMY_DEFINITIONS.shardling,
          spawnX: enemy.image.x + (Math.random() * 2 - 1) * 12,
          spawnY: enemy.image.y,
          impactX: enemy.image.x + (Math.random() * 2 - 1) * 120,
        })
      }
      if (enemy.definition.kind === 'mothership') {
        this.shakeCamera({ durationMs: 500, intensity: 0.012 })
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
      x: this.cannonXs[0],
      y: this.cannonY,
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
    soundEngine.play({ name: 'levelup' })
    this.emitLevelUpOffer()
    this.scene.pause()
  }

  private emitLevelUpOffer(): void {
    const choices = rollUpgradeChoices({
      stacks: this.upgradeStacks,
      roll: () => Math.random(),
      count: LEVEL_UP_CHOICE_COUNT,
      wave: this.wave,
      luck: this.stats.luck,
      weaponSlots: this.stats.weaponSlots,
      weaponTierBonus: this.stats.weaponTierBonus,
      banished: this.banishedCardIds,
    })
    gameEventBus.emit({
      event: 'level-up',
      payload: {
        level: this.level,
        choices,
        weaponSlotsUsed: countOwnedWeapons({ stacks: this.upgradeStacks }),
        weaponSlotsTotal: this.stats.weaponSlots,
        rerollsLeft: this.runRerollsLeft,
        banishesLeft: this.runBanishesLeft,
      },
    })
  }

  private rerollActiveOffer(): void {
    if (this.hasActiveOffer === false || this.runRerollsLeft <= 0) {
      return
    }
    this.runRerollsLeft -= 1
    this.emitLevelUpOffer()
  }

  /** strike the card from this run's pool entirely, then refresh the offer */
  private banishCard({ upgradeId }: { upgradeId: string }): void {
    if (
      this.hasActiveOffer === false ||
      this.runBanishesLeft <= 0 ||
      isFillerUpgradeId({ upgradeId }) === true
    ) {
      return
    }
    this.runBanishesLeft -= 1
    this.banishedCardIds.add(upgradeId)
    this.emitLevelUpOffer()
  }

  private applyUpgrade({ upgradeId }: { upgradeId: string }): void {
    if (this.hasActiveOffer === false) {
      return
    }
    if (isFillerUpgradeId({ upgradeId }) === true) {
      this.applyFillerUpgrade({ upgradeId })
    } else {
      const definition = findUpgradeDefinition({ upgradeId })
      if (definition === null) {
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

  private applyFillerUpgrade({ upgradeId }: { upgradeId: string }): void {
    if (upgradeId === 'filler-stardust') {
      this.bonusStardust += fillerStardustReward({ wave: this.wave })
      return
    }
    if (upgradeId === 'filler-repair') {
      this.hp = Math.min(this.stats.maxHp, this.hp + FILLER_REWARDS.repairIntegrity)
      return
    }
    if (upgradeId === 'filler-overcharge') {
      this.stats = {
        ...this.stats,
        damage: this.stats.damage * (1 + FILLER_REWARDS.damagePercent / 100),
      }
    }
  }

  private syncCannons(): void {
    const targetCount = Math.min(this.stats.cannonCount, this.cannonXs.length)
    while (this.cannons.length < targetCount) {
      const x = this.cannonXs[this.cannons.length]
      const rangeRing = this.add
        .circle(x, this.cannonY, this.stats.range)
        .setStrokeStyle(2, 0x38bdf8, 0.1)
        .setDepth(DEPTHS.rangeRing)
      const barrelImage = this.add
        .image(x, this.cannonY - 6, 'battery-barrel')
        .setOrigin(0.12, 0.5)
        .setRotation(-Math.PI / 2)
        .setDepth(DEPTHS.barrel)
      const baseImage = this.add.image(x, this.cannonY, 'battery-base').setDepth(DEPTHS.cannonBase)

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
        y: this.cannonY,
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
    this.buildings = this.buildingXs.map((x, index) => {
      const textureKey = `building-${index}`
      return {
        x,
        textureKey,
        image: this.add
          .image(x, this.groundY + 4, textureKey)
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
        this.spawnImpactFlash({ x: building.x, y: this.groundY - 12, radius: 48 })
        soundEngine.play({ name: 'collapse' })
        this.shakeCamera({ durationMs: 200, intensity: 0.006 })
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
    soundEngine.play({ name: 'gameover' })
    this.syncBuildings()
    const stardustEarned = Math.round(
      (this.kills * STARDUST.perKill +
        this.wave * STARDUST.perWave +
        this.level * STARDUST.perLevel +
        this.bonusStardust) *
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
    this.shakeCamera({ durationMs: 400, intensity: 0.01 })
    this.emitHudSnapshot()

    const damageBySource = [...this.damageBySource.entries()]
      .map(([source, total]) => ({ source, total }))
      .sort((a, b) => b.total - a.total)

    this.time.delayedCall(750, () => {
      gameEventBus.emit({
        event: 'run-ended',
        payload: {
          waveReached: this.wave,
          kills: this.kills,
          level: this.level,
          elapsedMs: this.elapsedMs,
          stardustEarned,
          damageBySource,
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

  /** optional floating damage numbers — capped so dense fights don't drown in text */
  private spawnDamageNumber({
    x,
    y,
    amount,
    isCrit,
  }: {
    x: number
    y: number
    amount: number
    isCrit: boolean
  }): void {
    if (damageNumbersEnabled.value === false || this.floatingTextCount >= 40) {
      return
    }
    this.floatingTextCount += 1
    const text = this.add
      .text(x + (Math.random() * 2 - 1) * 8, y - 10, String(Math.round(amount)), {
        fontFamily: 'Segoe UI, system-ui, sans-serif',
        fontSize: isCrit === true ? '15px' : '11px',
        fontStyle: 'bold',
        color: isCrit === true ? '#fde047' : '#e2e8f0',
      })
      .setOrigin(0.5, 1)
      .setDepth(DEPTHS.effects)
    this.tweens.add({
      targets: text,
      y: y - 38,
      alpha: 0,
      duration: 600,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        text.destroy()
        this.floatingTextCount -= 1
      },
    })
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
    graphics.fillRect(0, 0, this.arenaWidth, this.groundY)
    graphics.fillGradientStyle(0x1e1b4b, 0x1e1b4b, 0x4c1d95, 0x4c1d95, 0.5)
    graphics.fillRect(0, this.groundY - 90, this.arenaWidth, 90)

    // stars, denser near the top
    for (let index = 0; index < 130; index += 1) {
      const x = Math.random() * this.arenaWidth
      const y = Math.random() ** 1.6 * (this.groundY - 40)
      const size = Math.random() < 0.85 ? 1 : 2
      graphics.fillStyle(0xffffff, 0.2 + Math.random() * 0.6)
      graphics.fillRect(x, y, size, size)
    }

    // moon with a soft halo and craters
    const moonX = Math.round(this.arenaWidth * 0.84)
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
      { textureKey: 'cloud-0', xFraction: 0.16, y: 130, speed: 7, alpha: 0.14, scale: 1.2 },
      { textureKey: 'cloud-1', xFraction: 0.48, y: 220, speed: 11, alpha: 0.1, scale: 0.9 },
      { textureKey: 'cloud-2', xFraction: 0.77, y: 320, speed: 15, alpha: 0.12, scale: 1 },
      { textureKey: 'cloud-1', xFraction: 0.3, y: 420, speed: 19, alpha: 0.08, scale: 1.4 },
    ]
    this.cloudImages = cloudConfigs.map((config) => ({
      image: this.add
        .image(config.xFraction * this.arenaWidth, config.y, config.textureKey)
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
        .image(
          Math.random() * this.arenaWidth,
          90 + Math.random() * this.groundY * 0.55,
          textureKey,
        )
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
      if (cloud.image.x > this.arenaWidth + 160) {
        cloud.image.x = -160
      }
    }
  }

  private drawGround(): void {
    const graphics = this.add.graphics().setDepth(DEPTHS.ground)

    graphics.fillGradientStyle(0x166534, 0x166534, 0x052e16, 0x052e16, 1)
    graphics.fillRect(0, this.groundY, this.arenaWidth, GROUND.height)
    graphics.lineStyle(2, 0x4ade80, 0.45)
    graphics.lineBetween(0, this.groundY, this.arenaWidth, this.groundY)

    // faint horizontal contours suggest depth receding toward the horizon
    graphics.lineStyle(1, 0x14532d, 0.8)
    graphics.lineBetween(0, this.groundY + 14, this.arenaWidth, this.groundY + 14)
    graphics.lineStyle(1, 0x14532d, 0.5)
    graphics.lineBetween(0, this.groundY + 32, this.arenaWidth, this.groundY + 32)
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

    // warden: blue armored invader wrapped in a shield ring
    graphics.fillStyle(0x3b82f6)
    graphics.fillCircle(17, 17, 11)
    graphics.lineStyle(2, 0x1e3a8a)
    graphics.strokeCircle(17, 17, 11)
    graphics.fillStyle(0x1e3a8a)
    graphics.fillRect(12, 14, 10, 6)
    graphics.lineStyle(2, 0x7dd3fc, 0.9)
    graphics.strokeCircle(17, 17, 15)
    graphics.generateTexture('enemy-warden', 34, 34)
    graphics.clear()

    // warden with its shield broken: same hull, no ring
    graphics.fillStyle(0x3b82f6)
    graphics.fillCircle(17, 17, 11)
    graphics.lineStyle(2, 0x1e3a8a)
    graphics.strokeCircle(17, 17, 11)
    graphics.fillStyle(0x1e3a8a)
    graphics.fillRect(12, 14, 10, 6)
    graphics.generateTexture('enemy-warden-broken', 34, 34)
    graphics.clear()

    // dancer: teal moth — two swept wings around a slim body
    graphics.fillStyle(0x2dd4bf)
    graphics.fillTriangle(11, 11, 1, 3, 5, 14)
    graphics.fillTriangle(11, 11, 21, 3, 17, 14)
    graphics.fillStyle(0x0f766e)
    graphics.fillEllipse(11, 12, 6, 12)
    graphics.fillStyle(0x99f6e4)
    graphics.fillCircle(11, 8, 2)
    graphics.generateTexture('enemy-dancer', 22, 20)
    graphics.clear()

    // mender: green orb with a medic cross
    graphics.fillStyle(0x166534)
    graphics.fillCircle(14, 14, 12)
    graphics.fillStyle(0x4ade80)
    graphics.fillCircle(14, 14, 10)
    graphics.fillStyle(0xdcfce7)
    graphics.fillRect(12, 8, 4, 12)
    graphics.fillRect(8, 12, 12, 4)
    graphics.generateTexture('enemy-mender', 28, 28)
    graphics.clear()

    // boss plasma bolt: magenta orb with a hot core
    graphics.fillStyle(0xd946ef, 0.4)
    graphics.fillCircle(8, 8, 7)
    graphics.fillStyle(0xd946ef)
    graphics.fillCircle(8, 8, 5)
    graphics.fillStyle(0xfdf4ff)
    graphics.fillCircle(8, 8, 2)
    graphics.generateTexture('boss-bolt', 16, 16)
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

    // mine balloon: a red marker balloon on a string
    graphics.fillStyle(0xf87171)
    graphics.fillEllipse(7, 8, 12, 15)
    graphics.fillStyle(0xfecaca, 0.9)
    graphics.fillEllipse(5, 5, 4, 6)
    graphics.fillStyle(0xb91c1c)
    graphics.fillTriangle(7, 15, 4, 19, 10, 19)
    graphics.lineStyle(1, 0xcbd5e1, 0.8)
    graphics.lineBetween(7, 19, 7, 34)
    graphics.generateTexture('balloon', 14, 36)
    graphics.clear()

    // stasis missile: a slim cyan dart with a frosty tip — pointing +x
    graphics.fillStyle(0xe0f2fe)
    graphics.fillRect(0, 2, 4, 4)
    graphics.fillStyle(0x7dd3fc)
    graphics.fillRect(3, 1, 11, 6)
    graphics.fillStyle(0xbae6fd)
    graphics.fillTriangle(19, 4, 13, 0, 13, 8)
    graphics.generateTexture('stasis-missile', 20, 8)
    graphics.clear()

    // nanite payload: a writhing green cluster
    graphics.fillStyle(0x166534)
    graphics.fillCircle(7, 7, 6)
    graphics.fillStyle(0x4ade80)
    graphics.fillCircle(5, 6, 3)
    graphics.fillCircle(9, 8, 3)
    graphics.fillCircle(7, 4, 2.5)
    graphics.fillStyle(0xdcfce7)
    graphics.fillCircle(7, 7, 1.5)
    graphics.generateTexture('nanite-shot', 14, 14)
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
