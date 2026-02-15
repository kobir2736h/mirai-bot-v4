const moment = require("moment-timezone");
const { readdirSync, readFileSync, writeFileSync, existsSync, unlinkSync, rm } = require("fs-extra");
const { join, resolve } = require("path");
// const { execSync } = require('child_process'); // অটো ইনস্টল রিমুভ করা হয়েছে
const logger = require("./utils/log.js");
const axios = require("axios");

// 1. GLOBAL VARIABLES SETUP

global.whitelistUser = new Set();
global.whitelistThread = new Set();
global.whitelistUserToggle = false;
global.whitelistThreadToggle = false;

global.client = new Object({
    commands: new Map(),
    events: new Map(),
    cooldowns: new Map(),
    eventRegistered: new Array(),
    handleSchedule: new Array(),
    handleReaction: new Array(),
    handleReply: new Array(),
    mainPath: process.cwd(),
    configPath: new String(),
});

global.data = new Object({
    threadInfo: new Map(),
    threadData: new Map(),
    userName: new Map(),
    commandBanned: new Map(),
    threadAllowNSFW: new Array(),
    allUserID: new Array(),
    allCurrenciesID: new Array(),
    allThreadID: new Array()
});

global.utils = require("./utils");
// global.nodemodule = new Object(); // এটি রিমুভ করা হয়েছে
global.config = new Object();
global.configModule = new Object();
global.moduleData = new Array();
global.language = new Object();

// 2. LOAD CONFIGURATION

var configValue;
try {
    global.client.configPath = join(global.client.mainPath, "config.json");
    configValue = require(global.client.configPath);
    logger.loader("Found file config: config.json");
} catch {
    if (existsSync(global.client.configPath.replace(/\.json/g, "") + ".temp")) {
        configValue = readFileSync(global.client.configPath.replace(/\.json/g, "") + ".temp");
        configValue = JSON.parse(configValue);
        logger.loader(`Found: ${global.client.configPath.replace(/\.json/g, "") + ".temp"}`);
    } else logger.loader("config.json not found!", "error");
}

try {
    for (const key in configValue) global.config[key] = configValue[key];
    logger.loader("Config Loaded!");
} catch {
    logger.loader("Can't load file config!", "error")
}

writeFileSync(global.client.configPath + ".temp", JSON.stringify(global.config, null, 4), 'utf8');

// 3. DATABASE IMPORT

const { Sequelize, sequelize } = require("./includes/database");

// 4. LOAD LANGUAGE

const langFile = (readFileSync(`${__dirname}/languages/${global.config.language || "en"}.lang`, {
    encoding: 'utf-8'
})).split(/\r?\n|\r/);
const langData = langFile.filter(item => item.indexOf('#') != 0 && item != '');
for (const item of langData) {
    const getSeparator = item.indexOf('=');
    const itemKey = item.slice(0, getSeparator);
    const itemValue = item.slice(getSeparator + 1, item.length);
    const head = itemKey.slice(0, itemKey.indexOf('.'));
    const key = itemKey.replace(head + '.', '');
    const value = itemValue.replace(/\\n/gi, '\n');
    if (typeof global.language[head] == "undefined") global.language[head] = new Object();
    global.language[head][key] = value;
}

global.getText = function(...args) {
    const langText = global.language;
    if (!langText.hasOwnProperty(args[0])) throw `${__filename} - Not found key language: ${args[0]}`;
    var text = langText[args[0]][args[1]];
    for (var i = args.length - 1; i > 0; i--) {
        const regEx = RegExp(`%${i}`, 'g');
        text = text.replace(regEx, args[i + 1]);
    }
    return text;
}

// ====================================================
// 5. MAIN FUNCTION
// ====================================================

