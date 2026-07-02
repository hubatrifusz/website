<template>
  <section class="bracket-section">
    <h2 class="process-title">Our work process</h2>

    <div class="bracket-grid">
      <div class="spine" :style="spineStyle"></div>

      <div
        v-for="(card, i) in cards"
        :key="card.title"
        :ref="(el) => setCardRef(el, i)"
        class="bracket-card"
        :class="{ 'is-visible': revealed[i] }"
        :style="{ gridColumn: i % 2 === 0 ? 1 : 2, gridRow: i + 1 }"
      >
        <h3>{{ card.title }}</h3>
        <p>{{ card.description }}</p>
      </div>
    </div>
  </section>
</template>

<script setup>
import { reactive, computed, onMounted, onUnmounted } from 'vue'

const cards = [
  { title: 'Process 1', description: 'Description for this part of the process' },
  { title: 'Process 2', description: 'Description for this part of the process' },
  { title: 'Process 3', description: 'Description for this part of the process' },
  { title: 'Process 4', description: 'Description for this part of the process' },
  { title: 'Process 5', description: 'Description for this part of the process' },
  { title: 'Process 6', description: 'Description for this part of the process' },
]

const revealed = reactive(Array(cards.length).fill(false))
const cardEls = []
const elToIndex = new WeakMap()

function setCardRef(el, i) {
  if (!el) return
  cardEls[i] = el
  elToIndex.set(el, i)
}

let observer = null

onMounted(() => {
  observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const idx = elToIndex.get(entry.target)
        if (idx === undefined) return
        if (entry.isIntersecting) {
          revealed[idx] = true
          observer.unobserve(entry.target)
        }
      })
    },
    { threshold: 0.3, rootMargin: '0px 0px -10% 0px' }
  )

  cardEls.forEach((el) => el && observer.observe(el))
})

onUnmounted(() => {
  observer?.disconnect()
})

const revealedCount = computed(() => revealed.filter(Boolean).length)
const spineStyle = computed(() => {
  const fraction = revealedCount.value / cards.length
  return {
    transform: `translateX(-50%) scaleY(${fraction})`,
    opacity: fraction > 0 ? 1 : 0,
  }
})
</script>

<style scoped>
.bracket-section {
  max-width: 900px;
  margin: 0 auto;
  padding: 80px 24px;
}

.process-title {
  font-family: 'Inter', sans-serif;
  font-size: 2.5rem;
  font-weight: 500;
  color: #111;
  text-align: center;
  margin: 0 0 64px;
}

.bracket-grid {
  position: relative;
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-auto-rows: minmax(140px, auto);
  row-gap: 32px;
  column-gap: 64px;
}

.spine {
  position: absolute;
  left: 50%;
  top: 0%;
  height: 100%;
  width: 1px;
  background: #d0d0d0;
  transform-origin: top;
  transition: transform 0.5s ease, opacity 0.3s ease;
}

.bracket-card {
  position: relative;
  border: 1px solid #d0d0d0;
  padding: 24px;
  font-family: 'Inter', sans-serif;
  color: #111;
  align-self: center;

  opacity: 0;
  transition: opacity 0.5s ease, transform 0.5s ease;
}

.bracket-card:nth-child(odd) {
  transform: translateX(-16px);
}
.bracket-card:nth-child(even) {
  transform: translateX(16px);
}

.bracket-card.is-visible {
  opacity: 1;
  transform: translateX(0);
}

.bracket-card::after {
  content: '';
  position: absolute;
  top: 50%;
  width: 32px;
  height: 1px;
  background: #d0d0d0;
  transform: translateY(-50%);
  opacity: 0;
  transition: opacity 0.3s ease 0.2s;
}

.bracket-card:nth-child(odd)::after {
  right: 100%;
}
.bracket-card:nth-child(even)::after {
  left: 100%;
}

.bracket-card.is-visible::after {
  opacity: 1;
}

.bracket-card h3 {
  font-size: 1.5rem;
  font-weight: 500;
  margin: 0 0 12px;
}

.bracket-card p {
  font-size: 0.95rem;
  color: #444;
  margin: 0;
}

@media (prefers-reduced-motion: reduce) {
  .bracket-card,
  .bracket-card::after,
  .spine {
    transition: none;
  }
}

@media (max-width: 640px) {
  .bracket-grid {
    grid-template-columns: 1fr;
    row-gap: 24px;
  }

  .bracket-card {
    grid-column: 1 !important;
    grid-row: auto !important;
    transform: translateY(16px) !important;
  }

  .bracket-card.is-visible {
    transform: translateY(0) !important;
  }

  .spine,
  .bracket-card::after {
    display: none;
  }

  .process-title {
    font-size: 1.75rem;
  }
}
</style>