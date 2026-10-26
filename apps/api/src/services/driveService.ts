import { config } from '../config';
import { db } from '../db/memoryStore';
import { MediaFolder, PersonalDriveInfo, PersonalSubfolder, UserRole } from '@mediaverse/shared-types';
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
    this.preloadFolderCache();

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

  static preloadFolderCache(): void {
    try {
      const rootId = config.google.rootFolderId || '1PNvblS0BffXR12av3dC7fP7wNdf948kO';
      this.tokenState.activeRootFolderId = rootId;
      this.tokenState.activeRootFolderUrl = config.google.rootFolderUrl || `https://drive.google.com/drive/folders/${rootId}`;
      this.folderIdCache.set('root', rootId);
      this.folderIdCache.set('DSA MEDIAVERSE SAVISKAR 26', rootId);

      // Preload verified Saviskar 2026 Google Drive folder IDs
      const standardMappings: [string, string][] = [
        ['Day 1', '1joHnEgWyV8rHJ_EuhaRPTwwfY00CKXUp'],
        ['Day 1/Photography', '1tFGNR9WZo_9dGgf_6zBOHdBnpPRxBQXQ'],
        ['Day 1/Raw Videography', '1m7U0n1wuICACLVBmKl8YYLqEXvmVALWQ'],
        ['Day 1/Editing Projects', '1Mgc1jPrW1OnjXCWh24ExtC7Selj5v0kb'],
        ['Day 1/Review Versions', '14WHUxbCWO3C_R95AhnqWG-idVX82At7E'],
        ['Day 1/Approved Deliverables', '1FqNcaFlb-VQvO5YNC3xRYF1T2MFOjwIw'],
        ['Day 2', '1N6Tfp3qt87ivWgKUj-H8vr9HNVIebEos'],
        ['Day 2/Photography', '1gLGhFYTYMwXxB3kmdrRN7ZE274nuZcI1'],
        ['Day 2/Raw Videography', '1LF1A9AbGiWyQlYKT0V0v7LH3OPCcBGUF'],
        ['Day 2/Editing Projects', '1vS0pzFceh2jPxYi6zpzDyaux4E_q6S4m'],
        ['Day 2/Review Versions', '1rsd_DwXpiS57q1Yk-Aud5zDovfEFVLlM'],
        ['Day 2/Approved Deliverables', '1sLmZmVP8ZTAc2Juknb1OTuQPaAPo86pA'],
        ['Day 3', '1GB79lRv25uyFkCGwRSeASKhyQ8BaCkdq'],
        ['Day 3/Photography - Trophies & Medals', '1E9IgogrW4LkF9w-3BZNHr8D8qdecckTi'],
        ['Day 3/Photography - Winner Celebrations', '1KqWT6_udlPX8cKGaoxhoL6FCOtbEhZ_T'],
        ['Day 3/Raw Videography - Valedictory Speeches', '1ZPUcTVEOfZMurEpHqNGOr2xzuV5mirnB'],
        ['Day 3/Approved Deliverables', '18LtXVXGaaqgpKGtqzEktpq5_0DyI8Gyj'],
        ['Social Media & Quick Reels Vault', '1lRSqTLSBcGwrau5v2p2gWqGF31LOJtPv'],
        ['Branding & Official Crew Assets', '1Zywr3VN7k-kGF0MTQjCQzfSl1NM8UViZ'],
        ['Lamp Lighting & Ceremonial', '1pKCq7zqDvxjbpN1ZnsR-BPc_XRQsVYLE'],
        ['VIP Dignitaries & Guests', '1Nfg4DUYihZV7w8Giir97LGVNBT3i8RQO'],
        ['Audience & Atmosphere', '1OGrNONYwFnDHInjZJbOb2g_6OZux5kpy'],
        ['Stage 4K Multicam', '1mFzJj5f1EBXyJ8G_Io-IzXtBPGS9xhfY'],
        ['B-Roll & Atmosphere', '1g1rqSkYDiJzpyUpdxNVpZxhG4lZOMmRS'],
        ['Interviews & Testimonials', '12n-wXqiaeLnzlM1pjr3vYIroYqWGb8hV'],
        ['Hackathon Pitches & Project Expo', '1fpWSBjToYblPRBDVjf9enyGTpyDYeHNb'],
        ['Workshops & Coding Battles', '19f53D_XrSRhftBNK74tPENZnlnXdIZ7D'],
        ['Star Night & Stage Performances', '1nPfFKIetn1hrJARVdcrcDBaCUgCGC_VM'],
        ['Project Demos & Student Reactions', '1DrypkCSGAlGEtOdueT--VKUj1lfaEzcU'],
        ['Cultural Performances 4K', '1TKF1nK6lHD3dKEmg_6xmWTva3Fxq6BNR'],
        ['Star Night Highlights', '1uWKvxIGaQMgHbNo6VRjRwdQt4fxq7PNo'],
        ['Instagram Reels (9x16 Vertical)', '1d5OaYKjQxpeXFyO8pwSBVZnifcn8g6CV'],
        ['YouTube Shorts & Highlights', '17842qY6y79FyneGn7bKkyLQVDgCXpoUt'],
        ['Logos & Watermarks', '1y1ARZJzU1yfpM_OylNDdanpkfphtPbyK'],
        ['Motion Lower Thirds & Intro Jingles', '1sBXgJbczNz2KaSe0zbL-sTFE8YLUnAd4']
      ];

      for (const [key, id] of standardMappings) {
        this.folderIdCache.set(key, id);
        this.folderIdCache.set(key.toLowerCase(), id);
        this.folderIdCache.set(`${rootId}:::${key}`, id);
      }

      // Also index all nodes from .drive_structure.json if present
      const structure = this.getFolderStructure();
      const traverse = (node: FolderNode, parentDriveId?: string) => {
        if (node.driveFolderId) {
          this.folderIdCache.set(node.path, node.driveFolderId);
          this.folderIdCache.set(node.path.toLowerCase(), node.driveFolderId);
          this.folderIdCache.set(node.name, node.driveFolderId);
          this.folderIdCache.set(node.name.toLowerCase(), node.driveFolderId);
          if (parentDriveId) {
            this.folderIdCache.set(`${parentDriveId}:::${node.name}`, node.driveFolderId);
          }
        }
        if (node.children) {
          for (const child of node.children) {
            traverse(child, node.driveFolderId || parentDriveId);
          }
        }
      };
      traverse(structure, rootId);

      // Index database media folders
      for (const f of db.mediaFolders) {
        if (f.drive_folder_id) {
          this.folderIdCache.set(f.folder_path, f.drive_folder_id);
          this.folderIdCache.set(f.folder_name, f.drive_folder_id);
          if (f.user_id) {
            this.folderIdCache.set(`user:${f.user_id}:${f.folder_name}`, f.drive_folder_id);
          }
        }
      }

      console.log(`[DriveService] Folder cache preloaded with ${this.folderIdCache.size} instant-lookup mappings (0ms latency).`);
    } catch (err: any) {
      console.warn('[DriveService] Folder cache preloading notice:', err.message);
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

  // Unified Interactive Master Folder Tree with SAVISKAR 2026 categories and Personal Crew Vaults
  static getMasterFolderTree(currentUser?: { id: string; full_name: string }): FolderNode {
    const root = JSON.parse(JSON.stringify(this.getFolderStructure())) as FolderNode;

    if (!root.children) root.children = [];
    let crewNode = root.children.find(c => c.name === 'Crew Personal Drives');
    if (!crewNode) {
      crewNode = {
        name: 'Crew Personal Drives',
        path: `${root.path}/Crew Personal Drives`,
        children: []
      };
      root.children.push(crewNode);
    }
    crewNode.children = crewNode.children || [];

    // Populate user personal folders from db.mediaFolders
    const personalRoots = db.mediaFolders.filter(
      f => f.is_personal && (!f.parent_folder_id || f.parent_folder_id === '')
    );

    for (const pr of personalRoots) {
      let existingUserNode = crewNode.children.find(c => c.name === pr.folder_name);
      if (!existingUserNode) {
        existingUserNode = {
          id: pr.id,
          name: pr.folder_name,
          path: pr.folder_path,
          driveFolderId: pr.drive_folder_id,
          driveWebUrl: pr.drive_web_url,
          children: []
        };
        crewNode.children.push(existingUserNode);
      }
      existingUserNode.children = existingUserNode.children || [];

      // Populate subfolders
      const subs = db.mediaFolders.filter(f => f.is_personal && f.parent_folder_id === pr.id);
      for (const s of subs) {
        if (!existingUserNode.children.some(c => c.name === s.folder_name)) {
          existingUserNode.children.push({
            id: s.id,
            name: s.folder_name,
            path: s.folder_path,
            driveFolderId: s.drive_folder_id,
            driveWebUrl: s.drive_web_url,
            children: []
          });
        }
      }
    }

    return root;
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

  static findNodeByDriveId(root: FolderNode, driveId: string): FolderNode | null {
    if (root.driveFolderId && root.driveFolderId === driveId) return root;
    if (root.children) {
      for (const child of root.children) {
        const found = this.findNodeByDriveId(child, driveId);
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

  // Add a subfolder to ANY node in the tree (official categories or personal vaults)
  static async addSubfolderToAnyNode(options: {
    user: { id: string; full_name: string; roles: UserRole[] };
    folderName: string;
    parentFolderId?: string;
    parentPath?: string;
  }): Promise<{
    id: string;
    name: string;
    path: string;
    driveFolderId: string;
    driveWebUrl: string;
  }> {
    const cleanName = options.folderName.trim();
    if (!cleanName) throw new Error('Subfolder name cannot be empty.');

    const token = await this.getValidAccessToken();
    const root = this.getFolderStructure();

    // 1. Resolve parent Drive ID and parent path
    let parentDriveId = (options.parentFolderId || '').trim();
    let parentPath = (options.parentPath || '').trim();

    if (parentDriveId && !parentPath) {
      const dbMatch = db.mediaFolders.find(f => f.drive_folder_id === parentDriveId);
      if (dbMatch) {
        parentPath = dbMatch.folder_path;
      } else {
        const nodeMatch = this.findNodeByDriveId(root, parentDriveId);
        if (nodeMatch) {
          parentPath = nodeMatch.path;
        }
      }
    }

    if (parentPath && !parentDriveId) {
      const node = this.findNodeByPath(root, parentPath);
      if (node && node.driveFolderId) {
        parentDriveId = node.driveFolderId;
      }
    }

    if (!parentDriveId) {
      parentDriveId = config.google.rootFolderId || '1PNvblS0BffXR12av3dC7fP7wNdf948kO';
      parentPath = parentPath || '/DSA MEDIAVERSE SAVISKAR 26';
    }

    // 2. Create in Google Drive
    let createdDriveId = '';
    if (token && !parentDriveId.startsWith('user-drive-') && !parentDriveId.startsWith('sub-')) {
      try {
        createdDriveId = await this.getOrCreateDriveFolder(cleanName, parentDriveId);
      } catch (err: any) {
        console.warn(`[DriveService] Drive subfolder creation notice: ${err.message}`);
        createdDriveId = `sub-${crypto.randomUUID().slice(0, 8)}`;
      }
    } else {
      createdDriveId = `sub-${crypto.randomUUID().slice(0, 8)}`;
    }

    const newPath = `${parentPath}/${cleanName}`;
    const newDriveUrl = `https://drive.google.com/drive/folders/${createdDriveId}`;

    // 3. Update structure if parent exists in root structure
    const parentNode = this.findNodeByPath(root, parentPath);
    if (parentNode) {
      parentNode.children = parentNode.children || [];
      const newNode: FolderNode = {
        id: crypto.randomUUID(),
        name: cleanName,
        path: newPath,
        driveFolderId: createdDriveId,
        driveWebUrl: newDriveUrl,
        children: []
      };
      parentNode.children.push(newNode);
      this.saveFolderStructureToDisk(root);
    }

    // 4. Record in db.mediaFolders and Supabase
    const newRecord: MediaFolder = {
      id: crypto.randomUUID(),
      event_id: 'saviskar-2026',
      folder_name: cleanName,
      folder_path: newPath,
      parent_folder_id: parentDriveId,
      drive_folder_id: createdDriveId,
      drive_web_url: newDriveUrl,
      is_system_created: false,
      user_id: options.user.id,
      user_name: options.user.full_name,
      role: options.user.roles[0],
      is_personal: true,
      created_at: new Date().toISOString()
    };

    db.mediaFolders.push(newRecord);
    this.folderIdCache.set(newPath, createdDriveId);
    this.folderIdCache.set(cleanName, createdDriveId);
    await SupabaseService.persistMediaFolder(newRecord).catch(() => {});

    console.log(`[DriveService] Successfully added subfolder "${cleanName}" under parent "${parentPath}" (Drive ID: ${createdDriveId})`);

    return {
      id: newRecord.id,
      name: cleanName,
      path: newPath,
      driveFolderId: createdDriveId,
      driveWebUrl: newDriveUrl
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

    // Direct verified real Google Drive folder IDs
    let driveFolderId = '';
    if (day === 'Day 1') {
      if (category === 'Photography') driveFolderId = '1tFGNR9WZo_9dGgf_6zBOHdBnpPRxBQXQ';
      else if (category === 'Raw Videography') driveFolderId = '1m7U0n1wuICACLVBmKl8YYLqEXvmVALWQ';
      else if (category === 'Editing Projects') driveFolderId = '1Mgc1jPrW1OnjXCWh24ExtC7Selj5v0kb';
      else if (category === 'Review Versions') driveFolderId = '14WHUxbCWO3C_R95AhnqWG-idVX82At7E';
      else if (category === 'Approved Deliverables') driveFolderId = '1FqNcaFlb-VQvO5YNC3xRYF1T2MFOjwIw';
    } else {
      if (category === 'Photography') driveFolderId = '1gLGhFYTYMwXxB3kmdrRN7ZE274nuZcI1';
      else if (category === 'Raw Videography') driveFolderId = '1LF1A9AbGiWyQlYKT0V0v7LH3OPCcBGUF';
      else if (category === 'Editing Projects') driveFolderId = '1vS0pzFceh2jPxYi6zpzDyaux4E_q6S4m';
      else if (category === 'Review Versions') driveFolderId = '1rsd_DwXpiS57q1Yk-Aud5zDovfEFVLlM';
      else if (category === 'Approved Deliverables') driveFolderId = '1sLmZmVP8ZTAc2Juknb1OTuQPaAPo86pA';
    }

    // Double check memory cache if mapped
    const cacheKey = `${day}/${category}`;
    if (this.folderIdCache.has(cacheKey)) {
      driveFolderId = this.folderIdCache.get(cacheKey)!;
    }

    const fullPath = `DSA MediaVerse - SAVISKAR 2026/${day}/${category}`;
    const driveFolderUrl = `https://drive.google.com/drive/folders/${driveFolderId}`;

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

  // Create direct browser-to-Drive resumable upload session (no file routing through server)
  static async createResumableUploadSession(options: {
    filename: string;
    mimeType: string;
    sizeBytes: number;
    targetFolderId?: string;
    targetFolderPath?: string;
    description?: string;
    destination?: UploadDestination;
  }): Promise<{
    uploadUrl: string;
    targetFolderId: string;
    targetFolderPath: string;
    chunkSizeBytes: number;
  }> {
    const token = await this.getValidAccessToken();
    if (!token) {
      throw new Error('GOOGLE_DRIVE_NOT_CONNECTED: Google Drive is not connected or token expired.');
    }

    let destinationFolderId = (options.targetFolderId || '').trim();
    let finalFolderPath = (options.targetFolderPath || '').trim();

    if (!destinationFolderId) {
      const dest = options.destination || this.resolveDestination();
      if (dest.driveFolderId && !dest.driveFolderId.startsWith('sav26-')) {
        destinationFolderId = dest.driveFolderId;
        finalFolderPath = dest.fullPath;
      } else {
        const root = await this.resolveRootFolderId();
        const rootId = root.id;
        finalFolderPath = dest.fullPath;
        const dayFolderId = await this.getOrCreateDriveFolder(dest.day, rootId);
        destinationFolderId = await this.getOrCreateDriveFolder(dest.category, dayFolderId);
      }
    }

    if (!finalFolderPath && destinationFolderId) {
      const match = db.mediaFolders.find(f => f.drive_folder_id === destinationFolderId);
      if (match) finalFolderPath = match.folder_path;
      else finalFolderPath = 'SAVISKAR 2026';
    }

    console.log(`[DriveService] Creating direct browser-to-Drive upload session for "${options.filename}" (${options.mimeType}, ${(options.sizeBytes / (1024 * 1024)).toFixed(2)} MB) in folder "${finalFolderPath}" (${destinationFolderId})...`);

    const metadata = {
      name: options.filename,
      parents: [destinationFolderId],
      description: options.description || `Uploaded via DSA MediaVerse directly to Google Drive -> ${finalFolderPath}`
    };

    const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Type': options.mimeType,
        'X-Upload-Content-Length': String(options.sizeBytes)
      },
      body: JSON.stringify(metadata)
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`[DriveService] Failed to create resumable upload session (${res.status}): ${errText}`);
      throw new Error(`Google Drive Resumable Upload session failed (${res.status}): ${errText}`);
    }

    const uploadUrl = res.headers.get('location');
    if (!uploadUrl) {
      throw new Error('Google Drive did not return a resumable session Location URL.');
    }

    return {
      uploadUrl,
      targetFolderId: destinationFolderId,
      targetFolderPath: finalFolderPath,
      chunkSizeBytes: 8 * 1024 * 1024 // 8 MiB (8388608 bytes)
    };
  }

  // Real File Upload Handler (Streams to Google Drive with 0ms pre-lookup and 16MB chunked streaming for large files)
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

    let destinationFolderId: string = '';
    let finalFolderPath: string = '';

    // 1. Ultra-fast direct check from targetFolderId (0ms lookup)
    if (targetFolderId && targetFolderId.trim() && !targetFolderId.startsWith('sav26-')) {
      destinationFolderId = targetFolderId.trim();
      finalFolderPath = targetFolderPath || 'Selected Google Drive Folder';
    } else if (targetFolderPath && targetFolderPath.trim()) {
      if (this.folderIdCache.has(targetFolderPath.trim())) {
        destinationFolderId = this.folderIdCache.get(targetFolderPath.trim())!;
        finalFolderPath = targetFolderPath.trim();
      } else {
        const structure = this.getFolderStructure();
        const node = this.findNodeByPath(structure, targetFolderPath.trim());
        if (node && node.driveFolderId) {
          destinationFolderId = node.driveFolderId;
          finalFolderPath = node.path;
        }
      }
    }

    // 2. Direct fast check from destination (0ms lookup)
    if (!destinationFolderId) {
      const destination = options.destination || this.resolveDestination();
      if (destination.driveFolderId && !destination.driveFolderId.startsWith('sav26-')) {
        destinationFolderId = destination.driveFolderId;
        finalFolderPath = destination.fullPath;
      } else {
        const root = await this.resolveRootFolderId();
        const rootId = root.id;
        finalFolderPath = destination.fullPath;
        const dayFolderId = await this.getOrCreateDriveFolder(destination.day, rootId);
        destinationFolderId = await this.getOrCreateDriveFolder(destination.category, dayFolderId);
      }
    }

    console.log(`[DriveService] Fast-streaming "${originalName}" (${mimeType}, ${(options.sizeBytes / (1024 * 1024)).toFixed(2)} MB) directly into Google Drive folder "${finalFolderPath}" (ID: ${destinationFolderId})...`);

    const metadata = {
      name: originalName,
      parents: [destinationFolderId],
      description: `Uploaded via DSA MediaVerse for SAVISKAR 2026 -> ${finalFolderPath}`
    };

    try {
      // For large files (> 4MB, like raw DSLR photos 90-100MB or 400MB-1GB+ 4K videos), use Google Resumable Upload
      // Using chunked 16MB slices to maintain low constant memory (~16MB) and prevent OOM
      if (options.sizeBytes > 4 * 1024 * 1024) {
        console.log(`[DriveService] Initiating Google Resumable Chunked Upload pipeline for large file (${(options.sizeBytes / (1024 * 1024)).toFixed(1)} MB)...`);
        const initRes = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json; charset=UTF-8',
            'X-Upload-Content-Type': mimeType,
            'X-Upload-Content-Length': String(options.sizeBytes)
          },
          body: JSON.stringify(metadata)
        });

        if (!initRes.ok) {
          const errText = await initRes.text();
          console.error(`[DriveService] Google Resumable Upload init failed: ${errText}`);
          throw new Error(`Google Resumable Upload init failed: ${errText}`);
        }

        const location = initRes.headers.get('location');
        if (!location) {
          throw new Error('Google did not return upload session location');
        }

        const CHUNK_SIZE = 16 * 1024 * 1024; // 16MB slices
        const totalBytes = options.sizeBytes;
        let offset = 0;
        let finalUploadData: any = null;

        const fileHandle = await fs.promises.open(filePath, 'r');
        try {
          while (offset < totalBytes) {
            const chunkSize = Math.min(CHUNK_SIZE, totalBytes - offset);
            const chunkBuffer = Buffer.alloc(chunkSize);
            await fileHandle.read(chunkBuffer, 0, chunkSize, offset);

            const endByte = offset + chunkSize - 1;
            const chunkRes = await fetch(location, {
              method: 'PUT',
              headers: {
                'Content-Range': `bytes ${offset}-${endByte}/${totalBytes}`,
                'Content-Length': String(chunkSize),
                'Content-Type': mimeType
              },
              body: chunkBuffer
            });

            if (chunkRes.status === 200 || chunkRes.status === 201) {
              finalUploadData = await chunkRes.json();
              break;
            } else if (chunkRes.status === 308) {
              offset += chunkSize;
              const pct = Math.round((offset / totalBytes) * 100);
              console.log(`[DriveService] Streamed chunk ${offset}/${totalBytes} bytes (${pct}%) for "${originalName}"`);
            } else {
              const errText = await chunkRes.text();
              throw new Error(`Google Resumable Upload chunk failed (${chunkRes.status}): ${errText}`);
            }
          }
        } finally {
          await fileHandle.close();
        }

        if (!finalUploadData) {
          throw new Error('Upload completed without receiving Google Drive file metadata');
        }

        console.log(`[DriveService] Resumable upload successful! File ID: ${finalUploadData.id}, Link: ${finalUploadData.webViewLink}`);

        return {
          fileId: finalUploadData.id,
          webViewLink: finalUploadData.webViewLink || `https://drive.google.com/file/d/${finalUploadData.id}/view`,
          thumbnailLink: finalUploadData.thumbnailLink,
          driveFolderId: destinationFolderId,
          driveFolderUrl: `https://drive.google.com/drive/folders/${destinationFolderId}`,
          folderPath: finalFolderPath
        };
      }

      // Small files (<= 4MB) direct multipart upload
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

      if (!res.ok) {
        const errText = await res.text();
        console.error(`[DriveService] Google Drive direct upload failed: ${errText}`);
        throw new Error(`Google Drive API upload failed (${res.status}): ${errText}`);
      }

      const data = (await res.json()) as any;
      console.log(`[DriveService] Direct upload successful! File ID: ${data.id}, Link: ${data.webViewLink}`);

      return {
        fileId: data.id,
        webViewLink: data.webViewLink || `https://drive.google.com/file/d/${data.id}/view`,
        thumbnailLink: data.thumbnailLink,
        driveFolderId: destinationFolderId,
        driveFolderUrl: `https://drive.google.com/drive/folders/${destinationFolderId}`,
        folderPath: finalFolderPath
      };
    } finally {
      // Clean up temporary local disk file after upload attempt
      try {
        if (fs.existsSync(filePath)) {
          await fs.promises.unlink(filePath);
        }
      } catch {}
    }
  }

  // ==========================================
  // Personal User Drives & Role Hierarchy
  // ==========================================

  static async shareFolderWithUser(folderId: string, email: string): Promise<boolean> {
    const cleanEmail = (email || '').trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) return false;

    const token = await this.getValidAccessToken();
    if (!token || folderId.startsWith('user-drive-') || folderId.startsWith('sub-')) return false;

    try {
      const res = await fetch(`https://www.googleapis.com/drive/v3/files/${folderId}/permissions?sendNotificationEmail=true&supportsAllDrives=true`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          role: 'writer',
          type: 'user',
          emailAddress: cleanEmail
        })
      });

      if (res.ok) {
        console.log(`[DriveService] Successfully shared Google Drive folder ${folderId} with ${cleanEmail} (role: writer)`);
        return true;
      } else {
        const errData = await res.json().catch(() => ({}));
        console.warn(`[DriveService] Drive permission share warning for ${cleanEmail}:`, JSON.stringify(errData));
        return false;
      }
    } catch (err: any) {
      console.warn(`[DriveService] Error sharing folder with ${cleanEmail}:`, err.message);
      return false;
    }
  }

  static getPersonalDriveTemplates(role: UserRole): string[] {
    switch (role) {
      case 'PHOTOGRAPHER':
        return [
          '01 - Day 1 Morning (RAW & Stills)',
          '02 - Day 1 Evening Rock Concert (RAW & Stills)',
          '03 - Day 2 Tech Arena & Hackathon',
          '04 - Day 2 Valedictory & Trophy Lift',
          '05 - Highlights & Selects (High-Res JPG)'
        ];
      case 'VIDEOGRAPHER':
        return [
          '01 - Day 1 Morning (4K B-Roll & Stems)',
          '02 - Day 1 Rock Concert Multi-Cam',
          '03 - Day 2 Robo-Wars (120fps Slow-Mo)',
          '04 - Day 2 Star Night Concert (4K Master)',
          '05 - Soundboard Audio Stems (WAV)'
        ];
      case 'VIDEO_EDITOR':
        return [
          '01 - Day 1 Instagram Reels (9-16)',
          '02 - Day 2 Instagram Reels (9-16)',
          '03 - Official Festival Recap (16-9)',
          '04 - Project Assets & SFX',
          '05 - Exports for Review'
        ];
      case 'MEDIA_COORDINATOR':
      case 'SUPER_ADMIN':
      default:
        return [
          '01 - Daily Curated Highlights',
          '02 - Press & Sponsor Kits',
          '03 - Master Event Archives'
        ];
    }
  }

  static async provisionPersonalUserDrive(user: { id: string; full_name: string; email?: string; roles: UserRole[] }): Promise<PersonalDriveInfo> {
    const role = user.roles[0] || 'PHOTOGRAPHER';
    const rootId = config.google.rootFolderId || '1PNvblS0BffXR12av3dC7fP7wNdf948kO';

    // 1. Check if user already has a personal drive record in db.mediaFolders
    const existingPersonalRoot = db.mediaFolders.find(
      f => f.user_id === user.id && f.is_personal && (!f.parent_folder_id || f.parent_folder_id === '')
    );

    if (existingPersonalRoot) {
      const existingSubs = db.mediaFolders.filter(
        f => f.user_id === user.id && f.is_personal && f.parent_folder_id === existingPersonalRoot.id
      );

      const subList = existingSubs.map(s => ({
        id: s.id,
        name: s.folder_name,
        path: s.folder_path,
        driveFolderId: s.drive_folder_id,
        driveWebUrl: s.drive_web_url,
        isDefault: s.is_system_created,
        created_at: s.created_at
      }));

      const personalTree: FolderNode = {
        id: existingPersonalRoot.id,
        name: existingPersonalRoot.folder_name,
        path: existingPersonalRoot.folder_path,
        driveFolderId: existingPersonalRoot.drive_folder_id,
        driveWebUrl: existingPersonalRoot.drive_web_url,
        children: subList.map(s => ({
          id: s.id,
          name: s.name,
          path: s.path,
          driveFolderId: s.driveFolderId,
          driveWebUrl: s.driveWebUrl,
          children: []
        }))
      };

      if (user.email && user.email.includes('@') && !existingPersonalRoot.drive_folder_id.startsWith('user-drive-')) {
        this.shareFolderWithUser(existingPersonalRoot.drive_folder_id, user.email).catch(() => {});
      }

      return {
        userId: user.id,
        userName: user.full_name,
        role,
        structureMode: existingPersonalRoot.folder_name.includes('FULL EVENT') ? 'FULL_EVENT' : 'ROLE_SPECIFIC',
        sharedWithEmail: user.email,
        personalRootFolderId: existingPersonalRoot.drive_folder_id,
        personalRootFolderUrl: existingPersonalRoot.drive_web_url,
        personalRootPath: existingPersonalRoot.folder_path,
        tree: personalTree,
        subfolders: subList
      };
    }

    // 2. Ensure "Crew Personal Drives" parent folder exists in Google Drive
    const parentContainerName = 'Crew Personal Drives';
    let crewDrivesParentId = this.folderIdCache.get(parentContainerName) || '';
    if (!crewDrivesParentId) {
      try {
        crewDrivesParentId = await this.getOrCreateDriveFolder(parentContainerName, rootId);
        this.folderIdCache.set(parentContainerName, crewDrivesParentId);
      } catch (err: any) {
        console.warn(`[DriveService] Could not create "${parentContainerName}" in Drive: ${err.message}. Using root.`);
        crewDrivesParentId = rootId;
      }
    }

    // 3. Create user's personal root folder: "[User Full Name] ([ROLE])"
    const userFolderName = `${user.full_name} (${role})`;
    let userDriveFolderId = '';
    try {
      userDriveFolderId = await this.getOrCreateDriveFolder(userFolderName, crewDrivesParentId);
    } catch {
      userDriveFolderId = `user-drive-${user.id.slice(0, 8)}`;
    }

    const personalRootPath = `/DSA MEDIAVERSE SAVISKAR 26/${parentContainerName}/${userFolderName}`;
    const personalRootRecord: MediaFolder = {
      id: crypto.randomUUID(),
      event_id: 'saviskar-2026',
      folder_name: userFolderName,
      folder_path: personalRootPath,
      drive_folder_id: userDriveFolderId,
      drive_web_url: `https://drive.google.com/drive/folders/${userDriveFolderId}`,
      is_system_created: false,
      user_id: user.id,
      user_name: user.full_name,
      role,
      is_personal: true,
      created_at: new Date().toISOString()
    };

    db.mediaFolders.push(personalRootRecord);
    this.folderIdCache.set(personalRootPath, userDriveFolderId);
    this.folderIdCache.set(userFolderName, userDriveFolderId);
    await SupabaseService.persistMediaFolder(personalRootRecord).catch(() => {});

    // 4. Provision role-specific template subfolders
    const templateNames = this.getPersonalDriveTemplates(role);
    const subfolders: PersonalSubfolder[] = [];

    for (const subName of templateNames) {
      let subDriveId = '';
      if (!userDriveFolderId.startsWith('user-drive-')) {
        try {
          subDriveId = await this.getOrCreateDriveFolder(subName, userDriveFolderId);
        } catch {
          subDriveId = `sub-${crypto.randomUUID().slice(0, 8)}`;
        }
      } else {
        subDriveId = `sub-${crypto.randomUUID().slice(0, 8)}`;
      }

      const subPath = `${personalRootPath}/${subName}`;
      const subRecord: MediaFolder = {
        id: crypto.randomUUID(),
        event_id: 'saviskar-2026',
        folder_name: subName,
        folder_path: subPath,
        parent_folder_id: personalRootRecord.id,
        drive_folder_id: subDriveId,
        drive_web_url: `https://drive.google.com/drive/folders/${subDriveId}`,
        is_system_created: true,
        user_id: user.id,
        user_name: user.full_name,
        role,
        is_personal: true,
        created_at: new Date().toISOString()
      };

      db.mediaFolders.push(subRecord);
      this.folderIdCache.set(subPath, subDriveId);
      this.folderIdCache.set(subName, subDriveId);
      await SupabaseService.persistMediaFolder(subRecord).catch(() => {});

      subfolders.push({
        id: subRecord.id,
        name: subRecord.folder_name,
        path: subRecord.folder_path,
        driveFolderId: subRecord.drive_folder_id,
        driveWebUrl: subRecord.drive_web_url,
        isDefault: true,
        created_at: subRecord.created_at
      });
    }

    const personalTree: FolderNode = {
      id: personalRootRecord.id,
      name: personalRootRecord.folder_name,
      path: personalRootRecord.folder_path,
      driveFolderId: personalRootRecord.drive_folder_id,
      driveWebUrl: personalRootRecord.drive_web_url,
      children: subfolders.map(s => ({
        id: s.id,
        name: s.name,
        path: s.path,
        driveFolderId: s.driveFolderId,
        driveWebUrl: s.driveWebUrl,
        children: []
      }))
    };

    const userEmail = (user.email || '').trim().toLowerCase();
    let sharedWithEmail: string | undefined = undefined;
    if (userEmail && userEmail.includes('@') && !userDriveFolderId.startsWith('user-drive-')) {
      const shared = await this.shareFolderWithUser(userDriveFolderId, userEmail);
      if (shared) sharedWithEmail = userEmail;
    }

    console.log(`[DriveService] Successfully provisioned personal drive for ${user.full_name} (${role}) with ${subfolders.length} subfolders.`);

    return {
      userId: user.id,
      userName: user.full_name,
      role,
      structureMode: 'ROLE_SPECIFIC',
      sharedWithEmail,
      personalRootFolderId: userDriveFolderId,
      personalRootFolderUrl: personalRootRecord.drive_web_url,
      personalRootPath,
      tree: personalTree,
      subfolders
    };
  }

  static async getUserPersonalDrive(user: { id: string; full_name: string; email?: string; roles: UserRole[] }): Promise<PersonalDriveInfo> {
    return this.provisionPersonalUserDrive(user);
  }

  // User-driven custom setup: choose role-specific list OR full festival directory in their personal Drive
  static async setupUserPersonalDrive(
    user: { id: string; full_name: string; email?: string; roles: UserRole[] },
    options: {
      role: UserRole;
      structureMode: 'ROLE_SPECIFIC' | 'FULL_EVENT';
      customEmail?: string;
    }
  ): Promise<PersonalDriveInfo> {
    const role = options.role || user.roles[0] || 'PHOTOGRAPHER';
    const rootId = config.google.rootFolderId || '1PNvblS0BffXR12av3dC7fP7wNdf948kO';
    const parentContainerName = 'Crew Personal Drives';

    // 1. Ensure "Crew Personal Drives" parent folder exists in Google Drive
    let crewDrivesParentId = this.folderIdCache.get(parentContainerName) || '';
    if (!crewDrivesParentId) {
      try {
        crewDrivesParentId = await this.getOrCreateDriveFolder(parentContainerName, rootId);
        this.folderIdCache.set(parentContainerName, crewDrivesParentId);
      } catch {
        crewDrivesParentId = rootId;
      }
    }

    // 2. Clear old personal records for this user in db.mediaFolders to rebuild with chosen structure
    db.mediaFolders = db.mediaFolders.filter(f => f.user_id !== user.id);

    // 3. Choose naming and templates
    const isFullEvent = options.structureMode === 'FULL_EVENT';
    const userFolderName = isFullEvent
      ? `${user.full_name} (FULL FESTIVAL DIRECTORY)`
      : `${user.full_name} (${role})`;

    let userDriveFolderId = '';
    try {
      userDriveFolderId = await this.getOrCreateDriveFolder(userFolderName, crewDrivesParentId);
    } catch {
      userDriveFolderId = `user-drive-${user.id.slice(0, 8)}`;
    }

    const personalRootPath = `/DSA MEDIAVERSE SAVISKAR 26/${parentContainerName}/${userFolderName}`;
    const personalRootRecord: MediaFolder = {
      id: crypto.randomUUID(),
      event_id: 'saviskar-2026',
      folder_name: userFolderName,
      folder_path: personalRootPath,
      drive_folder_id: userDriveFolderId,
      drive_web_url: `https://drive.google.com/drive/folders/${userDriveFolderId}`,
      is_system_created: false,
      user_id: user.id,
      user_name: user.full_name,
      role,
      is_personal: true,
      created_at: new Date().toISOString()
    };

    db.mediaFolders.push(personalRootRecord);
    this.folderIdCache.set(personalRootPath, userDriveFolderId);
    this.folderIdCache.set(userFolderName, userDriveFolderId);
    await SupabaseService.persistMediaFolder(personalRootRecord).catch(() => {});

    // 4. Subfolders based on structure choice
    const templates = isFullEvent
      ? [
          'Day 1 - Photography',
          'Day 1 - Raw Videography',
          'Day 1 - Editing & Deliverables',
          'Day 2 - Photography',
          'Day 2 - Raw Videography',
          'Day 2 - Editing & Deliverables',
          'Day 3 - Valedictory & Awards',
          'Social Media Reels & Shorts (9-16)',
          'Master Branding & Logos'
        ]
      : this.getPersonalDriveTemplates(role);

    const subfolders: PersonalSubfolder[] = [];

    for (const subName of templates) {
      let subDriveId = '';
      if (!userDriveFolderId.startsWith('user-drive-')) {
        try {
          subDriveId = await this.getOrCreateDriveFolder(subName, userDriveFolderId);
        } catch {
          subDriveId = `sub-${crypto.randomUUID().slice(0, 8)}`;
        }
      } else {
        subDriveId = `sub-${crypto.randomUUID().slice(0, 8)}`;
      }

      const subPath = `${personalRootPath}/${subName}`;
      const subRecord: MediaFolder = {
        id: crypto.randomUUID(),
        event_id: 'saviskar-2026',
        folder_name: subName,
        folder_path: subPath,
        parent_folder_id: personalRootRecord.id,
        drive_folder_id: subDriveId,
        drive_web_url: `https://drive.google.com/drive/folders/${subDriveId}`,
        is_system_created: true,
        user_id: user.id,
        user_name: user.full_name,
        role,
        is_personal: true,
        created_at: new Date().toISOString()
      };

      db.mediaFolders.push(subRecord);
      this.folderIdCache.set(subPath, subDriveId);
      this.folderIdCache.set(subName, subDriveId);
      await SupabaseService.persistMediaFolder(subRecord).catch(() => {});

      subfolders.push({
        id: subRecord.id,
        name: subRecord.folder_name,
        path: subRecord.folder_path,
        driveFolderId: subRecord.drive_folder_id,
        driveWebUrl: subRecord.drive_web_url,
        isDefault: true,
        created_at: subRecord.created_at
      });
    }

    const personalTree: FolderNode = {
      id: personalRootRecord.id,
      name: personalRootRecord.folder_name,
      path: personalRootRecord.folder_path,
      driveFolderId: personalRootRecord.drive_folder_id,
      driveWebUrl: personalRootRecord.drive_web_url,
      children: subfolders.map(s => ({
        id: s.id,
        name: s.name,
        path: s.path,
        driveFolderId: s.driveFolderId,
        driveWebUrl: s.driveWebUrl,
        children: []
      }))
    };

    const targetEmail = (options.customEmail || user.email || '').trim().toLowerCase();
    let sharedWithEmail: string | undefined = undefined;
    if (targetEmail && targetEmail.includes('@') && !userDriveFolderId.startsWith('user-drive-')) {
      const shared = await this.shareFolderWithUser(userDriveFolderId, targetEmail);
      if (shared) sharedWithEmail = targetEmail;
    }

    console.log(`[DriveService] Reconfigured personal drive for ${user.full_name} (${role}) in mode ${options.structureMode} with ${subfolders.length} subfolders. (Shared with: ${sharedWithEmail || 'none'})`);

    return {
      userId: user.id,
      userName: user.full_name,
      role,
      structureMode: options.structureMode,
      customEmail: options.customEmail,
      sharedWithEmail,
      personalRootFolderId: userDriveFolderId,
      personalRootFolderUrl: personalRootRecord.drive_web_url,
      personalRootPath,
      tree: personalTree,
      subfolders
    };
  }

  static async addUserPersonalSubfolder(
    user: { id: string; full_name: string; roles: UserRole[] },
    folderName: string,
    parentDriveFolderId?: string
  ): Promise<PersonalSubfolder> {
    const cleanName = folderName.trim();
    if (!cleanName) throw new Error('Folder name cannot be empty.');

    const personalDrive = await this.getUserPersonalDrive(user);
    const parentId = parentDriveFolderId || personalDrive.personalRootFolderId;

    let newDriveId = '';
    if (!parentId.startsWith('user-drive-') && !parentId.startsWith('sub-')) {
      try {
        newDriveId = await this.getOrCreateDriveFolder(cleanName, parentId);
      } catch {
        newDriveId = `sub-${crypto.randomUUID().slice(0, 8)}`;
      }
    } else {
      newDriveId = `sub-${crypto.randomUUID().slice(0, 8)}`;
    }

    const subPath = `${personalDrive.personalRootPath}/${cleanName}`;

    const newRecord: MediaFolder = {
      id: crypto.randomUUID(),
      event_id: 'saviskar-2026',
      folder_name: cleanName,
      folder_path: subPath,
      parent_folder_id: personalDrive.personalRootFolderId,
      drive_folder_id: newDriveId,
      drive_web_url: `https://drive.google.com/drive/folders/${newDriveId}`,
      is_system_created: false,
      user_id: user.id,
      user_name: user.full_name,
      role: user.roles[0],
      is_personal: true,
      created_at: new Date().toISOString()
    };

    db.mediaFolders.push(newRecord);
    this.folderIdCache.set(subPath, newDriveId);
    this.folderIdCache.set(cleanName, newDriveId);
    await SupabaseService.persistMediaFolder(newRecord).catch(() => {});

    return {
      id: newRecord.id,
      name: newRecord.folder_name,
      path: newRecord.folder_path,
      driveFolderId: newRecord.drive_folder_id,
      driveWebUrl: newRecord.drive_web_url,
      isDefault: false,
      created_at: newRecord.created_at
    };
  }

  static async renameUserPersonalSubfolder(
    user: { id: string; full_name: string; roles: UserRole[] },
    driveFolderId: string,
    newName: string
  ): Promise<PersonalSubfolder> {
    const cleanName = newName.trim();
    if (!cleanName) throw new Error('New folder name cannot be empty.');

    const folderRecord = db.mediaFolders.find(
      f => f.drive_folder_id === driveFolderId && f.user_id === user.id
    );
    if (!folderRecord) {
      throw new Error('Personal folder not found or you do not have permission to rename it.');
    }

    const token = await this.getValidAccessToken();
    if (token && !driveFolderId.startsWith('user-drive-') && !driveFolderId.startsWith('sub-')) {
      try {
        await fetch(`https://www.googleapis.com/drive/v3/files/${driveFolderId}?supportsAllDrives=true`, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ name: cleanName })
        });
        console.log(`[DriveService] Renamed personal folder "${folderRecord.folder_name}" to "${cleanName}" in Google Drive`);
      } catch (err: any) {
        console.warn(`[DriveService] Drive rename error: ${err.message}`);
      }
    }

    folderRecord.folder_name = cleanName;
    const parts = folderRecord.folder_path.split('/');
    parts[parts.length - 1] = cleanName;
    folderRecord.folder_path = parts.join('/');

    this.folderIdCache.set(folderRecord.folder_path, driveFolderId);
    this.folderIdCache.set(cleanName, driveFolderId);
    await SupabaseService.persistMediaFolder(folderRecord).catch(() => {});

    return {
      id: folderRecord.id,
      name: folderRecord.folder_name,
      path: folderRecord.folder_path,
      driveFolderId: folderRecord.drive_folder_id,
      driveWebUrl: folderRecord.drive_web_url,
      isDefault: folderRecord.is_system_created,
      created_at: folderRecord.created_at
    };
  }

  static async deleteUserPersonalSubfolder(
    user: { id: string; full_name: string; roles: UserRole[] },
    driveFolderId: string
  ): Promise<{ success: boolean }> {
    const idx = db.mediaFolders.findIndex(
      f => f.drive_folder_id === driveFolderId && f.user_id === user.id
    );
    if (idx === -1) {
      throw new Error('Personal folder not found or you do not have permission to delete it.');
    }

    const folderRecord = db.mediaFolders[idx];
    if (folderRecord.is_system_created) {
      throw new Error('Default role root folders cannot be deleted. You can add or delete custom subfolders.');
    }

    const token = await this.getValidAccessToken();
    if (token && !driveFolderId.startsWith('user-drive-') && !driveFolderId.startsWith('sub-')) {
      try {
        await fetch(`https://www.googleapis.com/drive/v3/files/${driveFolderId}?supportsAllDrives=true`, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ trashed: true })
        });
        console.log(`[DriveService] Trashed personal folder "${folderRecord.folder_name}" in Google Drive`);
      } catch (err: any) {
        console.warn(`[DriveService] Drive trash error: ${err.message}`);
      }
    }

    db.mediaFolders.splice(idx, 1);
    this.folderIdCache.delete(folderRecord.folder_path);
    await SupabaseService.deleteMediaFolder(folderRecord.id).catch(() => {});

    return { success: true };
  }
}

// Initialize tokens from disk on startup
DriveService.init();
