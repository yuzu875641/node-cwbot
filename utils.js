const axios = require('axios');
const { URLSearchParams } = require('url');
const { createClient } = require('@supabase/supabase-js');
const { DateTime } = require('luxon');

const CHATWORK_API_TOKEN = process.env.CHATWORK_API_TOKEN;
const CHATWORK_API_BASE = 'https://api.chatwork.com/v2';
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const EXCLUDED_ROOMS = ['407802259', '407766814', '394676959', '407755388'];

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Chatworkへメッセージを送信する関数
async function sendchatwork(ms, CHATWORK_ROOM_ID) {
    try {
        await axios.post(
            `${CHATWORK_API_BASE}/rooms/${CHATWORK_ROOM_ID}/messages`,
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
        message = "あなたはトークルーム「ゆずの部屋」のボットのゆずbotです。以下のメッセージに対して200字以下、markdown形式の使用しないで返答して下さい:" + message;
        const response = await axios.post(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
            {
                contents: [{ parts: [{ text: message }] }],
            },
            { headers: { "Content-Type": "application/json" } }
        );
        const responseContent = response.data.candidates[0].content;
        let responseParts = responseContent.parts.map((part) => part.text).join("\n");
        responseParts = responseParts.replace(/\*/g, "");
        await sendchatwork(`[rp aid=${accountId} to=${roomId}-${messageId}][pname:${accountId}]さん\nゆずbotです。\n${responseParts}`, roomId);
    } catch (error) {
        console.error('エラーが発生しました:', error.response ? error.response.data : error.message);
        await sendchatwork(`[rp aid=${accountId} to=${roomId}-${messageId}][pname:${accountId}]さん\nエラーが発生しました。`, roomId);
    }
}

// チャットワークのルーム情報を取得する関数
async function getChatworkRoomInfo(roomId) {
    const url = `${CHATWORK_API_BASE}/rooms/${roomId}`;
    const headers = { 'X-ChatWorkToken': CHATWORK_API_TOKEN };
    const response = await axios.get(url, { headers });
    return response.data;
}

// チャットワークのルームメンバー数を取得する関数
async function getChatworkRoomMemberCount(roomId) {
    const url = `${CHATWORK_API_BASE}/rooms/${roomId}/members`;
    const headers = { 'X-ChatWorkToken': CHATWORK_API_TOKEN };
    const response = await axios.get(url, { headers });
    return response.data.length;
}

// チャットワークのルームリストを取得する関数
async function getChatworkRoomlist() {
    const url = `${CHATWORK_API_BASE}/rooms`;
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
    const { error } = await supabase
      .from('tops')
      .insert([
        { list: list, time: timeh, day: today }
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
  if (!supabaseData || !supabaseData.length || !chatworkRoomlist) return [];
  const latestSupabaseList = JSON.parse(JSON.stringify(supabaseData[0].list));
  const diffs = [];
  chatworkRoomlist.forEach(room => {
    const room_id = room.room_id;
    const chatworkMessageNum = room.message_num;
    const supabaseRoomData = latestSupabaseList.find(item => item.room_id === room_id);
    if (supabaseRoomData) {
      const diff = chatworkMessageNum - supabaseRoomData.message_num;
      diffs.push({ room_id, name: room.name, diff });
    }
  });
  diffs.sort((a, b) => b.diff - a.diff);
  return diffs;
}

// ファイル数の差分を計算する関数
function calculateFileDiffs(supabaseData, chatworkRoomlist) {
  if (!supabaseData || !supabaseData.length || !chatworkRoomlist) return [];
  const latestSupabaseList = JSON.parse(JSON.stringify(supabaseData[0].list));
  const diffs = [];
  chatworkRoomlist.forEach(room => {
    const room_id = room.room_id;
    const chatworkFileNum = room.file_num;
    const supabaseRoomData = latestSupabaseList.find(item => item.room_id === room_id);
    if (supabaseRoomData) {
      const diff = chatworkFileNum - supabaseRoomData.file_num;
      diffs.push({ room_id, name: room.name, diff });
    }
  });
  diffs.sort((a, b) => b.diff - a.diff);
  return diffs;
}

// メッセージランキングを表示する関数（Neo版）
async function topNeo(body, message, messageId, roomId, accountId) {
  const supabaseData = await get();
  let chatworkRoomlist = await getChatworkRoomlist();
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
        const today = DateTime.now().setZone('Asia/Tokyo').toFormat('yyyy-MM-dd');
        const { data, error } = await supabase
            .from('ranking_data')
            .select('*')
            .eq('room_id', roomId)
            .eq('account_id', accountId)
            .eq('date', today);
        if (error) throw error;
        if (data && data.length > 0) {
            const currentCount = data[0].count;
            const { error: updateError } = await supabase
                .from('ranking_data')
                .update({ count: currentCount + 1 })
                .eq('room_id', roomId)
                .eq('account_id', accountId)
                .eq('date', today);
            if (updateError) throw updateError;
        } else {
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
    const today = DateTime.now().setZone('Asia/Tokyo').toFormat('yyyy-MM-dd');
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

// ルームメンバー数を取得
async function getChatworkRoomMemberCount(roomId) {
    const url = `${CHATWORK_API_BASE}/rooms/${roomId}/members`;
    const headers = { 'X-ChatWorkToken': CHATWORK_API_TOKEN };
    const response = await axios.get(url, { headers });
    return response.data.length;
}

// メンバーの権限を「閲覧」に変更する関数
async function changeMemberRoleToReadonly(roomId, accountId) {
    try {
        const url = `${CHATWORK_API_BASE}/rooms/${roomId}/members`;
        const headers = { 'X-ChatWorkToken': CHATWORK_API_TOKEN };

        const membersResponse = await axios.get(url, { headers });
        const members = membersResponse.data;

        // パラメータ名を修正
        const newAdminMembers = members.filter(m => m.role === 'admin').map(m => m.account_id);
        const newMemberMembers = members.filter(m => m.role === 'member' && m.account_id !== accountId).map(m => m.account_id);
        const newReadonlyMembers = members.filter(m => m.role === 'readonly' || m.account_id === accountId).map(m => m.account_id);

        const params = new URLSearchParams({
            'members_admin_ids': newAdminMembers.join(','),
            'members_member_ids': newMemberMembers.join(','),
            'members_readonly_ids': newReadonlyMembers.join(',')
        });

        await axios.put(url, params, { headers });
        
        console.log(`User ${accountId} role changed to 'readonly' in room ${roomId}.`);
        
    } catch (error) {
        console.error('Failed to change member role:', error.response?.data || error.message);
    }
}

module.exports = {
    sendchatwork,
    generateGemini,
    getChatworkRoomInfo,
    getChatworkRoomMemberCount,
    getChatworkRoomlist,
    saving,
    get,
    calculateMessageDiffs,
    calculateFileDiffs,
    topNeo,
    topFile,
    updateRanking,
    getRanking,
    changeMemberRoleToReadonly
};
