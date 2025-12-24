import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
} from 'discord.js';
import { config } from '../config.js';
import logger from '../logger.js';

/**
 * Parse a Discord channel URL or ID to extract the channel/thread ID
 * URL formats:
 *   - https://discord.com/channels/{guildId}/{channelId}
 *   - https://discord.com/channels/{guildId}/{channelId}/{messageId} (use channelId)
 */
function parseChannelUrl(url) {
  // Try to parse as URL first
  const urlRegex = /discord\.com\/channels\/(\d+)\/(\d+)/;
  const urlMatch = url.match(urlRegex);

  if (urlMatch) {
    return urlMatch[2]; // Return channelId (works for threads too)
  }

  // If not a URL, treat as channel ID directly
  if (/^\d+$/.test(url)) {
    return url;
  }

  return null;
}

export const data = new SlashCommandBuilder()
  .setName('message-send')
  .setDescription('Send a message to a channel or forum thread via the bot (staff only)')
  .addStringOption(option =>
    option
      .setName('channel_url')
      .setDescription('Channel/thread URL or ID (defaults to current channel)')
      .setRequired(false))
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles);

export async function execute(interaction) {
  try {
    const guild = interaction.guild;

    // Check if user has staff role
    const member = await guild.members.fetch(interaction.user.id);
    if (config.discord.staffRoleId && !member.roles.cache.has(config.discord.staffRoleId)) {
      await interaction.reply({
        content: 'You do not have permission to use this command. Staff role required.',
        ephemeral: true,
      });
      return;
    }

    const channelUrl = interaction.options.getString('channel_url');

    // Use current channel if no URL provided, otherwise parse the URL/ID
    let channelId;
    if (!channelUrl) {
      channelId = interaction.channelId;
    } else {
      channelId = parseChannelUrl(channelUrl);
      if (!channelId) {
        await interaction.reply({
          content: 'Invalid channel URL or ID. Please provide a Discord channel URL or channel/thread ID.',
          ephemeral: true,
        });
        return;
      }
    }

    // Verify the channel exists and is accessible
    let channel;
    try {
      channel = await interaction.client.channels.fetch(channelId);
    } catch {
      await interaction.reply({
        content: 'Could not find the channel. Make sure the bot has access to it.',
        ephemeral: true,
      });
      return;
    }

    // Check if the channel is text-based
    if (!channel.isTextBased()) {
      await interaction.reply({
        content: 'Cannot send messages to this type of channel.',
        ephemeral: true,
      });
      return;
    }

    // Create modal for message content
    const modal = new ModalBuilder()
      .setCustomId(`message_send_${channelId}`)
      .setTitle('Send Message');

    const contentInput = new TextInputBuilder()
      .setCustomId('content')
      .setLabel('Message Content')
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder('Enter your message here (markdown supported)')
      .setMaxLength(2000)
      .setRequired(true);

    const actionRow = new ActionRowBuilder().addComponents(contentInput);
    modal.addComponents(actionRow);

    await interaction.showModal(modal);

    logger.info({
      userId: interaction.user.id,
      channelId,
    }, 'Showed send modal for channel');

  } catch (err) {
    logger.error({ err, interaction: interaction.commandName }, 'Error executing message-send command');

    const errorMessage = 'An error occurred while preparing to send. Please check the logs.';

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content: errorMessage, ephemeral: true });
    } else {
      await interaction.reply({ content: errorMessage, ephemeral: true });
    }
  }
}
