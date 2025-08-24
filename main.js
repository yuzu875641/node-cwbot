const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');
const rankingFunctions = require('./ranking');
const { DateTime } = require('luxon');

// 環境変数を設定
const CHATWORK_API_TOKEN = process.env.CHATWORK_API_TOKEN;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const myAdminId = 10617115; // あなたの管理者アカウントID

const app = express();
const port = process.env.PORT || 3000;

app.use(bodyParser.json());

// Supabaseクライアントの初期化
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ChatworkのAPIを呼び出してメッセージを投稿するヘルパー関数（返信形式）
async function postMessageWithReply(roomId, messageId, accountId, messageBody) {
    const replyContent = `[rp aid=${accountId} to=${roomId}-${messageId}][pname:${accountId}]さん\n${messageBody}`;
    
    try {
        await axios.post(
            `https://api.chatwork.com/v2/rooms/${roomId}/messages`,
            { body: replyContent },
            { headers: { 'X-ChatWorkToken': CHATWORK_API_TOKEN } }
        );
        console.log(`Successfully sent reply to room ${roomId}`);
    } catch (error) {
        console.error('Failed to send message:', error.response.data);
    }
}

// メンバーの権限を更新する関数
async function updateMemberRole(roomId, accountId, newRole) {
    try {
        await axios.put(
            `https://api.chatwork.com/v2/rooms/${roomId}/members`,
            // 修正: `members_admin_ids` パラメータを追加
            { members: [{ account_id: accountId, role: newRole }], members_admin_ids: [myAdminId] },
            { headers: { 'X-ChatWorkToken': CHATWORK_API_TOKEN } }
        );
        console.log(`Successfully updated member ${accountId} to role: ${newRole}`);
    } catch (error) {
        console.error('Failed to update member role:', error.response.data);
    }
}

// Chatworkの絵文字リスト（スパム対策用）
const chatworkEmojis = [
    ':)', ':(', ':D', '8-)', ':o', ';)', ':(', '(sweat)', ':|', ':*', ':p',
    '(blush)', ':^)', '|-)', '(inlove)', ':]', ':)', '(talk)', '(yawn)',
    '(puke)', '(emo)', '8-|', ':#', ')(', '(nod)', '(shake)', '(^^;)',
    '(whew)', '(clap)', '(bow)', '(roger)', '(flex)', '(dance)', ':/', '(gogo)',
    '(think)', '(please)', '(quick)', '(anger)', '(devil)', '(lightbulb)', '(*)',
    '(h)', '(F)', '(cracker)', '(eat)', '(^)', '(coffee)', '(beer)',
    '(handshake)', '(y)'
];

