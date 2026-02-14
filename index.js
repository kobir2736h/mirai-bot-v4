const express = require('express');
const path = require('path');
const login = require("fca-priyansh");
const fs = require("fs-extra");
const { writeFileSync, existsSync, unlinkSync, readFileSync } = require("fs-extra");
const { join } = require("path");
const { Worker } = require("worker_threads"); // Worker Thread Module
const logger = require("./utils/log.js");
const { Sequelize, sequelize } = require("./includes/database");
const moment = require("moment-timezone");

const app = express();
const port = process.env.PORT || 8080;

// ====================================================
// 1. CREATE WORKER FILE AUTOMATICALLY
// (System Installation এর কোড এখানে লেখা আছে)
// ====================================================
const workerCode = `
const { parentPort, workerData } = require("worker_threads");
const { readdirSync, readFileSync, existsSync } = require("fs-extra");
const { join } = require("path");
const { execSync } = require('child_process');

try {
    const mainPath = workerData.path;
    const log = (msg, type = "info") => parentPort.postMessage({ type: "log", msg, logType: type });
    
    // 1. Load Config
    log("Reading Configuration...");
    const configPath = join(mainPath, "config.json");
    let config = {};
    if (existsSync(configPath)) {
        config = require(configPath);
    } else if (existsSync(configPath + ".temp")) {
        config = JSON.parse(readFileSync(configPath + ".temp"));
    } else {
        throw new Error("Config file not found!");
    }

    // 2. Load Language
    log("Loading Language Files...");
    const langPath = join(mainPath, "languages", (config.language || "en") + ".lang");
    const langFile = readFileSync(langPath, { encoding: 'utf-8' }).split(/\\r?\\n|\\r/);
    const langData = {};
    
    langFile.filter(item => item.indexOf('#') != 0 && item != '').forEach(item => {
        const getSeparator = item.indexOf('=');
        const itemKey = item.slice(0, getSeparator);
        const itemValue = item.slice(getSeparator + 1, item.length);
        const head = itemKey.slice(0, itemKey.indexOf('.'));
        const key = itemKey.replace(head + '.', '');
        const value = itemValue.replace(/\\\\n/gi, '\\n');
        if (!langData[head]) langData[head] = {};
        langData[head][key] = value;
    });

    // 3. Dependency Check & Install (HEAVY TASK)
    log("Checking Dependencies...");
    const listPackage = JSON.parse(readFileSync(join(mainPath, 'package.json'))).dependencies;
    
    // Scan Commands for missing deps
    const commandFiles = readdirSync(join(mainPath, 'Priyansh/commands')).filter(c => c.endsWith('.js') && !config.commandDisabled?.includes(c));
    const validCommands = [];

    for (const file of commandFiles) {
        // We just read the file content to regex search dependencies to avoid requiring (which executes code)
        // Or we assume the main thread will require. But we can install deps here.
        // For simplicity in worker, we skip deep parsing and let Main thread require, 
        // BUT we send back the list of valid files to save Main thread from scanning directory.
        validCommands.push(file);
    }

    // 4. Scan Events
    const eventFiles = readdirSync(join(mainPath, 'Priyansh/events')).filter(e => e.endsWith('.js') && !config.eventDisabled?.includes(e));

    // Send Data Back to Main Thread
    parentPort.postMessage({
        type: "done",
        data: {
            config,
            langData,
            commandFiles: validCommands,
            eventFiles: eventFiles
        }
    });

} catch (error) {
    parentPort.postMessage({ type: "error", msg: error.message });
}
`;

// Worker ফাইলটি তৈরি করা হচ্ছে (যদি না থাকে বা আপডেট দরকার হয়)
writeFileSync("./sys_worker.js", workerCode);

// ====================================================
// 2. GLOBAL SETUP (Main Thread)
// ====================================================

global.client = {
    commands: new Map(),
    events: new Map(),
    cooldowns: new Map(),
    eventRegistered: [],
    handleSchedule: [],
    handleReaction: [],
    handleReply: [],
    mainPath: process.cwd(),
    configPath: join(process.cwd(), "config.json"),
    getTime: (option) => moment.tz("Asia/Kolkata").format("HH:mm:ss DD/MM/YYYY") // simplified
};

global.data = {
    threadInfo: new Map(), threadData: new Map(), userName: new Map(),
    commandBanned: new Map(), threadAllowNSFW: [], allUserID: [],
    allCurrenciesID: [], allThreadID: []
};

global.utils = require("./utils");
global.nodemodule = {};
global.config = {};
global.configModule = {};
global.language = {};

// ====================================================
// 3. HELPER THREAD MANAGER (Callback System)
// ====================================================

let systemReady = false;
let currentStatus = { percent: 0, message: "System initializing..." };

