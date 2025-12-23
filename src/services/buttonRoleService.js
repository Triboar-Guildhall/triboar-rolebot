import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { config } from '../config.js';
import logger from '../logger.js';

export class ButtonRoleService {
  constructor(client) {
    this.client = client;
  }

  /**
   * Set up gender/pronoun roles button message
   */
  async setupGenderRoles(channel, genderRoles) {
    const embed = {
      color: 0xB8860B, // guild-gold
      title: "Player's Pronouns",
      description:
        "At Triboar Guildhall, we value respect and inclusivity. Please select your preferred pronouns below so others know how to address you. You can select multiple options, and you can change your selection at any time by clicking the buttons again.",
    };

    // Create buttons in rows (Discord allows max 5 buttons per row)
    const rows = [];
    const buttons = [];

    for (const { label, roleId, style, emoji } of genderRoles) {
      const button = new ButtonBuilder()
        .setCustomId(`gender_role_${roleId}`)
        .setLabel(label)
        .setStyle(style || ButtonStyle.Primary);

      if (emoji) {
        button.setEmoji(emoji);
      }

      buttons.push(button);
    }

    // Split buttons into rows of 5
    for (let i = 0; i < buttons.length; i += 5) {
      const row = new ActionRowBuilder()
        .addComponents(buttons.slice(i, i + 5));
      rows.push(row);
    }

    const message = await channel.send({
      embeds: [embed],
      components: rows
    });

    logger.info({ messageId: message.id, channelId: channel.id }, 'Set up gender roles button message');
    return message;
  }

  /**
   * Set up PM preference roles button message
   */
  async setupPMRoles(channel, pmRoles) {
    const embed = {
      color: 0xB041FF,
      title: '💬 PM/DM Preferences',
      description: 'Click a button below to set your PM/DM preference.\n\n**You can only have ONE of these roles at a time.**\n\n' +
        '✅ **OK to PM** - Feel free to send me a direct message anytime!\n' +
        '❔ **Ask to PM** - Please ask before sending me a DM.\n' +
        '🚫 **No PMs** - Please don\'t send me direct messages.',
    };

    const buttons = pmRoles.map(({ label, roleId, style, emoji }) => {
      const button = new ButtonBuilder()
        .setCustomId(`pm_role_${roleId}`)
        .setLabel(label)
        .setStyle(style || ButtonStyle.Primary);

      if (emoji) {
        button.setEmoji(emoji);
      }

      return button;
    });

    const row = new ActionRowBuilder().addComponents(buttons);

    const message = await channel.send({
      embeds: [embed],
      components: [row]
    });

    logger.info({ messageId: message.id, channelId: channel.id }, 'Set up PM roles button message');
    return message;
  }

  /**
   * Handle button interaction for gender roles
   */
  async handleGenderRoleButton(interaction, roleId) {
    try {
      await interaction.deferReply({ ephemeral: true });

      const member = interaction.member;
      const hasRole = member.roles.cache.has(roleId);

      if (hasRole) {
        // Remove the role
        await member.roles.remove(roleId);
        await interaction.editReply({
          content: `✅ Removed the role!`,
          ephemeral: true
        });
        logger.info({ userId: interaction.user.id, roleId }, 'Removed gender role via button');
      } else {
        // Add the role
        await member.roles.add(roleId);
        await interaction.editReply({
          content: `✅ Added the role!`,
          ephemeral: true
        });
        logger.info({ userId: interaction.user.id, roleId }, 'Added gender role via button');
      }

    } catch (err) {
      logger.error({ err, userId: interaction.user.id, roleId }, 'Failed to handle gender role button');

      const errorMessage = 'Failed to update your role. Please contact a staff member.';
      if (interaction.deferred) {
        await interaction.editReply({ content: errorMessage, ephemeral: true });
      } else {
        await interaction.reply({ content: errorMessage, ephemeral: true });
      }
    }
  }

  /**
   * Set up interest/notification roles button message
   */
  async setupInterestRoles(channel, interestRoles) {
    const embed = {
      color: 0x2ECC71, // Green
      title: '🔔 Notification Preferences',
      description: 'Click the buttons below to opt-in to notifications for activities you\'re interested in. Click again to remove the role.\n\n' +
        '🏕️ **Survivalist** - Get pinged for survival game events and updates.\n' +
        '🛠️ **Crafter** - Get pinged when players are looking for crafting services.\n' +
        '⚔️ **Quest Seeker** - Get pinged when there\'s a quest available for your level.',
    };

    const buttons = interestRoles.map(({ label, roleId, style, emoji }) => {
      const button = new ButtonBuilder()
        .setCustomId(`interest_role_${roleId}`)
        .setLabel(label)
        .setStyle(style || ButtonStyle.Primary);

      if (emoji) {
        button.setEmoji(emoji);
      }

      return button;
    });

    const row = new ActionRowBuilder().addComponents(buttons);

    const message = await channel.send({
      embeds: [embed],
      components: [row]
    });

    logger.info({ messageId: message.id, channelId: channel.id }, 'Set up interest roles button message');
    return message;
  }

