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
            .setLabel('اعادة نشر اللوحة')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('📌')
            .setDisabled(disabled),
    );
}

buttons.push(
    new ButtonBuilder()
        .setCustomId(`ticket_cfg_dm_toggle_${guildId}`)
        .setLabel('دي إم عند السكر')
        .setStyle(dmEnabled ? ButtonStyle.Success : ButtonStyle.Danger)
        .setEmoji(dmEnabled ? '📬' : '📭')
        .setDisabled(disabled),
    new ButtonBuilder()
        .setCustomId(`ticket_cfg_staff_role_btn_${guildId}`)
        .setLabel('رول الستاف')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('🛡️')
        .setDisabled(disabled),
    new ButtonBuilder()
        .setCustomId(`ticket_cfg_delete_${guildId}`)
        .setLabel('حذف النظام')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('🗑️')
        .setDisabled(disabled),
);

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
.setTitle('تذاكر الدعم')
.setDescription(config.ticketPanelMessage || 'اضغط الزر تحت حتى تفتح تذكرة دعم.')
.setColor(getColor('info'));
}

function buildPanelButtonRow(config) {
return new ActionRowBuilder().addComponents(
new ButtonBuilder()
.setCustomId('create_ticket')
.setLabel(config.ticketButtonLabel || 'فتح تذكرة')
.setStyle(ButtonStyle.Primary)
.setEmoji('📩'),
);
}

async function repostTicketPanel(client, guild, guildConfig, guildId) {
const channel = await guild.channels.fetch(guildConfig.ticketPanelChannelId).catch(() => null);
if (!channel) {
throw new TitanBotError(
'Panel channel missing',
ErrorTypes.CONFIGURATION,
'چانل اللوحة المحدد ماكو موجود هسه. اختار چانل جديد من الداشبورد.',
);
}

```
const sentPanel = await channel.send({
    embeds: [buildPanelEmbed(guildConfig)],
    components: [buildPanelButtonRow(guildConfig)],
});

await persistPanelMessageId(client, guildId, guildConfig, sentPanel.id);
return sentPanel;
```

}

function formatCloseDuration(ms) {
if (ms == null) return '`غير متوفر`';
const hours = Math.floor(ms / 3_600_000);
const minutes = Math.floor((ms % 3_600_000) / 60_000);
if (hours > 0) return `${hours}h ${minutes}m`;
return `${minutes}m`;
}

