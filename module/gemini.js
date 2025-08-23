// ============================
// Geminiなど。AI機能
// ============================

const axios = require('axios');
const geminiAPIKey = process.env.GEMINI_API;
const API_KEY = "openrouterAPI";

const messageedit = require('../suisho/message');
const getCWdata = require('../suisho/cwdata');

//gemini
async function generateGemini(body, message, messageId, roomId, accountId) {
  try {
    message = "あなたはトークルーム「ゆずの部屋」のボットのゆずbotです。チャットボットで、顔文字を使うことが好きです。以下のメッセージに対して200字以下で返答して下さい:" + message;
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiAPIKey}`,
      {
        contents: [
          {
            parts: [
              {
                text: message,
              },
            ],
          },
        ],
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    const responseContent = response.data.candidates[0].content;
    let responseParts = responseContent.parts.map((part) => part.text).join("\n");
    responseParts = responseParts.replace(/\*/g, "");

    await messageedit.sendchatwork(`[rp aid=${accountId} to=${roomId}-${messageId}][pname:${accountId}]さん\n${responseParts}`, roomId);
  } catch (error) {
    console.error('エラーが発生しました:', error.response ? error.response.data : error.message);

    await messageedit.sendchatwork(`[rp aid=${accountId} to=${roomId}-${messageId}][pname:${accountId}]さん\nエラーが発生しました。`, roomId);
  }
}

//会話
async function chatwithAI(roomId) {
  try {
    const messages = await getCWdata.msLogsLow(roomId);
    const cleanedMessages = messages.map(message => {
    const cleanedText = message.body;
    const acName = message.account.name;
      return `${acName}:${cleanedText}`;
    });
  const textData = cleanedMessages.join('/');
    const prompt = `これからグループチャットで会話を行います。以下の条件を絶対に守って回答してください。
    以下が掲示板のメッセージです。掲示板のメッセージは「名前:メッセージ/」のように「/」で区切って記述していて、下にあるものほど最新のコメントになっています。`;
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiAPIKey}`,
      {
        contents: [
          {
            parts: [
              {
                text: `${prompt}「${textData}」`,
              },
            ],
          },
        ],
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    const responseContent = response.data.candidates[0].content;
    let responseParts = responseContent.parts.map((part) => part.text).join("\n");
    responseParts = responseParts.replace(/\*/g, "");
    responseParts = responseParts.replace(/ゆずbot:/g, "");
    
    await messageedit.sendchatwork(`${responseParts}`, roomId);
  } catch (error) {
    console.error('エラーが発生しました:', error.response ? error.response.data : error.message);
    return;
  }
}

//DeepSeek中国
async function DeepSeek(body, message, messageId, roomId, accountId) {
  try {
    const headers = {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json'
    };

    const data = {
      model: 'deepseek/deepseek-r1-distill-llama-70b:free',
      messages: [{ role: 'user', content: message }]
    };

    const response = await axios.post('https://openrouter.ai/api/v1/chat/completions', data, { headers });
    console.log(response)
    const ms = response.data;
    await messageedit.sendchatwork(`[rp aid=${accountId} to=${roomId}-${messageId}][pname:${accountId}]さん\n${ms}`, roomId);
  } catch (error) {
    await messageedit.sendchatwork(`[rp aid=${accountId} to=${roomId}-${messageId}][pname:${accountId}]さん\nエラーが発生しました。`, roomId);
    console.error('エラーが発生しました:', error.response ? error.response.data : error.message);
    return;
  }
}

//DeepSeek日本
async function deepseekJa(body, message, messageId, roomId, accountId) {
  try {
    const seed = Math.floor(Math.random() * 1000000) + 1;
    const res = await axios.get(`https://text.pollinations.ai/${encodeURIComponent(message)}?model=deepseek-r1&seed=${seed}`)
    const text1 = res.data;
    const thinkIndex = text1.indexOf('</think>');
    const text2 =  text1.slice(thinkIndex + '</think>'.length);
    const text = text2.replace(/^[\s\r\n]+/, '');
    
    await messageedit.sendchatwork(`[rp aid=${accountId} to=${roomId}-${messageId}][pname:${accountId}]さん\n${text}`, roomId);
  } catch (error) {
    await messageedit.sendchatwork(`[rp aid=${accountId} to=${roomId}-${messageId}][pname:${accountId}]さん\nエラーが発生しました。`, roomId);
    console.error('エラーが発生しました:', error.response ? error.response.data : error.message);
    return;
  }
}

async function kasu(body, message, messageId, roomId, accountId) {
  try {
    const prompt = `次の条件に従って意味不明な文章を生成してください。意味や文脈は特に気にせず、ランダムな単語やフレーズを繋げて、マルコフ連鎖のようなスタイルにしてください。`;
    const seed = Math.floor(Math.random() * 1000000) + 1;
    const res = await axios.get(`https://text.pollinations.ai/${encodeURIComponent(`${prompt}「${message}」`)}?model=llama&seed=${seed}`)
    let text = res.data;
    
    await messageedit.sendchatwork(`[rp aid=${accountId} to=${roomId}-${messageId}][pname:${accountId}]さん\n${text}`, roomId);
  } catch (error) {
    await messageedit.sendchatwork(`[rp aid=${accountId} to=${roomId}-${messageId}][pname:${accountId}]さん\nエラーが発生しました。`, roomId);
    console.error('エラーが発生しました:', error.response ? error.response.data : error.message);
    return;
  }
}

module.exports = {
    generateGemini,
    chatwithAI,
    DeepSeek,
    deepseekJa,
    cute,
    kasu
};
