const express = require('express');
const app = express();
require('dotenv').config();

const { handleCommand } = require('./commands');
const { updateRanking } = require('./utils');

app.use(express.json());

// Webhookエンドポイント
app.post('/webhook', async (req, res) => {
    try {
        const webhookEvent = req.body.webhook_event;

        if (!webhookEvent) {
            return res.status(400).send('Invalid payload');
        }

        const { body, account_id, room_id, message_id } = webhookEvent;

        // コマンド処理を優先
        if (await handleCommand(body, account_id, room_id, message_id)) {
            return res.status(200).send('Command handled.');
        }

        // コマンドではない通常のメッセージの場合、ランキングを更新
        await updateRanking(room_id, account_id);

        res.status(200).send('OK');
    } catch (error) {
        console.error('Error handling webhook:', error.response ? error.response.data : error.message);
        res.status(500).send('Internal Server Error');
    }
});

// サーバーのポート設定
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
