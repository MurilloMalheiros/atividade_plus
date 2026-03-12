import express from 'express';
import reviewsRouter from './routes/reviews.js';
import { initDB } from './models/review.js';

const app = express();
app.use(express.json());

app.use('/reviews', reviewsRouter);

const PORT = process.env.PORT || 3000;

initDB()
    .then(() => {
        app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
    })
    .catch((err) => {
        console.error('Erro inicializando DB', err);
        process.exit(1);
    });