/*
 * Fluxo de login/cadastro em client-side.
 * Persiste usuarios e sessao no localStorage para o acesso ao dashboard.
 */
const AUTH_USERS_KEY = 'plus-auth-users-v1';
const AUTH_SESSION_KEY = 'plus-auth-session-v1';
const ADMIN_EMAIL = 'plusmidia@gamil.com';
const ADMIN_PASSWORD = 'plusmidia1234';

document.addEventListener('DOMContentLoaded', () => {
    ensureAuthUsers();
    redirectIfSessionExists();
    setAuthTab('login');
    bindAuthTabs();
    bindLoginForm();
    bindRegisterForm();
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

function normalizeUser(user, index) {
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
    const admin = buildAdminUser();
    let users = [];

    try {
        const raw = window.localStorage.getItem(AUTH_USERS_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
                users = parsed.map((user, index) => normalizeUser(user, index)).filter((user) => user.email);
            }
        }
    } catch (_error) {
        users = [];
    }

    const withoutAdmin = users.filter((user) => user.email !== ADMIN_EMAIL);
    const normalized = [admin, ...withoutAdmin];
    window.localStorage.setItem(AUTH_USERS_KEY, JSON.stringify(normalized));
    return normalized;
}

function redirectIfSessionExists() {
    const users = ensureAuthUsers();
    try {
        const raw = window.localStorage.getItem(AUTH_SESSION_KEY);
        if (!raw) {
            return;
        }
        const parsed = JSON.parse(raw);
        const email = String(parsed?.email || '').trim().toLowerCase();
        const found = users.find((user) => user.email === email);
        if (found) {
            window.location.href = './index.html';
        } else {
            window.localStorage.removeItem(AUTH_SESSION_KEY);
        }
    } catch (_error) {
        window.localStorage.removeItem(AUTH_SESSION_KEY);
    }
}

function bindAuthTabs() {
    document.querySelectorAll('[data-auth-tab]').forEach((button) => {
        button.addEventListener('click', () => {
            setAuthTab(button.dataset.authTab);
            clearErrors();
        });
    });
}

function setAuthTab(tabName) {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    if (!loginForm || !registerForm) {
        return;
    }

    const isLogin = tabName !== 'register';
    loginForm.hidden = !isLogin;
    registerForm.hidden = isLogin;

    setFormControlsEnabled(loginForm, isLogin);
    setFormControlsEnabled(registerForm, !isLogin);

    document.querySelectorAll('[data-auth-tab]').forEach((tabButton) => {
        tabButton.classList.toggle('active', tabButton.dataset.authTab === (isLogin ? 'login' : 'register'));
    });
}

function setFormControlsEnabled(form, enabled) {
    form.querySelectorAll('input, button').forEach((control) => {
        control.disabled = !enabled;
    });
}

function clearErrors() {
    const loginError = document.getElementById('login-error');
    const registerError = document.getElementById('register-error');
    if (loginError) {
        loginError.textContent = '';
    }
    if (registerError) {
        registerError.textContent = '';
    }
}

function bindLoginForm() {
    const form = document.getElementById('login-form');
    if (!form) {
        return;
    }

    form.addEventListener('submit', (event) => {
        event.preventDefault();
        const email = String(document.getElementById('login-email')?.value || '').trim().toLowerCase();
        const password = String(document.getElementById('login-password')?.value || '').trim();
        const error = document.getElementById('login-error');
        if (error) {
            error.textContent = '';
        }

        const users = ensureAuthUsers();
        const user = users.find((candidate) => candidate.email === email && candidate.password === password);
        if (!user) {
            if (error) {
                error.textContent = 'Email ou senha invalidos.';
            }
            return;
        }

        window.localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify({ email: user.email }));
        window.location.href = './index.html';
    });
}

function bindRegisterForm() {
    const form = document.getElementById('register-form');
    if (!form) {
        return;
    }

    form.addEventListener('submit', (event) => {
        event.preventDefault();
        const restaurantName = String(document.getElementById('register-restaurant')?.value || '').trim();
        const ownerName = String(document.getElementById('register-owner')?.value || '').trim();
        const email = String(document.getElementById('register-email')?.value || '').trim().toLowerCase();
        const password = String(document.getElementById('register-password')?.value || '').trim();
        const passwordConfirm = String(document.getElementById('register-password-confirm')?.value || '').trim();
        const error = document.getElementById('register-error');
        if (error) {
            error.textContent = '';
        }

        if (!restaurantName || !ownerName || !email || !password || !passwordConfirm) {
            if (error) {
                error.textContent = 'Preencha todos os campos obrigatorios.';
            }
            return;
        }
        if (password !== passwordConfirm) {
            if (error) {
                error.textContent = 'As senhas nao conferem.';
            }
            return;
        }
        if (email === ADMIN_EMAIL) {
            if (error) {
                error.textContent = 'Esse email e reservado para o admin.';
            }
            return;
        }

        const users = ensureAuthUsers();
        if (users.some((user) => user.email === email)) {
            if (error) {
                error.textContent = 'Ja existe uma conta com esse email.';
            }
            return;
        }

        const nextUser = {
            id: `user-${Date.now()}`,
            role: 'restaurant',
            restaurantName,
            ownerName,
            email,
            password
        };
        const nextUsers = [...users, nextUser];
        window.localStorage.setItem(AUTH_USERS_KEY, JSON.stringify(nextUsers));
        window.localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify({ email: nextUser.email }));
        window.location.href = './index.html';
    });
}
