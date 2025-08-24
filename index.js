const express = require('express');
const axios = require('axios');
const app = express();
const { URLSearchParams } = require('url');
const { createClient } = require('@supabase/supabase-js');
const { DateTime } = require('luxon');
require('dotenv').config();

app.use(express.json());

// 環境変数から各種APIトークンとURLを取得
const CHATWORK_API_TOKEN = process.env.CHATWORK_API_TOKEN;
const CHATWORK_API_BASE = 'https://api.chatwork.com/v2';
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const YUZUBOT_ACCOUNT_ID = process.env.YUZUBOT_ACCOUNT_ID;

// ランキングから除外するルームIDのリスト
const EXCLUDED_ROOMS = ['407802259', /* 他に除外したいIDがあればここに追加 */];

// Supabaseクライアントの初期化
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// おみくじの結果リスト
const fortunes = ['大吉', '吉', '中吉', '小吉', '末吉', '凶', '大凶'];

// 現在の日付を取得 (YYYY-MM-DD形式)
function getToday() {
    const japanTime = DateTime.now().setZone('Asia/Tokyo');
    return japanTime.toFormat('yyyy-MM-dd');
}

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

// チャットワークのルームリストを取得する関数
async function getChatworkRoomlist() {
    const url = 'https://api.chatwork.com/v2/rooms';
    const headers = { 'X-ChatWorkToken': CHATWORK_API_TOKEN };
    const response = await axios.get(url, { headers });
    return response.data;
}

// 統計データを保存する関数
async function saving(body, message, messageId, roomId, accountId) {
  try {
    const japanTime = DateTime.now().setZone('Asia/Tokyo');
    const today = japanTime.toFormat('yyyy-MM-dd');
    const timeh = japanTime.toFormat('H');
    const list = await getChatworkRoomlist();
    const { data, error } = await supabase
      .from('tops')
      .insert([
        { list: list,
          time: timeh,
          day: today,
        }
    ]);
    if (error) {
        console.error('Supabase save error:', error);
        await sendchatwork(`[rp aid=${accountId} to=${roomId}-${messageId}][pname:${accountId}]さん\n統計データの保存中にエラーが発生しました。`, roomId);
    } else {
        await sendchatwork(`[rp aid=${accountId} to=${roomId}-${messageId}][pname:${accountId}]さん\n統計を開始しました！`, roomId);
    }
  } catch(error) {
    console.error('Saving function error:', error.message);
    await sendchatwork(`[rp aid=${accountId} to=${roomId}-${messageId}][pname:${accountId}]さん\n統計データの保存中に予期せぬエラーが発生しました。`, roomId);
  }
}

// 最新の統計データを取得する関数
async function get() {
  try {
    const { data, error } = await supabase
      .from('tops')
      .select('list, time, day')
      .order('id', { ascending: false })
      .limit(1);

    if (error) {
      console.error('Supabase get error:', error);
      return null;
    }
    return data;
  } catch (error) {
    console.error('Supabase get error:', error);
    return null;
  }
}

// メッセージ数の差分を計算する関数
function calculateMessageDiffs(supabaseData, chatworkRoomlist) {
  if (!supabaseData || !supabaseData.length || !chatworkRoomlist) {
    return [];
  }

  const latestSupabaseList = JSON.parse(JSON.stringify(supabaseData[0].list));
  const diffs = [];
  
  chatworkRoomlist.forEach(room => {
    const room_id = room.room_id;
    const chatworkMessageNum = room.message_num;
    const supabaseRoomData = latestSupabaseList.find(item => item.room_id === room_id);

    if (supabaseRoomData) {
      const supabaseMessageNum = supabaseRoomData.message_num;
      const diff = chatworkMessageNum - supabaseMessageNum;

      diffs.push({
        room_id,
        name: room.name,
        diff,
      });
    }
  });

  diffs.sort((a, b) => b.diff - a.diff);
  return diffs;
}

