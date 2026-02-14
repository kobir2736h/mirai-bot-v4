const express = require('express');
const path = require('path');
const { join, resolve } = require("path");
const { readdirSync, readFileSync, writeFileSync, existsSync, unlinkSync } = require("fs-extra");
const login = require("fca-priyansh");
const moment = require("moment-timezone");
const { execSync } = require('child_process');
const logger = require("./utils/log.js");

// [FIXED] ডাটাবেস রিকোয়ার এখান থেকে সরিয়ে নিচে startBotRuntime এ নেওয়া হয়েছে

const app = express();
const port = process.env.PORT || 8080;

// ====================================================
// 1. GLOBAL VARIABLES SETUP
// ====================================================

// আগে প্যাকেজ লিস্ট লোড করে নিচ্ছি
let listPackage = {};
let listbuiltinModules = [];
try {
    if (existsSync('./package.json')) {
        listPackage = JSON.parse(readFileSync('./package.json')).dependencies;
    }
    listbuiltinModules = require("module").builtinModules;
} catch (e) {
    // package.json না থাকলে এরর এড়ানোর জন্য
}

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
    configPath: join(process.cwd(), "config.json"),
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
global.language = new Object();

// ====================================================
// 2. ASSET LOADER FUNCTION
// ====================================================

let assetsLoaded = false;

function loadSystemAssets() {
    if (assetsLoaded) return;
    logger.loader("Initializing System Assets...");

    // A. Load Config
    try {
        var configValue;
        if (existsSync(global.client.configPath)) {
            configValue = require(global.client.configPath);
            logger.loader("Found file config: config.json");
        } else if (existsSync(global.client.configPath.replace(/\.json/g,"") + ".temp")) {
            configValue = readFileSync(global.client.configPath.replace(/\.json/g,"") + ".temp");
            configValue = JSON.parse(configValue);
            logger.loader("Found temp config.");
        } else {
            logger.loader("Config file not found!", "error");
            return; 
        }

        for (const key in configValue) global.config[key] = configValue[key];
    } catch (e) {
        logger.loader("Config load error: " + e.message, "error");
    }

    // Safety check
    if (!global.config.commandDisabled) global.config.commandDisabled = [];
    if (!global.config.eventDisabled) global.config.eventDisabled = [];

    // B. Load Language
    try {
        const langPath = join(__dirname, 'languages', `${global.config.language || "en"}.lang`);
        const langFile = (readFileSync(langPath, { encoding: 'utf-8' })).split(/\r?\n|\r/);
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
            if (!langText.hasOwnProperty(args[0])) return "Language Key Missing";
            var text = langText[args[0]][args[1]];
            for (var i = args.length - 1; i > 0; i--) {
                const regEx = RegExp(`%${i}`, 'g');
                text = text.replace(regEx, args[i + 1]);
            }
            return text;
        }
    } catch (e) {
        logger.loader("Language load error: " + e.message, "error");
    }

    // C. Load Commands
    try {
        const commandPath = join(global.client.mainPath, 'Priyansh', 'commands');
        if (existsSync(commandPath)) {
            const listCommand = readdirSync(commandPath).filter(command => command.endsWith('.js') && !command.includes('example') && !global.config.commandDisabled.includes(command));
            
            for (const command of listCommand) {
                try {
                    var module = require(join(commandPath, command));
                    if (!module.config || !module.run || !module.config.commandCategory) continue;
                    
                    if (module.config.dependencies) {
                        for (const reqDependencies in module.config.dependencies) {
                            try {
                                if (!global.nodemodule.hasOwnProperty(reqDependencies)) {
                                    if (listPackage.hasOwnProperty(reqDependencies) || listbuiltinModules.includes(reqDependencies)) global.nodemodule[reqDependencies] = require(reqDependencies);
                                    else {
                                         const reqPath = join(__dirname, 'nodemodules', 'node_modules', reqDependencies);
                                         global.nodemodule[reqDependencies] = require(reqPath);
                                    }
                                }
                            } catch {
                                // Silent fail
                            }
                        }
                    }

                    if (module.config.envConfig) {
                        for (const envConfig in module.config.envConfig) {
                            if (typeof global.configModule[module.config.name] == 'undefined') global.configModule[module.config.name] = {};
                            if (typeof global.config[module.config.name] == 'undefined') global.config[module.config.name] = {};
                            if (typeof global.config[module.config.name][envConfig] !== 'undefined') global['configModule'][module.config.name][envConfig] = global.config[module.config.name][envConfig];
                            else global.configModule[module.config.name][envConfig] = module.config.envConfig[envConfig] || '';
                            if (typeof global.config[module.config.name][envConfig] == 'undefined') global.config[module.config.name][envConfig] = module.config.envConfig[envConfig] || '';
                        }
                    }

                    if (module.handleEvent) global.client.eventRegistered.push(module.config.name);
                    global.client.commands.set(module.config.name, module);
                } catch (error) {
                    // Just skip failed commands
                }
            }
            logger.loader(`Loaded ${global.client.commands.size} commands.`);
        }
    } catch (e) {
        logger.loader("Command loading error: " + e.message, "error");
    }

    // D. Load Events
    try {
        const eventPath = join(global.client.mainPath, 'Priyansh', 'events');
        if (existsSync(eventPath)) {
            const events = readdirSync(eventPath).filter(event => event.endsWith('.js') && !global.config.eventDisabled.includes(event));
            for (const ev of events) {
                try {
                    var event = require(join(eventPath, ev));
                    if (!event.config || !event.run) continue;
                    global.client.events.set(event.config.name, event);
                } catch (error) {}
            }
            logger.loader(`Loaded ${global.client.events.size} events.`);
        }
    } catch (e) {
        logger.loader("Event loading error: " + e.message, "error");
    }

    assetsLoaded = true;
    logger.loader("System Assets Initialization Complete!");
}

