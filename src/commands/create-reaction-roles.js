import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { config } from '../config.js';
import logger from '../logger.js';

export const data = new SlashCommandBuilder()
  .setName('create-reaction-roles')
  .setDescription('Create all reaction roles (gender & PM preferences) - staff only')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles);

export async function execute(interaction) {
  try {
    // Defer reply in case this takes a moment
    await interaction.deferReply({ ephemeral: true });

    // Check if user has staff role
    const member = await interaction.guild.members.fetch(interaction.user.id);
    if (config.discord.staffRoleId && !member.roles.cache.has(config.discord.staffRoleId)) {
      await interaction.editReply({
        content: 'You do not have permission to use this command. Staff role required.',
        ephemeral: true,
      });
      return;
    }

    const guild = interaction.guild;
    const createdRoles = [];
    const envVars = [];

    logger.info({ guildId: guild.id, staffUser: interaction.user.id }, 'Creating reaction roles');

    // Define roles to create
    const rolesToCreate = [
      // Gender roles
      { name: 'She/Her', color: 0xF1948A, envVar: 'DISCORD_GENDER_SHE_HER_ROLE_ID' },
      { name: 'He/Him', color: 0x5DADE2, envVar: 'DISCORD_GENDER_HE_HIM_ROLE_ID' },
      { name: 'She/Them', color: 0x76D7C4, envVar: 'DISCORD_GENDER_SHE_THEM_ROLE_ID' },
      { name: 'He/Them', color: 0xC39BD3, envVar: 'DISCORD_GENDER_HE_THEM_ROLE_ID' },
      { name: 'They/Them', color: 0xF8B229, envVar: 'DISCORD_GENDER_THEY_THEM_ROLE_ID' },
      { name: 'Other/Neopronoun', color: 0x95A5A6, envVar: 'DISCORD_GENDER_ASK_ROLE_ID' },

      // PM preference roles
      { name: 'OK to PM', color: 0x52C41A, envVar: 'DISCORD_PM_OK_ROLE_ID' },
      { name: 'Ask to PM', color: 0xFAAD14, envVar: 'DISCORD_PM_ASK_ROLE_ID' },
      { name: 'No PMs', color: 0xF5222D, envVar: 'DISCORD_PM_NO_ROLE_ID' },
    ];

    // Create each role
    for (const roleData of rolesToCreate) {
      try {
        // Check if role already exists
        const existingRole = guild.roles.cache.find(r => r.name === roleData.name);

        if (existingRole) {
          createdRoles.push(`✓ ${roleData.name} (already exists)`);
          envVars.push(`${roleData.envVar}=${existingRole.id}`);
          logger.info({ roleId: existingRole.id, roleName: roleData.name }, 'Role already exists');
        } else {
          // Create the role
          const role = await guild.roles.create({
            name: roleData.name,
            color: roleData.color,
            reason: `Reaction role created by ${interaction.user.tag}`,
            mentionable: false,
            hoist: false,
          });

          createdRoles.push(`✅ ${roleData.name} (created)`);
          envVars.push(`${roleData.envVar}=${role.id}`);
          logger.info({ roleId: role.id, roleName: roleData.name }, 'Created reaction role');
        }
      } catch (err) {
        createdRoles.push(`❌ ${roleData.name} (failed)`);
        logger.error({ err, roleName: roleData.name }, 'Failed to create role');
      }
    }

    // Format the response
    const response =
      `✅ **Reaction roles setup complete!**\n\n` +
      `**Roles created/verified:**\n${createdRoles.join('\n')}\n\n` +
      `**Add these to your \`.env\` file:**\n\`\`\`\n${envVars.join('\n')}\n\`\`\`\n\n` +
      `After updating your \`.env\` file, restart the bot and use \`/setup-reaction-roles\` to create the reaction role messages.`;

    await interaction.editReply({
      content: response,
      ephemeral: true,
    });

    logger.info({
      guildId: guild.id,
      staffUser: interaction.user.id,
      rolesCreated: createdRoles.length
    }, 'Reaction roles creation completed');

  } catch (err) {
    logger.error({ err, interaction: interaction.commandName }, 'Error executing create-reaction-roles command');

    const errorMessage = 'An error occurred while creating reaction roles. Please check the logs and ensure the bot has "Manage Roles" permission.';

    if (interaction.deferred) {
      await interaction.editReply({ content: errorMessage, ephemeral: true });
    } else {
      await interaction.reply({ content: errorMessage, ephemeral: true });
    }
  }
}
