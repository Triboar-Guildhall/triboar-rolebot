import { EmbedBuilder } from 'discord.js';
import { config } from '../config.js';
import logger from '../logger.js';

export class StarboardService {
  constructor(client) {
    this.client = client;
    // Map of original message ID -> starboard message ID
    this.starboardMessages = new Map();
  }

  /**
   * Handle a star reaction being added
   */
  async handleStarAdd(reaction, user) {
    // Ignore if no starboard channel configured
    if (!config.starboard.channelId) {
      return;
    }

    // Only handle star emoji
    if (reaction.emoji.name !== '⭐') {
      return;
    }

    // Fetch the full message if it's a partial
    if (reaction.partial) {
      try {
        await reaction.fetch();
      } catch (err) {
        logger.error({ err }, 'Failed to fetch partial reaction');
        return;
      }
    }

    const message = reaction.message;

    // Fetch full message if partial
    if (message.partial) {
      try {
        await message.fetch();
      } catch (err) {
        logger.error({ err }, 'Failed to fetch partial message');
        return;
      }
    }

    // Don't allow self-starring
    if (message.author.id === user.id) {
      logger.debug({ userId: user.id, messageId: message.id }, 'Ignoring self-star');
      return;
    }

    // Allow bot messages to be starred (for Tupperbox, etc.)

    // Don't star messages from the starboard channel itself
    if (message.channel.id === config.starboard.channelId) {
      return;
    }

    // Get the current star count (excluding the message author)
    const starReaction = message.reactions.cache.get('⭐');
    if (!starReaction) return;

    // Fetch all users who reacted
    const users = await starReaction.users.fetch();
    const validStarCount = users.filter(u => u.id !== message.author.id).size;

    logger.debug({ messageId: message.id, starCount: validStarCount, threshold: config.starboard.threshold }, 'Star count check');

    // Check if we've hit the threshold
    if (validStarCount >= config.starboard.threshold) {
      await this.addOrUpdateStarboardMessage(message, validStarCount);
    }
  }

  /**
   * Handle a star reaction being removed
   */
  async handleStarRemove(reaction, user) {
    // Ignore if no starboard channel configured
    if (!config.starboard.channelId) {
      return;
    }

    // Only handle star emoji
    if (reaction.emoji.name !== '⭐') {
      return;
    }

    // Fetch the full message if it's a partial
    if (reaction.partial) {
      try {
        await reaction.fetch();
      } catch (err) {
        logger.error({ err }, 'Failed to fetch partial reaction');
        return;
      }
    }

    const message = reaction.message;

    // Fetch full message if partial
    if (message.partial) {
      try {
        await message.fetch();
      } catch (err) {
        logger.error({ err }, 'Failed to fetch partial message');
        return;
      }
    }

    // Get the current star count (excluding the message author)
    const starReaction = message.reactions.cache.get('⭐');
    let validStarCount = 0;

    if (starReaction) {
      const users = await starReaction.users.fetch();
      validStarCount = users.filter(u => u.id !== message.author.id).size;
    }

    // If below threshold, remove from starboard
    if (validStarCount < config.starboard.threshold) {
      await this.removeStarboardMessage(message.id);
    } else {
      // Update the count
      await this.addOrUpdateStarboardMessage(message, validStarCount);
    }
  }

  /**
   * Add or update a message on the starboard
   */
  async addOrUpdateStarboardMessage(message, starCount) {
    try {
      const starboardChannel = await this.client.channels.fetch(config.starboard.channelId);
      if (!starboardChannel) {
        logger.warn({ channelId: config.starboard.channelId }, 'Starboard channel not found');
        return;
      }

      const embed = this.createStarboardEmbed(message, starCount);
      const content = `⭐ **${starCount}** | ${message.channel}`;

      // Check if we already have a starboard message for this
      const existingStarboardId = this.starboardMessages.get(message.id);

      if (existingStarboardId) {
        // Update existing message
        try {
          const starboardMessage = await starboardChannel.messages.fetch(existingStarboardId);
          await starboardMessage.edit({ content, embeds: [embed] });
          logger.debug({ messageId: message.id, starCount }, 'Updated starboard message');
        } catch (err) {
          // Message might have been deleted, create a new one
          logger.debug({ err }, 'Could not find existing starboard message, creating new one');
          this.starboardMessages.delete(message.id);
          await this.createNewStarboardMessage(starboardChannel, message, starCount, content, embed);
        }
      } else {
        // Create new starboard message
        await this.createNewStarboardMessage(starboardChannel, message, starCount, content, embed);
      }
    } catch (err) {
      logger.error({ err, messageId: message.id }, 'Failed to add/update starboard message');
    }
  }

  /**
   * Create a new starboard message
   */
  async createNewStarboardMessage(starboardChannel, message, starCount, content, embed) {
    const starboardMessage = await starboardChannel.send({ content, embeds: [embed] });
    this.starboardMessages.set(message.id, starboardMessage.id);
    logger.info({ messageId: message.id, starboardMessageId: starboardMessage.id, starCount }, 'Created starboard message');
  }

  /**
   * Remove a message from the starboard
   */
  async removeStarboardMessage(originalMessageId) {
    const starboardMessageId = this.starboardMessages.get(originalMessageId);
    if (!starboardMessageId) return;

    try {
      const starboardChannel = await this.client.channels.fetch(config.starboard.channelId);
      if (!starboardChannel) return;

      const starboardMessage = await starboardChannel.messages.fetch(starboardMessageId);
      await starboardMessage.delete();
      this.starboardMessages.delete(originalMessageId);
      logger.info({ originalMessageId, starboardMessageId }, 'Removed starboard message');
    } catch (err) {
      // Message might already be deleted
      this.starboardMessages.delete(originalMessageId);
      logger.debug({ err, originalMessageId }, 'Could not delete starboard message');
    }
  }

  /**
   * Create the starboard embed
   */
  createStarboardEmbed(message, starCount) {
    const embed = new EmbedBuilder()
      .setColor(0xFFAC33) // Star gold color
      .setAuthor({
        name: message.author.displayName || message.author.username,
        iconURL: message.author.displayAvatarURL({ dynamic: true }),
      })
      .setTimestamp(message.createdAt)
      .setFooter({ text: `Message ID: ${message.id}` });

    // Add message content if present
    if (message.content) {
      embed.setDescription(message.content);
    }

    // Add link to original message
    embed.addFields({
      name: 'Original',
      value: `[Jump to message](${message.url})`,
      inline: false,
    });

    return embed;
  }
}
