import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  ChannelType,
} from 'discord.js';
import { config } from '../config.js';
import logger from '../logger.js';

/**
 * Parse a Discord channel URL or ID to extract the channel ID
 */
function parseChannelUrl(url) {
  // Try to parse as URL first
  const urlRegex = /discord\.com\/channels\/(\d+)\/(\d+)/;
  const urlMatch = url.match(urlRegex);

  if (urlMatch) {
    return urlMatch[2];
  }

  // If not a URL, treat as channel ID directly
  if (/^\d+$/.test(url)) {
    return url;
  }

  return null;
}

export const data = new SlashCommandBuilder()
  .setName('message-post')
  .setDescription('Create a new forum post via the bot (staff only)')
  .addStringOption(option =>
    option
      .setName('forum_url')
      .setDescription('Forum channel URL or ID')
      .setRequired(true))
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

    const forumUrl = interaction.options.getString('forum_url');

    // Parse the channel URL/ID
    const channelId = parseChannelUrl(forumUrl);

    if (!channelId) {
      await interaction.reply({
        content: 'Invalid forum URL or ID. Please provide a Discord forum channel URL or ID.',
        ephemeral: true,
      });
      return;
    }

    // Verify the channel exists and is a forum
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

    // Check if it's a forum channel
    if (channel.type !== ChannelType.GuildForum) {
      await interaction.reply({
        content: 'This channel is not a forum. Use `/message-send` for regular channels or threads.',
        ephemeral: true,
      });
      return;
    }

    // Create modal for post title and content
    const modal = new ModalBuilder()
      .setCustomId(`message_post_${channelId}`)
      .setTitle('Create Forum Post');

    const titleInput = new TextInputBuilder()
      .setCustomId('title')
      .setLabel('Post Title')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('Enter the post title')
      .setMaxLength(100)
      .setRequired(true);

    const contentInput = new TextInputBuilder()
      .setCustomId('content')
      .setLabel('Post Content')
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder('Enter the first message content (markdown supported)')
      .setMaxLength(2000)
      .setRequired(true);

    const titleRow = new ActionRowBuilder().addComponents(titleInput);
    const contentRow = new ActionRowBuilder().addComponents(contentInput);
    modal.addComponents(titleRow, contentRow);

    await interaction.showModal(modal);

    logger.info({
      userId: interaction.user.id,
      forumId: channelId,
    }, 'Showed create post modal for forum');

  } catch (err) {
    logger.error({ err, interaction: interaction.commandName }, 'Error executing message-post command');

    const errorMessage = 'An error occurred while preparing to create the post. Please check the logs.';

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content: errorMessage, ephemeral: true });
    } else {
      await interaction.reply({ content: errorMessage, ephemeral: true });
    }
  }
}