  /**
   * Set up geographic region roles button message
   */
  async setupRegionRoles(channel, regionRoles) {
    const embed = {
      color: 0x3498DB, // Blue
      title: '🌍 Geographic Region',
      description: 'Select your geographic region to help coordinate with players in similar time zones. Click again to remove the role.\n\n' +
        '🌍 **Africa**\n' +
        '🌏 **Asia**\n' +
        '🌍 **Europe**\n' +
        '🌎 **North America**\n' +
        '🌏 **Oceania**\n' +
        '🌎 **South America**',
    };

    const buttons = regionRoles.map(({ label, roleId, style, emoji }) => {
      const button = new ButtonBuilder()
        .setCustomId(`region_role_${roleId}`)
        .setLabel(label)
        .setStyle(style || ButtonStyle.Primary);

      if (emoji) {
        button.setEmoji(emoji);
      }

      return button;
    });

    // Split buttons into rows of 3 for better layout
    const rows = [];
    for (let i = 0; i < buttons.length; i += 3) {
      const row = new ActionRowBuilder().addComponents(buttons.slice(i, i + 3));
      rows.push(row);
    }

    const message = await channel.send({
      embeds: [embed],
      components: rows
    });

    logger.info({ messageId: message.id, channelId: channel.id }, 'Set up region roles button message');
    return message;
  }

  /**
   * Handle button interaction for region roles (toggle)
   */
  async handleRegionRoleButton(interaction, roleId) {
    try {
      await interaction.deferReply({ ephemeral: true });

      const member = interaction.member;
      const hasRole = member.roles.cache.has(roleId);

      if (hasRole) {
        await member.roles.remove(roleId);
        await interaction.editReply({
          content: `✅ Removed your region role.`,
          ephemeral: true
        });
        logger.info({ userId: interaction.user.id, roleId }, 'Removed region role via button');
      } else {
        await member.roles.add(roleId);
        await interaction.editReply({
          content: `✅ Added your region role!`,
          ephemeral: true
        });
        logger.info({ userId: interaction.user.id, roleId }, 'Added region role via button');
      }

    } catch (err) {
      logger.error({ err, userId: interaction.user.id, roleId }, 'Failed to handle region role button');

      const errorMessage = 'Failed to update your region. Please contact a staff member.';
      if (interaction.deferred) {
        await interaction.editReply({ content: errorMessage, ephemeral: true });
      } else {
        await interaction.reply({ content: errorMessage, ephemeral: true });
      }
    }
  }

  /**
   * Handle button interaction for interest roles (toggle)
   */
  async handleInterestRoleButton(interaction, roleId) {
    try {
      await interaction.deferReply({ ephemeral: true });

      const member = interaction.member;
      const hasRole = member.roles.cache.has(roleId);

      if (hasRole) {
        // Remove the role
        await member.roles.remove(roleId);
        await interaction.editReply({
          content: `✅ Removed the notification role! You will no longer receive these pings.`,
          ephemeral: true
        });
        logger.info({ userId: interaction.user.id, roleId }, 'Removed interest role via button');
      } else {
        // Add the role
        await member.roles.add(roleId);
        await interaction.editReply({
          content: `✅ Added the notification role! You will now receive pings for this activity.`,
          ephemeral: true
        });
        logger.info({ userId: interaction.user.id, roleId }, 'Added interest role via button');
      }

    } catch (err) {
      logger.error({ err, userId: interaction.user.id, roleId }, 'Failed to handle interest role button');

      const errorMessage = 'Failed to update your notification preference. Please contact a staff member.';
      if (interaction.deferred) {
        await interaction.editReply({ content: errorMessage, ephemeral: true });
      } else {
        await interaction.reply({ content: errorMessage, ephemeral: true });
      }
    }
  }

  /**
   * Handle button interaction for PM roles (mutually exclusive)
   */
  async handlePMRoleButton(interaction, roleId, allPMRoles) {
    try {
      await interaction.deferReply({ ephemeral: true });

      const member = interaction.member;
      const hasRole = member.roles.cache.has(roleId);

      // Remove all PM roles first
      for (const pmRoleId of allPMRoles) {
        if (member.roles.cache.has(pmRoleId)) {
          await member.roles.remove(pmRoleId);
        }
      }

      if (!hasRole) {
        // Add the selected role (if they didn't already have it)
        await member.roles.add(roleId);
        await interaction.editReply({
          content: `✅ Updated your PM preference!`,
          ephemeral: true
        });
        logger.info({ userId: interaction.user.id, roleId }, 'Set PM preference via button');
      } else {
        await interaction.editReply({
          content: `✅ Removed your PM preference!`,
          ephemeral: true
        });
        logger.info({ userId: interaction.user.id, roleId }, 'Removed PM preference via button');
      }

    } catch (err) {
      logger.error({ err, userId: interaction.user.id, roleId }, 'Failed to handle PM role button');

      const errorMessage = 'Failed to update your PM preference. Please contact a staff member.';
      if (interaction.deferred) {
        await interaction.editReply({ content: errorMessage, ephemeral: true });
      } else {
        await interaction.reply({ content: errorMessage, ephemeral: true });
      }
    }
  }
}
