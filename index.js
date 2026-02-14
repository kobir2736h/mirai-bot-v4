const express = require('express');
const path = require('path');
const login = require("fca-priyansh");
const fs = require("fs-extra"); // fs-extra covers both fs and fs-extra usage
const { readdirSync, readFileSync, writeFileSync, existsSync, unlinkSync, rm } = require("fs-extra");
const { join, resolve } = require("path");
const { execSync } = require('child_process');
const moment = require("moment-timezone");
const axios = require("axios");
const logger = require("./utils/log.js");

// Load dependencies info
const listPackage = JSON.parse(readFileSync('./package.json')).dependencies;
const listbuiltinModules = require("module").builtinModules;

const app = express();
const port = process.env.PORT || 8080;

// ====================================================
// 1. GLOBAL VARIABLES SETUP
// ====================================================

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

// ====================================================
// 2. SERVER & ROUTES (EXPRESS APP)
// ====================================================

// JSON data limit increased for cookies
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

let currentStatus = { percent: 0, message: "Waiting for cookies from Website..." };

// Route: Home
app.get('/', (req, res) => res.sendFile(path.join(__dirname, '/index.html')));

// Route: Check Status
app.get('/status', (req, res) => res.json(currentStatus));

// Route: Login
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

// Route: Reset
app.post('/reset', (req, res) => {
    logger("Reset Request. Restarting server...", "[ RESET ]");
    if (existsSync("appstate.json")) unlinkSync("appstate.json");
    process.exit(1);
});

// Start Server
app.listen(port, () => {
    logger(`Server is running on port ${port}`, "[ SERVER ]");

    if (existsSync("appstate.json")) {
        try {
            unlinkSync("appstate.json");
            logger("Cleaned up old session. Waiting for new login...", "[ CLEANUP ]");
        } catch (e) {
            logger("Could not delete old appstate: " + e.message, "[ ERROR ]");
        }
    } else {
        logger("Waiting for user to input cookies on website...", "[ WAITING ]");
    }
});

// ====================================================
// 3. CORE FUNCTIONS (LOGIN & STATUS)
// ====================================================

function updateStatus(p, m) {
    currentStatus.percent = p;
    currentStatus.message = m;
    console.log(`[ LOAD ${p}% ] ${m}`);
}

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
            // Calling the internal bot logic function
            await startPriyanshBot(api, updateStatus);
        } catch (error) {
            updateStatus(0, "Bot Engine Crash: " + error.message);
            logger("Priyansh.js Error: " + error, "[ CRASH ]");
        }
    });
}

// Ping function to keep server alive
try {
    require("./ping")();
} catch (e) {}

// ====================================================
// 4. BOT ENGINE LOGIC (Merged from Priyansh.js)
// ====================================================