module.exports = async function startPriyansh(api, updateStatus) {
    try {
        // ১. ডাটাবেস কানেকশন
        updateStatus(60, "Connecting to Database...");
        await sequelize.authenticate();
        const authentication = {};
        authentication.Sequelize = Sequelize;
        authentication.sequelize = sequelize;
        const models = require('./includes/database/model')(authentication);
        logger(global.getText('priyansh', 'successConnectDatabase'), '[ DATABASE ]');

        // ২. API সেটআপ
        global.client.api = api;
        api.setOptions(global.config.FCAOption);

        // ৩. কমান্ড লোড
        updateStatus(70, "Loading Commands...");
        const listCommand = readdirSync(global.client.mainPath + '/Priyansh/commands').filter(command => command.endsWith('.js') && !command.includes('example') && !global.config.commandDisabled.includes(command));
        
        for (const command of listCommand) {
            try {
                var module = require(global.client.mainPath + '/Priyansh/commands/' + command);
                if (!module.config || !module.run || !module.config.commandCategory) throw new Error(global.getText('priyansh', 'errorFormat'));
                if (global.client.commands.has(module.config.name || '')) throw new Error(global.getText('priyansh', 'nameExist'));

                // ==========================================================
                // NEW DEPENDENCY CHECK (Warning System)
                // ==========================================================
                if (module.config.dependencies && typeof module.config.dependencies == 'object') {
                    for (const reqDependency in module.config.dependencies) {
                        try {
                            // চেক করবে প্যাকেজটি ইনস্টল করা আছে কিনা
                            require.resolve(reqDependency);
                        } catch (err) {
                            // যদি প্যাকেজ না থাকে, তাহলে ওয়ার্নিং দিবে (কিন্তু ক্র্যাশ করবে না)
                            logger.loader(`Command '${module.config.name}' requires package '${reqDependency}' but it is missing! Please install it using: npm install ${reqDependency}`, "warn");
                        }
                    }
                }
                // ==========================================================

                if (module.config.envConfig) {
                    try {
                        for (const envConfig in module.config.envConfig) {
                            if (typeof global.configModule[module.config.name] == 'undefined') global.configModule[module.config.name] = {};
                            if (typeof global.config[module.config.name] == 'undefined') global.config[module.config.name] = {};
                            if (typeof global.config[module.config.name][envConfig] !== 'undefined') global['configModule'][module.config.name][envConfig] = global.config[module.config.name][envConfig];
                            else global.configModule[module.config.name][envConfig] = module.config.envConfig[envConfig] || '';
                            if (typeof global.config[module.config.name][envConfig] == 'undefined') global.config[module.config.name][envConfig] = module.config.envConfig[envConfig] || '';
                        }
                        // logger.loader(global.getText('priyansh', 'loadedConfig', module.config.name));
                    } catch (error) {
                        throw new Error(global.getText('priyansh', 'loadedConfig', module.config.name, JSON.stringify(error)));
                    }
                }

                if (module.onLoad) {
                    try {
                        const moduleData = {
                            api: api,
                            models: models
                        };
                        module.onLoad(moduleData);
                    } catch (_0x20fd5f) {
                        throw new Error(global.getText('priyansh', 'cantOnload', module.config.name, JSON.stringify(_0x20fd5f)), 'error');
                    };
                }

                if (module.handleEvent) global.client.eventRegistered.push(module.config.name);
                global.client.commands.set(module.config.name, module);
                logger.loader(global.getText('priyansh', 'successLoadModule', module.config.name));
            } catch (error) {
                logger.loader(global.getText('priyansh', 'failLoadModule', command, error), 'error');
            };
        }

        // ৪. ইভেন্ট লোড
        updateStatus(80, "Loading Events...");
        const events = readdirSync(global.client.mainPath + '/Priyansh/events').filter(event => event.endsWith('.js') && !global.config.eventDisabled.includes(event));
        for (const ev of events) {
            try {
                var event = require(global.client.mainPath + '/Priyansh/events/' + ev);
                if (!event.config || !event.run) throw new Error(global.getText('priyansh', 'errorFormat'));
                if (global.client.events.has(event.config.name) || '') throw new Error(global.getText('priyansh', 'nameExist'));
                if (event.onLoad) try {
                    const eventData = {
                        api: api,
                        models: models
                    };
                    event.onLoad(eventData);
                } catch (error) {
                    throw new Error(global.getText('priyansh', 'cantOnload', event.config.name, JSON.stringify(error)), 'error');
                }
                global.client.events.set(event.config.name, event);
                logger.loader(global.getText('priyansh', 'successLoadModule', event.config.name));
            } catch (error) {
                logger.loader(global.getText('priyansh', 'failLoadModule', event.config.name, error), 'error');
            }
        }
        logger.loader(global.getText('priyansh', 'finishLoadModule', global.client.commands.size, global.client.events.size));

        // ৫. লিসেনার চালু করা
        updateStatus(90, "Starting Listener...");
        const listenerData = {
            api: api,
            models: models
        };
        const listener = require('./includes/listen')(listenerData);

        function listenerCallback(error, message) {
            if (error) return logger(global.getText('priyansh', 'handleListenError', JSON.stringify(error)), 'error');
            if (['presence', 'typ', 'read_receipt'].some(data => data == message.type)) return;
            if (global.config.DeveloperMode == !![]) console.log(message);
            return listener(message);
        };
        global.handleListen = api.listenMqtt(listenerCallback);
        updateStatus(100, "Bot is Active & Running!");

    } catch (error) {
        updateStatus(0, "System Error: " + error.message);
        logger("Error in Priyansh.js: " + error, 'error');
    }
};

process.on('unhandledRejection', (err, p) => {});
