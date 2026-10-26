import dotenv from 'dotenv';
dotenv.config();

function sanitizeEnv(val?: string): string {
  if (!val) return '';
  let s = val.trim();
  while (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'")) ||
    (s.startsWith('`') && s.endsWith('`'))
  ) {
    s = s.slice(1, -1).trim();
  }
  if ((s.startsWith('\\"') && s.endsWith('\\"')) || (s.startsWith("\\'") && s.endsWith("\\'"))) {
    s = s.slice(2, -2).trim();
  }
  return s;
}

let rawClientId = sanitizeEnv(process.env.GOOGLE_CLIENT_ID);
if (rawClientId.endsWith('.apps.googleusercontent.')) {
  rawClientId = rawClientId + 'com';
} else if (rawClientId.endsWith('.apps.googleusercontent')) {
  rawClientId = rawClientId + '.com';
}

const rawClientSecret = sanitizeEnv(process.env.GOOGLE_CLIENT_SECRET);
const rawRefreshToken = sanitizeEnv(process.env.GOOGLE_DRIVE_REFRESH_TOKEN);

const isProd = process.env.NODE_ENV === 'production';
const apiBase = sanitizeEnv(process.env.API_BASE_URL || (isProd ? 'https://mediaverse-3p89.onrender.com' : 'http://localhost:3001')).replace(/\/$/, '');
const defaultRedirect = `${apiBase}/api/v1/drive/oauth2callback`;
const redirectUri = sanitizeEnv(process.env.GOOGLE_REDIRECT_URI) || defaultRedirect;

const appBaseUrl = sanitizeEnv(process.env.APP_BASE_URL) || (isProd ? 'https://media-verse-nine.vercel.app' : 'http://localhost:5173');

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3001', 10),
  appBaseUrl,
  devJwtSecret: process.env.DEV_JWT_SECRET || 'mediaverse-dev-super-secret-key-change-in-prod',
  
  // Supabase (Optional in local development)
  supabase: {
    url: sanitizeEnv(process.env.SUPABASE_URL),
    serviceRoleKey: sanitizeEnv(process.env.SUPABASE_SERVICE_ROLE_KEY),
    isConfigured: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
  },

  // Google Drive
  google: {
    clientId: rawClientId,
    clientSecret: rawClientSecret,
    redirectUri,
    rootFolderId: sanitizeEnv(process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID) || '1PNvblS0BffXR12av3dC7fP7wNdf948kO',
    rootFolderUrl: sanitizeEnv(process.env.GOOGLE_DRIVE_ROOT_FOLDER_URL) || 'https://drive.google.com/drive/folders/1PNvblS0BffXR12av3dC7fP7wNdf948kO',
    refreshToken: rawRefreshToken,
    userEmail: sanitizeEnv(process.env.GOOGLE_DRIVE_USER_EMAIL) || 'rikhiritik8@gmail.com',
    isConfigured: Boolean(rawClientId && rawClientSecret)
  },

  // Gemini AI
  gemini: {
    apiKey: sanitizeEnv(process.env.GEMINI_API_KEY),
    model: sanitizeEnv(process.env.GEMINI_MODEL) || 'gemini-3.5-flash-lite',
    isConfigured: Boolean(process.env.GEMINI_API_KEY)
  }
};
