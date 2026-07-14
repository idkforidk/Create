import { EmbedBuilder, MessageFlags } from 'discord.js';
import { getColor } from '../config/bot.js';
import { logger } from '../utils/logger.js';

// Store warnings (in memory - resets on bot restart)
const warnings = new Map();

// Bad words list (English + Arabic)
const BAD_WORDS = [
    // English
    'fuck', 'shit', 'bitch', 'asshole', 'bastard', 'dick', 'pussy', 'cunt',
    'motherfucker', 'dumbass', 'jackass', 'whore', 'slut',
    
    // Arabic
    'كس', 'زب', 'طيز', 'منيوك', 'شرموط', 'عير', 'كلب', 'خول', 'متناك',
    'احا', 'خرة', 'زبالة', 'حقير', 'نجس', 'وسخ', 'قحبة', 'ديوث',
    'ابن الكلب', 'ابن القحبة', 'كس امك', 'كس اختك', 'طيزي',
    
    // Arabic in English letters
    'kos', 'zeb', 'tiz', 'manyok', 'sharmot', 'khawal', 'motanak',
    'kosomak', 'kosokhtak', 'kosom', 'ahbal', 'hayawan',
];

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

// Check if message contains bad words
function containsBadWord(content) {
    const lowerContent = content.toLowerCase();
    return BAD_WORDS.some(word => {
        const regex = new RegExp(`\\b${word}\\b|${word}`, 'i');
        return regex.test(lowerContent);
    });
}

// Get warnings for a user
function getUserWarnings(guildId, userId) {
    const key = `${guildId}-${userId}`;
    return warnings.get(key) || 0;
}

// Add warning for a user
function addWarning(guildId, userId) {
    const key = `${guildId}-${userId}`;
    const currentWarnings = getUserWarnings(guildId, userId);
    warnings.set(key, currentWarnings + 1);
    return currentWarnings + 1;
}

// Reset warnings for a user
function resetWarnings(guildId, userId) {
    const key = `${guildId}-${userId}`;
    warnings.delete(key);
}

export default {
    name: 'autoreply',
    
    async execute(message, client) {
        // Ignore bots
        if (message.author.bot) return;
        
        // Ignore commands
        const prefix = client.config?.commands?.prefix || '!';
        if (message.content.startsWith(prefix)) return;
        
        const content = message.content.trim();
        
        // === AUTO MOD - Check for bad words ===
        if (!message.member?.permissions.has('ManageMessages') && containsBadWord(content)) {
            try {
                // Delete the message
                await message.delete();
                
                // Add warning
                const warningCount = addWarning(message.guild.id, message.author.id);
                
                // Create warning embed
                const warnEmbed = new EmbedBuilder()
                    .setTitle('⚠️ تحذير - لغة غير لائقة')
                    .setDescription(`مرحباً ${message.author.username}،`)
                    .addFields(
                        { 
                            name: 'رسالتك انحذفت لإنها تحتوي على كلمات غير لائقة.',
                            value: '\u200B' 
                        },
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
                
                // Send DM to user
                try {
                    await message.author.send({ embeds: [warnEmbed] });
                } catch (dmError) {
                    logger.warn(`Could not DM user ${message.author.tag}`);
                }
                
                // If 3 warnings, mute for 1 day
                if (warningCount >= 3) {
                    try {
                        await message.member.timeout(24 * 60 * 60 * 1000, '3 تحذيرات - لغة غير لائقة');
                        
                        logger.info(`User ${message.author.tag} muted for 1 day (3 warnings)`);
                        
                        // Reset warnings after mute
                        resetWarnings(message.guild.id, message.author.id);
                        
                    } catch (muteError) {
                        logger.error('Failed to mute user:', muteError);
                    }
                }
                
                logger.info(`Bad word deleted from ${message.author.tag} (Warning ${warningCount}/3)`);
                return; // Stop here, don't send auto-reply
                
            } catch (error) {
                logger.error('Auto-mod error:', error);
            }
        }
        
        // === AUTO REPLY - Fun replies ===
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
