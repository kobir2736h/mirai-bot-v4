const express = require('express');
const path = require('path');
const login = require("fca-priyansh");
const { writeFileSync, unlinkSync, existsSync } = require("fs");
const logger = require("./utils/log");

const app = express();
const port = process.env.PORT || 8080;

// JSON ডাটা পড়ার জন্য (কুকিজ অনেক বড় হতে পারে তাই limit বাড়ানো হয়েছে)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

// শুরুতে স্ট্যাটাস থাকবে ওয়েটিং
let currentStatus = { percent: 0, message: "Waiting for cookies from Website..." };

// ১. ওয়েবসাইট দেখানোর রাউট
app.get('/', (req, res) => res.sendFile(path.join(__dirname, '/index.html')));

// ২. স্ট্যাটাস চেক API (ওয়েবসাইট প্রতি ১ সেকেন্ড পর পর এটা চেক করবে)
app.get('/status', (req, res) => res.json(currentStatus));

// ৩. লগইন API (ওয়েবসাইট থেকে যখন কুকিজ আসবে তখন এটা কল হবে)
app.post('/login', (req, res) => {
    const { appState } = req.body;

    if (!appState) return res.status(400).send("No AppState provided");

    try {
        // টেম্পোরারি ফাইল হিসেবে সেভ করছি
        writeFileSync("appstate.json", appState, 'utf8');

        // লগইন প্রসেস শুরু করছি
        startLoginProcess(JSON.parse(appState));

        res.send("Login process started...");
    } catch (e) {
        res.status(500).send("Error: " + e.message);
    }
});

// ৪. রিস্টার্ট বাটন (বট থামানোর জন্য)
app.post('/reset', (req, res) => {
    logger("Reset Request. Restarting server...", "[ RESET ]");
    // ফাইল ক্লিনআপ
    if (existsSync("appstate.json")) unlinkSync("appstate.json");
    process.exit(1);
});

// ৫. সার্ভার স্টার্ট
app.listen(port, () => {
    logger(`Server is running on port ${port}`, "[ SERVER ]");

    // [গুরুত্বপূর্ণ] সার্ভার চালু হলেই পুরনো appstate ডিলিট করে দেবে (তোর রিকোয়ারমেন্ট অনুযায়ী)
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

// ==========================================
//          CORE FUNCTIONS
// ==========================================

// স্ট্যাটাস আপডেট করার ফাংশন
function updateStatus(p, m) {
    currentStatus.percent = p;
    currentStatus.message = m;
    console.log(`[ LOAD ${p}% ] ${m}`);
}

// মেইন লগইন প্রসেস
async function startLoginProcess(appState) {
    updateStatus(10, "Cookies Received. Verifying...");

    const loginData = { appState: appState };
    const options = {
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36",
        forceLogin: true
    };

    // index.js নিজেই লগইন করছে (fca-priyansh দিয়ে)
    login(loginData, options, async (err, api) => {
        if (err) {
            updateStatus(0, "Login Failed! Cookies are invalid or expired.");
            // লগইন ফেইল করলে ফাইল ডিলিট করে দিই
            if (existsSync("appstate.json")) unlinkSync("appstate.json");
            return logger("Login Error: " + JSON.stringify(err), "[ ERROR ]");
        }

        updateStatus(50, "Login Success! Starting Bot Engine...");

        try {
            // Priyansh.js কে কল করা হচ্ছে (এটি এখন ফাংশন হিসেবে আছে)
            // আগের spawn বা child_process এখন আর নেই
            const startBrain = require("./brain");

            // api কানেকশন এবং স্ট্যাটাস ফাংশন Priyansh.js এর কাছে পাঠিয়ে দিচ্ছি
            await startBrain(api, updateStatus);

        } catch (error) {
            updateStatus(0, "Bot Engine Crash: " + error.message);
            logger("brain.js Error: " + error, "[ CRASH ]");
        }
    });
}

// পিং ফাংশন (সার্ভার সজাগ রাখার জন্য)
try {
    require("./ping")();
} catch (e) {}
