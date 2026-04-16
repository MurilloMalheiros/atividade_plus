/*
 * Script principal do dashboard.
 * Responsabilidades:
 * - autenticacao local e sessao;
 * - leitura/salvamento de configuracoes;
 * - filtros (unidade, refeicao e intervalo de datas);
 * - renderizacao de secoes, metricas e graficos;
 * - regras de cupons e historico de avaliacoes.
 */
const state = {
    section: 'dashboard',
    summary: null,
    answers: [],
    comments: [],
    selectedUnit: 'all',
    selectedRestaurant: 'all',
    selectedComparisonRestaurants: [],
    selectedMeal: 'all',
    selectedDateStart: '',
    selectedDateEnd: '',
    reportPeriod: 'overall',
    selectedClientKey: null,
    settings: null,
    settingsUnitEditId: null,
    settingsTab: 'configuracoes',
    settingsQuestionEditId: null,
    settingsCouponEditId: null,
    currentUser: null
};

const AUTH_USERS_KEY = 'plus-auth-users-v1';
const AUTH_SESSION_KEY = 'plus-auth-session-v1';
const ADMIN_EMAIL = 'plusmidia@gamil.com';
const ADMIN_PASSWORD = 'plusmidia1234';

document.addEventListener('DOMContentLoaded', async () => {
    if (!initializeAuthState()) {
        return;
    }
    initializeSettingsState();
    applyAuthenticatedUser();
    bindSidebarControls();
    bindNavigation();
    bindUnitFilter();
    bindMealFilter();
    bindDateRangeFilter();
    bindLogout();
    await loadData();
    initializeUnitFilterOptions();
    renderSection('dashboard');
});

function buildAdminUser() {
    return {
        id: 'user-admin-plusmidia',
        role: 'admin',
        restaurantName: 'Plus Midia',
        ownerName: 'Admin Plus Midia',
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD
    };
}

function normalizeAuthUser(user, index) {
    return {
        id: String(user?.id || `user-${Date.now()}-${index}`),
        role: String(user?.role || 'restaurant').toLowerCase() === 'admin' ? 'admin' : 'restaurant',
        restaurantName: String(user?.restaurantName || '').trim(),
        ownerName: String(user?.ownerName || '').trim(),
        email: String(user?.email || '').trim().toLowerCase(),
        password: String(user?.password || '').trim()
    };
}

function ensureAuthUsers() {
    const adminUser = buildAdminUser();
    let users = [];

    try {
        const raw = window.localStorage.getItem(AUTH_USERS_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
                users = parsed.map((user, index) => normalizeAuthUser(user, index)).filter((user) => user.email);
            }
        }
    } catch (_error) {
        users = [];
    }

    const withoutAdmin = users.filter((user) => user.email !== ADMIN_EMAIL);
    const normalized = [adminUser, ...withoutAdmin];
    window.localStorage.setItem(AUTH_USERS_KEY, JSON.stringify(normalized));
    return normalized;
}

function readCurrentSessionUser() {
    const users = ensureAuthUsers();
    try {
        const raw = window.localStorage.getItem(AUTH_SESSION_KEY);
        if (!raw) {
            return null;
        }
        const parsed = JSON.parse(raw);
        const email = String(parsed?.email || '').trim().toLowerCase();
        if (!email) {
            return null;
        }
        return users.find((user) => user.email === email) || null;
    } catch (_error) {
        return null;
    }
}

function initializeAuthState() {
    const user = readCurrentSessionUser();
    if (!user) {
        window.location.href = './login.html';
        return false;
    }

    state.currentUser = user;
    state.selectedRestaurant = user.role === 'admin' ? 'all' : resolveCurrentRestaurantName();
    return true;
}

function applyAuthenticatedUser() {
    const user = state.currentUser;
    if (!user) {
        return;
    }

    const avatar = document.querySelector('.topbar-avatar');
    if (avatar) {
        const base = user.ownerName || user.restaurantName || 'U';
        avatar.textContent = String(base).charAt(0).toUpperCase() || 'U';
        avatar.title = `${user.ownerName || 'Usuario'} (${user.role === 'admin' ? 'admin' : 'restaurante'})`;
    }

    const unitFilterLabel = document.querySelector('.unit-filter-label');
    if (unitFilterLabel) {
        unitFilterLabel.title = user.role === 'admin'
            ? 'Selecionar unidade'
            : `Unidades de ${resolveCurrentRestaurantName()}`;
    }
}

function bindLogout() {
    const button = document.getElementById('logout-btn');
    if (!button) {
        return;
    }

    button.addEventListener('click', () => {
        window.localStorage.removeItem(AUTH_SESSION_KEY);
        window.location.href = './login.html';
    });
}

function bindNavigation() {
    document.querySelectorAll('.nav-item[data-section]').forEach((item) => {
        item.addEventListener('click', (event) => {
            event.preventDefault();
            const section = item.dataset.section;
            setActiveNavigation(section);
            renderSection(section);
        });
    });
}

function bindSidebarControls() {
    const body = document.body;
    const stored = window.localStorage.getItem('sidebar-collapsed');
    if (stored === '1') {
        body.classList.add('sidebar-collapsed');
    }

    const toggle = () => {
        const collapsed = body.classList.toggle('sidebar-collapsed');
        window.localStorage.setItem('sidebar-collapsed', collapsed ? '1' : '0');
    };

    const topbarToggle = document.getElementById('topbar-sidebar-toggle');
    const sidebarToggle = document.getElementById('sidebar-collapse-btn');
    topbarToggle?.addEventListener('click', toggle);
    sidebarToggle?.addEventListener('click', toggle);
}

function bindUnitFilter() {
    const select = document.getElementById('unit-filter');
    if (!select) {
        return;
    }

    select.addEventListener('change', () => {
        state.selectedUnit = select.value || 'all';
        renderSection(state.section);
    });
}

function bindMealFilter() {
    const select = document.getElementById('meal-filter');
    if (!select) {
        return;
    }

    select.addEventListener('change', () => {
        state.selectedMeal = normalizeMealFilterValue(select.value);
        renderSection(state.section);
    });
}

function bindDateRangeFilter() {
    const startInput = document.getElementById('date-start-filter');
    const endInput = document.getElementById('date-end-filter');
    if (!startInput || !endInput) {
        return;
    }

    const onChange = () => {
        state.selectedDateStart = normalizeDateFilterValue(startInput.value);
        state.selectedDateEnd = normalizeDateFilterValue(endInput.value);
        renderSection(state.section);
    };

    startInput.addEventListener('change', onChange);
    endInput.addEventListener('change', onChange);
}

function initializeUnitFilterOptions() {
    const select = document.getElementById('unit-filter');
    if (!select) {
        return;
    }

    const previousValue = state.selectedUnit || 'all';
    const units = getUnitOptionsFromAnswers();
    select.innerHTML = `
        <option value="all">Todas as unidades</option>
        ${units.map((unit) => `<option value="${escapeHtml(unit)}">${escapeHtml(unit)}</option>`).join('')}
    `;

    const hasValue = previousValue === 'all' || units.includes(previousValue);
    state.selectedUnit = hasValue ? previousValue : 'all';
    select.value = state.selectedUnit;
}

function isAdminUser() {
    return state.currentUser?.role === 'admin';
}

function resolveCurrentRestaurantName() {
    const fromUser = String(state.currentUser?.restaurantName || '').trim();
    if (fromUser) {
        return fromUser;
    }

    const fromSettings = String(state.settings?.restaurantName || '').trim();
    return fromSettings || 'Restaurante principal';
}

function resolveRestaurantName(item) {
    const candidates = [
        item?.restaurantName,
        item?.restaurant,
        item?.restauranteName,
        item?.restaurante,
        item?.companyName,
        item?.businessName
    ];
    const explicit = candidates.find((candidate) => typeof candidate === 'string' && candidate.trim());
    if (explicit) {
        return explicit.trim();
    }

    if (!isAdminUser()) {
        return resolveCurrentRestaurantName();
    }

    return 'Restaurante nao informado';
}

function getRestaurantOptionsFromAnswers() {
    const fromAnswers = (state.answers || []).map((answer) => resolveRestaurantName(answer)).filter(Boolean);
    const fromUsers = ensureAuthUsers()
        .filter((user) => user.role !== 'admin')
        .map((user) => String(user.restaurantName || '').trim())
        .filter(Boolean);
    const merged = [...new Set([...fromUsers, ...fromAnswers])];
    return merged.sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

async function loadData() {
    const [summaryResponse, answersResponse, commentsResponse] = await Promise.all([
        fetch('/dashboard/summary'),
        fetch('/answers/details'),
        fetch('/comments')
    ]);

    if (!summaryResponse.ok || !answersResponse.ok || !commentsResponse.ok) {
        renderError('Não foi possível carregar os dados do painel.');
        return;
    }

    state.summary = await summaryResponse.json();
    state.answers = await answersResponse.json();
    state.comments = await commentsResponse.json();
    initializeUnitFilterOptions();
}

function renderSection(section) {
    state.section = section;
    const title = document.getElementById('page-title');
    const subtitle = document.getElementById('page-subtitle');
    const content = document.getElementById('content');

    if (!state.summary) {
        renderError('Não foi possível carregar os dados do painel.');
        return;
    }

    if (section === 'dashboard') {
        title.textContent = 'Dashboard';
        subtitle.textContent = 'Resumo das avaliações recebidas.';
        content.innerHTML = buildDashboard();
        return;
    }

    if (section === 'answers') {
        title.textContent = 'Respostas';
        subtitle.textContent = 'Histórico de avaliações com contato rápido por WhatsApp.';
        content.innerHTML = buildAnswers();
        return;
    }

    if (section === 'comments') {
        title.textContent = 'Comentários';
        subtitle.textContent = 'Feedbacks textuais enviados pelos clientes.';
        content.innerHTML = buildComments();
        return;
    }

    if (section === 'reports') {
        title.textContent = 'Relatórios';
        subtitle.textContent = 'Comparativo por período com pontos fortes e melhorias.';
        content.innerHTML = buildReports();
        bindReportControls();
        return;
    }

    if (section === 'clients') {
        title.textContent = 'Clientes';
        subtitle.textContent = 'Gestao de cadastro de clientes.';
        content.innerHTML = buildRegisterPlaceholder('clientes');
        return;
    }

    if (section === 'places') {
        title.textContent = 'Estabelecimentos';
        subtitle.textContent = 'Gestao de cadastro de estabelecimentos.';
        content.innerHTML = buildRegisterPlaceholder('estabelecimentos');
        return;
    }

    if (section === 'users') {
        title.textContent = 'Usuarios';
        subtitle.textContent = 'Gestao de cadastro de usuarios.';
        content.innerHTML = buildRegisterPlaceholder('usuarios');
        return;
    }

    title.textContent = 'Métricas';
    subtitle.textContent = 'Métricas interessantes para acompanhar a operação.';
    content.innerHTML = buildMetrics();
}

function setActiveNavigation(section) {
    document.querySelectorAll('.nav-item[data-section]').forEach((item) => {
        item.classList.toggle('active', item.dataset.section === section);
    });
}

function buildDashboardLegacy() {
    const summary = state.summary;

    return `
        <section class="stats-grid">
            <article class="stat-card">
                <span class="stat-label">Total de avaliações</span>
                <strong class="stat-value">${summary.totalAnswers}</strong>
            </article>
            <article class="stat-card">
                <span class="stat-label">Nota média geral</span>
                <strong class="stat-value">${formatNumber(summary.overallAverage)}</strong>
            </article>
        </section>

        <section class="panel-card">
            <div class="panel-head trend-head">
                <div>
                    <h2>Evolução da nota média</h2>
                    <span>Linha de 0 a 5 da primeira até a última avaliação</span>
                </div>
                <div class="summary-tags">
                    <span class="summary-tag">Total: ${summary.totalAnswers}</span>
                    <span class="summary-tag summary-tag-good">Boas: ${summary.goodAnswers || 0}</span>
                    <span class="summary-tag summary-tag-bad">Ruins/Regulares: ${summary.badAnswers || 0}</span>
                </div>
            </div>
            <div class="trend-layout">
                <div class="line-chart-wrap">
                    ${buildAverageLineChart(summary.averageTimeline)}
                </div>
                <aside class="ranking-panel">
                    <h3>Ranking de garçons</h3>
                    <p>Considera apenas avaliações com nome do atendente.</p>
                    ${buildWaiterRanking(summary.waiterRanking)}
                </aside>
            </div>
        </section>

        <section class="panel-grid">
            <article class="panel-card">
                <div class="panel-head">
                    <h2>Distribuição geral</h2>
                    <span>Quantidade por estrela</span>
                </div>
                <div class="bars">
                    ${buildStarBarsSafe(summary.overallDistribution)}
                </div>
            </article>

            <article class="panel-card">
                <div class="panel-head">
                    <h2>Médias por pergunta</h2>
                    <span>Visão das notas por critério</span>
                </div>
                <div class="metric-list">
                    ${buildQuestionAveragesSafe(summary.questionAverages)}
                </div>
            </article>
        </section>

        <section class="panel-card">
            <div class="panel-head">
                <h2>Distribuição por pergunta</h2>
                <span>Leitura detalhada do desempenho em cada ponto avaliado</span>
            </div>
            <div class="question-grid">
                ${buildQuestionDistributionsSafe(summary.questionDistributions)}
            </div>
        </section>
    `;
}

function buildReports() {
    const report = getReportData('overall');

    return `
        <section class="panel-card">
            <div class="panel-head">
                <h2>Relatório por período</h2>
                <span>Geral, últimos 2 meses, 6 meses e 12 meses</span>
            </div>
            <div class="report-controls">
                <button class="report-period-btn active" data-period="overall">Geral</button>
                <button class="report-period-btn" data-period="2m">2 meses</button>
                <button class="report-period-btn" data-period="6m">6 meses</button>
                <button class="report-period-btn" data-period="12m">12 meses</button>
            </div>
            <div id="report-content">
                ${buildReportContent(report)}
            </div>
        </section>
    `;
}

function buildMetricsLegacy() {
    const answers = state.answers || [];
    if (!answers.length) {
        return buildEmptyState('Sem dados para calcular métricas.');
    }

    const total = answers.length;
    const good = answers.filter((answer) => answer.classification === 'boa').length;
    const withComment = answers.filter((answer) => String(answer.comment || '').trim()).length;
    const withWaiter = answers.filter((answer) => String(answer.waiterName || '').trim()).length;
    const atendimentoAverage = calculateAverageFromAnswers(answers, 'atendimentoEquipe');
    const comidaAverage = calculateAverageFromAnswers(answers, 'qualidadeComida');
    const esperaAverage = calculateAverageFromAnswers(answers, 'tempoEspera');

    return `
        <section class="stats-grid metrics-grid">
            <article class="stat-card">
                <span class="stat-label">Taxa de avaliações boas</span>
                <strong class="stat-value">${formatPercent(good / total)}</strong>
            </article>
            <article class="stat-card">
                <span class="stat-label">Clientes que comentaram</span>
                <strong class="stat-value">${formatPercent(withComment / total)}</strong>
            </article>
            <article class="stat-card">
                <span class="stat-label">Atendimento da equipe (média)</span>
                <strong class="stat-value">${formatNumber(atendimentoAverage)}</strong>
            </article>
            <article class="stat-card">
                <span class="stat-label">Avaliações com garçom identificado</span>
                <strong class="stat-value">${formatPercent(withWaiter / total)}</strong>
            </article>
        </section>

        <section class="panel-card">
            <div class="panel-head">
                <h2>Comparativo das perguntas</h2>
                <span>Média por critério no período geral</span>
            </div>
            <div class="metric-list">
                <div class="metric-item">
                    <span>Qualidade da comida</span>
                    <strong>${formatNumber(comidaAverage)}</strong>
                </div>
                <div class="metric-item">
                    <span>Atendimento da equipe</span>
                    <strong>${formatNumber(atendimentoAverage)}</strong>
                </div>
                <div class="metric-item">
                    <span>Tempo de espera</span>
                    <strong>${formatNumber(esperaAverage)}</strong>
                </div>
            </div>
        </section>
    `;
}

function bindReportControls() {
    const buttons = document.querySelectorAll('.report-period-btn');
    const content = document.getElementById('report-content');
    if (!buttons.length || !content) {
        return;
    }

    buttons.forEach((button) => {
        button.addEventListener('click', () => {
            buttons.forEach((item) => item.classList.toggle('active', item === button));
            const report = getReportData(button.dataset.period);
            content.innerHTML = buildReportContent(report);
        });
    });
}

function buildReportContent(report) {
    return `
        <div class="stats-grid metrics-grid">
            <article class="stat-card">
                <span class="stat-label">Avaliação média do período</span>
                <strong class="stat-value">${formatNumber(report.averageScore)}</strong>
            </article>
            <article class="stat-card">
                <span class="stat-label">Total de avaliações</span>
                <strong class="stat-value">${report.totalAnswers}</strong>
            </article>
        </div>
        <div class="panel-grid">
            <article class="panel-card report-note">
                <div class="panel-head">
                    <h2>O que foi bem</h2>
                </div>
                <p>${escapeHtml(report.strength)}</p>
            </article>
            <article class="panel-card report-note">
                <div class="panel-head">
                    <h2>O que pode melhorar</h2>
                </div>
                <p>${escapeHtml(report.improvement)}</p>
            </article>
        </div>
    `;
}

function getReportData(period) {
    const filtered = filterAnswersByPeriod(period);
    if (!filtered.length) {
        return {
            averageScore: 0,
            totalAnswers: 0,
            strength: 'Sem avaliações suficientes nesse período.',
            improvement: 'Sem avaliações suficientes nesse período.'
        };
    }

    const labels = {
        qualidadeComida: 'qualidade da comida',
        atendimentoEquipe: 'atendimento da equipe',
        tempoEspera: 'tempo de espera'
    };

    const questionScores = Object.keys(labels).map((key) => ({
        key,
        average: calculateAverageFromAnswers(filtered, key)
    }));

    questionScores.sort((a, b) => b.average - a.average);
    const best = questionScores[0];
    const worst = questionScores[questionScores.length - 1];

    return {
        averageScore: filtered.reduce((sum, answer) => sum + Number(answer.averageScore || 0), 0) / filtered.length,
        totalAnswers: filtered.length,
        strength: `Melhor resultado: ${labels[best.key]} com média ${formatNumber(best.average)}.`,
        improvement: `Prioridade de melhoria: ${labels[worst.key]} com média ${formatNumber(worst.average)}.`
    };
}

function filterAnswersByPeriod(period) {
    const answers = state.answers || [];
    if (period === 'overall') {
        return answers;
    }

    const months = period === '2m' ? 2 : period === '6m' ? 6 : 12;
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - months);

    return answers.filter((answer) => new Date(answer.createdAt) >= cutoff);
}

