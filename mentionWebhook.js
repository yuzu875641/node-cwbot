const axios = require('axios');
const chatworkApi = require('./chatworkApi');
const doujin = require('./doujin');
const wakameAI = require('./wakameAI');
const omikuji = require('./omikuji');

// ボット自身のChatworkアカウントID
const BOT_ID = 10617115;

// コマンドに対応する処理を定義するオブジェクト
const commands = {
  "help": async (body, roomId, messageId, accountId) => {
    const helpMessage = "利用可能なコマンド:\n" +
                        "/help: このヘルプを表示\n" +
                        "/coin: コインを投げて結果を返します\n" +
                        "削除 [rp to=...] : 指定したメッセージを削除";
    await chatworkApi.sendchatwork(helpMessage, roomId);
  },
  "coin": async (body, roomId, messageId, accountId) => {
    const coinResult = Math.random() < 0.5 ? "表" : "裏";
    const responseMessage = `コインを投げました。\n結果は【${coinResult}】です。`;
    await chatworkApi.sendchatwork(responseMessage, roomId);
  },
  "search": async (body, roomId, messageId, accountId) => {
    const query = body.replace(/\[To:\d+\].*?|\/.*?\/|\s+/g, "").trim();
    const results = await doujin.search(query);
    if (!results || results.length === 0) {
      await chatworkApi.sendchatwork("見つからなかったです。", roomId);
      return;
    }
    const result = results[Math.floor(Math.random() * results.length)];
    await chatworkApi.sendFile(roomId, result.image, `[rp aid=${accountId} to=${roomId}-${messageId}][pname:${accountId}]さん\nタイトル: ${result.title}`);
  },
  "doujin": async (body, roomId, messageId, accountId) => {
    const url = body.replace(/\[To:\d+\].*?|\/.*?\/|\s+/g, "").trim();
    const result = await doujin.getDetails(url);
    if (!result || result === 'error') {
      await chatworkApi.sendchatwork("詳細情報の取得に失敗しました。", roomId);
      return;
    }
    const message = `タイトル: ${result.title}\nページ数: ${result.pages}\n作者: ${result.authors}\nサークル: ${result.circle}`;
    await chatworkApi.sendFile(roomId, result.imageUrls[0], `[rp aid=${accountId} to=${roomId}-${messageId}][pname:${accountId}]さん\n${message}`);
  }
};

// メッセージ本文からスラッシュコマンドを抽出する関数
const getCommand = (body) => {
  const match = body.match(/\/(.*?)(?:\s|$)/);
  return match ? match[1] : null;
};

// Webhookのメイン処理
async function mentionWebhook(req, res) {
  try {
    const { from_account_id: accountId, room_id: roomId, message_id: messageId, body } = req.body.webhook_event;
    
    // 1. 自分自身の投稿を無視
    if (accountId === BOT_ID) {
      return res.sendStatus(200);
    }
    
    // 2. 削除コマンドの処理
    if (body.includes("[rp aid=") && body.includes("削除")) {
        await chatworkApi.deleteMessages(body, roomId);
        return res.sendStatus(200);
    }
    
    // 3. メンションの有無をチェック
    const isMentioned = body.includes(`[To:${BOT_ID}]`);
    if (!isMentioned) {
      return res.sendStatus(200);
    }

    // 4. コマンドの抽出と実行
    const command = getCommand(body);
    if (command && commands[command]) {
      await commands[command](body, roomId, messageId, accountId);
    } else {
      const defaultResponse = `こんにちは！メンションありがとうございます。\n「/help」と入力すると、利用可能なコマンドが表示されます。`;
      await chatworkApi.sendchatwork(defaultResponse, roomId);
    }

    res.sendStatus(200);
    
  } catch (error) {
    console.error('Webhook処理エラー:', error.response?.data || error.message || error);
    res.sendStatus(500);
  }
}

module.exports = {
  mentionWebhook
};