function buildDashboardEmbed(config, guild, panelStatus = null, ticketStats = null) {
const panelChannel = config.ticketPanelChannelId ? `<#${config.ticketPanelChannelId}>` : '`ماكو محدد`';
const staffRole = config.ticketStaffRoleId ? `<@&${config.ticketStaffRoleId}>` : '`ماكو محدد`';
const ticketLogsChannel = config.ticketLogsChannelId ? `<#${config.ticketLogsChannelId}>` : '`ماكو محدد`';
const transcriptChannel = config.ticketTranscriptChannelId ? `<#${config.ticketTranscriptChannelId}>` : '`ماكو محدد`';

```
const openCategoryChannel = config.ticketCategoryId ? guild.channels.cache.get(config.ticketCategoryId) : null;
const openCategory = openCategoryChannel ? openCategoryChannel.toString() : '`ماكو محدد`';

const closedCategoryChannel = config.ticketClosedCategoryId ? guild.channels.cache.get(config.ticketClosedCategoryId) : null;
const closedCategory = closedCategoryChannel ? closedCategoryChannel.toString() : '`ماكو محدد`';

const rawMsg = config.ticketPanelMessage || 'اضغط الزر تحت حتى تفتح تذكرة دعم.';
const panelMsg = `\`${rawMsg.length > 60 ? rawMsg.substring(0, 60) + '…' : rawMsg}\``;
const btnLabel = `\`${config.ticketButtonLabel || 'فتح تذكرة'}\``;

let panelStatusValue = formatPanelStatusField(panelStatus);

const openTickets = ticketStats ? String(ticketStats.openCount) : '`—`';
const avgCloseTime = ticketStats ? formatCloseDuration(ticketStats.avgCloseTimeMs) : '`—`';
const feedbackSummary = ticketStats?.feedbackCount
    ? `${ticketStats.avgRating}/5 (${ticketStats.feedbackCount} تقييم${ticketStats.feedbackCount !== 1 ? 'ات' : ''})`
    : '`ماكو تقييمات لهسه`';

return new EmbedBuilder()
    .setTitle('🎫 داشبورد نظام التذاكر')
    .setDescription(`سوي إدارة لإعدادات نظام التذاكر بـ **${guild.name}**.\nاختار من تحت شنو تريد تعدل.`)
    .setColor(getColor('info'))
    .addFields(
        { name: 'حالة اللوحة', value: panelStatusValue, inline: false },
        { name: 'چانل اللوحة', value: panelChannel, inline: true },
        { name: 'رول الستاف', value: staffRole, inline: true },
        { name: '\u200B', value: '\u200B', inline: true },
        { name: 'كاتيكوري التذاكر المفتوحة', value: openCategory, inline: true },
        { name: 'كاتيكوري التذاكر المسكرة', value: closedCategory, inline: true },
        { name: '\u200B', value: '\u200B', inline: true },
        { name: 'رسالة اللوحة', value: panelMsg, inline: false },
        { name: 'نص الزر', value: btnLabel, inline: true },
        { name: 'أعلى تذاكر لكل شخص', value: String(config.maxTicketsPerUser || 3), inline: true },
        { name: 'دي إم عند السكر', value: config.dmOnClose !== false ? 'مفعّل' : 'موقف', inline: true },
        { name: 'چانل لوگات التذاكر', value: ticketLogsChannel, inline: true },
        { name: 'چانل الترانسكربت', value: transcriptChannel, inline: true },
        { name: '\u200B', value: '\u200B', inline: true },
        { name: 'التذاكر المفتوحة', value: openTickets, inline: true },
        { name: 'متوسط وقت السكر', value: avgCloseTime, inline: true },
        { name: 'تقييم الفيدباك', value: feedbackSummary, inline: true },
    )
    .setFooter({ text: 'اختار من تحت • الداشبورد يسكر لحاله بعد 10 دقايق بدون حركة' })
    .setTimestamp();
```

}

function buildSelectMenu(guildId) {
return new StringSelectMenuBuilder()
.setCustomId(`ticket_config_${guildId}`)
.setPlaceholder('اختار شنو تريد تعدل…')
.addOptions(
new StringSelectMenuOptionBuilder()
.setLabel('عدل رسالة اللوحة')
.setDescription('غير الرسالة المعروضة بلوحة إنشاء التذاكر')
.setValue('panel_message')
.setEmoji('📝'),
new StringSelectMenuOptionBuilder()
.setLabel('عدل نص الزر')
.setDescription('غير النص المكتوب على زر فتح تذكرة')
.setValue('button_label')
.setEmoji('🏷️'),
new StringSelectMenuOptionBuilder()
.setLabel('غير كاتيكوري التذاكر المفتوحة')
.setDescription('الكاتيكوري اللي تتولد بيه التذاكر الجديدة')
.setValue('open_category')
.setEmoji('📁'),
new StringSelectMenuOptionBuilder()
.setLabel('غير كاتيكوري التذاكر المسكرة')
.setDescription('الكاتيكوري اللي تنكل ليه التذاكر المسكرة')
.setValue('closed_category')
.setEmoji('📂'),
new StringSelectMenuOptionBuilder()
.setLabel('حدد أعلى تذاكر لكل شخص')
.setDescription('حدد أعلى عدد تذاكر مفتوحة يكدر يسويها شخص وحد بنفس الوكت')
.setValue('max_tickets')
.setEmoji('🔢'),
new StringSelectMenuOptionBuilder()
.setLabel('حدد چانل لوگات التذاكر')
.setDescription('الچانل اللي يستقبل الفيدباك، أحداث التذاكر، واللوگات')
.setValue('logs_channel')
.setEmoji('🎫'),
new StringSelectMenuOptionBuilder()
.setLabel('حدد چانل الترانسكربت')
.setDescription('الچانل اللي يستقبل الترانسكربت التلقائي عند حذف التذكرة')
.setValue('transcript_channel')
.setEmoji('📜'),
);
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
    embeds: [buildDashboardEmbed(guildConfig, rootInteraction.guild, panelStatus, ticketStats)],
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
                'نظام التذاكر ماسواه أحد لهسه. شغل \`/ticket setup\` أول شي حتى تعدله.',
            );
        }

        const panelStatus = await getTicketPanelStatus(client, interaction.guild, guildConfig);
        if (panelStatus.recoveredId) {
            await persistPanelMessageId(client, guildId, guildConfig, panelStatus.recoveredId);
        }

        const ticketStats = await getGuildTicketStats(guildId);

        const selectRow = new ActionRowBuilder().addComponents(buildSelectMenu(guildId));
        const buttonRow = buildButtonRow(guildConfig, guildId, false, panelStatus);

        await startDashboardSession({
            interaction,
            embeds: [buildDashboardEmbed(guildConfig, interaction.guild, panelStatus, ticketStats)],
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
                        await handlePanelMessage(selectInteraction, interaction, guildConfig, guildId, client);
                        break;
                    case 'button_label':
                        await handleButtonLabel(selectInteraction, interaction, guildConfig, guildId, client);
                        break;
                    case 'staff_role':
                        await handleStaffRole(selectInteraction, interaction, guildConfig, guildId, client);
                        break;
                    case 'open_category':
                        await handleOpenCategory(selectInteraction, interaction, guildConfig, guildId, client);
                        break;
                    case 'closed_category':
                        await handleClosedCategory(selectInteraction, interaction, guildConfig, guildId, client);
                        break;
                    case 'max_tickets':
                        await handleMaxTickets(selectInteraction, interaction, guildConfig, guildId, client);
                        break;
                    case 'logs_channel':
                        await handleLogsChannel(selectInteraction, interaction, guildConfig, guildId, client);
                        break;
                    case 'transcript_channel':
                        await handleTranscriptChannel(selectInteraction, interaction, guildConfig, guildId, client);
                        break;
                }
            },
            onButton: async (btnInteraction) => {
                if (btnInteraction.customId === `ticket_cfg_repost_${guildId}`) {
                    await handleRepostPanel(btnInteraction, interaction, guildConfig, guildId, client);
                } else if (btnInteraction.customId === `ticket_cfg_dm_toggle_${guildId}`) {
                    await handleDmOnClose(btnInteraction, interaction, guildConfig, guildId, client);
                } else if (btnInteraction.customId === `ticket_cfg_staff_role_btn_${guildId}`) {
                    await handleStaffRole(btnInteraction, interaction, guildConfig, guildId, client);
                } else if (btnInteraction.customId === `ticket_cfg_delete_${guildId}`) {
                    await handleDeleteSystem(btnInteraction, interaction, guildConfig, guildId, client);
                }
            },
        });
    } catch (error) {
        if (error instanceof TitanBotError) throw error;
        logger.error('Unexpected error in ticket_config:', error);
        throw new TitanBotError(
            `Ticket config failed: ${error.message}`,
            ErrorTypes.UNKNOWN,
            'ما كدرنا نفتح داشبورد إعدادات التذاكر 😩',
        );
    }
},
```

};

