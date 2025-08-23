const axios = require('axios');
const chatworkApi = require('./chatworkApi');

// ボット自身のChatworkアカウントID
const BOT_ID = 10617115;

// コマンドに対応する処理を定義するオブジェクト
const commands = {
  "help": async (message, roomId) => {
    const helpMessage = "利用可能なコマンド:\n" +
                        "/help: このヘルプを表示\n" +
                        "/coin: コインを投げて結果を返します\n" +
                        "削除 [rp to=...] : 指定したメッセージを削除";
    await chatworkApi.sendchatwork(helpMessage, roomId);
  },
  "coin": async (message, roomId) => {
    const coinResult = Math.random() < 0.5 ? "表" : "裏";
    const responseMessage = `コインを投げました。\n結果は【${coinResult}】です。`;
    await chatworkApi.sendchatwork(responseMessage, roomId);
  }
};

// メッセージ本文からスラッシュコマンドを抽出する関数
const getCommand = (body) => {
  const match = body.match(/^\/(.*?)(?:\s|$)/);
  return match ? match[1] : null;
};

// Webhookのメイン処理
async function mentionWebhook(req, res) {
  try {
    const { from_account_id: accountId, room_id: roomId, body } = req.body.webhook_event;
    
    // 1. 自分自身の投稿を無視（無限ループ防止）
    if (accountId === BOT_ID) {
      console.log("無視: 自分自身の投稿です。");
      return res.sendStatus(200);
    }
    
    // 2. スラッシュコマンドの処理を優先
    const command = getCommand(body);
    if (command && commands[command]) {
      const cleanMessage = body.replace(/\[To:\d+\].*?|\/.*?\/|\s+/g, "");
      await commands[command](cleanMessage, roomId);
      return res.sendStatus(200);
    }

    // 3. 削除コマンドの処理
    if (body.includes("削除")) {
        await chatworkApi.deleteMessages(body, body, null, roomId, accountId);
        return res.sendStatus(200);
    }
    
    // 4. メンションの有無をチェック（コマンドではない通常のメンションにのみ反応）
    const isMentioned = body.includes(`[To:${BOT_ID}]`);
    if (isMentioned) {
      const defaultResponse = `こんにちは！メンションありがとうございます。\n「/help」と入力すると、利用可能なコマンドが表示されます。`;
      await chatworkApi.sendchatwork(defaultResponse, roomId);
      return res.sendStatus(200);
    }

    res.sendStatus(200);
    
  } catch (error) {
    console.error('Error processing webhook:', error.response?.data || error.message);
    res.sendStatus(500);
  }
}

module.exports = {
  mentionWebhook
};
