import { REST, Routes } from 'discord.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readdirSync } from 'fs';
import { config } from '../config.js';
import logger from '../logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Load all commands from the commands directory
 */
export async function loadCommands() {
  const commands = new Map();
  const commandsPath = join(__dirname, '..', 'commands');

  try {
    const commandFiles = readdirSync(commandsPath).filter(file => file.endsWith('.js'));

    for (const file of commandFiles) {
      const filePath = join(commandsPath, file);
      const command = await import(`file://${filePath}`);

      if ('data' in command && 'execute' in command) {
        commands.set(command.data.name, command);
        logger.info({ commandName: command.data.name }, 'Loaded command');
      } else {
        logger.warn({ file }, 'Command file missing data or execute export');
      }
    }
  } catch (err) {
    logger.error({ err }, 'Error loading commands');
  }

  return commands;
}

/**
 * Register slash commands with Discord
 */
export async function registerCommands(commands) {
  const commandsData = Array.from(commands.values()).map(cmd => cmd.data.toJSON());

  const rest = new REST({ version: '10' }).setToken(config.discord.token);

  try {
    logger.info({ count: commandsData.length }, 'Started refreshing application (/) commands');

    const data = await rest.put(
      Routes.applicationGuildCommands(process.env.DISCORD_CLIENT_ID, config.discord.guildId),
      { body: commandsData }
    );

    logger.info({ count: data.length }, 'Successfully reloaded application (/) commands');
  } catch (err) {
    logger.error({ err }, 'Error registering commands');
  }
}

/**
 * Handle slash command interactions
 */
export async function handleCommandInteraction(interaction, commands) {
  const command = commands.get(interaction.commandName);

  if (!command) {
    logger.warn({ commandName: interaction.commandName }, 'Unknown command received');
    return;
  }

  try {
    await command.execute(interaction);
  } catch (err) {
    logger.error({ err, commandName: interaction.commandName }, 'Error executing command');

    const errorMessage = 'There was an error executing this command!';

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content: errorMessage, ephemeral: true });
    } else {
      await interaction.reply({ content: errorMessage, ephemeral: true });
    }
  }
}