async function handlePanelMessage(selectInteraction, rootInteraction, guildConfig, guildId, client) {
const modal = new ModalBuilder()
.setCustomId('ticket_cfg_panel_msg')
.setTitle('📝 عدل رسالة اللوحة')
.addComponents(
new ActionRowBuilder().addComponents(
new TextInputBuilder()
.setCustomId('panel_msg_input')
.setLabel('رسالة اللوحة')
.setStyle(TextInputStyle.Paragraph)
.setValue(
guildConfig.ticketPanelMessage ||
'اضغط الزر تحت حتى تفتح تذكرة دعم.',
)
.setMaxLength(2000)
.setMinLength(1)
.setRequired(true)
.setPlaceholder('اضغط الزر تحت حتى تفتح تذكرة دعم.'),
),
);

```
await selectInteraction.showModal(modal);

const submitted = await selectInteraction
    .awaitModalSubmit({
        filter: i =>
            i.customId === 'ticket_cfg_panel_msg' && i.user.id === selectInteraction.user.id,
        time: 120_000,
    })
    .catch(() => null);

if (!submitted) return;

const newMessage = submitted.fields.getTextInputValue('panel_msg_input').trim();
guildConfig.ticketPanelMessage = newMessage;
await setGuildConfig(client, guildId, guildConfig);

const panelUpdated = await updateLivePanel(client, rootInteraction.guild, guildConfig, guildId);

await submitted.reply({
    embeds: [
        successEmbed(
            '✅ رسالة اللوحة تحدثت',
            `رسالة اللوحة صارت محدثة.${
                panelUpdated
                    ? '\nاللوحة الحية بالچانل تحدثت هي الثانية.'
                    : '\n> **ملاحظة:** ما كدرنا نلكى اللوحة الحية. استخدم **اعادة نشر اللوحة** من الداشبورد حتى ترجعها.'
            }`,
        ),
    ],
    flags: MessageFlags.Ephemeral,
});

await refreshDashboard(rootInteraction, guildConfig, guildId, client);
```

}

