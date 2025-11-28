import { config } from '../config.js';
import logger from '../logger.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const STORAGE_FILE = path.join(__dirname, '../../data/reaction-roles.json');

export class ReactionRoleService {
  constructor(client) {
    this.client = client;
    this.reactionRoles = new Map(); // messageId -> { emoji: roleId }
    this.loadReactionRoles();
  }

  /**
   * Load reaction roles from storage
   */
  async loadReactionRoles() {
    try {
      await fs.mkdir(path.dirname(STORAGE_FILE), { recursive: true });

      try {
        const data = await fs.readFile(STORAGE_FILE, 'utf8');
        const stored = JSON.parse(data);
        this.reactionRoles = new Map(Object.entries(stored));
        logger.info({ count: this.reactionRoles.size }, 'Loaded reaction roles from storage');
      } catch (err) {
        if (err.code !== 'ENOENT') throw err;
        logger.info('No existing reaction roles file, starting fresh');
      }
    } catch (err) {
      logger.error({ err }, 'Failed to load reaction roles');
    }
  }

  /**
   * Save reaction roles to storage
   */
  async saveReactionRoles() {
    try {
      const data = Object.fromEntries(this.reactionRoles);
      await fs.writeFile(STORAGE_FILE, JSON.stringify(data, null, 2));
      logger.info('Saved reaction roles to storage');
    } catch (err) {
      logger.error({ err }, 'Failed to save reaction roles');
    }
  }

  /**
   * Set up gender roles reaction message
   */
  async setupGenderRoles(channel, genderRoles) {
    const embed = {
      color: 0xB8860B, // guild-gold
      title: '⚧️ Gender Roles',
      description: 'React with an emoji below to get the corresponding gender role.\n\nYou can select multiple roles, and unreact to remove a role.',
      fields: genderRoles.map(({ emoji, name }) => ({
        name: `${emoji} ${name}`,
        value: '\u200b', // zero-width space
        inline: true,
      })),
      footer: {
        text: 'Click on a reaction to add/remove the role',
      },
    };

    const message = await channel.send({ embeds: [embed] });

    // Add all reactions
    for (const { emoji } of genderRoles) {
      await message.react(emoji);
    }

    // Store the mapping
    const mapping = {};
    for (const { emoji, roleId } of genderRoles) {
      mapping[emoji] = roleId;
    }
    this.reactionRoles.set(message.id, mapping);
    await this.saveReactionRoles();

    logger.info({ messageId: message.id, channelId: channel.id }, 'Set up gender roles reaction message');
    return message;
  }

  /**
   * Set up PM preference roles reaction message
   */
  async setupPMRoles(channel, pmRoles) {
    const embed = {
      color: 0xB8860B, // guild-gold
      title: '💬 PM/DM Preferences',
      description: 'React with an emoji below to set your PM/DM preference.\n\n**You can only have ONE of these roles at a time.**',
      fields: pmRoles.map(({ emoji, name, description }) => ({
        name: `${emoji} ${name}`,
        value: description,
        inline: false,
      })),
      footer: {
        text: 'Click on a reaction to set your preference',
      },
    };

    const message = await channel.send({ embeds: [embed] });

    // Add all reactions
    for (const { emoji } of pmRoles) {
      await message.react(emoji);
    }

    // Store the mapping with a flag indicating this is mutually exclusive
    const mapping = {
      __mutuallyExclusive: true,
      __allRoles: pmRoles.map(r => r.roleId),
    };
    for (const { emoji, roleId } of pmRoles) {
      mapping[emoji] = roleId;
    }
    this.reactionRoles.set(message.id, mapping);
    await this.saveReactionRoles();

    logger.info({ messageId: message.id, channelId: channel.id }, 'Set up PM roles reaction message');
    return message;
  }

  /**
   * Handle reaction add
   */
  async handleReactionAdd(reaction, user) {
    try {
      // Ignore bot reactions
      if (user.bot) return;

      // Fetch the message and user if they're partial
      if (reaction.partial) {
        await reaction.fetch();
      }

      const messageId = reaction.message.id;
      const mapping = this.reactionRoles.get(messageId);

      if (!mapping) return; // Not a reaction role message

      const emoji = reaction.emoji.name;
      const roleId = mapping[emoji];

      if (!roleId) return; // Not a configured emoji

      // Get the member
      const guild = this.client.guilds.cache.get(config.discord.guildId);
      const member = await guild.members.fetch(user.id);

      // If this is a mutually exclusive set, remove other roles first
      if (mapping.__mutuallyExclusive) {
        const otherRoles = mapping.__allRoles.filter(id => id !== roleId);
        for (const otherRoleId of otherRoles) {
          if (member.roles.cache.has(otherRoleId)) {
            await member.roles.remove(otherRoleId);
            logger.info({ userId: user.id, roleId: otherRoleId, messageId }, 'Removed mutually exclusive role');
          }
        }
      }

      // Add the role
      await member.roles.add(roleId);
      logger.info({ userId: user.id, roleId, emoji, messageId }, 'Added role via reaction');

    } catch (err) {
      logger.error({ err, userId: user.id, messageId: reaction.message.id }, 'Failed to handle reaction add');
    }
  }

  /**
   * Handle reaction remove
   */
  async handleReactionRemove(reaction, user) {
    try {
      // Ignore bot reactions
      if (user.bot) return;

      // Fetch the message and user if they're partial
      if (reaction.partial) {
        await reaction.fetch();
      }

      const messageId = reaction.message.id;
      const mapping = this.reactionRoles.get(messageId);

      if (!mapping) return; // Not a reaction role message

      const emoji = reaction.emoji.name;
      const roleId = mapping[emoji];

      if (!roleId) return; // Not a configured emoji

      // Get the member
      const guild = this.client.guilds.cache.get(config.discord.guildId);
      const member = await guild.members.fetch(user.id);

      // Remove the role
      await member.roles.remove(roleId);
      logger.info({ userId: user.id, roleId, emoji, messageId }, 'Removed role via reaction');

    } catch (err) {
      logger.error({ err, userId: user.id, messageId: reaction.message.id }, 'Failed to handle reaction remove');
    }
  }

  /**
   * Remove a reaction role message from tracking
   */
  async removeReactionRole(messageId) {
    this.reactionRoles.delete(messageId);
    await this.saveReactionRoles();
    logger.info({ messageId }, 'Removed reaction role message from tracking');
  }
}
