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
    // 無限ループを防ぐため、一番最初にチェックします。
    if (accountId === BOT_ID) {
      console.log("無視: 自分自身の投稿です。");
      return res.sendStatus(200);
    }
    
    // 2. メンションの有無をチェック
    // これにより、メンションされた時だけボットが反応するようになります。
    const isMentioned = body.includes(`[To:${BOT_ID}]`);
    if (!isMentioned) {
      return res.sendStatus(200);
    }

    // 3. 返信を無視
    // ボットへの返信（自動生成される [rp aid=...]）を無視します。
    if (body.includes(`[rp aid=${BOT_ID}]`)) {
      return res.sendStatus(200);
    }

    // 4. メッセージから不要な部分を削除してクリーンなメッセージを取得
    const cleanMessage = body.replace(/\[To:\d+\].*?|\/.*?\/|\s+/g, "");

    // 5. 削除コマンドの処理
    if (body.includes("削除")) {
        await chatworkApi.deleteMessages(body, cleanMessage, messageId, roomId, accountId);
        return res.sendStatus(200);
    }
    
    // 6. スラッシュコマンドの処理
    const command = getCommand(body);
    if (command && commands[command]) {
      await commands[command](cleanMessage, roomId);
      return res.sendStatus(200);
    }

    // 7. どのコマンドにも該当しない場合のデフォルトの応答
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
