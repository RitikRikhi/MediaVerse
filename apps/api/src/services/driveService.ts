import { config } from '../config';
import { db } from '../db/memoryStore';
import { MediaFolder } from '@mediaverse/shared-types';
import { SupabaseService } from './supabaseService';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

export interface FolderNode {
  id?: string;
  name: string;
  path: string;
  children?: FolderNode[];
  driveFolderId?: string;
  driveWebUrl?: string;
}

export interface FlatFolderItem {
  id: string;
  name: string;
  path: string;
  parentPath?: string;
  driveFolderId?: string;
  driveWebUrl?: string;
  level: number;
}

export interface DriveTokenState {
  accessToken?: string;
  refreshToken?: string;
  expiryDate?: number;
  connectedAt?: string;
  userEmail?: string;
  activeRootFolderId?: string;
  activeRootFolderUrl?: string;
}

export interface UploadDestination {
  day: 'Day 1' | 'Day 2';
  category: 'Photography' | 'Raw Videography' | 'Editing Projects' | 'Review Versions' | 'Approved Deliverables';
  fullPath: string;
  folderName: string;
  driveFolderId: string;
  driveFolderUrl: string;
}

const TOKEN_FILE_NAME = '.drive_tokens.json';
const STRUCTURE_FILE_NAME = '.drive_structure.json';

function getTokenFilePaths(): string[] {
  return [
    path.join(process.cwd(), TOKEN_FILE_NAME),
    path.join(process.cwd(), 'apps', 'api', TOKEN_FILE_NAME),
    path.resolve(__dirname, '../../', TOKEN_FILE_NAME),
    path.resolve(__dirname, '../../../', TOKEN_FILE_NAME)
  ];
}

function resolveTokenFilePath(): string {
  for (const p of getTokenFilePaths()) {
    if (fs.existsSync(p)) return p;
  }
  return path.join(process.cwd(), TOKEN_FILE_NAME);
}

function getStructureFilePaths(): string[] {
  return [
    path.join(process.cwd(), STRUCTURE_FILE_NAME),
    path.join(process.cwd(), 'apps', 'api', STRUCTURE_FILE_NAME),
    path.resolve(__dirname, '../../', STRUCTURE_FILE_NAME),
    path.resolve(__dirname, '../../../', STRUCTURE_FILE_NAME)
  ];
}

function resolveStructureFilePath(): string {
  for (const p of getStructureFilePaths()) {
    if (fs.existsSync(p)) return p;
  }
  return path.join(process.cwd(), STRUCTURE_FILE_NAME);
}

export class DriveService {
  private static tokenState: DriveTokenState = {};
  private static folderIdCache = new Map<string, string>();

  static init(): void {
    this.loadTokensFromDisk();

    const masterRefreshToken = config.google.refreshToken;

    // If no tokens on disk, auto-hydrate with configured master refresh token
    if (!this.tokenState.refreshToken && masterRefreshToken) {
      this.tokenState = {
        ...this.tokenState,
        refreshToken: masterRefreshToken,
        userEmail: config.google.userEmail || 'rikhiritik8@gmail.com',
        activeRootFolderId: config.google.rootFolderId || '1PNvblS0BffXR12av3dC7fP7wNdf948kO',
        activeRootFolderUrl: config.google.rootFolderUrl || 'https://drive.google.com/drive/folders/1PNvblS0BffXR12av3dC7fP7wNdf948kO',
        connectedAt: new Date().toISOString()
      };
      console.log(`[DriveService] Initialized Google Drive with master refresh token for ${this.tokenState.userEmail}`);
    }

    // Proactively refresh access token if refresh token is present
    if (this.tokenState.refreshToken && (!this.tokenState.accessToken || !this.tokenState.expiryDate || Date.now() > this.tokenState.expiryDate - 120000)) {
      this.refreshAccessToken().then(tok => {
        if (tok) {
          console.log('[DriveService] Master Google Drive access token ready and active.');
        }
      }).catch(err => {
        console.warn('[DriveService] Initial master token refresh warning:', err.message);
      });
    }
  }

  static loadTokensFromDisk(): void {
    try {
      for (const p of getTokenFilePaths()) {
        if (fs.existsSync(p)) {
          const raw = fs.readFileSync(p, 'utf-8');
          const parsed = JSON.parse(raw);
          if (parsed && (parsed.accessToken || parsed.refreshToken)) {
            this.tokenState = parsed;
            console.log(`[DriveService] Loaded persisted Google Drive tokens from ${p}. (User: ${parsed.userEmail || 'Authenticated'})`);
            return;
          }
        }
      }
    } catch (err: any) {
      console.warn('[DriveService] Failed to load persisted tokens:', err.message);
    }
  }

  static saveTokensToDisk(): void {
    try {
      const targetPath = resolveTokenFilePath();
      fs.writeFileSync(targetPath, JSON.stringify(this.tokenState, null, 2), 'utf-8');
      console.log(`[DriveService] Persisted Google Drive tokens to ${targetPath}`);
    } catch (err: any) {
      console.warn('[DriveService] Failed to persist tokens to disk:', err.message);
    }
  }

