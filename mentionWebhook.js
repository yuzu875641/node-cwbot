const chatworkApi = require('./chatworkApi');

// ボット自身のChatworkアカウントID
const BOT_ID = 10617115;

// コマンドに対応する処理を定義するオブジェクト
const commands = {
  "help": (message, roomId) => {
    const helpMessage = "利用可能なコマンド:\n" +
                        "/help: このヘルプを表示\n" +
                        "削除 [rp to=...] : 指定したメッセージを削除";
    chatworkApi.sendchatwork(helpMessage, roomId);
  }
};

// メッセージ本文からスラッシュコマンドを抽出する関数
function getCommand(body) {
  const match = body.match(/^\/(\w+)/);
  return match ? match[1] : null;
}

// Webhookのメイン処理
async function mentionWebhook(req, res) {
  try {
    const { from_account_id: accountId, room_id: roomId, message_id: messageId, body } = req.body.webhook_event;
    
    // 1. 自分自身の投稿を無視
    if (accountId === BOT_ID) {
      console.log("無視: 自分自身の投稿です。");
      return res.sendStatus(200);
    }
    
    // 2. 削除コマンドの処理を優先
    // 返信形式にも対応させるため、この条件を一番上に配置
    if (body.includes("削除")) {
        await chatworkApi.deleteMessages(body, body, messageId, roomId, accountId);
        return res.sendStatus(200);
    }

    // 3. メンションの有無をチェック（削除コマンド以外）
    const isMentioned = body.includes(`[To:${BOT_ID}]`);
    if (!isMentioned) {
      return res.sendStatus(200);
    }
    
    // 4. スラッシュコマンドの処理
    const command = getCommand(body);
    if (command && commands[command]) {
      const cleanMessage = body.replace(/\[To:\d+\].*?|\/.*?\/|\s+/g, "");
      await commands[command](cleanMessage, roomId);
      return res.sendStatus(200);
    }

    // 5. どのコマンドにも該当しない場合のデフォルトの応答
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
