const axios = require('axios');
const chatworkApi = require('./chatworkApi');

// ボット自身のChatworkアカウントID
const BOT_ID = 10617115;

// コマンドに対応する処理を定義するオブジェクト
const commands = {
  "help": async (body, roomId, messageId, accountId) => {
    const helpMessage = `[rp aid=${accountId} to=${roomId}-${messageId}][pname:${accountId}]さん\n利用可能なコマンド:\n/help: このヘルプを表示\n/coin: コインを投げて結果を返します\n/whomi: あなたの情報を表示します\n/whois [rp to=...]: 返信した相手の情報を表示します\n削除 [rp to=...] : 指定したメッセージを削除`;
    await chatworkApi.sendchatwork(helpMessage, roomId);
  },
  "coin": async (body, roomId, messageId, accountId) => {
    const coinResult = Math.random() < 0.5 ? "表" : "裏";
    const responseMessage = `[rp aid=${accountId} to=${roomId}-${messageId}][pname:${accountId}]さん\nコインを投げました。\n結果は【${coinResult}】です。`;
    await chatworkApi.sendchatwork(responseMessage, roomId);
  },
  "whomi": async (body, roomId, messageId, accountId) => {
    // メンションがない場合の `accountId` に対応
    const senderAccountId = accountId || '不明'; 
    const responseMessage = `[rp aid=${accountId} to=${roomId}-${messageId}][pname:${accountId}]さん\nあなたのChatworkアカウントIDは ${senderAccountId} です。`;
    await chatworkApi.sendchatwork(responseMessage, roomId);
  },
  "whois": async (body, roomId, messageId, accountId) => {
    const repliedAccountId = chatworkApi.getRepliedAccountId(body);
    if (repliedAccountId) {
      const responseMessage = `[rp aid=${accountId} to=${roomId}-${messageId}][pname:${accountId}]さん\n返信相手のChatworkアカウントIDは ${repliedAccountId} です。`;
      await chatworkApi.sendchatwork(responseMessage, roomId);
    } else {
      const errorMessage = `[rp aid=${accountId} to=${roomId}-${messageId}][pname:${accountId}]さん\nコマンドの使い方が間違っています。\n/whois の後に返信メッセージを続けてください。`;
      await chatworkApi.sendchatwork(errorMessage, roomId);
    }
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
    const { from_account_id: accountId, room_id: roomId, message_id: messageId, body } = req.body.webhook_event;
    
    // 1. 自分自身の投稿を無視（無限ループ防止）
    if (accountId === BOT_ID) {
      return res.sendStatus(200);
    }
    
    // 2. 削除コマンドの処理
    if (body.includes("[rp to=") && body.includes("削除")) {
        await chatworkApi.deleteMessages(body, roomId);
        return res.sendStatus(200);
    }
    
    // 3. メンションの有無をチェック
    const isMentioned = body.includes(`[To:${BOT_ID}]`);
    
    // 4. コマンドの抽出と実行
    const command = getCommand(body);
    if (command && commands[command]) {
      await commands[command](body, roomId, messageId, accountId);
    } else if (isMentioned) {
      const defaultResponse = `[rp aid=${accountId} to=${roomId}-${messageId}][pname:${accountId}]さん\nこんにちは！メンションありがとうございます。\n「/help」と入力すると、利用可能なコマンドが表示されます。`;
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
