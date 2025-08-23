const chatworkApi = require('./chatworkApi');
const BOT_ID = 10617115; // ボット自身のID

// コマンドに対応する処理を定義
const commands = {
  "help": (message, roomId) => {
    // ヘルプコマンドの処理
    const helpMessage = "利用可能なコマンド:\n" +
                        "/help: このヘルプを表示\n" +
                        "削除 [rp to=...] : 指定したメッセージを削除";
    chatworkApi.sendchatwork(helpMessage, roomId);
  }
};

// メッセージ本文からコマンドを抽出する関数
function getCommand(body) {
  const match = body.match(/^\/(\w+)/);
  return match ? match[1] : null;
}

// Webhookのメイン処理
async function mentionWebhook(req, res) {
  try {
    const { from_account_id: accountId, room_id: roomId, message_id: messageId, body } = req.body.webhook_event;
    
    // 自分自身の投稿を無視
    if (accountId === BOT_ID) {
      return res.sendStatus(200);
    }
    
    // 返信を無視
    if (body.includes("[rp aid=10617115]")) {
      return res.sendStatus(200);
    }

    // メッセージからメンション部分やコマンドを削除してクリーンなメッセージを取得
    const message = body.replace(/\[To:\d+\].*?|\/.*?\/|\s+/g, "");

    // 削除コマンドの処理
    if (body.includes("削除")) {
        await chatworkApi.deleteMessages(body, message, messageId, roomId, accountId);
        return res.sendStatus(200);
    }
    
    // スラッシュコマンドの処理
    const command = getCommand(body);
    if (command && commands[command]) {
      await commands[command](message, roomId);
      return res.sendStatus(200);
    }

    // デフォルトの応答
    const defaultResponse = `こんにちは！メンションありがとうございます。\n「/help」と入力すると、利用可能なコマンドが表示されます。`;
    await chatworkApi.sendchatwork(defaultResponse, roomId);

    res.sendStatus(200);
    
  } catch (error) {
    console.error('Error processing webhook:', error);
    res.sendStatus(500);
  }
}

module.exports = {
  mentionWebhook
};
