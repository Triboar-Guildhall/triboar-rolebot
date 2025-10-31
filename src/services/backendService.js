import axios from 'axios';
import { config } from '../config.js';
import logger from '../logger.js';

export class BackendService {
  constructor() {
    this.apiUrl = config.backend.apiUrl;
    this.apiToken = config.backend.apiToken;
    this.client = axios.create({
      baseURL: this.apiUrl,
      headers: {
        'Authorization': `Bearer ${this.apiToken}`,
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Get all active subscribers from backend
   * Returns: { userId, discordId, expiresAt, isActive }[]
   */
  async getActiveSubscribers() {
    try {
      const response = await this.client.get('/api/admin/subscribers');
      return response.data.subscribers || [];
    } catch (err) {
      logger.error({ err }, 'Failed to get active subscribers from backend');
      return [];
    }
  }

  /**
   * Get users in grace period from backend
   * Returns: { userId, discordId, gracePeriodEndsAt, dmEnabled }[]
   */
  async getGracePeriodUsers() {
    try {
      const response = await this.client.get('/api/admin/grace-period');
      return response.data.gracePeriodUsers || [];
    } catch (err) {
      logger.error({ err }, 'Failed to get grace period users from backend');
      return [];
    }
  }

  /**
   * Move user to grace period (subscription ended, but within 7 days)
   */
  async moveToGracePeriod(userId, discordId) {
    try {
      await this.client.post('/api/admin/grace-period/add', {
        userId,
        discordId,
      });
      logger.info({ userId, discordId }, 'Moved user to grace period');
      return true;
    } catch (err) {
      logger.error({ err, userId }, 'Failed to move user to grace period');
      return false;
    }
  }

  /**
   * Remove user from grace period (subscription renewed)
   */
  async removeFromGracePeriod(userId, discordId) {
    try {
      await this.client.post('/api/admin/grace-period/remove', {
        userId,
        discordId,
      });
      logger.info({ userId, discordId }, 'Removed user from grace period');
      return true;
    } catch (err) {
      logger.error({ err, userId }, 'Failed to remove user from grace period');
      return false;
    }
  }

  /**
   * Remove user from grace period permanently (expired, not renewed)
   */
  async expireGracePeriod(userId, discordId) {
    try {
      await this.client.post('/api/admin/grace-period/expire', {
        userId,
        discordId,
      });
      logger.info({ userId, discordId }, 'Expired grace period user');
      return true;
    } catch (err) {
      logger.error({ err, userId }, 'Failed to expire grace period');
      return false;
    }
  }

  /**
   * Update DM preference for grace period user
   */
  async setGracePeriodDMPreference(userId, enabled) {
    try {
      await this.client.put(`/api/admin/users/${userId}/grace-dm-preference`, {
        dmEnabled: enabled,
      });
      logger.info({ userId, enabled }, 'Updated grace period DM preference');
      return true;
    } catch (err) {
      logger.error({ err, userId }, 'Failed to update DM preference');
      return false;
    }
  }

  /**
   * Log bot action to backend audit logs
   */
  async logBotAction(userId, action, details = {}) {
    try {
      await this.client.post('/api/admin/audit-log', {
        userId,
        eventType: `bot.${action}`,
        payload: details,
      });
    } catch (err) {
      logger.error({ err, userId, action }, 'Failed to log bot action');
    }
  }
}
