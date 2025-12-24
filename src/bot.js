import { Client, GatewayIntentBits, Partials, ChannelType, ActivityType } from 'discord.js';
import cron from 'node-cron';
import { config } from './config.js';
import logger from './logger.js';
import { RoleService } from './services/roleService.js';
import { BackendService } from './services/backendService.js';
import { DMService } from './services/dmService.js';
import { SyncService } from './services/syncService.js';
import { ButtonRoleService } from './services/buttonRoleService.js';
import { StarboardService } from './services/starboardService.js';
import webhookServer from './webhookServer.js';
import { loadCommands, registerCommands, handleCommandInteraction } from './utils/commandHandler.js';

// Initialize Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
  ],
  partials: [
    Partials.Channel, // Required to receive DMs
    Partials.Message, // Required to receive DM messages
    Partials.Reaction, // Required for starboard reactions on old messages
  ],
});

// Initialize services
let roleService;
let backendService;
let dmService;
let syncService;
let buttonRoleService;
let starboardService;
let commands;

client.once('ready', async () => {
  logger.info(`✓ Bot logged in as ${client.user.tag}`);

  // Initialize services
  roleService = new RoleService(client);
  backendService = new BackendService();
  dmService = new DMService(client);
  syncService = new SyncService(roleService, backendService, dmService);
  buttonRoleService = new ButtonRoleService(client);
  starboardService = new StarboardService(client);

  // Attach services to client so commands can access them
  client.buttonRoleService = buttonRoleService;

  // Load and register slash commands
  commands = await loadCommands();
  if (process.env.DISCORD_CLIENT_ID) {
    await registerCommands(commands);
  } else {
    logger.warn('DISCORD_CLIENT_ID not set - slash commands will not be registered');
  }

  // Set bot status
  client.user.setActivity('subscriptions', { type: ActivityType.Watching });

  // Schedule daily sync at 11:59 PM
  logger.info(`Scheduling daily sync: ${config.schedule.dailySync}`);
  cron.schedule(config.schedule.dailySync, async () => {
    logger.info('Daily sync scheduled task running');
    await syncService.performDailySync();
  });

  // Perform initial sync on startup
  logger.info('Performing initial sync on startup');
  await syncService.performDailySync();
});

/**
 * Handle messages for DM opt-out
 */
client.on('messageCreate', async (message) => {
  // Only handle DMs
  if (message.channel.type !== ChannelType.DM) return;
  if (message.author.bot) return;

  const content = message.content.trim().toUpperCase();

  if (content === 'STOP') {
    await message.reply('You\'ve opted out of grace period reminders. You can opt back in anytime by replying with "START".');
    await backendService.setGracePeriodDMPreference(message.author.id, false);
    logger.info({ userId: message.author.id }, 'User opted out of grace period DMs');
  } else if (content === 'START') {
    await message.reply('You\'ve opted back in to grace period reminders. You\'ll receive daily reminders during your grace period.');
    await backendService.setGracePeriodDMPreference(message.author.id, true);
    logger.info({ userId: message.author.id }, 'User opted in to grace period DMs');
  }
});

/**
 * Handle new guild members (welcome them)
 */
