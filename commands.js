const {
    getChatworkRoomInfo,
    getChatworkRoomlist,
    getChatworkRoomMemberCount,
    getRanking,
    sendchatwork,
    generateGemini,
    saving,
    topNeo,
    topFile,
    updateRanking
} = require('./utils');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const YUZUBOT_ACCOUNT_ID = process.env.YUZUBOT_ACCOUNT_ID;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const fortunes = ['大吉', '吉', '中吉', '小吉', '末吉', '凶', '大凶'];

// メインのコマンドハンドラ
async function handleCommand(body, accountId, roomId, messageId) {
    const trimmedBody = body.trim();
    const bodyParts = trimmedBody.split(/\s+/);
    
    // /rmr [roomId] コマンド
    const rmrMatch = trimmedBody.match(/^\/rmr\s+(\d+)$/);
    if (rmrMatch) {
        const targetRoomId = rmrMatch[1];
        await handleRmrCommand(targetRoomId, accountId, roomId, messageId);
        return true;
    }

    // 削除コマンド
    if (body.includes(`[rp aid=${YUZUBOT_ACCOUNT_ID}]`) && trimmedBody.endsWith("削除")) {
        await handleDeleteCommand(body, accountId, roomId, messageId);
        return true;
    }

    // ボット自身の投稿を無視
    if (body.startsWith(`[rp aid=${YUZUBOT_ACCOUNT_ID}]`) || body.startsWith('[To:') || body.startsWith('[info]')) {
         return true;
    }

    // おみくじ コマンド
    if (trimmedBody === 'おみくじ') {
        await handleFortuneCommand(accountId, roomId, messageId);
        return true;
    }

    // /ai コマンド
    if (trimmedBody.startsWith('/ai')) {
        const query = trimmedBody.substring(4).trim();
        await generateGemini(body, query, messageId, roomId, accountId);
        return true;
    }
    
    // /roominfo コマンド
    if (trimmedBody.startsWith('/roominfo')) {
        const targetRoomId = bodyParts[1];
        await handleRoomInfoCommand(targetRoomId, accountId, roomId, messageId);
        return true;
    }

    // その他のコマンド
    const commandMap = {
        '/top': topNeo,
        '/topneo': topNeo,
        '/topfile': topFile,
        '/stat': saving,
        '/saving': saving,
    };

    if (commandMap[trimmedBody]) {
        await commandMap[trimmedBody](body, null, messageId, roomId, accountId);
        return true;
    }

    // コマンドに該当しない場合はfalseを返す
    return false;
}

// /rmr コマンドの処理
async function handleRmrCommand(targetRoomId, accountId, roomId, messageId) {
    try {
        const ranking = await getRanking(targetRoomId);
        const roomInfo = await getChatworkRoomInfo(targetRoomId);
        const reply = await formatRanking(ranking, accountId, roomId, messageId, roomInfo.name);
        await sendchatwork(reply, roomId);
    } catch (error) {
        console.error('Failed to get ranking:', error);
        await sendchatwork(`[rp aid=${accountId} to=${roomId}-${messageId}][pname:${accountId}]さん\nランキングの取得に失敗しました。ルームID ${targetRoomId} が正しいか確認してください。`, roomId);
    }
}

// 削除コマンドの処理
async function handleDeleteCommand(body, accountId, roomId, messageId) {
    const CHATWORK_API_TOKEN = process.env.CHATWORK_API_TOKEN;
    const axios = require('axios');
    try {
        const headers = { 'X-ChatWorkToken': CHATWORK_API_TOKEN };
        const currentMembersResponse = await axios.get(`https://api.chatwork.com/v2/rooms/${roomId}/members`, { headers });
        const currentMembers = currentMembersResponse.data;
        const adminIds = currentMembers.filter(m => m.role === 'admin').map(m => m.account_id);

        if (!adminIds.includes(accountId)) {
            const replyMessage = `[rp aid=${accountId} to=${roomId}-${messageId}][pname:${accountId}]さん\nこのコマンドは管理者のみ実行できます。`;
            await sendchatwork(replyMessage, roomId);
            return;
        }

        const match = body.match(/to=(\d+)-(\d+)/);
        if (!match) {
            const replyMessage = `[rp aid=${accountId} to=${roomId}-${messageId}][pname:${accountId}]さん\n削除対象のメッセージIDが見つかりませんでした。`;
            await sendchatwork(replyMessage, roomId);
            return;
        }

        const deleteRoomId = match[1];
        const deleteMessageId = match[2];

        const url = `https://api.chatwork.com/v2/rooms/${deleteRoomId}/messages/${deleteMessageId}`;
        await axios.delete(url, { headers: { 'Accept': 'application/json', 'x-chatworktoken': CHATWORK_API_TOKEN } });

        const replyMessage = `[rp aid=${accountId} to=${roomId}-${messageId}][pname:${accountId}]さん\nメッセージID **${deleteMessageId}** を削除しました。`;
        await sendchatwork(replyMessage, roomId);
    } catch (err) {
        console.error(`メッセージID ${deleteMessageId} の削除中にエラーが発生しました:`, err.response ? err.response.data : err.message);
        const replyMessage = `[rp aid=${accountId} to=${roomId}-${messageId}][pname:${accountId}]さん\nメッセージの削除に失敗しました。`;
        await sendchatwork(replyMessage, roomId);
    }
}

