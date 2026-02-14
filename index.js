const express = require('express');
const path = require('path');
const login = require("fca-priyansh"); 
const fs = require("fs-extra"); // fs-extra ব্যবহার করা ভালো কারণ এটি fs এর সব কাজ করে + আরও ফিচার আছে
const { writeFileSync, unlinkSync, existsSync, readdirSync, readFileSync } = require("fs-extra");
const moment = require("moment-timezone");
const axios = require("axios");
const { join, resolve } = require("path");
const logger = require("./utils/log"); // আপনার utils ফোল্ডারের log.js থাকতে হবে

// ==========================================
//          GLOBAL VARIABLES SETUP
// ==========================================

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
    getTime: function (option) {
        switch (option) {
            case "seconds": return `${moment.tz("Asia/Kolkata").format("ss")}`;
            case "minutes": return `${moment.tz("Asia/Kolkata").format("mm")}`;
            case "hours": return `${moment.tz("Asia/Kolkata").format("HH")}`;
            case "date": return `${moment.tz("Asia/Kolkata").format("DD")}`;
            case "month": return `${moment.tz("Asia/Kolkata").format("MM")}`;
            case "year": return `${moment.tz("Asia/Kolkata").format("YYYY")}`;
            case "fullHour": return `${moment.tz("Asia/Kolkata").format("HH:mm:ss")}`;
            case "fullYear": return `${moment.tz("Asia/Kolkata").format("DD/MM/YYYY")}`;
            case "fullTime": return `${moment.tz("Asia/Kolkata").format("HH:mm:ss DD/MM/YYYY")}`;
        }
    }
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
global.nodemodule = new Object();
global.config = new Object();
global.configModule = new Object();
global.moduleData = new Array();
global.language = new Object();

// ==========================================
//          SERVER SETUP (EXPRESS)
// ==========================================

const app = express();
const port = process.env.PORT || 8080;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

let currentStatus = { percent: 0, message: "Waiting for cookies from Website..." };

app.get('/', (req, res) => res.sendFile(path.join(__dirname, '/index.html')));
app.get('/status', (req, res) => res.json(currentStatus));

app.post('/login', (req, res) => {
    const { appState } = req.body;
    if (!appState) return res.status(400).send("No AppState provided");

    try {
        writeFileSync("appstate.json", appState, 'utf8');
        startLoginProcess(JSON.parse(appState));
        res.send("Login process started...");
    } catch (e) {
        res.status(500).send("Error: " + e.message);
    }
});

app.post('/reset', (req, res) => {
    logger("Reset Request. Restarting server...", "[ RESET ]");
    if (existsSync("appstate.json")) unlinkSync("appstate.json");
    process.exit(1); 
});

app.listen(port, () => {
    logger(`Server is running on port ${port}`, "[ SERVER ]");
    if (existsSync("appstate.json")) {
        try {
            unlinkSync("appstate.json");
            logger("Cleaned up old session. Waiting for new login...", "[ CLEANUP ]");
        } catch (e) {}
    } else {
        logger("Waiting for user to input cookies on website...", "[ WAITING ]");
    }
});

// ==========================================
//          CORE FUNCTIONS
// ==========================================

function updateStatus(p, m) {
    currentStatus.percent = p;
    currentStatus.message = m;
    console.log(`[ LOAD ${p}% ] ${m}`);
}

// 1. লগইন প্রসেস
async function startLoginProcess(appState) {
    updateStatus(10, "Cookies Received. Verifying...");

    const loginData = { appState: appState };
    const options = { 
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36",
        forceLogin: true
    };

    login(loginData, options, async (err, api) => {
        if (err) {
            updateStatus(0, "Login Failed! Cookies are invalid or expired.");
            if (existsSync("appstate.json")) unlinkSync("appstate.json");
            return logger("Login Error: " + JSON.stringify(err), "[ ERROR ]");
        }

        updateStatus(50, "Login Success! Starting Bot Engine...");

        try {
            // এখান থেকেই সরাসরি বট ইঞ্জিন কল হবে (আলাদা ফাইল দরকার নেই)
            await startBotEngine(api); 
        } catch (error) {
            updateStatus(0, "Bot Engine Crash: " + error.message);
            logger("Engine Error: " + error, "[ CRASH ]");
        }
    });
}

