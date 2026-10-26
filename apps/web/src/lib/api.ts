import {
  UserProfile,
  Assignment,
  ShotChecklistItem,
  MediaAsset,
  EditingProject,
  EditVersion,
  ReviewComment,
  Approval,
  InAppNotification,
  CoordinatorMetrics,
  UserRole
} from '../types';

const BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
const API_BASE = `${BASE_URL}/api/v1`;

class ApiClient {
  private getHeaders(): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json'
    };
    const activeUserId = localStorage.getItem('mediaverse_active_user_id');
    if (activeUserId) {
      headers['x-user-id'] = activeUserId;
    }
    const token = localStorage.getItem('mediaverse_auth_token');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers: {
        ...this.getHeaders(),
        ...options.headers
      }
    });

    const data = await res.json();
    if (!res.ok || data.success === false) {
      throw new Error(data.error?.message || `Request failed with status ${res.status}`);
    }

    return data.data;
  }

  // Auth
  async getCurrentUser(): Promise<UserProfile> {
    return this.request<UserProfile>('/auth/me');
  }

  async getAllUsers(): Promise<UserProfile[]> {
    return this.request<UserProfile[]>('/auth/users');
  }

  async login(credentials: { email: string; password?: string }): Promise<{ user: UserProfile; token: string }> {
    const data = await this.request<{ user: UserProfile; token: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials)
    });
    localStorage.setItem('mediaverse_active_user_id', data.user.id);
    localStorage.setItem('mediaverse_auth_token', data.token);
    return data;
  }

  async register(payload: {
    full_name: string;
    email: string;
    password?: string;
    role: UserRole;
    phone?: string;
  }): Promise<{ user: UserProfile; token: string }> {
    const data = await this.request<{ user: UserProfile; token: string }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    localStorage.setItem('mediaverse_active_user_id', data.user.id);
    localStorage.setItem('mediaverse_auth_token', data.token);
    return data;
  }

  async switchDevRole(role: UserRole): Promise<{ user: UserProfile; token: string }> {
    const data = await this.request<{ user: UserProfile; token: string }>('/auth/switch-dev-role', {
      method: 'POST',
      body: JSON.stringify({ role })
    });
    localStorage.setItem('mediaverse_active_user_id', data.user.id);
    localStorage.setItem('mediaverse_auth_token', data.token);
    return data;
  }

  // Events
  async getEvents(): Promise<any[]> {
    return this.request<any[]>('/events');
  }

  async getEvent(id: string): Promise<any> {
    return this.request<any>(`/events/${id}`);
  }

  async createEvent(payload: any): Promise<any> {
    return this.request<any>('/events', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  // Assignments
  async getAssignments(params?: {
    event_id?: string;
    status?: string;
    coverage_type?: string;
    priority?: string;
    my_assignments?: boolean;
  }): Promise<Assignment[]> {
    const query = new URLSearchParams();
    if (params?.event_id) query.set('event_id', params.event_id);
    if (params?.status) query.set('status', params.status);
    if (params?.coverage_type) query.set('coverage_type', params.coverage_type);
    if (params?.priority) query.set('priority', params.priority);
    if (params?.my_assignments) query.set('my_assignments', 'true');

    return this.request<Assignment[]>(`/assignments?${query.toString()}`);
  }

  async getAssignment(id: string): Promise<Assignment & { checklist: ShotChecklistItem[] }> {
    return this.request<Assignment & { checklist: ShotChecklistItem[] }>(`/assignments/${id}`);
  }

  async createAssignment(payload: any): Promise<Assignment> {
    return this.request<Assignment>('/assignments', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  async updateAssignmentStatus(id: string, status: string, notes?: string): Promise<Assignment> {
    return this.request<Assignment>(`/assignments/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, notes })
    });
  }

  async toggleChecklistItem(assignmentId: string, itemId: string): Promise<ShotChecklistItem> {
    return this.request<ShotChecklistItem>(`/assignments/${assignmentId}/checklist/${itemId}`, {
      method: 'PATCH'
    });
  }

  async addChecklistItem(assignmentId: string, payload: { shot_title: string; description?: string; is_required?: boolean }): Promise<ShotChecklistItem> {
    return this.request<ShotChecklistItem>(`/assignments/${assignmentId}/checklist`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  async deleteAssignment(id: string): Promise<{ success: boolean; message: string }> {
    return this.request<{ success: boolean; message: string }>(`/assignments/${id}`, {
      method: 'DELETE'
    });
  }

  // Media
  async getMediaAssets(params?: {
    event_id?: string;
    assignment_id?: string;
    media_type?: string;
    search?: string;
  }): Promise<MediaAsset[]> {
    const query = new URLSearchParams();
    if (params?.event_id) query.set('event_id', params.event_id);
    if (params?.assignment_id) query.set('assignment_id', params.assignment_id);
    if (params?.media_type) query.set('media_type', params.media_type);
    if (params?.search) query.set('search', params.search);

    return this.request<MediaAsset[]>(`/media?${query.toString()}`);
  }

  async registerMediaAsset(payload: any): Promise<MediaAsset> {
    return this.request<MediaAsset>('/media', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  async uploadMediaFile(
    formData: FormData,
    onProgress?: (percentage: number, loaded?: number, total?: number) => void
  ): Promise<{ asset: MediaAsset; destination: any; message: string }> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${API_BASE}/media/upload`);

      const activeUserId = localStorage.getItem('mediaverse_active_user_id');
      if (activeUserId) xhr.setRequestHeader('x-user-id', activeUserId);
      const token = localStorage.getItem('mediaverse_auth_token');
      if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);

      if (xhr.upload && onProgress) {
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const percent = Math.round((e.loaded / e.total) * 100);
            onProgress(percent, e.loaded, e.total);
          }
        };
      }

      xhr.onload = () => {
        try {
          const res = JSON.parse(xhr.responseText);
          if (xhr.status >= 200 && xhr.status < 300 && res.success) {
            resolve(res.data);
          } else {
            reject(new Error(res.error?.message || `Upload failed with status ${xhr.status}`));
          }
        } catch (e: any) {
          reject(new Error(e.message || 'Malformed server response'));
        }
      };

      xhr.onerror = () => reject(new Error('Network error during media upload. Check connection.'));
      xhr.send(formData);
    });
  }

  async getResolvedDestination(daySession?: string, mediaType?: string): Promise<any> {
    const q = new URLSearchParams();
    if (daySession) q.set('day_session', daySession);
    if (mediaType) q.set('media_type', mediaType);
    return this.request<any>(`/drive/destination?${q.toString()}`);
  }

  // Editing Projects & Versions
  async getEditingProjects(params?: { event_id?: string; status?: string }): Promise<EditingProject[]> {
    const query = new URLSearchParams();
    if (params?.event_id) query.set('event_id', params.event_id);
    if (params?.status) query.set('status', params.status);

    return this.request<EditingProject[]>(`/editing/projects?${query.toString()}`);
  }

  async getEditingProject(id: string): Promise<EditingProject> {
    return this.request<EditingProject>(`/editing/projects/${id}`);
  }

  async createEditingProject(payload: any): Promise<EditingProject> {
    return this.request<EditingProject>('/editing/projects', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  async submitEditVersion(projectId: string, payload: any): Promise<EditVersion> {
    return this.request<EditVersion>(`/editing/projects/${projectId}/versions`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  async uploadEditVersionFile(
    projectId: string,
    formData: FormData,
    onProgress?: (percentage: number) => void
  ): Promise<EditVersion> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${API_BASE}/editing/projects/${projectId}/upload-version`);

      const activeUserId = localStorage.getItem('mediaverse_active_user_id');
      if (activeUserId) xhr.setRequestHeader('x-user-id', activeUserId);
      const token = localStorage.getItem('mediaverse_auth_token');
      if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);

      if (xhr.upload && onProgress) {
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const percent = Math.round((e.loaded / e.total) * 100);
            onProgress(percent);
          }
        };
      }

      xhr.onload = () => {
        try {
          const res = JSON.parse(xhr.responseText);
          if (xhr.status >= 200 && xhr.status < 300 && res.success) {
            resolve(res.data);
          } else {
            reject(new Error(res.error?.message || `Upload failed with status ${xhr.status}`));
          }
        } catch (e: any) {
          reject(new Error(e.message || 'Malformed server response'));
        }
      };

      xhr.onerror = () => reject(new Error('Network error during edit upload. Check connection.'));
      xhr.send(formData);
    });
  }

  // Reviews & Approvals
  async addReviewComment(payload: { edit_version_id: string; comment: string; timecode_seconds?: number }): Promise<ReviewComment> {
    return this.request<ReviewComment>('/reviews/comments', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  async submitReviewDecision(payload: {
    edit_version_id: string;
    decision: 'APPROVED' | 'REVISION_REQUESTED';
    feedback: string;
    is_final_delivery?: boolean;
  }): Promise<{ approval: Approval; project_status: string }> {
    return this.request<{ approval: Approval; project_status: string }>('/reviews/decision', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  // Drive
  async getDriveStatus(): Promise<any> {
    return this.request<any>('/drive/status');
  }

  async getDriveAuthUrl(): Promise<{ authUrl: string; isConfigured: boolean }> {
    return this.request<{ authUrl: string; isConfigured: boolean }>('/drive/auth-url');
  }

  async getDriveFolderStructure(): Promise<{ structure: any; flatList: any[] }> {
    return this.request<{ structure: any; flatList: any[] }>('/drive/structure');
  }

  async addDriveFolder(parent_path: string, folder_name: string): Promise<any> {
    return this.request<any>('/drive/folders', {
      method: 'POST',
      body: JSON.stringify({ parent_path, folder_name })
    });
  }

  async renameDriveFolder(folder_path: string, new_name: string): Promise<any> {
    return this.request<any>('/drive/folders', {
      method: 'PATCH',
      body: JSON.stringify({ folder_path, new_name })
    });
  }

  async deleteDriveFolder(folder_path: string): Promise<any> {
    return this.request<any>('/drive/folders', {
      method: 'DELETE',
      body: JSON.stringify({ folder_path })
    });
  }

  async resetDriveStructure(): Promise<any> {
    return this.request<any>('/drive/reset-structure', {
      method: 'POST'
    });
  }

  async syncDriveFolders(): Promise<any> {
    return this.request<any>('/drive/sync-folders', {
      method: 'POST'
    });
  }

  async previewDriveStructure(eventName?: string): Promise<any> {
    return this.request<any>(`/drive/preview-structure?event_name=${encodeURIComponent(eventName || 'SAVISKAR 2026')}`);
  }

  async provisionDriveStructure(payload: { event_id?: string; root_folder_url?: string }): Promise<any> {
    return this.request<any>('/drive/provision-structure', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  async disconnectDrive(): Promise<any> {
    return this.request<any>('/drive/disconnect', {
      method: 'POST'
    });
  }

  // AI Assistant
  async promptAI(payload: {
    prompt: string;
    context_type:
      | 'GENERAL'
      | 'SHOTLIST'
      | 'EDITING_BRIEF'
      | 'SOCIAL_CAPTION'
      | 'STATUS_SUMMARY'
      | 'EQUIPMENT_CHECK'
      | 'CRISIS_RESOLVE'
      | 'ASSET_TAGGER';
    assignment_id?: string;
    event_id?: string;
  }): Promise<{
    text: string;
    mode: string;
    modelUsed?: string;
    tokensEstimated?: number;
    tokensSaved?: number;
    durationMs?: number;
    toolInvoked?: string;
  }> {
    return this.request<any>('/ai/prompt', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  async getAITelemetry(): Promise<any> {
    return this.request<any>('/ai/telemetry');
  }

  async applyShotlistToAssignment(assignment_id: string, text: string): Promise<any> {
    return this.request<any>('/ai/apply-shotlist', {
      method: 'POST',
      body: JSON.stringify({ assignment_id, text })
    });
  }

  // Reports & Metrics
  async getMetrics(eventId?: string): Promise<CoordinatorMetrics> {
    return this.request<CoordinatorMetrics>(`/reports/metrics${eventId ? `?event_id=${eventId}` : ''}`);
  }

  // Notifications
  async getNotifications(): Promise<InAppNotification[]> {
    return this.request<InAppNotification[]>('/notifications');
  }

  async markNotificationRead(id: string): Promise<InAppNotification> {
    return this.request<InAppNotification>(`/notifications/${id}/read`, {
      method: 'PATCH'
    });
  }

  async markAllNotificationsRead(): Promise<void> {
    await this.request('/notifications/mark-all-read', {
      method: 'POST'
    });
  }

  // Audit Logs
  async getAuditLogs(limit = 50): Promise<any[]> {
    return this.request<any[]>(`/audit?limit=${limit}`);
  }

  // Health
  async getHealth(): Promise<any> {
    return this.request<any>('/health');
  }
}

export const api = new ApiClient();
