// script.js - controla navegação e avaliações
const pages = Array.from(document.querySelectorAll('.page'));
const totalPages = pages.length;
const answers = {}; // armazena ratings: answers[questionIndex] = rating

function showPage(index) {
  pages.forEach(p => p.classList.remove('active'));
  const id = index === 0 ? 'home' : `p${index}`;
  const page = document.getElementById(id);
  if (page) page.classList.add('active');
}

function updateProgress(index) {
  const dots = document.querySelectorAll('.progress-dot');
  dots.forEach((d, i) => {
    d.classList.remove('active', 'done');
    if (i < index - 1) d.classList.add('done');
    if (i === index - 1) d.classList.add('active');
  });
}

export function goTo(index) {
  // index 0 = home, 1..5 = perguntas, 6 = thanks
  showPage(index);
  if (index >= 1 && index <= 5) updateProgress(index);
  if (index === 0) {
    // reset optional
  }
}

window.goTo = goTo; // expor global para onclick inline

function setStars(pageIndex, rating) {
  const stars = document.querySelectorAll(`#stars-${pageIndex} .star`);
  stars.forEach((s, i) => {
    s.classList.toggle('rated', i < rating);
  });
  const label = document.getElementById(`label-${pageIndex}`);
  if (label) label.textContent = rating ? `${rating} de 5` : '';
}

export function rate(pageIndex, value) {
  answers[pageIndex] = value;
  setStars(pageIndex, value);
  const btn = document.getElementById(`btn-${pageIndex}`);
  if (btn) btn.disabled = false;
}

window.rate = rate;

// Inicializa visual (mostrar home)
document.addEventListener('DOMContentLoaded', () => {
  showPage(0);
});



