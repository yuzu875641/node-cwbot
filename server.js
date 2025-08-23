const express = require('express');
const mentionWebhook = require('./mentionWebhook');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// ChatworkのメンションWebhookを受け取るエンドポイント
app.post("/webhook", (req, res) => {
  mentionWebhook.mentionWebhook(req, res);
});

// サーバーの起動
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
