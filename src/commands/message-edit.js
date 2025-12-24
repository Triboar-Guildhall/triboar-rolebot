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
  .setName('message-edit')
  .setDescription('Edit a bot message using a modal with pre-filled content (staff only)')
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

    const messageUrl = interaction.options.getString('message_url');
    const providedChannel = interaction.options.getChannel('channel');

    // Parse the message URL/ID
    const parsed = parseMessageUrl(messageUrl, providedChannel?.id);

    if (!parsed) {
      await interaction.reply({
        content: 'Invalid message URL or ID. Please provide a Discord message URL or a message ID with a channel.',
        ephemeral: true,
      });
      return;
    }

    // Fetch the channel
    let channel;
    try {
      channel = await interaction.client.channels.fetch(parsed.channelId);
    } catch {
      await interaction.reply({
        content: 'Could not find the channel. Make sure the bot has access to it.',
        ephemeral: true,
      });
      return;
    }

    // Fetch the message
    let message;
    try {
      message = await channel.messages.fetch(parsed.messageId);
    } catch {
      await interaction.reply({
        content: 'Could not find the message. Make sure the message ID/URL is correct.',
        ephemeral: true,
      });
      return;
    }

    // Verify the bot can edit this message (either bot is author, or it's a webhook owned by the bot)
    let canEdit = message.author.id === interaction.client.user.id;

    if (!canEdit && message.webhookId) {
      // Check if webhook is owned by our bot
      // For threads, webhook is on parent channel
      try {
        let webhookChannel = channel;
        if (channel.isThread()) {
          webhookChannel = await interaction.client.channels.fetch(channel.parentId);
        }
        const webhooks = await webhookChannel.fetchWebhooks();
        const webhook = webhooks.find(wh => wh.id === message.webhookId);
        canEdit = webhook?.owner?.id === interaction.client.user.id;
      } catch {
        // Can't fetch webhooks, assume we can't edit
      }
    }

    if (!canEdit) {
      await interaction.reply({
        content: 'Cannot edit this message - the bot is not the author. You can only edit messages sent via `/message-send`.',
        ephemeral: true,
      });
      return;
    }

    // Create modal with pre-filled content
    const modal = new ModalBuilder()
      .setCustomId(`message_edit_${parsed.channelId}_${parsed.messageId}`)
      .setTitle('Edit Message');

    const contentInput = new TextInputBuilder()
      .setCustomId('content')
      .setLabel('Message Content')
      .setStyle(TextInputStyle.Paragraph)
      .setValue(message.content || '')
      .setMaxLength(2000)
      .setRequired(true);

    const actionRow = new ActionRowBuilder().addComponents(contentInput);
    modal.addComponents(actionRow);

    await interaction.showModal(modal);

    logger.info({
      userId: interaction.user.id,
      channelId: parsed.channelId,
      messageId: parsed.messageId,
    }, 'Showed edit modal for message');

  } catch (err) {
    logger.error({ err, interaction: interaction.commandName }, 'Error executing message-edit command');

    const errorMessage = 'An error occurred while preparing the edit. Please check the logs.';

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content: errorMessage, ephemeral: true });
    } else {
      await interaction.reply({ content: errorMessage, ephemeral: true });
    }
  }
}
