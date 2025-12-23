import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { config } from '../config.js';
import logger from '../logger.js';

export const data = new SlashCommandBuilder()
  .setName('starboard-report')
  .setDescription('Get a list of unique PCs starred between two starboard posts')
  .addStringOption(option =>
    option
      .setName('start')
      .setDescription('Link to the first (older) starboard message')
      .setRequired(true))
  .addStringOption(option =>
    option
      .setName('end')
      .setDescription('Link to the second (newer) starboard message')
      .setRequired(true))
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles);

export async function execute(interaction) {
  try {
    await interaction.deferReply();

    // Check if user has staff role
    const member = await interaction.guild.members.fetch(interaction.user.id);
    if (config.discord.staffRoleId && !member.roles.cache.has(config.discord.staffRoleId)) {
      await interaction.editReply({
        content: 'You do not have permission to use this command. Staff role required.',
      });
      return;
    }

    // Check if starboard channel is configured
    if (!config.starboard.channelId) {
      await interaction.editReply({
        content: '❌ Starboard channel is not configured.',
      });
      return;
    }

    const startLink = interaction.options.getString('start');
    const endLink = interaction.options.getString('end');

    // Extract message IDs from links
    const startId = extractMessageId(startLink);
    const endId = extractMessageId(endLink);

    if (!startId || !endId) {
      await interaction.editReply({
        content: '❌ Invalid message links. Please provide valid Discord message links.',
      });
      return;
    }

    // Fetch the starboard channel
    const starboardChannel = await interaction.client.channels.fetch(config.starboard.channelId);
    if (!starboardChannel) {
      await interaction.editReply({
        content: '❌ Could not find starboard channel.',
      });
      return;
    }

    // Fetch the start and end messages to get their timestamps
    let startMessage, endMessage;
    try {
      startMessage = await starboardChannel.messages.fetch(startId);
      endMessage = await starboardChannel.messages.fetch(endId);
    } catch (err) {
      await interaction.editReply({
        content: '❌ Could not find one or both messages. Make sure they are from the starboard channel.',
      });
      return;
    }

    // Ensure start is before end (swap if needed)
    if (startMessage.createdTimestamp > endMessage.createdTimestamp) {
      [startMessage, endMessage] = [endMessage, startMessage];
    }

    // Fetch all messages between start and end
    const uniquePCs = new Set();
    let lastId = endMessage.id;
    let foundStart = false;

    // Add the end message's PC
    const endPC = extractPCName(endMessage);
    if (endPC) uniquePCs.add(endPC);

    // Fetch messages in batches, going backwards from end to start
    while (!foundStart) {
      const messages = await starboardChannel.messages.fetch({
        limit: 100,
        before: lastId,
      });

      if (messages.size === 0) break;

      for (const [id, message] of messages) {
        // Check if we've reached or passed the start message
        if (message.createdTimestamp <= startMessage.createdTimestamp) {
          foundStart = true;
          // Include the start message if this is it
          if (id === startMessage.id) {
            const pcName = extractPCName(message);
            if (pcName) uniquePCs.add(pcName);
          }
          break;
        }

        const pcName = extractPCName(message);
        if (pcName) uniquePCs.add(pcName);

        lastId = id;
      }
    }

    // Add the start message's PC (in case we didn't catch it)
    const startPC = extractPCName(startMessage);
    if (startPC) uniquePCs.add(startPC);

    // Sort alphabetically and format output
    const sortedPCs = Array.from(uniquePCs).sort((a, b) =>
      a.toLowerCase().localeCompare(b.toLowerCase())
    );

    if (sortedPCs.length === 0) {
      await interaction.editReply({
        content: '❌ No PCs found in the specified range.',
      });
      return;
    }

    const pcList = sortedPCs.map((pc, i) => `${i + 1}. ${pc}`).join('\n');
    const response = `**⭐ Starred PCs (${sortedPCs.length} unique)**\n\n${pcList}`;

    // Discord has a 2000 character limit, split if needed
    if (response.length <= 2000) {
      await interaction.editReply({ content: response });
    } else {
      // Split into multiple messages
      await interaction.editReply({ content: `**⭐ Starred PCs (${sortedPCs.length} unique)**` });

      let chunk = '';
      for (let i = 0; i < sortedPCs.length; i++) {
        const line = `${i + 1}. ${sortedPCs[i]}\n`;
        if (chunk.length + line.length > 1900) {
          await interaction.followUp({ content: chunk });
          chunk = line;
        } else {
          chunk += line;
        }
      }
      if (chunk) {
        await interaction.followUp({ content: chunk });
      }
    }

    logger.info({
      staffUser: interaction.user.id,
      startId,
      endId,
      pcCount: sortedPCs.length,
    }, 'Generated starboard report');

  } catch (err) {
    logger.error({ err, interaction: interaction.commandName }, 'Error executing starboard-report command');

    const errorMessage = 'An error occurred while generating the report. Please check the logs.';

    if (interaction.deferred) {
      await interaction.editReply({ content: errorMessage });
    } else {
      await interaction.reply({ content: errorMessage, ephemeral: true });
    }
  }
}

/**
 * Extract message ID from a Discord message link
 */
function extractMessageId(link) {
  // Discord message links look like:
  // https://discord.com/channels/GUILD_ID/CHANNEL_ID/MESSAGE_ID
  // or https://discordapp.com/channels/GUILD_ID/CHANNEL_ID/MESSAGE_ID
  const match = link.match(/channels\/\d+\/\d+\/(\d+)/);
  return match ? match[1] : null;
}

/**
 * Extract PC name from a starboard message embed
 */
function extractPCName(message) {
  if (message.embeds && message.embeds.length > 0) {
    const embed = message.embeds[0];
    if (embed.author && embed.author.name) {
      return embed.author.name;
    }
  }
  return null;
}
