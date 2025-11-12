import { Client, GatewayIntentBits, Partials, ChannelType, ActivityType } from 'discord.js';
import cron from 'node-cron';
import { config } from './config.js';
import logger from './logger.js';
import { RoleService } from './services/roleService.js';
import { BackendService } from './services/backendService.js';
import { DMService } from './services/dmService.js';
import { SyncService } from './services/syncService.js';
import webhookServer from './webhookServer.js';
import { loadCommands, registerCommands, handleCommandInteraction } from './utils/commandHandler.js';

// Initialize Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [
    Partials.Channel, // Required to receive DMs
    Partials.Message, // Required to receive DM messages
  ],
});

// Initialize services
let roleService;
let backendService;
let dmService;
let syncService;
let commands;

client.once('ready', async () => {
  logger.info(`✓ Bot logged in as ${client.user.tag}`);

  // Initialize services
  roleService = new RoleService(client);
  backendService = new BackendService();
  dmService = new DMService(client);
  syncService = new SyncService(roleService, backendService, dmService);

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
  if (!interaction.isChatInputCommand()) return;

  await handleCommandInteraction(interaction, commands);
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