// 2. মেইন বট ইঞ্জিন (Priyansh.js এর কোড এখানে নিয়ে আসা হয়েছে)
async function startBotEngine(api) {
    try {
        // --- CONFIG LOAD ---
        var configValue;
        try {
            global.client.configPath = join(global.client.mainPath, "config.json");
            configValue = require(global.client.configPath);
            logger.loader("Found file config: config.json");
        }
        catch {
            if (existsSync(global.client.configPath.replace(/\.json/g,"") + ".temp")) {
                configValue = readFileSync(global.client.configPath.replace(/\.json/g,"") + ".temp");
                configValue = JSON.parse(configValue);
            }
        }

        try {
            for (const key in configValue) global.config[key] = configValue[key];
        } catch { logger.loader("Can't load file config!", "error") }

        writeFileSync(global.client.configPath + ".temp", JSON.stringify(global.config, null, 4), 'utf8');

        // --- LANGUAGE LOAD ---
        const langFile = (readFileSync(`${__dirname}/languages/${global.config.language || "en"}.lang`, { encoding: 'utf-8' })).split(/\r?\n|\r/);
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

        global.getText = function (...args) {
            const langText = global.language;
            if (!langText.hasOwnProperty(args[0])) return "Language Key Not Found";
            var text = langText[args[0]][args[1]];
            for (var i = args.length - 1; i > 0; i--) {
                const regEx = RegExp(`%${i}`, 'g');
                text = text.replace(regEx, args[i + 1]);
            }
            return text;
        }

        // --- DATABASE ---
        updateStatus(60, "Connecting to Database...");
        const { Sequelize, sequelize } = require("./includes/database");
        await sequelize.authenticate();
        const authentication = {};
        authentication.Sequelize = Sequelize;
        authentication.sequelize = sequelize;
        const models = require('./includes/database/model')(authentication);
        logger(global.getText('priyansh', 'successConnectDatabase'), '[ DATABASE ]');

        // --- API SETTINGS ---
        global.client.api = api;
        api.setOptions(global.config.FCAOption);

        // --- LOAD COMMANDS ---
        updateStatus(70, "Loading Commands...");
        const listCommand = readdirSync(global.client.mainPath + '/Priyansh/commands').filter(command => command.endsWith('.js') && !command.includes('example') && !global.config.commandDisabled.includes(command));
        
        for (const command of listCommand) {
            try {
                var module = require(global.client.mainPath + '/Priyansh/commands/' + command);
                if (!module.config || !module.run || !module.config.commandCategory) continue;
                
                if (module.config.envConfig) {
                    try {
                        for (const envConfig in module.config.envConfig) {
                            if (typeof global.configModule[module.config.name] == 'undefined') global.configModule[module.config.name] = {};
                            if (typeof global.config[module.config.name] == 'undefined') global.config[module.config.name] = {};
                            if (typeof global.config[module.config.name][envConfig] !== 'undefined') global['configModule'][module.config.name][envConfig] = global.config[module.config.name][envConfig];
                            else global.configModule[module.config.name][envConfig] = module.config.envConfig[envConfig] || '';
                            if (typeof global.config[module.config.name][envConfig] == 'undefined') global.config[module.config.name][envConfig] = module.config.envConfig[envConfig] || '';
                        }
                    } catch (error) {}
                }

                if (module.onLoad) {
                    try {
                        const moduleData = { api: api, models: models };
                        module.onLoad(moduleData);
                    } catch (e) {};
                }

                if (module.handleEvent) global.client.eventRegistered.push(module.config.name);
                global.client.commands.set(module.config.name, module);
            } catch (error) {
                logger.loader(`Failed to load command: ${command} ` + error, 'error');
            };
        }

        // --- LOAD EVENTS ---
        updateStatus(80, "Loading Events...");
        const events = readdirSync(global.client.mainPath + '/Priyansh/events').filter(event => event.endsWith('.js') && !global.config.eventDisabled.includes(event));
        for (const ev of events) {
            try {
                var event = require(global.client.mainPath + '/Priyansh/events/' + ev);
                if (!event.config || !event.run) continue;
                
                if (event.onLoad) try {
                    const eventData = { api: api, models: models };
                    event.onLoad(eventData);
                } catch (e) {}
                global.client.events.set(event.config.name, event);
            } catch (error) {
                logger.loader(`Failed to load event: ${ev} ` + error, 'error');
            }
        }

        logger.loader(`Loaded ${global.client.commands.size} commands and ${global.client.events.size} events.`);
        
        // --- LISTENER START ---
        updateStatus(90, "Starting Listener...");
        const listenerData = { api: api, models: models };
        const listener = require('./includes/listen')(listenerData);

        function listenerCallback(error, message) {
            if (error) return logger("Listen Error: " + JSON.stringify(error), 'error');
            if (['presence', 'typ', 'read_receipt'].some(data => data == message.type)) return;
            return listener(message);
        };
        
        global.handleListen = api.listenMqtt(listenerCallback);
        
        updateStatus(100, "Bot is Active & Running!");

    } catch (error) {
        updateStatus(0, "System Error: " + error.message);
        logger("Error in BotEngine: " + error, 'error');
    }
}

// পিং (ঐচ্ছিক)
try { require("./ping")(); } catch (e) {}
process.on('unhandledRejection', (err, p) => {});
