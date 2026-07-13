import { getColor } from '../../../config/bot.js';
import {
ActionRowBuilder,
StringSelectMenuBuilder,
StringSelectMenuOptionBuilder,
ModalBuilder,
TextInputBuilder,
TextInputStyle,
RoleSelectMenuBuilder,
ChannelSelectMenuBuilder,
UserSelectMenuBuilder,
ButtonBuilder,
ButtonStyle,
ChannelType,
MessageFlags,
ComponentType,
EmbedBuilder,
} from 'discord.js';
import { InteractionHelper } from '../../../utils/interactionHelper.js';
import { successEmbed, infoEmbed } from '../../../utils/embeds.js';
import { logger } from '../../../utils/logger.js';
import { TitanBotError, ErrorTypes, replyUserError } from '../../../utils/errorHandler.js';
import { getGuildConfig, setGuildConfig } from '../../../services/config/guildConfig.js';
import { getGuildTicketStats } from '../../../utils/database/tickets.js';
import { getUserTicketCount } from '../../../services/ticket.js';
import {
getTicketPanelStatus,
messageHasButtonCustomId,
formatPanelStatusField,
} from '../../../utils/panelStatus.js';
import { startDashboardSession } from '../../../utils/dashboardSession.js';
function buildButtonRow(guildConfig, guildId, disabled = false, panelStatus = null) {
const dmEnabled = guildConfig.dmOnClose !== false;
const showRepost = panelStatus?.exists === false && panelStatus?.reason === 'panel_deleted';
```
const buttons = [];
if (showRepost) {
buttons.push(
new ButtonBuilder()
.setCustomId(`ticket_cfg_repost_${guildId}`)
)'اﻋﺎدة ﻧﺸﺮ اﻟﻠﻮﺣﺔ'(setLabel.
.setStyle(ButtonStyle.Primary)
.setEmoji(' ')
.setDisabled(disabled),
;)
}
buttons.push(
new ButtonBuilder()
.setCustomId(`ticket_cfg_dm_toggle_${guildId}`)
)'دي إم ﻋﻨﺪ اﻟﺴﻜﺮ'(setLabel.
.setStyle(dmEnabled ? ButtonStyle.Success : ButtonStyle.Danger)
.setEmoji(dmEnabled ? ' ' : ' ')
.setDisabled(disabled),
new ButtonBuilder()
.setCustomId(`ticket_cfg_staff_role_btn_${guildId}`)
)'رول اﻟﺴﺘﺎف'(setLabel.
.setStyle(ButtonStyle.Secondary)
.setEmoji(' ')
.setDisabled(disabled),
new ButtonBuilder()
.setCustomId(`ticket_cfg_delete_${guildId}`)
)'ﺣﺬف اﻟﻨﻈﺎم'(setLabel.
.setStyle(ButtonStyle.Danger)
.setEmoji(' ')
.setDisabled(disabled),
;)
return new ActionRowBuilder().addComponents(buttons);
```
}
async function persistPanelMessageId(client, guildId, guildConfig, messageId) {
if (!messageId || guildConfig.ticketPanelMessageId === messageId) return;
guildConfig.ticketPanelMessageId = messageId;
if (client.db) {
await setGuildConfig(client, guildId, guildConfig);
}
}
function buildPanelEmbed(config) {
return new EmbedBuilder()
)'ﺗﺬاﻛﺮ اﻟﺪﻋﻢ'(setTitle.
)'.اﺿﻐﻂ اﻟﺰر ﺗﺤﺖ ﺣﺘﻰ ﺗﻔﺘﺢ ﺗﺬﻛﺮة دﻋﻢ' || setDescription(config.ticketPanelMessage.
.setColor(getColor('info'));
}
function buildPanelButtonRow(config) {
return new ActionRowBuilder().addComponents(
new ButtonBuilder()
.setCustomId('create_ticket')
)'ﻓﺘﺢ ﺗﺬﻛﺮة' || setLabel(config.ticketButtonLabel.
.setStyle(ButtonStyle.Primary)
.setEmoji(' '),
;)
}
async function repostTicketPanel(client, guild, guildConfig, guildId) {
const channel = await guild.channels.fetch(guildConfig.ticketPanelChannelId).catch(() => null
if (!channel) {
throw new TitanBotError(
'Panel channel missing',
ErrorTypes.CONFIGURATION,
,'.ﭼﺎﻧﻞ اﻟﻠﻮﺣﺔ اﻟﻤﺤﺪد ﻣﺎﻛﻮ ﻣﻮﺟﻮد ھﺴﮫ. اﺧﺘﺎر ﭼﺎﻧﻞ ﺟﺪﯾﺪ ﻣﻦ اﻟﺪاﺷﺒﻮرد'
;)
}
```
const sentPanel = await channel.send({
embeds: [buildPanelEmbed(guildConfig)],
components: [buildPanelButtonRow(guildConfig)],
;)}
await persistPanelMessageId(client, guildId, guildConfig, sentPanel.id);
return sentPanel;
```
}
function formatCloseDuration(ms) {
;'`ﻏﯿﺮ ﻣﺘﻮﻓﺮ`' if (ms == null) return
const hours = Math.floor(ms / 3_600_000);
const minutes = Math.floor((ms % 3_600_000) / 60_000);
if (hours > 0) return `${hours}h ${minutes}m`;
return `${minutes}m`;
}
function buildDashboardEmbed(config, guild, panelStatus = null, ticketStats = null) {
ﺪد`' : `>}const panelChannel = config.ticketPanelChannelId ? `<#${config.ticketPanelChannelId
`ﻣﺎﻛﻮ ﻣﺤﺪد`' : `>}const staffRole = config.ticketStaffRoleId ? `<@&${config.ticketStaffRoleId
const ticketLogsChannel = config.ticketLogsChannelId ? `<#${config.ticketLogsChannelId}>` : '
const transcriptChannel = config.ticketTranscriptChannelId ? `<#${config.ticketTranscriptChan
```
const openCategoryChannel = config.ticketCategoryId ? guild.channels.cache.get(config.ticketC
;'`ﻣﺎﻛﻮ ﻣﺤﺪد`' : )(const openCategory = openCategoryChannel ? openCategoryChannel.toString
const closedCategoryChannel = config.ticketClosedCategoryId ? guild.channels.cache.get(config
ﻣﺎﻛﻮ ﻣﺤﺪد`' : )(const closedCategory = closedCategoryChannel ? closedCategoryChannel.toString
;'.اﺿﻐﻂ اﻟﺰر ﺗﺤﺖ ﺣﺘﻰ ﺗﻔﺘﺢ ﺗﺬﻛﺮة دﻋﻢ' || const rawMsg = config.ticketPanelMessage
const panelMsg = `\`${rawMsg.length > 60 ? rawMsg.substring(0, 60) + '…' : rawMsg}\``;
;``\}'ﻓﺘﺢ ﺗﺬﻛﺮة' || const btnLabel = `\`${config.ticketButtonLabel
let panelStatusValue = formatPanelStatusField(panelStatus);
const openTickets = ticketStats ? String(ticketStats.openCount) : '`—`';
const avgCloseTime = ticketStats ? formatCloseDuration(ticketStats.avgCloseTimeMs) : '`—`';
const feedbackSummary = ticketStats?.feedbackCount
? `${ticketStats.avgRating}/5 (${ticketStats.feedbackCount} ﺗﻘﯿﯿﻢ${ticketStats.feedbackCo
;'`ﻣﺎﻛﻮ ﺗﻘﯿﯿﻤﺎت ﻟﮭﺴﮫ`' :
return new EmbedBuilder()
)'داﺷﺒﻮرد ﻧﻈﺎم اﻟﺘﺬاﻛﺮ '(setTitle.
ﺗﺤﺖ ﺷﻨﻮ ﺗﺮﯾﺪ ﺗﻌﺪلguild.name}**.\n{$** ﺳﻮي إدارة ﻹﻋﺪادات ﻧﻈﺎم اﻟﺘﺬاﻛﺮ ﺑـ`(setDescription.
.setColor(getColor('info'))
.addFields(
{ name: 'ﺣﺎﻟﺔ اﻟﻠﻮﺣﺔ', value: panelStatusValue, inline: false },
{ name: 'ﭼﺎﻧﻞ اﻟﻠﻮﺣﺔ', value: panelChannel, inline: true },
{ name: 'رول اﻟﺴﺘﺎف', value: staffRole, inline: true },
{ name: '\u200B', value: '\u200B', inline: true },
{ name: 'ﻛﺎﺗﯿﻜﻮري اﻟﺘﺬاﻛﺮ اﻟﻤﻔﺘﻮﺣﺔ', value: openCategory, inline: true },
{ name: 'ﻛﺎﺗﯿﻜﻮري اﻟﺘﺬاﻛﺮ اﻟﻤﺴﻜﺮة', value: closedCategory, inline: true },
{ name: '\u200B', value: '\u200B', inline: true },
{ name: 'رﺳﺎﻟﺔ اﻟﻠﻮﺣﺔ', value: panelMsg, inline: false },
{ name: 'ﻧﺺ اﻟﺰر', value: btnLabel, inline: true },
{ name: 'أﻋﻠﻰ ﺗﺬاﻛﺮ ﻟﻜﻞ ﺷﺨﺺ', value: String(config.maxTicketsPerUser || 3), inline: t
ﻣﻮﻗﻒ' ? value: config.dmOnClose !== false ,'دي إم ﻋﻨﺪ اﻟﺴﻜﺮ' :name {
ّﻞ' : '
inlin ,'ﻣﻔﻌ
{ name: 'ﭼﺎﻧﻞ ﻟﻮﮔﺎت اﻟﺘﺬاﻛﺮ', value: ticketLogsChannel, inline: true },
{ name: 'ﭼﺎﻧﻞ اﻟﺘﺮاﻧﺴﻜﺮﺑﺖ', value: transcriptChannel, inline: true },
{ name: '\u200B', value: '\u200B', inline: true },
{ name: 'اﻟﺘﺬاﻛﺮ اﻟﻤﻔﺘﻮﺣﺔ', value: openTickets, inline: true },
{ name: 'ﻣﺘﻮﺳﻂ وﻗﺖ اﻟﺴﻜﺮ', value: avgCloseTime, inline: true },
{ name: 'ﺗﻘﯿﯿﻢ اﻟﻔﯿﺪﺑﺎك', value: feedbackSummary, inline: true },
)
)} 'اﺧﺘﺎر ﻣﻦ ﺗﺤﺖ • اﻟﺪاﺷﺒﻮرد ﯾﺴﻜﺮ ﻟﺤﺎﻟﮫ ﺑﻌﺪ 10 دﻗﺎﯾﻖ ﺑﺪون ﺣﺮﻛﺔ' :setFooter({ text.
.setTimestamp();
```
}
function buildSelectMenu(guildId) {
return new StringSelectMenuBuilder()
.setCustomId(`ticket_config_${guildId}`)
)'…اﺧﺘﺎر ﺷﻨﻮ ﺗﺮﯾﺪ ﺗﻌﺪل'(setPlaceholder.
.addOptions(
new StringSelectMenuOptionBuilder()
)'ﻋﺪل رﺳﺎﻟﺔ اﻟﻠﻮﺣﺔ'(setLabel.
)'ﻏﯿﺮ اﻟﺮﺳﺎﻟﺔ اﻟﻤﻌﺮوﺿﺔ ﺑﻠﻮﺣﺔ إﻧﺸﺎء اﻟﺘﺬاﻛﺮ'(setDescription.
.setValue('panel_message')
.setEmoji(' '),
new StringSelectMenuOptionBuilder()
)'ﻋﺪل ﻧﺺ اﻟﺰر'(setLabel.
)'ﻏﯿﺮ اﻟﻨﺺ اﻟﻤﻜﺘﻮب ﻋﻠﻰ زر ﻓﺘﺢ ﺗﺬﻛﺮة'(setDescription.
.setValue('button_label')
.setEmoji(' '),
new StringSelectMenuOptionBuilder()
)'ﻏﯿﺮ ﻛﺎﺗﯿﻜﻮري اﻟﺘﺬاﻛﺮ اﻟﻤﻔﺘﻮﺣﺔ'(setLabel.
)'اﻟﻜﺎﺗﯿﻜﻮري اﻟﻠﻲ ﺗﺘﻮﻟﺪ ﺑﯿﮫ اﻟﺘﺬاﻛﺮ اﻟﺠﺪﯾﺪة'(setDescription.
.setValue('open_category')
.setEmoji(' '),
new StringSelectMenuOptionBuilder()
)'ﻏﯿﺮ ﻛﺎﺗﯿﻜﻮري اﻟﺘﺬاﻛﺮ اﻟﻤﺴﻜﺮة'(setLabel.
)'اﻟﻜﺎﺗﯿﻜﻮري اﻟﻠﻲ ﺗﻨﻜﻞ ﻟﯿﮫ اﻟﺘﺬاﻛﺮ اﻟﻤﺴﻜﺮة'(setDescription.
.setValue('closed_category')
.setEmoji(' '),
new StringSelectMenuOptionBuilder()
)'ﺣﺪد أﻋﻠﻰ ﺗﺬاﻛﺮ ﻟﻜﻞ ﺷﺨﺺ'(setLabel.
)'ﺣﺪد أﻋﻠﻰ ﻋﺪد ﺗﺬاﻛﺮ ﻣﻔﺘﻮﺣﺔ ﯾﻜﺪر ﯾﺴﻮﯾﮭﺎ ﺷﺨﺺ وﺣﺪ ﺑﻨﻔﺲ اﻟﻮﻛﺖ'(setDescription.
.setValue('max_tickets')
.setEmoji(' '),
new StringSelectMenuOptionBuilder()
)'ﺣﺪد ﭼﺎﻧﻞ ﻟﻮﮔﺎت اﻟﺘﺬاﻛﺮ'(setLabel.
)'اﻟﭽﺎﻧﻞ اﻟﻠﻲ ﯾﺴﺘﻘﺒﻞ اﻟﻔﯿﺪﺑﺎك، أﺣﺪاث اﻟﺘﺬاﻛﺮ، واﻟﻠﻮﮔﺎت'(setDescription.
.setValue('logs_channel')
.setEmoji(' '),
new StringSelectMenuOptionBuilder()
)'ﺣﺪد ﭼﺎﻧﻞ اﻟﺘﺮاﻧﺴﻜﺮﺑﺖ'(setLabel.
)'اﻟﭽﺎﻧﻞ اﻟﻠﻲ ﯾﺴﺘﻘﺒﻞ اﻟﺘﺮاﻧﺴﻜﺮﺑﺖ اﻟﺘﻠﻘﺎﺋﻲ ﻋﻨﺪ ﺣﺬف اﻟﺘﺬﻛﺮة'(setDescription.
.setValue('transcript_channel')
.setEmoji(' '),
;)
}
async function refreshDashboard(rootInteraction, guildConfig, guildId, client) {
const panelStatus = client
? await getTicketPanelStatus(client, rootInteraction.guild, guildConfig)
: null;
const ticketStats = client ? await getGuildTicketStats(guildId) : null;
```
if (panelStatus?.recoveredId) {
await persistPanelMessageId(client, guildId, guildConfig, panelStatus.recoveredId);
}
const buttonRow = buildButtonRow(guildConfig, guildId, false, panelStatus);
const selectRow = new ActionRowBuilder().addComponents(buildSelectMenu(guildId));
await InteractionHelper.safeEditReply(rootInteraction, {
embeds: [buildDashboardEmbed(guildConfig, rootInteraction.guild, panelStatus, ticketStats
components: [buttonRow, selectRow],
}).catch(() => {});
```
}
async function updateLivePanel(client, guild, config, guildId) {
if (!config.ticketPanelChannelId) return false;
try {
const panelStatus = await getTicketPanelStatus(client, guild, config);
if (panelStatus.recoveredId) {
await persistPanelMessageId(client, guildId, config, panelStatus.recoveredId);
}
if (!panelStatus.exists || !panelStatus.message) return false;
```
await panelStatus.message.edit({
embeds: [buildPanelEmbed(config)],
components: [buildPanelButtonRow(config)],
});
return true;
} catch (error) {
logger.warn('Failed to update live ticket panel:', error.message);
return false;
}
```
}
export default {
prefixOnly: false,
async execute(interaction, config, client) {
try {
const guildId = interaction.guild.id;
const guildConfig = await getGuildConfig(client, guildId);
```
if (!guildConfig.ticketPanelChannelId) {
throw new TitanBotError(
'Ticket system not configured',
ErrorTypes.CONFIGURATION,
,'.أول ﺷﻲ ﺣﺘﻰ ﺗﻌﺪﻟﮫ `\ticket setup/`\ ﻧﻈﺎم اﻟﺘﺬاﻛﺮ ﻣﺎﺳﻮاه أﺣﺪ ﻟﮭﺴﮫ. ﺷﻐﻞ'
;)
}
const panelStatus = await getTicketPanelStatus(client, interaction.guild, guildConfig
if (panelStatus.recoveredId) {
await persistPanelMessageId(client, guildId, guildConfig, panelStatus.recoveredId
}
const ticketStats = await getGuildTicketStats(guildId);
const selectRow = new ActionRowBuilder().addComponents(buildSelectMenu(guildId));
const buttonRow = buildButtonRow(guildConfig, guildId, false, panelStatus);
await startDashboardSession({
interaction,
embeds: [buildDashboardEmbed(guildConfig, interaction.guild, panelStatus, ticketS
components: [buttonRow, selectRow],
selectMenuId: `ticket_config_${guildId}`,
buttonMatcher: (customId) =>
customId === `ticket_cfg_repost_${guildId}` ||
customId === `ticket_cfg_dm_toggle_${guildId}` ||
customId === `ticket_cfg_staff_role_btn_${guildId}` ||
customId === `ticket_cfg_delete_${guildId}`,
onSelect: async (selectInteraction) => {
const selectedOption = selectInteraction.values[0];
switch (selectedOption) {
case 'panel_message':
await handlePanelMessage(selectInteraction, interaction, guildConfig,
break;
case 'button_label':
await handleButtonLabel(selectInteraction, interaction, guildConfig,
break;
case 'staff_role':
await handleStaffRole(selectInteraction, interaction, guildConfig, gu
break;
case 'open_category':
await handleOpenCategory(selectInteraction, interaction, guildConfig,
break;
case 'closed_category':
await handleClosedCategory(selectInteraction, interaction, guildConfi
break;
case 'max_tickets':
await handleMaxTickets(selectInteraction, interaction, guildConfig, g
break;
case 'logs_channel':
await handleLogsChannel(selectInteraction, interaction, guildConfig,
break;
case 'transcript_channel':
await handleTranscriptChannel(selectInteraction, interaction, guildCo
break;
}
,}
onButton: async (btnInteraction) => {
if (btnInteraction.customId === `ticket_cfg_repost_${guildId}`) {
await handleRepostPanel(btnInteraction, interaction, guildConfig, guildId
} else if (btnInteraction.customId === `ticket_cfg_dm_toggle_${guildId}`) {
await handleDmOnClose(btnInteraction, interaction, guildConfig, guildId,
} else if (btnInteraction.customId === `ticket_cfg_staff_role_btn_${guildId}`
await handleStaffRole(btnInteraction, interaction, guildConfig, guildId,
} else if (btnInteraction.customId === `ticket_cfg_delete_${guildId}`) {
await handleDeleteSystem(btnInteraction, interaction, guildConfig, guildI
}
,}
;)}
} catch (error) {
if (error instanceof TitanBotError) throw error;
logger.error('Unexpected error in ticket_config:', error);
throw new TitanBotError(
`Ticket config failed: ${error.message}`,
ErrorTypes.UNKNOWN,
,' ﻣﺎ ﻛﺪرﻧﺎ ﻧﻔﺘﺢ داﺷﺒﻮرد إﻋﺪادات اﻟﺘﺬاﻛﺮ'
;)
}
,}
```
;}
async function handlePanelMessage(selectInteraction, rootInteraction, guildConfig, guildId, c
const modal = new ModalBuilder()
.setCustomId('ticket_cfg_panel_msg')
)'ﻋﺪل رﺳﺎﻟﺔ اﻟﻠﻮﺣﺔ '(setTitle.
.addComponents(
new ActionRowBuilder().addComponents(
new TextInputBuilder()
.setCustomId('panel_msg_input')
)'رﺳﺎﻟﺔ اﻟﻠﻮﺣﺔ'(setLabel.
.setStyle(TextInputStyle.Paragraph)
.setValue(
guildConfig.ticketPanelMessage ||
,'.اﺿﻐﻂ اﻟﺰر ﺗﺤﺖ ﺣﺘﻰ ﺗﻔﺘﺢ ﺗﺬﻛﺮة دﻋﻢ'
)
.setMaxLength(2000)
.setMinLength(1)
.setRequired(true)
,)'.اﺿﻐﻂ اﻟﺰر ﺗﺤﺖ ﺣﺘﻰ ﺗﻔﺘﺢ ﺗﺬﻛﺮة دﻋﻢ'(setPlaceholder.
,)
;)
```
await selectInteraction.showModal(modal);
const submitted = await selectInteraction
.awaitModalSubmit({
filter: i =>
time: 120_000,
i.customId === 'ticket_cfg_panel_msg' && i.user.id === selectInteraction.user.id,
)}
.catch(() => null);
if (!submitted) return;
const newMessage = submitted.fields.getTextInputValue('panel_msg_input').trim();
guildConfig.ticketPanelMessage = newMessage;
await setGuildConfig(client, guildId, guildConfig);
const panelUpdated = await updateLivePanel(client, rootInteraction.guild, guildConfig, guildI
await submitted.reply({
embeds: [
successEmbed(
,'رﺳﺎﻟﺔ اﻟﻠﻮﺣﺔ ﺗﺤﺪﺛﺖ '
{$.رﺳﺎﻟﺔ اﻟﻠﻮﺣﺔ ﺻﺎرت ﻣﺤﺪﺛﺔ`
panelUpdated
'.اﻟﻠﻮﺣﺔ اﻟﺤﯿﺔ ﺑﺎﻟﭽﺎﻧﻞ ﺗﺤﺪﺛﺖ ھﻲ اﻟﺜﺎﻧﯿﺔn\' ?
ﻟﻠﻮﺣﺔ اﻟﺤﯿﺔ. اﺳﺘﺨﺪم **اﻋﺎدة ﻧﺸﺮ اﻟﻠﻮﺣﺔ** ﻣﻦ اﻟﺪاﺷﺒﻮرد ﺣﺘﻰ ﺗﺮﺟﻌﮭﺎ** >n\' :
,`}
,)
,]
flags: MessageFlags.Ephemeral,
;)}
await refreshDashboard(rootInteraction, guildConfig, guildId, client);
```
}
async function handleButtonLabel(selectInteraction, rootInteraction, guildConfig, guildId, cl
const modal = new ModalBuilder()
.setCustomId('ticket_cfg_btn_label')
)'ﻋﺪل ﻧﺺ اﻟﺰر '(setTitle.
.addComponents(
new ActionRowBuilder().addComponents(
new TextInputBuilder()
.setCustomId('btn_label_input')
)'ﻧﺺ اﻟﺰر )أﻋﻠﻰ 80 ﺣﺮف('(setLabel.
.setStyle(TextInputStyle.Short)
)'ﻓﺘﺢ ﺗﺬﻛﺮة' || setValue(guildConfig.ticketButtonLabel.
.setMaxLength(80)
.setMinLength(1)
.setRequired(true)
,)'ﻓﺘﺢ ﺗﺬﻛﺮة'(setPlaceholder.
,)
;)
```
await selectInteraction.showModal(modal);
const submitted = await selectInteraction
.awaitModalSubmit({
filter: i =>
time: 120_000,
i.customId === 'ticket_cfg_btn_label' && i.user.id === selectInteraction.user.id,
)}
.catch(() => null);
if (!submitted) return;
const newLabel = submitted.fields.getTextInputValue('btn_label_input').trim();
guildConfig.ticketButtonLabel = newLabel;
await setGuildConfig(client, guildId, guildConfig);
const panelUpdated = await updateLivePanel(client, rootInteraction.guild, guildConfig, guildI
await submitted.reply({
embeds: [
successEmbed(
,'ﻧﺺ اﻟﺰر ﺗﺤﺪث '
{$.`\}newLabel{$`\ ﻧﺺ اﻟﺰر ﺻﺎر`
panelUpdated
'.زر اﻟﻠﻮﺣﺔ اﻟﺤﯿﺔ ﺗﺤﺪث ھﻮ اﻟﺜﺎﻧﻲn\' ?
ﻟﻠﻮﺣﺔ اﻟﺤﯿﺔ. اﺳﺘﺨﺪم **اﻋﺎدة ﻧﺸﺮ اﻟﻠﻮﺣﺔ** ﻣﻦ اﻟﺪاﺷﺒﻮرد ﺣﺘﻰ ﺗﺮﺟﻌﮭﺎ** >n\' :
,`}
,)
,]
flags: MessageFlags.Ephemeral,
;)}
await refreshDashboard(rootInteraction, guildConfig, guildId, client);
```
}
async function handleStaffRole(selectInteraction, rootInteraction, guildConfig, guildId, clie
await selectInteraction.deferUpdate();
```
const roleSelect = new RoleSelectMenuBuilder()
.setCustomId('ticket_cfg_staff_role')
)'...اﺧﺘﺎر رول اﻟﺴﺘﺎف'(setPlaceholder.
.setMaxValues(1);
const row = new ActionRowBuilder().addComponents(roleSelect);
await selectInteraction.followUp({
embeds: [
new EmbedBuilder()
)'ﻏﯿﺮ رول اﻟﺴﺘﺎف '(setTitle.
.setDescription(
guildConfig.ticketStaffRoleId ? `<@&${guildConfig.ticketStaffR{$ **:اﻟﺤﺎﻟﻲ**`
)
.setColor(getColor('info')),
,]
components: [row],
flags: MessageFlags.Ephemeral,
;)}
const roleCollector = rootInteraction.channel.createMessageComponentCollector({
componentType: ComponentType.RoleSelect,
filter: i =>
i.user.id === selectInteraction.user.id && i.customId === 'ticket_cfg_staff_role',
time: 60_000,
max: 1,
;)}
roleCollector.on('collect', async roleInteraction => {
await roleInteraction.deferUpdate();
const role = roleInteraction.roles.first();
guildConfig.ticketStaffRoleId = role.id;
await setGuildConfig(client, guildId, guildConfig);
await roleInteraction.followUp({
embeds: [successEmbed('رول اﻟﺴﺘﺎف ﺗﺤﺪث', `رول اﻟﺴﺘﺎف ﺻﺎر ${role}.`)],
flags: MessageFlags.Ephemeral,
;)}
await refreshDashboard(rootInteraction, guildConfig, guildId, client);
;)}
roleCollector.on('end', (collected, reason) => {
if (reason === 'time' && collected.size === 0) {
replyUserError(selectInteraction, {
type: ErrorTypes.RATE_LIMIT,
,'.ﻣﺎ اﺧﺘﺮت اي رول. رول اﻟﺴﺘﺎف ﻣﺎ ﺗﻐﯿﺮ' :message
}).catch(() => {});
}
;)}
```
}
async function handleOpenCategory(selectInteraction, rootInteraction, guildConfig, guildId, c
await selectInteraction.deferUpdate();
```
const channelSelect = new ChannelSelectMenuBuilder()
.setCustomId('ticket_cfg_open_cat')
)'...اﺧﺘﺎر ﻛﺎﺗﯿﻜﻮري'(setPlaceholder.
.addChannelTypes(ChannelType.GuildCategory)
.setMaxValues(1);
await selectInteraction.followUp({
embeds: [
new EmbedBuilder()
)'ﻏﯿﺮ ﻛﺎﺗﯿﻜﻮري اﻟﺘﺬاﻛﺮ اﻟﻤﻔﺘﻮﺣﺔ '(setTitle.
.setDescription(
guildConfig.ticketCategoryId ? `<#${guildConfig.ticketCategory{$ **:اﻟﺤﺎﻟﻲ**`
)
.setColor(getColor('info')),
,]
components: [new ActionRowBuilder().addComponents(channelSelect)],
flags: MessageFlags.Ephemeral,
;)}
const catCollector = rootInteraction.channel.createMessageComponentCollector({
componentType: ComponentType.ChannelSelect,
filter: i =>
i.user.id === selectInteraction.user.id && i.customId === 'ticket_cfg_open_cat',
time: 60_000,
max: 1,
;)}
catCollector.on('collect', async catInteraction => {
await catInteraction.deferUpdate();
const category = catInteraction.channels.first();
guildConfig.ticketCategoryId = category.id;
await setGuildConfig(client, guildId, guildConfig);
await catInteraction.followUp({
embeds: [
successEmbed(
,'ﻛﺎﺗﯿﻜﻮري اﻟﺘﺬاﻛﺮ اﻟﻤﻔﺘﻮﺣﺔ ﺗﺤﺪث'
,`.**}category.name{$** اﻟﺘﺬاﻛﺮ اﻟﺠﺪﯾﺪة ھﺴﮫ راح ﺗﺘﻮﻟﺪ ﺑـ`
,)
,]
flags: MessageFlags.Ephemeral,
;)}
await refreshDashboard(rootInteraction, guildConfig, guildId, client);
;)}
catCollector.on('end', (collected, reason) => {
if (reason === 'time' && collected.size === 0) {
replyUserError(selectInteraction, {
type: ErrorTypes.RATE_LIMIT,
,'.ﻣﺎ اﺧﺘﺮت اي ﻛﺎﺗﯿﻜﻮري. اﻹﻋﺪاد ﻣﺎ ﺗﻐﯿﺮ' :message
}).catch(() => {});
}
;)}
```
async function handleClosedCategory(selectInteraction, rootInteraction, guildConfig, guildId,
await selectInteraction.deferUpdate();
}
```
const channelSelect = new ChannelSelectMenuBuilder()
.setCustomId('ticket_cfg_closed_cat')
)'...اﺧﺘﺎر ﻛﺎﺗﯿﻜﻮري'(setPlaceholder.
.addChannelTypes(ChannelType.GuildCategory)
.setMaxValues(1);
await selectInteraction.followUp({
embeds: [
new EmbedBuilder()
)'ﻏﯿﺮ ﻛﺎﺗﯿﻜﻮري اﻟﺘﺬاﻛﺮ اﻟﻤﺴﻜﺮة '(setTitle.
.setDescription(
guildConfig.ticketClosedCategoryId ? `<#${guildConfig.ticketCl{$ **:اﻟﺤﺎﻟﻲ**`
)
.setColor(getColor('info')),
,]
components: [new ActionRowBuilder().addComponents(channelSelect)],
flags: MessageFlags.Ephemeral,
;)}
const catCollector = rootInteraction.channel.createMessageComponentCollector({
componentType: ComponentType.ChannelSelect,
filter: i =>
i.user.id === selectInteraction.user.id && i.customId === 'ticket_cfg_closed_cat',
time: 60_000,
max: 1,
;)}
catCollector.on('collect', async catInteraction => {
await catInteraction.deferUpdate();
const category = catInteraction.channels.first();
guildConfig.ticketClosedCategoryId = category.id;
await setGuildConfig(client, guildId, guildConfig);
await catInteraction.followUp({
embeds: [
successEmbed(
,'ﻛﺎﺗﯿﻜﻮري اﻟﺘﺬاﻛﺮ اﻟﻤﺴﻜﺮة ﺗﺤﺪث'
,`.**}category.name{$** اﻟﺘﺬاﻛﺮ اﻟﻤﺴﻜﺮة ھﺴﮫ راح ﺗﻨﻜﻞ ﻟـ`
,)
,]
flags: MessageFlags.Ephemeral,
;)}
await refreshDashboard(rootInteraction, guildConfig, guildId, client);
;)}
catCollector.on('end', (collected, reason) => {
if (reason === 'time' && collected.size === 0) {
replyUserError(selectInteraction, {
type: ErrorTypes.RATE_LIMIT,
,'.ﻣﺎ اﺧﺘﺮت اي ﻛﺎﺗﯿﻜﻮري. اﻹﻋﺪاد ﻣﺎ ﺗﻐﯿﺮ' :message
}).catch(() => {});
}
;)}
```
}
async function handleMaxTickets(selectInteraction, rootInteraction, guildConfig, guildId, cli
const modal = new ModalBuilder()
.setCustomId('ticket_cfg_max_tickets')
)'ﺣﺪد أﻋﻠﻰ ﺗﺬاﻛﺮ ﻟﻜﻞ ﺷﺨﺺ'(setTitle.
.addComponents(
new ActionRowBuilder().addComponents(
new TextInputBuilder()
.setCustomId('max_tickets_input')
)'أﻋﻠﻰ ﺗﺬاﻛﺮ ﻣﻔﺘﻮﺣﺔ )1–10('(setLabel.
.setStyle(TextInputStyle.Short)
.setValue(String(guildConfig.maxTicketsPerUser || 3))
.setMaxLength(2)
.setMinLength(1)
.setRequired(true)
.setPlaceholder('3'),
,)
;)
```
await selectInteraction.showModal(modal);
const submitted = await selectInteraction
.awaitModalSubmit({
filter: i =>
time: 120_000,
i.customId === 'ticket_cfg_max_tickets' && i.user.id === selectInteraction.user.i
)}
.catch(() => null);
if (!submitted) return;
const raw = submitted.fields.getTextInputValue('max_tickets_input').trim();
const newMax = parseInt(raw, 10);
if (Number.isNaN(newMax) || newMax < 1 || newMax > 10) {
await replyUserError(submitted, {
type: ErrorTypes.VALIDATION,
,'.**ﻻزم ﯾﻜﻮن اﻟﺮﻗﻢ ﺻﺤﯿﺢ وﺑﯿﻦ **1** و **10' :message
;)}
return;
}
guildConfig.maxTicketsPerUser = newMax;
await setGuildConfig(client, guildId, guildConfig);
await submitted.reply({
embeds: [
successEmbed(
,'أﻋﻠﻰ ﺗﺬاﻛﺮ ﺗﺤﺪث'
,`.ﺗﺬﻛﺮة ﻣﻔﺘﻮﺣﺔ ﺑﻨﻔﺲ اﻟﻮﻛﺖ **}newMax{$** ھﺴﮫ ﻛﻞ ﺷﺨﺺ ﯾﻜﺪر ﯾﻜﻮن ﻋﻨﺪه أﻋﻠﻰ`
,)
,]
flags: MessageFlags.Ephemeral,
;)}
await refreshDashboard(rootInteraction, guildConfig, guildId, client);
```
}
async function handleDmOnClose(btnInteraction, rootInteraction, guildConfig, guildId, client)
await btnInteraction.deferUpdate();
```
const newState = guildConfig.dmOnClose === false;
guildConfig.dmOnClose = newState;
await setGuildConfig(client, guildId, guildConfig);
await btnInteraction.followUp({
embeds: [
successEmbed(
,'دي إم ﻋﻨﺪ اﻟﺴﻜﺮ ﺗﺤﺪث'
ﻤﻦ ﺗﻨﺴﻜﺮ ﺗﺬﻛﺮﺗﮭﻢ **}'راح ﯾﻮﺻﻠﮭﻢ' : 'ﻣﺎ راح ﯾﻮﺻﻠﮭﻢ' ? newState{$** اﻟﻤﺴﺘﺨﺪﻣﯿﻦ ھﺴﮫ`
,)
,]
flags: MessageFlags.Ephemeral,
;)}
await refreshDashboard(rootInteraction, guildConfig, guildId, client);
```
}
async function handleLogsChannel(selectInteraction, rootInteraction, guildConfig, guildId, cl
await selectInteraction.deferUpdate();
```
const channelSelect = new ChannelSelectMenuBuilder()
.setCustomId('ticket_cfg_logs_channel')
)'...اﺧﺘﺎر ﭼﺎﻧﻞ'(setPlaceholder.
.addChannelTypes(ChannelType.GuildText)
.setMaxValues(1);
await selectInteraction.followUp({
embeds: [
new EmbedBuilder()
)'اﺧﺘﺎر ﭼﺎﻧﻞ ﻟﻮﮔﺎت اﻟﺘﺬاﻛﺮ '(setTitle.
اﻟﻔﯿﺪﺑﺎك، أﺣﺪاث اﻟﺘﺬاﻛﺮ )ﻓﺘﺢ، ﺳﻜﺮ، ﻛﻠﯿﻢ، وﻏﯿﺮھﺎ(، واﻟﻠﻮﮔﺎت ﺗﻨﺮﺳﻞ'(setDescription.
.setColor(getColor('info')),
,]
components: [new ActionRowBuilder().addComponents(channelSelect)],
flags: MessageFlags.Ephemeral,
;)}
const collector = rootInteraction.channel.createMessageComponentCollector({
componentType: ComponentType.ChannelSelect,
filter: i => i.user.id === selectInteraction.user.id && i.customId === 'ticket_cfg_logs_c
time: 60_000,
max: 1,
;)}
collector.on('collect', async channelInteraction => {
await channelInteraction.deferUpdate();
const channel = channelInteraction.channels.first();
guildConfig.ticketLogsChannelId = channel.id;
await setGuildConfig(client, guildId, guildConfig);
await channelInteraction.followUp({
embeds: [successEmbed('ﭼﺎﻧﻞ اﻟﻠﻮﮔﺎت ﺗﺤﺪث', `ﻟﻮﮔﺎت اﻟﺘﺬاﻛﺮ راح ﺗﻨﺮﺳﻞ ﻟـ ${channel}`)],
flags: MessageFlags.Ephemeral,
;)}
await refreshDashboard(rootInteraction, guildConfig, guildId, client);
;)}
collector.on('end', (collected, reason) => {
if (reason === 'time' && collected.size === 0) {
replyUserError(selectInteraction, {
type: ErrorTypes.RATE_LIMIT,
,'.ﻣﺎ اﺧﺘﺮت اي ﭼﺎﻧﻞ. ﻣﺎ ﺻﺎر اي ﺗﻐﯿﯿﺮ' :message
}).catch(() => {});
}
;)}
```
}
async function handleTranscriptChannel(selectInteraction, rootInteraction, guildConfig, guild
await selectInteraction.deferUpdate();
```
const channelSelect = new ChannelSelectMenuBuilder()
.setCustomId('ticket_cfg_transcript_channel')
)'...اﺧﺘﺎر ﭼﺎﻧﻞ'(setPlaceholder.
.addChannelTypes(ChannelType.GuildText)
.setMaxValues(1);
await selectInteraction.followUp({
embeds: [
new EmbedBuilder()
)'اﺧﺘﺎر ﭼﺎﻧﻞ اﻟﺘﺮاﻧﺴﻜﺮﺑﺖ '(setTitle.
)'.اﺧﺘﺎر وﯾﻦ ﺗﺮﯾﺪ اﻟﺘﺮاﻧﺴﻜﺮﺑﺖ اﻟﺘﻠﻘﺎﺋﻲ ﯾﻨﺮﺳﻞ ﻟﻤﻦ ﺗﻨﺤﺬف اﻟﺘﺬﻛﺮة'(setDescription.
.setColor(getColor('info'))
,]
components: [new ActionRowBuilder().addComponents(channelSelect)],
flags: MessageFlags.Ephemeral
;)}
const collector = rootInteraction.channel.createMessageComponentCollector({
componentType: ComponentType.ChannelSelect,
filter: i => i.user.id === selectInteraction.user.id && i.customId === 'ticket_cfg_transc
time: 60_000,
max: 1
;)}
collector.on('collect', async channelInteraction => {
await channelInteraction.deferUpdate();
const channel = channelInteraction.channels.first();
guildConfig.ticketTranscriptChannelId = channel.id;
await setGuildConfig(client, guildId, guildConfig);
await channelInteraction.followUp({
embeds: [successEmbed('ﭼﺎﻧﻞ اﻟﺘﺮاﻧﺴﻜﺮﺑﺖ ﺗﺤﺪث', `اﻟﺘﺮاﻧﺴﻜﺮﺑﺘﺎت راح ﺗﻨﺮﺳﻞ ﻟـ ${channel}
flags: MessageFlags.Ephemeral
;)}
await refreshDashboard(rootInteraction, guildConfig, guildId, client);
;)}
collector.on('end', (collected, reason) => {
if (reason === 'time' && collected.size === 0) {
replyUserError(selectInteraction, {
type: ErrorTypes.RATE_LIMIT,
,'.ﻣﺎ اﺧﺘﺮت اي ﭼﺎﻧﻞ. ﻣﺎ ﺻﺎر اي ﺗﻐﯿﯿﺮ' :message
}).catch(() => {});
}
;)}
```
}
async function handleCheckUser(selectInteraction, rootInteraction, guildConfig, guildId, clie
await selectInteraction.deferUpdate();
```
const userSelect = new UserSelectMenuBuilder()
.setCustomId('ticket_cfg_check_user')
)'...اﺧﺘﺎر ﻣﺴﺘﺨﺪم ﺣﺘﻰ ﺗﺘﺎﻛﺪ'(setPlaceholder.
.setMaxValues(1);
const row = new ActionRowBuilder().addComponents(userSelect);
await selectInteraction.followUp({
embeds: [
new EmbedBuilder()
)'ﺗﺄﻛﺪ ﻣﻦ ﺗﺬاﻛﺮ اﻟﻤﺴﺘﺨﺪم'(setTitle.
)'.اﺧﺘﺎر ﻣﺴﺘﺨﺪم ﺣﺘﻰ ﺗﺸﻮف ﻋﺪد ﺗﺬاﻛﺮه اﻟﻤﻔﺘﻮﺣﺔ اﻟﺤﺎﻟﯿﺔ'(setDescription.
.setColor(getColor('info')),
,]
components: [row],
flags: MessageFlags.Ephemeral,
;)}
const userCollector = rootInteraction.channel.createMessageComponentCollector({
componentType: ComponentType.UserSelect,
filter: i =>
i.user.id === selectInteraction.user.id && i.customId === 'ticket_cfg_check_user',
time: 60_000,
max: 1,
;)}
userCollector.on('collect', async userInteraction => {
await userInteraction.deferUpdate();
const targetUser = userInteraction.users.first();
const maxTickets = guildConfig.maxTicketsPerUser || 3;
const openCount = await getUserTicketCount(guildId, targetUser.id);
const atLimit = openCount >= maxTickets;
await userInteraction.followUp({
embeds: [
new EmbedBuilder()
.setTitle(`ﺗﺄﻛﺪ ﻣﻦ ﺗﺬاﻛﺮ — ${targetUser.username}`)
.setDescription(
+ `openCount} / ${maxTickets}\n{$ **:اﻟﺘﺬاﻛﺮ اﻟﻤﻔﺘﻮﺣﺔ**`
+ `Math.max(0, maxTickets - openCount)}\n\n{$ **:اﻟﻤﺘﺒﻘﻲ**`
(atLimit
'.ھﺬ,)'ﻤﺴﺘﺨﺪم وﺻﻞ ﻷﻋﻠﻰ ﺣﺪ ﻣﻦ اﻟﺘﺬاﻛﺮ ' ?
ھﺬا اﻟﻤﺴﺘﺨﺪم ﻟﺴﮫ ﯾﻜﺪر ﯾﻔﺘﺢ ﺗﺬاﻛﺮ أ' :
)
.setColor(atLimit ? getColor('error') : getColor('success'))
.setThumbnail(targetUser.displayAvatarURL({ size: 64 }))
.setTimestamp(),
,]
flags: MessageFlags.Ephemeral,
;)}
;)}
userCollector.on('end', (collected, reason) => {
if (reason === 'time' && collected.size === 0) {
replyUserError(selectInteraction, {
type: ErrorTypes.RATE_LIMIT,
,'.ﻣﺎ اﺧﺘﺮت اي ﻣﺴﺘﺨﺪم' :message
}).catch(() => {});
}
;)}
```
}
async function handleRepostPanel(btnInteraction, rootInteraction, guildConfig, guildId, clien
await btnInteraction.deferUpdate();
```
const panelStatus = await getTicketPanelStatus(client, rootInteraction.guild, guildConfig);
if (panelStatus.exists) {
await btnInteraction.followUp({
,])'.اﻟﻠﻮﺣﺔ ﻣﻮﺟﻮدة ﺧﻠﺺ', 'ﻟﻮﺣﺔ اﻟﺘﺬاﻛﺮ ﻣﻮﺟﻮدة ﺧﻠﺺ ﺑﺎﻟﭽﺎﻧﻞ اﻟﻤﺤﺪد'(embeds: [infoEmbed
flags: MessageFlags.Ephemeral,
}).catch(() => {});
await refreshDashboard(rootInteraction, guildConfig, guildId, client);
return;
}
const sentPanel = await repostTicketPanel(client, rootInteraction.guild, guildConfig, guildId
await btnInteraction.followUp({
embeds: [
successEmbed(
,'اﻟﻠﻮﺣﺔ اﻧﺒﻌﺜﺖ ﻣﻦ ﺟﺪﯾﺪ'
{$.>}guildConfig.ticketPanelChannelId{$#< ﻟﻮﺣﺔ ﺗﺬاﻛﺮ ﺟﺪﯾﺪة اﻧﺮﺳﻠﺖ ﺑـ`
sentPanel.url ? `\n[اﻓﺘﺢ رﺳﺎﻟﺔ اﻟﻠﻮﺣﺔ](${sentPanel.url})` : ''
,`}
,)
,]
flags: MessageFlags.Ephemeral,
}).catch(() => {});
await refreshDashboard(rootInteraction, guildConfig, guildId, client);
```
}
async function handleDeleteSystem(btnInteraction, rootInteraction, guildConfig, guildId, clie
const deleteModal = new ModalBuilder()
.setCustomId('ticket_delete_confirm_modal')
)'ﺣﺬف ﻧﻈﺎم اﻟﺘﺬاﻛﺮ'(setTitle.
.addComponents(
new ActionRowBuilder().addComponents(
new TextInputBuilder()
.setCustomId('delete_confirmation')
)'ﺣﺘﻰ ﺗﺄﻛﺪ "DELETE" اﻛﺘﺐ'(setLabel.
.setStyle(TextInputStyle.Short)
.setPlaceholder('DELETE')
.setMaxLength(6)
.setMinLength(6)
.setRequired(true)
)
;)
```
await btnInteraction.showModal(deleteModal);
const submitted = await btnInteraction
.awaitModalSubmit({
time: 120_000,
filter: i => i.customId === 'ticket_delete_confirm_modal' && i.user.id === btnInterac
)}
.catch(() => null);
if (!submitted) {
await refreshDashboard(rootInteraction, guildConfig, guildId, client);
return;
}
const confirmation = submitted.fields.getTextInputValue('delete_confirmation').trim();
if (confirmation !== 'DELETE') {
ف "DELETE" ﻻزم ﺗﻜﺘﺐ' :await replyUserError(submitted, { type: ErrorTypes.UNKNOWN, message
await refreshDashboard(rootInteraction, guildConfig, guildId, client);
return;
}
await submitted.deferUpdate();
const keysToDelete = [
'ticketPanelChannelId',
'ticketPanelMessageId',
'ticketStaffRoleId',
'ticketCategoryId',
'ticketClosedCategoryId',
'ticketPanelMessage',
'ticketButtonLabel',
'maxTicketsPerUser',
'dmOnClose',
;]
if (guildConfig.ticketPanelChannelId) {
try {
const panelChannel = await client.guilds.cache.get(guildId)?.channels.fetch(guildConf
if (panelChannel) {
if (guildConfig.ticketPanelMessageId) {
const panelMessage = await panelChannel.messages.fetch(guildConfig.ticketPane
if (panelMessage) await panelMessage.delete().catch(() => {});
} else {
const messages = await panelChannel.messages.fetch({ limit: 50 }).catch(() =>
if (messages) {
const found = messages.find(
m => m.author.id === client.user.id && messageHasButtonCustomId(m, 'c
;)
if (found) await found.delete().catch(() => {});
}
}
}
} catch (panelDeleteError) {
logger.warn('Could not delete ticket panel message:', panelDeleteError.message);
}
}
try {
const { pgConfig } = await import('../../../config/database/postgres.js');
if (client.db?.db?.pool && typeof client.db.db.isAvailable === 'function' && client.db.db
await client.db.db.pool.query(
`DELETE FROM ${pgConfig.tables.tickets} WHERE guild_id = $1`,
[guildId]
;)
}
} catch (ticketDeleteError) {
logger.warn('Could not clear ticket records from database:', ticketDeleteError.message);
}
for (const key of keysToDelete) {
delete guildConfig[key];
}
await setGuildConfig(client, guildId, guildConfig);
await submitted.followUp({
embeds: [
successEmbed(
,'ﻧﻈﺎم اﻟﺘﺬاﻛﺮ اﻧﺤﺬف '
,'.ﺣﺘﻰ ﺗﺴﻮﯾﮫ ﻣﻦ ﺟﺪﯾﺪ `\ticket setup/`\ ﻛﻞ إﻋﺪادات ﻧﻈﺎم اﻟﺘﺬاﻛﺮ اﻧﻤﺴﺤﺖ. ﺷﻐﻞ'
,)
,]
flags: MessageFlags.Ephemeral,
;)}
await InteractionHelper.safeEditReply(rootInteraction, {
embeds: [
new EmbedBuilder()
)'ﻧﻈﺎم اﻟﺘﺬاﻛﺮ اﻧﺤﺬف'(setTitle.
)'.إﻋﺪادات ﻧﻈﺎم اﻟﺘﺬاﻛﺮ اﻧﻤﺴﺤﺖ'(setDescription.
.setColor(getColor('error'))
.setTimestamp(),
,]
components: [],
}).catch(() => {});
```
}
