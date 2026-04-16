/*
 * Controlador do formulario de avaliacao.
 * Le configuracoes do dashboard, aplica perguntas e envia os dados para a API.
 */
const labels = ['', 'Pessimo', 'Ruim', 'Regular', 'Bom', 'Excelente'];
const SETTINGS_STORAGE_KEY = 'plus-dashboard-settings-v1';

const formState = {
    answers: {},
    textAnswers: {},
    questions: []
};

function createDefaultQuestions() {
    return [
        {
            key: 'qualidadeComida',
            question: 'Como voce avalia a qualidade da comida?',
            type: 'star',
            optional: false
        },
        {
            key: 'atendimentoEquipe',
            question: 'Como voce avalia o atendimento da equipe?',
            type: 'star',
            optional: false
        },
        {
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

function sanitizeQuestionKey(value, fallback) {
    const normalized = String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9_]+/g, '_')
        .replace(/^_+|_+$/g, '');
    return normalized || fallback;
}

function loadConfiguredQuestions() {
    const defaults = createDefaultQuestions();
    try {
        const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
        if (!raw) {
            return defaults;
        }
        const parsed = JSON.parse(raw);
        const configured = parsed?.questionnaire?.questions;
        if (!Array.isArray(configured) || !configured.length) {
            return defaults;
        }

        const normalized = configured
            .slice(0, 3)
            .map((question, index) => {
                const fallback = defaults[index] || defaults[0];
                return {
                    key: sanitizeQuestionKey(question?.key || fallback.key, `pergunta_${index + 1}`),
                    question: String(question?.question || '').trim() || fallback.question,
                    type: normalizeQuestionType(question?.type || fallback.type),
                    optional: Boolean(question?.optional)
                };
            });

        while (normalized.length < 3) {
            normalized.push(defaults[normalized.length]);
        }

        if (!normalized.some((question) => question.type === 'star')) {
            normalized[0] = {
                ...normalized[0],
                type: 'star',
                optional: false
            };
        }

        return normalized;
    } catch (_error) {
        return defaults;
    }
}

function initializeQuestionnaire() {
    formState.questions = loadConfiguredQuestions();
    applyQuestionsToPages();
}

function getQuestionByPage(page) {
    return formState.questions[page - 1];
}

function applyQuestionsToPages() {
    for (let page = 1; page <= 3; page += 1) {
        const question = getQuestionByPage(page);
        if (!question) {
            continue;
        }

        const pageEl = document.getElementById(`p${page}`);
        if (!pageEl) {
            continue;
        }

        const questionEl = pageEl.querySelector('.question');
        const starsContainer = document.getElementById(`stars-${page}`);
        const labelEl = document.getElementById(`label-${page}`);
        const nextButton = document.getElementById(`btn-${page}`);

        if (questionEl) {
            questionEl.textContent = question.question;
        }

        let textWrap = document.getElementById(`text-answer-wrap-${page}`);
        if (!textWrap) {
            textWrap = document.createElement('div');
            textWrap.id = `text-answer-wrap-${page}`;
            textWrap.className = 'feedback-box';
            textWrap.style.display = 'none';
            textWrap.innerHTML = `<textarea id="text-answer-${page}" class="feedback-input" placeholder="Digite sua resposta..."></textarea>`;
            const group = pageEl.querySelector('.btn-group');
            if (group) {
                pageEl.insertBefore(textWrap, group);
            }
        }

        const textInput = document.getElementById(`text-answer-${page}`);
        if (textInput) {
            textInput.oninput = () => {
                const value = String(textInput.value || '').trim();
                if (value) {
                    formState.textAnswers[question.key] = value;
                } else {
                    delete formState.textAnswers[question.key];
                }
                if (nextButton) {
                    nextButton.disabled = !question.optional && !value;
                }
            };
            textInput.value = formState.textAnswers[question.key] || '';
        }

        if (question.type === 'star') {
            if (starsContainer) {
                starsContainer.style.display = '';
            }
            if (labelEl) {
                labelEl.style.display = '';
                labelEl.textContent = '';
            }
            if (textWrap) {
                textWrap.style.display = 'none';
            }
            if (nextButton) {
                const hasScore = !Number.isNaN(Number(formState.answers[question.key]));
                nextButton.disabled = question.optional ? false : !hasScore;
            }
            continue;
        }

        if (starsContainer) {
            starsContainer.style.display = 'none';
        }
        if (labelEl) {
            labelEl.style.display = 'none';
            labelEl.textContent = '';
        }
        if (textWrap) {
            textWrap.style.display = '';
        }
        if (nextButton) {
            const hasValue = !!String(formState.textAnswers[question.key] || '').trim();
            nextButton.disabled = !question.optional && !hasValue;
        }
    }
}

function goTo(n) {
    document.querySelectorAll('.page').forEach((page) => page.classList.remove('active'));
    const id = n === 0 ? 'home' : `p${n}`;
    const next = document.getElementById(id);
    if (next) {
        next.classList.add('active');
    }
    window.scrollTo(0, 0);
}

function rate(page, value) {
    const question = getQuestionByPage(page);
    if (!question || question.type !== 'star') {
        return;
    }

    formState.answers[question.key] = value;

    document.querySelectorAll(`#stars-${page} .star`).forEach((star, index) => {
        star.classList.toggle('selected', index < value);
    });

    const label = document.getElementById(`label-${page}`);
    if (label) {
        label.textContent = labels[value];
    }

    const button = document.getElementById(`btn-${page}`);
    if (button) {
        button.disabled = false;
    }
}

function toggleSub(item) {
    const sub = item.nextElementSibling;
    const isOpen = sub.classList.contains('open');

    document.querySelectorAll('.submenu.open').forEach((submenu) => {
        submenu.classList.remove('open');
        submenu.previousElementSibling.classList.remove('expanded');
    });

    if (!isOpen) {
        sub.classList.add('open');
        item.classList.add('expanded');
    }
}

function toggleDrawer() {
    const drawer = document.getElementById('drawer');
    if (drawer) {
        drawer.classList.toggle('open');
    }
}

function buildMergedComment() {
    const typedComment = String(document.getElementById('comment')?.value || '').trim();
    const questionComments = formState.questions
        .filter((question) => question.type === 'text')
        .map((question) => {
            const value = String(formState.textAnswers[question.key] || '').trim();
            if (!value) {
                return '';
            }
            return `${question.question}: ${value}`;
        })
        .filter(Boolean)
        .join('\n');

    return [typedComment, questionComments].filter(Boolean).join('\n\n');
}

function validateRequiredQuestions(errorElement) {
    for (const question of formState.questions) {
        if (question.optional) {
            continue;
        }

        if (question.type === 'star') {
            const value = Number(formState.answers[question.key]);
            if (Number.isNaN(value) || value < 1 || value > 5) {
                errorElement.textContent = `Responda a pergunta obrigatoria: "${question.question}".`;
                return false;
            }
            continue;
        }

        const textValue = String(formState.textAnswers[question.key] || '').trim();
        if (!textValue) {
            errorElement.textContent = `Responda a pergunta obrigatoria: "${question.question}".`;
            return false;
        }
    }

    return true;
}

async function submitEvaluation() {
    const errorElement = document.getElementById('form-error');
    const submitButton = document.getElementById('submit-button');
    const waiterServiceScoreValue = document.getElementById('waiter-service-score').value.trim();
    const waiterServiceScore = waiterServiceScoreValue === '' ? null : Number(waiterServiceScoreValue);
    const payload = {
        name: document.getElementById('name').value.trim(),
        phone: document.getElementById('phone').value.trim(),
        comment: buildMergedComment(),
        waiterName: document.getElementById('waiter-name').value.trim(),
        waiterServiceScore,
        answers: formState.answers
    };

    errorElement.textContent = '';

    if (!validateRequiredQuestions(errorElement)) {
        return;
    }

    if (!Object.keys(payload.answers).length) {
        errorElement.textContent = 'Configure ao menos uma pergunta de estrela para enviar a avaliacao.';
        return;
    }

    if (!payload.name) {
        errorElement.textContent = 'Informe seu nome.';
        return;
    }

    if (!payload.phone) {
        errorElement.textContent = 'Informe seu telefone.';
        return;
    }

    if (payload.waiterServiceScore !== null && (!Number.isInteger(payload.waiterServiceScore) || payload.waiterServiceScore < 0 || payload.waiterServiceScore > 5)) {
        errorElement.textContent = 'A nota do garcom deve ser um numero inteiro de 0 a 5.';
        return;
    }

    submitButton.disabled = true;
    submitButton.textContent = 'ENVIANDO...';

    try {
        const response = await fetch('/answers', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorBody = await response.json().catch(() => ({}));
            errorElement.textContent = errorBody.message || 'Nao foi possivel enviar sua avaliacao.';
            return;
        }

        resetForm();
        goTo(6);
    } catch (_error) {
        errorElement.textContent = 'Erro de conexao com o servidor.';
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = 'ENVIAR AVALIACAO';
    }
}

function resetForm() {
    formState.answers = {};
    formState.textAnswers = {};
    document.getElementById('comment').value = '';
    document.getElementById('waiter-name').value = '';
    document.getElementById('waiter-service-score').value = '';
    document.getElementById('name').value = '';
    document.getElementById('phone').value = '';
    document.getElementById('form-error').textContent = '';

    document.querySelectorAll('.star').forEach((star) => star.classList.remove('selected'));
    document.querySelectorAll('.star-label').forEach((label) => {
        if (label.id !== 'form-error') {
            label.textContent = '';
        }
    });

    applyQuestionsToPages();
}

document.addEventListener('DOMContentLoaded', () => {
    initializeQuestionnaire();
});
