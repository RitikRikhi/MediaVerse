import { Router, Request, Response } from 'express';
import { config } from '../config';
import { supabase } from '../db/client';

export const healthRouter = Router();

healthRouter.get('/', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'DSA MediaVerse AI API',
    event: 'SAVISKAR 2026',
    organization: 'DSA Media Crew, CGC University',
    environment: config.env,
    uptime_seconds: Math.floor(process.uptime()),
    data_store: {
      mode: supabase ? 'SUPABASE_CLOUD_POSTGRES' : 'LOCAL_IN_MEMORY_DEV_STORE',
      supabase_configured: config.supabase.isConfigured
    },
    integrations: {
      google_drive: {
        configured: config.google.isConfigured,
        fallback_active: true
      },
      gemini_ai: {
        configured: config.gemini.isConfigured,
        fallback_active: true
      }
    }
  });
});
