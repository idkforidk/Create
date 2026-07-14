import { EmbedBuilder } from 'discord.js';
import { getColor } from '../config/bot.js';
import { logger } from '../utils/logger.js';
import BAD_WORDS from './badwords.js';

// Store warnings (in memory - resets on bot restart)
const warnings = new Map();

// Auto reply triggers
const AUTO_REPLIES = {
    'انجب': 'انجب',
    'هاي': 'هاي يا وردة 🌹',
    'شلونك': 'الحمد لله، وأنت شلونك؟',
    'بوت': 'نعم حبيبي، شتريد؟ 🤖',
    'سلام': 'وعليكم السلام والرحمة 🌸',
    'شكرا': 'عفواً، تدلل 🤍',
    'صباح الخير': 'صباح النور والياسمين 🌤️',
    'مساء الخير': 'مساء الفل والياسمين 🌙',
};

function containsBadWord(content) {
    const lowerContent = content.toLowerCase();
    return BAD_WORDS.some(word => {
        const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`\\b${escaped}\\b|${escaped}`, 'i');
        return regex.test(lowerContent);
    });
}

function getUserWarnings(guildId, userId) {
    const key = `${guildId}-${userId}`;
    return warnings.get(key) || 0;
}

function addWarning(guildId, userId) {
    const key = `${guildId}-${userId}`;
    const currentWarnings = getUserWarnings(guildId, userId);
    warnings.set(key, currentWarnings + 1);
    return currentWarnings + 1;
}

function resetWarnings(guildId, userId) {
    const key = `${guildId}-${userId}`;
    warnings.delete(key);
}

export default {
    name: 'autoreply',
    
    async execute(message, client) {
        if (message.author.bot) return;
        
        const prefix = client.config?.commands?.prefix || '!';
        if (message.content.startsWith(prefix)) return;
        
        const content = message.content.trim();
        
        // === AUTO MOD - NO ONE IS SAFE ===
        if (containsBadWord(content)) {
            try {
                await message.delete();
                
                const warningCount = addWarning(message.guild.id, message.author.id);
                
                const warnEmbed = new EmbedBuilder()
                    .setTitle('⚠️ تحذير - لغة غير لائقة')
                    .setDescription(`مرحباً ${message.author.username}،`)
                    .addFields(
                        { name: 'رسالتك انحذفت لإنها تحتوي على كلمات غير لائقة.', value: '\u200B' },
                        { 
                            name: `📊 التحذيرات: ${warningCount} / 3`,
                            value: warningCount >= 3 
                                ? '🚫 **لقد تجاوزت الحد المسموح! تم إعطائك ميوت لمدة يوم كامل.**' 
                                : '⚠️ إذا وصلت إلى 3 تحذيرات، سيتم إعطائك ميوت تلقائي لمدة يوم.'
                        }
                    )
                    .setColor(warningCount >= 3 ? getColor('error') : getColor('warning'))
                    .setFooter({ text: 'يرجى الالتزام بقوانين السيرفر' })
                    .setTimestamp();
                
                try {
                    await message.author.send({ embeds: [warnEmbed] });
                } catch (dmError) {
                    logger.warn(`Could not DM user ${message.author.tag}`);
                }
                
                if (warningCount >= 3) {
                    try {
                        await message.member.timeout(24 * 60 * 60 * 1000, '3 تحذيرات - لغة غير لائقة');
                        resetWarnings(message.guild.id, message.author.id);
                        logger.info(`User ${message.author.tag} muted for 1 day (3 warnings)`);
                    } catch (muteError) {
                        logger.error('Failed to mute user:', muteError);
                    }
                }
                
                logger.info(`Bad word deleted from ${message.author.tag} (Warning ${warningCount}/3)`);
                return;
                
            } catch (error) {
                logger.error('Auto-mod error:', error);
            }
        }
        
        // === AUTO REPLY ===
        for (const [trigger, reply] of Object.entries(AUTO_REPLIES)) {
            if (content.includes(trigger)) {
                try {
                    await message.reply(reply);
                } catch (error) {}
                break;
            }
        }
    }
};