// ChatworkからのWebhookを受け取るエンドポイント
app.post('/webhook', async (req, res) => {
    const event = req.body.webhook_event;
    
    if (!event) {
        return res.sendStatus(200);
    }
    
    const { body, account_id, room_id, message_id } = event;
    
    const accountId = account_id;
    const roomId = room_id;
    const messageId = message_id;
    const messageBody = body ? body.trim() : '';

    if (!messageBody) {
        return res.sendStatus(200);
    }
    
    // メッセージカウント機能
    const today = new Date().toISOString().slice(0, 10);
    try {
        const { data, error } = await supabase
            .from('message_counts')
            .select('*')
            .eq('room_id', roomId)
            .single();

        let newCount = 1;
        if (data && data.date === today) {
            newCount = data.message_count + 1;
        }

        await supabase
            .from('message_counts')
            .upsert({ 
                room_id: roomId, 
                date: today, 
                message_count: newCount, 
                last_message_id: messageId 
            }, { onConflict: 'room_id' });
            
        console.log(`Room ${roomId}: Message count updated to ${newCount}`);
    } catch (error) {
        console.error('Error updating message count:', error);
    }

    // 管理者からのメッセージは無視
    if (accountId === myAdminId) {
        return res.sendStatus(200);
    }
    
    const commandBody = messageBody.replace(/\[To:\d+\]/, '').trim();
    
    // スパム対策機能
    let emojiCount = 0;
    for (const emoji of chatworkEmojis) {
        emojiCount += (messageBody.match(new RegExp(emoji.replace(/[()]/g, '\\$&'), 'g')) || []).length;
    }
    const isToallMessage = messageBody.trim().startsWith('[toall]');
    const hasAnyEmoji = emojiCount > 0;
    
    if (emojiCount >= 15 || (isToallMessage && hasAnyEmoji)) {
        await updateMemberRole(roomId, accountId, 'viewer');
        return res.sendStatus(200);
    }

    // 各種コマンド処理
    switch (commandBody) {
        case '/whoami':
            try {
                const membersResponse = await axios.get(
                    `https://api.chatwork.com/v2/rooms/${roomId}/members`,
                    { headers: { 'X-ChatWorkToken': CHATWORK_API_TOKEN } }
                );
                const senderInfo = membersResponse.data.find(member => member.account_id === accountId);
                if (senderInfo) {
                    const replyMessage = `[info][title]送信者情報[/title]\n名前: ${senderInfo.name}\nアカウントID: ${senderInfo.account_id}\n権限: ${senderInfo.role}\n[/info]`;
                    await postMessageWithReply(roomId, messageId, accountId, replyMessage);
                } else {
                    await postMessageWithReply(roomId, messageId, accountId, "送信者情報が見つかりませんでした。");
                }
            } catch (error) {
                console.error('Failed to get member info:', error.response.data);
                await postMessageWithReply(roomId, messageId, accountId, "メンバー情報の取得中にエラーが発生しました。");
            }
            break;
            
        case 'おみくじ':
            const omikujiToday = new Date().toISOString().slice(0, 10);
            const { data: history } = await supabase
                .from('omikuji_history')
                .select('*')
                .eq('room_id', roomId)
                .eq('last_drawn_date', omikujiToday);

            if (history && history.length > 0) {
                await postMessageWithReply(roomId, messageId, accountId, "この部屋でおみくじを引けるのは1日1回です。また明日お試しください。");
            } else {
                const omikujiResults = ["大吉", "吉", "中吉", "小吉", "末吉", "凶"];
                const result = omikujiResults[Math.floor(Math.random() * omikujiResults.length)];
                const replyMessage = `あなたへのおみくじの結果は...「${result}」でした！`;
                
                await postMessageWithReply(roomId, messageId, accountId, replyMessage);
                
                await supabase
                    .from('omikuji_history')
                    .upsert([{ room_id: roomId, last_drawn_date: omikujiToday }], { onConflict: 'room_id' });
            }
            break;
            
        case '/時報 OK':
            const { data: okData } = await supabase.from('time_report_rooms').select('*').eq('room_id', roomId);
            if (okData && okData.length > 0) {
                await postMessageWithReply(roomId, messageId, accountId, "この部屋はすでに時報設定がOKになっています。");
            } else {
                await supabase.from('time_report_rooms').insert([{ room_id: roomId }]);
                await postMessageWithReply(roomId, messageId, accountId, "この部屋で時報を開始します。");
            }
            break;
            
        case '/時報 NO':
            const { data: noData } = await supabase.from('time_report_rooms').select('*').eq('room_id', roomId);
            if (noData && noData.length > 0) {
                await supabase.from('time_report_rooms').delete().eq('room_id', roomId);
                await postMessageWithReply(roomId, messageId, accountId, "この部屋での時報を停止します。");
            } else {
                await postMessageWithReply(roomId, messageId, accountId, "この部屋はすでに時報設定がNOになっています。");
            }
            break;
            
        case '/topneo':
            await rankingFunctions.topNeo(null, null, messageId, roomId, accountId);
            break;

        case '/topneohack':
            await rankingFunctions.topNeoHack(null, null, messageId, roomId, accountId);
            break;

        case '/topfile':
            await rankingFunctions.topFile(null, null, messageId, roomId, accountId);
            break;
            
        default:
            // 該当するコマンドがない場合は何もしない
            break;
    }

    res.sendStatus(200);
});

// サーバーを起動
app.listen(port, () => {
    console.log(`Chatwork bot listening on port ${port}`);
});

// 定期的な時報投稿
async function sendTimeReport() {
    const now = new Date();
    const currentHour = now.getHours();
    
    if (now.getMinutes() === 0) {
        const { data: rooms, error } = await supabase
            .from('time_report_rooms')
            .select('room_id');
            
        if (error) {
                console.error('Error fetching rooms from Supabase:', error);
                return;
        }

        const message = `[info][title]時報[/title]現在時刻は、${currentHour}時です。[/info]`;
        
        for (const room of rooms) {
            try {
                await axios.post(
                    `https://api.chatwork.com/v2/rooms/${room.room_id}/messages`,
                    { body: message },
                    { headers: { 'X-ChatWorkToken': CHATWORK_API_TOKEN } }
                );
                console.log(`Successfully sent time report to room ${room.room_id}`);
            } catch (error) {
                console.error('Failed to send message:', error.response.data);
            }
        }
    }
}

setInterval(sendTimeReport, 60 * 1000);
