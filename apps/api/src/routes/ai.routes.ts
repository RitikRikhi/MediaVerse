import { Router, Response } from 'express';
import { AuthenticatedRequest, authMiddleware } from '../middleware/auth';
import { AIService } from '../services/aiService';
import { AIPromptRequestSchema } from '@mediaverse/shared-types';
import { z } from 'zod';
import { AuditService } from '../services/auditService';
import { SupabaseService } from '../services/supabaseService';

export const aiRouter = Router();

// Prompt the AI Agent
aiRouter.post('/prompt', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const body = {
      ...req.body,
      context_type: req.body.context_type || req.body.contextType || 'GENERAL',
      assignment_id: req.body.assignment_id || req.body.assignmentId,
      event_id: req.body.event_id || req.body.eventId
    };

    const parsedResult = AIPromptRequestSchema.safeParse(body);
    if (!parsedResult.success) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_REQUEST', message: parsedResult.error.message }
      });
    }

    const parsed = parsedResult.data;
    const result = await AIService.generate({
      prompt: parsed.prompt,
      contextType: parsed.context_type,
      assignmentId: parsed.assignment_id,
      eventId: parsed.event_id,
      user: req.user!
    });

    res.json({
      success: true,
      data: result
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { code: 'AI_ERROR', message: err.message || 'Internal AI service error' }
    });
  }
});

// Telemetry & Token Optimization Status
aiRouter.get('/telemetry', authMiddleware, (_req: AuthenticatedRequest, res: Response) => {
  res.json({
    success: true,
    data: AIService.getTelemetry()
  });
});

// Backward-compatible status check
aiRouter.get('/status', authMiddleware, (_req: AuthenticatedRequest, res: Response) => {
  const telemetry = AIService.getTelemetry();
  res.json({
    success: true,
    data: {
      isConfigured: AIService.isConfigured(),
      provider: 'Google Gemini',
      model: telemetry.activeModel,
      modelChain: telemetry.modelChain,
      cacheHitRate: telemetry.cacheHitRate,
      tokensSaved: telemetry.totalTokensSaved,
      tokensConsumed: telemetry.totalTokensConsumed,
      fallbackAvailable: true,
      freeTierProtectionActive: true,
      description: 'Zero-budget multi-tier fallback with semantic response cache & sliding-window rate limit protection.'
    }
  });
});

// Apply AI generated shot list directly into assignment checklist
const ApplyShotlistSchema = z.object({
  assignment_id: z.string().uuid(),
  text: z.string().min(5)
});

aiRouter.post('/apply-shotlist', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const body = {
      ...req.body,
      assignment_id: req.body.assignment_id || req.body.assignmentId
    };

    const parsedResult = ApplyShotlistSchema.safeParse(body);
    if (!parsedResult.success) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_REQUEST', message: parsedResult.error.message }
      });
    }

    const { assignment_id, text } = parsedResult.data;
    const result = AIService.applyShotlistToAssignment(assignment_id, text);

    for (const item of result.items) {
      await SupabaseService.persistChecklistItem(item);
    }

    AuditService.log({
      actorId: req.user!.id,
      actorName: req.user!.full_name,
      actorRole: req.user!.roles[0],
      action: 'AI_APPLY_SHOTLIST_TO_ASSIGNMENT',
      entityType: 'ASSIGNMENT',
      entityId: assignment_id,
      details: { addedCount: result.addedCount }
    });

    res.status(201).json({
      success: true,
      data: {
        message: `Successfully pushed ${result.addedCount} AI-generated shot checklist items to the assignment.`,
        addedCount: result.addedCount,
        items: result.items
      }
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { code: 'AI_APPLY_ERROR', message: err.message || 'Failed to apply shotlist' }
    });
  }
});
