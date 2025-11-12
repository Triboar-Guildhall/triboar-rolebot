import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { config } from '../config.js';
import logger from '../logger.js';
import axios from 'axios';

export const data = new SlashCommandBuilder()
  .setName('gift-subscription')
  .setDescription('Grant a gift subscription to a user (staff only)')
  .addUserOption(option =>
    option
      .setName('user')
      .setDescription('The user to receive the gift subscription')
      .setRequired(true))
  .addStringOption(option =>
    option
      .setName('duration')
      .setDescription('How long the gift subscription should last')
      .setRequired(true)
      .addChoices(
        { name: '1 Month', value: '1_month' },
        { name: '3 Months', value: '3_months' },
        { name: '6 Months', value: '6_months' },
        { name: '1 Year', value: '1_year' }
      ))
  .addStringOption(option =>
    option
      .setName('reason')
      .setDescription('Reason for the gift (optional)')
      .setRequired(false))
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles);

export async function execute(interaction) {
  try {
    // Defer reply in case this takes a moment
    await interaction.deferReply({ ephemeral: true });

    const targetUser = interaction.options.getUser('user');
    const duration = interaction.options.getString('duration');
    const reason = interaction.options.getString('reason');

    // Check if user has staff role
    const member = await interaction.guild.members.fetch(interaction.user.id);
    if (config.discord.staffRoleId && !member.roles.cache.has(config.discord.staffRoleId)) {
      await interaction.editReply({
        content: 'You do not have permission to use this command. Staff role required.',
        ephemeral: true,
      });
      return;
    }

    logger.info({
      staffUser: interaction.user.id,
      targetUser: targetUser.id,
      duration,
      reason,
    }, 'Processing gift subscription request');

    // Call backend API to grant gift subscription
    try {
      const response = await axios.post(
        `${config.backend.apiUrl}/api/admin/subscriptions/gift`,
        {
          discordId: targetUser.id,
          duration,
          reason: reason || `Gifted by ${interaction.user.tag}`,
        },
        {
          headers: {
            'Authorization': `Bearer ${config.backend.apiToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const durationNames = {
        '1_month': '1 month',
        '3_months': '3 months',
        '6_months': '6 months',
        '1_year': '1 year',
      };

      await interaction.editReply({
        content: `✅ **Gift subscription granted!**\n\n` +
          `**User:** ${targetUser.tag}\n` +
          `**Duration:** ${durationNames[duration]}\n` +
          `**Expires:** <t:${Math.floor(new Date(response.data.user.expiresAt).getTime() / 1000)}:F>\n` +
          `**Reason:** ${reason || 'Gift subscription'}\n\n` +
          `The user has been granted the @Subscribed role and will receive a welcome DM.`,
        ephemeral: true,
      });

      logger.info({
        staffUser: interaction.user.id,
        targetUser: targetUser.id,
        duration,
        expiresAt: response.data.user.expiresAt,
      }, 'Gift subscription granted successfully');

    } catch (apiError) {
      logger.error({
        err: apiError,
        targetUser: targetUser.id,
        duration,
      }, 'Backend API error when granting gift subscription');

      let errorMessage = 'Failed to grant gift subscription. ';

      if (apiError.response?.status === 400) {
        errorMessage += apiError.response.data.error || 'Invalid request.';
      } else if (apiError.response?.status === 401) {
        errorMessage += 'Authentication failed. Check BACKEND_API_TOKEN configuration.';
      } else if (apiError.code === 'ECONNREFUSED') {
        errorMessage += 'Could not connect to backend API. Is it running?';
      } else {
        errorMessage += 'An unexpected error occurred. Check the logs.';
      }

      await interaction.editReply({
        content: `❌ ${errorMessage}`,
        ephemeral: true,
      });
    }

  } catch (err) {
    logger.error({ err, interaction: interaction.commandName }, 'Error executing gift-subscription command');

    const errorMessage = 'An error occurred while granting the gift subscription. Please check the logs.';

    if (interaction.deferred) {
      await interaction.editReply({ content: errorMessage, ephemeral: true });
    } else {
      await interaction.reply({ content: errorMessage, ephemeral: true });
    }
  }
}
