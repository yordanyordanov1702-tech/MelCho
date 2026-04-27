import express from 'express';
import cors from 'cors';
import { db } from './db.js';
import productionRoutes from './routes/production.js';
import oeeRoutes from './routes/oee.js';
import headcountRoutes from './routes/headcount.js';
import certRoutes from './routes/certifications.js';
import importRoutes from './routes/import.js';
import liveRoutes from './routes/live.js';
import stravaRoutes from './routes/strava.js';

export { db };

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/production', productionRoutes);
app.use('/api/oee', oeeRoutes);
app.use('/api/headcount', headcountRoutes);
app.use('/api/certifications', certRoutes);
app.use('/api/import', importRoutes);
app.use('/api/live', liveRoutes);
app.use('/api/strava', stravaRoutes);

app.get('/api/health', (_, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
