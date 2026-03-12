import sqlite3 from 'sqlite3';
import { open } from 'fs/promises';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';

const DB_PATH = path.resolve('Backend', 'data', 'reviews.db');

function runAsync(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve({ lastID: this.lastID });
    });
  });
}

function allAsync(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

export async function initDB() {
  await fs.mkdir(path.dirname(DB_PATH), { recursive: true });
  const sqlite = sqlite3.verbose();
  const db = new sqlite.Database(DB_PATH);
  const create = `CREATE TABLE IF NOT EXISTS reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    restaurant TEXT,
    rating INTEGER,
    comment TEXT,
    data_json TEXT,
    created_at TEXT
  )`;
  await runAsync(db, create);
  db.close();
}

export async function saveReview(review) {
  const sqlite = sqlite3.verbose();
  const db = new sqlite.Database(DB_PATH);
  const sql = `INSERT INTO reviews (restaurant, rating, comment, data_json, created_at) VALUES (?, ?, ?, ?, ?)`;
  const params = [
    review.restaurant || null,
    review.rating || null,
    review.comment || null,
    JSON.stringify(review),
    new Date().toISOString(),
  ];
  const result = await runAsync(db, sql, params);
  db.close();
  return result.lastID;
}

export async function listReviews() {
  const sqlite = sqlite3.verbose();
  const db = new sqlite.Database(DB_PATH);
  const rows = await allAsync(db, 'SELECT id, restaurant, rating, comment, data_json, created_at FROM reviews ORDER BY id DESC');
  db.close();
  return rows.map(r => ({
    id: r.id,
    restaurant: r.restaurant,
    rating: r.rating,
    comment: r.comment,
    data: JSON.parse(r.data_json || '{}'),
    created_at: r.created_at
  }));
}