// ファイル数の差分を計算する関数
function calculateFileDiffs(supabaseData, chatworkRoomlist) {
  if (!supabaseData || !supabaseData.length || !chatworkRoomlist) {
    return [];
  }
  const latestSupabaseList = JSON.parse(JSON.stringify(supabaseData[0].list));
  const diffs = [];
  chatworkRoomlist.forEach(room => {
    const room_id = room.room_id;
    const chatworkFileNum = room.file_num;
    const supabaseRoomData = latestSupabaseList.find(item => item.room_id === room_id);
    if (supabaseRoomData) {
      const supabaseFileNum = supabaseRoomData.file_num;
      const diff = chatworkFileNum - supabaseFileNum;

      diffs.push({
        room_id,
        name: room.name,
        diff,
      });
    }
  });
  diffs.sort((a, b) => b.diff - a.diff);
  return diffs;
}

// メッセージランキングを表示する関数（Neo版）
async function topNeo(body, message, messageId, roomId, accountId) {
  const supabaseData = await get();
  let chatworkRoomlist = await getChatworkRoomlist();
  
  // 指定されたルームIDをフィルタリング
  chatworkRoomlist = chatworkRoomlist.filter(room => !EXCLUDED_ROOMS.includes(room.room_id.toString()));

  if (!supabaseData || !chatworkRoomlist) {
    console.warn('SupabaseまたはChatWorkデータの取得に失敗しました。');
    await sendchatwork(`[rp aid=${accountId} to=${roomId}-${messageId}][pname:${accountId}]さん\nランキングデータの取得に失敗しました。`, roomId);
    return;
  }

  const messageDiffs = calculateMessageDiffs(supabaseData, chatworkRoomlist);

  if (!messageDiffs.length || messageDiffs[0].diff === 0) {
    await sendchatwork(`[rp aid=${accountId} to=${roomId}-${messageId}][pname:${accountId}]さん\n前回の統計からのメッセージ増加数が0のため、ランキングを生成できませんでした。`, roomId);
    return;
  }

  const top8Diffs = messageDiffs.slice(0, 8);

  let chatworkMessage = '[info][title]メッセージ数ランキング[/title]';
  top8Diffs.forEach((item, index) => {
    chatworkMessage += `[download:1681682877]${index + 1}位[/download] ${item.name}\n(ID: ${item.room_id}) - ${item.diff}コメ。[hr]`;
  });

  await sendchatwork(`[rp aid=${accountId} to=${roomId}-${messageId}][pname:${accountId}]さん\n${chatworkMessage}[hr]統計開始: ${supabaseData[0].day}、${supabaseData[0].time}時[/info]`, roomId);
}

// ファイルランキングを表示する関数
async function topFile(body, message, messageId, roomId, accountId) {
  const supabaseData = await get();
  let chatworkRoomlist = await getChatworkRoomlist();
  
  // 指定されたルームIDをフィルタリング
  chatworkRoomlist = chatworkRoomlist.filter(room => !EXCLUDED_ROOMS.includes(room.room_id.toString()));

  if (!supabaseData || !chatworkRoomlist) {
    console.warn('SupabaseまたはChatWorkデータの取得に失敗しました。');
    await sendchatwork(`[rp aid=${accountId} to=${roomId}-${messageId}][pname:${accountId}]さん\nランキングデータの取得に失敗しました。`, roomId);
    return;
  }

  const fileDiffs = calculateFileDiffs(supabaseData, chatworkRoomlist);

  if (!fileDiffs.length || fileDiffs[0].diff === 0) {
    await sendchatwork(`[rp aid=${accountId} to=${roomId}-${messageId}][pname:${accountId}]さん\n前回の統計からのファイル増加数が0のため、ランキングを生成できませんでした。`, roomId);
    return;
  }

  const top8Diffs = fileDiffs.slice(0, 8);

  let chatworkMessage = '[info][title]ファイル数ランキング[/title]';
  top8Diffs.forEach((item, index) => {
    chatworkMessage += `[download:1681682877]${index + 1}位[/download] ${item.name}\n(ID: ${item.room_id}) - ${item.diff}個。[hr]`;
  });

  await sendchatwork(`[rp aid=${accountId} to=${roomId}-${messageId}][pname:${accountId}]さん\n${chatworkMessage}[hr]統計開始: ${supabaseData[0].day}、${supabaseData[0].time}時[/info]`, roomId);
}

