// ============================
// ファイル送信用のモジュール
// ============================

const FormData = require('form-data');
const path = require('path');
const sharp = require('sharp');
const fs = require('fs');
const randomId = require('random-id');
const axios = require('axios');

const CHATWORK_API_TOKEN = process.env.CHATWORK_API_TOKEN;

var randomIdlen = 30;
var randomIdpattern = 'aA0'

const messageedit = require('./message');
const miaq = require('../src/miaq');

//YouTube用
async function sendFileyt(roomId, videoId, videoTitle) {
  try {
    const outputDir = path.join(__dirname, '..', 'image');
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    const localFilePath = path.join(outputDir, `${roomId}-${videoTitle}.jpg`);

    const writer = fs.createWriteStream(localFilePath);
    const response = await axios({
      method: 'get',
      url: `https://watawatadane.kameli.org/vi/${videoId}/maxresdefault.jpg`,
      responseType: 'stream',
    });
    response.data.pipe(writer);

    await new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });

    const formData = new FormData();
    formData.append('file', fs.createReadStream(localFilePath));

    const uploadUrl = `https://api.chatwork.com/v2/rooms/${roomId}/files`;
    const headers = {
      ...formData.getHeaders(),
      'x-chatworktoken': CHATWORK_API_TOKEN,
    };

    const uploadResponse = await axios.post(uploadUrl, formData, { headers });

    fs.unlinkSync(localFilePath);
  } catch (error) {
    console.error('ファイル送信でエラーが発生しました');
  }
}
//画像生成
async function generateImageAI(roomId, prompt, accountId, messageId) {
  const fileId = randomId(randomIdlen, randomIdpattern);
  const outputDir = path.join(__dirname, 'image');

  const params = {
    prompt: prompt,
    model: 'flux',
    seed: 338,
    nologo: true,
    private: false,
    width: 768,
    height: 1100,
    enhance: true,
  };

  const imageUrl = `https://pollinations.ai/p/${encodeURIComponent(params.prompt)}?width=${params.width}&height=${params.height}&seed=${params.seed}&model=${params.model}&nologo=${params.nologo}&private=${params.private}&enhance=${params.enhance}`;

  try {
    const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
    const imageBuffer = response.data;

    const resizedImageBuffer = await sharp(imageBuffer)
      .resize(768, 1024)
      .toBuffer();

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const localFilePath = path.join(outputDir, `${roomId}-${fileId}.png`);
    fs.writeFileSync(localFilePath, resizedImageBuffer);

    const formData = new FormData();
    formData.append(
      'message',
      `[rp aid=${accountId} to=${roomId}-${messageId}][pname:${accountId}]さん`
    );
    formData.append('file', fs.createReadStream(localFilePath));

    const uploadUrl = `https://api.chatwork.com/v2/rooms/${roomId}/files`;
    const headers = {
      ...formData.getHeaders(),
      'x-chatworktoken': CHATWORK_API_TOKEN,
    };

    const uploadResponse = await axios.post(uploadUrl, formData, { headers });
    console.log('画像がChatworkに送信されました:', uploadResponse.data);

    fs.unlinkSync(localFilePath);
  } catch (error) {
    console.error('エラーが発生しました:', error.message);
    await messageedit.sendchatwork(`[rp aid=${accountId} to=${roomId}-${messageId}][pname:${accountId}]さん\nごめん、エラーとしてマーク。`, roomId);
  }
}
//同人
async function doujin(roomId, url, accountId, messageId, message, rule) {
  try {
    let nameId = null;
    if (rule === "re" || rule === "mo") {
      const regex = /galleries\/(\d+)\//;
      nameId = url.match(regex)[1];
    }
    if (rule === "sm") {
      const match2 = url.match(/\/(\d{8})\/(\d{3})\//);
      nameId = `${match2[1]}&${match2[2]}`
    }
    const outputDir = path.join(__dirname, '..', 'image');
    const fileId = randomId(randomIdlen, randomIdpattern);
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    const localFilePath = path.join(outputDir, `${roomId}-${rule}${nameId}-${fileId}.jpeg`);

    const response = await axios({
      method: 'get',
      url: url,
      responseType: 'arraybuffer',
      maxContentLength: 4 * 1024 * 1024,
    });
    const imageBuffer = response.data;
    
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    const bufferjpeg = await sharp(imageBuffer)
      .jpeg({ quality: 90 })
      .toBuffer();
    
    fs.writeFileSync(localFilePath, bufferjpeg);

    const formData = new FormData();
    formData.append('file', fs.createReadStream(localFilePath));
    if (accountId){
      if (message){
        formData.append('message', `[rp aid=${accountId} to=${roomId}-${messageId}][pname:${accountId}]さん\n${message}`);
      }else{
        formData.append('message', `[rp aid=${accountId} to=${roomId}-${messageId}][pname:${accountId}]さん`);
      }
    };

    const uploadUrl = `https://api.chatwork.com/v2/rooms/${roomId}/files`;
    const headers = {
      ...formData.getHeaders(),
      'x-chatworktoken': CHATWORK_API_TOKEN,
    };

    const uploadResponse = await axios.post(uploadUrl, formData, { headers });

    fs.unlinkSync(localFilePath);
  } catch (error) {
    console.error('ファイル送信でエラーが発生しました', error);
    await messageedit.sendchatwork(`[rp aid=${accountId} to=${roomId}-${messageId}][pname:${accountId}]さん\nエラー、あらら`, roomId);
  }
}

module.exports = {
    sendFile,
    sendHtmlFile,
    sendFileyt,
    sendmiaq,
    sendsiteshotFile,
    generateImageAI,
    gggenerateImageAI,
    doujin
};
