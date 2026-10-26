# DSA MediaVerse AI

> **Operational Media Operations, Footage Coordination & Delivery Platform for SAVISKAR 2026**  
> *DSA Media Crew, CGC University (October 28–29, 2026)*

![DSA MediaVerse AI](https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=1200&h=400&fit=crop)

---

## Highlights

- 🚀 **Built for SAVISKAR 2026:** Complete operational platform coordinating photography, 4K multi-cam coverage, editing, QC reviews, and final delivery.
- 💰 **Zero-Budget First:** Built to run 100% permanently on genuinely free tiers (Supabase, Vercel/Render, Google Drive, Gemini Flash).
- 🔄 **Controlled Status State Machine:** `ASSIGNED` → `CAPTURING` → `UPLOAD_PENDING` → `AVAILABLE_FOR_EDITING` → `EDITING` → `IN_REVIEW` → `APPROVED` → `DELIVERED`.
- 👥 **7 Dedicated Role Personas:** Super Admin, President/Leadership, Media Coordinator, Photographer, Videographer, Video Editor, QC Reviewer.
- 📱 **Field-Ready Mobile UX:** Responsive checklists for photographers and videographers on the move across campus.
- 📁 **Google Drive Integration:** Zero-binary streaming architecture with standard SAVISKAR folder hierarchies and instant manual-link fallback.
- 🤖 **Agentic AI Assistant:** Generates shotlists, briefs, social captions, and daily production briefings with automatic offline rule-engine fallback.

---

## Quick Start (Local Development)

### Prerequisites
- Node.js v18+ or v22+
- npm v9+

### 1. Clone & Install
```bash
git clone <repo-url>
cd mediaverse
npm install
```

### 2. Build Shared Types
```bash
npm run build -w @mediaverse/shared-types
```

### 3. Start Development Servers
In two terminal tabs:
```bash
# Terminal 1: Backend API (Port 3001)
npm run dev:api

# Terminal 2: Web Frontend (Port 5173)
npm run dev:web
```

Open your browser at **`http://localhost:5173`**.

---

## Pre-Seeded Crew Personas for Testing

You can instantly switch personas using the dropdown in the top-right navbar:

| Persona | Name | Role | Responsibilities |
| :--- | :--- | :--- | :--- |
| **Priya Patel** | `coordinator@dsa.cgc.edu.in` | `MEDIA_COORDINATOR` | Central dashboard, assignments, Drive setup |
| **Rohan Singh** | `photographer@dsa.cgc.edu.in` | `PHOTOGRAPHER` | Field capture, shot checklist, photo uploads |
| **Vikram Malhotra**| `videographer@dsa.cgc.edu.in` | `VIDEOGRAPHER` | Multi-cam concert clips, 4K stems |
| **Simran Kaur** | `editor@dsa.cgc.edu.in` | `VIDEO_EDITOR` | Raw footage bank, cuts, version submission |
| **Dr. Neha Gupta**| `reviewer@dsa.cgc.edu.in` | `REVIEWER` | Timecode feedback, approvals, revisions |
| **Aman Verma** | `president@dsa.cgc.edu.in` | `PRESIDENT` | High-level fest progress, audit review |
| **Prof. Rajesh** | `admin@dsa.cgc.edu.in` | `SUPER_ADMIN` | Universal system governance |

---

## Running the Automated Test Suite

```bash
npm run test -w @mediaverse/api
```
Includes tests for status transitions, duplicate detection, version incrementing, review decisions, Drive URL validation, and AI offline degradation.

---

## Documentation

- [Architecture Plan](docs/architecture.md)
- [Database Schema & Migrations](docs/database-schema.md)
- [REST API Specification](docs/api.md)
- [Google Drive Setup Guide](docs/drive-setup.md)
- [Zero-Budget Deployment Guide](docs/deployment.md)
- [Crew Field Operations Manual](docs/operations-guide.md)

---
*Created with pride for DSA Media Crew at CGC University.*
