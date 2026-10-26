import { Router, Response } from 'express';
import { AuthenticatedRequest, authMiddleware } from '../middleware/auth';
import { requireRoles } from '../middleware/rbac';
import { db } from '../db/memoryStore';
import { CreateEventSchema, EventModel, EventLocation } from '@mediaverse/shared-types';
import { AuditService } from '../services/auditService';
import crypto from 'crypto';

export const eventsRouter = Router();

// List all events
eventsRouter.get('/', authMiddleware, (_req: AuthenticatedRequest, res: Response) => {
  res.json({
    success: true,
    data: db.events
  });
});

// Get single event by ID with locations
eventsRouter.get('/:id', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  const event = db.events.find(e => e.id === req.params.id);
  if (!event) {
    return res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Event not found' }
    });
  }

  const locations = db.eventLocations.filter(loc => loc.event_id === event.id);

  res.json({
    success: true,
    data: {
      ...event,
      locations
    }
  });
});

// Create new event (Coordinator or SuperAdmin only)
eventsRouter.post('/', authMiddleware, requireRoles('MEDIA_COORDINATOR', 'SUPER_ADMIN'), (req: AuthenticatedRequest, res: Response) => {
  const parsed = CreateEventSchema.parse(req.body);

  const existing = db.events.find(e => e.slug === parsed.slug);
  if (existing) {
    return res.status(400).json({
      success: false,
      error: { code: 'SLUG_EXISTS', message: 'An event with this slug already exists.' }
    });
  }

  const newEvent: EventModel = {
    id: crypto.randomUUID(),
    name: parsed.name,
    slug: parsed.slug,
    description: parsed.description,
    start_date: parsed.start_date,
    end_date: parsed.end_date,
    status: 'UPCOMING',
    drive_root_folder_id: parsed.drive_root_folder_id,
    drive_root_folder_url: parsed.drive_root_folder_url,
    created_by: req.user!.id,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  db.events.push(newEvent);

  AuditService.log({
    actorId: req.user!.id,
    actorName: req.user!.full_name,
    actorRole: req.user!.roles[0],
    action: 'CREATE_EVENT',
    entityType: 'EVENT',
    entityId: newEvent.id,
    details: { name: newEvent.name, slug: newEvent.slug }
  });

  res.status(201).json({
    success: true,
    data: newEvent
  });
});

// List locations for an event
eventsRouter.get('/:id/locations', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  const locations = db.eventLocations.filter(loc => loc.event_id === req.params.id);
  res.json({
    success: true,
    data: locations
  });
});

// Add a location to an event
eventsRouter.post('/:id/locations', authMiddleware, requireRoles('MEDIA_COORDINATOR', 'SUPER_ADMIN'), (req: AuthenticatedRequest, res: Response) => {
  const { name, code, description } = req.body;
  if (!name || !code) {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_INPUT', message: 'Location name and code are required' }
    });
  }

  const newLocation: EventLocation = {
    id: crypto.randomUUID(),
    event_id: req.params.id,
    name,
    code,
    description,
    created_at: new Date().toISOString()
  };

  db.eventLocations.push(newLocation);

  res.status(201).json({
    success: true,
    data: newLocation
  });
});
