/**
 * Higher-order wrapper to catch rejected promises in async route handlers
 */
export const catchAsync = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next)
}
