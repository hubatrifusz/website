<template>
  <section class="pain-points">
    <h2 class="pain-points__heading">Pain points we solve</h2>

    <div class="pain-points__grid">
      <div v-for="category in categories" :key="category.id" class="pain-points__column">
        <h3 class="pain-points__title">{{ category.title }}</h3>
        <ul class="pain-points__list">
          <li v-for="point in category.points" :key="point" class="pain-points__item">
            {{ point }}
          </li>
        </ul>
      </div>
    </div>
  </section>
</template>

<script setup>
const categories = [
  {
    id: 1,
    title: 'Operations',
    points: [
      'Manual, error-prone processes',
      'Lack of real-time visibility',
      'Siloed teams and tools',
    ],
  },
  {
    id: 2,
    title: 'Growth',
    points: ['Inconsistent lead qualification', 'Long sales cycles', 'Poor customer retention'],
  },
  {
    id: 3,
    title: 'Reporting',
    points: [
      'Data scattered across systems',
      'No single source of truth',
      'Delayed decision-making',
    ],
  },
]
</script>

<style scoped>
.pain-points {
  padding: 5rem 4rem;
  font-family: 'Inter', system-ui, sans-serif;
  background: #fff;
}

.pain-points__heading {
  font-size: clamp(1.75rem, 3vw, 2.25rem);
  font-weight: 400;
  letter-spacing: -0.01em;
  color: #111;
  text-align: center;
  margin: 0 0 2rem;
}

.pain-points__grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  border: 1px solid #d0d0d0;
  padding: 2.5rem 2rem;
  gap: 0;
}

.pain-points__column {
  padding: 0 2rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.pain-points__column + .pain-points__column {
  border-left: 1px solid #e0e0e0;
}

.pain-points__title {
  font-size: 1.1rem;
  font-weight: 500;
  color: #111;
  margin: 0;
}

.pain-points__list {
  list-style: disc;
  padding-left: 1.1rem;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.pain-points__item {
  font-size: 0.9rem;
  line-height: 1.55;
  color: #444;
}

/* Responsive */
@media (max-width: 768px) {
  .pain-points {
    padding: 3rem 1.5rem;
  }

  .pain-points__grid {
    grid-template-columns: 1fr;
    padding: 1.5rem;
    gap: 2rem;
  }

  .pain-points__column {
    padding: 0;
  }

  .pain-points__column + .pain-points__column {
    border-left: none;
    border-top: 1px solid #e0e0e0;
    padding-top: 2rem;
  }
}
</style>
