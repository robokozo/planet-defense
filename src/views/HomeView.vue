<script setup lang="ts">
import { useMetaStore } from '@/stores/metaStore'

const metaStore = useMetaStore()
</script>

<template>
  <main class="flex min-h-screen flex-col items-center justify-center gap-10 p-8">
    <header class="text-center">
      <h1
        class="text-5xl font-black tracking-widest text-sky-300 drop-shadow-[0_0_18px_rgba(56,189,248,0.45)]"
      >
        LAST HORIZON
      </h1>
      <p class="mt-3 text-slate-400">The invasion has begun. Hold the line.</p>
    </header>

    <section
      class="flex items-center gap-3 rounded-full border border-amber-400/30 bg-amber-400/10 px-6 py-2"
    >
      <span class="text-2xl">✦</span>
      <span class="text-xl font-bold text-amber-300">{{ Math.floor(metaStore.stardust) }}</span>
      <span class="text-sm text-amber-200/70">stardust</span>
    </section>

    <nav class="flex flex-col items-center gap-4">
      <RouterLink
        to="/game"
        class="w-64 rounded-xl bg-sky-500 px-8 py-4 text-center text-xl font-bold text-slate-950 transition hover:bg-sky-400 hover:shadow-[0_0_24px_rgba(56,189,248,0.5)]"
      >
        Launch Run
      </RouterLink>
      <RouterLink
        to="/skills"
        class="w-64 rounded-xl border border-fuchsia-400/40 bg-fuchsia-500/10 px-8 py-4 text-center text-xl font-bold text-fuchsia-300 transition hover:bg-fuchsia-500/20"
      >
        Paragon Tree
      </RouterLink>
      <RouterLink
        to="/lab"
        class="w-64 rounded-xl border border-lime-400/40 bg-lime-500/10 px-8 py-4 text-center text-xl font-bold text-lime-300 transition hover:bg-lime-500/20"
      >
        Training Range
      </RouterLink>
    </nav>

    <section class="grid grid-cols-4 gap-6 text-center text-sm">
      <div>
        <p class="text-2xl font-bold text-slate-200">{{ metaStore.lifetime.runs }}</p>
        <p class="text-slate-500">runs</p>
      </div>
      <div>
        <p class="text-2xl font-bold text-slate-200">{{ metaStore.lifetime.bestWave }}</p>
        <p class="text-slate-500">best wave</p>
      </div>
      <div>
        <p class="text-2xl font-bold text-slate-200">{{ metaStore.lifetime.kills }}</p>
        <p class="text-slate-500">kills</p>
      </div>
      <div>
        <p class="text-2xl font-bold text-slate-200">
          {{ Math.floor(metaStore.lifetime.totalStardustEarned) }}
        </p>
        <p class="text-slate-500">stardust earned</p>
      </div>
    </section>
  </main>
</template>