function buildAnswers() {
    if (!state.answers.length) {
        return buildEmptyState('Nenhuma avaliação recebida ainda.');
    }

    return `
        <section class="table-card">
            <div class="answers-list">
                ${state.answers.map((answer) => `
                    <article class="answer-card">
                        <div class="answer-top">
                            <div>
                                <h3>${escapeHtml(answer.name)}</h3>
                                <p>${formatDate(answer.createdAt)}</p>
                            </div>
                            <span class="badge badge-${answer.classification}">${answer.classification}</span>
                        </div>
                        <div class="answer-meta">
                            <span>Telefone: ${escapeHtml(answer.phone)}</span>
                            <span>Média: ${formatNumber(answer.averageScore)}</span>
                            ${answer.waiterName ? `<span>Garçom: ${escapeHtml(answer.waiterName)} (${answer.waiterServiceScore ?? answer.answers.atendimentoEquipe ?? '-'} estrelas)</span>` : ''}
                        </div>
                        <div class="chips">
                            ${Object.entries(answer.answers).map(([question, score]) => `
                                <span class="chip">${formatQuestionLabel(question)}: ${score}</span>
                            `).join('')}
                        </div>
                        <p class="answer-comment">${answer.comment ? escapeHtml(answer.comment) : 'Sem comentário informado.'}</p>
                        <div class="answer-actions">
                            <a class="whatsapp-button" href="${buildWhatsAppLink(answer)}" target="_blank" rel="noopener noreferrer" aria-label="Conversar no WhatsApp">
                                <img class="whatsapp-button-icon" src="./icon-whatsapp.png" alt="WhatsApp">
                            </a>
                        </div>
                    </article>
                `).join('')}
            </div>
        </section>
    `;
}

function buildComments() {
    if (!state.comments.length) {
        return buildEmptyState('Nenhum comentário foi enviado ainda.');
    }

    return `
        <section class="comments-grid">
            ${state.comments.map((comment) => `
                <article class="comment-card">
                    <div class="comment-head">
                        <div>
                            <h3>${escapeHtml(comment.name)}</h3>
                            <p>${formatDate(comment.createdAt)}</p>
                        </div>
                        <span class="badge badge-${comment.classification}">${comment.classification}</span>
                    </div>
                    <p class="comment-text">${escapeHtml(comment.comment)}</p>
                    <span class="comment-score">Média da avaliação: ${formatNumber(comment.averageScore)}</span>
                </article>
            `).join('')}
        </section>
    `;
}

function buildAverageLineChart(timeline) {
    const points = Array.isArray(timeline) ? timeline : [];
    if (!points.length) {
        return `<div class="empty-state chart-empty">Sem dados para montar o gráfico.</div>`;
    }

    const width = 860;
    const height = 280;
    const margin = { top: 20, right: 14, bottom: 40, left: 40 };
    const plotWidth = width - margin.left - margin.right;
    const plotHeight = height - margin.top - margin.bottom;

    const computedPoints = points.map((point, index) => {
        const score = Number(point.averageScore || 0);
        const boundedScore = Math.max(0, Math.min(5, score));
        const x = margin.left + (points.length === 1 ? plotWidth / 2 : (index / (points.length - 1)) * plotWidth);
        const y = margin.top + ((5 - boundedScore) / 5) * plotHeight;

        return {
            ...point,
            x,
            y,
            score: boundedScore
        };
    });

    const polyline = computedPoints.map((point) => `${point.x},${point.y}`).join(' ');
    const yLabels = [5, 4, 3, 2, 1, 0];
    const xIndexMiddle = Math.floor((computedPoints.length - 1) / 2);
    const xLabels = [0, xIndexMiddle, computedPoints.length - 1]
        .filter((value, index, array) => array.indexOf(value) === index)
        .map((index) => computedPoints[index]);

    return `
        <svg class="line-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Evolução da nota média no tempo">
            ${yLabels.map((label) => {
                const y = margin.top + ((5 - label) / 5) * plotHeight;
                return `
                    <line x1="${margin.left}" y1="${y}" x2="${width - margin.right}" y2="${y}" class="chart-grid-line" />
                    <text x="${margin.left - 8}" y="${y + 4}" class="chart-axis-label chart-axis-y">${label}</text>
                `;
            }).join('')}

            <polyline points="${polyline}" class="chart-line" />
            ${computedPoints.map((point) => `
                <circle cx="${point.x}" cy="${point.y}" r="4.5" class="chart-point">
                    <title>${formatDate(point.createdAt)} - Nota ${formatNumber(point.score)}</title>
                </circle>
            `).join('')}

            ${xLabels.map((point) => `
                <text x="${point.x}" y="${height - 14}" class="chart-axis-label chart-axis-x">${formatDateShort(point.createdAt)}</text>
            `).join('')}
        </svg>
    `;
}

function buildWaiterRanking(ranking) {
    const items = Array.isArray(ranking) ? ranking : [];
    if (!items.length) {
        return `<div class="ranking-empty">Sem dados com nome de garçom para ranking.</div>`;
    }

    return `
        <ol class="ranking-list">
            ${items.map((item, index) => `
                <li class="ranking-item">
                    <span class="ranking-position">${index + 1}</span>
                    <span class="ranking-name">${escapeHtml(item.waiterName)}</span>
                    <span class="ranking-score">${formatNumber(item.averageScore)} (${item.totalEvaluations})</span>
                </li>
            `).join('')}
        </ol>
    `;
}

function buildStarBars(distribution) {
    const values = Object.values(distribution);
    const max = Math.max(...values, 1);

    return Object.entries(distribution).map(([star, count]) => `
        <div class="bar-row">
            <span class="bar-label">${star} estrela${star === '1' ? '' : 's'}</span>
            <div class="bar-track">
                <div class="bar-fill" style="width: ${(count / max) * 100}%"></div>
            </div>
            <strong>${count}</strong>
        </div>
    `).join('');
}

function buildQuestionAverages(questionAverages) {
    return Object.entries(questionAverages).map(([question, average]) => `
        <div class="metric-item">
            <span>${formatQuestionLabel(question)}</span>
            <strong>${formatNumber(average)}</strong>
        </div>
    `).join('');
}

function buildQuestionDistributions(questionDistributions) {
    return Object.entries(questionDistributions).map(([question, distribution]) => `
        <article class="question-card">
            <h3>${formatQuestionLabel(question)}</h3>
            <div class="bars compact">
                ${buildStarBars(distribution)}
            </div>
        </article>
    `).join('');
}

