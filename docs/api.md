# DSA MediaVerse AI — REST API Documentation

Base URL: `/api/v1`  
Protocol: HTTPS / JSON  
Authentication: `Authorization: Bearer <token>` or `x-user-id: <uuid>`

---

## 1. Authentication & Users
- `GET /api/v1/auth/me`  
  Returns profile and roles of the authenticated crew user.
- `GET /api/v1/auth/users`  
  Lists all active crew members with their assigned roles.
- `POST /api/v1/auth/switch-dev-role`  
  *Body:* `{ "role": "PHOTOGRAPHER" }`  
  Switches active persona in local development mode.

## 2. Events & Locations
- `GET /api/v1/events`  
  Lists active events (e.g., SAVISKAR 2026).
- `GET /api/v1/events/:id`  
  Returns event details and venues.
- `POST /api/v1/events` *(Coordinator / Admin)*  
  Creates a new event.
- `POST /api/v1/events/:id/locations` *(Coordinator / Admin)*  
  Adds a stage or venue (e.g., Main Auditorium, OAT).

## 3. Assignments & Shot Checklists
- `GET /api/v1/assignments`  
  *Query params:* `event_id`, `status`, `coverage_type`, `priority`, `my_assignments`
- `GET /api/v1/assignments/:id`  
  Returns assignment with checklist items and assigned members.
- `POST /api/v1/assignments` *(Coordinator / Admin)*  
  Creates assignment with initial shot checklist and crew assignees.
- `PATCH /api/v1/assignments/:id/status`  
  *Body:* `{ "status": "UPLOAD_PENDING", "notes": "Raw shots taken" }`  
  Validates state transition permissions and logs audit trail.
- `PATCH /api/v1/assignments/:id/checklist/:itemId`  
  Toggles shot checklist completion state.

## 4. Media Asset Registry
- `GET /api/v1/media`  
  *Query params:* `event_id`, `assignment_id`, `media_type`, `search`
- `POST /api/v1/media`  
  *Body:* `{ "event_id": "...", "filename": "SAV_RAW_001.ARW", "media_type": "RAW_PHOTO", "drive_web_url": "https://drive.google.com/..." }`  
  Validates Drive link, checks duplicate files, and registers asset.

## 5. Editing Projects & Versions
- `GET /api/v1/editing/projects`  
  Lists editing projects with latest version info.
- `POST /api/v1/editing/projects`  
  Creates a post-production project from an assignment.
- `POST /api/v1/editing/projects/:id/versions`  
  *Body:* `{ "version_label": "v1 Rough Cut", "drive_web_url": "...", "preview_url": "...", "notes": "..." }`  
  Appends version cut and moves status to `IN_REVIEW`.

## 6. Reviews & Approvals
- `POST /api/v1/reviews/comments`  
  *Body:* `{ "edit_version_id": "...", "comment": "Add whip-pan sound effect", "timecode_seconds": 12.4 }`  
  Adds timecoded revision comment.
- `POST /api/v1/reviews/decision` *(Reviewer / Coordinator / Leadership)*  
  *Body:* `{ "edit_version_id": "...", "decision": "APPROVED", "feedback": "...", "is_final_delivery": true }`  
  Approves or requests revisions on an edit version.

## 7. Storage (Google Drive)
- `GET /api/v1/drive/status`  
  Checks Drive API integration status or manual fallback mode.
- `GET /api/v1/drive/preview-structure`  
  Previews recommended SAVISKAR folder tree.
- `POST /api/v1/drive/provision-structure` *(Coordinator / Admin)*  
  Provisions standard folders.
- `POST /api/v1/drive/validate-url`  
  Validates Google Drive links and extracts file/folder IDs.

## 8. AI Media Operations Assistant
- `POST /api/v1/ai/prompt`  
  *Body:* `{ "prompt": "...", "context_type": "SHOTLIST" | "EDITING_BRIEF" | "SOCIAL_CAPTION" | "STATUS_SUMMARY" }`  
  Executes agentic generation using Gemini API with deterministic rule engine fallback.

## 9. Reports & Governance
- `GET /api/v1/reports/metrics`  
  Returns live operational task counts and overdue warnings.
- `GET /api/v1/reports/export?format=json|csv`  
  Exports operational database records.
- `GET /api/v1/notifications`  
  User notifications tray.
- `GET /api/v1/audit` *(Coordinator / Leadership)*  
  Audit log table.
- `GET /api/v1/health`  
  Uptime and system diagnostics.
