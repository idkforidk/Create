import { getColor } from '../../config/bot.js';
import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { successEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { replyUserError, ErrorTypes } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { getTicketPermissionContext } from '../../utils/ticket/ticketPermissions.js';
import { updateTicketPriority } from '../../services/ticket.js';

export default {
    data: new SlashCommandBuilder()
        .setName("priority")
        .setDescription("تغير أولوية التذكرة الحالية")
        .addStringOption((option) =>
            option
                .setName("level")
                .setDescription("مستوى الأولوية للتذكرة")
                .setRequired(true)
                .addChoices(
                    { name: "🚨 عاجل", value: "urgent" },
                    { name: "🔴 عالي", value: "high" },
                    { name: "🟡 متوسط", value: "medium" },
                    { name: "🟢 منخفض", value: "low" },
                    { name: "⚪ بدون", value: "none" },
                ),
        )
        .setDMPermission(false),
    category: "Ticket",

    async execute(interaction, guildConfig, client) {
        const deferred = await InteractionHelper.safeDefer(interaction, { flags: MessageFlags.Ephemeral });
        if (!deferred) {
            return;
        }

        const permissionContext = await getTicketPermissionContext({ client, interaction });
        if (!permissionContext.ticketData) {
            return await replyUserError(interaction, { type: ErrorTypes.VALIDATION, message: 'شنو هاي؟ 😅 هذا الأمر يشتغل بس داخل چانل تذكرة صحيح.' });
        }

        if (!permissionContext.canManageTicket) {
            return await replyUserError(interaction, { type: ErrorTypes.PERMISSION, message: 'يا خطيب، تحتاج صلاحية `Manage Channels` أو رول `Ticket Staff` المحدد حتى تكدر تغير أولوية التذكرة 🚫' });
        }

        const priorityLevel = interaction.options.getString("level");
        await updateTicketPriority(interaction.channel, priorityLevel, interaction.user);

        await InteractionHelper.safeEditReply(interaction, {
            embeds: [
                successEmbed(
                    "تم تغيير الأولوية ⚡",
                    `أولوية التذكرة صارت **${priorityLevel.toUpperCase()}** خلص.`,
                ),
            ],
        });

        logger.info('Ticket priority updated successfully', {
            userId: interaction.user.id,
            userTag: interaction.user.tag,
            channelId: interaction.channel.id,
            channelName: interaction.channel.name,
            guildId: interaction.guildId,
            priority: priorityLevel,
            commandName: 'priority'
        });
    },
};
