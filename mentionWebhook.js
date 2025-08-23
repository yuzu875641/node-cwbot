const axios = require('axios');
const chatworkApi = require('./chatworkApi');

// ボット自身のChatworkアカウントID
const BOT_ID = 10617115;

// Chatworkの絵文字一覧（独自の記法）
const CHATWORK_EMOJIS = [
  ":)", ":(", ":D", "8-)", ":o", ";)", ":(", "(sweat)", ":|", ":*", ":p",
  "(blush)", ":^)", "|-)", "(inlove)", "]:)", "(talk)", "(yawn)", "(puke)",
  "(emo)", "8-|", ":#", "(nod)", "(shake)", "(^^;)", "(whew)", "(clap)",
  "(bow)", "(roger)", "(flex)", "(dance)", ":/", "(gogo)", "(think)",
  "(please)", "(quick)", "(anger)", "(devil)", "(lightbulb)", "(*)", "(h)",
  "(F)", "(cracker)", "(eat)", "(^)", "(coffee)", "(beer)", "(handshake)", "(y)"
];

// コマンドに対応する処理を定義するオブジェクト
const commands = {
  "help": async (message, roomId) => {
    const helpMessage = "利用可能なコマンド:\n" +
                        "/help: このヘルプを表示\n" +
                        "削除 [rp to=...] : 指定したメッセージを削除";
    await chatworkApi.sendchatwork(helpMessage, roomId);
  }
};

// メッセージ本文からスラッシュコマンドを抽出する関数
const getCommand = (body) => {
  const match = body.match(/^\/(\w+)/);
  return match ? match[1] : null;
};

// 正規表現で特殊文字をエスケープするヘルパー関数
const escapeRegExp = (string) => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

// 絵文字の数をカウントする関数
const countEmojisAndCheckToall = (body) => {
  let emojiCount = 0;
  
  // 1. Chatwork独自の絵文字をカウント
  for (const emoji of CHATWORK_EMOJIS) {
    const regex = new RegExp(escapeRegExp(emoji), 'g');
    const matches = body.match(regex);
    if (matches) {
      emojiCount += matches.length;
    }
  }

  // 2. Unicode絵文字をカウントする
  const unicodeEmojiRegex = /(\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff])/g;
  const unicodeMatches = body.match(unicodeEmojiRegex);
  if (unicodeMatches) {
    emojiCount += unicodeMatches.length;
  }
  
  // 3. [toall]がある場合は、15個の絵文字があるものと見なす
  if (body.includes("[toall]")) {
    emojiCount = 15;
  }
  
  return emojiCount;
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
    
    // 2. 絵文字と [toall] の判定
    const emojiCount = countEmojisAndCheckToall(body);

    if (emojiCount >= 15) {
      const CHATWORK_API_TOKEN = process.env.CHATWORK_API_TOKEN;
      const membersUrl = `https://api.chatwork.com/v2/rooms/${roomId}/members`;
      const membersResponse = await axios.get(membersUrl, {
        headers: { 'X-ChatWorkToken': CHATWORK_API_TOKEN }
      });
      const member = membersResponse.data.find(m => m.account_id === accountId);

      if (member && member.role === 'admin') {
        const responseMessage = `メッセージの絵文字が少し多いかもしれません💦`;
        await chatworkApi.sendchatwork(responseMessage, roomId);
        return res.sendStatus(200);
      } else if (member && member.role === 'member') {
        const updateRoleUrl = `https://api.chatwork.com/v2/rooms/${roomId}/members`;
        await axios.put(updateRoleUrl, new URLSearchParams({
          members_admin: membersResponse.data.filter(m => m.role === 'admin').map(m => m.account_id),
          members_member: membersResponse.data.filter(m => m.role === 'member' && m.account_id !== accountId).map(m => m.account_id),
          members_readonly: [...membersResponse.data.filter(m => m.role === 'readonly').map(m => m.account_id), accountId].join(',')
        }), {
          headers: { 'X-ChatWorkToken': CHATWORK_API_TOKEN, 'Content-Type': 'application/x-www-form-urlencoded' }
        });
        const responseMessage = `絵文字が多すぎるため、${member.name}さんの権限を閲覧に変更しました。`;
        await chatworkApi.sendchatwork(responseMessage, roomId);
        return res.sendStatus(200);
      }
    }

    // 3. 削除コマンドの処理を優先（メンション・返信両方に対応）
    if (body.includes("削除")) {
        await chatworkApi.deleteMessages(body, body, null, roomId, accountId);
        return res.sendStatus(200);
    }
    
    // 4. メンションの有無をチェック（削除コマンド以外）
    const isMentioned = body.includes(`[To:${BOT_ID}]`);
    if (!isMentioned) {
      return res.sendStatus(200);
    }

    // 5. スラッシュコマンドの処理
    const command = getCommand(body);
    if (command && commands[command]) {
      const cleanMessage = body.replace(/\[To:\d+\].*?|\/.*?\/|\s+/g, "");
      await commands[command](cleanMessage, roomId);
      return res.sendStatus(200);
    }

    // 6. どのコマンドにも該当しない場合のデフォルトの応答
    const defaultResponse = `こんにちは！メンションありがとうございます。\n「/help」と入力すると、利用可能なコマンドが表示されます。`;
    await chatworkApi.sendchatwork(defaultResponse, roomId);

    res.sendStatus(200);
    
  } catch (error) {
    console.error('Error processing webhook:', error.response?.data || error.message);
    res.sendStatus(500);
  }
}

module.exports = {
  mentionWebhook
};
