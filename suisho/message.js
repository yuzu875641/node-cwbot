// ============================
// メッセージ関連のモジュール。
// ============================

const axios = require('axios');
const CHATWORK_API_TOKEN = process.env.CHATWORK_API_TOKEN;

//メッセージ送信
async function sendchatwork(ms, CHATWORK_ROOM_ID) {
  try {
    await axios.post(
      `https://api.chatwork.com/v2/rooms/${CHATWORK_ROOM_ID}/messages`,
      new URLSearchParams({ body: ms }),
      {
        headers: {
          "X-ChatWorkToken": CHATWORK_API_TOKEN,
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );
    console.log("メッセージ送信成功");
  } catch (error) {
    console.error("Chatworkへのメッセージ送信エラー:", error.response?.data || error.message);
  }
}

//メッセージ削除
async function deleteMessages(body, message, messageId, roomId, accountId) {
  const dlmessageIds = [...message.matchAll(/(?<=to=\d+-)(\d+)/g)].map(match => match[0]);

  if (dlmessageIds.length === 0) {
    return;
  }

  for (let i = 0; i < dlmessageIds.length; i++) {
    const messageId = dlmessageIds[i];
    const url = `https://api.chatwork.com/v2/rooms/${roomId}/messages/${messageId}`;

    try {
      const response = await axios.delete(url, {
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
    sendchatwork,
    deleteMessages
};
