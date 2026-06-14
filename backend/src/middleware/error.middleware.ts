import { Request, Response, NextFunction } from 'express';

/**
 * Global error handling middleware.
 * Catches unhandled errors and returns a consistent JSON response.
 */
export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  console.error('❌ Unhandled error:', err.message);
  console.error(err.stack);

  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
};

/**
 * 404 handler for unknown routes.
 */
export const notFoundHandler = (req: Request, res: Response): void => {
  res.status(404).json({
    error: 'Not found',
    path: req.originalUrl,
  });
};
