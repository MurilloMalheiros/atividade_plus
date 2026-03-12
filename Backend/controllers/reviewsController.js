import { saveReview, listReviews } from '../models/review.js';
import fs from 'fs/promises';
import path from 'path';

const JSON_PATH = path.resolve('Backend', 'data', 'reviews.json');

export async function createReview(req, res) {
  try {
    const review = req.body;
    const id = await saveReview(review);

    await fs.mkdir(path.dirname(JSON_PATH), { recursive: true });
    let arr = [];
    try {
      const content = await fs.readFile(JSON_PATH, 'utf8');
      arr = JSON.parse(content || '[]');
    } catch (e) {
      arr = [];
    }

    review.id = id;
    review.created_at = new Date().toISOString();
    arr.push(review);
    await fs.writeFile(JSON_PATH, JSON.stringify(arr, null, 2), 'utf8');

    res.status(201).json({ success: true, id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao salvar avaliação' });
  }
}

export async function getReviews(req, res) {
  try {
    const rows = await listReviews();
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao listar avaliações' });
  }
}
