import type {
  HudSnapshot,
  LevelUpOffer,
  RunResult,
  RunStats,
  SandboxLayout,
  SandboxStatsEntry,
} from '@/game/types'

interface GameEventMap {
  'hud-update': HudSnapshot
  'level-up': LevelUpOffer
  'upgrade-chosen': { upgradeId: string }
  'run-ended': RunResult
  'set-paused': { isPaused: boolean }
  'set-speed': { multiplier: number }
  'sandbox-stats': { entries: Array<SandboxStatsEntry>; elapsedMs: number }
  /** sandbox only: synchronously simulate this much game time (immune to tab throttling) */
  'sandbox-fastforward': { gameMs: number }
  /** sandbox only: synchronously reset the range with a new loadout — no scene reboot */
  'sandbox-configure': {
    stats: RunStats
    cardStacks: Record<string, number>
    layout: SandboxLayout
  }
}

type EventHandler<TPayload> = (payload: TPayload) => void

function createEventBus<TEvents extends object>() {
  const handlers = new Map<keyof TEvents, Set<EventHandler<never>>>()

  function on<TKey extends keyof TEvents>({
    event,
    handler,
  }: {
    event: TKey
    handler: EventHandler<TEvents[TKey]>
  }): () => void {
    const existing = handlers.get(event) ?? new Set<EventHandler<never>>()
    existing.add(handler as EventHandler<never>)
    handlers.set(event, existing)
    return () => {
      existing.delete(handler as EventHandler<never>)
    }
  }

  function emit<TKey extends keyof TEvents>({
    event,
    payload,
  }: {
    event: TKey
    payload: TEvents[TKey]
  }): void {
    const eventHandlers = handlers.get(event)
    if (eventHandlers === undefined) {
      return
    }
    for (const handler of eventHandlers) {
      // a stale or broken subscriber (e.g. a scene pending destruction in a
      // hidden tab) must not swallow the event for the live subscribers
      try {
        ;(handler as EventHandler<TEvents[TKey]>)(payload)
      } catch (error) {
        console.error(`[gameEventBus] handler failed for event "${String(event)}"`, error)
      }
    }
  }

  return { on, emit }
}

export const gameEventBus = createEventBus<GameEventMap>()
