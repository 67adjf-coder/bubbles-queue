const { 
  Client, 
  GatewayIntentBits, 
  SlashCommandBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  EmbedBuilder,
  REST,
  Routes
} = require('discord.js');
const http = require('http');

// Render web service keep-alive server
http.createServer((req, res) => res.end('Bot is online!')).listen(process.env.PORT || 3000);

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});

// Configuration IDs
const QUEUE_CHANNEL_ID = '1539239066049060974';
const STAFF_ROLE_ID = '1533372358755221566';
const PASTEL_BLUE = '#AEC6CF';

let queueCounter = 1;

// Helper to format date & time specifically in GMT+8 (Asia/Manila)
function getGMT8Time() {
  const options = {
    timeZone: 'Asia/Manila',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  };
  return new Intl.DateTimeFormat('en-US', options).format(new Date());
}

// Slash command definition
const commands = [
  new SlashCommandBuilder()
    .setName('queue-list')
    .setDescription('Create a new queue tracker for an order')
    .addUserOption(opt => opt.setName('buyer').setDescription('Select the buyer').setRequired(true))
    .addStringOption(opt => opt.setName('item').setDescription('Item bought').setRequired(true))
    .addStringOption(opt => opt.setName('info').setDescription('Item info').setRequired(true))
    .addStringOption(opt => opt.setName('payment').setDescription('Payment method').setRequired(true))
    .addStringOption(opt => opt.setName('price').setDescription('Price paid').setRequired(true))
];

client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);

  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  try {
    await rest.put(
      Routes.applicationCommands(client.user.id),
      { body: commands }
    );
    console.log('Slash commands registered successfully.');
  } catch (error) {
    console.error('Error registering slash commands:', error);
  }
});

client.on('interactionCreate', async (interaction) => {
  // 1. Handle Slash Command
  if (interaction.isChatInputCommand()) {
    if (interaction.commandName === 'queue-list') {
      // Staff Role Check
      if (!interaction.member.roles.cache.has(STAFF_ROLE_ID)) {
        return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
      }

      // Read slash command input variables
      const buyer = interaction.options.getUser('buyer');
      const item = interaction.options.getString('item');
      const info = interaction.options.getString('info');
      const payment = interaction.options.getString('payment');
      const price = interaction.options.getString('price');
      const ticketChannelId = interaction.channelId;
      const staffUser = interaction.user;

      const currentQueueNum = queueCounter++;

      await interaction.deferReply({ ephemeral: true });

      // Local Channel Embed Message
      const localEmbed = new EmbedBuilder()
        .setColor(PASTEL_BLUE)
        .setDescription(
`_ _
     \`    order  tracker  \`
~~                                                        ~~
> -# _ _ **nb & dekors**    \` \`    mto
> -# _ _  **game topups**  \` \`    mins-hrs
> -# _ _  **roblx bobaks**  \` \`    mins-days
~~                                                        ~~
> track your order [here](https://discord.com/channels/\({interaction.guildId}/\){QUEUE_CHANNEL_ID}) ! 𓆉
> no rushing! pls, be patient.
~~                                                        ~~
_ _`
        );

      await interaction.channel.send({ embeds: [localEmbed] });
      await interaction.editReply({ content: 'Queue logged successfully!' });

      // Queue Channel Embed Description Layout with injected string variables
      const queueDescription = 
`_ _
     𓂃 𓈒𓏸‪‪ 𓇼   [ **tid**__a__**l** **w**~~a~~***ves*** ](https://discord.com/channels/\({interaction.guildId}/\){ticketChannelId})  ＃ __ ${currentQueueNum} __
~~                                                                               ~~
<:blue:1554781672992407552>    ${buyer}
> \(${item}  <:hearty:1554781762813558804>\)${info}
> \(${payment}  <:hearty:1554781762813558804>\)${price}
_ _
-# _ _        sea shore  ~~        ~~  ${staffUser}
-# _ _        ${order_status} <a:loading:1554785960217022565>  ${getGMT8Time()}
~~                                                                               ~~
_ _`;

      const queueEmbed = new EmbedBuilder()
        .setColor(PASTEL_BLUE)
        .setDescription(queueDescription);

      // 3 Gray Action Buttons
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`queue_noted_\({ticketChannelId}_\){buyer.id}`).setEmoji('🐚').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`queue_proc_\({ticketChannelId}_\){buyer.id}`).setEmoji('🫧').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`queue_comp_\({ticketChannelId}_\){buyer.id}`).setEmoji('🐋').setStyle(ButtonStyle.Secondary)
      );

      const queueChannel = await client.channels.fetch(QUEUE_CHANNEL_ID);
      if (queueChannel) {
        await queueChannel.send({
          embeds: [queueEmbed],
          components: [row]
        });
      }
    }
  }

  // 2. Handle Button Status Updates
  if (interaction.isButton()) {
    const customId = interaction.customId;
    if (!customId.startsWith('queue_')) return;

    if (!interaction.member.roles.cache.has(STAFF_ROLE_ID)) {
      return interaction.reply({ content: 'Only staff can update queue status.', ephemeral: true });
    }

    const [_, action, ticketChannelId, buyerId] = customId.split('_');

    const originalEmbed = interaction.message.embeds[0];
    if (!originalEmbed || !originalEmbed.description) return;

    let statusLabel = '';
    if (action === 'noted') statusLabel = 'NOTED';
    else if (action === 'proc') statusLabel = 'PROCESSING';
    else if (action === 'comp') statusLabel = 'COMPLETED';

    // Update only the status/loading line
    const lines = originalEmbed.description.split('\n');
    const updatedLines = lines.map(line => {
      if (line.includes('')) {
        return `-# _ _        **${statusLabel}**   ${getGMT8Time()}`;
      }
      return line;
    });

    const updatedEmbed = EmbedBuilder.from(originalEmbed)
      .setColor(PASTEL_BLUE)
      .setDescription(updatedLines.join('\n'));

    // Disable only the button that was clicked
    const updatedComponents = interaction.message.components.map(row => {
      const newRow = new ActionRowBuilder();
      row.components.forEach(btn => {
        const btnBuilder = ButtonBuilder.from(btn);
        if (btn.customId === customId) {
          btnBuilder.setDisabled(true);
        }
        newRow.addComponents(btnBuilder);
      });
      return newRow;
    });

    await interaction.update({ embeds: [updatedEmbed], components: updatedComponents });

    // Send buyer completion notification in their ticket channel
    if (action === 'comp') {
      try {
        const ticketChannel = await client.channels.fetch(ticketChannelId);
        if (ticketChannel) {
          const completionEmbed = new EmbedBuilder()
            .setColor(PASTEL_BLUE)
            .setDescription(
`_ _
                    **  hey there,  coral ! **  
-#    your order has been completed. kindly vouch us 
-#    within 12 hours to activate your item's warranty !
_ _
> -# _ _        __thank you for your trust & support !__
\`            𓆝 𓆟 𓆞 𓆝 𓆟        \`
_ _`
            );

          await ticketChannel.send({ content: `<@${buyerId}>`, embeds: [completionEmbed] });
        }
      } catch (err) {
        console.error('Could not send message to ticket channel:', err);
      }
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
