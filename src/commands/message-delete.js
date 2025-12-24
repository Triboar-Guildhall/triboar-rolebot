import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { config } from '../config.js';
import logger from '../logger.js';

/**
 * Parse a Discord message URL or ID to extract channel and message IDs
 * URL format: https://discord.com/channels/{guildId}/{channelId}/{messageId}
 */
function parseMessageUrl(url, providedChannelId = null) {
  // Try to parse as URL first
  const urlRegex = /discord\.com\/channels\/(\d+)\/(\d+)\/(\d+)/;
  const urlMatch = url.match(urlRegex);

  if (urlMatch) {
    return {
      guildId: urlMatch[1],
      channelId: urlMatch[2],
      messageId: urlMatch[3],
    };
  }

  // If not a URL, treat as message ID (requires channel to be provided)
  if (/^\d+$/.test(url) && providedChannelId) {
    return {
      guildId: null,
      channelId: providedChannelId,
      messageId: url,
    };
  }

  return null;
}

export const data = new SlashCommandBuilder()
  .setName('message-delete')
  .setDescription('Delete a bot message (staff only)')
  .addStringOption(option =>
    option
      .setName('message_url')
      .setDescription('Discord message URL or message ID')
      .setRequired(true))
  .addChannelOption(option =>
    option
      .setName('channel')
      .setDescription('Channel where the message is (required if using message ID instead of URL)')
      .setRequired(false))
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles);

export async function execute(interaction) {
  try {
    await interaction.deferReply({ ephemeral: true });

    const guild = interaction.guild;

    // Check if user has staff role
    const member = await guild.members.fetch(interaction.user.id);
    if (config.discord.staffRoleId && !member.roles.cache.has(config.discord.staffRoleId)) {
      await interaction.editReply({
        content: 'You do not have permission to use this command. Staff role required.',
      });
      return;
    }

    const messageUrl = interaction.options.getString('message_url');
    const providedChannel = interaction.options.getChannel('channel');

    // Parse the message URL/ID
    const parsed = parseMessageUrl(messageUrl, providedChannel?.id);

    if (!parsed) {
      await interaction.editReply({
        content: 'Invalid message URL or ID. Please provide a Discord message URL or a message ID with a channel.',
      });
      return;
    }

    // Fetch the channel
    let channel;
    try {
      channel = await interaction.client.channels.fetch(parsed.channelId);
    } catch {
      await interaction.editReply({
        content: 'Could not find the channel. Make sure the bot has access to it.',
      });
      return;
    }

    // Fetch the message
    let message;
    try {
      message = await channel.messages.fetch(parsed.messageId);
    } catch {
      await interaction.editReply({
        content: 'Could not find the message. Make sure the message ID/URL is correct.',
      });
      return;
    }

    // Verify the bot is the author
    if (message.author.id !== interaction.client.user.id) {
      await interaction.editReply({
        content: 'Cannot delete this message - the bot is not the author. You can only delete messages sent via `/message-send`.',
      });
      return;
    }

    // Delete the message
    await message.delete();

    logger.info({
      userId: interaction.user.id,
      channelId: parsed.channelId,
      messageId: parsed.messageId,
    }, 'Deleted managed message');

    await interaction.editReply({
      content: `Message deleted successfully from <#${channel.id}>.`,
    });

  } catch (err) {
    logger.error({ err, interaction: interaction.commandName }, 'Error executing message-delete command');

    const errorMessage = 'An error occurred while deleting the message. Please check the logs.';

    if (interaction.deferred) {
      await interaction.editReply({ content: errorMessage });
    } else {
      await interaction.reply({ content: errorMessage, ephemeral: true });
    }
  }
}
