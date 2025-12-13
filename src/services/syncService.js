import logger from '../logger.js';

export class SyncService {
  constructor(roleService, backendService, dmService) {
    this.roleService = roleService;
    this.backendService = backendService;
    this.dmService = dmService;
  }

  /**
   * Perform daily sync of all subscriptions and grace periods
   * This runs every day at 11:59 PM
   */
  async performDailySync() {
    logger.info('Starting daily subscription sync...');

    try {
      // Get current state from backend
      const activeSubscribers = await this.backendService.getActiveSubscribers();
      const gracePeriodUsers = await this.backendService.getGracePeriodUsers();

      logger.info({ count: activeSubscribers.length }, 'Processing active subscribers');
      logger.info({ count: gracePeriodUsers.length }, 'Processing grace period users');

      // Sync active subscribers
      for (const subscriber of activeSubscribers) {
        await this.roleService.syncUserRole(subscriber.discordId, true);
      }

      // Sync grace period users
      for (const user of gracePeriodUsers) {
        const daysRemaining = this.calculateDaysRemaining(user.graceEndsAt);

        if (daysRemaining > 0) {
          // Still in grace period - ensure role is present
          await this.roleService.addSubscribedRole(user.discordId);

          // Send reminder DM if enabled (always enabled for grace period users)
          await this.dmService.sendGracePeriodReminder(user.discordId, daysRemaining);
        } else {
          // Grace period expired - remove role and notify (handled by backend daily sync)
          await this.roleService.removeSubscribedRole(user.discordId, 'Grace period expired');
          await this.dmService.sendSubscriptionExpiredNotification(user.discordId);
        }
      }

      // Check for any members with role who shouldn't have it
      const allSubscribedMembers = await this.roleService.getAllSubscribedMembers();
      const validIds = new Set([
        ...activeSubscribers.map(s => s.discordId),
        ...gracePeriodUsers.map(u => u.discordId),
      ]);

      for (const memberId of allSubscribedMembers) {
        if (!validIds.has(memberId)) {
          logger.warn({ memberId }, 'Found member with subscribed role but no valid subscription');
          await this.roleService.removeSubscribedRole(memberId, 'No active subscription found');
        }
      }

      logger.info('Daily sync completed successfully');
      return true;

    } catch (err) {
      logger.error({ err }, 'Daily sync failed');
      return false;
    }
  }

  /**
   * Sync a single user when their subscription status changes
   * Called when webhook receives payment - trusts the webhook data
   */
  async syncUserOnPayment(discordId) {
    try {
      logger.info({ discordId }, 'Syncing user on payment');

      // Trust the webhook - if backend says subscription.activated, proceed
      // This avoids race conditions where the subscription isn't yet queryable
      await this.roleService.addSubscribedRole(discordId);
      await this.dmService.sendSubscriptionConfirmationDM(discordId);

      // If user was in grace period, move them back to active
      try {
        const gracePeriodUsers = await this.backendService.getGracePeriodUsers();
        const graceUser = gracePeriodUsers.find(u => u.discordId === discordId);
        if (graceUser) {
          await this.backendService.removeFromGracePeriod(graceUser.userId, discordId);
        }
      } catch (err) {
        logger.warn({ err, discordId }, 'Failed to check/remove grace period');
      }

      logger.info({ discordId }, 'User synced on payment');
      return true;

    } catch (err) {
      logger.error({ err, discordId }, 'Failed to sync user on payment');
      return false;
    }
  }

  /**
   * Calculate days remaining in grace period
   */
  calculateDaysRemaining(gracePeriodEndsAt) {
    const now = new Date();
    const endDate = new Date(gracePeriodEndsAt);
    const diffTime = endDate - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  }
}
