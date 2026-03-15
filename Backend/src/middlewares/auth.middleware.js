import { verifyJwt } from '../services/auth.service.js';

export function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization || '';
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    const token = match?.[1];

    if (!token) {
      return res.status(401).json({ success: false, message: 'Authorization token missing' });
    }

    const decoded = verifyJwt(token, 'access');
    req.user = {
      id: decoded.sub,
      tokenType: decoded.type || 'access',
    };

    return next();
  } catch (_error) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }
}
