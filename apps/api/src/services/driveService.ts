import { config } from '../config';
import { db } from '../db/memoryStore';
import { MediaFolder, PersonalDriveInfo, PersonalSubfolder, UserRole, MemberDrive, DriveGrantedPermission } from '@mediaverse/shared-types';
import { SupabaseService } from './supabaseService';
import { AuthService } from './authService';
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
const MEMBERS_FILE_NAME = '.drive_members.json';

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

function getMemberFilePaths(): string[] {
  return [
    path.join(process.cwd(), MEMBERS_FILE_NAME),
    path.join(process.cwd(), 'apps', 'api', MEMBERS_FILE_NAME),
    path.resolve(__dirname, '../../', MEMBERS_FILE_NAME),
    path.resolve(__dirname, '../../../', MEMBERS_FILE_NAME)
  ];
}

function resolveMemberFilePath(): string {
  for (const p of getMemberFilePaths()) {
    if (fs.existsSync(p)) return p;
  }
  return path.join(process.cwd(), MEMBERS_FILE_NAME);
}

export class DriveService {
  private static tokenState: DriveTokenState = {};
  private static folderIdCache = new Map<string, string>();
  private static memberDrives: MemberDrive[] = [];
  private static tokenRefreshPromise: Promise<string | null> | null = null;