async function handleButtonLabel(selectInteraction, rootInteraction, guildConfig, guildId, client) {
const modal = new ModalBuilder()
.setCustomId('ticket_cfg_btn_label')
.setTitle('🏷️ عدل نص الزر')
.addComponents(
new ActionRowBuilder().addComponents(
new TextInputBuilder()
.setCustomId('btn_label_input')
.setLabel('نص الزر (أعلى 80 حرف)')
.setStyle(TextInputStyle.Short)
.setValue(guildConfig.ticketButtonLabel || 'فتح تذكرة')
.setMaxLength(80)
.setMinLength(1)
.setRequired(true)
.setPlaceholder('فتح تذكرة'),
),
);

```
await selectInteraction.showModal(modal);

const submitted = await selectInteraction
    .awaitModalSubmit({
        filter: i =>
            i.customId === 'ticket_cfg_btn_label' && i.user.id === selectInteraction.user.id,
        time: 120_000,
    })
    .catch(() => null);

if (!submitted) return;

const newLabel = submitted.fields.getTextInputValue('btn_label_input').trim();
guildConfig.ticketButtonLabel = newLabel;
await setGuildConfig(client, guildId, guildConfig);

const panelUpdated = await updateLivePanel(client, rootInteraction.guild, guildConfig, guildId);

await submitted.reply({
    embeds: [
        successEmbed(
            '✅ نص الزر تحدث',
            `نص الزر صار \`${newLabel}\`.${
                panelUpdated
                    ? '\nزر اللوحة الحية تحدث هو الثاني.'
                    : '\n> **ملاحظة:** ما كدرنا نلكى اللوحة الحية. استخدم **اعادة نشر اللوحة** من الداشبورد حتى ترجعها.'
            }`,
        ),
    ],
    flags: MessageFlags.Ephemeral,
});

await refreshDashboard(rootInteraction, guildConfig, guildId, client);
```

}

async function handleStaffRole(selectInteraction, rootInteraction, guildConfig, guildId, client) {
await selectInteraction.deferUpdate();

```
const roleSelect = new RoleSelectMenuBuilder()
    .setCustomId('ticket_cfg_staff_role')
    .setPlaceholder('اختار رول الستاف...')
    .setMaxValues(1);

const row = new ActionRowBuilder().addComponents(roleSelect);

await selectInteraction.followUp({
    embeds: [
        new EmbedBuilder()
            .setTitle('🛡️ غير رول الستاف')
            .setDescription(
                `**الحالي:** ${guildConfig.ticketStaffRoleId ? `<@&${guildConfig.ticketStaffRoleId}>` : '`ماكو محدد`'}\n\nاختار الرول اللي يريد يوصل يدير التذاكر.`,
            )
            .setColor(getColor('info')),
    ],
    components: [row],
    flags: MessageFlags.Ephemeral,
});

const roleCollector = rootInteraction.channel.createMessageComponentCollector({
    componentType: ComponentType.RoleSelect,
    filter: i =>
        i.user.id === selectInteraction.user.id && i.customId === 'ticket_cfg_staff_role',
    time: 60_000,
    max: 1,
});

roleCollector.on('collect', async roleInteraction => {
    await roleInteraction.deferUpdate();
    const role = roleInteraction.roles.first();

    guildConfig.ticketStaffRoleId = role.id;
    await setGuildConfig(client, guildId, guildConfig);

    await roleInteraction.followUp({
        embeds: [successEmbed('رول الستاف تحدث', `رول الستاف صار ${role}.`)],
        flags: MessageFlags.Ephemeral,
    });

    await refreshDashboard(rootInteraction, guildConfig, guildId, client);
});

roleCollector.on('end', (collected, reason) => {
    if (reason === 'time' && collected.size === 0) {
        replyUserError(selectInteraction, {
            type: ErrorTypes.RATE_LIMIT,
            message: 'ما اخترت اي رول. رول الستاف ما تغير.',
        }).catch(() => {});
    }
});
```

}

async function handleOpenCategory(selectInteraction, rootInteraction, guildConfig, guildId, client) {
await selectInteraction.deferUpdate();

```
const channelSelect = new ChannelSelectMenuBuilder()
    .setCustomId('ticket_cfg_open_cat')
    .setPlaceholder('اختار كاتيكوري...')
    .addChannelTypes(ChannelType.GuildCategory)
    .setMaxValues(1);

