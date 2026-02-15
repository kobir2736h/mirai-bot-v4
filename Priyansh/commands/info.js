module.exports.config = {
        name: "info",
        version: "1.0.0",
        hasPermssion: 0,
        credits: "kawsar", 
        description: "View system and bot information",
        commandCategory: "system",
        usages: "",
        cooldowns: 5,
        dependencies: {
                "os": "",
                "moment-timezone": ""
        }
};

module.exports.run = async function({ api, event, client }) {
        const os = require('os');
        const moment = require('moment-timezone');

        // সময় বের করা (Dhaka Timezone)
        const timeNow = moment.tz("Asia/Dhaka").format("DD/MM/YYYY || HH:mm:ss");

        // আপটাইম ক্যালকুলেশন (বট কতক্ষণ ধরে অন আছে)
        const uptime = process.uptime();
        const days = Math.floor(uptime / (3600 * 24));
        const hours = Math.floor((uptime % (3600 * 24)) / 3600);
        const minutes = Math.floor((uptime % 3600) / 60);
        const seconds = Math.floor(uptime % 60);

        // মেমোরি (RAM) এবং প্রসেসর ইনফো
        const totalMemory = os.totalmem();
        const freeMemory = os.freemem();
        const usedMemory = totalMemory - freeMemory;
        const cpuModel = os.cpus()[0].model;

      
        function formatBytes(bytes) {
                if (bytes === 0) return '0 Bytes';
                const k = 1024;
                const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
                const i = Math.floor(Math.log(bytes) / Math.log(k));
                return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
        }

        const totalUsers = global.data.allUserID ? global.data.allUserID.length : "Unknown";
        const totalGroups = global.data.allThreadID ? global.data.allThreadID.length : "Unknown";
        const totalCommands = global.client.commands ? global.client.commands.size : "Unknown";

        // মেসেজ সাজানো
        const msg = `
»======== 𝐀𝐃𝐌𝐈𝐍 𝐈𝐍𝐅𝐎 ========«

👤 𝐁𝐨𝐭 𝐍𝐚𝐦𝐞: ${global.config.BOTNAME || "System Bot"}
👑 𝐂𝐫𝐞𝐝𝐢𝐭: ${module.exports.config.credits}
🏷 𝐏𝐫𝐞𝐟𝐢𝐱: ${global.config.PREFIX}

📊 𝐒𝐲𝐬𝐭𝐞𝐦 𝐒𝐭𝐚𝐭𝐮𝐬:
• 𝐎𝐒: ${os.type()} (${os.arch()})
• 𝐂𝐏𝐔: ${cpuModel}
• 𝐑𝐀𝐌: ${formatBytes(usedMemory)} / ${formatBytes(totalMemory)}
• 𝐔𝐩𝐭𝐢𝐦𝐞: ${days}d ${hours}h ${minutes}m ${seconds}s

🌍 𝐁𝐨𝐭 𝐒𝐭𝐚𝐭𝐬:
• 𝐓𝐨𝐭𝐚𝐥 𝐔𝐬𝐞𝐫𝐬: ${totalUsers}
• 𝐓𝐨𝐭𝐚𝐥 𝐆𝐫𝐨𝐮𝐩𝐬: ${totalGroups}
• 𝐓𝐨𝐭𝐚𝐥 𝐂𝐦𝐝𝐬: ${totalCommands}

⏰ 𝐓𝐢𝐦𝐞: ${timeNow} (Dhaka)
»==========================«
`;

        return api.sendMessage(msg, event.threadID, event.messageID);
};