// データをSupabaseに保存または更新（/rmrコマンド用）
async function updateRanking(roomId, accountId) {
    try {
        const today = getToday();
        const { data, error } = await supabase
            .from('ranking_data')
            .select('*')
            .eq('room_id', roomId)
            .eq('account_id', accountId)
            .eq('date', today);

        if (error) throw error;

        if (data && data.length > 0) {
            // データが存在する場合、カウントをインクリメント
            const currentCount = data[0].count;
            const { error: updateError } = await supabase
                .from('ranking_data')
                .update({ count: currentCount + 1 })
                .eq('room_id', roomId)
                .eq('account_id', accountId)
                .eq('date', today);
            if (updateError) throw updateError;
        } else {
            // データが存在しない場合、新規挿入
            const { error: insertError } = await supabase
                .from('ranking_data')
                .insert([{ room_id: roomId, account_id: accountId, count: 1, date: today }]);
            if (insertError) throw insertError;
        }
    } catch (error) {
        console.error('Supabase update/insert error:', error.message);
    }
}

// ランキングデータをSupabaseから取得（/rmrコマンド用）
async function getRanking(roomId) {
    const today = getToday();
    const { data, error } = await supabase
        .from('ranking_data')
        .select('account_id, count')
        .eq('room_id', roomId)
        .eq('date', today)
        .order('count', { ascending: false });

    if (error) {
        console.error('Supabase get error:', error);
        return null;
    }
    return data;
}

// アカウントIDから名前を取得する（キャッシュ付き）
async function getAccountName(accountId) {
    try {
        // キャッシュから取得
        const { data: cacheData, error: cacheError } = await supabase
            .from('pname_cache')
            .select('account_name')
            .eq('account_id', accountId)
            .single();

        if (cacheData) {
            return cacheData.account_name;
        }

        // キャッシュにない場合、Chatwork APIから取得し、キャッシュに保存
        const response = await axios.get(`${CHATWORK_API_BASE}/contacts`, {
            headers: { 'X-ChatWorkToken': CHATWORK_API_TOKEN },
        });
        const contacts = response.data;
        const contact = contacts.find(c => c.account_id.toString() === accountId);

        if (contact) {
            await supabase.from('pname_cache').insert([{ account_id: accountId, account_name: contact.name }]);
            return contact.name;
        } else {
            return `アカウントID:${accountId}`;
        }
    } catch (error) {
        console.error('Failed to get account name:', error.message);
        return `アカウントID:${accountId}`;
    }
}

// ランキングをフォーマット（/rmrコマンド用）
async function formatRanking(ranking, senderAccountId, targetRoomId, messageId) {
    if (!ranking || ranking.length === 0) {
        return `[rp aid=${senderAccountId} to=${targetRoomId}-${messageId}]\n本日のランキングはまだありません。`;
    }

    let total = 0;
    let result = `[rp aid=${senderAccountId} to=${targetRoomId}-${messageId}][pname:${senderAccountId}]さん\n`;
    result += '[info][title]本日のコメント数ランキング[/title]\n';

    for (let i = 0; i < ranking.length; i++) {
        const item = ranking[i];
        const accountName = await getAccountName(item.account_id);
        result += `${i + 1}位 [pname:${accountName}]さん - ${item.count} コメント\n`;
        total += item.count;
    }

    result += `[hr]合計コメント数: ${total} 件\n`;
    result += '[/info]';

    return result;
}