await selectInteraction.followUp({
    embeds: [
        new EmbedBuilder()
            .setTitle('📁 غير كاتيكوري التذاكر المفتوحة')
            .setDescription(
                `**الحالي:** ${guildConfig.ticketCategoryId ? `<#${guildConfig.ticketCategoryId}>` : '`ماكو محدد`'}\n\nاختار الكاتيكوري اللي راح تتولد بيه التذاكر الجديدة.`,
            )
            .setColor(getColor('info')),
    ],
    components: [new ActionRowBuilder().addComponents(channelSelect)],
    flags: MessageFlags.Ephemeral,
});

const catCollector = rootInteraction.channel.createMessageComponentCollector({
    componentType: ComponentType.ChannelSelect,
    filter: i =>
        i.user.id === selectInteraction.user.id && i.customId === 'ticket_cfg_open_cat',
    time: 60_000,
    max: 1,
});

catCollector.on('collect', async catInteraction => {
    await catInteraction.deferUpdate();
    const category = catInteraction.channels.first();

    guildConfig.ticketCategoryId = category.id;
    await setGuildConfig(client, guildId, guildConfig);

    await catInteraction.followUp({
        embeds: [
            successEmbed(
                'كاتيكوري التذاكر المفتوحة تحدث',
                `التذاكر الجديدة هسه راح تتولد بـ **${category.name}**.`,
            ),
        ],
        flags: MessageFlags.Ephemeral,
    });

    await refreshDashboard(rootInteraction, guildConfig, guildId, client);
});

catCollector.on('end', (collected, reason) => {
    if (reason === 'time' && collected.size === 0) {
        replyUserError(selectInteraction, {
            type: ErrorTypes.RATE_LIMIT,
            message: 'ما اخترت اي كاتيكوري. الإعداد ما تغير.',
        }).catch(() => {});
    }
});
```

}

async function handleClosedCategory(selectInteraction, rootInteraction, guildConfig, guildId, client) {
await selectInteraction.deferUpdate();

```
const channelSelect = new ChannelSelectMenuBuilder()
    .setCustomId('ticket_cfg_closed_cat')
    .setPlaceholder('اختار كاتيكوري...')
    .addChannelTypes(ChannelType.GuildCategory)
    .setMaxValues(1);

await selectInteraction.followUp({
    embeds: [
        new EmbedBuilder()
            .setTitle('📂 غير كاتيكوري التذاكر المسكرة')
            .setDescription(
                `**الحالي:** ${guildConfig.ticketClosedCategoryId ? `<#${guildConfig.ticketClosedCategoryId}>` : '`ماكو محدد`'}\n\nاختار الكاتيكوري اللي راح تنكل ليه التذاكر المسكرة.`,
            )
            .setColor(getColor('info')),
    ],
    components: [new ActionRowBuilder().addComponents(channelSelect)],
    flags: MessageFlags.Ephemeral,
});

const catCollector = rootInteraction.channel.createMessageComponentCollector({
    componentType: ComponentType.ChannelSelect,
    filter: i =>
        i.user.id === selectInteraction.user.id && i.customId === 'ticket_cfg_closed_cat',
    time: 60_000,
    max: 1,
});

catCollector.on('collect', async catInteraction => {
    await catInteraction.deferUpdate();
    const category = catInteraction.channels.first();

    guildConfig.ticketClosedCategoryId = category.id;
    await setGuildConfig(client, guildId, guildConfig);

    await catInteraction.followUp({
        embeds: [
            successEmbed(
                'كاتيكوري التذاكر المسكرة تحدث',
                `التذاكر المسكرة هسه راح تنكل لـ **${category.name}**.`,
            ),
        ],
        flags: MessageFlags.Ephemeral,
    });

    await refreshDashboard(rootInteraction, guildConfig, guildId, client);
});

