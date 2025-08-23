// module/CWinfo.js
const axios = require('axios');
const fileFunctions = require('../suisho/file'); // suisho/file.jsを読み込み

// 環境変数からAPIトークンを取得
const CHATWORK_API_TOKEN = process.env.CHATWORK_API_TOKEN;

// メッセージを送信する関数
exports.sendMessage = async (roomId, message) => {
    if (!CHATWORK_API_TOKEN) {
        console.error("Chatwork API token not set.");
        return;
    }

    const url = `https://api.chatwork.com/v2/rooms/${roomId}/messages`;
    
    try {
        await axios.post(url, { body: message }, {
            headers: {
                'X-ChatWorkToken': CHATWORK_API_TOKEN
            }
        });
        console.log(`Message sent to room ${roomId}`);
    } catch (error) {
        console.error('Error sending message to Chatwork:', error.response ? error.response.data : error.message);
    }
};

// ... その他のChatwork関連関数（例: メンバー情報取得など）
