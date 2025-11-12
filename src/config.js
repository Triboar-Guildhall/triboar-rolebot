import dotenv from 'dotenv';

dotenv.config();

export const config = {
  discord: {
    token: process.env.DISCORD_BOT_TOKEN,
    guildId: process.env.DISCORD_GUILD_ID,
    subscribedRoleId: process.env.DISCORD_SUBSCRIBED_ROLE_ID,
    playerRoleId: process.env.DISCORD_PLAYER_ROLE_ID,
    rollDiceRoleId: process.env.DISCORD_ROLL_DICE_ROLE_ID,
    staffRoleId: process.env.DISCORD_STAFF_ROLE_ID,
    characterSetupChannelId: process.env.DISCORD_CHARACTER_SETUP_CHANNEL_ID,
    characterRulesChannelId: process.env.DISCORD_CHARACTER_RULES_CHANNEL_ID,
    characterRollsChannelId: process.env.DISCORD_CHARACTER_ROLLS_CHANNEL_ID,
    characterHelpChannelId: process.env.DISCORD_CHARACTER_HELP_CHANNEL_ID,
    queueChannelId: process.env.DISCORD_QUEUE_CHANNEL_ID,
    questBoardChannelId: process.env.DISCORD_QUEST_BOARD_CHANNEL_ID,
    dailyJobChannelId: process.env.DISCORD_DAILY_JOB_CHANNEL_ID,
    playerIntrosChannelId: process.env.DISCORD_PLAYER_INTROS_CHANNEL_ID,
    welcomeChannelId: process.env.DISCORD_WELCOME_CHANNEL_ID,
  },
  backend: {
    apiUrl: process.env.BACKEND_API_URL || 'http://localhost:3000',
    apiToken: process.env.BACKEND_API_TOKEN,
  },
  checkout: {
    url: process.env.CHECKOUT_URL || 'https://triboar.guild/checkout/',
  },
  website: {
    url: process.env.WEBSITE_URL || 'https://triboar.guild',
  },
  welcome: {
    imageUrl: process.env.WELCOME_IMAGE_URL,
  },
  gracePeriod: {
    days: parseInt(process.env.GRACE_PERIOD_DAYS) || 7,
    dmEnabled: process.env.GRACE_PERIOD_DM_ENABLED !== 'false',
  },
  schedule: {
    dailySync: process.env.DAILY_SYNC_SCHEDULE || '59 23 * * *', // 11:59 PM daily
  },
};

// Validate required config
const requiredEnvVars = ['DISCORD_BOT_TOKEN', 'DISCORD_GUILD_ID', 'DISCORD_SUBSCRIBED_ROLE_ID', 'BACKEND_API_TOKEN'];
const missing = requiredEnvVars.filter(v => !process.env[v]);

// Optional: Validate command-related config (log warnings if missing)
const commandEnvVars = ['DISCORD_PLAYER_ROLE_ID', 'DISCORD_ROLL_DICE_ROLE_ID', 'DISCORD_STAFF_ROLE_ID'];
const missingCommandVars = commandEnvVars.filter(v => !process.env[v]);
if (missingCommandVars.length > 0) {
  console.warn(`Warning: Missing optional environment variables for slash commands: ${missingCommandVars.join(', ')}`);
  console.warn('Some slash commands may not work properly without these configured.');
}

if (missing.length > 0) {
  console.error(`Missing required environment variables: ${missing.join(', ')}`);
  console.error('Copy .env.example to .env and fill in the values');
  process.exit(1);
}

// Validate BACKEND_API_TOKEN has minimum length
if (config.backend.apiToken && config.backend.apiToken.length < 32) {
  console.error('BACKEND_API_TOKEN must be at least 32 characters long');
  process.exit(1);
}

export default config;