catCollector.on('end', (collected, reason) => {
    if (reason === 'time' && collected.size === 0) {
        replyUserError(selectInteraction, {
            type: ErrorTypes.RATE_LIMIT,
            message: 'ما اخترت اي كاتيكوري. الإعداد ما تغير.',
        }).catch(() => {});
    }
});
```

}

async function handleMaxTickets(selectInteraction, rootInteraction, guildConfig, guildId, client) {
const modal = new ModalBuilder()
.setCustomId('ticket_cfg_max_tickets')
.setTitle('حدد أعلى تذاكر لكل شخص')
.addComponents(
new ActionRowBuilder().addComponents(
new TextInputBuilder()
.setCustomId('max_tickets_input')
.setLabel('أعلى تذاكر مفتوحة (1–10)')
.setStyle(TextInputStyle.Short)
.setValue(String(guildConfig.maxTicketsPerUser || 3))
.setMaxLength(2)
.setMinLength(1)
.setRequired(true)
.setPlaceholder('3'),
),
);

```
await selectInteraction.showModal(modal);

const submitted = await selectInteraction
    .awaitModalSubmit({
        filter: i =>
            i.customId === 'ticket_cfg_max_tickets' && i.user.id === selectInteraction.user.id,
        time: 120_000,
    })
    .catch(() => null);

if (!submitted) return;

const raw = submitted.fields.getTextInputValue('max_tickets_input').trim();
const newMax = parseInt(raw, 10);

if (Number.isNaN(newMax) || newMax < 1 || newMax > 10) {
    await replyUserError(submitted, {
        type: ErrorTypes.VALIDATION,
        message: 'لازم يكون الرقم صحيح وبين **1** و **10**.',
    });
    return;
}

guildConfig.maxTicketsPerUser = newMax;
await setGuildConfig(client, guildId, guildConfig);

await submitted.reply({
    embeds: [
        successEmbed(
            'أعلى تذاكر تحدث',
            `هسه كل شخص يكدر يكون عنده أعلى **${newMax}** تذكرة مفتوحة بنفس الوكت.`,
        ),
    ],
    flags: MessageFlags.Ephemeral,
});

await refreshDashboard(rootInteraction, guildConfig, guildId, client);
```

}

async function handleDmOnClose(btnInteraction, rootInteraction, guildConfig, guildId, client) {
await btnInteraction.deferUpdate();

```
const newState = guildConfig.dmOnClose === false;
guildConfig.dmOnClose = newState;
await setGuildConfig(client, guildId, guildConfig);

await btnInteraction.followUp({
    embeds: [
        successEmbed(
            'دي إم عند السكر تحدث',
            `المستخدمين هسه **${newState ? 'راح يوصلهم' : 'ما راح يوصلهم'}** دي إم لمن تنسكر تذكرتهم.`,
        ),
    ],
    flags: MessageFlags.Ephemeral,
});

await refreshDashboard(rootInteraction, guildConfig, guildId, client);
```

}

async function handleLogsChannel(selectInteraction, rootInteraction, guildConfig, guildId, client) {
await selectInteraction.deferUpdate();

```
const channelSelect = new ChannelSelectMenuBuilder()
    .setCustomId('ticket_cfg_logs_channel')
    .setPlaceholder('اختار چانل...')
    .addChannelTypes(ChannelType.GuildText)
    .setMaxValues(1);

await selectInteraction.followUp({
    embeds: [
        new EmbedBuilder()
            .setTitle('🎫 اختار چانل لوگات التذاكر')
            .setDescription('اختار وين تريد الفيدباك، أحداث التذاكر (فتح، سكر، كليم، وغيرها)، واللوگات تنرسل.')
            .setColor(getColor('info')),
    ],
    components: [new ActionRowBuilder().addComponents(channelSelect)],
    flags: MessageFlags.Ephemeral,
});

const collector = rootInteraction.channel.createMessageComponentCollector({
    componentType: ComponentType.ChannelSelect,
    filter: i => i.user.id === selectInteraction.user.id && i.customId === 'ticket_cfg_logs_channel',
    time: 60_000,
    max: 1,
});

collector.on('collect', async channelInteraction => {
    await channelInteraction.deferUpdate();
    const channel = channelInteraction.channels.first();

    guildConfig.ticketLogsChannelId = channel.id;
    await setGuildConfig(client, guildId, guildConfig);

    await channelInteraction.followUp({
        embeds: [successEmbed('چانل اللوگات تحدث', `لوگات التذاكر راح تنرسل لـ ${channel}`)],
        flags: MessageFlags.Ephemeral,
    });

    await refreshDashboard(rootInteraction, guildConfig, guildId, client);
});