function buildWhatsAppLink(answer) {
    const phone = normalizePhone(answer.phone);
    const message = getWhatsAppMessage(answer);
    return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

function getWhatsAppMessage(answer) {
    const clientName = answer.name || 'cliente';
    const couponMessage = getCouponWhatsAppMessage(answer);

    if (answer.classification === 'ruim') {
        return `Ola, ${clientName}. Sentimos muito pela sua experiencia. Gostariamos de entender melhor o que aconteceu para melhorar nosso atendimento.${couponMessage}`;
    }

    if (answer.classification === 'regular') {
        return `Ola, ${clientName}. Obrigado pela sua avaliacao. Queremos melhorar sua experiencia e seu feedback e importante para nos.${couponMessage}`;
    }

    return `Ola, ${clientName}. Obrigado pela sua avaliacao positiva. Ficamos felizes em saber que sua experiencia foi boa.${couponMessage}`;
}

function normalizePhone(phone) {
    const digits = String(phone || '').replace(/\D/g, '');
    return digits.startsWith('55') ? digits : `55${digits}`;
}

function getCouponWhatsAppMessage(answer) {
    const settings = getCouponAutomationSettings();
    if (!settings.whatsappEnabled) {
        return '';
    }

    const activeCoupon = getActiveCouponForWhatsApp();
    if (!activeCoupon) {
        return '';
    }

    const reason = getCouponReasonForClient(answer, settings);
    if (!reason) {
        return '';
    }

    const reasonText = reason === 'first'
        ? 'Como e sua primeira avaliacao, voce ganhou um cupom.'
        : 'Percebemos que voce ficou sem avaliar por um tempo e queremos ver voce de volta.';
    const expiration = activeCoupon.expiresAt ? ` Valido ate ${activeCoupon.expiresAt}.` : '';
    const description = activeCoupon.description ? ` ${activeCoupon.description}.` : '';
    const discount = activeCoupon.discount ? ` Desconto: ${activeCoupon.discount}.` : '';

    return `\n\n${reasonText}\nCupom: ${activeCoupon.code}.${discount}${expiration}${description}`;
}

function getCouponAutomationSettings() {
    const defaults = createDefaultSettings().couponAutomation;
    const source = state.settings?.couponAutomation || {};
    return {
        whatsappEnabled: source.whatsappEnabled ?? defaults.whatsappEnabled,
        firstEvaluationEnabled: source.firstEvaluationEnabled ?? defaults.firstEvaluationEnabled,
        inactiveClientEnabled: source.inactiveClientEnabled ?? defaults.inactiveClientEnabled,
        inactiveDays: Number.isFinite(Number(source.inactiveDays))
            ? Math.max(1, Math.floor(Number(source.inactiveDays)))
            : defaults.inactiveDays
    };
}

function getActiveCouponForWhatsApp() {
    const today = new Date().toISOString().slice(0, 10);
    return normalizeCoupons(state.settings?.coupons)
        .find((coupon) => coupon.active && (!coupon.expiresAt || coupon.expiresAt >= today)) || null;
}

function getCouponReasonForClient(answer, settings) {
    const answers = state.answers || [];
    const clientKey = getClientKeyFromAnswer(answer);
    const clientAnswers = answers
        .filter((item) => getClientKeyFromAnswer(item) === clientKey)
        .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

    if (!clientAnswers.length) {
        return null;
    }

    const answerIsFirst = String(clientAnswers[0]?.id ?? '') === String(answer.id ?? '');
    if (settings.firstEvaluationEnabled && answerIsFirst) {
        return 'first';
    }

    if (settings.inactiveClientEnabled) {
        const lastEvaluation = clientAnswers[clientAnswers.length - 1];
        const daysSinceLastEvaluation = calculateDaysSince(lastEvaluation?.createdAt);
        if (daysSinceLastEvaluation >= settings.inactiveDays) {
            return 'inactive';
        }
    }

    return null;
}

function calculateDaysSince(dateInput) {
    const date = new Date(dateInput);
    if (Number.isNaN(date.getTime())) {
        return 0;
    }
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    if (diffMs <= 0) {
        return 0;
    }
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

function formatQuestionLabel(question) {
    const normalizedKey = String(question || '').trim();
    if (!normalizedKey) {
        return 'Pergunta';
    }

    const labels = {
        qualidadeComida: 'Qualidade da comida',
        atendimentoEquipe: 'Atendimento da equipe',
        tempoEspera: 'Tempo de espera'
    };

    const configuredQuestions = normalizeQuestionnaireQuestions(state.settings?.questionnaire?.questions);
    const configuredMatch = configuredQuestions.find((item) => item.key === normalizedKey);
    if (configuredMatch?.question) {
        return configuredMatch.question;
    }

    if (labels[normalizedKey]) {
        return labels[normalizedKey];
    }

    return normalizedKey
        .replaceAll('_', ' ')
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/^\w/, (char) => char.toUpperCase());
}

function formatDate(value) {
    return new Date(value).toLocaleString('pt-BR');
}

function formatDateShort(value) {
    return new Date(value).toLocaleDateString('pt-BR');
}

function formatNumber(value) {
    return Number(value || 0).toFixed(2);
}

function formatPercent(value) {
    return `${(Number(value || 0) * 100).toFixed(1)}%`;
}

function calculateAverageFromAnswers(answers, key) {
    const scores = answers
        .map((answer) => Number(answer.answers?.[key]))
        .filter((score) => !Number.isNaN(score));

    if (!scores.length) {
        return 0;
    }

    return scores.reduce((sum, score) => sum + score, 0) / scores.length;
}

function buildEmptyState(message) {
    return `<section class="empty-state">${message}</section>`;
}

function buildRegisterPlaceholder(entityName) {
    return `
        <section class="panel-card register-card">
            <div class="panel-head">
                <h2>Cadastro de ${entityName}</h2>
                <span>Área pronta para receber o CRUD</span>
            </div>
            <p>Este item do menu já está funcional e abre esta seção.</p>
        </section>
    `;
}

function renderError(message) {
    document.getElementById('page-title').textContent = 'Painel';
    document.getElementById('page-subtitle').textContent = 'Erro ao carregar dados.';
    document.getElementById('content').innerHTML = `<section class="empty-state">${message}</section>`;
}

function buildDashboard() {
    const summary = state.summary || {};
    const answers = state.answers || [];
    const indexes = calculateDashboardIndexes(summary, answers);

    return `
        <section class="stats-grid dashboard-indices-grid">
            <article class="stat-card">
                <span class="stat-label">NPS medio</span>
                <strong class="stat-value">${formatSignedNumber(indexes.nps)}</strong>
            </article>
            <article class="stat-card">
                <span class="stat-label">Media de satisfacao</span>
                <strong class="stat-value">${formatNumber(indexes.satisfactionAverage)} / 5</strong>
            </article>
            <article class="stat-card">
                <span class="stat-label">Total de respostas</span>
                <strong class="stat-value">${indexes.totalResponses}</strong>
            </article>
            <article class="stat-card">
                <span class="stat-label">Numero de clientes</span>
                <strong class="stat-value">${indexes.totalClients}</strong>
            </article>
            <article class="stat-card">
                <span class="stat-label">Numero de cupons emitidos</span>
                <strong class="stat-value">${indexes.totalCoupons}</strong>
            </article>
        </section>

        <section class="panel-card">
            <div class="panel-head trend-head">
                <div>
                    <h2>Evolucao da nota media</h2>
                    <span>Linha de 0 a 5 da primeira ate a ultima avaliacao</span>
                </div>
                <div class="summary-tags">
                    <span class="summary-tag">Total: ${summary.totalAnswers || 0}</span>
                    <span class="summary-tag summary-tag-good">Boas: ${summary.goodAnswers || 0}</span>
                    <span class="summary-tag summary-tag-bad">Ruins/Regulares: ${summary.badAnswers || 0}</span>
                </div>
            </div>
            <div class="trend-layout">
                <div class="line-chart-wrap">
                    ${buildAverageLineChart(summary.averageTimeline)}
                </div>
                <aside class="ranking-panel">
                    <h3>Ranking de garcons</h3>
                    <p>Considera apenas avaliacoes com nome do atendente.</p>
                    ${buildWaiterRanking(summary.waiterRanking)}
                </aside>
            </div>
        </section>

        <section class="panel-grid dashboard-new-charts">
            <article class="panel-card">
                <div class="panel-head">
                    <h2>Evolucao do numero de avaliacoes</h2>
                    <span>Total por dia com base nas respostas recebidas</span>
                </div>
                <div class="line-chart-wrap">
                    ${buildAnswerVolumeLineChart(answers)}
                </div>
            </article>

            <article class="panel-card">
                <div class="panel-head">
                    <h2>Percentual de avaliacoes por periodo</h2>
                    <span>Distribuicao entre Almoco, Happy Hour e Jantar</span>
                </div>
                ${buildPeriodPercentChart(answers)}
            </article>
        </section>

        ${isAdminUser() ? buildAdminRestaurantComparison(getAdminComparisonAnswers()) : ''}
    `;
}

function buildAdminRestaurantComparison(answers) {
    const comparison = buildRestaurantComparisonData(answers);
    if (!comparison.length) {
        return `
            <section class="panel-card">
                <div class="panel-head">
                    <h2>Comparativo geral entre restaurantes</h2>
                    <span>Exclusivo para admin</span>
                </div>
                <div class="empty-state chart-empty">Sem dados de restaurantes para comparar.</div>
            </section>
        `;
    }

    const allRestaurants = comparison.map((item) => item.restaurantName);
    if (allRestaurants.length < 2) {
        return `
            <section class="panel-card">
                <div class="panel-head">
                    <h2>Frame comparativo geral entre restaurantes</h2>
                    <span>Exclusivo para admin</span>
                </div>
                <div class="empty-state chart-empty">Cadastre pelo menos 2 restaurantes para comparar.</div>
            </section>
        `;
    }

    const selectedRestaurants = normalizeComparisonRestaurants(state.selectedComparisonRestaurants)
        .filter((restaurantName) => allRestaurants.includes(restaurantName))
        .slice(0, 2);
    const effectiveSelection = selectedRestaurants.length === 0
        ? allRestaurants.slice(0, 2)
        : selectedRestaurants;
    const hasTwoSelected = effectiveSelection.length === 2;
    const selectedSet = new Set(effectiveSelection);
    const visibleComparison = hasTwoSelected
        ? comparison.filter((item) => selectedSet.has(item.restaurantName))
        : [];

    return `
        <section class="panel-card">
            <div class="panel-head">
                <h2>Frame comparativo geral entre restaurantes</h2>
                <span>Exclusivo para admin | Considera periodo (inicio/fim) e refeicao</span>
            </div>
            <div class="restaurant-compare-selector">
                ${allRestaurants.map((restaurantName) => `
                    <label class="checkbox-inline">
                        <input
                            type="checkbox"
                            data-compare-restaurant="${encodeURIComponent(restaurantName)}"
                            ${selectedSet.has(restaurantName) ? 'checked' : ''}>
                        <span>${escapeHtml(restaurantName)}</span>
                    </label>
                `).join('')}
            </div>
            <p class="settings-tip">Selecione 2 restaurantes cadastrados para comparar no frame.</p>
            <div class="restaurant-compare-frame">
                ${hasTwoSelected ? `
                <table class="restaurant-compare-table">
                    <thead>
                        <tr>
                            <th>Restaurante</th>
                            <th>Media geral</th>
                            <th>Total de avaliacoes</th>
                            <th>% boas</th>
                            <th>% ruins/regulares</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${visibleComparison.map((item) => `
                            <tr>
                                <td>${escapeHtml(item.restaurantName)}</td>
                                <td>${formatNumber(item.averageScore)}</td>
                                <td>${item.totalAnswers}</td>
                                <td>${formatPercent(item.goodRate)}</td>
                                <td>${formatPercent(item.badOrRegularRate)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                ` : `
                    <div class="empty-state chart-empty">Selecione exatamente 2 restaurantes para exibir a comparacao.</div>
                `}
            </div>
        </section>
    `;
}

function normalizeComparisonRestaurants(restaurants) {
    if (!Array.isArray(restaurants)) {
        return [];
    }

    return [...new Set(restaurants
        .map((restaurant) => String(restaurant || '').trim())
        .filter(Boolean))];
}

function bindAdminComparisonControls() {
    if (!isAdminUser()) {
        return;
    }

    const checkboxes = [...document.querySelectorAll('[data-compare-restaurant]')];
    if (!checkboxes.length) {
        return;
    }

    const syncState = (shouldRender) => {
        const checked = checkboxes
            .filter((checkbox) => checkbox.checked)
            .map((checkbox) => decodeURIComponent(String(checkbox.dataset.compareRestaurant || '')))
            .filter(Boolean);
        state.selectedComparisonRestaurants = checked.slice(0, 2);
        if (shouldRender) {
            renderSection('dashboard');
        }
    };

    const ensureSelectionLimit = (changedCheckbox) => {
        let checked = checkboxes.filter((checkbox) => checkbox.checked);

        if (checked.length > 2 && changedCheckbox?.checked) {
            changedCheckbox.checked = false;
            checked = checkboxes.filter((checkbox) => checkbox.checked);
        }
    };

    ensureSelectionLimit(null);
    syncState(false);

    checkboxes.forEach((checkbox) => {
        checkbox.addEventListener('change', () => {
            ensureSelectionLimit(checkbox);
            syncState(true);
        });
    });
}

function buildRestaurantComparisonData(answers) {
    const byRestaurant = new Map();
    const restaurants = getRestaurantOptionsFromAnswers();

    restaurants.forEach((restaurantName) => {
        byRestaurant.set(restaurantName, {
            restaurantName,
            totalAnswers: 0,
            scoreSum: 0,
            goodAnswers: 0,
            badOrRegularAnswers: 0
        });
    });

    answers.forEach((answer) => {
        const restaurantName = resolveRestaurantName(answer);
        if (!byRestaurant.has(restaurantName)) {
            byRestaurant.set(restaurantName, {
                restaurantName,
                totalAnswers: 0,
                scoreSum: 0,
                goodAnswers: 0,
                badOrRegularAnswers: 0
            });
        }

        const entry = byRestaurant.get(restaurantName);
        const averageScore = resolveAnswerAverage(answer);
        entry.totalAnswers += 1;
        entry.scoreSum += averageScore;
        const classification = String(answer.classification || classifyAverage(averageScore)).toLowerCase();
        if (classification === 'boa') {
            entry.goodAnswers += 1;
        } else {
            entry.badOrRegularAnswers += 1;
        }
    });

    return [...byRestaurant.values()]
        .map((entry) => ({
            restaurantName: entry.restaurantName,
            totalAnswers: entry.totalAnswers,
            averageScore: entry.totalAnswers ? entry.scoreSum / entry.totalAnswers : 0,
            goodRate: entry.totalAnswers ? entry.goodAnswers / entry.totalAnswers : 0,
            badOrRegularRate: entry.totalAnswers ? entry.badOrRegularAnswers / entry.totalAnswers : 0
        }))
        .sort((a, b) => {
            if (b.averageScore !== a.averageScore) {
                return b.averageScore - a.averageScore;
            }
            if (b.totalAnswers !== a.totalAnswers) {
                return b.totalAnswers - a.totalAnswers;
            }
            return a.restaurantName.localeCompare(b.restaurantName, 'pt-BR');
        });
}

function resolveAnswerAverage(answer) {
    const explicit = Number(answer?.averageScore);
    if (!Number.isNaN(explicit)) {
        return explicit;
    }

    const values = Object.values(answer?.answers || {})
        .map((value) => Number(value))
        .filter((value) => !Number.isNaN(value));
    if (!values.length) {
        return 0;
    }

    return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function buildMetrics() {
    const summary = state.summary || {};
    const answers = state.answers || [];
    if (!answers.length) {
        return buildEmptyState('Sem dados para calcular metricas.');
    }

    const total = answers.length;
    const good = answers.filter((answer) => answer.classification === 'boa').length;
    const withComment = answers.filter((answer) => String(answer.comment || '').trim()).length;
    const withWaiter = answers.filter((answer) => String(answer.waiterName || '').trim()).length;
    const atendimentoAverage = calculateAverageFromAnswers(answers, 'atendimentoEquipe');
    const comidaAverage = calculateAverageFromAnswers(answers, 'qualidadeComida');
    const esperaAverage = calculateAverageFromAnswers(answers, 'tempoEspera');

    return `
        <section class="stats-grid metrics-grid">
            <article class="stat-card">
                <span class="stat-label">Taxa de avaliacoes boas</span>
                <strong class="stat-value">${formatPercent(good / total)}</strong>
            </article>
            <article class="stat-card">
                <span class="stat-label">Clientes que comentaram</span>
                <strong class="stat-value">${formatPercent(withComment / total)}</strong>
            </article>
            <article class="stat-card">
                <span class="stat-label">Atendimento da equipe (media)</span>
                <strong class="stat-value">${formatNumber(atendimentoAverage)}</strong>
            </article>
            <article class="stat-card">
                <span class="stat-label">Avaliacoes com garcom identificado</span>
                <strong class="stat-value">${formatPercent(withWaiter / total)}</strong>
            </article>
        </section>

        <section class="panel-card">
            <div class="panel-head">
                <h2>Comparativo das perguntas</h2>
                <span>Media por criterio no periodo geral</span>
            </div>
            <div class="metric-list">
                <div class="metric-item">
                    <span>Qualidade da comida</span>
                    <strong>${formatNumber(comidaAverage)}</strong>
                </div>
                <div class="metric-item">
                    <span>Atendimento da equipe</span>
                    <strong>${formatNumber(atendimentoAverage)}</strong>
                </div>
                <div class="metric-item">
                    <span>Tempo de espera</span>
                    <strong>${formatNumber(esperaAverage)}</strong>
                </div>
            </div>
        </section>

        <section class="panel-grid">
            <article class="panel-card">
                <div class="panel-head">
                    <h2>Distribuicao geral</h2>
                    <span>Quantidade por estrela</span>
                </div>
                <div class="bars">
                    ${buildStarBarsSafe(summary.overallDistribution)}
                </div>
            </article>

            <article class="panel-card">
                <div class="panel-head">
                    <h2>Medias por pergunta</h2>
                    <span>Visao das notas por criterio</span>
                </div>
                <div class="metric-list">
                    ${buildQuestionAveragesSafe(summary.questionAverages)}
                </div>
            </article>
        </section>

        <section class="panel-card">
            <div class="panel-head">
                <h2>Distribuicao por pergunta</h2>
                <span>Leitura detalhada do desempenho em cada ponto avaliado</span>
            </div>
            <div class="question-grid">
                ${buildQuestionDistributionsSafe(summary.questionDistributions)}
            </div>
        </section>
    `;
}

function calculateDashboardIndexes(summary, answers) {
    const numericAverages = answers
        .map((answer) => Number(answer.averageScore))
        .filter((value) => !Number.isNaN(value));
    const totalResponses = Number(summary.totalAnswers ?? numericAverages.length);
    const satisfactionAverage = numericAverages.length
        ? numericAverages.reduce((sum, score) => sum + score, 0) / numericAverages.length
        : Number(summary.overallAverage || 0);
    const promoters = numericAverages.filter((score) => score * 2 >= 9).length;
    const detractors = numericAverages.filter((score) => score * 2 <= 6).length;
    const nps = totalResponses
        ? ((promoters / totalResponses) - (detractors / totalResponses)) * 100
        : 0;

    return {
        nps,
        satisfactionAverage,
        totalResponses,
        totalClients: countUniqueClients(answers),
        totalCoupons: countIssuedCoupons(answers)
    };
}

function countUniqueClients(answers) {
    const identifiers = new Set();

    answers.forEach((answer) => {
        const digits = normalizePhoneDigits(answer.phone);
        if (digits) {
            identifiers.add(`phone:${digits}`);
            return;
        }

        const name = String(answer.name || '').trim().toLowerCase();
        if (name) {
            identifiers.add(`name:${name}`);
        }
    });

    return identifiers.size;
}

function countIssuedCoupons(answers) {
    return answers.filter((answer) => {
        if (typeof answer.couponIssued === 'boolean') {
            return answer.couponIssued;
        }
        return answer.classification === 'boa';
    }).length;
}

function normalizePhoneDigits(phone) {
    return String(phone || '').replace(/\D/g, '');
}

function buildAnswerVolumeLineChart(answers) {
    const timeline = buildAnswerVolumeTimeline(answers);
    if (!timeline.length) {
        return `<div class="empty-state chart-empty">Sem dados para montar o grafico.</div>`;
    }

    const width = 860;
    const height = 280;
    const margin = { top: 20, right: 14, bottom: 40, left: 40 };
    const plotWidth = width - margin.left - margin.right;
    const plotHeight = height - margin.top - margin.bottom;
    const maxCount = Math.max(...timeline.map((point) => point.count), 1);

    const computedPoints = timeline.map((point, index) => {
        const x = margin.left + (timeline.length === 1 ? plotWidth / 2 : (index / (timeline.length - 1)) * plotWidth);
        const y = margin.top + ((maxCount - point.count) / maxCount) * plotHeight;
        return { ...point, x, y };
    });

    const polyline = computedPoints.map((point) => `${point.x},${point.y}`).join(' ');
    const yLabels = [maxCount, Math.round(maxCount * 0.75), Math.round(maxCount * 0.5), Math.round(maxCount * 0.25), 0]
        .filter((value, index, array) => array.indexOf(value) === index)
        .sort((a, b) => b - a);
    const xIndexMiddle = Math.floor((computedPoints.length - 1) / 2);
    const xLabels = [0, xIndexMiddle, computedPoints.length - 1]
        .filter((value, index, array) => array.indexOf(value) === index)
        .map((index) => computedPoints[index]);

    return `
        <svg class="line-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Evolucao do numero de avaliacoes">
            ${yLabels.map((label) => {
                const y = margin.top + ((maxCount - label) / maxCount) * plotHeight;
                return `
                    <line x1="${margin.left}" y1="${y}" x2="${width - margin.right}" y2="${y}" class="chart-grid-line" />
                    <text x="${margin.left - 8}" y="${y + 4}" class="chart-axis-label chart-axis-y">${label}</text>
                `;
            }).join('')}

            <polyline points="${polyline}" class="chart-line chart-line-secondary" />
            ${computedPoints.map((point) => `
                <circle cx="${point.x}" cy="${point.y}" r="4.5" class="chart-point chart-point-secondary">
                    <title>${formatDayKey(point.dateKey)} - ${point.count} avaliacoes</title>
                </circle>
            `).join('')}

            ${xLabels.map((point) => `
                <text x="${point.x}" y="${height - 14}" class="chart-axis-label chart-axis-x">${formatDayKey(point.dateKey)}</text>
            `).join('')}
        </svg>
    `;
}

function buildAnswerVolumeTimeline(answers) {
    const countsByDay = new Map();

    answers.forEach((answer) => {
        const date = new Date(answer.createdAt);
        if (Number.isNaN(date.getTime())) {
            return;
        }

        const dayKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        countsByDay.set(dayKey, (countsByDay.get(dayKey) || 0) + 1);
    });

    return Array.from(countsByDay.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([dateKey, count]) => ({ dateKey, count }));
}

function buildPeriodPercentChart(answers) {
    const periodCounts = {
        Almoco: 0,
        'Happy Hour': 0,
        Jantar: 0
    };

    answers.forEach((answer) => {
        const period = resolveServicePeriod(answer);
        periodCounts[period] += 1;
    });

    const total = Object.values(periodCounts).reduce((sum, value) => sum + value, 0);
    if (!total) {
        return `<div class="empty-state chart-empty">Sem dados para montar o grafico.</div>`;
    }

    return `
        <div class="period-chart">
            ${Object.entries(periodCounts).map(([period, count]) => {
                const ratio = total ? count / total : 0;
                return `
                    <article class="period-item">
                        <div class="period-head">
                            <span>${period}</span>
                            <strong>${formatPercent(ratio)}</strong>
                        </div>
                        <div class="bar-track">
                            <div class="bar-fill period-bar-fill" style="width: ${ratio * 100}%"></div>
                        </div>
                        <p class="period-count">${count} avaliacao${count === 1 ? '' : 'es'}</p>
                    </article>
                `;
            }).join('')}
        </div>
    `;
}

function resolveServicePeriod(answer) {
    const explicitPeriod = String(answer.period || answer.shift || answer.servicePeriod || '').trim().toLowerCase();
    if (explicitPeriod.startsWith('alm')) {
        return 'Almoco';
    }
    if (explicitPeriod.startsWith('hap')) {
        return 'Happy Hour';
    }
    if (explicitPeriod.startsWith('jan')) {
        return 'Jantar';
    }

    const createdAt = new Date(answer.createdAt);
    if (Number.isNaN(createdAt.getTime())) {
        return 'Jantar';
    }

    const hour = createdAt.getHours();
    if (hour >= 11 && hour < 16) {
        return 'Almoco';
    }
    if (hour >= 16 && hour < 19) {
        return 'Happy Hour';
    }
    return 'Jantar';
}

function normalizeMealFilterValue(value) {
    const normalized = String(value || '').trim().toLowerCase();
    if (normalized === 'almoco' || normalized === 'happy' || normalized === 'jantar') {
        return normalized;
    }
    return 'all';
}

function normalizeDateFilterValue(value) {
    const normalized = String(value || '').trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : '';
}

function normalizeServicePeriodKey(value) {
    const normalized = String(value || '').trim().toLowerCase();
    if (normalized.startsWith('alm')) {
        return 'almoco';
    }
    if (normalized.startsWith('hap')) {
        return 'happy';
    }
    if (normalized.startsWith('jan')) {
        return 'jantar';
    }
    return 'jantar';
}

function getAnswerDateKey(answer) {
    const candidate = answer?.createdAt ?? answer?.ts ?? answer?.created_at;
    const date = new Date(candidate);
    if (Number.isNaN(date.getTime())) {
        return '';
    }

    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function getNormalizedDateRange() {
    let start = normalizeDateFilterValue(state.selectedDateStart);
    let end = normalizeDateFilterValue(state.selectedDateEnd);

    if (start && end && start > end) {
        const temp = start;
        start = end;
        end = temp;
    }

    return { start, end };
}

function matchesDateFilter(answer) {
    const { start, end } = getNormalizedDateRange();
    if (!start && !end) {
        return true;
    }

    const dateKey = getAnswerDateKey(answer);
    if (!dateKey) {
        return false;
    }
    if (start && dateKey < start) {
        return false;
    }
    if (end && dateKey > end) {
        return false;
    }

    return true;
}

function matchesMealFilter(answer) {
    if (!state.selectedMeal || state.selectedMeal === 'all') {
        return true;
    }
    return normalizeServicePeriodKey(resolveServicePeriod(answer)) === state.selectedMeal;
}

function hasMealFilter() {
    return normalizeMealFilterValue(state.selectedMeal) !== 'all';
}

function hasDateFilter() {
    return Boolean(state.selectedDateStart || state.selectedDateEnd);
}

function buildStarBarsSafe(distribution) {
    const safeDistribution = distribution && typeof distribution === 'object'
        ? distribution
        : { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    const values = Object.values(safeDistribution);
    const max = Math.max(...values, 1);

    return Object.entries(safeDistribution).map(([star, count]) => `
        <div class="bar-row">
            <span class="bar-label">${star} estrela${star === '1' ? '' : 's'}</span>
            <div class="bar-track">
                <div class="bar-fill" style="width: ${(count / max) * 100}%"></div>
            </div>
            <strong>${count}</strong>
        </div>
    `).join('');
}

function buildQuestionAveragesSafe(questionAverages) {
    const entries = Object.entries(questionAverages || {});
    if (!entries.length) {
        return `<div class="empty-state chart-empty">Sem dados por pergunta.</div>`;
    }

    return entries.map(([question, average]) => `
        <div class="metric-item">
            <span>${formatQuestionLabel(question)}</span>
            <strong>${formatNumber(average)}</strong>
        </div>
    `).join('');
}

function buildQuestionDistributionsSafe(questionDistributions) {
    const entries = Object.entries(questionDistributions || {});
    if (!entries.length) {
        return `<div class="empty-state chart-empty">Sem distribuicao por pergunta.</div>`;
    }

    return entries.map(([question, distribution]) => `
        <article class="question-card">
            <h3>${formatQuestionLabel(question)}</h3>
            <div class="bars compact">
                ${buildStarBarsSafe(distribution)}
            </div>
        </article>
    `).join('');
}

function formatSignedNumber(value) {
    const numeric = Number(value || 0);
    const sign = numeric > 0 ? '+' : '';
    return `${sign}${numeric.toFixed(1)}`;
}

function formatDayKey(dayKey) {
    const parts = String(dayKey).split('-').map(Number);
    if (parts.length !== 3 || parts.some((value) => Number.isNaN(value))) {
        return dayKey;
    }
    return new Date(parts[0], parts[1] - 1, parts[2]).toLocaleDateString('pt-BR');
}

function buildReports() {
    const period = state.reportPeriod || 'overall';
    const report = getReportData(period);

    return `
        <section class="panel-card">
            <div class="panel-head">
                <h2>Relatorio por periodo</h2>
                <span>Geral, ultimos 2 meses, 6 meses e 12 meses</span>
            </div>
            <div class="report-actions">
                <div class="report-controls">
                    <button class="report-period-btn ${period === 'overall' ? 'active' : ''}" data-period="overall">Geral</button>
                    <button class="report-period-btn ${period === '2m' ? 'active' : ''}" data-period="2m">2 meses</button>
                    <button class="report-period-btn ${period === '6m' ? 'active' : ''}" data-period="6m">6 meses</button>
                    <button class="report-period-btn ${period === '12m' ? 'active' : ''}" data-period="12m">12 meses</button>
                </div>
                <div class="report-export">
                    <button class="report-export-btn" data-export="pdf">Exportar PDF</button>
                    <button class="report-export-btn" data-export="excel">Exportar Excel</button>
                </div>
            </div>
            <div id="report-content">
                ${buildReportContent(report)}
            </div>
        </section>
    `;
}

function bindReportControls() {
    const buttons = document.querySelectorAll('.report-period-btn');
    const content = document.getElementById('report-content');
    if (buttons.length && content) {
        buttons.forEach((button) => {
            button.addEventListener('click', () => {
                state.reportPeriod = button.dataset.period || 'overall';
                buttons.forEach((item) => item.classList.toggle('active', item === button));
                const report = getReportData(state.reportPeriod);
                content.innerHTML = buildReportContent(report);
            });
        });
    }

    document.querySelectorAll('.report-export-btn[data-export]').forEach((button) => {
        button.addEventListener('click', () => exportReport(button.dataset.export));
    });
}

function buildDashboard() {
    const answers = getFilteredAnswers();
    const summary = getFilteredSummary(answers);
    const indexes = calculateDashboardIndexes(summary, answers);

    return `
        <section class="stats-grid dashboard-indices-grid">
            <article class="stat-card">
                <span class="stat-label">NPS medio</span>
                <strong class="stat-value">${formatSignedNumber(indexes.nps)}</strong>
            </article>
            <article class="stat-card">
                <span class="stat-label">Media de satisfacao</span>
                <strong class="stat-value">${formatNumber(indexes.satisfactionAverage)} / 5</strong>
            </article>
            <article class="stat-card">
                <span class="stat-label">Total de respostas</span>
                <strong class="stat-value">${indexes.totalResponses}</strong>
            </article>
            <article class="stat-card">
                <span class="stat-label">Numero de clientes</span>
                <strong class="stat-value">${indexes.totalClients}</strong>
            </article>
            <article class="stat-card">
                <span class="stat-label">Numero de cupons emitidos</span>
                <strong class="stat-value">${indexes.totalCoupons}</strong>
            </article>
        </section>

        <section class="panel-card">
            <div class="panel-head trend-head">
                <div>
                    <h2>Evolucao da nota media</h2>
                    <span>Linha de 0 a 5 da primeira ate a ultima avaliacao</span>
                </div>
                <div class="summary-tags">
                    <span class="summary-tag">Total: ${summary.totalAnswers || 0}</span>
                    <span class="summary-tag summary-tag-good">Boas: ${summary.goodAnswers || 0}</span>
                    <span class="summary-tag summary-tag-bad">Ruins/Regulares: ${summary.badAnswers || 0}</span>
                </div>
            </div>
            <div class="trend-layout">
                <div class="line-chart-wrap">
                    ${buildAverageLineChart(summary.averageTimeline)}
                </div>
                <aside class="ranking-panel">
                    <h3>Ranking de garcons</h3>
                    <p>Considera apenas avaliacoes com nome do atendente.</p>
                    ${buildWaiterRanking(summary.waiterRanking)}
                </aside>
            </div>
        </section>

        <section class="panel-grid dashboard-new-charts">
            <article class="panel-card">
                <div class="panel-head">
                    <h2>Evolucao do numero de avaliacoes</h2>
                    <span>Total por dia com base nas respostas recebidas</span>
                </div>
                <div class="line-chart-wrap">
                    ${buildAnswerVolumeLineChart(answers)}
                </div>
            </article>

            <article class="panel-card">
                <div class="panel-head">
                    <h2>Percentual de avaliacoes por periodo</h2>
                    <span>Distribuicao entre Almoco, Happy Hour e Jantar</span>
                </div>
                ${buildPeriodPercentChart(answers)}
            </article>
        </section>

        ${isAdminUser() ? buildAdminRestaurantComparison(getAdminComparisonAnswers()) : ''}
    `;
}

function buildMetrics() {
    const summary = getFilteredSummary(getFilteredAnswers());
    const answers = getFilteredAnswers();
    if (!answers.length) {
        return buildEmptyState('Sem dados para calcular metricas.');
    }

    const total = answers.length;
    const good = answers.filter((answer) => answer.classification === 'boa').length;
    const withComment = answers.filter((answer) => String(answer.comment || '').trim()).length;
    const withWaiter = answers.filter((answer) => String(answer.waiterName || '').trim()).length;
    const atendimentoAverage = calculateAverageFromAnswers(answers, 'atendimentoEquipe');
    const comidaAverage = calculateAverageFromAnswers(answers, 'qualidadeComida');
    const esperaAverage = calculateAverageFromAnswers(answers, 'tempoEspera');

    return `
        <section class="stats-grid metrics-grid">
            <article class="stat-card">
                <span class="stat-label">Taxa de avaliacoes boas</span>
                <strong class="stat-value">${formatPercent(good / total)}</strong>
            </article>
            <article class="stat-card">
                <span class="stat-label">Clientes que comentaram</span>
                <strong class="stat-value">${formatPercent(withComment / total)}</strong>
            </article>
            <article class="stat-card">
                <span class="stat-label">Atendimento da equipe (media)</span>
                <strong class="stat-value">${formatNumber(atendimentoAverage)}</strong>
            </article>
            <article class="stat-card">
                <span class="stat-label">Avaliacoes com garcom identificado</span>
                <strong class="stat-value">${formatPercent(withWaiter / total)}</strong>
            </article>
        </section>

        <section class="panel-card">
            <div class="panel-head">
                <h2>Comparativo das perguntas</h2>
                <span>Media por criterio no periodo geral</span>
            </div>
            <div class="metric-list">
                <div class="metric-item">
                    <span>Qualidade da comida</span>
                    <strong>${formatNumber(comidaAverage)}</strong>
                </div>
                <div class="metric-item">
                    <span>Atendimento da equipe</span>
                    <strong>${formatNumber(atendimentoAverage)}</strong>
                </div>
                <div class="metric-item">
                    <span>Tempo de espera</span>
                    <strong>${formatNumber(esperaAverage)}</strong>
                </div>
            </div>
        </section>

        <section class="panel-grid">
            <article class="panel-card">
                <div class="panel-head">
                    <h2>Distribuicao geral</h2>
                    <span>Quantidade por estrela</span>
                </div>
                <div class="bars">
                    ${buildStarBarsSafe(summary.overallDistribution)}
                </div>
            </article>

            <article class="panel-card">
                <div class="panel-head">
                    <h2>Medias por pergunta</h2>
                    <span>Visao das notas por criterio</span>
                </div>
                <div class="metric-list">
                    ${buildQuestionAveragesSafe(summary.questionAverages)}
                </div>
            </article>
        </section>

        <section class="panel-card">
            <div class="panel-head">
                <h2>Distribuicao por pergunta</h2>
                <span>Leitura detalhada do desempenho em cada ponto avaliado</span>
            </div>
            <div class="question-grid">
                ${buildQuestionDistributionsSafe(summary.questionDistributions)}
            </div>
        </section>
    `;
}

function buildAnswers() {
    const answers = getFilteredAnswers();
    if (!answers.length) {
        return buildEmptyState('Nenhuma avaliacao recebida nesse filtro.');
    }

    return `
        <section class="table-card">
            <div class="answers-list">
                ${answers.map((answer) => `
                    <article class="answer-card">
                        <div class="answer-top">
                            <div>
                                <h3>${escapeHtml(answer.name)}</h3>
                                <p>${formatDate(answer.createdAt)}</p>
                            </div>
                            <span class="badge badge-${answer.classification}">${answer.classification}</span>
                        </div>
                        <div class="answer-meta">
                            <span>Telefone: ${escapeHtml(answer.phone)}</span>
                            <span>Media: ${formatNumber(answer.averageScore)}</span>
                            <span>Unidade: ${escapeHtml(resolveUnitName(answer))}</span>
                            ${answer.waiterName ? `<span>Garcom: ${escapeHtml(answer.waiterName)} (${answer.waiterServiceScore ?? answer.answers.atendimentoEquipe ?? '-'} estrelas)</span>` : ''}
                        </div>
                        <div class="chips">
                            ${Object.entries(answer.answers || {}).map(([question, score]) => `
                                <span class="chip">${formatQuestionLabel(question)}: ${score}</span>
                            `).join('')}
                        </div>
                        <p class="answer-comment">${answer.comment ? escapeHtml(answer.comment) : 'Sem comentario informado.'}</p>
                        <div class="answer-actions">
                            <a class="whatsapp-button" href="${buildWhatsAppLink(answer)}" target="_blank" rel="noopener noreferrer" aria-label="Conversar no WhatsApp">
                                <img class="whatsapp-button-icon" src="./icon-whatsapp.png" alt="WhatsApp">
                            </a>
                        </div>
                    </article>
                `).join('')}
            </div>
        </section>
    `;
}

function buildComments() {
    const comments = getFilteredComments();
    if (!comments.length) {
        return buildEmptyState('Nenhum comentario encontrado nesse filtro.');
    }

    return `
        <section class="comments-grid">
            ${comments.map((comment) => `
                <article class="comment-card">
                    <div class="comment-head">
                        <div>
                            <h3>${escapeHtml(comment.name)}</h3>
                            <p>${formatDate(comment.createdAt)}</p>
                        </div>
                        <span class="badge badge-${comment.classification}">${comment.classification}</span>
                    </div>
                    <p class="comment-text">${escapeHtml(comment.comment)}</p>
                    <span class="comment-score">Media da avaliacao: ${formatNumber(comment.averageScore)}</span>
                </article>
            `).join('')}
        </section>
    `;
}

function getReportData(period) {
    const filtered = filterAnswersByPeriod(period);
    if (!filtered.length) {
        return {
            averageScore: 0,
            totalAnswers: 0,
            strength: 'Sem avaliacoes suficientes nesse periodo.',
            improvement: 'Sem avaliacoes suficientes nesse periodo.'
        };
    }

    const labels = {
        qualidadeComida: 'qualidade da comida',
        atendimentoEquipe: 'atendimento da equipe',
        tempoEspera: 'tempo de espera'
    };

    const questionScores = Object.keys(labels).map((key) => ({
        key,
        average: calculateAverageFromAnswers(filtered, key)
    }));

    questionScores.sort((a, b) => b.average - a.average);
    const best = questionScores[0];
    const worst = questionScores[questionScores.length - 1];

    return {
        averageScore: filtered.reduce((sum, answer) => sum + Number(answer.averageScore || 0), 0) / filtered.length,
        totalAnswers: filtered.length,
        strength: `Melhor resultado: ${labels[best.key]} com media ${formatNumber(best.average)}.`,
        improvement: `Prioridade de melhoria: ${labels[worst.key]} com media ${formatNumber(worst.average)}.`
    };
}

function filterAnswersByPeriod(period) {
    const answers = getFilteredAnswers();
    if (period === 'overall') {
        return answers;
    }

    const months = period === '2m' ? 2 : period === '6m' ? 6 : 12;
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - months);
    return answers.filter((answer) => new Date(answer.createdAt) >= cutoff);
}

function exportReport(format) {
    const period = state.reportPeriod || 'overall';
    const report = getReportData(period);
    const answers = filterAnswersByPeriod(period);

    if (!answers.length) {
        alert('Nao ha dados para exportar nesse filtro.');
        return;
    }

    if (format === 'excel') {
        exportReportAsExcel(period, report, answers);
        return;
    }

    exportReportAsPdf(period, report, answers);
}

function exportReportAsExcel(period, report, answers) {
    const restaurantLabel = getSelectedRestaurantLabel();
    const unitLabel = isAllUnitsSelected() ? 'Todas as unidades' : state.selectedUnit;
    const lines = [
        ['Relatorio', getPeriodLabel(period)],
        ['Restaurante', restaurantLabel],
        ['Unidade', unitLabel],
        ['Media do periodo', formatNumber(report.averageScore)],
        ['Total de avaliacoes', report.totalAnswers],
        ['']
    ];

    const header = ['Nome', 'Telefone', 'Unidade', 'Classificacao', 'Media', 'Data', 'Garcom', 'Nota Garcom', 'Comentario'];
    lines.push(header);
    answers.forEach((answer) => {
        lines.push([
            answer.name || '',
            answer.phone || '',
            resolveUnitName(answer),
            answer.classification || '',
            formatNumber(answer.averageScore),
            formatDate(answer.createdAt),
            answer.waiterName || '',
            answer.waiterServiceScore ?? '',
            (answer.comment || '').replaceAll('\n', ' ')
        ]);
    });

    const csv = `\uFEFF${lines.map((line) => line.map(csvEscape).join(';')).join('\r\n')}`;
    const fileName = `relatorio_${period}_${slugifyValue(unitLabel)}.csv`;
    downloadFile(csv, fileName, 'text/csv;charset=utf-8');
}

function exportReportAsPdf(period, report, answers) {
    const restaurantLabel = getSelectedRestaurantLabel();
    const unitLabel = isAllUnitsSelected() ? 'Todas as unidades' : state.selectedUnit;
    const fileName = `relatorio_${period}_${slugifyValue(unitLabel)}.pdf`;

    if (window.jspdf && window.jspdf.jsPDF) {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        let y = 14;

        doc.setFontSize(14);
        doc.text('Relatorio de Avaliacoes', 14, y);
        y += 8;
        doc.setFontSize(10);
        doc.text(`Periodo: ${getPeriodLabel(period)}`, 14, y);
        y += 6;
        doc.text(`Restaurante: ${restaurantLabel}`, 14, y);
        y += 6;
        doc.text(`Unidade: ${unitLabel}`, 14, y);
        y += 6;
        doc.text(`Media: ${formatNumber(report.averageScore)} | Total: ${report.totalAnswers}`, 14, y);
        y += 8;

        doc.setFontSize(9);
        answers.forEach((answer) => {
            if (y > 280) {
                doc.addPage();
                y = 14;
            }
            const line = `${formatDateShort(answer.createdAt)} | ${answer.name || '-'} | ${resolveUnitName(answer)} | ${answer.classification || '-'} | ${formatNumber(answer.averageScore)}`;
            doc.text(line.slice(0, 120), 14, y);
            y += 5;
        });

        doc.save(fileName);
        return;
    }

    openPrintableReport(period, report, answers, unitLabel, restaurantLabel);
}

function openPrintableReport(period, report, answers, unitLabel, restaurantLabel) {
    const printable = window.open('', '_blank');
    if (!printable) {
        alert('Nao foi possivel abrir a janela de impressao.');
        return;
    }

    const rows = answers.map((answer) => `
        <tr>
            <td>${escapeHtml(formatDateShort(answer.createdAt))}</td>
            <td>${escapeHtml(answer.name || '-')}</td>
            <td>${escapeHtml(resolveUnitName(answer))}</td>
            <td>${escapeHtml(answer.classification || '-')}</td>
            <td>${escapeHtml(formatNumber(answer.averageScore))}</td>
        </tr>
    `).join('');

    printable.document.write(`
        <html>
        <head>
            <title>Relatorio</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 20px; color: #111; }
                table { width: 100%; border-collapse: collapse; margin-top: 12px; }
                th, td { border: 1px solid #ddd; padding: 6px 8px; font-size: 12px; }
                th { background: #f5f5f5; text-align: left; }
            </style>
        </head>
        <body>
            <h2>Relatorio de Avaliacoes</h2>
            <p>Periodo: ${escapeHtml(getPeriodLabel(period))}</p>
            <p>Restaurante: ${escapeHtml(restaurantLabel)}</p>
            <p>Unidade: ${escapeHtml(unitLabel)}</p>
            <p>Media: ${escapeHtml(formatNumber(report.averageScore))} | Total: ${escapeHtml(String(report.totalAnswers))}</p>
            <table>
                <thead>
                    <tr><th>Data</th><th>Cliente</th><th>Unidade</th><th>Classificacao</th><th>Media</th></tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        </body>
        </html>
    `);
    printable.document.close();
    printable.focus();
    printable.print();
}

function getAdminComparisonAnswers() {
    const answers = getRestaurantScopedAnswers();
    return answers.filter((answer) => {
        if (!isAllUnitsSelected() && resolveUnitName(answer) !== state.selectedUnit) {
            return false;
        }
        return matchesDateFilter(answer) && matchesMealFilter(answer);
    });
}

function getFilteredAnswers() {
    const allAnswers = getRestaurantScopedAnswers();
    return allAnswers.filter((answer) => {
        if (!isAllUnitsSelected() && resolveUnitName(answer) !== state.selectedUnit) {
            return false;
        }

        if (!matchesDateFilter(answer)) {
            return false;
        }

        return matchesMealFilter(answer);
    });
}

function getFilteredComments() {
    const comments = state.comments || [];
    const filteredAnswerIds = new Set(getFilteredAnswers().map((answer) => String(answer.id)));
    const unitById = new Map((state.answers || []).map((answer) => [String(answer.id), resolveUnitName(answer)]));
    return comments.filter((comment) => {
        if (filteredAnswerIds.has(String(comment.id))) {
            return true;
        }

        if (!isAllRestaurantsSelected() && resolveRestaurantName(comment) !== state.selectedRestaurant) {
            return false;
        }

        if (!matchesDateFilter(comment) || !matchesMealFilter(comment)) {
            return false;
        }

        const fromAnswer = unitById.get(String(comment.id));
        if (fromAnswer) {
            return isAllUnitsSelected() || fromAnswer === state.selectedUnit;
        }
        return isAllUnitsSelected() || resolveUnitName(comment) === state.selectedUnit;
    });
}

function getFilteredSummary(answers) {
    if (isAllUnitsSelected() && isAllRestaurantsSelected() && !hasDateFilter() && !hasMealFilter() && state.summary) {
        return state.summary;
    }
    return buildSummaryFromAnswers(answers);
}

function getRestaurantScopedAnswers() {
    const allAnswers = state.answers || [];
    if (isAdminUser()) {
        if (isAllRestaurantsSelected()) {
            return allAnswers;
        }
        return allAnswers.filter((answer) => resolveRestaurantName(answer) === state.selectedRestaurant);
    }

    const restaurantName = resolveCurrentRestaurantName();
    return allAnswers.filter((answer) => resolveRestaurantName(answer) === restaurantName);
}

function buildSummaryFromAnswers(answers) {
    const overallDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    const classificationTotals = { ruim: 0, regular: 0, boa: 0 };
    const questionBuckets = new Map();
    const questionDistributions = {};
    const ordered = [...answers].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    const averageTimeline = [];

    ordered.forEach((answer) => {
        const explicitAverage = Number(answer.averageScore);
        const answerScores = Object.values(answer.answers || {})
            .map((value) => Number(value))
            .filter((value) => !Number.isNaN(value));
        const derivedAverage = answerScores.length
            ? answerScores.reduce((sum, value) => sum + value, 0) / answerScores.length
            : 0;
        const safeAverage = Number.isNaN(explicitAverage) ? derivedAverage : explicitAverage;
        const rounded = Math.max(1, Math.min(5, Math.round(safeAverage)));
        overallDistribution[rounded] += 1;
        averageTimeline.push({ createdAt: answer.createdAt, averageScore: safeAverage });

        const classification = String(answer.classification || classifyAverage(safeAverage)).toLowerCase();
        if (!classificationTotals[classification]) {
            classificationTotals[classification] = 0;
        }
        classificationTotals[classification] += 1;

        Object.entries(answer.answers || {}).forEach(([question, score]) => {
            const numeric = Number(score);
            if (Number.isNaN(numeric)) {
                return;
            }
            if (!questionBuckets.has(question)) {
                questionBuckets.set(question, []);
                questionDistributions[question] = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
            }
            questionBuckets.get(question).push(numeric);
            const star = Math.max(1, Math.min(5, Math.round(numeric)));
            questionDistributions[question][star] += 1;
        });
    });

    const questionAverages = {};
    questionBuckets.forEach((scores, question) => {
        const total = scores.reduce((sum, value) => sum + value, 0);
        questionAverages[question] = scores.length ? roundTo2(total / scores.length) : 0;
    });

    const overallAverage = ordered.length
        ? roundTo2(ordered.reduce((sum, answer) => sum + Number(answer.averageScore || 0), 0) / ordered.length)
        : 0;

    return {
        totalAnswers: ordered.length,
        overallAverage,
        goodAnswers: classificationTotals.boa || 0,
        badAnswers: (classificationTotals.ruim || 0) + (classificationTotals.regular || 0),
        overallDistribution,
        questionAverages,
        questionDistributions,
        classificationTotals,
        averageTimeline,
        waiterRanking: buildWaiterRankingFromAnswers(ordered)
    };
}

function buildWaiterRankingFromAnswers(answers) {
    const map = new Map();
    answers.forEach((answer) => {
        const waiterName = String(answer.waiterName || '').trim();
        if (!waiterName) {
            return;
        }

        const rawScore = answer.waiterServiceScore ?? answer.answers?.atendimentoEquipe;
        const score = Number(rawScore);
        if (Number.isNaN(score)) {
            return;
        }

        const entry = map.get(waiterName) || { total: 0, count: 0 };
        entry.total += score;
        entry.count += 1;
        map.set(waiterName, entry);
    });

    return [...map.entries()]
        .map(([waiterName, acc]) => ({
            waiterName,
            averageScore: acc.count ? roundTo2(acc.total / acc.count) : 0,
            totalEvaluations: acc.count
        }))
        .sort((a, b) => {
            if (b.averageScore !== a.averageScore) return b.averageScore - a.averageScore;
            if (b.totalEvaluations !== a.totalEvaluations) return b.totalEvaluations - a.totalEvaluations;
            return a.waiterName.localeCompare(b.waiterName, 'pt-BR');
        });
}

function getUnitOptionsFromAnswers() {
    const units = [...new Set((state.answers || []).map((answer) => resolveUnitName(answer)).filter(Boolean))];
    if (!units.length) {
        return ['Unidade principal'];
    }
    return units.sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

function resolveUnitName(item) {
    const candidates = [
        item?.unitName,
        item?.unit,
        item?.unidade,
        item?.storeName,
        item?.branchName,
        item?.placeName,
        item?.establishmentName,
        item?.localName
    ];
    const value = candidates.find((candidate) => typeof candidate === 'string' && candidate.trim());
    return value ? value.trim() : 'Unidade principal';
}

function isAllUnitsSelected() {
    return !state.selectedUnit || state.selectedUnit === 'all';
}

function isAllRestaurantsSelected() {
    if (!isAdminUser()) {
        return false;
    }
    return !state.selectedRestaurant || state.selectedRestaurant === 'all';
}

function getSelectedRestaurantLabel() {
    if (isAdminUser()) {
        return isAllRestaurantsSelected() ? 'Todos os restaurantes' : state.selectedRestaurant;
    }
    return resolveCurrentRestaurantName();
}

function classifyAverage(value) {
    if (value < 3) return 'ruim';
    if (value < 4) return 'regular';
    return 'boa';
}

function roundTo2(value) {
    return Number(value || 0).toFixed(2) * 1;
}

function getPeriodLabel(period) {
    if (period === '2m') return 'Ultimos 2 meses';
    if (period === '6m') return 'Ultimos 6 meses';
    if (period === '12m') return 'Ultimos 12 meses';
    return 'Geral';
}

function csvEscape(value) {
    const text = String(value ?? '');
    if (!/[;"\n\r]/.test(text)) {
        return text;
    }
    return `"${text.replaceAll('"', '""')}"`;
}

function slugifyValue(value) {
    return String(value || 'all')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .toLowerCase();
}

function downloadFile(content, fileName, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}

function escapeHtml(value) {
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

function renderSection(section) {
    state.section = section;
    const title = document.getElementById('page-title');
    const subtitle = document.getElementById('page-subtitle');
    const content = document.getElementById('content');

    if (!state.summary && !state.answers?.length) {
        renderError('Nao foi possivel carregar os dados do painel.');
        return;
    }

    if (section === 'dashboard') {
        title.textContent = 'Dashboard';
        subtitle.textContent = 'Resumo das avaliacoes recebidas.';
        content.innerHTML = buildDashboard();
        bindAdminComparisonControls();
        return;
    }

    if (section === 'answers') {
        title.textContent = 'Respostas';
        subtitle.textContent = 'Historico de avaliacoes com contato rapido por WhatsApp.';
        content.innerHTML = buildAnswers();
        return;
    }

    if (section === 'comments') {
        title.textContent = 'Comentarios';
        subtitle.textContent = 'Feedbacks textuais enviados pelos clientes.';
        content.innerHTML = buildComments();
        return;
    }

    if (section === 'reports') {
        title.textContent = 'Relatorios';
        subtitle.textContent = 'Comparativo por periodo com pontos fortes e melhorias.';
        content.innerHTML = buildReports();
        bindReportControls();
        return;
    }

    if (section === 'clients') {
        title.textContent = 'Clientes';
        subtitle.textContent = 'Visao geral de clientes, engajamento e historico individual.';
        content.innerHTML = buildClientsSection();
        bindClientActions();
        return;
    }

    if (section === 'places') {
        title.textContent = 'Estabelecimentos';
        subtitle.textContent = 'Gestao de cadastro de estabelecimentos.';
        content.innerHTML = buildRegisterPlaceholder('estabelecimentos');
        return;
    }

    if (section === 'users') {
        title.textContent = 'Usuarios';
        subtitle.textContent = 'Gestao de cadastro de usuarios.';
        content.innerHTML = buildRegisterPlaceholder('usuarios');
        return;
    }

    title.textContent = 'Metricas';
    subtitle.textContent = 'Metricas interessantes para acompanhar a operacao.';
    content.innerHTML = buildMetrics();
}

function buildClientsSection() {
    const answers = getFilteredAnswers();
    const clients = buildClientProfiles(answers);
    if (!clients.length) {
        return buildEmptyState('Nenhum cliente encontrado com o filtro selecionado.');
    }

    const now = new Date();
    const totalClients = clients.length;
    const engagedClients = clients.filter((client) => client.currentMonthEvaluations > 3).length;
    const inactiveClients = clients.filter((client) => client.currentMonthEvaluations === 1).length;
    const birthdaysThisMonth = clients.filter((client) => isBirthdayInMonth(client.birthDate, now.getMonth())).length;

    const ageCounts = countBy(clients, (client) => resolveAgeRange(client.age));
    const genderCounts = countBy(clients, (client) => client.genderLabel);
    const satisfactionCounts = countBy(clients, (client) => resolveSatisfactionBucket(client.averageScore));
    const byPeriod = getClientsByPeriodSeries(answers);
    const byWeekday = getClientsByWeekdaySeries(answers);

    const selectedClient = state.selectedClientKey
        ? clients.find((client) => client.key === state.selectedClientKey)
        : null;

    return `
        <section class="stats-grid dashboard-indices-grid">
            <article class="stat-card">
                <span class="stat-label">Total de clientes cadastrados</span>
                <strong class="stat-value">${totalClients}</strong>
            </article>
            <article class="stat-card">
                <span class="stat-label">Clientes engajados (+3 avaliacoes no mes)</span>
                <strong class="stat-value">${engagedClients}</strong>
            </article>
            <article class="stat-card">
                <span class="stat-label">Clientes inativos (1 avaliacao no mes)</span>
                <strong class="stat-value">${inactiveClients}</strong>
            </article>
            <article class="stat-card">
                <span class="stat-label">Aniversariantes do mes</span>
                <strong class="stat-value">${birthdaysThisMonth}</strong>
            </article>
        </section>

        <section class="panel-grid client-charts-grid">
            <article class="panel-card">
                <div class="panel-head">
                    <h2>Perfil de clientes por faixa etaria</h2>
                </div>
                ${buildGenericBarChart(ageCounts, 'Sem dados de idade.')}
            </article>
            <article class="panel-card">
                <div class="panel-head">
                    <h2>Perfil de clientes por genero</h2>
                </div>
                ${buildGenericBarChart(genderCounts, 'Sem dados de genero.')}
            </article>
        </section>

        <section class="panel-grid client-charts-grid">
            <article class="panel-card">
                <div class="panel-head">
                    <h2>Percentual de clientes por media de satisfacao</h2>
                </div>
                ${buildGenericBarChart(satisfactionCounts, 'Sem dados de satisfacao.', true)}
            </article>
            <article class="panel-card">
                <div class="panel-head">
                    <h2>Clientes por periodo</h2>
                </div>
                ${buildGenericBarChart(byPeriod, 'Sem dados por periodo.')}
            </article>
        </section>

        <section class="panel-card">
            <div class="panel-head">
                <h2>Clientes por dias da semana</h2>
            </div>
            ${buildGenericBarChart(byWeekday, 'Sem dados por dia da semana.')}
        </section>

        <section class="panel-card">
            <div class="panel-head">
                <h2>Historico de clientes</h2>
                <span>Clique em "Historico" para abrir o painel individual</span>
            </div>
            <div class="client-list">
                ${clients.map((client) => `
                    <article class="client-item">
                        <div class="client-item-main">
                            <h3>${escapeHtml(client.name)}</h3>
                            <p>Telefone: ${escapeHtml(client.phone || 'Nao informado')}</p>
                            <p>Avaliacao media: ${formatNumber(client.averageScore)} | Total de avaliacoes: ${client.totalEvaluations}</p>
                        </div>
                        <button class="client-history-btn" data-client-key="${encodeURIComponent(client.key)}">Historico</button>
                    </article>
                `).join('')}
            </div>
        </section>

        ${selectedClient ? buildClientDetailPanel(selectedClient) : ''}
    `;
}

function bindClientActions() {
    document.querySelectorAll('.client-history-btn[data-client-key]').forEach((button) => {
        button.addEventListener('click', () => {
            const encodedKey = String(button.dataset.clientKey || '');
            try {
                state.selectedClientKey = encodedKey ? decodeURIComponent(encodedKey) : null;
            } catch (_error) {
                state.selectedClientKey = encodedKey || null;
            }
            renderSection('clients');
        });
    });

    const closeButton = document.querySelector('.client-detail-close');
    if (closeButton) {
        closeButton.addEventListener('click', () => {
            state.selectedClientKey = null;
            renderSection('clients');
        });
    }
}

function buildClientDetailPanel(client) {
    const categoryCounts = countBy(client.answers, (answer) => resolveOrderCategory(answer));
    const periodCounts = getClientPeriodSeries(client.answers);
    const comments = client.comments;

    return `
        <section class="panel-card client-detail-panel">
            <div class="client-detail-head">
                <div>
                    <h2>Painel individual do cliente</h2>
                    <span>${escapeHtml(client.name)} | ${escapeHtml(client.phone || 'Sem telefone')}</span>
                </div>
                <button class="client-detail-close">Fechar</button>
            </div>

            <div class="stats-grid metrics-grid client-detail-stats">
                <article class="stat-card">
                    <span class="stat-label">Numero total de avaliacoes</span>
                    <strong class="stat-value">${client.totalEvaluations}</strong>
                </article>
                <article class="stat-card">
                    <span class="stat-label">Media de satisfacao geral</span>
                    <strong class="stat-value">${formatNumber(client.averageScore)}</strong>
                </article>
            </div>

            <section class="panel-grid client-detail-grid">
                <article class="panel-card">
                    <div class="panel-head">
                        <h2>Media de satisfacao por pergunta</h2>
                    </div>
                    <div class="metric-list">
                        ${Object.entries(client.questionAverages).map(([question, score]) => `
                            <div class="metric-item">
                                <span>${formatQuestionLabel(question)}</span>
                                <strong>${formatNumber(score)}</strong>
                            </div>
                        `).join('')}
                    </div>
                </article>

                <article class="panel-card">
                    <div class="panel-head">
                        <h2>Avaliacoes por periodo</h2>
                    </div>
                    ${buildGenericBarChart(periodCounts, 'Sem dados por periodo.')}
                </article>
            </section>

            <section class="panel-grid client-detail-grid">
                <article class="panel-card">
                    <div class="panel-head">
                        <h2>Percentual por categoria de pedido</h2>
                    </div>
                    ${buildGenericBarChart(categoryCounts, 'Sem categorias de pedido.', true)}
                </article>

                <article class="panel-card">
                    <div class="panel-head">
                        <h2>Comentarios e sugestoes</h2>
                    </div>
                    ${buildClientComments(comments)}
                </article>
            </section>

            <article class="panel-card">
                <div class="panel-head">
                    <h2>Historico de relacionamento</h2>
                    <span>Datas de avaliacoes, mensagens e cupons quando disponiveis</span>
                </div>
                ${buildClientTimeline(client.history)}
            </article>
        </section>
    `;
}

function buildClientProfiles(answers) {
    const grouped = new Map();

    answers.forEach((answer) => {
        const key = getClientKeyFromAnswer(answer);
        const entry = grouped.get(key) || {
            key,
            name: answer.name || 'Cliente sem nome',
            phone: answer.phone || '',
            genderLabel: 'Nao informado',
            age: null,
            birthDate: null,
            answers: []
        };

        entry.answers.push(answer);

        if (!entry.name && answer.name) {
            entry.name = answer.name;
        }
        if (!entry.phone && answer.phone) {
            entry.phone = answer.phone;
        }

        const gender = normalizeGender(resolveRawGender(answer));
        if (entry.genderLabel === 'Nao informado' && gender !== 'Nao informado') {
            entry.genderLabel = gender;
        }

        if (!entry.birthDate) {
            entry.birthDate = resolveBirthDate(answer);
        }
        if (entry.age == null) {
            entry.age = resolveAge(answer);
        }

        grouped.set(key, entry);
    });

    const now = new Date();
    return [...grouped.values()]
        .map((client) => {
            const sortedAnswers = [...client.answers].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            const scores = sortedAnswers.map((answer) => Number(answer.averageScore || 0)).filter((score) => !Number.isNaN(score));
            const averageScore = scores.length ? scores.reduce((sum, value) => sum + value, 0) / scores.length : 0;
            const currentMonthEvaluations = sortedAnswers.filter((answer) => isSameMonth(answer.createdAt, now)).length;

            const questionKeys = [...new Set(
                sortedAnswers.flatMap((answer) => Object.keys(answer.answers || {}))
            )];
            const questionAverages = {};
            questionKeys.forEach((question) => {
                const values = sortedAnswers
                    .map((answer) => Number(answer.answers?.[question]))
                    .filter((value) => !Number.isNaN(value));
                questionAverages[question] = values.length
                    ? values.reduce((sum, value) => sum + value, 0) / values.length
                    : 0;
            });

            const comments = sortedAnswers
                .filter((answer) => String(answer.comment || '').trim())
                .map((answer) => ({
                    text: String(answer.comment || '').trim(),
                    createdAt: answer.createdAt
                }));

            const history = buildClientHistory(sortedAnswers);

            return {
                ...client,
                answers: sortedAnswers,
                averageScore: roundTo2(averageScore),
                totalEvaluations: sortedAnswers.length,
                currentMonthEvaluations,
                questionAverages,
                comments,
                history
            };
        })
        .sort((a, b) => b.totalEvaluations - a.totalEvaluations || a.name.localeCompare(b.name, 'pt-BR'));
}

function buildClientHistory(answers) {
    const events = [];

    answers.forEach((answer) => {
        if (answer.createdAt) {
            events.push({
                date: answer.createdAt,
                label: 'Avaliacao respondida',
                detail: `Media ${formatNumber(answer.averageScore)}`
            });
        }

        ['messageSentAt', 'lastMessageAt', 'whatsappSentAt'].forEach((field) => {
            if (answer[field]) {
                events.push({
                    date: answer[field],
                    label: 'Mensagem enviada',
                    detail: 'Contato registrado'
                });
            }
        });

        ['couponRedeemedAt', 'cupomResgatadoEm', 'couponUsedAt'].forEach((field) => {
            if (answer[field]) {
                events.push({
                    date: answer[field],
                    label: 'Cupom resgatado',
                    detail: 'Resgate registrado'
                });
            }
        });
    });

    return events
        .filter((event) => !Number.isNaN(new Date(event.date).getTime()))
        .sort((a, b) => new Date(b.date) - new Date(a.date));
}

function buildClientComments(comments) {
    if (!comments.length) {
        return `<div class="empty-state chart-empty">Sem comentarios para este cliente.</div>`;
    }

    return `
        <div class="client-comments">
            ${comments.map((item) => `
                <article class="client-comment-item">
                    <p>${escapeHtml(item.text)}</p>
                    <span>${formatDate(item.createdAt)}</span>
                </article>
            `).join('')}
        </div>
    `;
}

function buildClientTimeline(events) {
    if (!events.length) {
        return `<div class="empty-state chart-empty">Sem eventos de historico para este cliente.</div>`;
    }

    return `
        <div class="client-timeline">
            ${events.map((event) => `
                <div class="client-timeline-item">
                    <div class="client-timeline-dot"></div>
                    <div class="client-timeline-content">
                        <strong>${escapeHtml(event.label)}</strong>
                        <p>${escapeHtml(event.detail)}</p>
                        <span>${formatDate(event.date)}</span>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

function buildGenericBarChart(countMap, emptyMessage, showPercent = false) {
    const entries = Object.entries(countMap || {}).filter(([, value]) => Number(value) > 0);
    if (!entries.length) {
        return `<div class="empty-state chart-empty">${emptyMessage}</div>`;
    }

    const values = entries.map(([, value]) => Number(value));
    const max = Math.max(...values, 1);
    const total = values.reduce((sum, value) => sum + value, 0);

    return `
        <div class="bars">
            ${entries.map(([label, count]) => {
                const ratio = count / max;
                const percentText = showPercent ? ` (${formatPercent(total ? count / total : 0)})` : '';
                return `
                    <div class="bar-row">
                        <span class="bar-label">${escapeHtml(label)}</span>
                        <div class="bar-track">
                            <div class="bar-fill" style="width: ${ratio * 100}%"></div>
                        </div>
                        <strong>${count}${percentText}</strong>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

function countBy(items, resolver) {
    const counts = {};
    items.forEach((item) => {
        const key = resolver(item) || 'Nao informado';
        counts[key] = (counts[key] || 0) + 1;
    });
    return counts;
}

function getClientsByPeriodSeries(answers) {
    const grouped = {};
    answers.forEach((answer) => {
        const date = new Date(answer.createdAt);
        if (Number.isNaN(date.getTime())) {
            return;
        }
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const clientKey = getClientKeyFromAnswer(answer);
        if (!grouped[monthKey]) {
            grouped[monthKey] = new Set();
        }
        grouped[monthKey].add(clientKey);
    });

    const labels = Object.keys(grouped).sort().slice(-8);
    const output = {};
    labels.forEach((monthKey) => {
        const [year, month] = monthKey.split('-').map(Number);
        const label = new Date(year, month - 1, 1).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
        output[label] = grouped[monthKey].size;
    });
    return output;
}

function getClientsByWeekdaySeries(answers) {
    const weekdayOrder = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];
    const grouped = weekdayOrder.reduce((acc, day) => ({ ...acc, [day]: new Set() }), {});

    answers.forEach((answer) => {
        const date = new Date(answer.createdAt);
        if (Number.isNaN(date.getTime())) {
            return;
        }
        const weekday = weekdayOrder[date.getDay()];
        grouped[weekday].add(getClientKeyFromAnswer(answer));
    });

    const output = {};
    weekdayOrder.forEach((day) => {
        output[day] = grouped[day].size;
    });
    return output;
}

function getClientPeriodSeries(answers) {
    const grouped = {};
    answers.forEach((answer) => {
        const date = new Date(answer.createdAt);
        if (Number.isNaN(date.getTime())) {
            return;
        }
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        grouped[monthKey] = (grouped[monthKey] || 0) + 1;
    });

    const labels = Object.keys(grouped).sort();
    const output = {};
    labels.forEach((monthKey) => {
        const [year, month] = monthKey.split('-').map(Number);
        const label = new Date(year, month - 1, 1).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
        output[label] = grouped[monthKey];
    });
    return output;
}

function getClientKeyFromAnswer(answer) {
    const phoneDigits = String(answer.phone || '').replace(/\D/g, '');
    if (phoneDigits) {
        return `phone:${phoneDigits}`;
    }
    const name = String(answer.name || '').trim().toLowerCase();
    return name ? `name:${name}` : `id:${answer.id || Math.random()}`;
}

function resolveRawGender(answer) {
    const fields = [answer.gender, answer.genero, answer.sex, answer.sexo];
    return fields.find((value) => typeof value === 'string' && value.trim()) || '';
}

function normalizeGender(value) {
    const text = String(value || '').trim().toLowerCase();
    if (!text) return 'Nao informado';
    if (text.startsWith('m')) return 'Masculino';
    if (text.startsWith('f')) return 'Feminino';
    return 'Outro';
}

function resolveAge(answer) {
    const numericAge = Number(answer.age ?? answer.idade);
    if (!Number.isNaN(numericAge) && numericAge > 0) {
        return Math.floor(numericAge);
    }

    const birthDate = resolveBirthDate(answer);
    if (!birthDate) {
        return null;
    }
    const now = new Date();
    let age = now.getFullYear() - birthDate.getFullYear();
    const hasBirthdayPassed = now.getMonth() > birthDate.getMonth()
        || (now.getMonth() === birthDate.getMonth() && now.getDate() >= birthDate.getDate());
    if (!hasBirthdayPassed) {
        age -= 1;
    }
    return age >= 0 ? age : null;
}

function resolveBirthDate(answer) {
    const fields = [answer.birthDate, answer.dateOfBirth, answer.dataNascimento, answer.dob];
    for (const field of fields) {
        if (!field) {
            continue;
        }
        const date = new Date(field);
        if (!Number.isNaN(date.getTime())) {
            return date;
        }
    }
    return null;
}

function isBirthdayInMonth(date, monthIndex) {
    return date instanceof Date && !Number.isNaN(date.getTime()) && date.getMonth() === monthIndex;
}

function resolveAgeRange(age) {
    if (age == null || Number.isNaN(age)) return 'Nao informado';
    if (age < 18) return 'Abaixo de 18';
    if (age <= 24) return '18-24';
    if (age <= 34) return '25-34';
    if (age <= 44) return '35-44';
    if (age <= 59) return '45-59';
    return '60+';
}

function resolveSatisfactionBucket(averageScore) {
    const score = Number(averageScore || 0);
    if (score < 3) return '0.00 - 2.99';
    if (score < 4) return '3.00 - 3.99';
    return '4.00 - 5.00';
}

function resolveOrderCategory(answer) {
    const fields = [
        answer.orderCategory,
        answer.pedidoCategoria,
        answer.categoriaPedido,
        answer.category,
        answer.orderType
    ];
    const value = fields.find((field) => typeof field === 'string' && field.trim());
    if (value) {
        return value.trim();
    }
    return resolveServicePeriod(answer);
}

function isSameMonth(dateInput, referenceDate) {
    const date = new Date(dateInput);
    if (Number.isNaN(date.getTime())) {
        return false;
    }
    return date.getFullYear() === referenceDate.getFullYear()
        && date.getMonth() === referenceDate.getMonth();
}

const SETTINGS_STORAGE_KEY = 'plus-dashboard-settings-v1';
const DEFAULT_SIDEBAR_LOGO = './pluslogo - Copia.svg';
const DEFAULT_USER_PHOTO = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ccircle cx='50' cy='50' r='50' fill='%23e5e7eb'/%3E%3Ccircle cx='50' cy='38' r='18' fill='%239ca3af'/%3E%3Cpath d='M20 84c6-16 18-24 30-24s24 8 30 24' fill='%239ca3af'/%3E%3C/svg%3E";
const PLAN_IDS = ['basico', 'profissional', 'premium'];
const SETTINGS_TABS = ['configuracoes', 'planos', 'questionario', 'cupom'];

function createDefaultSettings() {
    return {
        userPhotoDataUrl: null,
        restaurantName: '',
        restaurantEmail: '',
        ownerName: '',
        phone: '',
        password: '',
        currentPlan: 'basico',
        notifications: {
            enabled: true,
            goodReviews: true,
            regularReviews: true,
            badReviews: true,
            comments: true,
            birthdays: false
        },
        questionnaire: {
            questions: createDefaultQuestionnaireQuestions()
        },
        couponAutomation: {
            whatsappEnabled: false,
            firstEvaluationEnabled: true,
            inactiveClientEnabled: false,
            inactiveDays: 45
        },
        coupons: [],
        units: [
            {
                id: `unit-${Date.now()}`,
                name: 'Unidade principal',
                address: '',
                number: '',
                neighborhood: '',
                city: '',
                state: '',
                zipCode: '',
                manager: '',
                phone: '',
                email: ''
            }
        ]
    };
}

function createDefaultQuestionnaireQuestions() {
    return [
        {
            id: 'question-qualidade-comida',
            key: 'qualidadeComida',
            question: 'Como voce avalia a qualidade da comida?',
            type: 'star',
            optional: false
        },
        {
            id: 'question-atendimento-equipe',
            key: 'atendimentoEquipe',
            question: 'Como voce avalia o atendimento da equipe?',
            type: 'star',
            optional: false
        },
        {
            id: 'question-tempo-espera',
            key: 'tempoEspera',
            question: 'Como voce avalia o tempo de espera pelo pedido?',
            type: 'star',
            optional: false
        }
    ];
}

function normalizeQuestionType(type) {
    return String(type || '').toLowerCase() === 'text' ? 'text' : 'star';
}

function sanitizeQuestionKey(value, fallback = 'pergunta') {
    const normalized = String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9_]+/g, '_')
        .replace(/^_+|_+$/g, '');
    return normalized || fallback;
}

function normalizeQuestionnaireQuestions(questions) {
    const defaults = createDefaultQuestionnaireQuestions();
    const source = Array.isArray(questions) && questions.length ? questions : defaults;
    const normalized = source
        .slice(0, 3)
        .map((question, index) => {
            const defaultQuestion = defaults[index] || defaults[0];
            const text = String(question?.question || '').trim() || defaultQuestion.question;
            const type = normalizeQuestionType(question?.type || defaultQuestion.type);
            const key = sanitizeQuestionKey(question?.key || defaultQuestion.key || `pergunta_${index + 1}`, `pergunta_${index + 1}`);
            return {
                id: String(question?.id || `question-${Date.now()}-${index}`),
                key,
                question: text,
                type,
                optional: Boolean(question?.optional)
            };
        });

    if (!normalized.length) {
        return defaults;
    }

    const hasStarQuestion = normalized.some((question) => question.type === 'star');
    if (!hasStarQuestion) {
        normalized[0].type = 'star';
        normalized[0].optional = false;
    }

    return normalized;
}

function normalizeCoupons(coupons) {
    if (!Array.isArray(coupons)) {
        return [];
    }

    return coupons
        .map((coupon, index) => ({
            id: String(coupon?.id || `coupon-${Date.now()}-${index}`),
            code: String(coupon?.code || '').trim().toUpperCase(),
            title: String(coupon?.title || '').trim(),
            description: String(coupon?.description || '').trim(),
            discount: String(coupon?.discount || '').trim(),
            expiresAt: String(coupon?.expiresAt || '').trim(),
            active: coupon?.active !== false
        }))
        .filter((coupon) => coupon.code);
}

function initializeSettingsState() {
    const defaults = createDefaultSettings();
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) {
        state.settings = defaults;
        hydrateSettingsFromAuthenticatedUser();
        applySettingsBranding();
        return;
    }

    try {
        const parsed = JSON.parse(raw);
        state.settings = normalizeSettings(parsed, defaults);
    } catch (_error) {
        state.settings = defaults;
    }

    hydrateSettingsFromAuthenticatedUser();
    applySettingsBranding();
}

function hydrateSettingsFromAuthenticatedUser() {
    if (!state.settings || !state.currentUser) {
        return;
    }

    if (state.currentUser.role !== 'admin') {
        state.settings.ownerName = state.currentUser.ownerName || state.settings.ownerName;
        state.settings.restaurantName = state.currentUser.restaurantName || state.settings.restaurantName;
        state.settings.restaurantEmail = state.currentUser.email || state.settings.restaurantEmail;
        return;
    }

    if (!state.settings.ownerName && state.currentUser.ownerName) {
        state.settings.ownerName = state.currentUser.ownerName;
    }
    if (!state.settings.restaurantName && state.currentUser.restaurantName) {
        state.settings.restaurantName = state.currentUser.restaurantName;
    }
    if (!state.settings.restaurantEmail && state.currentUser.email) {
        state.settings.restaurantEmail = state.currentUser.email;
    }
}

function normalizeSettings(candidate, defaults) {
    const source = candidate && typeof candidate === 'object' ? candidate : {};
    const notifications = source.notifications && typeof source.notifications === 'object'
        ? source.notifications
        : {};
    const questionnaire = source.questionnaire && typeof source.questionnaire === 'object'
        ? source.questionnaire
        : {};
    const couponAutomation = source.couponAutomation && typeof source.couponAutomation === 'object'
        ? source.couponAutomation
        : {};

    const units = Array.isArray(source.units) ? source.units : defaults.units;
    const normalizedUnits = units
        .map((unit, index) => ({
            id: String(unit?.id || `unit-${Date.now()}-${index}`),
            name: String(unit?.name || '').trim(),
            address: String(unit?.address || '').trim(),
            number: String(unit?.number || '').trim(),
            neighborhood: String(unit?.neighborhood || '').trim(),
            city: String(unit?.city || '').trim(),
            state: String(unit?.state || '').trim(),
            zipCode: String(unit?.zipCode || '').trim(),
            manager: String(unit?.manager || '').trim(),
            phone: String(unit?.phone || '').trim(),
            email: String(unit?.email || '').trim()
        }))
        .filter((unit) => unit.name);

    return {
        userPhotoDataUrl: typeof source.userPhotoDataUrl === 'string' && source.userPhotoDataUrl.trim()
            ? source.userPhotoDataUrl
            : (typeof source.logoDataUrl === 'string' && source.logoDataUrl.trim() ? source.logoDataUrl : null),
        restaurantName: String(source.restaurantName || '').trim(),
        restaurantEmail: String(source.restaurantEmail || '').trim(),
        ownerName: String(source.ownerName || '').trim(),
        phone: String(source.phone || '').trim(),
        password: String(source.password || '').trim(),
        currentPlan: PLAN_IDS.includes(String(source.currentPlan || '').toLowerCase())
            ? String(source.currentPlan).toLowerCase()
            : defaults.currentPlan,
        notifications: {
            enabled: notifications.enabled ?? defaults.notifications.enabled,
            goodReviews: notifications.goodReviews ?? defaults.notifications.goodReviews,
            regularReviews: notifications.regularReviews ?? defaults.notifications.regularReviews,
            badReviews: notifications.badReviews ?? defaults.notifications.badReviews,
            comments: notifications.comments ?? defaults.notifications.comments,
            birthdays: notifications.birthdays ?? defaults.notifications.birthdays
        },
        questionnaire: {
            questions: normalizeQuestionnaireQuestions(questionnaire.questions)
        },
        couponAutomation: {
            whatsappEnabled: couponAutomation.whatsappEnabled ?? defaults.couponAutomation.whatsappEnabled,
            firstEvaluationEnabled: couponAutomation.firstEvaluationEnabled ?? defaults.couponAutomation.firstEvaluationEnabled,
            inactiveClientEnabled: couponAutomation.inactiveClientEnabled ?? defaults.couponAutomation.inactiveClientEnabled,
            inactiveDays: Number.isFinite(Number(couponAutomation.inactiveDays))
                ? Math.max(1, Math.floor(Number(couponAutomation.inactiveDays)))
                : defaults.couponAutomation.inactiveDays
        },
        coupons: normalizeCoupons(source.coupons),
        units: normalizedUnits.length ? normalizedUnits : defaults.units
    };
}

function persistSettings() {
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(state.settings));
}

function applySettingsBranding() {
    const logoElement = document.querySelector('.logo-img');
    if (logoElement) {
        logoElement.src = DEFAULT_SIDEBAR_LOGO;
        logoElement.alt = 'Plus Midia';
    }

    const avatar = document.querySelector('.topbar-avatar');
    if (avatar) {
        const base = state.currentUser?.ownerName
            || state.currentUser?.restaurantName
            || state.settings?.ownerName
            || state.settings?.restaurantName
            || 'U';
        const initial = String(base).trim().charAt(0).toUpperCase() || 'U';
        const userPhoto = state.settings?.userPhotoDataUrl || null;
        if (userPhoto) {
            avatar.classList.add('has-photo');
            avatar.style.backgroundImage = `url('${userPhoto}')`;
            avatar.textContent = '';
        } else {
            avatar.classList.remove('has-photo');
            avatar.style.backgroundImage = '';
            avatar.textContent = initial;
        }
    }
}

function renderSection(section) {
    state.section = section;
    const title = document.getElementById('page-title');
    const subtitle = document.getElementById('page-subtitle');
    const content = document.getElementById('content');

    if (!state.summary && !state.answers?.length) {
        renderError('Nao foi possivel carregar os dados do painel.');
        return;
    }

    if (section === 'dashboard') {
        title.textContent = 'Dashboard';
        subtitle.textContent = 'Resumo das avaliacoes recebidas.';
        content.innerHTML = buildDashboard();
        bindAdminComparisonControls();
        return;
    }

    if (section === 'answers') {
        title.textContent = 'Respostas';
        subtitle.textContent = 'Historico de avaliacoes com contato rapido por WhatsApp.';
        content.innerHTML = buildAnswers();
        return;
    }

    if (section === 'comments') {
        title.textContent = 'Comentarios';
        subtitle.textContent = 'Feedbacks textuais enviados pelos clientes.';
        content.innerHTML = buildComments();
        return;
    }

    if (section === 'reports') {
        title.textContent = 'Relatorios';
        subtitle.textContent = 'Comparativo por periodo com pontos fortes e melhorias.';
        content.innerHTML = buildReports();
        bindReportControls();
        return;
    }

    if (section === 'clients') {
        title.textContent = 'Clientes';
        subtitle.textContent = 'Visao geral de clientes, engajamento e historico individual.';
        content.innerHTML = buildClientsSection();
        bindClientActions();
        return;
    }

    if (section === 'settings') {
        title.textContent = 'Configuracoes';
        subtitle.textContent = 'Gerencie conta, planos, questionario e cupons.';
        content.innerHTML = buildSettingsSection();
        bindSettingsActions();
        return;
    }

    title.textContent = 'Metricas';
    subtitle.textContent = 'Metricas interessantes para acompanhar a operacao.';
    content.innerHTML = buildMetrics();
}

function buildSettingsSection() {
    const settings = state.settings || createDefaultSettings();
    const notifications = settings.notifications || {};
    const logoSrc = settings.userPhotoDataUrl || DEFAULT_USER_PHOTO;
    const editingUnit = settings.units.find((unit) => unit.id === state.settingsUnitEditId) || null;
    const activeTab = resolveSettingsTab(state.settingsTab);

    return `
        <section class="panel-card settings-tabs-panel">
            <div class="settings-tabs">
                ${buildSettingsTabs(activeTab)}
            </div>
        </section>
        <div class="settings-tab-content">
            ${buildSettingsTabContent(activeTab, settings, notifications, logoSrc, editingUnit)}
        </div>
    `;
}

function resolveSettingsTab(tab) {
    return SETTINGS_TABS.includes(tab) ? tab : 'configuracoes';
}

function buildSettingsTabs(activeTab) {
    const labels = {
        configuracoes: 'Configuracoes',
        planos: 'Planos',
        questionario: 'Questionario',
        cupom: 'Cupom'
    };

    return SETTINGS_TABS.map((tab) => `
        <button type="button" class="settings-tab-btn ${activeTab === tab ? 'active' : ''}" data-settings-tab="${tab}">
            ${labels[tab]}
        </button>
    `).join('');
}

function buildSettingsTabContent(activeTab, settings, notifications, logoSrc, editingUnit) {
    if (activeTab === 'planos') {
        return buildPlansSection(settings.currentPlan);
    }
    if (activeTab === 'questionario') {
        return buildQuestionnaireSettingsSection(settings.questionnaire);
    }
    if (activeTab === 'cupom') {
        return buildCouponSettingsSection(settings.coupons);
    }

    return `
        <section class="panel-grid settings-grid">
            <article class="panel-card">
                <div class="panel-head">
                    <h2>Dados da conta</h2>
                    <span>Atualize foto do usuario, contato e acesso</span>
                </div>
                <form id="settings-form" class="settings-form">
                    <div class="logo-upload-row">
                        <img id="settings-logo-preview" class="logo-preview" src="${escapeHtml(logoSrc)}" alt="Foto do usuario">
                        <div class="logo-upload-actions">
                            <label class="settings-secondary-btn" for="settings-logo-input">Trocar foto</label>
                            <input id="settings-logo-input" type="file" accept="image/*" hidden>
                            <button type="button" id="settings-remove-logo" class="settings-secondary-btn">Remover foto</button>
                        </div>
                    </div>

                    <div class="settings-form-grid">
                        <div class="form-field">
                            <label for="settings-restaurant-name">Nome do restaurante</label>
                            <input id="settings-restaurant-name" value="${escapeHtml(settings.restaurantName)}" placeholder="Ex.: Restaurante Plus">
                        </div>
                        <div class="form-field">
                            <label for="settings-owner-name">Nome do responsavel</label>
                            <input id="settings-owner-name" value="${escapeHtml(settings.ownerName)}" placeholder="Ex.: Maria Silva">
                        </div>
                        <div class="form-field">
                            <label for="settings-restaurant-email">Email</label>
                            <input id="settings-restaurant-email" type="email" value="${escapeHtml(settings.restaurantEmail)}" placeholder="contato@restaurante.com">
                        </div>
                        <div class="form-field">
                            <label for="settings-phone">Numero de telefone</label>
                            <input id="settings-phone" value="${escapeHtml(settings.phone)}" placeholder="(00) 00000-0000">
                        </div>
                        <div class="form-field form-field-full">
                            <label for="settings-password">Senha de acesso</label>
                            <input id="settings-password" type="password" value="${escapeHtml(settings.password)}" placeholder="Defina uma senha">
                        </div>
                    </div>

                    <div class="settings-inline-actions">
                        <button type="submit" class="settings-btn">Salvar configuracoes</button>
                        <span id="settings-save-note" class="settings-save-note"></span>
                    </div>
                </form>
            </article>

            <article class="panel-card">
                <div class="panel-head">
                    <h2>Notificacoes</h2>
                    <span>Escolha quando deseja ser notificado</span>
                </div>
                <div class="notification-grid">
                    ${buildNotificationToggle('settings-notif-enabled', 'Ativar notificacoes', notifications.enabled)}
                    ${buildNotificationToggle('settings-notif-good', 'Avaliacoes boas', notifications.goodReviews)}
                    ${buildNotificationToggle('settings-notif-regular', 'Avaliacoes regulares', notifications.regularReviews)}
                    ${buildNotificationToggle('settings-notif-bad', 'Avaliacoes ruins', notifications.badReviews)}
                    ${buildNotificationToggle('settings-notif-comments', 'Novos comentarios/sugestoes', notifications.comments)}
                    ${buildNotificationToggle('settings-notif-birthdays', 'Aniversariantes do mes', notifications.birthdays)}
                </div>
            </article>
        </section>

        <section class="panel-card">
            <div class="panel-head">
                <h2>Unidades do restaurante</h2>
                <span>Cadastre nome, endereco e contatos de cada unidade</span>
            </div>

            <form id="unit-form" class="unit-form">
                <div class="unit-form-grid">
                    <div class="form-field">
                        <label for="unit-name">Nome da unidade</label>
                        <input id="unit-name" value="${escapeHtml(editingUnit?.name || '')}" placeholder="Ex.: Unidade Centro" required>
                    </div>
                    <div class="form-field">
                        <label for="unit-manager">Responsavel da unidade</label>
                        <input id="unit-manager" value="${escapeHtml(editingUnit?.manager || '')}" placeholder="Ex.: Joao Pereira">
                    </div>
                    <div class="form-field form-field-full">
                        <label for="unit-address">Endereco</label>
                        <input id="unit-address" value="${escapeHtml(editingUnit?.address || '')}" placeholder="Rua, avenida etc.">
                    </div>
                    <div class="form-field">
                        <label for="unit-number">Numero</label>
                        <input id="unit-number" value="${escapeHtml(editingUnit?.number || '')}" placeholder="123">
                    </div>
                    <div class="form-field">
                        <label for="unit-neighborhood">Bairro</label>
                        <input id="unit-neighborhood" value="${escapeHtml(editingUnit?.neighborhood || '')}" placeholder="Centro">
                    </div>
                    <div class="form-field">
                        <label for="unit-city">Cidade</label>
                        <input id="unit-city" value="${escapeHtml(editingUnit?.city || '')}" placeholder="Fortaleza">
                    </div>
                    <div class="form-field">
                        <label for="unit-state">Estado</label>
                        <input id="unit-state" value="${escapeHtml(editingUnit?.state || '')}" placeholder="CE">
                    </div>
                    <div class="form-field">
                        <label for="unit-zip">CEP</label>
                        <input id="unit-zip" value="${escapeHtml(editingUnit?.zipCode || '')}" placeholder="00000-000">
                    </div>
                    <div class="form-field">
                        <label for="unit-phone">Telefone da unidade</label>
                        <input id="unit-phone" value="${escapeHtml(editingUnit?.phone || '')}" placeholder="(00) 00000-0000">
                    </div>
                    <div class="form-field">
                        <label for="unit-email">Email da unidade</label>
                        <input id="unit-email" type="email" value="${escapeHtml(editingUnit?.email || '')}" placeholder="unidade@restaurante.com">
                    </div>
                </div>

                <div class="settings-inline-actions">
                    <button type="submit" class="settings-btn">${editingUnit ? 'Atualizar unidade' : 'Cadastrar unidade'}</button>
                    ${editingUnit ? '<button type="button" id="unit-cancel-edit" class="settings-secondary-btn">Cancelar edicao</button>' : ''}
                </div>
            </form>

            <div class="units-list">
                ${settings.units.map((unit) => `
                    <article class="unit-card">
                        <div>
                            <h3>${escapeHtml(unit.name)}</h3>
                            <p>${escapeHtml(formatUnitAddress(unit))}</p>
                            <p>Responsavel: ${escapeHtml(unit.manager || 'Nao informado')} | Telefone: ${escapeHtml(unit.phone || 'Nao informado')}</p>
                            <p>Email: ${escapeHtml(unit.email || 'Nao informado')}</p>
                        </div>
                        <div class="unit-card-actions">
                            <button class="unit-action-btn" data-unit-action="edit" data-unit-id="${escapeHtml(unit.id)}">Editar</button>
                            <button class="unit-delete-btn" data-unit-action="delete" data-unit-id="${escapeHtml(unit.id)}">Excluir</button>
                        </div>
                    </article>
                `).join('')}
            </div>
        </section>
    `;
}

function buildQuestionnaireSettingsSection(questionnaire) {
    const questions = normalizeQuestionnaireQuestions(questionnaire?.questions);
    const editingQuestion = questions.find((question) => question.id === state.settingsQuestionEditId) || null;

    return `
        <section class="panel-card">
            <div class="panel-head">
                <h2>Questionario</h2>
                <span>Edite as 3 perguntas que aparecem para o cliente</span>
            </div>
            <p class="settings-tip">Voce pode escolher pergunta com estrela ou texto e marcar como opcional.</p>

            <form id="questionnaire-form" class="settings-form">
                <div class="settings-form-grid">
                    <div class="form-field form-field-full">
                        <label for="questionnaire-question">Pergunta</label>
                        <input id="questionnaire-question" value="${escapeHtml(editingQuestion?.question || '')}" placeholder="Digite a pergunta">
                    </div>
                    <div class="form-field">
                        <label for="questionnaire-type">Tipo de pergunta</label>
                        <select id="questionnaire-type">
                            <option value="star" ${editingQuestion?.type === 'star' || !editingQuestion ? 'selected' : ''}>Avaliacao com estrela</option>
                            <option value="text" ${editingQuestion?.type === 'text' ? 'selected' : ''}>Resposta em texto</option>
                        </select>
                    </div>
                    <div class="form-field form-field-checkbox">
                        <label class="checkbox-inline" for="questionnaire-optional">
                            <input id="questionnaire-optional" type="checkbox" ${editingQuestion?.optional ? 'checked' : ''}>
                            <span>Pergunta opcional</span>
                        </label>
                    </div>
                </div>
                <div class="settings-inline-actions">
                    <button type="submit" class="settings-btn">${editingQuestion ? 'Atualizar pergunta' : 'Adicionar pergunta'}</button>
                    ${editingQuestion ? '<button type="button" id="questionnaire-cancel-edit" class="settings-secondary-btn">Cancelar edicao</button>' : ''}
                    <span id="questionnaire-save-note" class="settings-save-note"></span>
                </div>
            </form>

            <div class="questionnaire-list">
                ${questions.map((question, index) => `
                    <article class="questionnaire-card">
                        <div class="questionnaire-card-main">
                            <h3>${index + 1}. ${escapeHtml(question.question)}</h3>
                            <p>Chave: ${escapeHtml(question.key)}</p>
                        </div>
                        <div class="questionnaire-card-meta">
                            <span class="question-badge ${question.type === 'text' ? 'is-text' : 'is-star'}">${question.type === 'text' ? 'Texto' : 'Estrela'}</span>
                            <span class="question-badge ${question.optional ? 'is-optional' : 'is-required'}">${question.optional ? 'Opcional' : 'Obrigatoria'}</span>
                            <button type="button" class="unit-action-btn" data-question-action="edit" data-question-id="${escapeHtml(question.id)}">Editar</button>
                            <button type="button" class="unit-delete-btn" data-question-action="delete" data-question-id="${escapeHtml(question.id)}">Excluir</button>
                        </div>
                    </article>
                `).join('')}
            </div>
        </section>
    `;
}

function buildCouponSettingsSection(coupons) {
    const couponList = normalizeCoupons(coupons);
    const editingCoupon = couponList.find((coupon) => coupon.id === state.settingsCouponEditId) || null;
    const automation = state.settings?.couponAutomation || createDefaultSettings().couponAutomation;

    return `
        <section class="panel-card">
            <div class="panel-head">
                <h2>Cupom</h2>
                <span>Crie e edite cupons para campanhas e resgates</span>
            </div>

            <form id="coupon-automation-form" class="settings-form">
                <div class="settings-form-grid">
                    <div class="form-field form-field-full">
                        <label class="checkbox-inline" for="coupon-whatsapp-enabled">
                            <input id="coupon-whatsapp-enabled" type="checkbox" ${automation.whatsappEnabled ? 'checked' : ''}>
                            <span>Enviar cupom automaticamente via WhatsApp</span>
                        </label>
                    </div>
                    <div class="form-field form-field-full">
                        <label class="checkbox-inline" for="coupon-first-evaluation-enabled">
                            <input id="coupon-first-evaluation-enabled" type="checkbox" ${automation.firstEvaluationEnabled ? 'checked' : ''}>
                            <span>Primeira avaliacao do cliente</span>
                        </label>
                    </div>
                    <div class="form-field form-field-full">
                        <label class="checkbox-inline" for="coupon-inactive-client-enabled">
                            <input id="coupon-inactive-client-enabled" type="checkbox" ${automation.inactiveClientEnabled ? 'checked' : ''}>
                            <span>Cliente inativo (incentivo para voltar)</span>
                        </label>
                    </div>
                    <div class="form-field">
                        <label for="coupon-inactive-days">Dias para considerar inativo</label>
                        <input id="coupon-inactive-days" type="number" min="1" value="${automation.inactiveDays}">
                    </div>
                </div>
                <div class="settings-inline-actions">
                    <button type="submit" class="settings-secondary-btn">Salvar automacao</button>
                    <span id="coupon-automation-save-note" class="settings-save-note"></span>
                </div>
            </form>

            <form id="coupon-form" class="settings-form">
                <div class="settings-form-grid">
                    <div class="form-field">
                        <label for="coupon-code">Codigo</label>
                        <input id="coupon-code" value="${escapeHtml(editingCoupon?.code || '')}" placeholder="EX.: CLIENTE10">
                    </div>
                    <div class="form-field">
                        <label for="coupon-discount">Desconto</label>
                        <input id="coupon-discount" value="${escapeHtml(editingCoupon?.discount || '')}" placeholder="Ex.: 10% ou R$ 15">
                    </div>
                    <div class="form-field form-field-full">
                        <label for="coupon-title">Titulo</label>
                        <input id="coupon-title" value="${escapeHtml(editingCoupon?.title || '')}" placeholder="Nome da campanha">
                    </div>
                    <div class="form-field form-field-full">
                        <label for="coupon-description">Descricao</label>
                        <input id="coupon-description" value="${escapeHtml(editingCoupon?.description || '')}" placeholder="Detalhes do cupom">
                    </div>
                    <div class="form-field">
                        <label for="coupon-expires-at">Valido ate</label>
                        <input id="coupon-expires-at" type="date" value="${escapeHtml(editingCoupon?.expiresAt || '')}">
                    </div>
                    <div class="form-field form-field-checkbox">
                        <label class="checkbox-inline" for="coupon-active">
                            <input id="coupon-active" type="checkbox" ${editingCoupon?.active !== false ? 'checked' : ''}>
                            <span>Cupom ativo</span>
                        </label>
                    </div>
                </div>
                <div class="settings-inline-actions">
                    <button type="submit" class="settings-btn">${editingCoupon ? 'Atualizar cupom' : 'Criar cupom'}</button>
                    ${editingCoupon ? '<button type="button" id="coupon-cancel-edit" class="settings-secondary-btn">Cancelar edicao</button>' : ''}
                    <span id="coupon-save-note" class="settings-save-note"></span>
                </div>
            </form>

            <div class="coupon-list">
                ${couponList.length ? couponList.map((coupon) => `
                    <article class="coupon-card">
                        <div>
                            <h3>${escapeHtml(coupon.code)} <span class="coupon-status ${coupon.active ? 'is-active' : 'is-inactive'}">${coupon.active ? 'Ativo' : 'Inativo'}</span></h3>
                            <p>${escapeHtml(coupon.title || 'Sem titulo')}</p>
                            <p>${escapeHtml(coupon.description || 'Sem descricao')}</p>
                            <p>Desconto: ${escapeHtml(coupon.discount || '-')} | Validade: ${escapeHtml(coupon.expiresAt || 'Nao definida')}</p>
                        </div>
                        <div class="unit-card-actions">
                            <button type="button" class="unit-action-btn" data-coupon-action="edit" data-coupon-id="${escapeHtml(coupon.id)}">Editar</button>
                            <button type="button" class="unit-delete-btn" data-coupon-action="delete" data-coupon-id="${escapeHtml(coupon.id)}">Excluir</button>
                        </div>
                    </article>
                `).join('') : '<div class="empty-state chart-empty">Nenhum cupom cadastrado.</div>'}
            </div>
        </section>
    `;
}

function buildNotificationToggle(id, label, checked) {
    return `
        <div class="switch-row">
            <label class="switch-label" for="${id}">
                <input id="${id}" type="checkbox" ${checked ? 'checked' : ''}>
                <span>${label}</span>
            </label>
        </div>
    `;
}

function buildPlansSection(currentPlan) {
    const plan = PLAN_IDS.includes(String(currentPlan || '').toLowerCase())
        ? String(currentPlan).toLowerCase()
        : 'basico';
    const cardList = [
        {
            id: 'basico',
            name: 'Basico',
            price: 'R$ 297/mes',
            subtitle: 'Perfeito para comecar a coletar feedback dos clientes',
            items: [
                '1 questionario personalizavel',
                'Acesso aos graficos e analises',
                'iPad com anuncios de terceiros',
                'Carregador de celular para clientes',
                'Insights gerados pela Plus Midia',
                'URL personalizada',
                'Coleta de telefone e nome'
            ]
        },
        {
            id: 'profissional',
            name: 'Profissional',
            badge: 'Mais popular',
            price: 'R$ 497/mes',
            subtitle: 'Ideal para restaurantes com multiplos ambientes ou servicos',
            items: [
                'Multiplos questionarios editaveis',
                'Questionario para delivery',
                'Questionario para diferentes ambientes',
                'Acesso aos graficos avancados',
                'iPad com anuncios de terceiros',
                'Carregador de celular para clientes',
                'Insights gerados pela Plus Midia',
                'URLs personalizadas ilimitadas',
                'Suporte prioritario'
            ]
        },
        {
            id: 'premium',
            name: 'Premium',
            price: 'R$ 797/mes',
            subtitle: 'Controle total sobre a experiencia e monetizacao',
            items: [
                'Tudo do plano Profissional',
                'Escolha as propagandas exibidas',
                'Venda espacos publicitarios',
                'Monetize seu iPad',
                'Gestao completa de anuncios',
                'Relatorios de receita de anuncios',
                'API para integracao',
                'Gerente de conta dedicado',
                'Consultoria mensal inclusa'
            ]
        }
    ];

    return `
        <section class="panel-card plans-panel">
            <div class="panel-head">
                <h2>Planos</h2>
                <span>Gerencie seu plano e compare os recursos disponiveis</span>
            </div>

            <div class="plans-cards-grid">
                ${cardList.map((card) => {
                    const isCurrent = card.id === plan;
                    return `
                        <article class="plan-card ${isCurrent ? 'is-current' : ''} ${card.id === 'profissional' ? 'is-popular' : ''}">
                            ${card.badge ? `<span class="plan-badge">${card.badge}</span>` : ''}
                            <h3>${card.name}</h3>
                            <strong class="plan-price">${card.price}</strong>
                            <p class="plan-subtitle">${card.subtitle}</p>
                            <ul class="plan-feature-list">
                                ${card.items.map((item) => `<li>${item}</li>`).join('')}
                            </ul>
                            <button class="plan-action-btn ${isCurrent ? 'is-disabled' : ''}" data-plan-id="${card.id}" ${isCurrent ? 'disabled' : ''}>
                                ${isCurrent ? 'Plano Atual' : 'Assinar Plano'}
                            </button>
                        </article>
                    `;
                }).join('')}
            </div>

            <div class="plans-compare-wrap">
                <h3>Compare os Planos</h3>
                <table class="plans-compare-table">
                    <thead>
                        <tr>
                            <th>Funcionalidade</th>
                            <th>Basico</th>
                            <th>Profissional</th>
                            <th>Premium</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr><td>Questionarios</td><td>1</td><td>Ilimitados</td><td>Ilimitados</td></tr>
                        <tr><td>Analises e Graficos</td><td>✓</td><td>✓</td><td>✓</td></tr>
                        <tr><td>iPad com Carregador</td><td>✓</td><td>✓</td><td>✓</td></tr>
                        <tr><td>Insights IA</td><td>✓</td><td>✓</td><td>✓</td></tr>
                        <tr><td>Anuncios Controlados</td><td>-</td><td>-</td><td>✓</td></tr>
                        <tr><td>Monetizacao</td><td>-</td><td>-</td><td>✓</td></tr>
                        <tr><td>Suporte</td><td>Email</td><td>Prioritario</td><td>Dedicado</td></tr>
                    </tbody>
                </table>
            </div>

            <div class="plans-benefits-banner">
                <h3>Beneficios da Plus Midia</h3>
                <p>Com qualquer plano, voce recebe insights valiosos e pode oferecer uma experiencia diferenciada com carregamento de celular gratuito.</p>
                <div class="plans-benefits-grid">
                    <article><strong>🎯 Insights IA</strong><span>Analises inteligentes das avaliacoes dos seus clientes</span></article>
                    <article><strong>📱 iPad Incluso</strong><span>Equipamento completo para coleta de feedback</span></article>
                    <article><strong>⚡ Carregador</strong><span>Ofereca carregamento de celular aos clientes</span></article>
                </div>
            </div>
        </section>
    `;
}

function bindSettingsActions() {
    const form = document.getElementById('settings-form');
    if (form) {
        form.addEventListener('submit', (event) => {
            event.preventDefault();
            saveGeneralSettings();
        });
    }

    const logoInput = document.getElementById('settings-logo-input');
    if (logoInput) {
        logoInput.addEventListener('change', async () => {
            const file = logoInput.files?.[0];
            if (!file) {
                return;
            }
            const dataUrl = await fileToDataUrl(file);
            state.settings.userPhotoDataUrl = dataUrl;
            persistSettings();
            applySettingsBranding();
            const preview = document.getElementById('settings-logo-preview');
            if (preview) {
                preview.src = dataUrl;
            }
        });
    }

    const removeLogoButton = document.getElementById('settings-remove-logo');
    if (removeLogoButton) {
        removeLogoButton.addEventListener('click', () => {
            state.settings.userPhotoDataUrl = null;
            persistSettings();
            const preview = document.getElementById('settings-logo-preview');
            if (preview) {
                preview.src = DEFAULT_USER_PHOTO;
            }
            applySettingsBranding();
        });
    }

    const unitForm = document.getElementById('unit-form');
    if (unitForm) {
        unitForm.addEventListener('submit', (event) => {
            event.preventDefault();
            saveUnitSettings();
        });
    }

    const unitCancelButton = document.getElementById('unit-cancel-edit');
    if (unitCancelButton) {
        unitCancelButton.addEventListener('click', () => {
            state.settingsUnitEditId = null;
            renderSection('settings');
        });
    }

    document.querySelectorAll('[data-unit-action][data-unit-id]').forEach((button) => {
        button.addEventListener('click', () => {
            const action = button.dataset.unitAction;
            const unitId = button.dataset.unitId;
            if (!unitId) {
                return;
            }

            if (action === 'edit') {
                state.settingsUnitEditId = unitId;
                renderSection('settings');
                return;
            }

            if (action === 'delete') {
                state.settings.units = state.settings.units.filter((unit) => unit.id !== unitId);
                if (!state.settings.units.length) {
                    state.settings.units = createDefaultSettings().units;
                }
                state.settingsUnitEditId = null;
                persistSettings();
                initializeUnitFilterOptions();
                renderSection('settings');
            }
        });
    });
}

function saveGeneralSettings() {
    const settings = state.settings;
    settings.restaurantName = String(document.getElementById('settings-restaurant-name')?.value || '').trim();
    settings.ownerName = String(document.getElementById('settings-owner-name')?.value || '').trim();
    settings.restaurantEmail = String(document.getElementById('settings-restaurant-email')?.value || '').trim();
    settings.phone = String(document.getElementById('settings-phone')?.value || '').trim();
    settings.password = String(document.getElementById('settings-password')?.value || '').trim();

    settings.notifications = {
        enabled: !!document.getElementById('settings-notif-enabled')?.checked,
        goodReviews: !!document.getElementById('settings-notif-good')?.checked,
        regularReviews: !!document.getElementById('settings-notif-regular')?.checked,
        badReviews: !!document.getElementById('settings-notif-bad')?.checked,
        comments: !!document.getElementById('settings-notif-comments')?.checked,
        birthdays: !!document.getElementById('settings-notif-birthdays')?.checked
    };

    syncCurrentUserFromSettings();
    persistSettings();
    applySettingsBranding();
    applyAuthenticatedUser();
    initializeUnitFilterOptions();

    const note = document.getElementById('settings-save-note');
    if (note) {
        note.textContent = 'Configuracoes salvas com sucesso.';
        window.setTimeout(() => {
            const currentNote = document.getElementById('settings-save-note');
            if (currentNote) {
                currentNote.textContent = '';
            }
        }, 2200);
    }
}

function syncCurrentUserFromSettings() {
    if (!state.currentUser) {
        return;
    }

    const users = ensureAuthUsers();
    const index = users.findIndex((user) => user.email === state.currentUser.email);
    if (index < 0) {
        return;
    }

    const baseUser = users[index];
    const desiredEmail = String(state.settings?.restaurantEmail || baseUser.email || '').trim().toLowerCase();
    const nextEmail = baseUser.role === 'admin'
        ? ADMIN_EMAIL
        : (desiredEmail || baseUser.email);
    const conflicting = users.some((user, currentIndex) => currentIndex !== index && user.email === nextEmail);
    const safeEmail = conflicting ? baseUser.email : nextEmail;

    const nextUser = {
        ...baseUser,
        ownerName: String(state.settings?.ownerName || '').trim(),
        restaurantName: String(state.settings?.restaurantName || '').trim(),
        email: safeEmail,
        password: baseUser.role === 'admin' ? ADMIN_PASSWORD : baseUser.password
    };

    users[index] = nextUser;
    state.currentUser = nextUser;
    window.localStorage.setItem(AUTH_USERS_KEY, JSON.stringify(users));
    window.localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify({
        email: nextUser.email
    }));
}

function saveUnitSettings() {
    const name = String(document.getElementById('unit-name')?.value || '').trim();
    if (!name) {
        return;
    }

    const unitPayload = {
        id: state.settingsUnitEditId || `unit-${Date.now()}`,
        name,
        address: String(document.getElementById('unit-address')?.value || '').trim(),
        number: String(document.getElementById('unit-number')?.value || '').trim(),
        neighborhood: String(document.getElementById('unit-neighborhood')?.value || '').trim(),
        city: String(document.getElementById('unit-city')?.value || '').trim(),
        state: String(document.getElementById('unit-state')?.value || '').trim(),
        zipCode: String(document.getElementById('unit-zip')?.value || '').trim(),
        manager: String(document.getElementById('unit-manager')?.value || '').trim(),
        phone: String(document.getElementById('unit-phone')?.value || '').trim(),
        email: String(document.getElementById('unit-email')?.value || '').trim()
    };

    const list = state.settings.units || [];
    const existingIndex = list.findIndex((unit) => unit.id === unitPayload.id);
    if (existingIndex >= 0) {
        list[existingIndex] = unitPayload;
    } else {
        list.push(unitPayload);
    }
    state.settings.units = list;
    state.settingsUnitEditId = null;
    persistSettings();
    initializeUnitFilterOptions();
    renderSection('settings');
}

function setSettingsNote(noteId, message, isError = false) {
    const note = document.getElementById(noteId);
    if (!note) {
        return;
    }
    note.textContent = message;
    note.style.color = isError ? '#b91c1c' : '#059669';
}

function saveQuestionnaireSettings() {
    const questionText = String(document.getElementById('questionnaire-question')?.value || '').trim();
    const questionType = normalizeQuestionType(document.getElementById('questionnaire-type')?.value);
    const questionOptional = !!document.getElementById('questionnaire-optional')?.checked;

    if (!questionText) {
        setSettingsNote('questionnaire-save-note', 'Informe o texto da pergunta.', true);
        return;
    }

    const questions = normalizeQuestionnaireQuestions(state.settings?.questionnaire?.questions);
    const editId = state.settingsQuestionEditId;
    if (!editId && questions.length >= 3) {
        setSettingsNote('questionnaire-save-note', 'O questionario suporta ate 3 perguntas.', true);
        return;
    }

    if (editId) {
        const index = questions.findIndex((question) => question.id === editId);
        if (index === -1) {
            state.settingsQuestionEditId = null;
            renderSection('settings');
            return;
        }
        questions[index] = {
            ...questions[index],
            question: questionText,
            type: questionType,
            optional: questionOptional
        };
    } else {
        const candidateKey = sanitizeQuestionKey(questionText, `pergunta_${questions.length + 1}`);
        const existingKeys = new Set(questions.map((question) => question.key));
        let key = candidateKey;
        let suffix = 2;
        while (existingKeys.has(key)) {
            key = `${candidateKey}_${suffix}`;
            suffix += 1;
        }
        questions.push({
            id: `question-${Date.now()}`,
            key,
            question: questionText,
            type: questionType,
            optional: questionOptional
        });
    }

    if (!questions.some((question) => question.type === 'star')) {
        setSettingsNote('questionnaire-save-note', 'Mantenha ao menos uma pergunta de estrela.', true);
        return;
    }

    state.settings.questionnaire = {
        questions: normalizeQuestionnaireQuestions(questions)
    };
    state.settingsQuestionEditId = null;
    persistSettings();
    renderSection('settings');
}

function saveCouponAutomationSettings() {
    const defaults = createDefaultSettings().couponAutomation;
    const inactiveDaysInput = Number(document.getElementById('coupon-inactive-days')?.value);
    const inactiveDays = Number.isFinite(inactiveDaysInput) && inactiveDaysInput > 0
        ? Math.floor(inactiveDaysInput)
        : defaults.inactiveDays;

    state.settings.couponAutomation = {
        whatsappEnabled: !!document.getElementById('coupon-whatsapp-enabled')?.checked,
        firstEvaluationEnabled: !!document.getElementById('coupon-first-evaluation-enabled')?.checked,
        inactiveClientEnabled: !!document.getElementById('coupon-inactive-client-enabled')?.checked,
        inactiveDays
    };

    persistSettings();
    setSettingsNote('coupon-automation-save-note', 'Automacao de cupom salva com sucesso.');
}

function saveCouponSettings() {
    const code = String(document.getElementById('coupon-code')?.value || '').trim().toUpperCase();
    const title = String(document.getElementById('coupon-title')?.value || '').trim();
    const description = String(document.getElementById('coupon-description')?.value || '').trim();
    const discount = String(document.getElementById('coupon-discount')?.value || '').trim();
    const expiresAt = String(document.getElementById('coupon-expires-at')?.value || '').trim();
    const active = !!document.getElementById('coupon-active')?.checked;

    if (!code) {
        setSettingsNote('coupon-save-note', 'Informe o codigo do cupom.', true);
        return;
    }

    const list = normalizeCoupons(state.settings?.coupons);
    const payload = {
        id: state.settingsCouponEditId || `coupon-${Date.now()}`,
        code,
        title,
        description,
        discount,
        expiresAt,
        active
    };

    const existingIndex = list.findIndex((coupon) => coupon.id === payload.id);
    if (existingIndex >= 0) {
        list[existingIndex] = payload;
    } else {
        list.push(payload);
    }

    state.settings.coupons = list;
    state.settingsCouponEditId = null;
    persistSettings();
    renderSection('settings');
}

function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('Nao foi possivel ler o arquivo.'));
        reader.readAsDataURL(file);
    });
}

