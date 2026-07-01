<script setup lang="ts">
defineProps<{
  title: string
  description: string
  metric: string
  category: string
  tags: string[]
}>()
</script>

<template>
  <UCard class="h-full border border-gray-200 bg-white shadow-sm">
    <div class="flex h-full flex-col gap-4 p-6">
      <div class="flex items-start justify-between gap-4">
        <div>
          <p class="text-xs font-semibold uppercase tracking-[0.24em] text-gray-500">
            {{ category }}
          </p>
          <h3 class="mt-2 text-lg font-semibold text-gray-900">
            {{ title }}
          </h3>
        </div>

        <div class="rounded-full bg-gray-900 px-3 py-1 text-sm font-semibold text-white">
          {{ metric }}
        </div>
      </div>

      <p class="text-sm leading-6 text-gray-600">
        {{ description }}
      </p>

      <div class="mt-auto flex flex-wrap gap-2">
        <span
          v-for="tag in tags"
          :key="tag"
          class="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-medium text-gray-600"
        >
          {{ tag }}
        </span>
      </div>
    </div>
  </UCard>
</template>