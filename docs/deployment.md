# Zero-Budget Deployment Guide

DSA MediaVerse AI is engineered to operate 100% within permanent free-tier quotas.

---

## 1. Hosting Architecture & Free-Tier Limits

| Layer | Recommended Free Provider | Free Tier Limits | Cost |
| :--- | :--- | :--- | :--- |
| **Frontend** | Vercel / Cloudflare Pages | 100GB bandwidth, unlimited previews | $0.00 / month |
| **Backend API** | Render.com Web Service | 750 free instance hours / month | $0.00 / month |
| **Database & Auth** | Supabase | 500MB Postgres, 50,000 MAU Auth | $0.00 / month |
| **Media Storage** | Google Drive (CGC University) | 15GB+ per coordinator account | $0.00 / month |
| **AI Assistant** | Google AI Studio (Gemini Flash) | 15 RPM, 1,500 RPD free | $0.00 / month |
| **Total** | — | — | **$0.00** |

---

## 2. Step-by-Step Deployment Instructions

### Step 1: Database Setup on Supabase
1. Create a free account at [supabase.com](https://supabase.com).
2. Create a new project: `saviskar-mediaverse`.
3. Open the **SQL Editor** in your Supabase dashboard.
4. Copy and run `supabase/migrations/001_initial_schema.sql`.
5. Run `supabase/seed.sql` to populate initial SAVISKAR 2026 data.
6. Copy Project URL, Anon Key, and Service Role Key from **Settings -> API**.

### Step 2: Deploy Backend to Render.com
1. Create a free account on [render.com](https://render.com).
2. Create a new **Web Service** pointing to your Git repository.
3. Configure settings:
   - Root Directory: `apps/api`
   - Build Command: `npm install && npm run build`
   - Start Command: `npm start`
4. Set Environment Variables:
   ```bash
   NODE_ENV=production
   PORT=10000
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   APP_BASE_URL=https://your-app.vercel.app
   ```
5. Deploy. Verify health at `https://your-api.onrender.com/api/v1/health`.

### Step 3: Deploy Frontend to Vercel
1. Import repository on [vercel.com](https://vercel.com).
2. Framework Preset: **Vite**.
3. Root Directory: `apps/web`.
4. Build Command: `npm run build`.
5. Output Directory: `dist`.
6. Set Environment Variables:
   ```bash
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```
7. Configure API Proxy in `vercel.json` if directing `/api` to Render API.

---

## 3. Local Development Mode (Zero-Config)

If no external cloud accounts are available yet, run locally in zero-config development mode:
```bash
# 1. Install dependencies
npm install

# 2. Build shared packages
npm run build -w @mediaverse/shared-types

# 3. Start Backend API (Port 3001)
npm run dev:api

# 4. In a second terminal, start Frontend (Port 5173)
npm run dev:web
```
Access the application at `http://localhost:5173`.
All seed data, personas, and workflows are instantly usable!
