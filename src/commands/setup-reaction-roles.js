import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { config } from '../config.js';
import logger from '../logger.js';

export const data = new SlashCommandBuilder()
  .setName('setup-reaction-roles')
  .setDescription('Set up reaction role messages (staff only)')
  .addStringOption(option =>
    option
      .setName('type')
      .setDescription('Which reaction role message to set up')
      .setRequired(true)
      .addChoices(
        { name: 'Gender Roles', value: 'gender' },
        { name: 'PM/DM Preferences', value: 'pm' },
        { name: 'Both (Gender + PM)', value: 'both' }
      ))
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles);

export async function execute(interaction) {
  try {
    // Defer reply in case this takes a moment
    await interaction.deferReply({ ephemeral: true });

    const type = interaction.options.getString('type');

    // Check if user has staff role
    const member = await interaction.guild.members.fetch(interaction.user.id);
    if (config.discord.staffRoleId && !member.roles.cache.has(config.discord.staffRoleId)) {
      await interaction.editReply({
        content: 'You do not have permission to use this command. Staff role required.',
        ephemeral: true,
      });
      return;
    }

    // Get reaction role service from bot client
    const reactionRoleService = interaction.client.reactionRoleService;
    if (!reactionRoleService) {
      await interaction.editReply({
        content: '❌ Reaction role service not initialized. Please contact a developer.',
        ephemeral: true,
      });
      return;
    }

    const channel = interaction.channel;
    const messages = [];

    // Define gender roles (you'll need to add these role IDs to your .env)
    const genderRoles = [
      { emoji: '♂️', name: 'He/Him', roleId: process.env.DISCORD_GENDER_HE_HIM_ROLE_ID },
      { emoji: '♀️', name: 'She/Her', roleId: process.env.DISCORD_GENDER_SHE_HER_ROLE_ID },
      { emoji: '⚧️', name: 'They/Them', roleId: process.env.DISCORD_GENDER_THEY_THEM_ROLE_ID },
      { emoji: '❓', name: 'Ask My Pronouns', roleId: process.env.DISCORD_GENDER_ASK_ROLE_ID },
    ].filter(role => role.roleId); // Filter out any undefined roles

    // Define PM preference roles
    const pmRoles = [
      {
        emoji: '✅',
        name: 'OK to PM',
        description: 'Feel free to send me a direct message anytime!',
        roleId: process.env.DISCORD_PM_OK_ROLE_ID
      },
      {
        emoji: '❔',
        name: 'Ask to PM',
        description: 'Please ask before sending me a DM.',
        roleId: process.env.DISCORD_PM_ASK_ROLE_ID
      },
      {
        emoji: '🚫',
        name: 'No PMs',
        description: 'Please don\'t send me direct messages.',
        roleId: process.env.DISCORD_PM_NO_ROLE_ID
      },
    ].filter(role => role.roleId); // Filter out any undefined roles

    // Set up the requested type(s)
    if (type === 'gender' || type === 'both') {
      if (genderRoles.length === 0) {
        await interaction.editReply({
          content: '❌ No gender roles configured. Please set up DISCORD_GENDER_*_ROLE_ID environment variables.',
          ephemeral: true,
        });
        return;
      }

      const message = await reactionRoleService.setupGenderRoles(channel, genderRoles);
      messages.push(`Gender roles message: ${message.url}`);
      logger.info({ messageId: message.id, channelId: channel.id }, 'Set up gender roles via slash command');
    }

    if (type === 'pm' || type === 'both') {
      if (pmRoles.length === 0) {
        await interaction.editReply({
          content: '❌ No PM preference roles configured. Please set up DISCORD_PM_*_ROLE_ID environment variables.',
          ephemeral: true,
        });
        return;
      }

      const message = await reactionRoleService.setupPMRoles(channel, pmRoles);
      messages.push(`PM preferences message: ${message.url}`);
      logger.info({ messageId: message.id, channelId: channel.id }, 'Set up PM roles via slash command');
    }

    await interaction.editReply({
      content: `✅ **Reaction roles set up successfully!**\n\n${messages.join('\n')}\n\nUsers can now react to these messages to self-assign roles.`,
      ephemeral: true,
    });

    logger.info({
      staffUser: interaction.user.id,
      type,
      channelId: channel.id,
    }, 'Reaction roles set up successfully');

  } catch (err) {
    logger.error({ err, interaction: interaction.commandName }, 'Error executing setup-reaction-roles command');

    const errorMessage = 'An error occurred while setting up reaction roles. Please check the logs.';

    if (interaction.deferred) {
      await interaction.editReply({ content: errorMessage, ephemeral: true });
    } else {
      await interaction.reply({ content: errorMessage, ephemeral: true });
    }
  }
}
