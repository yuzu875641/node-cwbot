const express = require('express');
const axios = require('axios');
const app = express();
const { URLSearchParams } = require('url');
const { createClient } = require('@supabase/supabase-js');

app.use(express.json());

// 環境変数から各種APIトークンとURLを取得
const CHATWORK_API_TOKEN = process.env.CHATWORK_API_TOKEN;
const RESTART_WEBHOOK_URL = process.env.RESTART_WEBHOOK_URL;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

// Supabaseクライアントの初期化
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

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

// おみくじの結果リスト
const fortunes = ['大吉', '吉', '中吉', '小吉', '末吉', '凶', '大凶'];

// チャットワークへメッセージを送信する関数
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
        const fullReplyMessage = `[rp aid=${senderAccountId} to=${roomId}-${messageId}][pname:${senderAccountId}]さん、\n${replyMessageBody}`;
        await sendchatwork(fullReplyMessage, roomId);

        console.log(`Changed ${targetAccountId} to readonly.`);
    } catch (error) {
        if (error.response) {
            console.error(`Error in downgradeToReadonly: Request failed with status code ${error.response.status}`);
            console.error('Response data:', error.response.data);
            console.error('Response headers:', error.response.headers);
        } else {
            console.error('Error in downgradeToReadonly:', error.message);
        }
    }
}

// メッセージを削除する関数
async function deleteMessages(body, roomId, accountId, messageId) {
    // 削除対象のメッセージIDを正規表現で抽出
    const dlmessageIds = [...body.matchAll(/(?<=to=\d+-)(\d+)/g)].map(match => match[1]);

    if (dlmessageIds.length === 0) {
        const replyMessage = `[rp aid=${accountId} to=${roomId}-${messageId}][pname:${accountId}]さん、\n削除対象のメッセージIDが見つかりませんでした。`;
        await sendchatwork(replyMessage, roomId);
        return;
    }
    
    let deletedCount = 0;
    let failedIds = [];

    for (const id of dlmessageIds) {
        const url = `https://api.chatwork.com/v2/rooms/${roomId}/messages/${id}`;
        try {
            await axios.delete(url, {
                headers: {
                    'Accept': 'application/json',
                    'x-chatworktoken': CHATWORK_API_TOKEN,
                }
            });
            deletedCount++;
        } catch (err) {
            console.error(`メッセージID ${id} の削除中にエラーが発生しました:`, err.response ? err.response.data : err.message);
            failedIds.push(id);
        }
    }
    
    let replyMessage = `[rp aid=${accountId} to=${roomId}-${messageId}][pname:${accountId}]さん、\n**${deletedCount}**件のメッセージを削除しました。`;
    if (failedIds.length > 0) {
        replyMessage += `\n以下のメッセージは削除に失敗しました: ${failedIds.join(', ')}`;
    }
    await sendchatwork(replyMessage, roomId);
}

