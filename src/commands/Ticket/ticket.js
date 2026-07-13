import { getColor } from '../../config/bot.js';
import { SlashCommandBuilder, PermissionFlagsBits, PermissionsBitField, ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from 'discord.js';
import { createEmbed, successEmbed, infoEmbed, warningEmbed } from '../../utils/embeds.js';
import { getGuildConfig, setGuildConfig } from '../../services/config/guildConfig.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { logger } from '../../utils/logger.js';
import { handleInteractionError, replyUserError, ErrorTypes } from '../../utils/errorHandler.js';

import ticketConfig from './modules/ticket_dashboard.js';

export default {
    data: new SlashCommandBuilder()
        .setName("ticket")
        .setDescription("إدارة نظام التذاكر في السيرفر")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
        .addSubcommand((subcommand) =>
            subcommand
                .setName("setup")
                .setDescription("تثبيت لوحة إنشاء التذاكر في چانل محدد")
                .addChannelOption((option) =>
                    option
                        .setName("panel_channel")
                        .setDescription("الچانل اللي راح تنرسل فيه لوحة التذاكر")
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(true),
                )
                .addStringOption((option) =>
                    option
                        .setName("panel_message")
                        .setDescription("الرسالة الرئيسية للوحة التذاكر")
                        .setRequired(true),
                )
                .addStringOption((option) =>
                    option
                        .setName("button_label")
                        .setDescription("النص اللي يظهر على زر إنشاء التذكرة")
                        .setRequired(false),
                )
                .addChannelOption((option) =>
                    option
                        .setName("category")
                        .setDescription("الكاتيكوري اللي تتولد بيه التذاكر الجديدة")
                        .addChannelTypes(ChannelType.GuildCategory)
                        .setRequired(false),
                )
                .addChannelOption((option) =>
                    option
                        .setName("closed_category")
                        .setDescription("الكاتيكوري اللي تنكل ليه التذاكر المسكرة")
                        .addChannelTypes(ChannelType.GuildCategory)
                        .setRequired(false),
                )
                .addRoleOption((option) =>
                    option
                        .setName("staff_role")
                        .setDescription("الرول اللي يكدر يدير التذاكر")
                        .setRequired(false),
                )
                .addIntegerOption((option) =>
                    option
                        .setName("max_tickets_per_user")
                        .setDescription("أعلى عدد تذاكر يكدر يفتحها كل مستخدم")
                        .setMinValue(1)
                        .setMaxValue(10)
                        .setRequired(false),
                )
                .addBooleanOption((option) =>
                    option
                        .setName("dm_on_close")
                        .setDescription("إرسال دي إم للمستخدم لمن تنسكر تذكرته")
                        .setRequired(false),
                ),
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName("dashboard")
                .setDescription("فتح داشبورد التحكم بنظام التذاكر"),
        ),
    category: "ticket",

    async execute(interaction, config, client) {
        // ... rest of your execute function stays EXACTLY the same ...
        const deferred = await InteractionHelper.safeDefer(interaction, { flags: MessageFlags.Ephemeral });
        if (!deferred) {
            return;
        }

        if (
            !interaction.member.permissions.has(
                PermissionFlagsBits.ManageChannels,
            )
        ) {
            logger.warn('Ticket command permission denied', {
                userId: interaction.user.id,
                guildId: interaction.guildId,
                commandName: 'ticket'
            });
            return await replyUserError(interaction, { type: ErrorTypes.PERMISSION, message: 'ولك شنو هاي؟ تحتاج صلاحية `Manage Channels` حتى تسوي هالحركة، مو كل واحد يجي يلعب بالتذاكر 😂' });
        }

        const subcommand = interaction.options.getSubcommand();

        if (subcommand === "dashboard") {
            return ticketConfig.execute(interaction, config, client);
        }

        if (subcommand === "setup") {
            const existingConfig = await getGuildConfig(client, interaction.guildId);
            if (existingConfig?.ticketPanelChannelId) {
                return await replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: `شبيك يا زلمة، السيرفر عدنه نظام تذاكر مسوّى خلص (اللوحة موجودة بـ <#${existingConfig.ticketPanelChannelId}>) 🎫\n\nما نكدر نسوي وحدة ثانية، نظام واحد بس يشتغل بكل سيرفر. استخدم \`/ticket dashboard\` حتى تعدل الموجود، أو دز على **Delete System** من الداشبورد وابدأ من جديد لو تريد.` });
            }

            const panelChannel = interaction.options.getChannel("panel_channel");
            const categoryChannel = interaction.options.getChannel("category");
            const closedCategoryChannel = interaction.options.getChannel("closed_category");
            const staffRole = interaction.options.getRole("staff_role");
            const panelMessage = interaction.options.getString("panel_message") || "أهلاً بك، إذا كنت بحاجة إلى المساعدة في أي شيء، يرجى فتح تذكرة دعم وسنتواصل معك في أقرب وقت ممكن.";
            const buttonLabel = interaction.options.getString("button_label") || "فتح تذكرة";
            const maxTicketsPerUser = interaction.options.getInteger("max_tickets_per_user") || 3;
            const dmOnClose = interaction.options.getBoolean("dm_on_close") !== false;

            const setupEmbed = createEmbed({ 
                title: "Support Tickets", 
                description: panelMessage,
                color: getColor('info')
            });

            const ticketButton = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId("create_ticket")
                    .setLabel(buttonLabel)
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji("📩"),
            );

            try {
                const sentPanel = await panelChannel.send({
                    embeds: [setupEmbed],
                    components: [ticketButton],
                });

                if (client.db && interaction.guildId) {
                    const currentConfig = existingConfig;
                    currentConfig.ticketCategoryId = categoryChannel ? categoryChannel.id : null;
                    currentConfig.ticketClosedCategoryId = closedCategoryChannel ? closedCategoryChannel.id : null;
                    currentConfig.ticketStaffRoleId = staffRole ? staffRole.id : null;
                    currentConfig.ticketPanelChannelId = panelChannel.id;
                    currentConfig.ticketPanelMessageId = sentPanel?.id || null;
                    currentConfig.ticketPanelMessage = panelMessage;
                    currentConfig.ticketButtonLabel = buttonLabel;
                    currentConfig.maxTicketsPerUser = maxTicketsPerUser;
                    currentConfig.dmOnClose = dmOnClose;

                    await setGuildConfig(client, interaction.guildId, currentConfig);
                    logger.info('Ticket configuration saved', {
                        guildId: interaction.guildId,
                        categoryId: categoryChannel?.id,
                        closedCategoryId: closedCategoryChannel?.id,
                        staffRoleId: staffRole?.id,
                        maxTickets: maxTicketsPerUser,
                        dmOnClose: dmOnClose,
                    });
                } else {
                    logger.error('Ticket setup unavailable, panel sent but configuration was NOT saved', {
                        guildId: interaction.guildId,
                    });
                }

                let successMessage = `تمام يا نجم، لوحة التذاكر طارت لـ ${panelChannel} خلص جاهزة 🚀`;
                
                if (categoryChannel) {
                    successMessage += `التذاكر الجديدة راح تتولد جوه كاتيكوري **${categoryChannel.name}**.`;
                } else {
                    successMessage += 'التذاكر الجديدة راح تتولد بكاتيكوري جديدة اسمها "Tickets" (سويناها أوتوماتيك، ما تشيل هم).';
                }
                
                if (closedCategoryChannel) {
                    successMessage += `التذاكر المسكرة راح تنكل لـ **${closedCategoryChannel.name}**.`;
                }
                
                if (staffRole) {
                    successMessage += `رول **${staffRole.name}** عنده صلاحية يشوف التذاكر.`;
                }
                
                successMessage += `\n\n**أعلى عدد تذاكر لكل شخص:** ${maxTicketsPerUser}\n**دي إم عند السكر:** ${dmOnClose ? 'مفعّل ✅' : 'موقف ❌'}`;

                await InteractionHelper.safeEditReply(interaction, {
                    embeds: [
                        successEmbed(
                            "خلصت! لوحة التذاكر جاهزة 🎉",
                            successMessage,
                        ),
                    ],
                });

                logger.info('Ticket panel setup completed', {
                    userId: interaction.user.id,
                    userTag: interaction.user.tag,
                    guildId: interaction.guildId,
                    panelChannelId: panelChannel.id,
                    categoryId: categoryChannel?.id,
                    closedCategoryId: closedCategoryChannel?.id,
                    staffRoleId: staffRole?.id,
                    maxTickets: maxTicketsPerUser,
                    dmOnClose: dmOnClose,
                    commandName: 'ticket_setup'
                });

            } catch (error) {
                logger.error('Ticket setup error', {
                    error: error.message,
                    stack: error.stack,
                    userId: interaction.user.id,
                    guildId: interaction.guildId,
                    commandName: 'ticket_setup'
                });
                if (interaction.deferred || interaction.replied) {
                    await replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: 'ماكو فايدة، ما كدرت أدز لوحة التذاكر أو أحفظ الإعدادات 😩 تأكد إن البوت عنده صلاحية يرسل رسائل بالچانل المطلوب، وتأكد الداتابيس شغالة.' }).catch(err => {
                        logger.error('Failed to send error reply', {
                            error: err.message,
                            guildId: interaction.guildId
                        });
                    });
                } else {
                    await handleInteractionError(interaction, error, {
                        commandName: 'ticket_setup',
                        source: 'ticket_setup_command'
                    });
                }
            }
        }
    }
};