// Start loading assets
loadSystemAssets();

// ====================================================
// 3. SERVER & ROUTES
// ====================================================

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

let currentStatus = { percent: 0, message: "Waiting for cookies..." };
if (assetsLoaded) currentStatus.message = "System ready. Waiting for cookies...";

app.get('/', (req, res) => res.sendFile(path.join(__dirname, '/index.html')));
app.get('/status', (req, res) => res.json(currentStatus));

app.post('/login', (req, res) => {
    const { appState } = req.body;
    if (!appState) return res.status(400).send("No AppState");
    try {
        writeFileSync("appstate.json", appState, 'utf8');
        if (!assetsLoaded) loadSystemAssets();
        
        startBotRuntime(JSON.parse(appState));
        res.send("Login started...");
    } catch (e) {
        res.status(500).send("Error: " + e.message);
    }
});

app.post('/reset', (req, res) => {
    if (existsSync("appstate.json")) unlinkSync("appstate.json");
    process.exit(1);
});

app.listen(port, () => {
    logger(`Server running on port ${port}`, "[ SERVER ]");
    if (existsSync("appstate.json")) {
        try { unlinkSync("appstate.json"); } catch {}
    }
});

// ====================================================
// 4. BOT RUNTIME
// ====================================================

function updateStatus(p, m) {
    currentStatus.percent = p;
    currentStatus.message = m;
    console.log(`[ LOAD ${p}% ] ${m}`);
}

async function startBotRuntime(appState) {
    updateStatus(10, "Verifying Cookies...");
    
    const loginData = { appState: appState };
    const options = {
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36",
        forceLogin: true
    };

    login(loginData, options, async (err, api) => {
        if (err) {
            updateStatus(0, "Login Failed! Bad Cookies.");
            if (existsSync("appstate.json")) unlinkSync("appstate.json");
            return logger("Login Error: " + JSON.stringify(err), "[ ERROR ]");
        }

        updateStatus(50, "Login Success! Connecting Database...");

        try {
            // [FIXED] ডাটাবেস এখানে লোড হবে, কারণ এখন global.config রেডি আছে
            const { Sequelize, sequelize } = require("./includes/database");

            await sequelize.authenticate();
            const authentication = { Sequelize, sequelize };
            const models = require('./includes/database/model')(authentication);
            logger(global.getText('priyansh', 'successConnectDatabase'), '[ DATABASE ]');

            global.client.api = api;
            api.setOptions(global.config.FCAOption);

            updateStatus(70, "Initializing Commands...");
            for (const [name, module] of global.client.commands) {
                if (module.onLoad) {
                    try { module.onLoad({ api, models }); } catch (e) {}
                }
            }

            for (const [name, event] of global.client.events) {
                if (event.onLoad) {
                    try { event.onLoad({ api, models }); } catch (e) {}
                }
            }

            updateStatus(90, "Starting Listener...");
            const listenerData = { api: api, models: models };
            const listener = require('./includes/listen')(listenerData);

            global.handleListen = api.listenMqtt((error, message) => {
                if (error) return;
                if (global.config.DeveloperMode) console.log(message);
                listener(message);
            });

            updateStatus(100, "Bot is Active & Running!");

        } catch (error) {
            updateStatus(0, "Runtime Error: " + error.message);
            logger("Bot Runtime Error: " + error, "[ CRASH ]");
        }
    });
}

try { require("./ping")(); } catch {}

process.on('unhandledRejection', (err) => logger("Unhandled: " + err.message, "error"));
