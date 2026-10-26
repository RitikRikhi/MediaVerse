import dotenv from 'dotenv';
dotenv.config();

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3001', 10),
  appBaseUrl: process.env.APP_BASE_URL || 'http://localhost:5173',
  devJwtSecret: process.env.DEV_JWT_SECRET || 'mediaverse-dev-super-secret-key-change-in-prod',
  
  // Supabase (Optional in local development)
  supabase: {
    url: process.env.SUPABASE_URL || '',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    isConfigured: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
  },

  // Google Drive
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    redirectUri: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3001/api/v1/drive/oauth2callback',
    rootFolderId: process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID || '1SdY0hIYAiYGL0DFzyeVjLOssg7sEdSP4',
    rootFolderUrl: process.env.GOOGLE_DRIVE_ROOT_FOLDER_URL || 'https://drive.google.com/drive/u/0/folders/1SdY0hIYAiYGL0DFzyeVjLOssg7sEdSP4',
    isConfigured: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)
  },

  // Gemini AI
  gemini: {
    apiKey: process.env.GEMINI_API_KEY || '',
    model: process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite',
    isConfigured: Boolean(process.env.GEMINI_API_KEY)
  }
};
