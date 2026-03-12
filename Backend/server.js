import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';

const app = express();
app.use(cors());
app.use(express.json());

const DATA_DIR = path.join(process.cwd(), 'Backend', 'data');
const ANSWERS_FILE = path.join(DATA_DIR, 'answers.json');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(ANSWERS_FILE)) fs.writeFileSync(ANSWERS_FILE, '[]');

// servir frontend estático
app.use(express.static(path.join(process.cwd(), 'Frontend')));

// POST /answers -> salvar avaliação
app.post('/answers', (req, res) => {
        try {
                const payload = req.body || {};
                const entry = { ...payload, ts: Date.now() };
                const raw = fs.readFileSync(ANSWERS_FILE, 'utf8');
                const arr = JSON.parse(raw || '[]');
                arr.push(entry);
                fs.writeFileSync(ANSWERS_FILE, JSON.stringify(arr, null, 2));
                res.json({ ok: true });
        } catch (e) { console.error(e); res.status(500).json({ error: 'failed' }); }
});

// GET /answers -> listar avaliações
app.get('/answers', (req, res) => {
        try {
                const raw = fs.readFileSync(ANSWERS_FILE, 'utf8');
                const arr = JSON.parse(raw || '[]');
                res.json(arr);
        } catch (e) { console.error(e); res.status(500).json([]); }
});

// POST /login -> simples verificação de admin via env vars
const ADMIN_NAME = process.env.ADMIN_NAME || 'admin';
const ADMIN_PHONE = process.env.ADMIN_PHONE || 'admin';
app.post('/login', (req, res) => {
        const { name, phone } = req.body || {};
        if (!name || !phone) return res.status(400).json({ error: 'missing' });
        if (name === ADMIN_NAME && phone === ADMIN_PHONE) return res.json({ role: 'admin' });
        return res.json({ role: 'user' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));