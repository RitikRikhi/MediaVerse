# Google Drive Setup & Storage Architecture

## 1. Storage Architecture Overview
DSA Media Crew handles high volumes of media during SAVISKAR 2026:
- High-resolution RAW camera files (Sony .ARW, Canon .CR3, Nikon .NEF)
- 4K 60fps / 120fps video clips
- Multi-channel audio WAV stems
- Final broadcast MP4 edits

**Zero-Binary Server Architecture:**  
To comply with the zero-budget requirement and prevent cloud server crashes or bandwidth charges, media binaries **never stream through the Node.js API server**. Crew members upload directly to designated Google Drive folders from their phones/laptops and register the shareable link in the application.

---

## 2. Standard Event Folder Hierarchy

```
DSA Media Crew / SAVISKAR 2026/
  ├── 01 Photography/
  │   ├── Day 1 - Morning (Inauguration & Keynotes)
  │   ├── Day 1 - Evening (Cultural & Bands)
  │   ├── Day 2 - Morning (Tech Arena & Hackathon)
  │   └── Day 2 - Night (Star Night & Valedictory)
  ├── 02 Raw Videography/
  │   ├── Day 1 - 4K Stems & Multi-Cam
  │   └── Day 2 - 4K Stems & Drone Aerials
  ├── 03 Editing Projects/
  │   ├── Reels (9:16 Instagram & Shorts)
  │   ├── Highlights (16:9 Official Aftermovie)
  │   └── Interviews & Soundbites
  ├── 04 Review Versions (Rough & Polished Cuts)
  └── 05 Approved Final Deliverables (Broadcast Quality)
```

---

## 3. Configuration Modes

### Mode A: Zero-Cloud Manual Fallback (Default — Always Ready!)
- **No external Google Cloud setup needed.**
- Crew members paste Google Drive folder or file URLs directly into the application.
- The built-in URL parser validates links, checks for duplicates, and extracts resource IDs.
- Fully functional immediately on day one of the event.

### Mode B: Google Cloud Console Integration (Optional Automated Sync)
1. Go to [Google Cloud Console](https://console.cloud.google.com).
2. Create a project: `DSA-MediaVerse-CGC`.
3. Enable the **Google Drive API**.
4. Configure the OAuth Consent Screen:
   - User Type: External or Internal (CGC University Workspace).
   - Scopes: `https://www.googleapis.com/auth/drive.file`.
5. Create OAuth 2.0 Client ID (Web Application):
   - Authorized redirect URI: `http://localhost:3001/api/v1/drive/oauth2callback` (or your production URL).
6. Copy Client ID and Client Secret to backend `.env`:
   ```bash
   GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=your-client-secret
   GOOGLE_DRIVE_ROOT_FOLDER_ID=your-saviskar-root-folder-id
   ```
