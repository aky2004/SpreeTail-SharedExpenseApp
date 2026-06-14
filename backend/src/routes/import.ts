import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { verifyToken } from '../middleware/auth.middleware';
import * as importService from '../services/import.service';
import { isGroupMember } from '../services/group.service';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// All import routes require authentication
router.use(verifyToken);

// Middleware to verify user is a member of the group
async function checkGroupAccess(req: Request, res: Response, next: NextFunction) {
  try {
    const groupId = parseInt(req.params.groupId);
    if (isNaN(groupId)) {
      res.status(400).json({ error: 'Invalid group ID' });
      return;
    }

    const userId = req.user!.id;
    const isMember = await isGroupMember(groupId, userId);
    if (!isMember) {
      res.status(403).json({ error: 'Access denied: You are not a member of this group' });
      return;
    }
    next();
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/import/group/:groupId/upload
 * Ingests a CSV file, parses it, runs anomaly detection, and returns a preview report.
 */
router.post(
  '/group/:groupId/upload',
  checkGroupAccess,
  upload.single('file'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const groupId = parseInt(req.params.groupId);
      const file = req.file;

      if (!file) {
        res.status(400).json({ error: 'No file uploaded' });
        return;
      }

      const fileContent = file.buffer.toString('utf-8');
      const result = await importService.previewCSVImport(
        groupId,
        fileContent,
        file.originalname,
        req.user!.id
      );

      res.status(200).json(result);
    } catch (error: any) {
      console.error('CSV Upload error:', error);
      res.status(400).json({ error: error.message || 'Failed to parse CSV file' });
    }
  }
);

/**
 * POST /api/import/confirm/:logId
 * Commits the resolved/previewed CSV rows to the database.
 */
router.post(
  '/confirm/:logId',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const logId = parseInt(req.params.logId);
      const { processedRows } = req.body;

      if (isNaN(logId)) {
        res.status(400).json({ error: 'Invalid import log ID' });
        return;
      }

      if (!processedRows || !Array.isArray(processedRows)) {
        res.status(400).json({ error: 'processedRows array is required' });
        return;
      }

      const result = await importService.confirmCSVImport(
        logId,
        processedRows,
        req.user!.id
      );

      res.status(200).json(result);
    } catch (error: any) {
      console.error('Confirm CSV Import error:', error);
      res.status(400).json({ error: error.message || 'Failed to confirm CSV import' });
    }
  }
);

/**
 * GET /api/import/group/:groupId/logs
 * Fetch all historical import log summaries for a group.
 */
router.get(
  '/group/:groupId/logs',
  checkGroupAccess,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const groupId = parseInt(req.params.groupId);
      const logs = await importService.getImportLogs(groupId);
      res.json(logs);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/import/log/:logId
 * Fetch full details of a single import log (including list of anomalies and duplicate pairs).
 */
router.get(
  '/log/:logId',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const logId = parseInt(req.params.logId);
      if (isNaN(logId)) {
        res.status(400).json({ error: 'Invalid log ID' });
        return;
      }

      const result = await importService.getImportLogDetail(logId);
      res.json(result);
    } catch (error: any) {
      if (error.message.includes('not found')) {
        res.status(404).json({ error: error.message });
        return;
      }
      next(error);
    }
  }
);

/**
 * POST /api/import/duplicate/:pairId/resolve
 * Resolve a suspected duplicate pair status.
 */
router.post(
  '/duplicate/:pairId/resolve',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const pairId = parseInt(req.params.pairId);
      const { status } = req.body;

      if (isNaN(pairId)) {
        res.status(400).json({ error: 'Invalid pair ID' });
        return;
      }

      if (!status || !['kept_both', 'deleted_a', 'deleted_b'].includes(status)) {
        res.status(400).json({ error: 'Valid status is required: kept_both, deleted_a, deleted_b' });
        return;
      }

      await importService.resolveDuplicatePair(pairId, status, req.user!.id);
      res.json({ message: 'Duplicate resolved successfully' });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
