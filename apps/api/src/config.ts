import dotenv from 'dotenv';
dotenv.config();

let rawClientId = (process.env.GOOGLE_CLIENT_ID || '').trim();
if (rawClientId.endsWith('.apps.googleusercontent.')) {
  rawClientId = rawClientId + 'com';
} else if (rawClientId.endsWith('.apps.googleusercontent')) {
  rawClientId = rawClientId + '.com';
}

const rawClientSecret = (process.env.GOOGLE_CLIENT_SECRET || '').trim();

const isProd = process.env.NODE_ENV === 'production';
const apiBase = (process.env.API_BASE_URL || (isProd ? 'https://mediaverse-3p89.onrender.com' : 'http://localhost:3001')).replace(/\/$/, '');
const defaultRedirect = `${apiBase}/api/v1/drive/oauth2callback`;
const redirectUri = (process.env.GOOGLE_REDIRECT_URI || '').trim() || defaultRedirect;

const appBaseUrl = (process.env.APP_BASE_URL || '').trim() || (isProd ? 'https://media-verse-nine.vercel.app' : 'http://localhost:5173');

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3001', 10),
  appBaseUrl,
  devJwtSecret: process.env.DEV_JWT_SECRET || 'mediaverse-dev-super-secret-key-change-in-prod',
  
  // Supabase (Optional in local development)
  supabase: {
    url: process.env.SUPABASE_URL || '',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    isConfigured: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
  },

  // Google Drive
  google: {
    clientId: rawClientId,
    clientSecret: rawClientSecret,
    redirectUri,
    rootFolderId: process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID || '1PNvblS0BffXR12av3dC7fP7wNdf948kO',
    rootFolderUrl: process.env.GOOGLE_DRIVE_ROOT_FOLDER_URL || 'https://drive.google.com/drive/folders/1PNvblS0BffXR12av3dC7fP7wNdf948kO',
    refreshToken: (process.env.GOOGLE_DRIVE_REFRESH_TOKEN || '').trim(),
    userEmail: (process.env.GOOGLE_DRIVE_USER_EMAIL || '').trim(),
    isConfigured: Boolean(rawClientId && rawClientSecret)
  },

  // Gemini AI
  gemini: {
    apiKey: process.env.GEMINI_API_KEY || '',
    model: process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite',
    isConfigured: Boolean(process.env.GEMINI_API_KEY)
  }
};
