import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { config } from '../config.js';
import logger from '../logger.js';

/**
 * Parse a Discord message URL to extract channel and message IDs
 * URL format: https://discord.com/channels/{guildId}/{channelId}/{messageId}
 */
function parseMessageUrl(url) {
  const urlRegex = /discord\.com\/channels\/(\d+)\/(\d+)\/(\d+)/;
  const urlMatch = url.match(urlRegex);

  if (urlMatch) {
    return {
      guildId: urlMatch[1],
      channelId: urlMatch[2],
      messageId: urlMatch[3],
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
      .setDescription('Discord message URL (right-click message → Copy Message Link)')
      .setRequired(true))
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

    // Parse the message URL
    const parsed = parseMessageUrl(messageUrl);

    if (!parsed) {
      await interaction.editReply({
        content: 'Invalid message URL. Please right-click the message and select "Copy Message Link".',
      });
      return;
    }

    // Fetch the channel
    let channel;
    try {
      channel = await interaction.client.channels.fetch(parsed.channelId);
    } catch (err) {
      logger.error({ err, channelId: parsed.channelId }, 'Failed to fetch channel for delete');
      await interaction.editReply({
        content: 'Could not find the channel. Make sure the bot has access to it.',
      });
      return;
    }

    // Fetch the message
    let message;
    try {
      message = await channel.messages.fetch(parsed.messageId);
    } catch (err) {
      logger.error({ err, channelId: parsed.channelId, messageId: parsed.messageId }, 'Failed to fetch message for delete');
      await interaction.editReply({
        content: 'Could not find the message. Make sure the message URL is correct and the message still exists.',
      });
      return;
    }

    // Verify the bot can delete this message (either bot is author, or it's a webhook owned by the bot)
    let canDelete = message.author.id === interaction.client.user.id;

    if (!canDelete && message.webhookId) {
      // Check if webhook is owned by our bot
      // For threads, webhook is on parent channel
      try {
        let webhookChannel = channel;
        if (channel.isThread()) {
          webhookChannel = await interaction.client.channels.fetch(channel.parentId);
        }
        const webhooks = await webhookChannel.fetchWebhooks();
        const webhook = webhooks.find(wh => wh.id === message.webhookId);
        canDelete = webhook?.owner?.id === interaction.client.user.id;
      } catch {
        // Can't fetch webhooks, assume we can't delete
      }
    }

    if (!canDelete) {
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