// Webhookエンドポイント
app.post('/webhook', async (req, res) => {
    try {
        const webhookEvent = req.body.webhook_event;

        if (!webhookEvent) {
            return res.status(400).send('Invalid payload');
        }

        const body = webhookEvent.body;
        const accountId = webhookEvent.account_id;
        const roomId = webhookEvent.room_id;
        const messageId = webhookEvent.message_id;

        if (!body || !accountId || !roomId || !messageId) {
            console.error('Webhook event is missing required parameters (body, accountId, roomId, or messageId).');
            return res.status(400).send('Missing webhook parameters.');
        }

        // --- コマンド処理を先に行う ---
        const trimmedBody = body.trim();
        const bodyParts = trimmedBody.split(/\s+/);

        // /rmr [roomId] コマンドの処理
        const rmrMatch = trimmedBody.match(/^\/rmr\s+(\d+)$/);
        if (rmrMatch) {
            const targetRoomId = rmrMatch[1];
            try {
                const ranking = await getRanking(targetRoomId);
                const reply = await formatRanking(ranking, accountId, roomId, messageId);
                await sendchatwork(reply, roomId);
                return res.status(200).send('Ranking requested');
            } catch (error) {
                console.error('Failed to get ranking:', error);
                await sendchatwork(`[rp aid=${accountId} to=${roomId}-${messageId}][pname:${accountId}]さん\nランキングの取得に失敗しました。ルームID ${targetRoomId} が正しいか確認してください。`, roomId);
                return res.status(500).send('Failed to get ranking');
            }
        }
        
        // 削除コマンド (ゆずbotへの返信かつ「削除」のみの場合)
        if (body.includes(`[rp aid=${YUZUBOT_ACCOUNT_ID}]`) && trimmedBody.endsWith("削除")) {
            const headers = { 'X-ChatWorkToken': CHATWORK_API_TOKEN };

            try {
                const currentMembersResponse = await axios.get(`https://api.chatwork.com/v2/rooms/${roomId}/members`, { headers });
                const currentMembers = currentMembersResponse.data;
                const adminIds = currentMembers.filter(m => m.role === 'admin').map(m => m.account_id);

                if (!adminIds.includes(accountId)) {
                    const replyMessage = `[rp aid=${accountId} to=${roomId}-${messageId}][pname:${accountId}]さん\nこのコマンドは管理者のみ実行できます。`;
                    await sendchatwork(replyMessage, roomId);
                    return res.status(200).send('Unauthorized for delete command.');
                }

                const match = body.match(/to=(\d+)-(\d+)/);
                if (!match) {
                    const replyMessage = `[rp aid=${accountId} to=${roomId}-${messageId}][pname:${accountId}]さん\n削除対象のメッセージIDが見つかりませんでした。`;
                    await sendchatwork(replyMessage, roomId);
                    return res.status(200).send('No message ID found.');
                }

                const deleteRoomId = match[1];
                const deleteMessageId = match[2];

                const url = `https://api.chatwork.com/v2/rooms/${deleteRoomId}/messages/${deleteMessageId}`;
                await axios.delete(url, {
                    headers: {
                        'Accept': 'application/json',
                        'x-chatworktoken': CHATWORK_API_TOKEN,
                    }
                });

                const replyMessage = `[rp aid=${accountId} to=${roomId}-${messageId}][pname:${accountId}]さん\nメッセージID **${deleteMessageId}** を削除しました。`;
                await sendchatwork(replyMessage, roomId);
                return res.status(200).send('Delete command executed.');

            } catch (err) {
                console.error(`メッセージID ${deleteMessageId} の削除中にエラーが発生しました:`, err.response ? err.response.data : err.message);
                const replyMessage = `[rp aid=${accountId} to=${roomId}-${messageId}][pname:${accountId}]さん\nメッセージの削除に失敗しました。`;
                await sendchatwork(replyMessage, roomId);
                return res.status(500).send('Delete failed.');
            }
        }

        // ボット自身の投稿を無視 (削除コマンドの後に移動)
        if (body.startsWith(`[rp aid=${YUZUBOT_ACCOUNT_ID}]`) || body.startsWith('[To:') || body.startsWith('[info]')) {
             return res.status(200).send('Ignoring bot message.');
        }

        // おみくじ コマンド
        if (trimmedBody === 'おみくじ') {
            const today = new Date().toISOString().slice(0, 10);
            const { data, error } = await supabase
                .from('fortune_logs')
                .select('*')
                .eq('account_id', accountId)
                .eq('date', today);
            
            if (error) {
                const errorMessage = `[rp aid=${accountId} to=${roomId}-${messageId}][pname:${accountId}]さん\nおみくじの履歴取得中にエラーが発生しました。`;
                await sendchatwork(errorMessage, roomId);
                return res.status(500).send('Supabase Error');
            }

            if (data && data.length > 0) {
                const replyMessage = `[rp aid=${accountId} to=${roomId}-${messageId}][pname:${accountId}]さん\n本日のおみくじは既に引きました。明日また引けます。`;
                await sendchatwork(replyMessage, roomId);
                return res.status(200).send('Already pulled today.');
            }
            
            const result = fortunes[Math.floor(Math.random() * fortunes.length)];
            
            const { error: insertError } = await supabase
                .from('fortune_logs')
                .insert([{ account_id: accountId, date: today, fortune: result }]);

            if (insertError) {
                const errorMessage = `[rp aid=${accountId} to=${roomId}-${messageId}][pname:${accountId}]さん\nおみくじの履歴保存中にエラーが発生しました。`;
                await sendchatwork(errorMessage, roomId);
                return res.status(500).send('Supabase Insert Error');
            }
            
            const replyMessage = `[rp aid=${accountId} to=${roomId}-${messageId}][pname:${accountId}]さん\n本日のおみくじの結果は「**${result}**」です。🎉`;
            await sendchatwork(replyMessage, roomId);
            return res.status(200).send('Fortune OK');
        }

        // /ai コマンド
        if (trimmedBody.startsWith('/ai')) {
            const query = trimmedBody.substring(4).trim();
            if (query.length === 0) {
                const replyMessage = `[rp aid=${accountId} to=${roomId}-${messageId}][pname:${accountId}]さん\n聞きたいことを入力してください。`;
                await sendchatwork(replyMessage, roomId);
                return res.status(200).send('No query provided.');
            }
            
            await generateGemini(body, query, messageId, roomId, accountId);
            return res.status(200).send('AI command executed.');
        }
        
        // /roominfo コマンド
        if (trimmedBody.startsWith('/roominfo')) {
            const targetRoomId = bodyParts[1];
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
                await sendchatwork(`[rp aid=${accountId} to=${roomId}-${messageId}][pname:${accountId}]さん\nごめん。そのルームの情報はないみたい(´・ω・｀)`, roomId);
                return res.status(500).send('Room info fetch error.');
            }
        }

        // /top, /topneo, /topfile, /stat, /saving コマンド
        if (trimmedBody === '/top' || trimmedBody === '/topneo') {
            await topNeo(body, null, messageId, roomId, accountId);
            return res.status(200).send('Top command executed.');
        }

        if (trimmedBody === '/topfile') {
            await topFile(body, null, messageId, roomId, accountId);
            return res.status(200).send('Top file command executed.');
        }
        
        if (trimmedBody === '/stat' || trimmedBody === '/saving') {
            await saving(body, null, messageId, roomId, accountId);
            return res.status(200).send('Saving command executed.');
        }

        // コマンドではない通常のメッセージの場合、/rmr用のカウントを更新
        await updateRanking(roomId, accountId);

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