collector.on('end', (collected, reason) => {
    if (reason === 'time' && collected.size === 0) {
        replyUserError(selectInteraction, {
            type: ErrorTypes.RATE_LIMIT,
            message: 'ما اخترت اي چانل. ما صار اي تغيير.',
        }).catch(() => {});
    }
});
```

}

async function handleTranscriptChannel(selectInteraction, rootInteraction, guildConfig, guildId, client) {
await selectInteraction.deferUpdate();

```
const channelSelect = new ChannelSelectMenuBuilder()
    .setCustomId('ticket_cfg_transcript_channel')
    .setPlaceholder('اختار چانل...')
    .addChannelTypes(ChannelType.GuildText)
    .setMaxValues(1);

await selectInteraction.followUp({
    embeds: [
        new EmbedBuilder()
            .setTitle('📜 اختار چانل الترانسكربت')
            .setDescription('اختار وين تريد الترانسكربت التلقائي ينرسل لمن تنحذف التذكرة.')
            .setColor(getColor('info'))
    ],
    components: [new ActionRowBuilder().addComponents(channelSelect)],
    flags: MessageFlags.Ephemeral
});

const collector = rootInteraction.channel.createMessageComponentCollector({
    componentType: ComponentType.ChannelSelect,
    filter: i => i.user.id === selectInteraction.user.id && i.customId === 'ticket_cfg_transcript_channel',
    time: 60_000,
    max: 1
});

collector.on('collect', async channelInteraction => {
    await channelInteraction.deferUpdate();
    const channel = channelInteraction.channels.first();

    guildConfig.ticketTranscriptChannelId = channel.id;
    await setGuildConfig(client, guildId, guildConfig);

    await channelInteraction.followUp({
        embeds: [successEmbed('چانل الترانسكربت تحدث', `الترانسكربتات راح تنرسل لـ ${channel}`)],
        flags: MessageFlags.Ephemeral
    });

    await refreshDashboard(rootInteraction, guildConfig, guildId, client);
});

collector.on('end', (collected, reason) => {
    if (reason === 'time' && collected.size === 0) {
        replyUserError(selectInteraction, {
            type: ErrorTypes.RATE_LIMIT,
            message: 'ما اخترت اي چانل. ما صار اي تغيير.',
        }).catch(() => {});
    }
});
```

}

async function handleCheckUser(selectInteraction, rootInteraction, guildConfig, guildId, client) {
await selectInteraction.deferUpdate();

```
const userSelect = new UserSelectMenuBuilder()
    .setCustomId('ticket_cfg_check_user')
    .setPlaceholder('اختار مستخدم حتى تتاكد...')
    .setMaxValues(1);

const row = new ActionRowBuilder().addComponents(userSelect);

await selectInteraction.followUp({
    embeds: [
        new EmbedBuilder()
            .setTitle('تأكد من تذاكر المستخدم')
            .setDescription('اختار مستخدم حتى تشوف عدد تذاكره المفتوحة الحالية.')
            .setColor(getColor('info')),
    ],
    components: [row],
    flags: MessageFlags.Ephemeral,
});

const userCollector = rootInteraction.channel.createMessageComponentCollector({
    componentType: ComponentType.UserSelect,
    filter: i =>
        i.user.id === selectInteraction.user.id && i.customId === 'ticket_cfg_check_user',
    time: 60_000,
    max: 1,
});

userCollector.on('collect', async userInteraction => {
    await userInteraction.deferUpdate();
    const targetUser = userInteraction.users.first();
    const maxTickets = guildConfig.maxTicketsPerUser || 3;
    const openCount = await getUserTicketCount(guildId, targetUser.id);
    const atLimit = openCount >= maxTickets;

    await userInteraction.followUp({
        embeds: [
            new EmbedBuilder()
                .setTitle(`تأكد من تذاكر — ${targetUser.username}`)
                .setDescription(
                    `**التذاكر المفتوحة:** ${openCount} / ${maxTickets}\n` +
                        `**المتبقي:** ${Math.max(0, maxTickets - openCount)}\n\n` +
                        (atLimit
                            ? '⚠️ هذا المستخدم وصل لأعلى حد من التذاكر.'
                            : '✅ هذا المستخدم لسه يكدر يفتح تذاكر أكثر.'),
                )
                .setColor(atLimit ? getColor('error') : getColor('success'))
                .setThumbnail(targetUser.displayAvatarURL({ size: 64 }))
                .setTimestamp(),
        ],
        flags: MessageFlags.Ephemeral,
    });
});

