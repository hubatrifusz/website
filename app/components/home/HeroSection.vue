<template>
  <section class="hero">
    <div class="hero__content">
      <h1 class="hero__title">Big title /<br />Brand slogan</h1>
      <p class="hero__description">A few paragraphs of how we are,<br />or what we do</p>
      <button class="hero__cta">CTA Button</button>
    </div>
  </section>
</template>

<style scoped>
.hero {
  display: flex;
  align-items: center;
  min-height: 100vh;
  padding: 0 6rem;
  gap: 4rem;
  background-size: cover;
  font-family: 'Inter', sans-serif;
}

.hero__content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  max-width: 480px;
}

.hero__title {
  font-size: clamp(2.5rem, 5vw, 4rem);
  font-weight: 400;
  line-height: 1.1;
  letter-spacing: -0.02em;
  color: #111111;
  margin: 0;
}

.hero__description {
  font-size: 1rem;
  line-height: 1.6;
  color: #555555;
  margin: 0;
}

.hero__cta {
  align-self: flex-start;
  padding: 0.65rem 1.5rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: #111111;
  background: transparent;
  border: 1.5px solid #111111;
  cursor: pointer;
  letter-spacing: 0.02em;
  transition:
    background 0.2s ease,
    color 0.2s ease;
}

.hero__cta:hover {
  background: #111111;
  color: #ffffff;
}

.hero__image {
  flex: 1;
  aspect-ratio: 4 / 3;
  background: #f0f0f0;
  overflow: hidden;
  position: relative;
}

.hero__image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

/* Responsive */
@media (max-width: 768px) {
  .hero {
    flex-direction: column;
    padding: 4rem 2rem;
    min-height: auto;
    gap: 2.5rem;
  }

  .hero__content {
    max-width: 100%;
  }

  .hero__image {
    width: 100%;
  }
}
</style>
