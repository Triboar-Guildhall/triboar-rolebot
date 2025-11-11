import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { config } from '../config.js';
import logger from '../logger.js';

export const data = new SlashCommandBuilder()
  .setName('test-subscription-dm')
  .setDescription('Test the subscription confirmation DM (staff only)')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles);

export async function execute(interaction) {
  try {
    // Check if user has staff role
    const member = await interaction.guild.members.fetch(interaction.user.id);
    if (config.discord.staffRoleId && !member.roles.cache.has(config.discord.staffRoleId)) {
      await interaction.reply({
        content: 'You do not have permission to use this command. Staff role required.',
        ephemeral: true,
      });
      return;
    }

    // Create the subscription confirmation embed (same as in dmService.js)
    const embed = {
      color: 0x2C3E50, // guild-blue
      author: {
        name: 'Big Al, Sheriff of Triboar',
        icon_url: 'https://cdn.tupperbox.app/pfp/753294841227640955/9qT8Evo4yT45GBTx.webp',
      },
      title: '🐗 Welcome to the Triboar Guildhall! 🐗',
      description:
        `You now have access to character creation, your first step to making a mark in this world!\n\n` +
        `Head to <#${config.discord.characterRulesChannelId}> to learn how to make a character, and then roll the dice in <#${config.discord.characterRollsChannelId}>. You already have access to that channel, so cast your first fateful dice!\n\n` +
        `If you have questions about character creation or just want to talk to other players about builds, drop into <#${config.discord.characterHelpChannelId}> or ping the <@&${config.discord.staffRoleId}> role.\n\n` +
        `*May your rolls be high and your blades stay sharp!*`,
    };

    // Send the test DM to the user
    await interaction.user.send({
      embeds: [embed],
    });

    await interaction.reply({
      content: 'Test subscription confirmation DM sent! Check your DMs.',
      ephemeral: true,
    });

    logger.info({ userId: interaction.user.id }, 'Sent test subscription confirmation DM');

  } catch (err) {
    logger.error({ err, interaction: interaction.commandName }, 'Error executing test-subscription-dm command');

    const errorMessage = 'An error occurred while sending the test DM. Make sure your DMs are enabled.';

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content: errorMessage, ephemeral: true });
    } else {
      await interaction.reply({ content: errorMessage, ephemeral: true });
    }
  }
}
