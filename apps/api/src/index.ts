import express from 'express';
import cors from 'cors';
import { config } from './config';
import { errorHandler } from './middleware/errorHandler';
import { authRouter } from './routes/auth.routes';
import { eventsRouter } from './routes/events.routes';
import { assignmentsRouter } from './routes/assignments.routes';
import { mediaRouter } from './routes/media.routes';
import { editingRouter } from './routes/editing.routes';
import { reviewsRouter } from './routes/reviews.routes';
import { driveRouter } from './routes/drive.routes';
import { aiRouter } from './routes/ai.routes';
import { reportsRouter } from './routes/reports.routes';
import { notificationsRouter } from './routes/notifications.routes';
import { auditRouter } from './routes/audit.routes';
import { healthRouter } from './routes/health.routes';
import { SupabaseService } from './services/supabaseService';

const app = express();

// Middlewares
app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging (sanitized, no secrets)
app.use((req, _res, next) => {
  if (config.env === 'development') {
    console.log(`[HTTP] ${req.method} ${req.path}`);
  }
  next();
});

// Routes
const API_PREFIX = '/api/v1';

app.use(`${API_PREFIX}/auth`, authRouter);
app.use(`${API_PREFIX}/events`, eventsRouter);
app.use(`${API_PREFIX}/assignments`, assignmentsRouter);
app.use(`${API_PREFIX}/media`, mediaRouter);
app.use(`${API_PREFIX}/editing`, editingRouter);
app.use(`${API_PREFIX}/reviews`, reviewsRouter);
app.use(`${API_PREFIX}/drive`, driveRouter);
app.use(`${API_PREFIX}/ai`, aiRouter);
app.use(`${API_PREFIX}/reports`, reportsRouter);
app.use(`${API_PREFIX}/notifications`, notificationsRouter);
app.use(`${API_PREFIX}/audit`, auditRouter);
app.use(`${API_PREFIX}/health`, healthRouter);

// Root greeting / health
app.get('/', (_req, res) => {
  res.json({
    name: 'DSA MediaVerse AI API',
    event: 'SAVISKAR 2026',
    status: 'online',
    docs: '/api/v1/health'
  });
});

// Central Error Handler
app.use(errorHandler);

if (process.env.NODE_ENV !== 'test') {
  SupabaseService.hydrateFromSupabase().catch(err => {
    console.warn('[SupabaseService] Startup hydration error:', err);
  });

  const server = app.listen(config.port, '0.0.0.0', () => {
    console.log(`=======================================================`);
    console.log(`🎬 DSA MediaVerse AI Backend Server Running`);
    console.log(`📍 Port: ${config.port}`);
    console.log(`🌍 Environment: ${config.env}`);
    console.log(`🎯 Event: SAVISKAR 2026 (Oct 28-29, 2026)`);
    console.log(`🏛️ CGC University Media Crew`);
    console.log(`📡 Health Check: http://localhost:${config.port}${API_PREFIX}/health`);
    console.log(`=======================================================`);
  });

  // Keep alive & headers timeouts for robust large file transfers
  server.keepAliveTimeout = 120000;
  server.headersTimeout = 125000;
}

export { app };