// Webhookエンドポイント
app.post('/webhook', async (req, res) => {
    try {
        const webhookEvent = req.body.webhook_event;
        const botId = 1234567; // TODO: あなたのBotのChatwork IDに置き換えてください

        if (!webhookEvent) {
            return res.status(400).send('Invalid payload');
        }

        // Webhookのペイロードから必要な情報を取得
        const body = webhookEvent.body;
        const accountId = webhookEvent.account_id;
        const roomId = webhookEvent.room_id;
        const messageId = webhookEvent.message_id;
        
        // メッセージ本文が空か、必須パラメータが欠落しているか確認
        if (!body || !accountId || !roomId || !messageId) {
            console.error('Webhook event is missing required parameters (body, accountId, roomId, or messageId).');
            return res.status(400).send('Missing webhook parameters.');
        }

        const headers = { 'X-ChatWorkToken': CHATWORK_API_TOKEN };

        // Bot自身の投稿を無視
        if (body.startsWith('[rp aid=') || body.startsWith('[To:') || body.startsWith('[info]')) {
             return res.status(200).send('Ignoring bot message.');
        }

        // --- コマンドの処理（最優先） ---
        
        // /test コマンド
        if (body.startsWith('/test')) {
            const now = new Date();
            const replyMessage = `[rp aid=${accountId} to=${roomId}-${messageId}][pname:${accountId}]Botは正常に稼働中です。✅\n最終稼働確認時刻: ${now.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}`;
            await sendchatwork(replyMessage, roomId);
            return res.status(200).send('Test OK');
        }
        
        // /coin コマンド
        if (body.startsWith('/coin')) {
            const result = Math.random() < 0.5 ? '表' : '裏';
            const replyMessage = `[rp aid=${accountId} to=${roomId}-${messageId}][pname:${accountId}]コインを投げました... 結果は「**${result}**」です。🪙`;
            await sendchatwork(replyMessage, roomId);
            return res.status(200).send('Coin OK');
        }

        // --- おみくじ コマンド ---
        if (body.startsWith('おみくじ')) {
            const today = new Date().toISOString().slice(0, 10);
            
            // Supabaseから本日のおみくじ履歴をチェック
            const { data, error } = await supabase
                .from('fortune_logs')
                .select('*')
                .eq('account_id', accountId)
                .eq('date', today);
            
            if (error) {
                console.error('Supabase query error:', error);
                const errorMessage = `[rp aid=${accountId} to=${roomId}-${messageId}][pname:${accountId}]さん、\nおみくじの履歴取得中にエラーが発生しました。`;
                await sendchatwork(errorMessage, roomId);
                return res.status(500).send('Supabase Error');
            }

            if (data && data.length > 0) {
                const replyMessage = `[rp aid=${accountId} to=${roomId}-${messageId}][pname:${accountId}]さん、\n本日のおみくじは既に引きました。明日また引けます。`;
                await sendchatwork(replyMessage, roomId);
                return res.status(200).send('Already pulled today.');
            }
            
            const result = fortunes[Math.floor(Math.random() * fortunes.length)];
            
            // Supabaseにおみくじの結果を保存
            const { error: insertError } = await supabase
                .from('fortune_logs')
                .insert([{ account_id: accountId, date: today, fortune: result }]);

            if (insertError) {
                console.error('Supabase insert error:', insertError);
                const errorMessage = `[rp aid=${accountId} to=${roomId}-${messageId}][pname:${accountId}]さん、\nおみくじの履歴保存中にエラーが発生しました。`;
                await sendchatwork(errorMessage, roomId);
                return res.status(500).send('Supabase Insert Error');
            }
            
            const replyMessage = `[rp aid=${accountId} to=${roomId}-${messageId}][pname:${accountId}]さん、\n本日のおみくじの結果は[download:1]${result}[/download]です。🎉`;
            await sendchatwork(replyMessage, roomId);
            return res.status(200).send('Fortune OK');
        }


        // 管理者IDを動的に取得
        const membersUrl = `https://api.chatwork.com/v2/rooms/${roomId}/members`;
        const currentMembersResponse = await axios.get(membersUrl, { headers });
        const currentMembers = currentMembersResponse.data;
        const adminIds = currentMembers.filter(m => m.role === 'admin').map(m => m.account_id);
        
        // --- /whoami コマンド ---
        if (body.startsWith('/whoami')) {
            const senderInfo = currentMembers.find(member => member.account_id === accountId);
            const senderName = senderInfo ? senderInfo.name : '不明なユーザー';
            const senderRole = senderInfo ? senderInfo.role : '不明';

            const roleMap = {
                'admin': '管理者',
                'member': 'メンバー',
                'readonly': '閲覧のみ'
            };
            const displayRole = roleMap[senderRole] || senderRole;

            const replyMessage = `[rp aid=${accountId} to=${roomId}-${messageId}][pname:${accountId}]あなたの情報です。\n- 名前: ${senderName}\n- 部屋の権限: ${displayRole}`;
            await sendchatwork(replyMessage, roomId);
            return res.status(200).send('Whoami OK');
        }

        // --- /削除 コマンド（管理者のみ） ---
        const deleteCommandPattern = new RegExp(`\\[rp aid=${botId} to=${roomId}-${messageId}\\]\\[pname:${botId}\\]さん\\s*\\/削除`);
        if (body.match(deleteCommandPattern)) {
            if (!adminIds.includes(accountId)) {
                const replyMessage = `[rp aid=${accountId} to=${roomId}-${messageId}][pname:${accountId}]さん、\nこのコマンドは管理者のみ実行できます。`;
                await sendchatwork(replyMessage, roomId);
                return res.status(200).send('Unauthorized for delete command.');
            }
            await deleteMessages(body, roomId, accountId, messageId);
            return res.status(200).send('Delete command executed.');
        }


        // /restart コマンド（管理者のみ）
        if (body.startsWith('/restart')) {
            if (!adminIds.includes(accountId)) {
                return res.status(200).send('Unauthorized user for restart.');
            }
            if (!RESTART_WEBHOOK_URL) {
                const replyMessage = `[rp aid=${accountId}][pname:${accountId}]さん、\nRender再起動用のURLが設定されていません。\nRenderのダッシュボードでDeploy Hookを作成し、環境変数RESTART_WEBHOOK_URLに設定してください。`;
                await sendchatwork(replyMessage, roomId);
                return res.status(200).send('Restart URL not configured.');
            }
            const replyMessage = `[rp aid=${accountId}][pname:${accountId}]さん、\nBotを再起動します。\nRenderが起動するまで、約60秒ほどかかります。`;
            await sendchatwork(replyMessage, roomId);
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
            const replyMessage = `[rp aid=${accountId} to=${roomId}-${messageId}][pname:${accountId}]さん、\n同じ内容の連続投稿はご遠慮ください。`;
            await sendchatwork(replyMessage, roomId);
            return res.status(200).send('OK');
        }

        res.status(200).send('OK');
    } catch (error) {
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
