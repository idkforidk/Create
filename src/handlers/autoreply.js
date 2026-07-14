import { logger } from '../utils/logger.js';

// Auto reply triggers
const AUTO_REPLIES = {
    'انجب': 'انجب',
    'هاي': 'هاي يا وردة 🌹',
    'شلونك': 'الحمد لله، وأنت شلونك؟',
    'بوت': 'نعم حبيبي، شتريد؟ 🤖',
    'سلام': 'وعليكم السلام والرحمة 🌸',
    // Add more triggers here ↓
    // 'كلمة': 'الرد',
};

export default {
    name: 'autoReply',
    
    async execute(message, client) {
        // Ignore bot messages
        if (message.author.bot) return;
        
        // Ignore commands (messages starting with prefix)
        const prefix = client.config?.commands?.prefix || '!';
        if (message.content.startsWith(prefix)) return;
        
        const content = message.content.trim();
        
        // Check if message matches any trigger
        for (const [trigger, reply] of Object.entries(AUTO_REPLIES)) {
            if (content === trigger || content.includes(trigger)) {
                try {
                    await message.reply(reply);
                    logger.info(`Auto-reply triggered: "${trigger}" by ${message.author.tag}`);
                } catch (error) {
                    logger.error('Failed to send auto-reply:', error);
                }
                break; // Only trigger one reply
            }
        }
    }
};
