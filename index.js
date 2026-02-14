const express = require('express');
const path = require('path');
const { join, resolve } = require("path"); // এটি সবার উপরে থাকতে হবে
const { readdirSync, readFileSync, writeFileSync, existsSync, unlinkSync } = require("fs-extra");
const login = require("fca-priyansh");
const moment = require("moment-timezone");
const { execSync } = require('child_process');
const logger = require("./utils/log.js");

// Database dependencies handled later or strictly here
const { Sequelize, sequelize } = require("./includes/database");

const app = express();
const port = process.env.PORT || 8080;

// ====================================================
// 1. GLOBAL VARIABLES SETUP
// ====================================================

// আগে প্যাকেজ লিস্ট লোড করে নিচ্ছি যাতে পরে সমস্যা না হয়
let listPackage = {};
let listbuiltinModules = [];
try {
    listPackage = JSON.parse(readFileSync('./package.json')).dependencies;
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
    configPath: join(process.cwd(), "config.json"), // এখন join কাজ করবে
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
// 2. ASSET LOADER FUNCTION (শুধুমাত্র ফাইল লোড করার জন্য)
// ====================================================

let assetsLoaded = false;

function loadSystemAssets() {
    if (assetsLoaded) return;
    logger.loader("Initializing System Assets...");

    // A. Load Config
    try {
        var configValue = require(global.client.configPath);
        logger.loader("Found file config: config.json");
        for (const key in configValue) global.config[key] = configValue[key];
    } catch {
        if (existsSync(global.client.configPath.replace(/\.json/g,"") + ".temp")) {
            configValue = readFileSync(global.client.configPath.replace(/\.json/g,"") + ".temp");
            configValue = JSON.parse(configValue);
            for (const key in configValue) global.config[key] = configValue[key];
        } else {
            logger.loader("Config file not found!", "error");
        }
    }

    // Safety: Ensure arrays exist
    if (!global.config.commandDisabled) global.config.commandDisabled = [];
    if (!global.config.eventDisabled) global.config.eventDisabled = [];

    // B. Load Language
    try {
        const langPath = `${__dirname}/languages/${global.config.language || "en"}.lang`;
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

    // C. Load Commands (Only Requires, No execution of onLoad yet)
    try {
        const listCommand = readdirSync(global.client.mainPath + '/Priyansh/commands').filter(command => command.endsWith('.js') && !command.includes('example') && !global.config.commandDisabled.includes(command));
        
        for (const command of listCommand) {
            try {
                var module = require(global.client.mainPath + '/Priyansh/commands/' + command);
                if (!module.config || !module.run || !module.config.commandCategory) continue;
                
                // Dependencies Install Check
                if (module.config.dependencies) {
                    for (const reqDependencies in module.config.dependencies) {
                        const reqDependenciesPath = join(__dirname, 'nodemodules', 'node_modules', reqDependencies);
                        try {
                            if (!global.nodemodule.hasOwnProperty(reqDependencies)) {
                                if (listPackage.hasOwnProperty(reqDependencies) || listbuiltinModules.includes(reqDependencies)) global.nodemodule[reqDependencies] = require(reqDependencies);
                                else global.nodemodule[reqDependencies] = require(reqDependenciesPath);
                            }
                        } catch {
                            // Silent install
                            try {
                                execSync('npm --package-lock false --save install ' + reqDependencies, { 'stdio': 'inherit', 'env': process['env'], 'shell': true, 'cwd': join(__dirname, 'nodemodules') });
                                require['cache'] = {};
                                global['nodemodule'][reqDependencies] = require(reqDependencies);
                            } catch(e) {}
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
                logger.loader(`Failed to load command ${command}: ${error}`, 'error');
            }
        }
        logger.loader(`Loaded ${global.client.commands.size} commands.`);
    } catch (e) {
        logger.loader("Command folder not found!", "error");
    }

    // D. Load Events
    try {
        const events = readdirSync(global.client.mainPath + '/Priyansh/events').filter(event => event.endsWith('.js') && !global.config.eventDisabled.includes(event));
        for (const ev of events) {
            try {
                var event = require(global.client.mainPath + '/Priyansh/events/' + ev);
                if (!event.config || !event.run) continue;
                global.client.events.set(event.config.name, event);
            } catch (error) {
                logger.loader(`Failed to load event ${ev}: ${error}`, 'error');
            }
        }
        logger.loader(`Loaded ${global.client.events.size} events.`);
    } catch (e) {
        logger.loader("Event folder not found!", "error");
    }

    assetsLoaded = true;
    logger.loader("System Assets Initialization Complete!");
}

// Start loading assets immediately
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
    logger("Reset Request. Restarting process...", "[ RESET ]");
    if (existsSync("appstate.json")) unlinkSync("appstate.json");
    process.exit(1);
});

app.listen(port, () => {
    logger(`Server running on port ${port}`, "[ SERVER ]");
    if (existsSync("appstate.json")) {
        try {
            unlinkSync("appstate.json");
            logger("Old session cleared.", "[ CLEANUP ]");
        } catch {}
    }
});

// ====================================================
// 4. BOT RUNTIME (Repeats on Login)
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
            // 1. Database Connection (Repeatable)
            await sequelize.authenticate();
            const authentication = { Sequelize, sequelize };
            const models = require('./includes/database/model')(authentication);
            logger(global.getText('priyansh', 'successConnectDatabase'), '[ DATABASE ]');

            // 2. Set API Options
            global.client.api = api;
            api.setOptions(global.config.FCAOption);

            // 3. Execute onLoad for Commands (Repeatable - using pre-loaded modules)
            updateStatus(70, "Initializing Commands...");
            for (const [name, module] of global.client.commands) {
                if (module.onLoad) {
                    try {
                        module.onLoad({ api, models });
                    } catch (error) {
                        logger.loader(`Error in onLoad for ${name}: ${error.message}`, 'error');
                    }
                }
            }

            // 4. Execute onLoad for Events
            for (const [name, event] of global.client.events) {
                if (event.onLoad) {
                    try {
                        event.onLoad({ api, models });
                    } catch (error) {
                        logger.loader(`Error in onLoad for event ${name}: ${error.message}`, 'error');
                    }
                }
            }

            // 5. Start Listener
            updateStatus(90, "Starting Listener...");
            const listenerData = { api: api, models: models };
            const listener = require('./includes/listen')(listenerData);

            function listenerCallback(error, message) {
                if (error) return logger("Listen Error: " + JSON.stringify(error), 'error');
                if (['presence', 'typ', 'read_receipt'].some(data => data == message.type)) return;
                if (global.config.DeveloperMode) console.log(message);
                return listener(message);
            };

            global.handleListen = api.listenMqtt(listenerCallback);
            updateStatus(100, "Bot is Active & Running!");

        } catch (error) {
            updateStatus(0, "Runtime Error: " + error.message);
            logger("Bot Runtime Error: " + error, "[ CRASH ]");
        }
    });
}

// Keep server alive
try { require("./ping")(); } catch {}

process.on('unhandledRejection', (err) => logger("Unhandled Rejection: " + err.message, "error"));
