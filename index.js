const express = require('express');
const axios = require('axios');
const app = express();
const { URLSearchParams } = require('url');
const { createClient } = require('@supabase/supabase-js');

app.use(express.json());

// 環境変数から各種APIトークンとURLを取得
const CHATWORK_API_TOKEN = process.env.CHATWORK_API_TOKEN;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Supabaseクライアントの初期化
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

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

// Geminiにメッセージを送信する関数
async function generateGemini(body, message, messageId, roomId, accountId) {
    try {
        message = "あなたはトークルーム「ゆずの部屋」のボットのゆずbotです。以下のメッセージに対して200字以下で返答して下さい:" + message;
        
        const response = await axios.post(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
            {
                contents: [
                    {
                        parts: [
                            {
                                text: message,
                            },
                        ],
                    },
                ],
            },
            {
                headers: {
                    "Content-Type": "application/json",
                },
            }
        );

        const responseContent = response.data.candidates[0].content;
        let responseParts = responseContent.parts.map((part) => part.text).join("\n");
        responseParts = responseParts.replace(/\*/g, ""); // アスタリスクを削除
        
        await sendchatwork(`[rp aid=${accountId} to=${roomId}-${messageId}][pname:${accountId}]さん\nゆずbotです。\n${responseParts}`, roomId);
    } catch (error) {
        console.error('エラーが発生しました:', error.response ? error.response.data : error.message);

        await sendchatwork(`[rp aid=${accountId} to=${roomId}-${messageId}][pname:${accountId}]さん\nエラーが発生しました。`, roomId);
    }
}

// チャットワークのルーム情報を取得する関数
async function getChatworkRoomInfo(roomId) {
    const url = `https://api.chatwork.com/v2/rooms/${roomId}`;
    const headers = { 'X-ChatWorkToken': CHATWORK_API_TOKEN };
    const response = await axios.get(url, { headers });
    return response.data;
}

// チャットワークのルームメンバー数を取得する関数
async function getChatworkRoomMemberCount(roomId) {
    const url = `https://api.chatwork.com/v2/rooms/${roomId}/members`;
    const headers = { 'X-ChatWorkToken': CHATWORK_API_TOKEN };
    const response = await axios.get(url, { headers });
    return response.data.length;
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
        
        // メッセージ本文が空か、必須パラメータが欠落しているか確認
        if (!body || !accountId || !roomId || !messageId) {
            console.error('Webhook event is missing required parameters (body, accountId, roomId, or messageId).');
            return res.status(400).send('Missing webhook parameters.');
        }

        // Bot自身の投稿を無視
        if (body.startsWith('[rp aid=') || body.startsWith('[To:') || body.startsWith('[info]')) {
             return res.status(200).send('Ignoring bot message.');
        }

        // --- おみくじ コマンド ---
        // 投稿されたメッセージが「おみくじ」という単語と完全に一致する場合にのみ反応
        if (body.trim() === 'おみくじ') {
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
            
            const replyMessage = `[rp aid=${accountId} to=${roomId}-${messageId}][pname:${accountId}]さん、\n本日のおみくじの結果は「**${result}**」です。🎉`;
            await sendchatwork(replyMessage, roomId);
            return res.status(200).send('Fortune OK');
        }

        // --- /ai コマンド ---
        if (body.startsWith('/ai')) {
            const query = body.substring(4).trim(); // '/ai' の後のテキストを取得
            
            if (query.length === 0) {
                const replyMessage = `[rp aid=${accountId} to=${roomId}-${messageId}][pname:${accountId}]さん、\n聞きたいことを入力してください。`;
                await sendchatwork(replyMessage, roomId);
                return res.status(200).send('No query provided.');
            }
            
            await generateGemini(body, query, messageId, roomId, accountId);
            return res.status(200).send('AI command executed.');
        }
        
        // --- /roominfo コマンド ---
        if (body.startsWith('/roominfo')) {
            const targetRoomId = body.split(' ')[1]; // コマンドの後のルームIDを取得
            if (!targetRoomId) {
                const replyMessage = `[rp aid=${accountId} to=${roomId}-${messageId}][pname:${accountId}]さん\nルームIDを指定してください。（例：/roominfo 123456789）`;
                await sendchatwork(replyMessage, roomId);
                return res.status(200).send('No room ID provided.');
            }

            try {
                const roomInfo = await getChatworkRoomInfo(targetRoomId);
                const roomMemberCount = await getChatworkRoomMemberCount(targetRoomId);
                
                const room = `[info][title]${roomInfo.name}[/title]メンバー数: ${roomMemberCount}\nメッセージ数: ${roomInfo.message_num}\nファイル数: ${roomInfo.file_num}\nタスク数: ${roomInfo.task_num}\nアイコンURL: ${roomInfo.icon_path.replace(/rsz\./g, '')}[/info]`;
                
                await sendchatwork(`[rp aid=${accountId} to=${roomId}-${messageId}][pname:${accountId}]さん\n${room}`, roomId);
                return res.status(200).send('Room info command executed.');
            } catch (error) {
                console.error('Room info error:', error.response?.data || error.message);
                await sendchatwork(`[rp aid=${accountId} to=${roomId}-${messageId}][pname:${accountId}]さん\nごめん。そのルームの情報はないみたい(´・ω・｀)`, roomId);
                return res.status(500).send('Room info fetch error.');
            }
        }

        // --- 削除 コマンド ---
        if (body.includes("削除")) {
            const headers = { 'X-ChatWorkToken': CHATWORK_API_TOKEN };
            const membersUrl = `https://api.chatwork.com/v2/rooms/${roomId}/members`;
            const currentMembersResponse = await axios.get(membersUrl, { headers });
            const currentMembers = currentMembersResponse.data;
            const adminIds = currentMembers.filter(m => m.role === 'admin').map(m => m.account_id);

            // 管理者のみが削除コマンドを実行できるようにする
            if (!adminIds.includes(accountId)) {
                const replyMessage = `[rp aid=${accountId} to=${roomId}-${messageId}][pname:${accountId}]さん、\nこのコマンドは管理者のみ実行できます。`;
                await sendchatwork(replyMessage, roomId);
                return res.status(200).send('Unauthorized for delete command.');
            }
            
            await deleteMessages(body, roomId, accountId, messageId);
            return res.status(200).send('Delete command executed.');
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
