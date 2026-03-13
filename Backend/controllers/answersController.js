const Sentiment = require('sentiment');
const sentiment = new Sentiment();
const answers = require('../data/answers.json'); // ajuste caminho se necessário

// Analisa sentimento pelas estrelas (ratings)
function analyzeStarsSentiment(answersList) {
  const totals = { positive: 0, neutral: 0, negative: 0, total: 0 };
  let sum = 0;
  for (const a of answersList) {
    const s = Number(a.rating ?? a.stars ?? 0);
    if (!s) continue;
    totals.total++;
    sum += s;
    if (s >= 4) totals.positive++;
    else if (s === 3) totals.neutral++;
    else totals.negative++;
  }
  const avg = totals.total ? sum / totals.total : 0;
  return {
    totalResponses: totals.total,
    average: Number(avg.toFixed(2)),
    counts: totals,
    pctPositive: totals.total ? Number((totals.positive / totals.total * 100).toFixed(1)) : 0,
    pctNegative: totals.total ? Number((totals.negative / totals.total * 100).toFixed(1)) : 0,
  };
}

// Analisa sentimentos em comentários (texto) e extrai keywords simples
function analyzeCommentsSentiment(answersList) {
  const comments = answersList.map(a => a.comment || a.text || '').filter(Boolean);
  const scored = comments.map(text => {
    const r = sentiment.analyze(text);
    return { text, score: r.score, comparative: r.comparative };
  });

  const positive = scored.filter(s => s.score > 0).sort((a,b)=>b.score-a.score).slice(0,5);
  const negative = scored.filter(s => s.score < 0).sort((a,b)=>a.score-b.score).slice(0,5);
  const neutral = scored.filter(s => s.score === 0).slice(0,5);

  // extração simples de keywords (contagem)
  const stop = new Set(['gostei', 'adorei', 'não gostei', 'satisfeito', 'insatisfação', 'insatisfeito', 'bom', 'ruim', 'péssimo', 'exelente', 'horrível', 'maravihoso', 'ótimo', 'gosotoso', 'gostosa', 'delicioso', '']);
  const freq = {};
  comments.forEach(t => {
    t.toLowerCase()
     .replace(/[^a-z0-9áàâãéèêíóôõúç\s]/g,' ')
     .split(/\s+/)
     .forEach(w => {
       if (!w || stop.has(w) || w.length <= 2) return;
       freq[w] = (freq[w] || 0) + 1;
     });
  });
  const keywords = Object.entries(freq).sort((a,b)=>b[1]-a[1]).slice(0,10).map(([word,count])=>({word, count}));

  const totalComments = comments.length;
  return { totalComments, positive, negative, neutral, keywords };
}

// Exemplo de rota/handler: retorna ambos os relatórios
function sentimentAnalyticsHandler(req, res) {
  // posso filtrar por restaurante, data, etc., com query params
  const starReport = analyzeStarsSentiment(answers);
  const commentReport = analyzeCommentsSentiment(answers);
  res.json({ starReport, commentReport });
}

module.exports = { sentimentAnalyticsHandler, analyzeStarsSentiment, analyzeCommentsSentiment };