const fs = require("fs-extra");
const path = require("path");
const axios = require("axios");
const jimp = require("jimp");

module.exports.config = {
  name: "bestie",
  version: "7.3.1",
  hasPermssion: 0,
  credits: " Priyansh Rajput",
  description: "Get Pair From Mention",
  commandCategory: "png",
  usages: "[@mention]",
  cooldowns: 5
};

module.exports.onLoad = async () => {
  const { resolve } = path;
  const { existsSync, mkdirSync } = fs;
  const { downloadFile } = global.utils;

  const dirMaterial = __dirname + `/cache/canvas/`;
  const imgPath = resolve(__dirname, "cache/canvas", "bestu.png");

  if (!existsSync(dirMaterial)) mkdirSync(dirMaterial, { recursive: true });
  if (!existsSync(imgPath))
    await downloadFile("https://i.imgur.com/RloX16v.jpg", imgPath);
};

async function makeImage({ one, two }) {
  const __root = path.resolve(__dirname, "cache", "canvas");

  let batgiam_img = await jimp.read(__root + "/bestu.png");
  let pathImg = __root + `/batman${one}_${two}.png`;
  let avatarOne = __root + `/avt_${one}.png`;
  let avatarTwo = __root + `/avt_${two}.png`;

  let getAvatarOne = (
    await axios.get(
      `https://graph.facebook.com/${one}/picture?width=512&height=512&access_token=6628568379%7Cc1e620fa708a1d5696fb991c1bde5662`,
      { responseType: "arraybuffer" }
    )
  ).data;
  fs.writeFileSync(avatarOne, Buffer.from(getAvatarOne));

  let getAvatarTwo = (
    await axios.get(
      `https://graph.facebook.com/${two}/picture?width=512&height=512&access_token=6628568379%7Cc1e620fa708a1d5696fb991c1bde5662`,
      { responseType: "arraybuffer" }
    )
  ).data;
  fs.writeFileSync(avatarTwo, Buffer.from(getAvatarTwo));

  let circleOne = await jimp.read(await circle(avatarOne));
  let circleTwo = await jimp.read(await circle(avatarTwo));

  batgiam_img
    .composite(circleOne.resize(191, 191), 93, 111)
    .composite(circleTwo.resize(190, 190), 434, 107);

  let raw = await batgiam_img.getBufferAsync("image/png");

  fs.writeFileSync(pathImg, raw);
  fs.unlinkSync(avatarOne);
  fs.unlinkSync(avatarTwo);

  return pathImg;
}

async function circle(image) {
  image = await jimp.read(image);
  image.circle();
  return await image.getBufferAsync("image/png");
}

module.exports.run = async function ({ event, api }) {
  const { threadID, messageID, senderID } = event;
  const mention = Object.keys(event.mentions);

  if (!mention[0])
    return api.sendMessage(
      "Kisi 1 ko mantion to kr tootiye 😅",
      threadID,
      messageID
    );

  const one = senderID,
    two = mention[0];

  return makeImage({ one, two }).then((imgPath) =>
    api.sendMessage(
      {
        body:
          "✧•❁𝐅𝐫𝐢𝐞𝐧𝐝𝐬𝐡𝐢𝐩❁•✧\n\n╔═══❖••° °••❖═══╗\n\n   𝐒𝐮𝐜𝐜𝐞𝐬𝐟𝐮𝐥 𝐏𝐚𝐢𝐫𝐢𝐧𝐠\n\n╚═══❖••° °••❖═══╝\n\n   ✶⊶⊷⊷❍⊶⊷⊷✶\n\n       👑𝐘𝐄 𝐋𝐄 𝐌𝐈𝐋 𝐆𝐀𝐈 ❤\n\n𝐓𝐄𝐑𝐈 𝐁𝐄𝐒𝐓𝐈𝐄 🩷\n\n   ✶⊶⊷⊷❍⊶⊷⊷✶",
        attachment: fs.createReadStream(imgPath),
      },
      threadID,
      () => fs.unlinkSync(imgPath),
      messageID
    )
  );
};
