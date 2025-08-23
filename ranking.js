const messageedit = require('./suisho/message');
const getCWdata = require('./suisho/cwdata');
const { createClient } = require('@supabase/supabase-js');
const { DateTime } = require('luxon');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY; 

const supabase = createClient(supabaseUrl, supabaseKey);

// 共通のデータ取得関数
async function getSupabaseAndChatworkData() {
  try {
    const [supabaseData, chatworkRoomlist] = await Promise.all([
      supabase
        .from('tops')
        .select('list, time, day')
        .order('id', { ascending: false })
        .limit(1),
      getCWdata.getChatworkRoomlist()
    ]);
    
    if (supabaseData.error || !supabaseData.data || !supabaseData.data.length || !chatworkRoomlist) {
      console.warn('SupabaseまたはChatWorkデータの取得に失敗しました。');
      return { supabaseData: null, chatworkRoomlist: null };
    }
    
    return { supabaseData: supabaseData.data, chatworkRoomlist };
  } catch (error) {
    console.error('データの取得中にエラーが発生しました:', error);
    return { supabaseData: null, chatworkRoomlist: null };
  }
}

// 共通の差分計算関数
function calculateDiffs(supabaseData, chatworkRoomlist, type) {
  if (!supabaseData || !chatworkRoomlist) {
    return [];
  }
  const latestSupabaseList = JSON.parse(JSON.stringify(supabaseData[0].list));
  const diffs = [];
  const key = type === 'message' ? 'message_num' : 'file_num';
  const unit = type === 'message' ? 'コメ' : '個';

  chatworkRoomlist.forEach(room => {
    const supabaseRoomData = latestSupabaseList.find(item => item.room_id === room.room_id);
    if (supabaseRoomData) {
      const diff = room[key] - supabaseRoomData[key];
      diffs.push({
        room_id: room.room_id,
        name: room.name,
        diff,
        unit,
      });
    }
  });

  diffs.sort((a, b) => b.diff - a.diff);
  return diffs;
}

// ランキングメッセージを生成し投稿する共通関数
async function postRankingMessage(type, limit, messageId, roomId, accountId) {
  const { supabaseData, chatworkRoomlist } = await getSupabaseAndChatworkData();
  
  if (!supabaseData || !chatworkRoomlist) {
    return;
  }

  const diffs = calculateDiffs(supabaseData, chatworkRoomlist, type);

  if (!diffs.length) {
    console.log('ランキングのデータが見つかりません。');
    await messageedit.sendchatwork(`[rp aid=${accountId} to=${roomId}-${messageId}][pname:${accountId}]さん\nランキングのデータが見つかりませんでした。`, roomId);
    return;
  }

  const topDiffs = diffs.slice(0, limit);
  const title = type === 'message' ? 'メッセージ数ランキング' : 'ファイル数ランキング';
  const unit = type === 'message' ? 'コメ' : '個';

  let chatworkMessage = `[info][title]${title}[/title]`;
  topDiffs.forEach((item, index) => {
    chatworkMessage += `[download:1681682877]${index + 1}位[/download] ${item.name}\n(ID: ${item.room_id}) - ${item.diff}${unit}[hr]`;
  });
  
  await messageedit.sendchatwork(`[rp aid=${accountId} to=${roomId}-${messageId}][pname:${accountId}]さん\n${chatworkMessage}統計開始: ${supabaseData[0].day}、${supabaseData[0].time}時[/info]`, roomId);
}

// 既存の関数をそのまま残す（または必要に応じて統合）
async function save() {
  try{
    const japanTime = DateTime.now().setZone('Asia/Tokyo');
    const today = japanTime.toFormat('yyyy-MM-dd');
    const timeh = japanTime.toFormat('H');
    const list = await getCWdata.getChatworkRoomlist();
    const { data, error } = await supabase
      .from('tops')
      .insert([
        { list: list,
          time: timeh,
          day: today,
        }
    ]);
    return;
  } catch(error){
    console.log(error);
    return;
  }
}

async function saving(body, message, messageId, roomId, accountId) {
  try{
    const japanTime = DateTime.now().setZone('Asia/Tokyo');
    const today = japanTime.toFormat('yyyy-MM-dd');
    const timeh = japanTime.toFormat('H');
    const list = await getCWdata.getChatworkRoomlist();
    const { data, error } = await supabase
      .from('tops')
      .insert([
        { list: list,
          time: timeh,
          day: today,
        }
    ]);
    await messageedit.sendchatwork(`[rp aid=${accountId} to=${roomId}-${messageId}][pname:${accountId}]さん\n統計を開始しました！`, roomId)
  } catch(error){
    console.log(error);
    return;
  }
}

async function get() {
  try {
    const { data, error } = await supabase
      .from('tops')
      .select('list, time, day')
      .order('id', { ascending: false })
      .limit(1);

    if (error) {
      console.error('Supabaseエラー:', error);
      return null;
    }
    return data;
  } catch (error) {
    console.error('Supabaseエラー:', error);
    return null;
  }
}

async function gget(num) {
  const { data, error } = await supabase
    .from('tops')
    .select('list, time, day')
    .order('id', { ascending: false })
    .offset(num)
    .limit(1);
  return data;
}

// 外部モジュールとしてエクスポート
module.exports = {
    save,
    get,
    gget,
    topNeo: async (body, message, messageId, roomId, accountId) => await postRankingMessage('message', 8, messageId, roomId, accountId),
    topNeoHack: async (body, message, messageId, roomId, accountId) => await postRankingMessage('message', 30, messageId, roomId, accountId),
    topFile: async (body, message, messageId, roomId, accountId) => await postRankingMessage('file', 8, messageId, roomId, accountId),
};
