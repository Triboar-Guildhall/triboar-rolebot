import { SlashCommandBuilder, PermissionFlagsBits, ButtonStyle } from 'discord.js';
import { config } from '../config.js';
import logger from '../logger.js';

export const data = new SlashCommandBuilder()
  .setName('setup-button-roles')
  .setDescription('Set up button role messages (staff only)')
  .addStringOption(option =>
    option
      .setName('type')
      .setDescription('Which button role message to set up')
      .setRequired(true)
      .addChoices(
        { name: 'Gender/Pronoun Roles', value: 'gender' },
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

    // Get button role service from bot client
    const buttonRoleService = interaction.client.buttonRoleService;
    if (!buttonRoleService) {
      await interaction.editReply({
        content: '❌ Button role service not initialized. Please contact a developer.',
        ephemeral: true,
      });
      return;
    }

    const channel = interaction.channel;
    const messages = [];

    // Define gender roles with colored buttons
    const genderRoles = [
      { label: 'She/Her', roleId: process.env.DISCORD_GENDER_SHE_HER_ROLE_ID, style: ButtonStyle.Primary, emoji: '🟥' },
      { label: 'He/Him', roleId: process.env.DISCORD_GENDER_HE_HIM_ROLE_ID, style: ButtonStyle.Primary, emoji: '🟦' },
      { label: 'She/Them', roleId: process.env.DISCORD_GENDER_SHE_THEM_ROLE_ID, style: ButtonStyle.Primary, emoji: '🟩' },
      { label: 'He/Them', roleId: process.env.DISCORD_GENDER_HE_THEM_ROLE_ID, style: ButtonStyle.Primary, emoji: '🟪' },
      { label: 'They/Them', roleId: process.env.DISCORD_GENDER_THEY_THEM_ROLE_ID, style: ButtonStyle.Primary, emoji: '🟧' },
      { label: 'Other/Neopronoun', roleId: process.env.DISCORD_GENDER_ASK_ROLE_ID, style: ButtonStyle.Secondary, emoji: '⬜' },
    ].filter(role => role.roleId); // Filter out any undefined roles

    // Define PM preference roles
    const pmRoles = [
      { label: 'OK to PM', roleId: process.env.DISCORD_PM_OK_ROLE_ID, style: ButtonStyle.Success, emoji: '✅' },
      { label: 'Ask to PM', roleId: process.env.DISCORD_PM_ASK_ROLE_ID, style: ButtonStyle.Primary, emoji: '❔' },
      { label: 'No PMs', roleId: process.env.DISCORD_PM_NO_ROLE_ID, style: ButtonStyle.Danger, emoji: '🚫' },
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

      const message = await buttonRoleService.setupGenderRoles(channel, genderRoles);
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

      const message = await buttonRoleService.setupPMRoles(channel, pmRoles);
      messages.push(`PM preferences message: ${message.url}`);
      logger.info({ messageId: message.id, channelId: channel.id }, 'Set up PM roles via slash command');
    }

    await interaction.editReply({
      content: `✅ **Button roles set up successfully!**\n\n${messages.join('\n')}\n\nUsers can now click buttons to self-assign roles.`,
      ephemeral: true,
    });

    logger.info({
      staffUser: interaction.user.id,
      type,
      channelId: channel.id,
    }, 'Button roles set up successfully');

  } catch (err) {
    logger.error({ err, interaction: interaction.commandName }, 'Error executing setup-button-roles command');

    const errorMessage = 'An error occurred while setting up button roles. Please check the logs.';

    if (interaction.deferred) {
      await interaction.editReply({ content: errorMessage, ephemeral: true });
    } else {
      await interaction.reply({ content: errorMessage, ephemeral: true });
    }
  }
}