  static async refreshAccessToken(): Promise<string | null> {
    let cleanToken = (this.tokenState.refreshToken || '').trim();
    while (
      (cleanToken.startsWith('"') && cleanToken.endsWith('"')) ||
      (cleanToken.startsWith("'") && cleanToken.endsWith("'")) ||
      (cleanToken.startsWith('`') && cleanToken.endsWith('`'))
    ) {
      cleanToken = cleanToken.slice(1, -1).trim();
    }
    if ((cleanToken.startsWith('\\"') && cleanToken.endsWith('\\"')) || (cleanToken.startsWith("\\'") && cleanToken.endsWith("\\'"))) {
      cleanToken = cleanToken.slice(2, -2).trim();
    }

    if (!cleanToken) {
      console.warn('[DriveService] No refresh token available to refresh access token.');
      return null;
    }
    this.tokenState.refreshToken = cleanToken;

    try {
      console.log(`[DriveService] Refreshing Google Drive OAuth access token (Token length: ${cleanToken.length}, starts with: ${cleanToken.slice(0, 7)}..., clientId length: ${config.google.clientId.length})...`);
      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: config.google.clientId,
          client_secret: config.google.clientSecret,
          refresh_token: cleanToken,
          grant_type: 'refresh_token'
        })
      });

      if (!response.ok) {
        const err = await response.text();
        console.warn(`[DriveService] Token refresh rejected by Google (${response.status}):`, err);
        return null;
      }

      const data = (await response.json()) as any;
      this.tokenState.accessToken = data.access_token;
      this.tokenState.expiryDate = Date.now() + (data.expires_in || 3600) * 1000;
      this.saveTokensToDisk();
      console.log('[DriveService] Google Drive access token refreshed successfully.');
      return this.tokenState.accessToken || null;
    } catch (err: any) {
      console.error('[DriveService] Error during token refresh:', err.message);
      return null;
    }
  }

  static async getValidAccessToken(): Promise<string | null> {
    if (!this.tokenState.accessToken && !this.tokenState.refreshToken) {
      this.loadTokensFromDisk();
      if (!this.tokenState.accessToken && !this.tokenState.refreshToken) {
        const masterRefreshToken = config.google.refreshToken;
        if (masterRefreshToken) {
          this.tokenState.refreshToken = masterRefreshToken;
          this.tokenState.userEmail = config.google.userEmail || 'rikhiritik8@gmail.com';
          this.tokenState.activeRootFolderId = config.google.rootFolderId || '1PNvblS0BffXR12av3dC7fP7wNdf948kO';
          this.tokenState.activeRootFolderUrl = config.google.rootFolderUrl || 'https://drive.google.com/drive/folders/1PNvblS0BffXR12av3dC7fP7wNdf948kO';
        } else {
          return null;
        }
      }
    }

    const isExpired = this.tokenState.expiryDate ? Date.now() > this.tokenState.expiryDate - 120000 : false;
    if ((!this.tokenState.accessToken || isExpired) && this.tokenState.refreshToken) {
      const refreshed = await this.refreshAccessToken();
      if (refreshed) return refreshed;
    }

    return this.tokenState.accessToken || null;
  }

  static async resolveRootFolderId(): Promise<{ id: string; url: string }> {
    if (this.tokenState.activeRootFolderId) {
      return {
        id: this.tokenState.activeRootFolderId,
        url: this.tokenState.activeRootFolderUrl || `https://drive.google.com/drive/folders/${this.tokenState.activeRootFolderId}`
      };
    }

    const token = await this.getValidAccessToken();
    const configuredId = config.google.rootFolderId || '1PNvblS0BffXR12av3dC7fP7wNdf948kO';
    const configuredUrl = config.google.rootFolderUrl || `https://drive.google.com/drive/folders/${configuredId}`;

    if (!token) {
      return { id: configuredId, url: configuredUrl };
    }

    // 1. Check if configured root folder is accessible by the authenticated user
    try {
      const checkRes = await fetch(`https://www.googleapis.com/drive/v3/files/${configuredId}?supportsAllDrives=true&fields=id,name,webViewLink,trashed`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (checkRes.ok) {
        const data = (await checkRes.json()) as any;
        if (!data.trashed) {
          this.tokenState.activeRootFolderId = data.id;
          this.tokenState.activeRootFolderUrl = data.webViewLink || `https://drive.google.com/drive/folders/${data.id}`;
          this.saveTokensToDisk();
          console.log(`[DriveService] Configured root folder verified accessible: ${data.id}`);
          return { id: data.id, url: this.tokenState.activeRootFolderUrl || `https://drive.google.com/drive/folders/${data.id}` };
        }
      } else {
        console.warn(`[DriveService] Configured root folder "${configuredId}" not accessible (${checkRes.status}). Auto-resolving in user's Drive...`);
      }
    } catch (err: any) {
      console.warn('[DriveService] Error checking root folder:', err.message);
    }

    // 2. Search for existing "DSA MEDIAVERSE SAVISKAR 26" folder in authenticated user's Drive
    try {
      const query = `name = 'DSA MEDIAVERSE SAVISKAR 26' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
      const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,webViewLink)&supportsAllDrives=true&includeItemsFromAllDrives=true`;
      const searchRes = await fetch(searchUrl, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (searchRes.ok) {
        const searchData = (await searchRes.json()) as any;
        if (searchData.files && searchData.files.length > 0) {
          const found = searchData.files[0];
          this.tokenState.activeRootFolderId = found.id;
          this.tokenState.activeRootFolderUrl = found.webViewLink || `https://drive.google.com/drive/folders/${found.id}`;
          this.saveTokensToDisk();
          console.log(`[DriveService] Found existing DSA MEDIAVERSE SAVISKAR 26 folder: ${found.id}`);
          return { id: found.id, url: this.tokenState.activeRootFolderUrl || `https://drive.google.com/drive/folders/${found.id}` };
        }
      }
    } catch (err: any) {
      console.warn('[DriveService] Folder search error:', err.message);
    }

    // 3. Create "DSA MEDIAVERSE SAVISKAR 26" automatically in user's Drive
    try {
      console.log('[DriveService] Creating new "DSA MEDIAVERSE SAVISKAR 26" root folder in user Google Drive...');
      const createRes = await fetch('https://www.googleapis.com/drive/v3/files?supportsAllDrives=true&fields=id,name,webViewLink', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: 'DSA MEDIAVERSE SAVISKAR 26',
          mimeType: 'application/vnd.google-apps.folder'
        })
      });

      if (createRes.ok) {
        const created = (await createRes.json()) as any;
        this.tokenState.activeRootFolderId = created.id;
        this.tokenState.activeRootFolderUrl = created.webViewLink || `https://drive.google.com/drive/folders/${created.id}`;
        this.saveTokensToDisk();
        console.log(`[DriveService] Successfully created DSA MEDIAVERSE SAVISKAR 26 root folder: ${created.id}`);
        return { id: created.id, url: this.tokenState.activeRootFolderUrl || `https://drive.google.com/drive/folders/${created.id}` };
      }
    } catch (err: any) {
      console.error('[DriveService] Failed to create root folder:', err.message);
    }

    return { id: configuredId, url: configuredUrl };
  }

  static getStatus() {
    if (!this.tokenState.refreshToken && !this.tokenState.accessToken) {
      const masterRefreshToken = config.google.refreshToken;
      if (masterRefreshToken) {
        this.tokenState.refreshToken = masterRefreshToken;
        this.tokenState.userEmail = config.google.userEmail || 'rikhiritik8@gmail.com';
        this.tokenState.activeRootFolderId = config.google.rootFolderId || '1PNvblS0BffXR12av3dC7fP7wNdf948kO';
        this.tokenState.activeRootFolderUrl = config.google.rootFolderUrl || 'https://drive.google.com/drive/folders/1PNvblS0BffXR12av3dC7fP7wNdf948kO';
      }
    }

    const hasToken = Boolean(this.tokenState.accessToken || this.tokenState.refreshToken);
    const rootId = this.tokenState.activeRootFolderId || config.google.rootFolderId || '1PNvblS0BffXR12av3dC7fP7wNdf948kO';
    const rootUrl = this.tokenState.activeRootFolderUrl || config.google.rootFolderUrl || `https://drive.google.com/drive/folders/${rootId}`;

    return {
      isConfigured: config.google.isConfigured,
      clientIdConfigured: Boolean(config.google.clientId),
      clientSecretConfigured: Boolean(config.google.clientSecret),
      rootFolderId: rootId,
      rootFolderUrl: rootUrl,
      folderTitle: 'DSA MEDIAVERSE SAVISKAR 26',
      authUrl: this.getOAuthUrl(),
      isConnected: hasToken,
      userEmail: this.tokenState.userEmail || 'rikhiritik8@gmail.com',
      connectedAt: this.tokenState.connectedAt || new Date().toISOString(),
      mode: hasToken ? 'LIVE_GOOGLE_DRIVE_API' : 'AWAITING_GOOGLE_AUTH'
    };
  }

  static getOAuthUrl(stateParam?: string): string {
    if (!config.google.clientId) return '';
    const scopes = [
      'https://www.googleapis.com/auth/drive',
      'https://www.googleapis.com/auth/drive.file',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile'
    ].join(' ');

    const params = new URLSearchParams({
      client_id: config.google.clientId,
      redirect_uri: config.google.redirectUri,
      response_type: 'code',
      scope: scopes,
      access_type: 'offline',
      prompt: 'consent',
      include_granted_scopes: 'true'
    });

    if (stateParam) {
      params.append('state', stateParam);
    }

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  static async exchangeCodeForToken(code: string): Promise<{ success: boolean; message: string; tokens?: any }> {
    try {
      console.log('[DriveService] Exchanging OAuth authorization code with Google...');
      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: config.google.clientId,
          client_secret: config.google.clientSecret,
          redirect_uri: config.google.redirectUri,
          grant_type: 'authorization_code'
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        console.warn('[DriveService] Code exchange rejected by Google:', errText);
        return { success: false, message: `OAuth token exchange failed: ${errText}` };
      }

      const data = (await response.json()) as any;

      // Retrieve user email to display connected Google account in UI
      let userEmail: string | undefined;
      try {
        const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
          headers: { Authorization: `Bearer ${data.access_token}` }
        });
        if (userRes.ok) {
          const userData = (await userRes.json()) as any;
          userEmail = userData.email;
        }
      } catch (err: any) {
        console.warn('[DriveService] Could not retrieve userinfo:', err.message);
      }

      this.tokenState = {
        accessToken: data.access_token,
        refreshToken: data.refresh_token || this.tokenState.refreshToken,
        expiryDate: Date.now() + (data.expires_in || 3600) * 1000,
        connectedAt: new Date().toISOString(),
        userEmail
      };

      this.saveTokensToDisk();
      console.log(`[DriveService] Successfully authenticated Google Drive account: ${userEmail || 'Active'}`);

      // Auto-provision standardized folder hierarchy in real Google Drive root
      try {
        await this.provisionFolderHierarchy(db.events[0]?.id || 'saviskar-2026');
      } catch (e: any) {
        console.warn('[DriveService] Post-auth provision error:', e.message);
      }

      return {
        success: true,
        message: `Google Drive successfully connected for ${userEmail || 'DSA Media Crew'}.`,
        tokens: this.tokenState
      };
    } catch (err: any) {
      console.error('[DriveService] Code exchange error:', err.message);
      return { success: false, message: err.message || 'Network error exchanging OAuth code.' };
    }
  }

  static disconnect(): void {
    this.tokenState = {};
    this.folderIdCache.clear();
    for (const p of getTokenFilePaths()) {
      if (fs.existsSync(p)) {
        try {
          fs.unlinkSync(p);
        } catch {}
      }
    }
    console.log('[DriveService] Google Drive disconnected and local credentials removed.');
  }

  // Predefined comprehensive SAVISKAR 2026 folder hierarchy
  static getRecommendedHierarchy(): FolderNode {
    return {
      name: 'DSA MEDIAVERSE SAVISKAR 26',
      path: '/DSA MEDIAVERSE SAVISKAR 26',
      children: [
        {
          name: 'Day 1 - Inauguration & Hackathon',
          path: '/DSA MEDIAVERSE SAVISKAR 26/Day 1 - Inauguration & Hackathon',
          children: [
            {
              name: 'Photography',
              path: '/DSA MEDIAVERSE SAVISKAR 26/Day 1 - Inauguration & Hackathon/Photography',
              children: [
                { name: 'Lamp Lighting & Ceremonial', path: '/DSA MEDIAVERSE SAVISKAR 26/Day 1 - Inauguration & Hackathon/Photography/Lamp Lighting & Ceremonial' },
                { name: 'VIP Dignitaries & Guests', path: '/DSA MEDIAVERSE SAVISKAR 26/Day 1 - Inauguration & Hackathon/Photography/VIP Dignitaries & Guests' },
                { name: 'Audience & Atmosphere', path: '/DSA MEDIAVERSE SAVISKAR 26/Day 1 - Inauguration & Hackathon/Photography/Audience & Atmosphere' }
              ]
            },
            {
              name: 'Raw Videography',
              path: '/DSA MEDIAVERSE SAVISKAR 26/Day 1 - Inauguration & Hackathon/Raw Videography',
              children: [
                { name: 'Stage 4K Multicam', path: '/DSA MEDIAVERSE SAVISKAR 26/Day 1 - Inauguration & Hackathon/Raw Videography/Stage 4K Multicam' },
                { name: 'B-Roll & Atmosphere', path: '/DSA MEDIAVERSE SAVISKAR 26/Day 1 - Inauguration & Hackathon/Raw Videography/B-Roll & Atmosphere' },
                { name: 'Interviews & Testimonials', path: '/DSA MEDIAVERSE SAVISKAR 26/Day 1 - Inauguration & Hackathon/Raw Videography/Interviews & Testimonials' }
              ]
            },
            { name: 'Editing Projects', path: '/DSA MEDIAVERSE SAVISKAR 26/Day 1 - Inauguration & Hackathon/Editing Projects' },
            { name: 'Review Versions', path: '/DSA MEDIAVERSE SAVISKAR 26/Day 1 - Inauguration & Hackathon/Review Versions' },
            { name: 'Approved Deliverables', path: '/DSA MEDIAVERSE SAVISKAR 26/Day 1 - Inauguration & Hackathon/Approved Deliverables' }
          ]
        },
        {
          name: 'Day 2 - Technical Battles & Cultural Night',
          path: '/DSA MEDIAVERSE SAVISKAR 26/Day 2 - Technical Battles & Cultural Night',
          children: [
            {
              name: 'Photography',
              path: '/DSA MEDIAVERSE SAVISKAR 26/Day 2 - Technical Battles & Cultural Night/Photography',
              children: [
                { name: 'Hackathon Pitches & Project Expo', path: '/DSA MEDIAVERSE SAVISKAR 26/Day 2 - Technical Battles & Cultural Night/Photography/Hackathon Pitches & Project Expo' },
                { name: 'Workshops & Coding Battles', path: '/DSA MEDIAVERSE SAVISKAR 26/Day 2 - Technical Battles & Cultural Night/Photography/Workshops & Coding Battles' },
                { name: 'Star Night & Stage Performances', path: '/DSA MEDIAVERSE SAVISKAR 26/Day 2 - Technical Battles & Cultural Night/Photography/Star Night & Stage Performances' }
              ]
            },
            {
              name: 'Raw Videography',
              path: '/DSA MEDIAVERSE SAVISKAR 26/Day 2 - Technical Battles & Cultural Night/Raw Videography',
              children: [
                { name: 'Project Demos & Student Reactions', path: '/DSA MEDIAVERSE SAVISKAR 26/Day 2 - Technical Battles & Cultural Night/Raw Videography/Project Demos & Student Reactions' },
                { name: 'Cultural Performances 4K', path: '/DSA MEDIAVERSE SAVISKAR 26/Day 2 - Technical Battles & Cultural Night/Raw Videography/Cultural Performances 4K' },
                { name: 'Star Night Highlights', path: '/DSA MEDIAVERSE SAVISKAR 26/Day 2 - Technical Battles & Cultural Night/Raw Videography/Star Night Highlights' }
              ]
            },
            { name: 'Editing Projects', path: '/DSA MEDIAVERSE SAVISKAR 26/Day 2 - Technical Battles & Cultural Night/Editing Projects' },
            { name: 'Review Versions', path: '/DSA MEDIAVERSE SAVISKAR 26/Day 2 - Technical Battles & Cultural Night/Review Versions' },
            { name: 'Approved Deliverables', path: '/DSA MEDIAVERSE SAVISKAR 26/Day 2 - Technical Battles & Cultural Night/Approved Deliverables' }
          ]
        },
        {
          name: 'Day 3 - Award Ceremony & Valedictory',
          path: '/DSA MEDIAVERSE SAVISKAR 26/Day 3 - Award Ceremony & Valedictory',
          children: [
            { name: 'Photography - Trophies & Medals', path: '/DSA MEDIAVERSE SAVISKAR 26/Day 3 - Award Ceremony & Valedictory/Photography - Trophies & Medals' },
            { name: 'Photography - Winner Celebrations', path: '/DSA MEDIAVERSE SAVISKAR 26/Day 3 - Award Ceremony & Valedictory/Photography - Winner Celebrations' },
            { name: 'Raw Videography - Valedictory Speeches', path: '/DSA MEDIAVERSE SAVISKAR 26/Day 3 - Award Ceremony & Valedictory/Raw Videography - Valedictory Speeches' },
            { name: 'Approved Deliverables', path: '/DSA MEDIAVERSE SAVISKAR 26/Day 3 - Award Ceremony & Valedictory/Approved Deliverables' }
          ]
        },
        {
          name: 'Social Media & Quick Reels Vault',
          path: '/DSA MEDIAVERSE SAVISKAR 26/Social Media & Quick Reels Vault',
          children: [
            { name: 'Instagram Reels (9x16 Vertical)', path: '/DSA MEDIAVERSE SAVISKAR 26/Social Media & Quick Reels Vault/Instagram Reels (9x16 Vertical)' },
            { name: 'YouTube Shorts & Highlights', path: '/DSA MEDIAVERSE SAVISKAR 26/Social Media & Quick Reels Vault/YouTube Shorts & Highlights' }
          ]
        },
        {
          name: 'Branding & Official Crew Assets',
          path: '/DSA MEDIAVERSE SAVISKAR 26/Branding & Official Crew Assets',
          children: [
            { name: 'Logos & Watermarks', path: '/DSA MEDIAVERSE SAVISKAR 26/Branding & Official Crew Assets/Logos & Watermarks' },
            { name: 'Motion Lower Thirds & Intro Jingles', path: '/DSA MEDIAVERSE SAVISKAR 26/Branding & Official Crew Assets/Motion Lower Thirds & Intro Jingles' }
          ]
        }
      ]
    };
  }

  // Load active folder structure from disk or fallback to recommended default
  static getFolderStructure(): FolderNode {
    try {
      for (const p of getStructureFilePaths()) {
        if (fs.existsSync(p)) {
          const raw = fs.readFileSync(p, 'utf-8');
          const parsed = JSON.parse(raw);
          if (parsed && parsed.name && parsed.children) {
            if (this.tokenState.activeRootFolderId && !parsed.driveFolderId) {
              parsed.driveFolderId = this.tokenState.activeRootFolderId;
              parsed.driveWebUrl = this.tokenState.activeRootFolderUrl || `https://drive.google.com/drive/folders/${this.tokenState.activeRootFolderId}`;
            }
            return parsed;
          }
        }
      }
    } catch (err: any) {
      console.warn('[DriveService] Error loading structure from disk:', err.message);
    }

    const defaultHierarchy = this.getRecommendedHierarchy();
    if (this.tokenState.activeRootFolderId) {
      defaultHierarchy.driveFolderId = this.tokenState.activeRootFolderId;
      defaultHierarchy.driveWebUrl = this.tokenState.activeRootFolderUrl || `https://drive.google.com/drive/folders/${this.tokenState.activeRootFolderId}`;
    }
    this.saveFolderStructureToDisk(defaultHierarchy);
    return defaultHierarchy;
  }

  // Save active folder structure to disk
  static saveFolderStructureToDisk(root: FolderNode): void {
    try {
      const targetPath = resolveStructureFilePath();
      fs.writeFileSync(targetPath, JSON.stringify(root, null, 2), 'utf-8');
      console.log(`[DriveService] Persisted folder structure to ${targetPath}`);
    } catch (err: any) {
      console.warn('[DriveService] Failed to persist folder structure to disk:', err.message);
    }
  }

  // Flatten hierarchy into selectable list for dropdowns with level indentation
  static flattenHierarchy(node: FolderNode, level = 0, parentPath = ''): FlatFolderItem[] {
    const list: FlatFolderItem[] = [];
    list.push({
      id: node.driveFolderId || node.path,
      name: node.name,
      path: node.path,
      parentPath: parentPath || undefined,
      driveFolderId: node.driveFolderId,
      driveWebUrl: node.driveWebUrl,
      level
    });

    if (node.children) {
      for (const child of node.children) {
        list.push(...this.flattenHierarchy(child, level + 1, node.path));
      }
    }
    return list;
  }

  static getFlatFolderList(): FlatFolderItem[] {
    const root = this.getFolderStructure();
    return this.flattenHierarchy(root);
  }

  static nodeMatches(node: FolderNode, target: string): boolean {
    if (node.path.toLowerCase() === target.toLowerCase()) return true;
    if (node.name.toLowerCase() === target.toLowerCase()) return true;
    if (node.driveFolderId && node.driveFolderId === target) return true;
    return false;
  }

  static findNodeByPath(root: FolderNode, targetPath: string): FolderNode | null {
    if (root.path === targetPath) return root;
    if (this.nodeMatches(root, targetPath)) return root;

    if (root.children) {
      for (const child of root.children) {
        const found = this.findNodeByPath(child, targetPath);
        if (found) return found;
      }
    }
    return null;
  }

  static findParentOfPath(root: FolderNode, targetPath: string): { parent: FolderNode; index: number } | null {
    if (!root.children) return null;
    const idx = root.children.findIndex(c => c.path === targetPath || this.nodeMatches(c, targetPath));
    if (idx !== -1) {
      return { parent: root, index: idx };
    }
    for (const child of root.children) {
      const found = this.findParentOfPath(child, targetPath);
      if (found) return found;
    }
    return null;
  }

  static recalculatePaths(node: FolderNode, parentPath: string): void {
    node.path = `${parentPath}/${node.name}`;
    if (node.children) {
      for (const child of node.children) {
        this.recalculatePaths(child, node.path);
      }
    }
  }

  // Add folder dynamically to hierarchy and create on Google Drive if authenticated
  static async addFolder(parentPath: string, folderName: string): Promise<{
    success: boolean;
    structure: FolderNode;
    flatList: FlatFolderItem[];
    newFolder: FolderNode;
  }> {
    const cleanName = folderName.trim();
    if (!cleanName) throw new Error('Folder name cannot be empty.');

    const root = this.getFolderStructure();
    const parentNode = this.findNodeByPath(root, parentPath);
    if (!parentNode) {
      throw new Error(`Parent folder "${parentPath}" not found.`);
    }

    parentNode.children = parentNode.children || [];
    if (parentNode.children.some(c => c.name.toLowerCase() === cleanName.toLowerCase())) {
      throw new Error(`Folder "${cleanName}" already exists inside "${parentNode.name}".`);
    }

    const newPath = `${parentNode.path}/${cleanName}`;
    const newNode: FolderNode = {
      id: crypto.randomUUID(),
      name: cleanName,
      path: newPath,
      children: []
    };

    // If Google Drive is authenticated and parent has a Drive folder ID, create it right away in Google Drive!
    const token = await this.getValidAccessToken();
    const parentDriveId = parentNode.driveFolderId || (parentNode === root ? (await this.resolveRootFolderId()).id : undefined);

    if (token && parentDriveId) {
      try {
        const driveId = await this.getOrCreateDriveFolder(cleanName, parentDriveId);
        newNode.driveFolderId = driveId;
        newNode.driveWebUrl = `https://drive.google.com/drive/folders/${driveId}`;
        console.log(`[DriveService] Added folder "${cleanName}" directly into Google Drive (ID: ${driveId})`);
      } catch (err: any) {
        console.warn(`[DriveService] Immediate drive folder creation notice: ${err.message}`);
      }
    }

    parentNode.children.push(newNode);
    this.saveFolderStructureToDisk(root);

    return {
      success: true,
      structure: root,
      flatList: this.flattenHierarchy(root),
      newFolder: newNode
    };
  }

  // Rename a folder and update its name in Google Drive if connected
  static async renameFolder(folderPath: string, newName: string): Promise<{
    success: boolean;
    structure: FolderNode;
    flatList: FlatFolderItem[];
  }> {
    const cleanName = newName.trim();
    if (!cleanName) throw new Error('New folder name cannot be empty.');

    const root = this.getFolderStructure();
    const parentInfo = this.findParentOfPath(root, folderPath);
    if (!parentInfo) throw new Error(`Cannot rename root folder or folder "${folderPath}" not found.`);

    const node = parentInfo.parent.children![parentInfo.index];
    node.name = cleanName;

    if (node.driveFolderId) {
      const token = await this.getValidAccessToken();
      if (token) {
        try {
          await fetch(`https://www.googleapis.com/drive/v3/files/${node.driveFolderId}?supportsAllDrives=true`, {
            method: 'PATCH',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name: cleanName })
          });
          console.log(`[DriveService] Renamed folder ID ${node.driveFolderId} to "${cleanName}" in Google Drive`);
        } catch (err: any) {
          console.warn(`[DriveService] Drive folder rename error: ${err.message}`);
        }
      }
    }

    this.recalculatePaths(node, parentInfo.parent.path);
    this.saveFolderStructureToDisk(root);

    return {
      success: true,
      structure: root,
      flatList: this.flattenHierarchy(root)
    };
  }

  // Delete a folder and its subtree from the active hierarchy
  static async deleteFolder(folderPath: string): Promise<{
    success: boolean;
    structure: FolderNode;
    flatList: FlatFolderItem[];
  }> {
    const root = this.getFolderStructure();
    const parentInfo = this.findParentOfPath(root, folderPath);
    if (!parentInfo) throw new Error(`Folder "${folderPath}" not found or cannot delete root folder.`);

    parentInfo.parent.children!.splice(parentInfo.index, 1);
    this.saveFolderStructureToDisk(root);

    return {
      success: true,
      structure: root,
      flatList: this.flattenHierarchy(root)
    };
  }

  // Reset folder hierarchy back to recommended standard SAVISKAR 2026 structure
  static resetStructure(): { success: boolean; structure: FolderNode; flatList: FlatFolderItem[] } {
    const defaultStructure = this.getRecommendedHierarchy();
    if (this.tokenState.activeRootFolderId) {
      defaultStructure.driveFolderId = this.tokenState.activeRootFolderId;
      defaultStructure.driveWebUrl = this.tokenState.activeRootFolderUrl || `https://drive.google.com/drive/folders/${this.tokenState.activeRootFolderId}`;
    }
    this.saveFolderStructureToDisk(defaultStructure);
    return {
      success: true,
      structure: defaultStructure,
      flatList: this.flattenHierarchy(defaultStructure)
    };
  }

  // Recursively provision/sync all folders in the hierarchy directly into Google Drive
  static async syncAllFoldersToGoogleDrive(eventId: string = 'saviskar-2026'): Promise<{
    success: boolean;
    syncedCount: number;
    structure: FolderNode;
    flatList: FlatFolderItem[];
    message: string;
  }> {
    const token = await this.getValidAccessToken();
    if (!token) {
      throw new Error('GOOGLE_DRIVE_NOT_CONNECTED: Please connect Google Drive first.');
    }

    const root = await this.resolveRootFolderId();
    const rootDriveId = root.id;
    const rootNode = this.getFolderStructure();

    rootNode.driveFolderId = rootDriveId;
    rootNode.driveWebUrl = root.url || `https://drive.google.com/drive/folders/${rootDriveId}`;

    let syncedCount = 0;

    const syncNodeRecursive = async (node: FolderNode, parentDriveId: string) => {
      if (node.children && node.children.length > 0) {
        for (const child of node.children) {
          let childDriveId = child.driveFolderId;
          if (!childDriveId) {
            childDriveId = await DriveService.getOrCreateDriveFolder(child.name, parentDriveId);
            child.driveFolderId = childDriveId;
            child.driveWebUrl = `https://drive.google.com/drive/folders/${childDriveId}`;
            syncedCount++;
          }

          // Register in database & Supabase
          const existingRecord = db.mediaFolders.find(f => f.folder_path === child.path);
          if (existingRecord) {
            existingRecord.drive_folder_id = childDriveId;
            existingRecord.drive_web_url = `https://drive.google.com/drive/folders/${childDriveId}`;
            await SupabaseService.persistMediaFolder(existingRecord).catch(() => {});
          } else {
            const newRecord: MediaFolder = {
              id: crypto.randomUUID(),
              event_id: eventId,
              folder_name: child.name,
              folder_path: child.path,
              drive_folder_id: childDriveId,
              drive_web_url: `https://drive.google.com/drive/folders/${childDriveId}`,
              is_system_created: true,
              created_at: new Date().toISOString()
            };
            db.mediaFolders.push(newRecord);
            await SupabaseService.persistMediaFolder(newRecord).catch(() => {});
          }

          if (child.children && child.children.length > 0) {
            await syncNodeRecursive(child, childDriveId);
          }
        }
      }
    };

    await syncNodeRecursive(rootNode, rootDriveId);
    this.saveFolderStructureToDisk(rootNode);

    return {
      success: true,
      syncedCount,
      structure: rootNode,
      flatList: this.flattenHierarchy(rootNode),
      message: `Successfully created/synchronized ${syncedCount} folders in Google Drive.`
    };
  }

  // Auto-resolve upload destination based on assignment day and media type
  static resolveDestination(daySession?: string, mediaType?: string): UploadDestination {
    const isDay2 = daySession && /day\s*2/i.test(daySession);
    const day = isDay2 ? 'Day 2' : 'Day 1';

    let category: UploadDestination['category'] = 'Photography';
    const typeUpper = (mediaType || '').toUpperCase();
    if (typeUpper.includes('VIDEO') || typeUpper === 'RAW_VIDEO' || typeUpper === 'FOOTAGE') {
      category = 'Raw Videography';
    } else if (typeUpper === 'EDITED_DRAFT' || typeUpper.includes('DRAFT') || typeUpper.includes('REVIEW')) {
      category = 'Review Versions';
    } else if (typeUpper === 'FINAL_VIDEO' || typeUpper.includes('FINAL') || typeUpper.includes('APPROVED')) {
      category = 'Approved Deliverables';
    } else if (typeUpper.includes('AUDIO') || typeUpper.includes('GRAPHIC') || typeUpper.includes('PROJECT')) {
      category = 'Editing Projects';
    }

    const fullPath = `DSA MediaVerse - SAVISKAR 2026/${day}/${category}`;
    const rootUrl = config.google.rootFolderUrl || 'https://drive.google.com/drive/folders/1PNvblS0BffXR12av3dC7fP7wNdf948kO';
    
    // Deterministic folder ID hash for consistent linking
    const folderHash = crypto.createHash('md5').update(fullPath).digest('hex').slice(0, 12);
    const driveFolderId = `sav26-${day.toLowerCase().replace(' ', '')}-${category.toLowerCase().replace(' ', '')}-${folderHash}`;
    const driveFolderUrl = `${rootUrl}?folder=${driveFolderId}&path=${encodeURIComponent(fullPath)}`;

    return {
      day,
      category,
      fullPath,
      folderName: `${day}/${category}`,
      driveFolderId,
      driveFolderUrl
    };
  }

  // Real Google Drive Folder Search & Creation Handler
  static async getOrCreateDriveFolder(name: string, parentId: string): Promise<string> {
    const cacheKey = `${parentId}:::${name}`;
    if (this.folderIdCache.has(cacheKey)) {
      return this.folderIdCache.get(cacheKey)!;
    }

    const token = await this.getValidAccessToken();
    if (!token) {
      throw new Error('GOOGLE_DRIVE_NOT_CONNECTED: Google Drive is not connected. Please authorize Google Drive first.');
    }

    // 1. Check if folder already exists in Google Drive under parentId
    const query = `name = '${name.replace(/'/g, "\\'")}' and '${parentId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
    const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,webViewLink)&supportsAllDrives=true&includeItemsFromAllDrives=true`;

    try {
      const searchRes = await fetch(searchUrl, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (searchRes.ok) {
        const searchData = (await searchRes.json()) as any;
        if (searchData.files && searchData.files.length > 0) {
          const foundId = searchData.files[0].id;
          this.folderIdCache.set(cacheKey, foundId);
          console.log(`[DriveService] Found existing Google Drive folder "${name}" (ID: ${foundId}) in parent ${parentId}`);
          return foundId;
        }
      } else {
        const err = await searchRes.text();
        console.warn(`[DriveService] Google Drive folder search warning: ${err}`);
      }
    } catch (err: any) {
      console.warn(`[DriveService] Folder search network error: ${err.message}`);
    }

    // 2. Folder does not exist, create it in Google Drive
    console.log(`[DriveService] Creating Google Drive folder "${name}" under parent ${parentId}...`);
    const createRes = await fetch('https://www.googleapis.com/drive/v3/files?supportsAllDrives=true&fields=id,name,webViewLink', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentId]
      })
    });

    if (!createRes.ok) {
      const errText = await createRes.text();
      console.error(`[DriveService] Folder creation failed for "${name}":`, errText);
      throw new Error(`Failed to create Google Drive folder "${name}": ${errText}`);
    }

    const createdData = (await createRes.json()) as any;
    const newFolderId = createdData.id;
    this.folderIdCache.set(cacheKey, newFolderId);
    console.log(`[DriveService] Successfully created Google Drive folder "${name}" (ID: ${newFolderId})`);
    return newFolderId;
  }

  // Synchronize folder hierarchy directly into Google Drive root
  static async syncDriveFoldersWithGoogleDrive(eventId: string): Promise<void> {
    const root = await this.resolveRootFolderId();
    const rootId = root.id;
    const token = await this.getValidAccessToken();
    if (!token) return;

    const days = ['Day 1', 'Day 2'] as const;
    const categories = [
      'Photography',
      'Raw Videography',
      'Editing Projects',
      'Review Versions',
      'Approved Deliverables'
    ] as const;

    for (const day of days) {
      try {
        const dayFolderId = await this.getOrCreateDriveFolder(day, rootId);
        const dayPath = `/DSA MediaVerse - SAVISKAR 2026/${day}`;
        const dayRecord = db.mediaFolders.find(f => f.event_id === eventId && f.folder_path === dayPath);
        if (dayRecord) {
          dayRecord.drive_folder_id = dayFolderId;
          dayRecord.drive_web_url = `https://drive.google.com/drive/folders/${dayFolderId}`;
          await SupabaseService.persistMediaFolder(dayRecord);
        }

        for (const cat of categories) {
          try {
            const catFolderId = await this.getOrCreateDriveFolder(cat, dayFolderId);
            const catPath = `${dayPath}/${cat}`;
            const catRecord = db.mediaFolders.find(f => f.event_id === eventId && f.folder_path === catPath);
            if (catRecord) {
              catRecord.drive_folder_id = catFolderId;
              catRecord.drive_web_url = `https://drive.google.com/drive/folders/${catFolderId}`;
              await SupabaseService.persistMediaFolder(catRecord);
            }
          } catch (e: any) {
            console.warn(`[DriveService] Error syncing folder ${day}/${cat}:`, e.message);
          }
        }
      } catch (e: any) {
        console.warn(`[DriveService] Error syncing day folder ${day}:`, e.message);
      }
    }
  }

  // Provision standardized SAVISKAR 2026 folder hierarchy in database and trigger Google Drive sync
  static provisionFolderHierarchy(
    eventId: string,
    rootUrl?: string
  ): { success: boolean; createdFolders: MediaFolder[]; message: string } {
    const createdFolders: MediaFolder[] = [];
    const baseRootUrl = rootUrl || config.google.rootFolderUrl || 'https://drive.google.com/drive/folders/1PNvblS0BffXR12av3dC7fP7wNdf948kO';

    const days = ['Day 1', 'Day 2'] as const;
    const categories = [
      'Photography',
      'Raw Videography',
      'Editing Projects',
      'Review Versions',
      'Approved Deliverables'
    ] as const;

    for (const day of days) {
      const dayHash = crypto.createHash('md5').update(day).digest('hex').slice(0, 8);
      const dayFolderId = `sav26-${day.toLowerCase().replace(' ', '')}-${dayHash}`;
      const dayPath = `/DSA MediaVerse - SAVISKAR 2026/${day}`;
      const dayFolderUrl = `${baseRootUrl}?search=${encodeURIComponent(day)}`;

      const dayRecord: MediaFolder = {
        id: crypto.randomUUID(),
        event_id: eventId,
        folder_name: day,
        folder_path: dayPath,
        drive_folder_id: dayFolderId,
        drive_web_url: dayFolderUrl,
        is_system_created: true,
        created_at: new Date().toISOString()
      };

      const existingDay = db.mediaFolders.find(f => f.event_id === eventId && f.folder_path === dayPath);
      if (!existingDay) {
        db.mediaFolders.push(dayRecord);
        createdFolders.push(dayRecord);
        SupabaseService.persistMediaFolder(dayRecord).catch(() => {});
      }

      for (const cat of categories) {
        const catHash = crypto.createHash('md5').update(`${day}/${cat}`).digest('hex').slice(0, 8);
        const catFolderId = `sav26-${day.toLowerCase().replace(' ', '')}-${cat.toLowerCase().replace(' ', '')}-${catHash}`;
        const catPath = `${dayPath}/${cat}`;
        const catFolderUrl = `${baseRootUrl}?path=${encodeURIComponent(catPath)}`;

        const catRecord: MediaFolder = {
          id: crypto.randomUUID(),
          event_id: eventId,
          folder_name: cat,
          folder_path: catPath,
          drive_folder_id: catFolderId,
          drive_web_url: catFolderUrl,
          is_system_created: true,
          created_at: new Date().toISOString()
        };

        const existingCat = db.mediaFolders.find(f => f.event_id === eventId && f.folder_path === catPath);
        if (!existingCat) {
          db.mediaFolders.push(catRecord);
          createdFolders.push(catRecord);
          SupabaseService.persistMediaFolder(catRecord).catch(() => {});
        }
      }
    }

    // Trigger real Google Drive cloud folder creation in background if authenticated
    if (this.tokenState.accessToken || this.tokenState.refreshToken) {
      this.syncDriveFoldersWithGoogleDrive(eventId).catch(err => {
        console.warn('[DriveService] Cloud folder sync background warning:', err.message);
      });
    }

    return {
      success: true,
      createdFolders: db.mediaFolders.filter(f => f.event_id === eventId),
      message: 'Successfully provisioned standardized SAVISKAR 2026 folder hierarchy.'
    };
  }

  // Validate Google Drive URL pattern and generate preview/embed paths
  static validateDriveUrl(url: string): {
    isValid: boolean;
    fileId?: string;
    isFolder: boolean;
    previewUrl?: string;
    embedUrl?: string;
    normalizedUrl?: string;
  } {
    try {
      const parsed = new URL(url);
      const isGoogleDrive = parsed.hostname.includes('drive.google.com') || parsed.hostname.includes('docs.google.com');

      if (!isGoogleDrive) {
        return { isValid: false, isFolder: false };
      }

      const folderMatch = url.match(/\/folders\/([a-zA-Z0-9_-]+)/);
      if (folderMatch) {
        const folderId = folderMatch[1];
        return {
          isValid: true,
          fileId: folderId,
          isFolder: true,
          normalizedUrl: `https://drive.google.com/drive/folders/${folderId}`
        };
      }

      const fileMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || url.match(/id=([a-zA-Z0-9_-]+)/);
      if (fileMatch) {
        const fileId = fileMatch[1];
        return {
          isValid: true,
          fileId,
          isFolder: false,
          previewUrl: `https://drive.google.com/file/d/${fileId}/preview`,
          embedUrl: `https://drive.google.com/file/d/${fileId}/preview`,
          normalizedUrl: `https://drive.google.com/file/d/${fileId}/view`
        };
      }

      return { isValid: true, isFolder: false, normalizedUrl: url };
    } catch {
      return { isValid: false, isFolder: false };
    }
  }

  // Real File Upload Handler (Streams to Google Drive into the exact resolved subfolder)
  static async uploadFileToDrive(options: {
    filePath: string;
    originalName: string;
    mimeType: string;
    sizeBytes: number;
    destination?: UploadDestination;
    targetFolderId?: string;
    targetFolderPath?: string;
  }): Promise<{
    fileId: string;
    webViewLink: string;
    thumbnailLink?: string;
    driveFolderId: string;
    driveFolderUrl: string;
    folderPath: string;
  }> {
    const { filePath, originalName, mimeType, targetFolderId, targetFolderPath } = options;
    const token = await this.getValidAccessToken();

    if (!token) {
      throw new Error('GOOGLE_DRIVE_NOT_CONNECTED: Google Drive is not connected. Please authorize Google Drive before uploading photos.');
    }

    const root = await this.resolveRootFolderId();
    const rootId = root.id;

    let destinationFolderId: string = '';
    let finalFolderPath: string = '';

    // 1. If explicit targetFolderId is provided, upload directly into that folder
    if (targetFolderId && targetFolderId.trim()) {
      destinationFolderId = targetFolderId.trim();
      finalFolderPath = targetFolderPath || 'Selected Google Drive Folder';
    } else if (targetFolderPath && targetFolderPath.trim()) {
      // Look up existing node in structure by path
      const structure = this.getFolderStructure();
      const node = this.findNodeByPath(structure, targetFolderPath.trim());
      if (node && node.driveFolderId) {
        destinationFolderId = node.driveFolderId;
        finalFolderPath = node.path;
      }
    }

    // 2. If no target specified or not found, fall back to assignment destination (Day / Category)
    if (!destinationFolderId) {
      const destination = options.destination || this.resolveDestination();
      finalFolderPath = destination.fullPath;
      const dayFolderId = await this.getOrCreateDriveFolder(destination.day, rootId);
      destinationFolderId = await this.getOrCreateDriveFolder(destination.category, dayFolderId);
    }

    console.log(`[DriveService] Uploading "${originalName}" (${mimeType}) directly into Google Drive folder "${finalFolderPath}" (Folder ID: ${destinationFolderId})...`);

    const metadata = {
      name: originalName,
      parents: [destinationFolderId],
      description: `Uploaded via DSA MediaVerse for SAVISKAR 2026 -> ${finalFolderPath}`
    };

    const boundary = '-------314159265358979323846';
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    const fileBuffer = await fs.promises.readFile(filePath);
    const multipartBody = Buffer.concat([
      Buffer.from(
        delimiter +
        'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
        JSON.stringify(metadata) +
        delimiter +
        `Content-Type: ${mimeType}\r\n\r\n`
      ),
      fileBuffer,
      Buffer.from(closeDelimiter)
    ]);

    const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,name,webViewLink,thumbnailLink,webContentLink', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`
      },
      body: multipartBody
    });

    // Clean up temporary local disk file after upload attempt
    try {
      if (fs.existsSync(filePath)) {
        await fs.promises.unlink(filePath);
      }
    } catch {}

    if (!res.ok) {
      const errText = await res.text();
      console.error(`[DriveService] Google Drive direct upload failed: ${errText}`);
      throw new Error(`Google Drive API upload failed (${res.status}): ${errText}`);
    }

    const data = (await res.json()) as any;
    console.log(`[DriveService] Upload successful! Real Google Drive File ID: ${data.id}, Link: ${data.webViewLink}`);

    return {
      fileId: data.id,
      webViewLink: data.webViewLink || `https://drive.google.com/file/d/${data.id}/view`,
      thumbnailLink: data.thumbnailLink,
      driveFolderId: destinationFolderId,
      driveFolderUrl: `https://drive.google.com/drive/folders/${destinationFolderId}`,
      folderPath: finalFolderPath
    };
  }
}

// Initialize tokens from disk on startup
DriveService.init();
