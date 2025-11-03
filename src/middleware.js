import { config } from './config.js';
import logger from './logger.js';

/**
 * Middleware to verify webhook authentication token
 * Expects Authorization header: Bearer <BACKEND_API_TOKEN>
 */
export const verifyWebhookAuth = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      logger.warn('Webhook request missing authorization header');
      return res.status(401).json({ error: 'Missing authorization header' });
    }

    const [scheme, token] = authHeader.split(' ');

    if (scheme !== 'Bearer') {
      logger.warn('Webhook request using invalid authorization scheme');
      return res.status(401).json({ error: 'Invalid authorization scheme' });
    }

    if (!token) {
      logger.warn('Webhook request missing bearer token');
      return res.status(401).json({ error: 'Missing bearer token' });
    }

    if (token !== config.backend.apiToken) {
      logger.warn('Webhook request with invalid token');
      return res.status(403).json({ error: 'Invalid authentication token' });
    }

    // Token verified, continue to next middleware
    next();
  } catch (err) {
    logger.error({ err }, 'Webhook authentication error');
    return res.status(500).json({ error: 'Authentication error' });
  }
};
