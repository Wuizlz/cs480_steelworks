"use strict";
/**
 * Async handler wrapper for Express routes.
 *
 * Express 4 does not automatically catch async errors, so this
 * wrapper forwards rejections to the error middleware.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.asyncHandler = asyncHandler;
/**
 * Wrap an async route handler to ensure errors go to next().
 *
 * Time complexity: O(1).
 * Space complexity: O(1).
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    // Call the handler and route any rejection to Express error handling.
    fn(req, res, next).catch(next);
  };
}