userCollector.on('end', (collected, reason) => {
    if (reason === 'time' && collected.size === 0) {
        replyUserError(selectInteraction, {
            type: ErrorTypes.RATE_LIMIT,
            message: 'ما اخترت اي مستخدم.',
        }).catch(() => {});
    }
});
```

}

async function handleRepostPanel(btnInteraction, rootInteraction, guildConfig, guildId, client) {
await btnInteraction.deferUpdate();

```
const panelStatus = await getTicketPanelStatus(client, rootInteraction.guild, guildConfig);
if (panelStatus.exists) {
    await btnInteraction.followUp({
        embeds: [infoEmbed('اللوحة موجودة خلص', 'لوحة التذاكر موجودة خلص بالچانل المحدد.')],
        flags: MessageFlags.Ephemeral,
    }).catch(() => {});
    await refreshDashboard(rootInteraction, guildConfig, guildId, client);
    return;
}

const sentPanel = await repostTicketPanel(client, rootInteraction.guild, guildConfig, guildId);

await btnInteraction.followUp({
    embeds: [
        successEmbed(
            'اللوحة انبعثت من جديد',
            `لوحة تذاكر جديدة انرسلت بـ <#${guildConfig.ticketPanelChannelId}>.${
                sentPanel.url ? `\n[افتح رسالة اللوحة](${sentPanel.url})` : ''
            }`,
        ),
    ],
    flags: MessageFlags.Ephemeral,
}).catch(() => {});

await refreshDashboard(rootInteraction, guildConfig, guildId, client);
```

}

async function handleDeleteSystem(btnInteraction, rootInteraction, guildConfig, guildId, client) {
const deleteModal = new ModalBuilder()
.setCustomId('ticket_delete_confirm_modal')
.setTitle('حذف نظام التذاكر')
.addComponents(
new ActionRowBuilder().addComponents(
new TextInputBuilder()
.setCustomId('delete_confirmation')
.setLabel('اكتب "DELETE" حتى تأكد')
.setStyle(TextInputStyle.Short)
.setPlaceholder('DELETE')
.setMaxLength(6)
.setMinLength(6)
.setRequired(true)
)
);

```
await btnInteraction.showModal(deleteModal);

const submitted = await btnInteraction
    .awaitModalSubmit({
        filter: i => i.customId === 'ticket_delete_confirm_modal' && i.user.id === btnInteraction.user.id,
        time: 120_000,
    })
    .catch(() => null);

if (!submitted) {
    await refreshDashboard(rootInteraction, guildConfig, guildId, client);
    return;
}

const confirmation = submitted.fields.getTextInputValue('delete_confirmation').trim();

if (confirmation !== 'DELETE') {
    await replyUserError(submitted, { type: ErrorTypes.UNKNOWN, message: 'لازم تكتب "DELETE" بالضبط حتى تأكد الحذف.' });
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
];

if (guildConfig.ticketPanelChannelId) {
    try {
        const panelChannel = await client.guilds.cache.get(guildId)?.channels.fetch(guildConfig.ticketPanelChannelId).catch(() => null);
        if (panelChannel) {
            if (guildConfig.ticketPanelMessageId) {
                const panelMessage = await panelChannel.messages.fetch(guildConfig.ticketPanelMessageId).catch(() => null);
                if (panelMessage) await panelMessage.delete().catch(() => {});
            } else {
                
                const messages = await panelChannel.messages.fetch({ limit: 50 }).catch(() => null);
                if (messages) {
                    const found = messages.find(
                        m => m.author.id === client.user.id && messageHasButtonCustomId(m, 'create_ticket'),
                    );
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
    if (client.db?.db?.pool && typeof client.db.db.isAvailable === 'function' && client.db.db.isAvailable()) {
        await client.db.db.pool.query(
            `DELETE FROM ${pgConfig.tables.tickets} WHERE guild_id = $1`,
            [guildId]
        );
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
            '✅ نظام التذاكر انحذف',
            'كل إعدادات نظام التذاكر انمسحت. شغل \`/ticket setup\` حتى تسويه من جديد.',
        ),
    ],
    flags: MessageFlags.Ephemeral,
});

await InteractionHelper.safeEditReply(rootInteraction, {
    embeds: [
        new EmbedBuilder()
            .setTitle('نظام التذاكر انحذف')
            .setDescription('إعدادات نظام التذاكر انمسحت.')
            .setColor(getColor('error'))
            .setTimestamp(),
    ],
    components: [],
}).catch(() => {});
```

}
