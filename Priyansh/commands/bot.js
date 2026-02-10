const fs = global.nodemodule["fs-extra"];
‎module.exports.config = {
‎  name: "goibot",
‎  version: "1.0.1",
‎  hasPermssion: 0,
‎  credits: "Fixed By Arun Kumar",
‎  description: "goibot",
‎  commandCategory: "Noprefix",
‎  usages: "noprefix",
‎  cooldowns: 5,
‎};
‎module.exports.handleEvent = async function({ api, event, args, Threads, Users }) {
‎  var { threadID, messageID, reason } = event;
‎  const moment = require("moment-timezone");
‎  const time = moment.tz("Asia/Kolkata").format("DD/MM/YYYY || HH:mm:ss");
‎  var idgr = `${event.threadID}`;
‎  var id = event.senderID;
‎  var name = await Users.getNameUser(event.senderID);
‎
‎  var tl = ["পেট এ চাপ দিয়েই ছাতা বন্ধ করা লাগে.....!!","দেখ বিল্লু,,এইটা আমার বড় বিলাই🙄" , "বাবাগো......." , "কেন্দে দিয়েছি....🙈" , "বাড়িতে ফিরেই সবার প্রথম প্রশ্ন...মা কোথায়?💝" , "সাপুট দিলে সাপুট পাবেন....🫶" , "মেয়ে খাওয়ার মত ওয়েদার,,,,,🤤" ,  "আর যাবনা বেগুন তুলিতে,,,,,ও ললিতে.....🫵" , "বৃষ্টির দিনে রিকশা ভাড়া শুনলে মনে,, হয় বিয়ের গেট ধরছে.....☠️☠️" , "মহিলা কামড়ানো হয়....☹️" , "দোয়া অসম্ভব কে সম্ভব করতে পারে....।।" , "Bewafa Nikali re tu🙂🤨", "Systemmmmmmm 😴" , "নারী কত সুন্দর অভিনয় করে রে....🙈🙈", "পুরুষ কত সুন্দর অভিনয় করে রে....🙈🙈" , "Moye moye moye moye🙆🏻‍♀🙆🏻‍♀" , "Ye dukh kahe khatm nahi hota 🙁" , "Tum to dokebaz ho" , "you just looking like a wow😶" , "Babu, babu ammu basay nei" , "This person is unavailable on Messenger." ,"Jab dekho B0T B0T B0T😒😒", "জীবনটা শেখ হাসিনার মতো হয়ে গেছে,,,, যত কিছুই করি নাম নাই", "rag kore na pookie" , "Tum wahi ho na ,jisko.me.nahi janti 🙂" , "Ye I love you kya hota hai" , "Sunai deta hai mujhe behri nahi hu me   😒" , "so elegent, so beautiful , just looking like a wow🤭" , "valo ekta dalal suggest koren to 🙂" ,
‎
‎ "🤔" , "I Love you baby , mera recharge khtm hone wala h" , "জমি কিনতে আগ্রহী...😐" , "তুমি যদি নিজেকে ঘুষি মেরে ব্যথা পাও,,,, তাহলে কি তুমি শক্তিশালী নাকি দুর্বল....??" , "Arry Bas Kar🤣😛" , "Me ni To Kon Be" , "naam adiya kumar 7vi kaksha me padhte hai favret subject begon😘" , "Mera Dimag Mat Khaya kro😒😒" , "Chuppp Saatvi Fail😒" , "Saste Nashe Kab Band kroge" , "Mai Jaanu Ke sath Busy hu yar, mujhe mat balao" , "Haye Jaanu Mujhe Yaad Kiya🙈" , "Hayee ese mt bulaya kro, mujhe sharm aati h" , "System pe system betha rahi chhori bot ki" , "Naach meri Bulbul tujhe pesa milega" , "me idhar se hu aap kidhar se ho" , "Khelega Free Fire🙈🙈" , "aye haye oye hoye aye haye oye hoye😍 bado badi bado badi😘" , "e halo bhai darr rha hai kya" , "akh ladi bado badi" , "haaye garmi😕" , "Ao kabhi haweli pe😍" , "Khelega Free Fire🥴" , "Hallo bai tu darr raha hai kya" , "janu bula raha h mujhe" , "I cant live without you babu😘" , "haa meri jaan" , "Agye Phirse Bot Bot Krne🙄" , "konse color ki jacket pehne ho umm btao na😚" , "dhann khachh booyaah"];
‎  var rand = tl[Math.floor(Math.random() * tl.length)]
‎   mess = "{name}"
‎  if (event.body.indexOf("Bot") == 0 || (event.body.indexOf("bot") == 0)) {
‎    var msg = {
‎      body: `${rand}`
‎    }
‎    return api.sendMessage(msg, threadID, messageID);
‎  };
‎
‎}
‎
‎module.exports.run = function({ api, event, client, __GLOBAL }) { }
‎
