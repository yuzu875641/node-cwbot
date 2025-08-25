const express = require('express');
const app = express();
require('dotenv').config();

const { handleCommand } = require('./commands');
const { updateRanking, changeMemberRoleToReadonly, sendchatwork } = require('./utils');

app.use(express.json());

// 絵文字リストを定義
const EMOJI_LIST = [':)', ':(', ':D', '8-)', ':o', ';)', ';(', '(sweat)', ':|', ':*', ':p', '(blush)', ':^)', '|-)', '(inlove)', ':]', '(talk)', '(yawn)', '(puke)', '(emo)', '8-|', ':#', '(nod)', '(shake)', '(^^;)', '(whew)', '(clap)', '(bow)', '(roger)', '(flex)', '(dance)', ':/', '(gogo)', '(think)', '(please)', '(quick)', '(anger)', '(devil)', '(lightbulb)', '(*)', '(h)', '(F)', '(cracker)', '(eat)', '(^)', '(coffee)', '(beer)', '(handshake)', '(y)'];

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

        // 「わかめ」に反応する新しいロジック
        if (body.trim() === 'わかめ') {
            const CHATWORK_API_TOKEN_SUB = process.env.CHATWORK_API_TOKEN_SUB;
            if (CHATWORK_API_TOKEN_SUB) {
                await sendchatwork('いい意見だね(y)', room_id, CHATWORK_API_TOKEN_SUB);
                return res.status(200).send('Wakame handled.');
            }
        }

        // 「おみくじ」に反応するロジック
　　　　　if (body.trim() === 'おみくじ') {
  　　　　　　　  await handleOmikujiCommand(account_id, room_id, message_id);
   　　　　　　　 return res.status(200).send('Omikuji handled.');
　　　　　}

        // 絵文字の数をカウントする
        let emojiCount = 0;
        EMOJI_LIST.forEach(emoji => {
            const regex = new RegExp(escapeRegExp(emoji), 'g');
            const matches = body.match(regex);
            if (matches) {
                emojiCount += matches.length;
            }
        });

        console.log(`Emoji count: ${emojiCount}`);
        
        // 15個以上の絵文字が含まれているかチェック
        if (emojiCount >= 15) {
            await changeMemberRoleToReadonly(room_id, account_id);
            await sendchatwork(`[rp aid=${account_id} to=${room_id}-${message_id}]@${account_id}さん\n絵文字の使いすぎです。権限を閲覧のみに変更しました。`, room_id);
        }

        // コマンドではない通常のメッセージの場合、ランキングを更新
        await updateRanking(room_id, account_id);

        res.status(200).send('OK');
    } catch (error) {
        console.error('Error handling webhook:', error.response ? error.response.data : error.message);
        res.status(500).send('Internal Server Error');
    }
});

function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// サーバーのポート設定
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
