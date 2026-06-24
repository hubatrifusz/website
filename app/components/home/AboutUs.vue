<template>
  <section class="team">
    <h2 class="team__heading">Meet the team</h2>

    <article class="teamCard">
      <div class="team_photo">
        <img src="", alt="The Team"
        />
      </div>
      <div class="team_bio">
        <h3 class="team_title">Meet The Team</h3>
        <p class="team_description">Lorem ipsum, dolor sit amet consectetur adipisicing elit. Rem ullam ex quos laboriosam ipsum suscipit consequuntur cum deleniti! Voluptatum voluptatem temporibus veritatis ut reiciendis consequuntur ipsum ipsam omnis cupiditate alias.</p>
      </div>
      <div class="team_details">
        <h3 class="workflow">Workflow</h3>
        <ul class="workflow_list">
          <li>Research</li>
          <li>Strategy</li>
          <li>Execution</li>
        </ul>
      </div>
    </article>
  </section>
</template>

<style scoped>
.team {
  padding: 5rem 4rem;
  font-family: 'Inter', system-ui, sans-serif;
  background: transparent;
}

.team__heading {
  font-size: clamp(1.75rem, 3vw, 2.5rem);
  font-weight: 400;
  letter-spacing: -0.01em;
  color: #111;
  text-align: center;
  margin: 0 0 3rem;
}

.teamCard {
  display: grid;
  grid-template-columns: 200px 1fr 220px;
  align-items: center;
  gap: 2.5rem;
  border: 1px solid #e0e0e0;
  padding: 1.75rem 2rem;
  background-color: white;
}

/* Photo */
.team_photo {
  aspect-ratio: 1 / 1;
  background: #f0f0f0;
  overflow: hidden;
  position: relative;
}


.team_photo::before,
.team_photo::after {
  content: '';
  position: absolute;
  inset: 0;
  border: 1px solid #ccc;
}

.team_photo::before {
  background: linear-gradient(
    to bottom right,
    transparent calc(50% - 0.5px),
    #ccc calc(50% - 0.5px),
    #ccc calc(50% + 0.5px),
    transparent calc(50% + 0.5px)
  );
}

.team_photo::after {
  background: linear-gradient(
    to top right,
    transparent calc(50% - 0.5px),
    #ccc calc(50% - 0.5px),
    #ccc calc(50% + 0.5px),
    transparent calc(50% + 0.5px)
  );
}

.team_photo img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  position: relative;
  z-index: 1;
}

.team_bio {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.team_title {
  font-size: 1.25rem;
  font-weight: 500;
  color: #111;
  margin: 0;
}

.team_description {
  font-size: 0.9rem;
  line-height: 1.65;
  color: #555;
  margin: 0;
}


.team_details {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  padding-left: 2rem;
  border-left: 1px solid #e0e0e0;
  align-self: stretch;
  justify-content: center;
}

.workflow {
  font-size: 1.25rem;
  font-weight: 500;
  color: #111;
  margin: 0;
}

.workflow_list {
  list-style: disc;
  padding-left: 1.1rem;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.team_list li {
  font-size: 0.9rem;
  color: #444;
}

/* Responsive */
@media (max-width: 768px) {
  .team {
    padding: 3rem 1.5rem;
  }

  .teamCard {
    grid-template-columns: 1fr;
    gap: 1.25rem;
  }

  .team_photo {
    width: 120px;
    aspect-ratio: 1 / 1;
  }

  .team_details {
    border-left: none;
    border-top: 1px solid #e0e0e0;
    padding-left: 0;
    padding-top: 1rem;
  }
}
</style>