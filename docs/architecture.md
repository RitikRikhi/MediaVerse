# DSA MediaVerse AI — Architecture Specification

## Overview
**DSA MediaVerse AI** is a specialized, zero-budget-first media operations and footage coordination platform developed for the DSA Media Crew at CGC University to execute end-to-end media coverage for **SAVISKAR 2026** (October 28–29, 2026).

---

## 1. High-Level Service Architecture

```
                  +----------------------------------------------+
                  |         Client Layer (React 18 SPA)          |
                  |  - Role-guarded workspaces (7 Personas)      |
                  |  - Fast Dev Persona Switcher                 |
                  |  - Shot Checklist & Drive link registration  |
                  +----------------------------------------------+
                                         |
                                         | REST / JSON
                                         v
                  +----------------------------------------------+
                  |       Core Backend API Layer (Express TS)    |
                  |  - RBAC & Status Workflow State Machine      |
                  |  - Input Validation (Zod Schemas)            |
                  |  - Audit Logging & In-App Notification Hub   |
                  +----------------------------------------------+
                       |                 |                  |
         +-------------+                 |                  +-------------+
         |                               |                                |
         v                               v                                v
+-------------------+        +----------------------+          +--------------------+
| Relational Store  |        | Storage Integration  |          | AI Assistant Engine|
| Supabase Postgres |        | Google Drive REST API|          | Gemini 1.5 Flash   |
| (17 tables / RLS) |        | - OAuth 2.0 Client   |          | + Deterministic    |
| & In-Memory Dev   |        | - Manual Link Guard  |          |   Rule Fallback    |
+-------------------+        +----------------------+          +--------------------+
```

---

## 2. Logical Service Boundaries

### Service A: Web Frontend (`apps/web`)
- **Technology:** React 18, Vite, TypeScript, Tailwind CSS, Lucide icons, React Router v6.
- **Responsibilities:**
  - Responsive, dark-mode-first media operations dashboard tailored for field crew tablets and mobile devices.
  - Role-based routing supporting:
    - Super Administrator
    - President / Leadership
    - Media Coordinator
    - Photographer
    - Videographer
    - Video Editor
    - QC Reviewer
  - Fast dev persona switcher for instant testing across all roles.
  - Interactive shot checklists with real-time percentage completion and author stamps.
  - Video draft preview and timecoded feedback interface.

### Service B: Authentication & Authorization (`apps/api/src/middleware/auth.ts`, `rbac.ts`)
- **Dual Mode:**
  - Production Mode: Supabase Auth JWT validation.
  - Local Dev Mode: `x-user-id` and `dev-<role>` bearer tokens mapped to realistic pre-seeded personas.
- **Role Permissions Matrix:**
  - Strict server-side enforcement on all status mutations and review decisions.
  - Super Admin has universal override access.
  - Coordinators oversee assignments, deadlines, locations, and drive provisioning.
  - Field crew can update capture progress, complete shot checklists, and register media.
  - Editors can create edit projects and submit version cuts (`v1`, `v2`, `vFinal`).
  - Reviewers can approve deliverables or request revisions.

### Service C: Core Backend API (`apps/api`)
- **Technology:** Node.js, Express, TypeScript, Zod.
- **Modular Domains:**
  - `/api/v1/events`: Event metadata and venues.
  - `/api/v1/assignments`: Assignment lifecycle and shotlists.
  - `/api/v1/media`: Registered media asset library and Google Drive links.
  - `/api/v1/editing`: Projects, version increments, and notes.
  - `/api/v1/reviews`: QC comments, timecodes, and approval decisions.
  - `/api/v1/drive`: Drive API status, folder provisioning, and URL validator.
  - `/api/v1/ai`: Prompt engine with Gemini cloud API and rule-based fallback.
  - `/api/v1/reports`: Live coordinator metrics and CSV/JSON export.
  - `/api/v1/notifications`: Real-time operational notification inbox.
  - `/api/v1/audit`: Activity audit trail.
  - `/api/v1/health`: System health and zero-cost environment diagnostics.

### Service D: Database Layer (`supabase/migrations`, `apps/api/src/db`)
- 17 Relational Tables:
  - `profiles`, `user_roles`, `events`, `event_locations`, `assignments`, `assignment_members`, `shot_checklists`, `media_assets`, `media_folders`, `editing_projects`, `edit_versions`, `review_comments`, `approvals`, `notifications`, `activity_logs`, `ai_action_logs`, `integration_settings`.
- Complete RLS policies and versioned SQL migration scripts.

### Service E: Google Drive Integration (`apps/api/src/services/driveService.ts`)
- Zero-Binary Streaming: Large 4K video clips and photo batches never stream through application servers, preventing bandwidth exhaustion on free-tier hosting.
- Direct URL registration with Google Drive ID parser.
- Standardized folder tree generator for SAVISKAR 2026.

### Service F: AI Assistant Engine (`apps/api/src/services/aiService.ts`)
- Provider abstraction supporting Google Gemini 1.5/2.0 Flash (free tier: 15 RPM / 1,500 RPD).
- 100% deterministic local rule fallback active whenever API key is missing, network is offline, or rate limit is reached.
- Essential workflows remain 100% operational regardless of AI availability.
