const labels = ['', 'Péssimo', 'Ruim', 'Regular', 'Bom', 'Excelente'];

function goTo(n) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const target = n === 0 ? document.getElementById('home') : document.getElementById('p' + n);
  target.classList.add('active');
  window.scrollTo(0, 0);
}

// --- Coleta de respostas e finalização ---
window.answers = {};
window.comment = null;

function rate(page, value) {
  document.querySelectorAll('#stars-' + page + ' .star').forEach((s, i) => {
    s.classList.toggle('selected', i < value);
  });
  document.getElementById('label-' + page).textContent = labels[value];
  document.getElementById('btn-' + page).disabled = false;
  window.answers[page] = value;
}

function startSurvey() {
  goTo(1);
}

async function submitSurvey() {
  // se houver login salvo, usar ele
  let user = null;
  try { user = JSON.parse(localStorage.getItem('user')); } catch (e) { user = null; }
  let name = user && user.name ? user.name.trim() : document.getElementById('final-name').value.trim();
  let phone = user && user.phone ? user.phone.trim() : document.getElementById('final-phone').value.trim();
  // validar obrigatórios
  if (!name) { alert('Por favor, informe seu nome.'); return; }
  if (!phone) { alert('Por favor, informe seu número de telefone.'); return; }
  const payload = { answers: window.answers || {}, name: name, phone: phone, comment: window.comment || null };
  try {
    await fetch('/answers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  } catch (err) {
    console.warn('Falha ao enviar para o servidor', err);
  } finally {
    // limpar estado e mostrar obrigado
    window.answers = {};
    window.comment = null;
    const c = document.getElementById('final-comment'); if (c) c.value = '';
    // se não estiver logado, limpar campos
    try { if (!JSON.parse(localStorage.getItem('user'))) { document.getElementById('final-name').value = ''; document.getElementById('final-phone').value = ''; } } catch(e){ document.getElementById('final-name').value = ''; document.getElementById('final-phone').value = ''; }
    goTo(8);
  }
}

function proceedToContact() {
  const comment = document.getElementById('final-comment').value.trim();
  window.comment = comment || null;
  goTo(7);
}

window.startSurvey = startSurvey;
window.submitSurvey = submitSurvey;

// Login helpers
function openLoginModal() { document.getElementById('login-modal').style.display = 'flex'; }
function closeLoginModal() { document.getElementById('login-modal').style.display = 'none'; }
async function doLogin() {
  const name = document.getElementById('login-name').value.trim();
  const phone = document.getElementById('login-phone').value.trim();
  if (!name || !phone) { alert('Informe nome e telefone.'); return; }
  try {
    const res = await fetch('/login', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ name, phone }) });
    const data = await res.json();
    // salvar localmente
    localStorage.setItem('user', JSON.stringify({ name, phone, role: data.role || 'user' }));
    closeLoginModal();
    updateLoginUI();
    if (data.role === 'admin') {
      window.location.href = 'dashboard.html';
    }
  } catch (err) { console.warn(err); alert('Erro ao autenticar'); }
}

function logout() { localStorage.removeItem('user'); updateLoginUI(); }

function updateLoginUI() {
  let user = null;
  try { user = JSON.parse(localStorage.getItem('user')); } catch(e) { user = null; }
  const btn = document.getElementById('login-btn');
  if (!btn) return;
  if (user && user.name) {
    btn.textContent = user.name + (user.role === 'admin' ? ' (admin)' : '');
    btn.onclick = () => {
      if (user.role === 'admin') window.location.href = 'dashboard.html'; else logout();
    };
    // ocultar campos finais se logado
    const fn = document.getElementById('final-name'); const fp = document.getElementById('final-phone');
    if (fn) fn.style.display = 'none'; if (fp) fp.style.display = 'none';
  } else {
    btn.textContent = 'Entrar';
    btn.onclick = openLoginModal;
    const fn = document.getElementById('final-name'); const fp = document.getElementById('final-phone');
    if (fn) fn.style.display = ''; if (fp) fp.style.display = '';
  }
}

// inicializar UI
document.addEventListener('DOMContentLoaded', () => { document.getElementById('login-btn').onclick = openLoginModal; updateLoginUI(); });



