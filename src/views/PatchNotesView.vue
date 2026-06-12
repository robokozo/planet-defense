<script setup lang="ts">
import { PATCH_NOTES, type PatchNoteKind } from '@/data/patchNotes'

const KIND_STYLES: Record<PatchNoteKind, string> = {
  new: 'bg-lime-400/15 text-lime-300 border-lime-400/30',
  balance: 'bg-amber-400/15 text-amber-300 border-amber-400/30',
  fix: 'bg-sky-400/15 text-sky-300 border-sky-400/30',
}

const KIND_LABELS: Record<PatchNoteKind, string> = {
  new: 'New',
  balance: 'Balance',
  fix: 'Fix',
}

function formatDate({ iso }: { iso: string }): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}
</script>

<template>
  <main class="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-8 p-6 sm:p-10">
    <header class="flex items-center justify-between">
      <RouterLink
        to="/"
        class="text-sm font-semibold text-slate-400 transition hover:text-slate-200"
      >
        ← Home
      </RouterLink>
      <h1 class="text-xl font-black tracking-wider text-sky-300">PATCH NOTES</h1>
    </header>

    <section
      v-for="entry in PATCH_NOTES"
      :key="`${entry.date}-${entry.title}`"
      class="flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-900/50 p-5 sm:p-6"
    >
      <div class="flex flex-wrap items-baseline justify-between gap-2">
        <h2 class="text-lg font-bold text-slate-100">{{ entry.title }}</h2>
        <p class="text-xs font-semibold uppercase tracking-wider text-slate-500">
          {{ formatDate({ iso: entry.date }) }}
        </p>
      </div>
      <p v-if="entry.blurb !== undefined" class="-mt-2 text-sm italic text-slate-400">
        {{ entry.blurb }}
      </p>
      <ul class="flex flex-col gap-2">
        <li v-for="(note, index) in entry.notes" :key="index" class="flex items-start gap-2.5">
          <span
            class="mt-0.5 shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider"
            :class="KIND_STYLES[note.kind]"
          >
            {{ KIND_LABELS[note.kind] }}
          </span>
          <p class="text-sm leading-relaxed text-slate-300">{{ note.text }}</p>
        </li>
      </ul>
    </section>
  </main>
</template>