function formatUnitAddress(unit) {
    const parts = [
        unit.address,
        unit.number,
        unit.neighborhood,
        unit.city,
        unit.state,
        unit.zipCode
    ].filter((part) => String(part || '').trim());
    return parts.length ? parts.join(', ') : 'Endereco nao informado';
}

function getUnitOptionsFromAnswers() {
    const fromAnswers = getRestaurantScopedAnswers().map((answer) => resolveUnitName(answer)).filter(Boolean);
    const fromSettings = isAdminUser() && isAllRestaurantsSelected()
        ? []
        : (state.settings?.units || []).map((unit) => unit.name).filter(Boolean);
    const merged = [...new Set([...fromSettings, ...fromAnswers])];

    if (!merged.length) {
        return ['Unidade principal'];
    }
    return merged.sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

function resolveUnitName(item) {
    const candidates = [
        item?.unitName,
        item?.unit,
        item?.unidade,
        item?.storeName,
        item?.branchName,
        item?.placeName,
        item?.establishmentName,
        item?.localName
    ];
    const explicit = candidates.find((candidate) => typeof candidate === 'string' && candidate.trim());
    if (explicit) {
        return explicit.trim();
    }

    const defaultUnitFromSettings = state.settings?.units?.[0]?.name;
    return defaultUnitFromSettings || 'Unidade principal';
}

function buildPlansSection(currentPlan) {
    const selectedPlan = PLAN_IDS.includes(String(currentPlan || '').toLowerCase())
        ? String(currentPlan).toLowerCase()
        : 'basico';

    const cards = [
        {
            id: 'basico',
            title: 'Basico',
            price: 'R$ 297/mes',
            subtitle: 'Perfeito para comecar a coletar feedback dos clientes',
            features: [
                '1 questionario personalizavel',
                'Acesso aos graficos e analises',
                'iPad com anuncios de terceiros',
                'Carregador de celular para clientes',
                'Insights gerados pela Plus Midia',
                'URL personalizada',
                'Coleta de telefone e nome'
            ]
        },
        {
            id: 'profissional',
            title: 'Profissional',
            price: 'R$ 497/mes',
            subtitle: 'Ideal para restaurantes com multiplos ambientes ou servicos',
            badge: 'Mais Popular',
            features: [
                'Multiplos questionarios editaveis',
                'Questionario para delivery',
                'Questionario para diferentes ambientes',
                'Acesso aos graficos avancados',
                'iPad com anuncios de terceiros',
                'Carregador de celular para clientes',
                'Insights gerados pela Plus Midia',
                'URLs personalizadas ilimitadas',
                'Suporte prioritario'
            ]
        },
        {
            id: 'premium',
            title: 'Premium',
            price: 'R$ 797/mes',
            subtitle: 'Controle total sobre a experiencia e monetizacao',
            features: [
                'Tudo do plano Profissional',
                'Escolha as propagandas exibidas',
                'Venda espacos publicitarios',
                'Monetize seu iPad',
                'Gestao completa de anuncios',
                'Relatorios de receita de anuncios',
                'API para integracao',
                'Gerente de conta dedicado',
                'Consultoria mensal inclusa'
            ]
        }
    ];

    return `
        <section class="panel-card plans-panel">
            <div class="panel-head">
                <h2>Planos</h2>
                <span>Selecione seu plano e compare funcionalidades</span>
            </div>

            <div class="plans-cards-grid">
                ${cards.map((card) => {
                    const isCurrent = card.id === selectedPlan;
                    return `
                        <article class="plan-card ${isCurrent ? 'is-current' : ''} ${card.id === 'profissional' ? 'is-popular' : ''}">
                            ${card.badge ? `<span class="plan-badge">${card.badge}</span>` : ''}
                            <h3>${card.title}</h3>
                            <strong class="plan-price">${card.price}</strong>
                            <p class="plan-subtitle">${card.subtitle}</p>
                            <ul class="plan-feature-list">
                                ${card.features.map((feature) => `<li>${escapeHtml(feature)}</li>`).join('')}
                            </ul>
                            <button class="plan-action-btn ${isCurrent ? 'is-disabled' : ''}" data-plan-id="${card.id}" ${isCurrent ? 'disabled' : ''}>
                                ${isCurrent ? 'Plano Atual' : 'Assinar Plano'}
                            </button>
                        </article>
                    `;
                }).join('')}
            </div>

            <div class="plans-compare-wrap">
                <h3>Compare os Planos</h3>
                <table class="plans-compare-table">
                    <thead>
                        <tr>
                            <th>Funcionalidade</th>
                            <th>Basico</th>
                            <th>Profissional</th>
                            <th>Premium</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr><td>Questionarios</td><td>1</td><td>Ilimitados</td><td>Ilimitados</td></tr>
                        <tr><td>Analises e Graficos</td><td>&#10003;</td><td>&#10003;</td><td>&#10003;</td></tr>
                        <tr><td>iPad com Carregador</td><td>&#10003;</td><td>&#10003;</td><td>&#10003;</td></tr>
                        <tr><td>Insights IA</td><td>&#10003;</td><td>&#10003;</td><td>&#10003;</td></tr>
                        <tr><td>Anuncios Controlados</td><td>-</td><td>-</td><td>&#10003;</td></tr>
                        <tr><td>Monetizacao</td><td>-</td><td>-</td><td>&#10003;</td></tr>
                        <tr><td>Suporte</td><td>Email</td><td>Prioritario</td><td>Dedicado</td></tr>
                    </tbody>
                </table>
            </div>

            <div class="plans-benefits-banner">
                <h3>Beneficios da Plus Midia</h3>
                <p>Com qualquer plano, voce recebe insights valiosos sobre seus clientes e pode oferecer uma experiencia diferenciada com carregamento de celular gratuito.</p>
                <div class="plans-benefits-grid">
                    <article><strong>Insights IA</strong><span>Analises inteligentes das avaliacoes dos clientes</span></article>
                    <article><strong>iPad Incluso</strong><span>Equipamento completo para coleta de feedback</span></article>
                    <article><strong>Carregador</strong><span>Carregamento de celular para os clientes</span></article>
                </div>
            </div>
        </section>
    `;
}

function bindSettingsActions() {
    document.querySelectorAll('[data-settings-tab]').forEach((button) => {
        button.addEventListener('click', () => {
            const nextTab = resolveSettingsTab(button.dataset.settingsTab);
            if (nextTab === state.settingsTab) {
                return;
            }
            state.settingsTab = nextTab;
            state.settingsUnitEditId = null;
            state.settingsQuestionEditId = null;
            state.settingsCouponEditId = null;
            renderSection('settings');
        });
    });

    const activeTab = resolveSettingsTab(state.settingsTab);

    if (activeTab === 'planos') {
        document.querySelectorAll('[data-plan-id]').forEach((button) => {
            button.addEventListener('click', () => {
                const planId = String(button.dataset.planId || '').toLowerCase();
                if (!PLAN_IDS.includes(planId)) {
                    return;
                }
                state.settings.currentPlan = planId;
                persistSettings();
                renderSection('settings');
            });
        });
        return;
    }

    if (activeTab === 'questionario') {
        const questionForm = document.getElementById('questionnaire-form');
        if (questionForm) {
            questionForm.addEventListener('submit', (event) => {
                event.preventDefault();
                saveQuestionnaireSettings();
            });
        }

        const questionCancelButton = document.getElementById('questionnaire-cancel-edit');
        if (questionCancelButton) {
            questionCancelButton.addEventListener('click', () => {
                state.settingsQuestionEditId = null;
                renderSection('settings');
            });
        }

        document.querySelectorAll('[data-question-action][data-question-id]').forEach((button) => {
            button.addEventListener('click', () => {
                const action = button.dataset.questionAction;
                const questionId = button.dataset.questionId;
                if (!questionId) {
                    return;
                }

                const questions = normalizeQuestionnaireQuestions(state.settings?.questionnaire?.questions);
                if (action === 'edit') {
                    state.settingsQuestionEditId = questionId;
                    renderSection('settings');
                    return;
                }

                if (action === 'delete') {
                    const nextQuestions = questions.filter((question) => question.id !== questionId);
                    state.settings.questionnaire.questions = normalizeQuestionnaireQuestions(nextQuestions);
                    state.settingsQuestionEditId = null;
                    persistSettings();
                    renderSection('settings');
                }
            });
        });
        return;
    }

    if (activeTab === 'cupom') {
        const couponAutomationForm = document.getElementById('coupon-automation-form');
        if (couponAutomationForm) {
            couponAutomationForm.addEventListener('submit', (event) => {
                event.preventDefault();
                saveCouponAutomationSettings();
            });
        }

        const couponForm = document.getElementById('coupon-form');
        if (couponForm) {
            couponForm.addEventListener('submit', (event) => {
                event.preventDefault();
                saveCouponSettings();
            });
        }

        const couponCancelButton = document.getElementById('coupon-cancel-edit');
        if (couponCancelButton) {
            couponCancelButton.addEventListener('click', () => {
                state.settingsCouponEditId = null;
                renderSection('settings');
            });
        }

        document.querySelectorAll('[data-coupon-action][data-coupon-id]').forEach((button) => {
            button.addEventListener('click', () => {
                const action = button.dataset.couponAction;
                const couponId = button.dataset.couponId;
                if (!couponId) {
                    return;
                }

                if (action === 'edit') {
                    state.settingsCouponEditId = couponId;
                    renderSection('settings');
                    return;
                }

                if (action === 'delete') {
                    state.settings.coupons = normalizeCoupons(state.settings.coupons).filter((coupon) => coupon.id !== couponId);
                    state.settingsCouponEditId = null;
                    persistSettings();
                    renderSection('settings');
                }
            });
        });
        return;
    }

    const form = document.getElementById('settings-form');
    if (form) {
        form.addEventListener('submit', (event) => {
            event.preventDefault();
            saveGeneralSettings();
        });
    }

    const logoInput = document.getElementById('settings-logo-input');
    if (logoInput) {
        logoInput.addEventListener('change', async () => {
            const file = logoInput.files?.[0];
            if (!file) {
                return;
            }
            const dataUrl = await fileToDataUrl(file);
            state.settings.userPhotoDataUrl = dataUrl;
            persistSettings();
            applySettingsBranding();
            const preview = document.getElementById('settings-logo-preview');
            if (preview) {
                preview.src = dataUrl;
            }
        });
    }

    const removeLogoButton = document.getElementById('settings-remove-logo');
    if (removeLogoButton) {
        removeLogoButton.addEventListener('click', () => {
            state.settings.userPhotoDataUrl = null;
            persistSettings();
            const preview = document.getElementById('settings-logo-preview');
            if (preview) {
                preview.src = DEFAULT_USER_PHOTO;
            }
            applySettingsBranding();
        });
    }

    const unitForm = document.getElementById('unit-form');
    if (unitForm) {
        unitForm.addEventListener('submit', (event) => {
            event.preventDefault();
            saveUnitSettings();
        });
    }

    const unitCancelButton = document.getElementById('unit-cancel-edit');
    if (unitCancelButton) {
        unitCancelButton.addEventListener('click', () => {
            state.settingsUnitEditId = null;
            renderSection('settings');
        });
    }

    document.querySelectorAll('[data-unit-action][data-unit-id]').forEach((button) => {
        button.addEventListener('click', () => {
            const action = button.dataset.unitAction;
            const unitId = button.dataset.unitId;
            if (!unitId) {
                return;
            }

            if (action === 'edit') {
                state.settingsUnitEditId = unitId;
                renderSection('settings');
                return;
            }

            if (action === 'delete') {
                state.settings.units = state.settings.units.filter((unit) => unit.id !== unitId);
                if (!state.settings.units.length) {
                    state.settings.units = createDefaultSettings().units;
                }
                state.settingsUnitEditId = null;
                persistSettings();
                initializeUnitFilterOptions();
                renderSection('settings');
            }
        });
    });
}
