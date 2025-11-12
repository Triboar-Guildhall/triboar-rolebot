import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { config } from '../config.js';
import logger from '../logger.js';

export const data = new SlashCommandBuilder()
  .setName('test-welcome')
  .setDescription('Test the welcome message embed (staff only)')
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

    // Create the welcome embed (same as in bot.js)
    const embed = {
      color: 0xB8860B, // guild-gold
      title: `Welcome to Triboar, ${interaction.user.username}!`,
      description:
        `Greetings, traveler! The town of Triboar welcomes you.\n\n` +
        `**Not Yet a Guildhall Member?**\n` +
        `Visit our website at ${config.website.url} for information on joining the Guildhall and gaining access to all our adventures.\n\n` +
        `**Already Subscribed?**\n` +
        `You should receive a private message confirmation shortly. If you don't see it, check your DM settings.\n\n` +
        `**Questions?**\n` +
        `Feel free to ping the <@&${config.discord.staffRoleId}> role and we'll be happy to assist you.\n\n` +
        `*May your dice roll high and your blades stay sharp!*`,
      timestamp: new Date().toISOString(),
    };

    // Add image if configured
    if (config.welcome.imageUrl) {
      embed.image = { url: config.welcome.imageUrl };
    }

    // Get or create webhook for custom name and avatar
    let webhook;
    const webhooks = await interaction.channel.fetchWebhooks();
    webhook = webhooks.find(wh => wh.owner.id === interaction.client.user.id && wh.name === 'Welcome Bot');

    if (!webhook) {
      webhook = await interaction.channel.createWebhook({
        name: 'Welcome Bot',
        reason: 'Webhook for welcome messages with custom display',
      });
      logger.info({ channelId: interaction.channel.id }, 'Created welcome webhook for testing');
    }

    // Send the test welcome message via webhook
    await webhook.send({
      content: `${interaction.user}`,
      embeds: [embed],
      username: 'Big Al, Sheriff of Triboar',
      avatarURL: 'https://cdn.tupperbox.app/pfp/753294841227640955/9qT8Evo4yT45GBTx.webp',
    });

    await interaction.reply({
      content: 'Test welcome message sent!',
      ephemeral: true,
    });

    logger.info({ userId: interaction.user.id, channelId: interaction.channel.id }, 'Sent test welcome message');

  } catch (err) {
    logger.error({ err, interaction: interaction.commandName }, 'Error executing test-welcome command');

    const errorMessage = 'An error occurred while sending the test welcome message. Please check the logs.';

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content: errorMessage, ephemeral: true });
    } else {
      await interaction.reply({ content: errorMessage, ephemeral: true });
    }
  }
}