client.on('guildMemberAdd', async (member) => {
  try {
    logger.info({ memberId: member.user.id }, 'New member joined');

    // Send welcome message to the welcome channel if configured
    if (config.discord.welcomeChannelId) {
      try {
        const welcomeChannel = await client.channels.fetch(config.discord.welcomeChannelId);

        const embed = {
          color: 0xB8860B, // guild-gold
          title: `Welcome to Triboar, ${member.user.username}!`,
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
        const webhooks = await welcomeChannel.fetchWebhooks();
        webhook = webhooks.find(wh => wh.owner.id === client.user.id && wh.name === 'Welcome Bot');

        if (!webhook) {
          webhook = await welcomeChannel.createWebhook({
            name: 'Welcome Bot',
            reason: 'Webhook for welcome messages with custom display',
          });
          logger.info({ channelId: config.discord.welcomeChannelId }, 'Created welcome webhook');
        }

        await webhook.send({
          content: `${member}`,
          embeds: [embed],
          username: 'Big Al, Sheriff of Triboar',
          avatarURL: 'https://cdn.tupperbox.app/pfp/753294841227640955/9qT8Evo4yT45GBTx.webp',
        });

        logger.info({ memberId: member.user.id, channelId: config.discord.welcomeChannelId }, 'Sent welcome message via webhook');
      } catch (err) {
        logger.error({ err, memberId: member.user.id }, 'Failed to send welcome message');
      }
    }

    // Check if they're an active subscriber
    const activeSubscribers = await backendService.getActiveSubscribers();
    const isSubscriber = activeSubscribers.some(s => s.discordId === member.user.id);

    if (isSubscriber) {
      await roleService.addSubscribedRole(member.user.id);
      await dmService.sendSubscriptionConfirmationDM(member.user.id);
      logger.info({ memberId: member.user.id }, 'Subscriber joined - role added');
    }
  } catch (err) {
    logger.error({ err, memberId: member.user.id }, 'Error handling new member');
  }
});

/**
 * Handle slash command interactions
 */
client.on('interactionCreate', async (interaction) => {
  if (interaction.isChatInputCommand()) {
    await handleCommandInteraction(interaction, commands);
    return;
  }

  // Handle button interactions for role assignment
  if (interaction.isButton()) {
    const customId = interaction.customId;

    // Handle gender role buttons
    if (customId.startsWith('gender_role_')) {
      const roleId = customId.replace('gender_role_', '');
      await buttonRoleService.handleGenderRoleButton(interaction, roleId);
      return;
    }

    // Handle PM role buttons
    if (customId.startsWith('pm_role_')) {
      const roleId = customId.replace('pm_role_', '');
      const allPMRoles = [
        process.env.DISCORD_PM_OK_ROLE_ID,
        process.env.DISCORD_PM_ASK_ROLE_ID,
        process.env.DISCORD_PM_NO_ROLE_ID,
      ].filter(id => id);
      await buttonRoleService.handlePMRoleButton(interaction, roleId, allPMRoles);
      return;
    }

    // Handle interest/notification role buttons
    if (customId.startsWith('interest_role_')) {
      const roleId = customId.replace('interest_role_', '');
      await buttonRoleService.handleInterestRoleButton(interaction, roleId);
      return;
    }

    // Handle geographic region role buttons
    if (customId.startsWith('region_role_')) {
      const roleId = customId.replace('region_role_', '');
      await buttonRoleService.handleRegionRoleButton(interaction, roleId);
      return;
    }
  }

  // Handle modal submissions for message editing
  if (interaction.isModalSubmit()) {
    const customId = interaction.customId;

    // Handle forum post creation modal
    if (customId.startsWith('message_post_')) {
      try {
        await interaction.deferReply({ ephemeral: true });

        // Parse forum channel ID from custom ID
        // Format: message_post_{forumId}
        const forumId = customId.replace('message_post_', '');

        // Get the title and content from the modal
        const title = interaction.fields.getTextInputValue('title');
        const content = interaction.fields.getTextInputValue('content');

        // Fetch the forum channel
        const forum = await interaction.client.channels.fetch(forumId);

        // Get or create webhook for custom name and avatar
        let webhook;
        const webhooks = await forum.fetchWebhooks();
        webhook = webhooks.find(wh => wh.owner?.id === interaction.client.user.id && wh.name === 'Message Manager');

        if (!webhook) {
          webhook = await forum.createWebhook({
            name: 'Message Manager',
            reason: 'Webhook for managed messages with custom display',
          });
          logger.info({ forumId }, 'Created Message Manager webhook');
        }

        // Create forum post via webhook
        // Webhooks can create forum posts by specifying threadName
        const sentMessage = await webhook.send({
          content,
          username: 'Big Al, Sheriff of Triboar',
          avatarURL: 'https://cdn.tupperbox.app/pfp/753294841227640955/9qT8Evo4yT45GBTx.webp',
          threadName: title,
        });

        logger.info({
          userId: interaction.user.id,
          forumId,
          threadId: sentMessage.channelId,
          messageId: sentMessage.id,
        }, 'Created forum post via webhook');

        const postUrl = `https://discord.com/channels/${interaction.guild.id}/${sentMessage.channelId}`;
        const messageUrl = `https://discord.com/channels/${interaction.guild.id}/${sentMessage.channelId}/${sentMessage.id}`;
        await interaction.editReply({
          content: `Forum post created successfully!\n\n**Post link:** ${postUrl}\n**First message link:** ${messageUrl}\n\nSave these links to edit or delete later.`,
        });
      } catch (err) {
        logger.error({ err }, 'Error handling message post modal');
        if (interaction.deferred) {
          await interaction.editReply({
            content: 'An error occurred while creating the forum post. Please try again.',
          });
        } else {
          await interaction.reply({
            content: 'An error occurred while creating the forum post. Please try again.',
            ephemeral: true,
          });
        }
      }
      return;
    }

    // Handle message send modal
    if (customId.startsWith('message_send_')) {
      try {
        await interaction.deferReply({ ephemeral: true });

        // Parse channel ID from custom ID
        // Format: message_send_{channelId}
        const channelId = customId.replace('message_send_', '');

        // Get the content from the modal
        const content = interaction.fields.getTextInputValue('content');

        // Fetch the channel
        const channel = await interaction.client.channels.fetch(channelId);

        // For threads (including forum posts), we need to use the parent channel's webhook
        let webhookChannel = channel;
        let threadId = null;

        if (channel.isThread()) {
          webhookChannel = await interaction.client.channels.fetch(channel.parentId);
          threadId = channel.id;
        }

        // Get or create webhook for custom name and avatar
        let webhook;
        const webhooks = await webhookChannel.fetchWebhooks();
        webhook = webhooks.find(wh => wh.owner?.id === interaction.client.user.id && wh.name === 'Message Manager');

        if (!webhook) {
          webhook = await webhookChannel.createWebhook({
            name: 'Message Manager',
            reason: 'Webhook for managed messages with custom display',
          });
          logger.info({ channelId: webhookChannel.id }, 'Created Message Manager webhook');
        }

        // Send via webhook with Big Al identity
        const sentMessage = await webhook.send({
          content,
          username: 'Big Al, Sheriff of Triboar',
          avatarURL: 'https://cdn.tupperbox.app/pfp/753294841227640955/9qT8Evo4yT45GBTx.webp',
          threadId,
        });

        logger.info({
          userId: interaction.user.id,
          channelId,
          messageId: sentMessage.id,
        }, 'Sent managed message via webhook');

        const messageUrl = `https://discord.com/channels/${interaction.guild.id}/${channelId}/${sentMessage.id}`;
        await interaction.editReply({
          content: `Message sent successfully!\n\n**Message link:** ${messageUrl}\n\nSave this link to edit or delete the message later.`,
        });
      } catch (err) {
        logger.error({ err }, 'Error handling message send modal');
        if (interaction.deferred) {
          await interaction.editReply({
            content: 'An error occurred while sending the message. Please try again.',
          });
        } else {
          await interaction.reply({
            content: 'An error occurred while sending the message. Please try again.',
            ephemeral: true,
          });
        }
      }
      return;
    }

    // Handle message edit modal
    if (customId.startsWith('message_edit_')) {
      try {
        await interaction.deferReply({ ephemeral: true });

        // Parse channel and message IDs from custom ID
        // Format: message_edit_{channelId}_{messageId}
        const parts = customId.split('_');
        const channelId = parts[2];
        const messageId = parts[3];

        // Get the new content from the modal
        const newContent = interaction.fields.getTextInputValue('content');

        // Fetch the channel and message
        const channel = await interaction.client.channels.fetch(channelId);
        const message = await channel.messages.fetch(messageId);

        // Check if this is a webhook message
        if (message.webhookId) {
          // For threads, webhook is on parent channel
          let webhookChannel = channel;
          if (channel.isThread()) {
            webhookChannel = await interaction.client.channels.fetch(channel.parentId);
          }

          // Find the webhook and edit via webhook
          const webhooks = await webhookChannel.fetchWebhooks();
          const webhook = webhooks.find(wh => wh.id === message.webhookId);

          if (webhook) {
            await webhook.editMessage(messageId, { content: newContent });
          } else {
            throw new Error('Could not find the webhook for this message');
          }
        } else {
          // Regular bot message - edit directly
          await message.edit({ content: newContent });
        }

        logger.info({
          userId: interaction.user.id,
          channelId,
          messageId,
        }, 'Edited managed message via modal');

        const messageUrl = `https://discord.com/channels/${interaction.guild.id}/${channelId}/${messageId}`;
        await interaction.editReply({
          content: `Message edited successfully!\n\n**Message link:** ${messageUrl}`,
        });
      } catch (err) {
        logger.error({ err }, 'Error handling message edit modal');
        if (interaction.deferred) {
          await interaction.editReply({
            content: 'An error occurred while editing the message. Please try again.',
          });
        } else {
          await interaction.reply({
            content: 'An error occurred while editing the message. Please try again.',
            ephemeral: true,
          });
        }
      }
      return;
    }
  }
});

/**
 * Handle star reactions for starboard
 */
client.on('messageReactionAdd', async (reaction, user) => {
  if (user.bot) return;
  if (starboardService) {
    await starboardService.handleStarAdd(reaction, user);
  }
});

/**
 * Handle star reaction removal for starboard
 */
client.on('messageReactionRemove', async (reaction, user) => {
  if (user.bot) return;
  if (starboardService) {
    await starboardService.handleStarRemove(reaction, user);
  }
});

/**
 * Handle webhook events from the backend
 * The backend will POST to a webhook endpoint that calls this
 */
export const handleWebhook = async (event) => {
  try {
    const { type, data } = event;

    logger.info({ eventType: type }, 'Processing webhook event');

    switch (type) {
      case 'subscription.activated':
      case 'subscription.renewed':
        // User just paid/renewed
        await syncService.syncUserOnPayment(data.discordId);
        break;

      case 'subscription.cancelled':
        // User's subscription is over - they go to grace period
        // (backend handles moving to grace period, bot just needs to know)
        logger.info({ discordId: data.discordId }, 'Subscription cancelled event received');
        break;

      case 'grace_period.started':
        // User entered grace period - send first reminder
        if (config.gracePeriod.dmEnabled) {
          await dmService.sendGracePeriodReminder(data.discordId, config.gracePeriod.days);
        }
        break;

      default:
        logger.warn({ eventType: type }, 'Unknown webhook event type');
    }

  } catch (err) {
    logger.error({ err, event }, 'Failed to process webhook');
  }
};

/**
 * Start webhook server
 */
const PORT = process.env.PORT || 3001;
webhookServer.listen(PORT, () => {
  logger.info({ port: PORT }, 'Webhook server started');
});

/**
 * Login to Discord
 */
client.login(config.discord.token).catch(err => {
  logger.error({ err }, 'Failed to login to Discord');
  process.exit(1);
});

/**
 * Handle errors
 */
client.on('error', err => {
  logger.error({ err }, 'Discord client error');
});

process.on('unhandledRejection', err => {
  logger.error({ err }, 'Unhandled promise rejection');
});

export default client;
