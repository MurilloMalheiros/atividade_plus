function sentimentAnalyctics(req, res) {
    const {text } = req.body || {};
    if (!text) return res.status(400).json({ erro: 'missing'});
    // aqui você pode usar uma biblioteca de análise de sentimento ou uma API externa para analisar o texto e retornar um resultado
    const sentiment = Math.random() > 0.5 ? 'positive' : 'negative'; // exemplo aleatório
    res.json({ sentiment });
}