// おみくじコマンドの処理
async function handleFortuneCommand(accountId, roomId, messageId) {
    const today = new Date().toISOString().slice(0, 10);
    const { data, error } = await supabase
        .from('fortune_logs')
        .select('*')
        .eq('account_id', accountId)
        .eq('date', today);
    
    if (error) {
        const errorMessage = `[rp aid=${accountId} to=${roomId}-${messageId}][pname:${accountId}]さん\nおみくじの履歴取得中にエラーが発生しました。`;
        await sendchatwork(errorMessage, roomId);
        return;
    }

    if (data && data.length > 0) {
        const replyMessage = `[rp aid=${accountId} to=${roomId}-${messageId}][pname:${accountId}]さん\n本日のおみくじは既に引きました。明日また引けます。`;
        await sendchatwork(replyMessage, roomId);
        return;
    }
    
    const result = fortunes[Math.floor(Math.random() * fortunes.length)];
    
    const { error: insertError } = await supabase
        .from('fortune_logs')
        .insert([{ account_id: accountId, date: today, fortune: result }]);

    if (insertError) {
        const errorMessage = `[rp aid=${accountId} to=${roomId}-${messageId}][pname:${accountId}]さん\nおみくじの履歴保存中にエラーが発生しました。`;
        await sendchatwork(errorMessage, roomId);
        return;
    }
    
    const replyMessage = `[rp aid=${accountId} to=${roomId}-${messageId}][pname:${accountId}]さん\n本日のおみくじの結果は「**${result}**」です。🎉`;
    await sendchatwork(replyMessage, roomId);
}

//一部が欠けていたらnullで返すように
// /roominfo コマンドの処理
async function handleRoomInfoCommand(targetRoomId, accountId, roomId, messageId) {
    try {
        if (targetRoomId) {
            // ルームIDが指定された場合
            const roomInfo = await getChatworkRoomInfo(targetRoomId);
            const roomMemberCount = await getChatworkRoomMemberCount(targetRoomId);
            
            // 取得できなかった項目を「Error」に置き換える
            const roomName = roomInfo ? roomInfo.name : 'Error';
            const memberCount = roomMemberCount !== null ? roomMemberCount : 'Error';
            const messageNum = roomInfo ? roomInfo.message_num : 'Error';
            const fileNum = roomInfo ? roomInfo.file_num : 'Error';
            const taskNum = roomInfo ? roomInfo.task_num : 'Error';
            const iconPath = roomInfo ? roomInfo.icon_path.replace(/rsz\./g, '') : 'Error';

            const room = `[info][title]${roomName}[/title]メンバー数: ${memberCount}\nメッセージ数: ${messageNum}\nファイル数: ${fileNum}\nタスク数: ${taskNum}\nアイコンURL: ${iconPath}[/info]`;
            await sendchatwork(`[rp aid=${accountId} to=${roomId}-${messageId}][pname:${accountId}]さん\n${room}`, roomId);
        } else {
            // ルームIDが指定されない場合（すべての部屋）
            const roomList = await getChatworkRoomlist();
            let responseMessage = `[rp aid=${accountId} to=${roomId}-${messageId}][pname:${accountId}]さん\n`;
            responseMessage += `[info][title]参加中の全ルーム情報[/title]\n`;
            roomList.forEach((room, index) => {
                responseMessage += `${index + 1}. **${room.name}**\n`;
                responseMessage += `   ID: ${room.room_id}\n`;
                responseMessage += `   メッセージ数: ${room.message_num}\n`;
                responseMessage += `   ファイル数: ${room.file_num}\n`;
                responseMessage += `   タスク数: ${room.task_num}\n\n`;
            });
            responseMessage += '[/info]';
            await sendchatwork(responseMessage, roomId);
        }
    } catch (error) {
        console.error('Failed to get room info:', error.response ? error.response.data : error.message);
        await sendchatwork(`[rp aid=${accountId} to=${roomId}-${messageId}][pname:${accountId}]さん\nごめん。ルーム情報の取得に失敗したみたい(´・ω・｀)`, roomId);
    }
}


// ランキングをフォーマット（/rmrコマンド用）
async function formatRanking(ranking, senderAccountId, targetRoomId, messageId, roomName) {
    if (!ranking || ranking.length === 0) {
        return `[rp aid=${senderAccountId} to=${targetRoomId}-${messageId}]\n本日のランキングはまだありません。`;
    }

    let total = 0;
    let result = `[rp aid=${senderAccountId} to=${targetRoomId}-${messageId}][pname:${senderAccountId}]さん\n`;
    result += `[info][title]${roomName}の本日のコメント数ランキング[/title]\n`;

    ranking.forEach((item, i) => {
        result += `${i + 1}位 [piconname:${item.account_id}] - ${item.count} コメント\n`;
        total += item.count;
    });

    result += `[hr]合計コメント数: ${total} 件\n`;
    result += '[/info]';

    return result;
}


module.exports = {
    handleCommand
};
