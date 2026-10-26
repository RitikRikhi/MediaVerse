import { db } from '../db/memoryStore';
import { InAppNotification } from '@mediaverse/shared-types';
import { SupabaseService } from './supabaseService';
import crypto from 'crypto';

export class NotificationService {
  static send(params: {
    userId: string;
    title: string;
    message: string;
    type: 'ASSIGNMENT' | 'UPLOAD' | 'EDIT' | 'REVIEW' | 'APPROVAL' | 'SYSTEM' | 'DEADLINE';
    linkUrl?: string;
  }): InAppNotification {
    const notification: InAppNotification = {
      id: crypto.randomUUID(),
      user_id: params.userId,
      title: params.title,
      message: params.message,
      type: params.type,
      link_url: params.linkUrl,
      is_read: false,
      created_at: new Date().toISOString()
    };

    db.notifications.unshift(notification);
    SupabaseService.persistNotification(notification).catch(e => console.warn(e));
    return notification;
  }

  static broadcastToRoles(roles: string[], params: {
    title: string;
    message: string;
    type: 'ASSIGNMENT' | 'UPLOAD' | 'EDIT' | 'REVIEW' | 'APPROVAL' | 'SYSTEM' | 'DEADLINE';
    linkUrl?: string;
  }) {
    const targetProfiles = db.profiles.filter(p => p.roles.some(r => roles.includes(r)));
    for (const profile of targetProfiles) {
      this.send({ ...params, userId: profile.id });
    }
  }
}