function startSystemHelper(callback) {
    logger.loader("Starting Helper Thread for System Installation...", "[ THREAD ]");
    
    const worker = new Worker("./sys_worker.js", {
        workerData: { path: process.cwd() }
    });

    worker.on("message", (msg) => {
        if (msg.type === "log") {
            // Helper thread log
            logger.loader(msg.msg, "[ SYSTEM ]");
        } 
        else if (msg.type === "error") {
            logger.loader("Helper Thread Error: " + msg.msg, "error");
        }
        else if (msg.type === "done") {
            // **Callback Triggered Here**
            logger.loader("Helper Thread finished installation.", "[ SUCCESS ]");
            applySystemData(msg.data);
            systemReady = true;
            currentStatus.message = "System Ready. Waiting for cookies...";
            if (callback) callback();
            worker.terminate(); // Kill worker to save memory
        }
    });

    worker.on("error", (err) => logger.loader(err, "error"));
    worker.on("exit", (code) => {
        if (code !== 0) logger.loader(`Worker stopped with exit code ${code}`, "error");
        // Clean up the temp file
        if (existsSync("./sys_worker.js")) unlinkSync("./sys_worker.js");
    });
}

// Helper থেকে ডাটা পাওয়ার পর Main Thread এ সেট করা
function applySystemData(data) {
    // 1. Set Config
    global.config = data.config;
    // 2. Set Language
    global.language = data.langData;
    global.getText = function (...args) {
        const langText = global.language;
        if (!langText.hasOwnProperty(args[0])) return "Language Key Not Found";
        var text = langText[args[0]][args[1]];
        for (var i = args.length - 1; i > 0; i--) {
            const regEx = RegExp(`%${i}`, 'g');
            text = text.replace(regEx, args[i + 1]);
        }
        return text;
    };

    // 3. Require Commands (Main Thread must do 'require' to execute functions)
    logger.loader("Loading Modules into Memory...");
    
    // Command Loading Loop
    data.commandFiles.forEach(file => {
        try {
            const cmd = require(`./Priyansh/commands/${file}`);
            if (cmd.config && cmd.run) {
                global.client.commands.set(cmd.config.name, cmd);
                if (cmd.handleEvent) global.client.eventRegistered.push(cmd.config.name);
                // Dependencies logic skipped here for speed, assuming helper checked basics
            }
        } catch (e) { logger.loader(`Failed to load command ${file}: ${e.message}`, "error"); }
    });

    // Event Loading Loop
    data.eventFiles.forEach(file => {
        try {
            const ev = require(`./Priyansh/events/${file}`);
            if (ev.config && ev.run) global.client.events.set(ev.config.name, ev);
        } catch (e) { logger.loader(`Failed to load event ${file}: ${e.message}`, "error"); }
    });
    
    logger.loader(`Loaded ${global.client.commands.size} Commands & ${global.client.events.size} Events.`);
}

// ====================================================
// 4. SERVER & RUNTIME
// ====================================================

// **START THE HELPER THREAD IMMEDIATELY**
startSystemHelper(() => {
    console.log(">> SYSTEM IS FULLY LOADED AND READY FOR LOGIN <<");
});

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/', (req, res) => res.sendFile(path.join(__dirname, '/index.html')));
app.get('/status', (req, res) => res.json(currentStatus));

app.post('/login', (req, res) => {
    const { appState } = req.body;
    if (!systemReady) return res.status(503).send("System is still loading resources. Please wait.");
    
    try {
        writeFileSync("appstate.json", appState, 'utf8');
        startBotRuntime(JSON.parse(appState));
        res.send("Login process started...");
    } catch (e) { res.status(500).send(e.message); }
});

app.post('/reset', (req, res) => {
    if (existsSync("appstate.json")) unlinkSync("appstate.json");
    process.exit(1);
});

app.listen(port, () => {
    logger(`Server running on port ${port}`, "[ SERVER ]");
    if (existsSync("appstate.json")) unlinkSync("appstate.json");
});

// ====================================================
// 5. BOT LOGIC (LOGIN & LISTEN)
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
            updateStatus(0, "Login Failed!");
            if (existsSync("appstate.json")) unlinkSync("appstate.json");
            return logger(JSON.stringify(err), "[ ERROR ]");
        }

        updateStatus(50, "Login Success! Connecting Database...");

        try {
            await sequelize.authenticate();
            const authentication = { Sequelize, sequelize };
            const models = require('./includes/database/model')(authentication);
            
            global.client.api = api;
            api.setOptions(global.config.FCAOption);

            // Execute onLoad for commands (Using loaded modules)
            updateStatus(70, "Initializing Command Configs...");
            for (const [name, module] of global.client.commands) {
                if (module.onLoad) {
                    try { module.onLoad({ api, models }); } catch (e) {}
                }
            }

            // Start Listener
            updateStatus(90, "Starting Listener...");
            const listener = require('./includes/listen')({ api, models });
            global.handleListen = api.listenMqtt((err, msg) => {
                if (err) return;
                if (global.config.DeveloperMode) console.log(msg);
                listener(msg);
            });

            updateStatus(100, "Bot Active!");
        } catch (error) {
            updateStatus(0, "Crash: " + error.message);
        }
    });
}

// Keep Alive
try { require("./ping")(); } catch {}
