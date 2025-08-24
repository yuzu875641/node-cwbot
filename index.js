const express = require('express');
const axios = require('axios');
const app = express();
const { URLSearchParams } = require('url');

app.use(express.json());

// 環境変数からChatwork APIトークンとRenderのDeploy Hook URLを取得
const CHATWORK_API_TOKEN = process.env.CHATWORK_API_TOKEN;
const RESTART_WEBHOOK_URL = process.env.RESTART_WEBHOOK_URL;

// 投稿履歴を管理するグローバルオブジェクト（サーバーの再起動で消滅します）
const messageHistory = {};

// 1分ごとに履歴をクリアするタイマー
setInterval(() => {
    const now = Date.now();
    for (const accountId in messageHistory) {
        messageHistory[accountId] = messageHistory[accountId].filter(
            item => now - item.timestamp < 60000 // 60秒（1分）
        );
    }
}, 10000); // 10秒ごとにチェック

// 絵文字のリスト
const emojiList = [
    ':)', ':(', ':D', '8-)', ':o', ';)', ':(', '(sweat)', ':|', ':*', ':p', '(blush)',
    ':^)', '|-)', '(inlove)', ']:)', '(talk)', '(yawn)', '(puke)', '(emo)', '8-|', ':#)',
    '(nod)', '(shake)', '(^^;)', '(whew)', '(clap)', '(bow)', '(roger)', '(flex)',
    '(dance)', ':/', '(gogo)', '(think)', '(please)', '(quick)', '(anger)', '(devil)',
    '(lightbulb)', '(*)', '(h)', '(F)', '(cracker)', '(eat)', '(^)', '(coffee)',
    '(beer)', '(handshake)', '(y)'
];
const emojiPattern = new RegExp(
  emojiList.map(e => e.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'g'
);

// メンバーを閲覧のみに降格させる関数
async function downgradeToReadonly(targetAccountId, roomId, replyMessageBody, messageId, senderAccountId) {
    try {
        const membersUrl = `https://api.chatwork.com/v2/rooms/${roomId}/members`;
        const headers = { 'X-ChatWorkToken': CHATWORK_API_TOKEN };

        // 1. 現在のメンバーリストを取得
        const currentMembersResponse = await axios.get(membersUrl, { headers });
        const currentMembers = currentMembersResponse.data;

        const adminIds = currentMembers.filter(m => m.role === 'admin').map(m => m.account_id);
        const memberIds = currentMembers.filter(m => m.role === 'member').map(m => m.account_id);
        const readonlyIds = currentMembers.filter(m => m.role === 'readonly').map(m => m.account_id);

        // 2. 対象アカウントのロールを変更
        const newAdminIds = adminIds.filter(id => id !== targetAccountId);
        const newMemberIds = memberIds.filter(id => id !== targetAccountId);
        const newReadonlyIds = [...new Set([...readonlyIds, targetAccountId])];

        // 3. メンバーリストを更新
        const updateParams = new URLSearchParams();
        updateParams.append('members_admin_ids', newAdminIds.join(','));
        updateParams.append('members_member_ids', newMemberIds.join(','));
        updateParams.append('members_readonly_ids', newReadonlyIds.join(','));
        
        await axios.put(membersUrl, updateParams.toString(), {
            headers: {
                ...headers,
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        // 4. 成功メッセージを返信
        const fullReplyMessage = `[rp aid=${senderAccountId} to=${roomId}-${messageId}][pname:${senderAccountId}]さん、${replyMessageBody}`;
        const sendReplyUrl = `https://api.chatwork.com/v2/rooms/${roomId}/messages`;
        await axios.post(sendReplyUrl, { body: fullReplyMessage }, { headers });

        console.log(`Changed ${targetAccountId} to readonly.`);
    } catch (error) {
        if (error.response) {
            // Chatwork APIからのエラーレスポンスを詳細にログ出力
            console.error(`Error in downgradeToReadonly: Request failed with status code ${error.response.status}`);
            console.error('Response data:', error.response.data);
            console.error('Response headers:', error.response.headers);
        } else {
            console.error('Error in downgradeToReadonly:', error.message);
        }
    }
}

// Webhookエンドポイント
app.post('/webhook', async (req, res) => {
    try {
        const webhookEvent = req.body.webhook_event;

        if (!webhookEvent) {
            return res.status(400).send('Invalid payload');
        }

        // Webhookのペイロードから必要な情報を取得
        const body = webhookEvent.body;
        const accountId = webhookEvent.account_id;
        const roomId = webhookEvent.room_id;
        const messageId = webhookEvent.message_id;
        const account = webhookEvent.account;
        
        const headers = { 'X-ChatWorkToken': CHATWORK_API_TOKEN };
        const sendReplyUrl = `https://api.chatwork.com/v2/rooms/${roomId}/messages`;

        // Bot自身の投稿を無視
        if (body.startsWith('[rp aid=') || body.startsWith('[To:') || body.startsWith('[info]')) {
             return res.status(200).send('Ignoring bot message.');
        }

        // --- コマンドの処理（最優先） ---
        
        // /test コマンド
        if (body.startsWith('/test')) {
            if (!accountId || !roomId || !messageId) {
                console.error('Webhook event is missing required parameters for /test command.');
                return res.status(400).send('Missing webhook parameters for test.');
            }
            const now = new Date();
            const replyMessage = `[rp aid=${accountId} to=${roomId}-${messageId}][pname:${accountId}]Botは正常に稼働中です。✅\n最終稼働確認時刻: ${now.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}`;
            await axios.post(sendReplyUrl, { body: replyMessage }, { headers });
            return res.status(200).send('Test OK');
        }

        // 管理者IDを動的に取得
        const membersUrl = `https://api.chatwork.com/v2/rooms/${roomId}/members`;
        const currentMembersResponse = await axios.get(membersUrl, { headers });
        const currentMembers = currentMembersResponse.data;
        const adminIds = currentMembers.filter(m => m.role === 'admin').map(m => m.account_id);

        // /restart コマンド（管理者のみ）
        if (body.startsWith('/restart')) {
            if (!adminIds.includes(accountId)) {
                return res.status(200).send('Unauthorized user for restart.');
            }
            if (!RESTART_WEBHOOK_URL) {
                await axios.post(sendReplyUrl, { body: `[rp aid=${accountId}] Render再起動用のURLが設定されていません。\nRenderのダッシュボードでDeploy Hookを作成し、環境変数RESTART_WEBHOOK_URLに設定してください。` }, { headers });
                return res.status(200).send('Restart URL not configured.');
            }
            const replyMessage = `[rp aid=${accountId}] Botを再起動します。\nRenderが起動するまで、約60秒ほどかかります。`;
            await axios.post(sendReplyUrl, { body: replyMessage }, { headers });
            await axios.post(RESTART_WEBHOOK_URL);
            return res.status(200).send('Restarting...');
        }

        // 送信者が管理者IDリストに含まれていれば、以降のルールチェックを無視
        if (adminIds.includes(accountId)) {
            return res.status(200).send('Ignoring admin user.');
        }

        // --- ルールチェックのロジック ---

        // 1. [toall] 投稿チェック
        if (body.includes('[toall]')) {
            await downgradeToReadonly(
                accountId,
                roomId,
                '全員宛ての投稿は管理目的のユーザーに限定されています。閲覧メンバーに変更しました。',
                messageId,
                accountId
            );
            return res.status(200).send('OK');
        }

        // 2. /kick 投稿チェック
        if (body.startsWith('/kick')) {
            const replyPattern = /\[rp aid=(\d+)/;
            const match = body.match(replyPattern);
            if (match) {
                const targetAccountId = parseInt(match[1], 10);
                await downgradeToReadonly(
                    targetAccountId,
                    roomId,
                    `${targetAccountId}を閲覧メンバーにしました。`,
                    messageId,
                    accountId
                );
            }
            return res.status(200).send('OK');
        }

        // 3. 絵文字の数チェック
        const matches = body.match(emojiPattern);
        const emojiCount = matches ? matches.length : 0;
        if (emojiCount >= 15) {
            await downgradeToReadonly(
                accountId,
                roomId,
                '投稿内の絵文字数が多すぎるため、閲覧メンバーに変更しました。',
                messageId,
                accountId
            );
            return res.status(200).send('OK');
        }

        // 4. 連続投稿チェック
        const now = Date.now();
        if (!messageHistory[accountId]) {
            messageHistory[accountId] = [];
        }
        messageHistory[accountId].push({ body, timestamp: now });
        const sameMessageCount = messageHistory[accountId].filter(item => item.body === body).length;
        
        if (sameMessageCount >= 15) {
            await downgradeToReadonly(
                accountId,
                roomId,
                '投稿回数が制限を超えました。閲覧メンバーに変更されました。',
                messageId,
                accountId
            );
            return res.status(200).send('OK');
        } else if (sameMessageCount >= 10) {
            const replyMessage = `[rp aid=${accountId} to=${roomId}-${messageId}][pname:${accountId}]さん、同じ内容の連続投稿はご遠慮ください。`;
            await axios.post(sendReplyUrl, { body: replyMessage }, { headers });
            return res.status(200).send('OK');
        }

        res.status(200).send('OK');
    } catch (error) {
        // Webhook処理全体でのエラーを詳細にログ出力
        if (error.response) {
            console.error(`Error handling webhook: Request failed with status code ${error.response.status}`);
            console.error('Response data:', error.response.data);
        } else {
            console.error('Error handling webhook:', error.message);
        }
        res.status(500).send('Internal Server Error');
    }
});

// サーバーのポート設定
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
