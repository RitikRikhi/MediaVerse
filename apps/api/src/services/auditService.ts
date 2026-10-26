import { db } from '../db/memoryStore';
import { ActivityLog, UserRole } from '@mediaverse/shared-types';
import { SupabaseService } from './supabaseService';
import crypto from 'crypto';

export class AuditService {
  static log(params: {
    actorId: string;
    actorName?: string;
    actorRole?: UserRole;
    action: string;
    entityType: string;
    entityId: string;
    details?: Record<string, any>;
  }): ActivityLog {
    const logEntry: ActivityLog = {
      id: crypto.randomUUID(),
      actor_id: params.actorId,
      actor_name: params.actorName || 'System',
      actor_role: params.actorRole,
      action: params.action,
      entity_type: params.entityType,
      entity_id: params.entityId,
      details: params.details || {},
      created_at: new Date().toISOString()
    };

    db.activityLogs.unshift(logEntry);
    SupabaseService.persistActivityLog(logEntry).catch(e => console.warn(e));
    return logEntry;
  }
}
