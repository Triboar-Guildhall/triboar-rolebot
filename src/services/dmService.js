import logger from '../logger.js';

export class DMService {
  constructor(client) {
    this.client = client;
  }

  /**
   * Send grace period reminder DM to user
   */
  async sendGracePeriodReminder(discordId, daysRemaining) {
    try {
      const user = await this.client.users.fetch(discordId);

      const embed = {
        color: 0xB8860B, // guild-gold
        title: '⏰ Subscription Grace Period Reminder',
        description: `Your subscription has ended, but you still have access for ${daysRemaining} more day${daysRemaining !== 1 ? 's' : ''}!`,
        fields: [
          {
            name: 'Action Required',
            value: 'Renew your subscription to continue access after the grace period ends.',
            inline: false,
          },
          {
            name: 'Time Remaining',
            value: `${daysRemaining} day${daysRemaining !== 1 ? 's' : ''} left`,
            inline: true,
          },
          {
            name: 'What Happens Next',
            value: 'If you don\'t renew, your @Subscribed role will be removed and you\'ll lose access to member-only channels.',
            inline: false,
          },
        ],
        footer: {
          text: 'Reply STOP in DMs to opt out of these reminders',
        },
      };

      const actionRow = {
        type: 1,
        components: [
          {
            type: 2,
            style: 5,
            label: 'Renew Membership',
            url: 'https://triboar.guild/checkout/', // Update with your actual checkout URL
          },
        ],
      };

      await user.send({
        embeds: [embed],
        components: [actionRow],
      });

      logger.info({ discordId, daysRemaining }, 'Sent grace period reminder DM');
      return true;

    } catch (err) {
      logger.error({ err, discordId }, 'Failed to send grace period reminder');
      return false;
    }
  }

  /**
   * Send subscription expired notification
   */
  async sendSubscriptionExpiredNotification(discordId) {
    try {
      const user = await this.client.users.fetch(discordId);

      const embed = {
        color: 0xFF6B6B, // Red
        title: '❌ Subscription Expired',
        description: 'Your grace period has ended and your @Subscribed role has been removed.',
        fields: [
          {
            name: 'Lost Access',
            value: 'You no longer have access to member-only channels and features.',
            inline: false,
          },
          {
            name: 'Want Back In?',
            value: 'You can renew your subscription anytime to regain access.',
            inline: false,
          },
        ],
      };

      const actionRow = {
        type: 1,
        components: [
          {
            type: 2,
            style: 5,
            label: 'Renew Membership',
            url: 'https://triboar.guild/checkout/',
          },
        ],
      };

      await user.send({
        embeds: [embed],
        components: [actionRow],
      });

      logger.info({ discordId }, 'Sent subscription expired notification');
      return true;

    } catch (err) {
      logger.error({ err, discordId }, 'Failed to send subscription expired notification');
      return false;
    }
  }

  /**
   * Send welcome notification for new subscriber
   */
  async sendSubscriptionConfirmationDM(discordId, membershipName = 'Triboar Guildhall') {
    try {
      const user = await this.client.users.fetch(discordId);

      const embed = {
        color: 0x2C3E50, // guild-blue
        title: '🎉 Welcome to the Guildhall!',
        description: `Your ${membershipName} membership is now active!`,
        fields: [
          {
            name: 'You now have access to:',
            value: '• All campaigns and adventures\n• Community channels\n• Events and seasonal content',
            inline: false,
          },
          {
            name: 'Next Steps',
            value: 'Check out the #welcome channel for getting started guides and resources.',
            inline: false,
          },
        ],
        footer: {
          text: 'Welcome, adventurer!',
        },
      };

      await user.send({
        embeds: [embed],
      });

      logger.info({ discordId }, 'Sent subscription confirmation DM');
      return true;

    } catch (err) {
      logger.error({ err, discordId }, 'Failed to send subscription confirmation');
      return false;
    }
  }

  /**
   * Handle DM opt-out
   */
  async handleDMOptOut(userId) {
    logger.info({ userId }, 'User opted out of grace period DMs');
    // This will be handled by backend to update grace_period_dms_enabled
    return true;
  }
}
