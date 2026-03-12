const labels = ['', 'Péssimo', 'Ruim', 'Regular', 'Bom', 'Excelente'];

function goTo(n) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const target = n === 0 ? document.getElementById('home') : document.getElementById('p' + n);
  target.classList.add('active');
  window.scrollTo(0, 0);
}

function rate(page, value) {
  document.querySelectorAll('#stars-' + page + ' .star').forEach((s, i) => {
    s.classList.toggle('selected', i < value);
  });
  document.getElementById('label-' + page).textContent = labels[value];
  document.getElementById('btn-' + page).disabled = false;
}