async function startPriyanshBot(api, updateStatus) {
    try {
        // --- A. LOAD CONFIGURATION ---
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
                logger.loader(`Found: ${global.client.configPath.replace(/\.json/g,"") + ".temp"}`);
            }
            else logger.loader("config.json not found!", "error");
        }

        try {
            for (const key in configValue) global.config[key] = configValue[key];
            logger.loader("Config Loaded!");
        }
        catch { logger.loader("Can't load file config!", "error") }

        writeFileSync(global.client.configPath + ".temp", JSON.stringify(global.config, null, 4), 'utf8');

        // --- B. DATABASE IMPORT ---
        const { Sequelize, sequelize } = require("./includes/database");

        // --- C. LOAD LANGUAGE ---
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
            if (!langText.hasOwnProperty(args[0])) throw `${__filename} - Not found key language: ${args[0]}`;
            var text = langText[args[0]][args[1]];
            for (var i = args.length - 1; i > 0; i--) {
                const regEx = RegExp(`%${i}`, 'g');
                text = text.replace(regEx, args[i + 1]);
            }
            return text;
        }

        // --- D. MAIN STARTUP SEQUENCE ---

        // 1. Database Connection
        updateStatus(60, "Connecting to Database...");
        await sequelize.authenticate();
        const authentication = {};
        authentication.Sequelize = Sequelize;
        authentication.sequelize = sequelize;
        const models = require('./includes/database/model')(authentication);
        logger(global.getText('priyansh', 'successConnectDatabase'), '[ DATABASE ]');

        // 2. API Setup
        global.client.api = api;
        api.setOptions(global.config.FCAOption);

        // 3. Load Commands
        updateStatus(70, "Loading Commands...");
        const listCommand = readdirSync(global.client.mainPath + '/Priyansh/commands').filter(command => command.endsWith('.js') && !command.includes('example') && !global.config.commandDisabled.includes(command));

        for (const command of listCommand) {
            try {
                var module = require(global.client.mainPath + '/Priyansh/commands/' + command);
                if (!module.config || !module.run || !module.config.commandCategory) throw new Error(global.getText('priyansh', 'errorFormat'));
                if (global.client.commands.has(module.config.name || '')) throw new Error(global.getText('priyansh', 'nameExist'));

                // Dependencies Logic
                if (module.config.dependencies && typeof module.config.dependencies == 'object') {
                    for (const reqDependencies in module.config.dependencies) {
                        const reqDependenciesPath = join(__dirname, 'nodemodules', 'node_modules', reqDependencies);
                        try {
                            if (!global.nodemodule.hasOwnProperty(reqDependencies)) {
                                if (listPackage.hasOwnProperty(reqDependencies) || listbuiltinModules.includes(reqDependencies)) global.nodemodule[reqDependencies] = require(reqDependencies);
                                else global.nodemodule[reqDependencies] = require(reqDependenciesPath);
                            }
                        } catch {
                            // Install Logic
                            execSync('npm --package-lock false --save install ' + reqDependencies, { 'stdio': 'inherit', 'env': process['env'], 'shell': true, 'cwd': join(__dirname, 'nodemodules') });
                            require['cache'] = {};
                            global['nodemodule'][reqDependencies] = require(reqDependencies);
                        }
                    }
                    logger.loader(global.getText('priyansh', 'loadedPackage', module.config.name));
                }

                if (module.config.envConfig) {
                    try {
                        for (const envConfig in module.config.envConfig) {
                            if (typeof global.configModule[module.config.name] == 'undefined') global.configModule[module.config.name] = {};
                            if (typeof global.config[module.config.name] == 'undefined') global.config[module.config.name] = {};
                            if (typeof global.config[module.config.name][envConfig] !== 'undefined') global['configModule'][module.config.name][envConfig] = global.config[module.config.name][envConfig];
                            else global.configModule[module.config.name][envConfig] = module.config.envConfig[envConfig] || '';
                            if (typeof global.config[module.config.name][envConfig] == 'undefined') global.config[module.config.name][envConfig] = module.config.envConfig[envConfig] || '';
                        }
                        logger.loader(global.getText('priyansh', 'loadedConfig', module.config.name));
                    } catch (error) {
                        throw new Error(global.getText('priyansh', 'loadedConfig', module.config.name, JSON.stringify(error)));
                    }
                }

                if (module.onLoad) {
                    try {
                        const moduleData = { api: api, models: models };
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

        // 4. Load Events
        updateStatus(80, "Loading Events...");
        const events = readdirSync(global.client.mainPath + '/Priyansh/events').filter(event => event.endsWith('.js') && !global.config.eventDisabled.includes(event));
        for (const ev of events) {
            try {
                var event = require(global.client.mainPath + '/Priyansh/events/' + ev);
                if (!event.config || !event.run) throw new Error(global.getText('priyansh', 'errorFormat'));
                if (global.client.events.has(event.config.name) || '') throw new Error(global.getText('priyansh', 'nameExist'));

                if (event.onLoad) try {
                    const eventData = { api: api, models: models };
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

        // 5. Start Listener
        updateStatus(90, "Starting Listener...");
        const listenerData = { api: api, models: models };
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
        logger("Error in PriyanshBot: " + error, 'error');
    }
};

process.on('unhandledRejection', (err, p) => {});
