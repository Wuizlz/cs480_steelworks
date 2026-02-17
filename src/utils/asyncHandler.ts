/**
 * Async handler wrapper for Express routes.
 *
 * Express 4 does not automatically catch async errors, so this
 * wrapper forwards rejections to the error middleware.
 */

import { Request, Response, NextFunction } from "express";

/**
 * Wrap an async route handler to ensure errors go to next().
 *
 * Time complexity: O(1).
 * Space complexity: O(1).
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Call the handler and route any rejection to Express error handling.
    fn(req, res, next).catch(next);
  };
}