  static init(): void {
    this.loadTokensFromDisk();
    this.preloadFolderCache();
    this.loadMemberDrivesFromDisk();

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
    if (this.tokenRefreshPromise) {
      return this.tokenRefreshPromise;
    }

    this.tokenRefreshPromise = (async () => {
      try {
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
      } finally {
        this.tokenRefreshPromise = null;
      }
    })();

    return this.tokenRefreshPromise;
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

  // Helper to verify if an ID looks like an authentic Google Drive folder ID
  static isValidGoogleDriveId(id?: string): boolean {
    if (!id || typeof id !== 'string') return false;
    const clean = id.trim();
    if (!clean) return false;
    if (
      clean.startsWith('sub-') ||
      clean.startsWith('user-drive-') ||
      clean.startsWith('member-drive-') ||
      clean.startsWith('folder-') ||
      clean.startsWith('sav26-') ||
      clean.startsWith('test-')
    ) {
      return false;
    }
    // Google Drive file and folder IDs are standard Base64url style alphanumeric tokens (15-70 chars)
    return /^[a-zA-Z0-9_-]{15,70}$/.test(clean);
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

    // 1. If destinationFolderId is a temporary/offline placeholder, resolve to authentic Drive ID
    if (destinationFolderId && !this.isValidGoogleDriveId(destinationFolderId)) {
      let resolvedRealId = '';
      if (this.folderIdCache.has(destinationFolderId)) {
        resolvedRealId = this.folderIdCache.get(destinationFolderId)!;
      }
      if (!resolvedRealId) {
        for (const md of this.memberDrives) {
          const matchingSub = md.subfolders?.find(s => s.driveFolderId === destinationFolderId || s.id === destinationFolderId || s.name === destinationFolderId);
          if (matchingSub && this.isValidGoogleDriveId(matchingSub.driveFolderId)) {
            resolvedRealId = matchingSub.driveFolderId;
            break;
          }
          if ((md.driveFolderId === destinationFolderId || md.id === destinationFolderId) && this.isValidGoogleDriveId(md.driveFolderId)) {
            resolvedRealId = md.driveFolderId;
            break;
          }
        }
      }
      if (!resolvedRealId) {
        const matchingDbFolder = db.mediaFolders.find(f => f.drive_folder_id === destinationFolderId || f.id === destinationFolderId || f.folder_name === destinationFolderId);
        if (matchingDbFolder && this.isValidGoogleDriveId(matchingDbFolder.drive_folder_id)) {
          resolvedRealId = matchingDbFolder.drive_folder_id;
        }
      }
      destinationFolderId = resolvedRealId;
    }

    // 2. Fall back to resolved category folder or verified festival root
    if (!this.isValidGoogleDriveId(destinationFolderId)) {
      const dest = options.destination || this.resolveDestination();
      if (this.isValidGoogleDriveId(dest.driveFolderId)) {
        destinationFolderId = dest.driveFolderId;
        finalFolderPath = finalFolderPath || dest.fullPath;
      } else {
        const root = await this.resolveRootFolderId();
        destinationFolderId = root.id;
        finalFolderPath = finalFolderPath || dest.fullPath || 'SAVISKAR 2026';
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

    // 1. If targetFolderId is provided, resolve placeholder or check cache
    if (targetFolderId && targetFolderId.trim()) {
      const cleanTargetId = targetFolderId.trim();
      if (!this.isValidGoogleDriveId(cleanTargetId)) {
        let resolvedRealId = '';
        if (this.folderIdCache.has(cleanTargetId)) {
          resolvedRealId = this.folderIdCache.get(cleanTargetId)!;
        }
        if (!resolvedRealId) {
          for (const md of this.memberDrives) {
            const matchingSub = md.subfolders?.find(s => s.driveFolderId === cleanTargetId || s.id === cleanTargetId || s.name === cleanTargetId);
            if (matchingSub && this.isValidGoogleDriveId(matchingSub.driveFolderId)) {
              resolvedRealId = matchingSub.driveFolderId;
              break;
            }
            if ((md.driveFolderId === cleanTargetId || md.id === cleanTargetId) && this.isValidGoogleDriveId(md.driveFolderId)) {
              resolvedRealId = md.driveFolderId;
              break;
            }
          }
        }
        if (!resolvedRealId) {
          const matchingDbFolder = db.mediaFolders.find(f => f.drive_folder_id === cleanTargetId || f.id === cleanTargetId || f.folder_name === cleanTargetId);
          if (matchingDbFolder && this.isValidGoogleDriveId(matchingDbFolder.drive_folder_id)) {
            resolvedRealId = matchingDbFolder.drive_folder_id;
          }
        }
        destinationFolderId = resolvedRealId;
      } else {
        destinationFolderId = cleanTargetId;
      }
      finalFolderPath = targetFolderPath || 'Selected Google Drive Folder';
    } else if (targetFolderPath && targetFolderPath.trim()) {
      if (this.folderIdCache.has(targetFolderPath.trim())) {
        destinationFolderId = this.folderIdCache.get(targetFolderPath.trim())!;
        finalFolderPath = targetFolderPath.trim();
      } else {
        const structure = this.getFolderStructure();
        const node = this.findNodeByPath(structure, targetFolderPath.trim());
        if (node && this.isValidGoogleDriveId(node.driveFolderId)) {
          destinationFolderId = node.driveFolderId!;
          finalFolderPath = node.path;
        }
      }
    }

    // 2. Direct fast check from destination or verified festival root
    if (!this.isValidGoogleDriveId(destinationFolderId)) {
      const destination = options.destination || this.resolveDestination();
      if (this.isValidGoogleDriveId(destination.driveFolderId)) {
        destinationFolderId = destination.driveFolderId;
        finalFolderPath = destination.fullPath;
      } else {
        const root = await this.resolveRootFolderId();
        destinationFolderId = root.id;
        finalFolderPath = destination.fullPath || 'SAVISKAR 2026';
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

  static async shareFolderWithUser(
    folderId: string,
    email: string,
    role: 'reader' | 'writer' = 'writer'
  ): Promise<{ success: boolean; permissionId?: string }> {
    const cleanEmail = (email || '').trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) return { success: false };

    const token = await this.getValidAccessToken();
    if (!token || folderId.startsWith('user-drive-') || folderId.startsWith('member-drive-') || folderId.startsWith('sub-')) {
      return { success: true, permissionId: `mock-perm-${crypto.randomUUID().slice(0, 8)}` };
    }

    try {
      const res = await fetch(`https://www.googleapis.com/drive/v3/files/${folderId}/permissions?sendNotificationEmail=true&supportsAllDrives=true`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          role,
          type: 'user',
          emailAddress: cleanEmail
        })
      });

      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        console.log(`[DriveService] Successfully shared Google Drive folder ${folderId} with ${cleanEmail} (role: ${role}, id: ${data.id})`);
        return { success: true, permissionId: data.id };
      } else {
        const errData = await res.json().catch(() => ({}));
        console.warn(`[DriveService] Drive permission share warning for ${cleanEmail}:`, JSON.stringify(errData));
        return { success: false };
      }
    } catch (err: any) {
      console.warn(`[DriveService] Error sharing folder with ${cleanEmail}:`, err.message);
      return { success: false };
    }
  }

  static async updateFolderPermission(
    folderId: string,
    email: string,
    newRole: 'reader' | 'writer'
  ): Promise<boolean> {
    const cleanEmail = (email || '').trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) return false;

    const token = await this.getValidAccessToken();
    if (!token || folderId.startsWith('user-drive-') || folderId.startsWith('member-drive-') || folderId.startsWith('sub-')) {
      return true;
    }

    try {
      const listRes = await fetch(
        `https://www.googleapis.com/drive/v3/files/${folderId}/permissions?fields=permissions(id,emailAddress,role)&supportsAllDrives=true`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (listRes.ok) {
        const data = await listRes.json();
        const found = (data.permissions || []).find((p: any) => p.emailAddress?.toLowerCase() === cleanEmail);
        if (found && found.id) {
          const patchRes = await fetch(
            `https://www.googleapis.com/drive/v3/files/${folderId}/permissions/${found.id}?supportsAllDrives=true`,
            {
              method: 'PATCH',
              headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ role: newRole })
            }
          );
          if (patchRes.ok) {
            console.log(`[DriveService] Updated permission on folder ${folderId} for ${cleanEmail} to "${newRole}".`);
            return true;
          }
        }
      }

      // If existing permission was not found in listing, create it
      const shareRes = await this.shareFolderWithUser(folderId, cleanEmail, newRole);
      return shareRes.success;
    } catch (err: any) {
      console.warn(`[DriveService] Update permission warning for ${cleanEmail}:`, err.message);
      return false;
    }
  }

  static async removeFolderPermission(
    folderId: string,
    permissionId?: string,
    email?: string
  ): Promise<boolean> {
    const token = await this.getValidAccessToken();
    if (!token || folderId.startsWith('user-drive-') || folderId.startsWith('member-drive-') || folderId.startsWith('sub-')) {
      return true;
    }

    try {
      let targetId = permissionId;
      if (!targetId && email) {
        const cleanEmail = email.trim().toLowerCase();
        const listRes = await fetch(
          `https://www.googleapis.com/drive/v3/files/${folderId}/permissions?fields=permissions(id,emailAddress,role)&supportsAllDrives=true`,
          {
            headers: { Authorization: `Bearer ${token}` }
          }
        );
        if (listRes.ok) {
          const data = await listRes.json();
          const found = (data.permissions || []).find((p: any) => p.emailAddress?.toLowerCase() === cleanEmail);
          if (found) targetId = found.id;
        }
      }

      if (targetId && !targetId.startsWith('mock-perm-')) {
        const delRes = await fetch(
          `https://www.googleapis.com/drive/v3/files/${folderId}/permissions/${targetId}?supportsAllDrives=true`,
          {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` }
          }
        );
        return delRes.ok;
      }
      return true;
    } catch (err: any) {
      console.warn(`[DriveService] Remove permission warning:`, err.message);
      return false;
    }
  }

  static getPersonalDriveTemplates(role: UserRole | 'VLOGGER'): string[] {
    switch (role) {
      case 'PHOTOGRAPHER':
        return [
          '01 - Day 1 Morning Keynotes & Lamp Lighting (RAW Photos)',
          '02 - Day 1 Stage, Dignitaries & VIP Portraits',
          '03 - Day 1 Crowd Reactions, Stalls & Atmosphere',
          '04 - Day 1 Evening Rock Concert (Action & Stills)',
          '05 - Day 2 Tech Arena, Robotics & Hackathon (RAW)',
          '06 - Day 2 Valedictory, Trophies & Prize Distribution',
          '07 - High-Res Master Selects & Color Graded JPGs'
        ];
      case 'VIDEOGRAPHER':
      case 'VLOGGER':
        return [
          '01 - Day 1 Vlogs - BTS & Campus Walk (4K)',
          '02 - Day 1 Vlogs - Student Reactions & Live Interviews',
          '03 - Day 1 Rock Concert Multi-Cam (4K 60fps)',
          '04 - Day 2 Vlogs - Tech Hackathon Rush & Bot Fights',
          '05 - Day 2 Vlogs - Fest Grand Finale & Highlights',
          '06 - Drone Aerial B-Roll & Cinematic Establishing Shots',
          '07 - Vlog Audio Stems & Wireless Mic Recordings (WAV)'
        ];
      case 'VIDEO_EDITOR':
        return [
          '01 - Instagram Reels & Shorts (9-16 Edits)',
          '02 - Official Fest Recap & Aftermovie (16-9 Master)',
          '03 - Sponsor Cutdowns & Social Teasers',
          '04 - DaVinci Resolve & Premiere Project Files',
          '05 - Export Review Cuts & Draft Previews'
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

      if (user.email) {
        this.syncUserIntoMemberDrives({
          id: user.id,
          email: user.email,
          full_name: user.full_name,
          role,
          driveFolderId: existingPersonalRoot.drive_folder_id,
          driveWebUrl: existingPersonalRoot.drive_web_url,
          drivePath: existingPersonalRoot.folder_path,
          subfolders: subList,
          tree: personalTree
        });
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
      if (shared && shared.success) sharedWithEmail = userEmail;
    }

    if (userEmail) {
      this.syncUserIntoMemberDrives({
        id: user.id,
        email: userEmail,
        full_name: user.full_name,
        role,
        driveFolderId: userDriveFolderId,
        driveWebUrl: personalRootRecord.drive_web_url,
        drivePath: personalRootPath,
        subfolders,
        tree: personalTree
      });
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
      if (shared && shared.success) sharedWithEmail = targetEmail;
    }

    if (targetEmail) {
      this.syncUserIntoMemberDrives({
        id: user.id,
        email: targetEmail,
        full_name: user.full_name,
        role,
        driveFolderId: userDriveFolderId,
        driveWebUrl: personalRootRecord.drive_web_url,
        drivePath: personalRootPath,
        subfolders,
        tree: personalTree
      });
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

  // ========================================================
  // Super Admin Member Gmail-Wise Drives Management
  // ========================================================

  static syncUserIntoMemberDrives(data: {
    id: string;
    email: string;
    full_name: string;
    role: UserRole | 'VLOGGER';
    driveFolderId: string;
    driveWebUrl: string;
    drivePath: string;
    subfolders: PersonalSubfolder[];
    tree: FolderNode;
  }): void {
    const cleanEmail = (data.email || '').trim().toLowerCase();
    if (!cleanEmail) return;

    const existingIndex = this.memberDrives.findIndex(m => m.memberEmail.toLowerCase() === cleanEmail);
    const specializationLabel = data.role === 'PHOTOGRAPHER'
      ? 'Photography (RAW Photos & Stills Only)'
      : data.role === 'VIDEOGRAPHER' || (data.role as string) === 'VLOGGER'
      ? 'Videography & Vlogging (4K Footage & BTS)'
      : data.role === 'VIDEO_EDITOR'
      ? 'Video Editing & Deliverables'
      : `${data.role} Drive`;

    if (existingIndex >= 0) {
      const existing = this.memberDrives[existingIndex];
      this.memberDrives[existingIndex] = {
        ...existing,
        memberName: data.full_name || existing.memberName,
        role: data.role || existing.role,
        specializationLabel,
        driveFolderId: data.driveFolderId || existing.driveFolderId,
        driveWebUrl: data.driveWebUrl || existing.driveWebUrl,
        drivePath: data.drivePath || existing.drivePath,
        subfolders: data.subfolders && data.subfolders.length > 0 ? data.subfolders : existing.subfolders,
        tree: data.tree || existing.tree,
        accessLevel: existing.accessLevel || 'writer',
        grantedPermissions: existing.grantedPermissions || [],
        updatedAt: new Date().toISOString()
      };
    } else {
      const newDrive: MemberDrive = {
        id: `member-${data.id || crypto.randomUUID()}`,
        memberEmail: cleanEmail,
        memberName: data.full_name,
        role: data.role,
        specializationLabel,
        driveFolderId: data.driveFolderId,
        driveWebUrl: data.driveWebUrl,
        drivePath: data.drivePath,
        sharedWithEmail: cleanEmail,
        accessLevel: 'writer',
        grantedPermissions: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        subfolders: data.subfolders,
        tree: data.tree
      };
      this.memberDrives.push(newDrive);
    }
    this.saveMemberDrivesToDisk();
  }

  static loadMemberDrivesFromDisk(): void {
    const filePath = resolveMemberFilePath();
    const demoEmails = [
      'photographer@dsa.cgc.edu.in',
      'videographer@dsa.cgc.edu.in',
      'editor@dsa.cgc.edu.in',
      'karan.photo@dsa.cgc.edu.in',
      'coordinator@dsa.cgc.edu.in'
    ];

    try {
      if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, 'utf-8');
        const parsed: any[] = JSON.parse(raw);
        this.memberDrives = (Array.isArray(parsed) ? parsed : [])
          .filter(m => !demoEmails.includes((m.memberEmail || '').toLowerCase()))
          .map(m => ({
            ...m,
            accessLevel: m.accessLevel || 'writer',
            grantedPermissions: m.grantedPermissions || []
          }));
        console.log(`[DriveService] Loaded ${this.memberDrives.length} member drives from disk.`);
        return;
      }
    } catch (err: any) {
      console.warn(`[DriveService] Failed to load member drives from disk: ${err.message}`);
    }

    this.memberDrives = [];
    this.saveMemberDrivesToDisk();
  }

  static async deleteMemberDrive(memberDriveId: string): Promise<{ success: boolean; message: string }> {
    const drive = this.getMemberDriveById(memberDriveId);
    if (!drive) {
      throw new Error(`Member drive with ID "${memberDriveId}" not found.`);
    }

    const driveFolderId = drive.driveFolderId;
    const memberEmail = drive.memberEmail.toLowerCase();

    // Remove from in-memory memberDrives
    this.memberDrives = this.memberDrives.filter(
      m => m.id !== drive.id && m.memberEmail.toLowerCase() !== memberEmail
    );

    // Remove associated folders from db.mediaFolders
    db.mediaFolders = db.mediaFolders.filter(
      f => f.drive_folder_id !== driveFolderId && f.parent_folder_id !== driveFolderId && f.user_name !== drive.memberName
    );

    this.saveMemberDrivesToDisk();
    console.log(`[DriveService] Removed member drive for ${drive.memberName} (${drive.memberEmail}) from Drive Studio.`);

    return {
      success: true,
      message: `Member drive for "${drive.memberName}" removed successfully.`
    };
  }

  static saveMemberDrivesToDisk(): void {
    const filePath = resolveMemberFilePath();
    try {
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(filePath, JSON.stringify(this.memberDrives, null, 2), 'utf-8');
      console.log(`[DriveService] Persisted ${this.memberDrives.length} member drives to ${filePath}`);
    } catch (err: any) {
      console.warn(`[DriveService] Failed to save member drives to disk: ${err.message}`);
    }
  }

  static getSpecializationLabel(role: UserRole | string): string {
    return role === 'PHOTOGRAPHER'
      ? 'Photography (RAW Photos & Stills Only)'
      : role === 'VIDEOGRAPHER' || (role as string) === 'VLOGGER'
      ? 'Videography & Vlogging (4K Footage & BTS)'
      : role === 'VIDEO_EDITOR'
      ? 'Video Editing & Deliverables'
      : role === 'MEDIA_COORDINATOR'
      ? 'Media Coordination & Lead'
      : role === 'SUPER_ADMIN'
      ? 'Super Admin Festival Command'
      : `${role} Drive`;
  }

  static getAllMemberDrives(): MemberDrive[] {
    // 1. Reload from disk if in-memory list is empty
    if (this.memberDrives.length === 0) {
      this.loadMemberDrivesFromDisk();
    }

    // 2. Synchronize all registered user profiles from AuthService & db.profiles
    const registeredProfiles = AuthService.getAllRegisteredProfiles();
    const allProfiles = [...db.profiles, ...registeredProfiles];
    const demoEmails = [
      'photographer@dsa.cgc.edu.in',
      'videographer@dsa.cgc.edu.in',
      'editor@dsa.cgc.edu.in',
      'coordinator@dsa.cgc.edu.in',
      'karan.photo@dsa.cgc.edu.in'
    ];

    for (const p of allProfiles) {
      if (!p || !p.email) continue;
      const cleanEmail = p.email.trim().toLowerCase();
      if (demoEmails.includes(cleanEmail)) continue;

      // Check if user already exists in this.memberDrives
      const existingDrive = this.memberDrives.find(
        m => m.memberEmail.toLowerCase() === cleanEmail
      );

      if (!existingDrive) {
        const role = p.roles && p.roles.length > 0 ? p.roles[0] : 'PHOTOGRAPHER';
        const templates = this.getPersonalDriveTemplates(role);

        // Check if there are existing folder records in db.mediaFolders
        const personalRoot = db.mediaFolders.find(
          f => (f.user_id === p.id || f.user_name === p.full_name) && f.is_personal && (!f.parent_folder_id || f.parent_folder_id === '')
        );

        const subRecords = personalRoot
          ? db.mediaFolders.filter(f => f.parent_folder_id === personalRoot.id)
          : [];

        const subfolders: PersonalSubfolder[] = subRecords.length > 0
          ? subRecords.map(s => ({
              id: s.id,
              name: s.folder_name,
              path: s.folder_path,
              driveFolderId: s.drive_folder_id,
              driveWebUrl: s.drive_web_url,
              isDefault: s.is_system_created,
              created_at: s.created_at
            }))
          : templates.map(name => ({
              id: `sub-${crypto.randomUUID().slice(0, 8)}`,
              name,
              path: `SAVISKAR 2026 / Crew Personal Drives / ${p.full_name} (${role}) / ${name}`,
              driveFolderId: `sub-${crypto.randomUUID().slice(0, 8)}`,
              driveWebUrl: `https://drive.google.com/drive/folders/1PNvblS0BffXR12av3dC7fP7wNdf948kO`,
              isDefault: true,
              created_at: new Date().toISOString()
            }));

        const rootDriveId = personalRoot?.drive_folder_id || `user-drive-${p.id}`;
        const newDrive: MemberDrive = {
          id: `member-${p.id}`,
          memberEmail: cleanEmail,
          memberName: p.full_name,
          role,
          specializationLabel: this.getSpecializationLabel(role),
          driveFolderId: rootDriveId,
          driveWebUrl: personalRoot?.drive_web_url || `https://drive.google.com/drive/folders/${rootDriveId}`,
          drivePath: personalRoot?.folder_path || `SAVISKAR 2026 / Crew Personal Drives / ${p.full_name} (${role})`,
          sharedWithEmail: cleanEmail,
          accessLevel: 'writer',
          grantedPermissions: [],
          createdAt: p.created_at || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          subfolders,
          tree: {
            id: p.id,
            name: `${p.full_name} (${role})`,
            driveFolderId: rootDriveId,
            driveWebUrl: personalRoot?.drive_web_url || `https://drive.google.com/drive/folders/${rootDriveId}`,
            path: personalRoot?.folder_path || `SAVISKAR 2026 / Crew Personal Drives / ${p.full_name} (${role})`,
            children: subfolders.map(s => ({
              id: s.id,
              name: s.name,
              driveFolderId: s.driveFolderId,
              driveWebUrl: s.driveWebUrl,
              path: s.path,
              children: []
            }))
          }
        };

        this.memberDrives.push(newDrive);
      }
    }

    if (this.memberDrives.length > 0) {
      this.saveMemberDrivesToDisk();
    }

    return this.memberDrives;
  }

  static getMemberDriveById(id: string): MemberDrive | undefined {
    return this.memberDrives.find(m => m.id === id || m.memberEmail.toLowerCase() === id.toLowerCase());
  }

  static async createMemberDriveForGmail(options: {
    adminUser: { id: string; full_name: string };
    memberEmail: string;
    memberName: string;
    role: UserRole | 'VLOGGER';
    customSubfolders?: string[];
    accessLevel?: 'reader' | 'writer';
  }): Promise<MemberDrive> {
    const cleanEmail = (options.memberEmail || '').trim().toLowerCase();
    const cleanName = (options.memberName || '').trim();

    if (!cleanEmail || !cleanEmail.includes('@')) {
      throw new Error('Valid member Gmail address is required (e.g., photographer@gmail.com).');
    }
    if (!cleanName) {
      throw new Error('Member name is required.');
    }

    const role = options.role || 'PHOTOGRAPHER';
    const accessLevel = options.accessLevel || 'writer';
    const rootId = config.google.rootFolderId || '1PNvblS0BffXR12av3dC7fP7wNdf948kO';
    const parentContainerName = 'Crew Personal Drives';

    // 1. Ensure "Crew Personal Drives" parent container folder exists in Google Drive
    let crewDrivesParentId = this.folderIdCache.get(parentContainerName) || '';
    if (!crewDrivesParentId) {
      try {
        crewDrivesParentId = await this.getOrCreateDriveFolder(parentContainerName, rootId);
        this.folderIdCache.set(parentContainerName, crewDrivesParentId);
      } catch {
        crewDrivesParentId = rootId;
      }
    }

    // 2. Folder title: e.g. "Arjun Sharma (PHOTOGRAPHY)" or "Rohan Vlogs (VIDEOGRAPHY)"
    const specializationLabel = role === 'PHOTOGRAPHER'
      ? 'Photography (RAW Photos & Stills Only)'
      : role === 'VIDEOGRAPHER' || role === 'VLOGGER'
      ? 'Videography & Vlogging (4K Footage & BTS)'
      : role === 'VIDEO_EDITOR'
      ? 'Video Editing & Deliverables'
      : `${role} Drive`;

    const userFolderName = `${cleanName} (${role.toUpperCase()})`;

    let userDriveFolderId = '';
    try {
      userDriveFolderId = await this.getOrCreateDriveFolder(userFolderName, crewDrivesParentId);
    } catch {
      userDriveFolderId = `member-drive-${crypto.randomUUID().slice(0, 8)}`;
    }

    const drivePath = `/DSA MEDIAVERSE SAVISKAR 26/${parentContainerName}/${userFolderName}`;
    const driveWebUrl = `https://drive.google.com/drive/folders/${userDriveFolderId}`;

    // 3. Share with Gmail with specified access level (Download Only or Full Editor)
    let sharedWithEmail = cleanEmail;
    if (!userDriveFolderId.startsWith('member-drive-')) {
      try {
        await this.shareFolderWithUser(userDriveFolderId, cleanEmail, accessLevel);
      } catch (err: any) {
        console.warn(`[DriveService] Sharing invitation warning: ${err.message}`);
      }
    }

    // 4. Create role-specific subfolders (PHOTOGRAPHY ONLY has photography folders!)
    const templateNames = (options.customSubfolders && options.customSubfolders.length > 0)
      ? options.customSubfolders
      : this.getPersonalDriveTemplates(role);

    const subfolders: PersonalSubfolder[] = [];

    for (const subName of templateNames) {
      let subDriveId = '';
      if (!userDriveFolderId.startsWith('member-drive-')) {
        try {
          subDriveId = await this.getOrCreateDriveFolder(subName, userDriveFolderId);
        } catch {
          subDriveId = `sub-${crypto.randomUUID().slice(0, 8)}`;
        }
      } else {
        subDriveId = `sub-${crypto.randomUUID().slice(0, 8)}`;
      }

      const subPath = `${drivePath}/${subName}`;
      const subRecord: MediaFolder = {
        id: crypto.randomUUID(),
        event_id: 'saviskar-2026',
        folder_name: subName,
        folder_path: subPath,
        parent_folder_id: userDriveFolderId,
        drive_folder_id: subDriveId,
        drive_web_url: `https://drive.google.com/drive/folders/${subDriveId}`,
        is_system_created: true,
        user_name: cleanName,
        role: role as UserRole,
        is_personal: true,
        created_at: new Date().toISOString()
      };

      db.mediaFolders.push(subRecord);
      this.folderIdCache.set(subPath, subDriveId);
      this.folderIdCache.set(subName, subDriveId);
      await SupabaseService.persistMediaFolder(subRecord).catch(() => {});

      subfolders.push({
        id: subRecord.id,
        name: subName,
        path: subPath,
        driveFolderId: subDriveId,
        driveWebUrl: `https://drive.google.com/drive/folders/${subDriveId}`,
        isDefault: true,
        created_at: subRecord.created_at
      });
    }

    const driveTree: FolderNode = {
      id: userDriveFolderId,
      name: userFolderName,
      path: drivePath,
      driveFolderId: userDriveFolderId,
      driveWebUrl,
      children: subfolders.map(s => ({
        id: s.id,
        name: s.name,
        path: s.path,
        driveFolderId: s.driveFolderId,
        driveWebUrl: s.driveWebUrl,
        children: []
      }))
    };

    // Remove old record for this email if re-creating
    this.memberDrives = this.memberDrives.filter(m => m.memberEmail.toLowerCase() !== cleanEmail);

    const newDrive: MemberDrive = {
      id: `member-${crypto.randomUUID()}`,
      memberEmail: cleanEmail,
      memberName: cleanName,
      role,
      specializationLabel,
      driveFolderId: userDriveFolderId,
      driveWebUrl,
      drivePath,
      sharedWithEmail,
      accessLevel,
      grantedPermissions: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      subfolders,
      tree: driveTree
    };

    this.memberDrives.push(newDrive);
    this.saveMemberDrivesToDisk();

    console.log(`[DriveService] Created Super Admin member drive for ${cleanEmail} (${cleanName}, ${role}) with ${subfolders.length} subfolders. Access: ${accessLevel}`);

    return newDrive;
  }

  // ========================================================
  // Super Admin & Admin Drive Permission Delegation
  // ========================================================

  static async grantDriveAccessToUser(params: {
    driveId: string;
    targetEmail: string;
    targetName?: string;
    role: 'reader' | 'writer';
    adminUser: { id: string; full_name: string };
  }): Promise<MemberDrive> {
    const drive = this.getMemberDriveById(params.driveId);
    if (!drive) {
      throw new Error(`Member drive with ID "${params.driveId}" not found.`);
    }

    const cleanEmail = (params.targetEmail || '').trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      throw new Error('Valid target Gmail address is required (e.g., coordinator@gmail.com).');
    }

    // Call Google Drive API to share folder with chosen permission
    const shareRes = await this.shareFolderWithUser(drive.driveFolderId, cleanEmail, params.role);

    if (!drive.grantedPermissions) {
      drive.grantedPermissions = [];
    }

    const existingIndex = drive.grantedPermissions.findIndex(p => p.email.toLowerCase() === cleanEmail);
    const permissionEntry: DriveGrantedPermission = {
      id: shareRes.permissionId || `perm-${crypto.randomUUID().slice(0, 8)}`,
      email: cleanEmail,
      name: (params.targetName || '').trim() || cleanEmail.split('@')[0],
      role: params.role,
      grantedBy: params.adminUser.full_name,
      grantedAt: new Date().toISOString()
    };

    if (existingIndex >= 0) {
      drive.grantedPermissions[existingIndex] = permissionEntry;
    } else {
      drive.grantedPermissions.push(permissionEntry);
    }

    drive.updatedAt = new Date().toISOString();
    this.saveMemberDrivesToDisk();

    console.log(`[DriveService] Super Admin ${params.adminUser.full_name} granted ${params.role.toUpperCase()} access on ${drive.memberName}'s drive to ${cleanEmail}.`);
    return drive;
  }

  static async updateMemberDriveAccessLevel(params: {
    driveId: string;
    newAccessLevel: 'reader' | 'writer';
    adminUser: { id: string; full_name: string };
  }): Promise<MemberDrive> {
    const drive = this.getMemberDriveById(params.driveId);
    if (!drive) {
      throw new Error(`Member drive with ID "${params.driveId}" not found.`);
    }

    drive.accessLevel = params.newAccessLevel;
    drive.updatedAt = new Date().toISOString();

    // Update in Google Drive API if folder is live
    if (drive.memberEmail) {
      await this.updateFolderPermission(drive.driveFolderId, drive.memberEmail, params.newAccessLevel);
    }

    this.saveMemberDrivesToDisk();
    console.log(`[DriveService] Super Admin ${params.adminUser.full_name} updated primary access level of ${drive.memberName}'s drive to "${params.newAccessLevel}".`);
    return drive;
  }

  static async revokeDriveAccessFromUser(params: {
    driveId: string;
    targetEmail: string;
    adminUser: { id: string; full_name: string };
  }): Promise<MemberDrive> {
    const drive = this.getMemberDriveById(params.driveId);
    if (!drive) {
      throw new Error(`Member drive with ID "${params.driveId}" not found.`);
    }

    const cleanEmail = (params.targetEmail || '').trim().toLowerCase();
    if (!drive.grantedPermissions) {
      drive.grantedPermissions = [];
    }

    const targetPerm = drive.grantedPermissions.find(p => p.email.toLowerCase() === cleanEmail);
    if (targetPerm) {
      await this.removeFolderPermission(drive.driveFolderId, targetPerm.id, cleanEmail);
      drive.grantedPermissions = drive.grantedPermissions.filter(p => p.email.toLowerCase() !== cleanEmail);
    }

    drive.updatedAt = new Date().toISOString();
    this.saveMemberDrivesToDisk();
    console.log(`[DriveService] Super Admin ${params.adminUser.full_name} revoked access for ${cleanEmail} from ${drive.memberName}'s drive.`);
    return drive;
  }

  static async addMemberDriveSubfolder(
    memberDriveId: string,
    folderName: string,
    parentFolderId?: string
  ): Promise<PersonalSubfolder> {
    const cleanName = folderName.trim();
    if (!cleanName) throw new Error('Subfolder name cannot be empty.');

    const memberDrive = this.getMemberDriveById(memberDriveId);
    if (!memberDrive) throw new Error('Member drive not found.');

    const parentId = parentFolderId || memberDrive.driveFolderId;

    let subDriveId = '';
    if (!parentId.startsWith('member-drive-') && !parentId.startsWith('sub-')) {
      try {
        subDriveId = await this.getOrCreateDriveFolder(cleanName, parentId);
      } catch {
        subDriveId = `sub-${crypto.randomUUID().slice(0, 8)}`;
      }
    } else {
      subDriveId = `sub-${crypto.randomUUID().slice(0, 8)}`;
    }

    const subPath = `${memberDrive.drivePath}/${cleanName}`;
    const newSubfolder: PersonalSubfolder = {
      id: crypto.randomUUID(),
      name: cleanName,
      path: subPath,
      driveFolderId: subDriveId,
      driveWebUrl: `https://drive.google.com/drive/folders/${subDriveId}`,
      isDefault: false,
      created_at: new Date().toISOString()
    };

    memberDrive.subfolders.push(newSubfolder);
    memberDrive.updatedAt = new Date().toISOString();

    if (memberDrive.tree) {
      if (!memberDrive.tree.children) memberDrive.tree.children = [];
      memberDrive.tree.children.push({
        id: newSubfolder.id,
        name: newSubfolder.name,
        path: newSubfolder.path,
        driveFolderId: newSubfolder.driveFolderId,
        driveWebUrl: newSubfolder.driveWebUrl,
        children: []
      });
    }

    // Register in db.mediaFolders
    const mediaFolderRecord: MediaFolder = {
      id: newSubfolder.id,
      event_id: 'saviskar-2026',
      folder_name: cleanName,
      folder_path: subPath,
      parent_folder_id: parentId,
      drive_folder_id: subDriveId,
      drive_web_url: newSubfolder.driveWebUrl,
      is_system_created: false,
      user_name: memberDrive.memberName,
      role: memberDrive.role as UserRole,
      is_personal: true,
      created_at: newSubfolder.created_at
    };
    db.mediaFolders.push(mediaFolderRecord);

    this.saveMemberDrivesToDisk();
    return newSubfolder;
  }

  static async renameMemberDriveFolder(
    memberDriveId: string,
    folderId: string,
    newName: string
  ): Promise<PersonalSubfolder> {
    const cleanName = newName.trim();
    if (!cleanName) throw new Error('New folder name cannot be empty.');

    const memberDrive = this.getMemberDriveById(memberDriveId);
    if (!memberDrive) throw new Error('Member drive not found.');

    const sub = memberDrive.subfolders.find(s => s.id === folderId || s.driveFolderId === folderId);
    if (!sub) throw new Error('Subfolder not found in member drive.');

    // Patch name in Google Drive
    const token = await this.getValidAccessToken();
    if (token && !sub.driveFolderId.startsWith('sub-') && !sub.driveFolderId.startsWith('member-drive-')) {
      try {
        await fetch(`https://www.googleapis.com/drive/v3/files/${sub.driveFolderId}?supportsAllDrives=true`, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ name: cleanName })
        });
      } catch (err: any) {
        console.warn(`[DriveService] Drive patch warning: ${err.message}`);
      }
    }

    sub.name = cleanName;
    const parts = sub.path.split('/');
    parts[parts.length - 1] = cleanName;
    sub.path = parts.join('/');
    memberDrive.updatedAt = new Date().toISOString();

    if (memberDrive.tree && memberDrive.tree.children) {
      const treeNode = memberDrive.tree.children.find(c => c.driveFolderId === sub.driveFolderId || c.id === sub.id);
      if (treeNode) {
        treeNode.name = cleanName;
        treeNode.path = sub.path;
      }
    }

    // Update in db.mediaFolders
    const dbRec = db.mediaFolders.find(f => f.drive_folder_id === sub.driveFolderId);
    if (dbRec) {
      dbRec.folder_name = cleanName;
      dbRec.folder_path = sub.path;
    }

    this.saveMemberDrivesToDisk();
    return sub;
  }

  static async deleteMemberDriveFolder(
    memberDriveId: string,
    folderId: string
  ): Promise<{ success: boolean }> {
    const memberDrive = this.getMemberDriveById(memberDriveId);
    if (!memberDrive) throw new Error('Member drive not found.');

    const subIdx = memberDrive.subfolders.findIndex(s => s.id === folderId || s.driveFolderId === folderId);
    if (subIdx === -1) throw new Error('Subfolder not found in member drive.');

    const sub = memberDrive.subfolders[subIdx];

    // Trash in Google Drive
    const token = await this.getValidAccessToken();
    if (token && !sub.driveFolderId.startsWith('sub-') && !sub.driveFolderId.startsWith('member-drive-')) {
      try {
        await fetch(`https://www.googleapis.com/drive/v3/files/${sub.driveFolderId}?supportsAllDrives=true`, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ trashed: true })
        });
      } catch (err: any) {
        console.warn(`[DriveService] Drive trash warning: ${err.message}`);
      }
    }

    memberDrive.subfolders.splice(subIdx, 1);
    memberDrive.updatedAt = new Date().toISOString();

    if (memberDrive.tree && memberDrive.tree.children) {
      memberDrive.tree.children = memberDrive.tree.children.filter(c => c.driveFolderId !== sub.driveFolderId && c.id !== sub.id);
    }

    // Remove from db.mediaFolders
    db.mediaFolders = db.mediaFolders.filter(f => f.drive_folder_id !== sub.driveFolderId);

    this.saveMemberDrivesToDisk();
    return { success: true };
  }

  // Unified folder node rename across Master hierarchy and Personal/Member drives
  static async renameAnyFolderNode(params: {
    folderId?: string;
    folderPath?: string;
    newName: string;
  }): Promise<{ success: boolean; newName: string; path?: string; message: string }> {
    const cleanName = params.newName.trim();
    if (!cleanName) throw new Error('New folder name cannot be empty.');

    // 1. Try renaming in Master Hierarchy if folderPath is in root structure
    if (params.folderPath) {
      const root = this.getFolderStructure();
      const parentInfo = this.findParentOfPath(root, params.folderPath);
      if (parentInfo) {
        await this.renameFolder(params.folderPath, cleanName);
        return {
          success: true,
          newName: cleanName,
          path: params.folderPath,
          message: `Folder renamed to "${cleanName}" in master hierarchy.`
        };
      }
    }

    // 2. Try renaming in Member Drives
    for (const memberDrive of this.memberDrives) {
      const sub = memberDrive.subfolders.find(
        s => (params.folderId && s.driveFolderId === params.folderId) || (params.folderPath && s.path === params.folderPath)
      );
      if (sub) {
        await this.renameMemberDriveFolder(memberDrive.id, sub.id, cleanName);
        return {
          success: true,
          newName: cleanName,
          path: sub.path,
          message: `Folder renamed to "${cleanName}" in ${memberDrive.memberName}'s drive.`
        };
      }
      if (params.folderId && memberDrive.driveFolderId === params.folderId) {
        memberDrive.memberName = cleanName;
        this.saveMemberDrivesToDisk();
        return {
          success: true,
          newName: cleanName,
          message: `Drive root updated to "${cleanName}".`
        };
      }
    }

    // 3. Fallback: update in db.mediaFolders and Google Drive directly
    const folderRec = db.mediaFolders.find(
      f => (params.folderId && f.drive_folder_id === params.folderId) || (params.folderPath && f.folder_path === params.folderPath)
    );
    if (folderRec) {
      const token = await this.getValidAccessToken();
      if (token && !folderRec.drive_folder_id.startsWith('user-drive-') && !folderRec.drive_folder_id.startsWith('sub-')) {
        try {
          await fetch(`https://www.googleapis.com/drive/v3/files/${folderRec.drive_folder_id}?supportsAllDrives=true`, {
            method: 'PATCH',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name: cleanName })
          });
        } catch (err: any) {
          console.warn(`[DriveService] Drive patch warning: ${err.message}`);
        }
      }
      folderRec.folder_name = cleanName;
      return {
        success: true,
        newName: cleanName,
        path: folderRec.folder_path,
        message: `Folder renamed to "${cleanName}".`
      };
    }

    throw new Error(`Folder not found in hierarchy or member drives.`);
  }

  // Unified folder node delete across Master hierarchy and Member drives
  static async deleteAnyFolderNode(params: {
    folderId?: string;
    folderPath?: string;
  }): Promise<{ success: boolean; message: string }> {
    // 1. Master hierarchy delete
    if (params.folderPath) {
      const root = this.getFolderStructure();
      const parentInfo = this.findParentOfPath(root, params.folderPath);
      if (parentInfo) {
        await this.deleteFolder(params.folderPath);
        return { success: true, message: `Folder removed from master structure.` };
      }
    }

    // 2. Member drive subfolder delete
    for (const memberDrive of this.memberDrives) {
      const sub = memberDrive.subfolders.find(
        s => (params.folderId && s.driveFolderId === params.folderId) || (params.folderPath && s.path === params.folderPath)
      );
      if (sub) {
        await this.deleteMemberDriveFolder(memberDrive.id, sub.id);
        return { success: true, message: `Subfolder deleted from ${memberDrive.memberName}'s drive.` };
      }
    }

    // 3. MediaFolders record delete
    const folderIdx = db.mediaFolders.findIndex(
      f => (params.folderId && f.drive_folder_id === params.folderId) || (params.folderPath && f.folder_path === params.folderPath)
    );
    if (folderIdx !== -1) {
      const folderRec = db.mediaFolders[folderIdx];
      const token = await this.getValidAccessToken();
      if (token && !folderRec.drive_folder_id.startsWith('user-drive-') && !folderRec.drive_folder_id.startsWith('sub-')) {
        try {
          await fetch(`https://www.googleapis.com/drive/v3/files/${folderRec.drive_folder_id}?supportsAllDrives=true`, {
            method: 'PATCH',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ trashed: true })
          });
        } catch {}
      }
      db.mediaFolders.splice(folderIdx, 1);
      return { success: true, message: `Folder deleted successfully.` };
    }

    throw new Error('Folder not found.');
  }

  // ========================================================
  // Super Admin Data Transfer Engine (e.g. transfer into Vlogging)
  // ========================================================
  static async transferMediaData(params: {
    assetIds?: string[];
    sourceFolderId?: string;
    targetFolderId: string;
    targetFolderPath?: string;
    newCategory?: string;
  }): Promise<{
    success: boolean;
    transferredCount: number;
    targetFolderId: string;
    targetFolderPath: string;
    message: string;
    items: any[];
  }> {
    const { targetFolderId, targetFolderPath = 'Google Drive Target Folder', newCategory } = params;

    if (!targetFolderId) {
      throw new Error('targetFolderId is required to transfer media data.');
    }

    // Determine target assets
    let targetAssets = db.mediaAssets;
    if (params.assetIds && params.assetIds.length > 0) {
      targetAssets = targetAssets.filter(a => params.assetIds!.includes(a.id));
    } else if (params.sourceFolderId) {
      targetAssets = targetAssets.filter(
        a => a.drive_file_id === params.sourceFolderId ||
             (a.tags && a.tags.includes(params.sourceFolderId!))
      );
    }

    if (targetAssets.length === 0) {
      throw new Error('No media assets found matching the transfer selection.');
    }

    const token = await this.getValidAccessToken();
    const transferredItems: any[] = [];

    // Resolve targetFolderId if it points to an offline or newly created subfolder
    let realTargetDriveId = targetFolderId;
    if (token && (targetFolderId.startsWith('sub-') || targetFolderId.startsWith('member-drive-'))) {
      for (const md of this.memberDrives) {
        const matchingSub = md.subfolders?.find(s => s.driveFolderId === targetFolderId || s.id === targetFolderId);
        if (matchingSub) {
          if (md.driveFolderId && !md.driveFolderId.startsWith('member-drive-')) {
            try {
              realTargetDriveId = await this.getOrCreateDriveFolder(matchingSub.name, md.driveFolderId);
              matchingSub.driveFolderId = realTargetDriveId;
              matchingSub.driveWebUrl = `https://drive.google.com/drive/folders/${realTargetDriveId}`;
              this.saveMemberDrivesToDisk();
            } catch {
              realTargetDriveId = md.driveFolderId;
            }
          }
          break;
        }
        if (md.driveFolderId === targetFolderId || md.id === targetFolderId) {
          if (md.driveFolderId && !md.driveFolderId.startsWith('member-drive-')) {
            realTargetDriveId = md.driveFolderId;
          }
          break;
        }
      }
    }

    for (const asset of targetAssets) {
      // 1. Move Google Drive file if drive_file_id exists and token available
      if (token && asset.drive_file_id && !asset.drive_file_id.startsWith('mock-') && !realTargetDriveId.startsWith('sub-') && !realTargetDriveId.startsWith('member-drive-')) {
        try {
          // Fetch existing parents
          const metaRes = await fetch(
            `https://www.googleapis.com/drive/v3/files/${asset.drive_file_id}?fields=parents&supportsAllDrives=true`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          if (metaRes.ok) {
            const meta = (await metaRes.json()) as any;
            const currentParents = (meta.parents || []).join(',');

            // Move file to realTargetDriveId
            await fetch(
              `https://www.googleapis.com/drive/v3/files/${asset.drive_file_id}?addParents=${realTargetDriveId}&removeParents=${currentParents}&supportsAllDrives=true`,
              {
                method: 'PATCH',
                headers: {
                  Authorization: `Bearer ${token}`,
                  'Content-Type': 'application/json'
                }
              }
            );
            console.log(`[DriveService] Transferred Drive file ${asset.drive_file_id} into folder ${realTargetDriveId}`);
          }
        } catch (err: any) {
          console.warn(`[DriveService] Cloud file transfer notice: ${err.message}`);
        }
      }

      // 2. Update local asset record
      if (newCategory) {
        asset.media_type = newCategory as any;
      }
      if (!asset.tags) asset.tags = [];
      asset.tags.push(`transferred-to-${newCategory || 'target'}`);
      asset.description = `${asset.description || ''} [Transferred to ${targetFolderPath}]`.trim();

      await SupabaseService.persistMediaAsset(asset).catch(() => {});
      transferredItems.push({
        id: asset.id,
        filename: asset.filename,
        media_type: asset.media_type
      });
    }

    console.log(`[DriveService] Transferred ${transferredItems.length} media items into ${targetFolderPath} (${targetFolderId})`);

    return {
      success: true,
      transferredCount: transferredItems.length,
      targetFolderId,
      targetFolderPath,
      message: `Successfully transferred ${transferredItems.length} media assets into ${targetFolderPath}`,
      items: transferredItems
    };
  }
}

// Initialize tokens from disk on startup
DriveService.init();
