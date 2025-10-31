import { config } from '../config.js';
import logger from '../logger.js';

export class RoleService {
  constructor(client) {
    this.client = client;
    this.guildId = config.discord.guildId;
    this.subscribedRoleId = config.discord.subscribedRoleId;
  }

  /**
   * Add subscribed role to user
   */
  async addSubscribedRole(discordId) {
    try {
      const guild = await this.client.guilds.fetch(this.guildId);
      const member = await guild.members.fetch(discordId);
      const role = await guild.roles.fetch(this.subscribedRoleId);

      if (!role) {
        logger.error({ roleId: this.subscribedRoleId }, 'Subscribed role not found');
        return false;
      }

      if (member.roles.cache.has(this.subscribedRoleId)) {
        logger.debug({ discordId }, 'Member already has subscribed role');
        return true;
      }

      await member.roles.add(role, 'Subscription active');
      logger.info({ discordId }, 'Added subscribed role');
      return true;

    } catch (err) {
      logger.error({ err, discordId }, 'Failed to add subscribed role');
      return false;
    }
  }

  /**
   * Remove subscribed role from user
   */
  async removeSubscribedRole(discordId, reason = 'Subscription ended') {
    try {
      const guild = await this.client.guilds.fetch(this.guildId);
      const member = await guild.members.fetch(discordId);

      if (!member.roles.cache.has(this.subscribedRoleId)) {
        logger.debug({ discordId }, 'Member does not have subscribed role');
        return true;
      }

      await member.roles.remove(this.subscribedRoleId, reason);
      logger.info({ discordId, reason }, 'Removed subscribed role');
      return true;

    } catch (err) {
      logger.error({ err, discordId }, 'Failed to remove subscribed role');
      return false;
    }
  }

  /**
   * Check if user has subscribed role
   */
  async hasSubscribedRole(discordId) {
    try {
      const guild = await this.client.guilds.fetch(this.guildId);
      const member = await guild.members.fetch(discordId);
      return member.roles.cache.has(this.subscribedRoleId);
    } catch (err) {
      logger.error({ err, discordId }, 'Failed to check subscribed role');
      return false;
    }
  }

  /**
   * Sync roles for a single user based on subscription status
   */
  async syncUserRole(discordId, isSubscribed) {
    if (isSubscribed) {
      return await this.addSubscribedRole(discordId);
    } else {
      return await this.removeSubscribedRole(discordId);
    }
  }

  /**
   * Get all members with subscribed role
   */
  async getAllSubscribedMembers() {
    try {
      const guild = await this.client.guilds.fetch(this.guildId);
      const role = await guild.roles.fetch(this.subscribedRoleId);

      if (!role) {
        logger.error({ roleId: this.subscribedRoleId }, 'Subscribed role not found');
        return [];
      }

      return Array.from(role.members.keys());
    } catch (err) {
      logger.error({ err }, 'Failed to get subscribed members');
      return [];
    }
  }
}
