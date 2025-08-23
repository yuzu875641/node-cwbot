const express = require('express');
const app = express();
const bodyParser = require('body-parser');

const { mentionWebhook } = require('./mentionWebhook');

// ポート番号の設定
const port = process.env.PORT || 3000;

app.use(bodyParser.json());

// GASからのアクセス専用ルート
// GET /webhookにアクセスがあった場合に200 OKを返す
app.get('/webhook', (req, res) => {
  res.status(200).send('Webhook is running');
});

// ChatworkからのWebhookイベントを受け付ける
app.post('/mention', mentionWebhook);

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
