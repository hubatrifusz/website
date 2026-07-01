<script setup lang="ts">
type ReferenceCardItem = {
  title: string
  description: string
  metric: string
  category: string
  tags: string[]
}

const items: ReferenceCardItem[] = [
  {
    title: 'E-commerce redesign',
    description: 'A conversion-focused storefront refresh that clarified product discovery and reduced checkout friction.',
    metric: '+32%',
    category: 'Retail',
    tags: ['Checkout', 'UX audit', 'Mobile-first'],
  },
  {
    title: 'Logistics dashboard',
    description: 'A single operations view for tracking shipments, exceptions, and live status across teams.',
    metric: '4 tools',
    category: 'Operations',
    tags: ['Tracking', 'Reporting', 'Automation'],
  },
  {
    title: 'SaaS onboarding flow',
    description: 'A guided onboarding experience built to help new users reach activation faster.',
    metric: '+41%',
    category: 'Product',
    tags: ['Activation', 'Tours', 'Retention'],
  },
  {
    title: 'Healthcare portal',
    description: 'A patient self-service portal designed to simplify appointments, results, and secure messaging.',
    metric: 'AA',
    category: 'Healthcare',
    tags: ['Accessibility', 'Self-service', 'Secure access'],
  },
  {
    title: 'FinTech mobile app',
    description: 'A mobile banking experience focused on trust, speed, and low-friction authentication.',
    metric: '4.8★',
    category: 'FinTech',
    tags: ['Auth', 'Performance', 'Mobile'],
  },
]
</script>

<template>
  <UCarousel
    v-slot="{ item }"
    loop
    arrows
    dots
    :autoplay="{ delay: 2000 }"
    :items="items"
    :ui="{ item: 'basis-full sm:basis-1/2 lg:basis-1/3 px-2' }"
  >
    <HomeReferenceCard v-bind="item" />
  </UCarousel>
</template>