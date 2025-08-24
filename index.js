const express = require('express');
const axios = require('axios');
const app = express();
const { URLSearchParams } = require('url');

app.use(express.json());

// 環境変数からChatwork APIトークンを取得
const CHATWORK_API_TOKEN = process.env.CHATWORK_API_TOKEN;

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
        console.error('Error in downgradeToReadonly:', error.message);
    }
}

// Webhookエンドポイント
app.post('/webhook', async (req, res) => {
    try {
        const webhookEvent = req.body.webhook_event;

        if (!webhookEvent) {
            return res.status(400).send('Invalid payload');
        }

        const { body, account_id, room_id, message_id, account } = webhookEvent;

        // Bot自身の投稿を無視
        if (body.startsWith('[rp aid=') || body.startsWith('[To:') || body.startsWith('[info]')) {
             return res.status(200).send('Ignoring bot message.');
        }

        // 管理者IDを動的に取得
        const membersUrl = `https://api.chatwork.com/v2/rooms/${room_id}/members`;
        const headers = { 'X-ChatWorkToken': CHATWORK_API_TOKEN };
        const currentMembersResponse = await axios.get(membersUrl, { headers });
        const currentMembers = currentMembersResponse.data;
        const adminIds = currentMembers.filter(m => m.role === 'admin').map(m => m.account_id);

        // 送信者が管理者IDリストに含まれていれば無視
        if (adminIds.includes(account_id)) {
            return res.status(200).send('Ignoring admin user.');
        }

        // --- ルールチェックのロジック ---

        // 1. [toall] 投稿チェック
        if (body.includes('[toall]')) {
            await downgradeToReadonly(
                account_id,
                room_id,
                '全員宛ての投稿は管理目的のユーザーに限定されています。閲覧メンバーに変更しました。',
                message_id,
                account_id
            );
            return res.status(200).send('OK');
        }

        // 2. /kick 投稿チェック
        if (body.startsWith('/kick')) {
            // この機能は管理者のみが使用できるため、`adminIds.includes(account_id)`のチェックをここで実施
            if (adminIds.includes(account_id)) {
                const replyPattern = /\[rp aid=(\d+)/;
                const match = body.match(replyPattern);
                if (match) {
                    const targetAccountId = parseInt(match[1], 10);
                    await downgradeToReadonly(
                        targetAccountId,
                        room_id,
                        `${targetAccountId}を閲覧メンバーにしました。`,
                        message_id,
                        account_id
                    );
                }
            }
            return res.status(200).send('OK');
        }

        // 3. 絵文字の数チェック
        const matches = body.match(emojiPattern);
        const emojiCount = matches ? matches.length : 0;
        if (emojiCount >= 15) {
            await downgradeToReadonly(
                account_id,
                room_id,
                '投稿内の絵文字数が多すぎるため、閲覧メンバーに変更しました。',
                message_id,
                account_id
            );
            return res.status(200).send('OK');
        }

        // 4. 連続投稿チェック
        const now = Date.now();
        if (!messageHistory[account_id]) {
            messageHistory[account_id] = [];
        }
        messageHistory[account_id].push({ body, timestamp: now });
        const sameMessageCount = messageHistory[account_id].filter(item => item.body === body).length;
        
        if (sameMessageCount >= 15) {
            await downgradeToReadonly(
                account_id,
                room_id,
                '投稿回数が制限を超えました。閲覧メンバーに変更されました。',
                message_id,
                account_id
            );
            return res.status(200).send('OK');
        } else if (sameMessageCount >= 10) {
            const replyMessage = `[rp aid=${account_id} to=${room_id}-${message_id}][pname:${account_id}]さん、同じ内容の連続投稿はご遠慮ください。`;
            const sendReplyUrl = `https://api.chatwork.com/v2/rooms/${room_id}/messages`;
            await axios.post(sendReplyUrl, { body: replyMessage }, { headers });
            return res.status(200).send('OK');
        }

        res.status(200).send('OK');
    } catch (error) {
        console.error('Error handling webhook:', error.message);
        res.status(500).send('Internal Server Error');
    }
});

// サーバーのポート設定
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
