// index.js
const express = require('express');
const app = express();
const chatwork = require('./module/CWinfo');
const mentionHandler = require('./webhook/mention');

// ポートはRenderの環境変数から取得
const PORT = process.env.PORT || 3000;

// JSONリクエストボディをパース
app.use(express.json());

// WebhookのURLを設定
app.post('/webhook', (req, res) => {
    // Chatworkから送信されたWebhookのデータを処理
    const data = req.body;
    
    // メンションメッセージの場合、mention.jsのハンドラーを呼び出す
    if (data.webhook_event_type === 'mention') {
        mentionHandler.handleMention(data);
    }
    
    res.status(200).send('OK');
});

// サーバーを起動
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
