import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { config } from '../config.js';
import logger from '../logger.js';

export const data = new SlashCommandBuilder()
  .setName('approve-character')
  .setDescription('Approve a new player and grant them player access')
  .addUserOption(option =>
    option
      .setName('user')
      .setDescription('The user to approve')
      .setRequired(true))
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles);

export async function execute(interaction) {
  try {
    // Defer reply in case this takes a moment
    await interaction.deferReply({ ephemeral: true });

    const targetUser = interaction.options.getUser('user');
    const guild = interaction.guild;

    // Check if user has staff role
    const member = await guild.members.fetch(interaction.user.id);
    if (config.discord.staffRoleId && !member.roles.cache.has(config.discord.staffRoleId)) {
      await interaction.editReply({
        content: 'You do not have permission to use this command. Staff role required.',
        ephemeral: true,
      });
      return;
    }

    // Get the target member
    const targetMember = await guild.members.fetch(targetUser.id);
    if (!targetMember) {
      await interaction.editReply({
        content: `Could not find user ${targetUser.tag} in this server.`,
        ephemeral: true,
      });
      return;
    }

    // Add Player role
    let alreadyHadPlayerRole = false;
    if (config.discord.playerRoleId) {
      alreadyHadPlayerRole = targetMember.roles.cache.has(config.discord.playerRoleId);
      if (!alreadyHadPlayerRole) {
        await targetMember.roles.add(config.discord.playerRoleId);
        logger.info({ userId: targetUser.id, roleId: config.discord.playerRoleId }, 'Added Player role');
      } else {
        logger.info({ userId: targetUser.id, roleId: config.discord.playerRoleId }, 'User already has Player role');
      }
    } else {
      logger.warn('DISCORD_PLAYER_ROLE_ID not configured');
    }

    // Remove Roll Dice role
    let rollDiceRoleRemoved = false;
    let rollDiceRoleError = null;
    if (config.discord.rollDiceRoleId) {
      if (targetMember.roles.cache.has(config.discord.rollDiceRoleId)) {
        try {
          await targetMember.roles.remove(config.discord.rollDiceRoleId);
          logger.info({ userId: targetUser.id, roleId: config.discord.rollDiceRoleId }, 'Removed Roll Dice role');
          rollDiceRoleRemoved = true;
        } catch (err) {
          logger.error({ err, userId: targetUser.id, roleId: config.discord.rollDiceRoleId }, 'Failed to remove Roll Dice role - check role hierarchy');
          rollDiceRoleError = 'Missing Permissions - bot role must be higher in hierarchy';
        }
      } else {
        rollDiceRoleRemoved = true; // User didn't have the role
      }
    } else {
      logger.warn('DISCORD_ROLL_DICE_ROLE_ID not configured');
    }

    // Post welcome message in the channel where the command was run
    const welcomeMessage = alreadyHadPlayerRole
      ? `Your new character has been reviewed and approved.`
      : `Your character has been reviewed and approved — you're now an official member of the Guild.`;

    // Build the description with optional "Meet the Guild" section for new players only
    let description =
      `Welcome to the Triboar Guildhall, ${targetUser}!\n` +
      `${welcomeMessage}\n\n` +

      `**Next Steps**\n\n` +

      `**Import & Setup Your Character**\n` +
      `**This is important and required:** go to <#${config.discord.characterSetupChannelId}> and use Avrae to import your sheet and setup your bags.\n` +
      `Follow the instructions in the pinned messages of that channel and ping a staff member if you need help.\n\n` +

      `**Prepare for Adventure**\n` +
      `Add yourself to the <#${config.discord.queueChannelId}> and view the <#${config.discord.questBoardChannelId}>. Characters are selected for most quests based on queue position, so get in line!\n\n` +

      `**Get a Job!**\n` +
      `Every day you can work for gold by going to the <#${config.discord.dailyJobChannelId}> channel and using the !job alias to work in one of your skills. Higher rolls are rewarded higher earnings, so use your best skills!\n\n` +

      `**Try Your Hand at Survival**\n` +
      `Head to <#${config.discord.survivalChannelId}> to hunt, fish, or forage once an hour for a chance to catch prized species that offer XP and gold rewards.\n\n`;

    // Only show "Meet the Guild" for new players (those who didn't already have the Player role)
    if (!alreadyHadPlayerRole) {
      description +=
        `**Meet the Guild**\n` +
        `Optionally, stop by <#${config.discord.playerIntrosChannelId}> to introduce yourself and say hello to your fellow adventurers. The Guild is always looking for new allies to share the road, the risk, and the rewards.\n\n`;
    }

    description +=
      `Welcome again to the Triboar Guildhall.\n` +
      `The fires are warm, the ale is flowing, and adventure awaits!\n` +
      `*May your rolls be high and your blades stay sharp.*`;

    const welcomeEmbed = new EmbedBuilder()
      .setColor(0x5865F2) // Blurple
      .setTitle('Character Approved!')
      .setDescription(description)
      .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
      .setTimestamp()
      .setFooter({ text: 'Approved by ' + interaction.user.tag });

    await interaction.channel.send({ embeds: [welcomeEmbed] });
    logger.info({ userId: targetUser.id, channelId: interaction.channel.id }, 'Posted welcome message');

    // Send the same message as a DM to the user
    let dmSent = false;
    try {
      await targetUser.send({ embeds: [welcomeEmbed] });
      logger.info({ userId: targetUser.id }, 'Sent welcome message DM');
      dmSent = true;
    } catch (err) {
      logger.warn({ err, userId: targetUser.id }, 'Failed to send welcome DM - user may have DMs disabled');
    }

    // Send success message to staff member
    let rollDiceRoleStatus;
    if (!config.discord.rollDiceRoleId) {
      rollDiceRoleStatus = '⚠️ Not configured';
    } else if (rollDiceRoleError) {
      rollDiceRoleStatus = `❌ ${rollDiceRoleError}`;
    } else if (rollDiceRoleRemoved) {
      rollDiceRoleStatus = '✅ Removed';
    } else {
      rollDiceRoleStatus = '⚠️ User did not have role';
    }

    const successEmbed = new EmbedBuilder()
      .setColor(rollDiceRoleError ? 0xFEE75C : 0x57F287) // Yellow if error, Green if success
      .setTitle('Player Approved!')
      .setDescription(`Successfully approved ${targetUser}`)
      .addFields(
        { name: 'Player Role', value: config.discord.playerRoleId ? '✅ Added' : '⚠️ Not configured', inline: true },
        { name: 'Roll Dice Role', value: rollDiceRoleStatus, inline: true },
        { name: 'Welcome Message', value: '✅ Posted in this channel', inline: true },
        { name: 'DM Sent', value: dmSent ? '✅ Sent' : '⚠️ Failed (DMs disabled)', inline: true }
      )
      .setTimestamp();

    if (rollDiceRoleError) {
      successEmbed.setFooter({ text: '⚠️ Tip: Move the bot\'s role higher in Server Settings → Roles' });
    }

    await interaction.editReply({ embeds: [successEmbed], ephemeral: true });

    logger.info({
      staffUser: interaction.user.id,
      targetUser: targetUser.id,
    }, 'Player approved successfully');

  } catch (err) {
    logger.error({ err, interaction: interaction.commandName }, 'Error executing approve-character command');

    const errorMessage = 'An error occurred while approving the player. Please check the logs.';

    if (interaction.deferred) {
      await interaction.editReply({ content: errorMessage, ephemeral: true });
    } else {
      await interaction.reply({ content: errorMessage, ephemeral: true });
    }
  }
}
