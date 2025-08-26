const axios = require('axios');
// Renderの環境変数からAPIトークンを取得
const CHATWORK_API_TOKEN = process.env.CHATWORK_API_TOKEN;

// メッセージ削除
async function deleteMessages(body, message, messageId, roomId, accountId) {
  // `message`が定義されていないため、`body`を使用
  const dlmessageIds = [...body.matchAll(/(?<=to=\d+-)(\d+)/g)].map(match => match[0]);

  if (dlmessageIds.length === 0) {
    return;
  }

  for (let i = 0; i < dlmessageIds.length; i++) {
    const messageId = dlmessageIds[i];
    const url = `https://api.chatwork.com/v2/rooms/${roomId}/messages/${messageId}`;

    try {
      await axios.delete(url, {
        headers: {
          'Accept': 'application/json',
          'x-chatworktoken': CHATWORK_API_TOKEN,
        }
      });
    } catch (err) {
      console.error(`メッセージID ${messageId} の削除中にエラーが発生しました:`, err.response ? err.response.data : err.message);
    }
  }
}
module.exports = {
  deleteMessages,
};
