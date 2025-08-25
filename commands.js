const {
    getChatworkRoomInfo,
    getChatworkRoomlist,
    saving,
    topNeo,
    topFile,
    sendchatwork,
    updateRanking,
    getRanking,
    getChatworkRoomMemberCount,
    checkOmikujiUsed,
    saveOmikujiHistory,
    get, // 追加
} = require('./utils');
const YUZUBOT_ACCOUNT_ID = process.env.YUZUBOT_ACCOUNT_ID;

// ルームのランキングを整形する関数
async function formatRanking(ranking, accountId, roomId, messageId, roomName) {
    if (!ranking || ranking.length === 0) {
        return `[rp aid=${accountId} to=${roomId}-${messageId}][pname:${accountId}]さん\nごめんね。まだランキングデータがないみたい(´・ω・｀)コメントしてランキングに参加しよう！`;
    }

    let reply = `[info][title]${roomName}の本日のコメント数ランキング[/title]\n`;
    let total = 0;

    for (const [index, item] of ranking.entries()) {
        try {
            const memberInfo = await getChatworkRoomInfo(item.account_id);
            if (memberInfo) {
                reply += `${index + 1}位 [piconname:${item.account_id}] - ${item.count} コメント\n`;
            } else {
                reply += `${index + 1}位 [piconname:${item.account_id}] - ${item.count} コメント\n`;
            }
        } catch (error) {
            console.error(`Failed to get member info for account ${item.account_id}:`, error);
            reply += `${index + 1}位 アカウントID: ${item.account_id} - ${item.count} コメント\n`;
        }
        total += item.count;
    }

    reply += `[hr]合計コメント数: ${total} 件\n`;
    reply += `[/info]`;

    return reply;
}

// /rmrコマンドの処理
async function handleRankingReportCommand(targetRoomId, accountId, roomId, messageId) {
    try {
        const ranking = await getRanking(targetRoomId);
        const roomInfo = await getChatworkRoomInfo(targetRoomId);
        const roomName = roomInfo ? roomInfo.name : `ルームID: ${targetRoomId}`;

        const reply = await formatRanking(ranking, accountId, roomId, messageId, roomName);
        await sendchatwork(reply, roomId);

    } catch (error) {
        console.error('Error in ranking report command:', error.response ? error.response.data : error.message);
        await sendchatwork(`[rp aid=${accountId} to=${roomId}-${messageId}][pname:${accountId}]さん\nごめん。ランキングレポートの作成に失敗したみたい(´・ω・｀)`, roomId);
    }
}

// /rmrコマンドの処理
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

        const replyMessage = `[rp aid=${accountId} to=${roomId}-${messageId}]さん\nメッセージID **${deleteMessageId}** を削除しました。`;
        await sendchatwork(replyMessage, roomId);
    } catch (err) {
        console.error(`メッセージID ${deleteMessageId} の削除中にエラーが発生しました:`, err.response ? err.response.data : err.message);
        const replyMessage = `[rp aid=${accountId} to=${roomId}-${messageId}]さん\nメッセージの削除に失敗しました。`;
        await sendchatwork(replyMessage, roomId);
    }
}

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
            let responseMessage = `[rp aid=${accountId} to=${roomId}-${messageId}][pname:${accountId}]さん\n部屋指定して(⁠´⁠；⁠ω⁠；⁠｀⁠)`;
            await sendchatwork(responseMessage, roomId);
        }
    } catch (error) {
        console.error('Failed to get room info:', error.response ? error.response.data : error.message);
        await sendchatwork(`[rp aid=${accountId} to=${roomId}-${messageId}][pname:${accountId}]さん\nごめん。ルーム情報の取得に失敗したみたい(´・ω・｀)`, roomId);
    }
}

// おみくじコマンドの処理
async function handleOmikujiCommand(accountId, roomId, messageId) {
    const alreadyUsed = await checkOmikujiUsed(roomId, accountId);
    if (alreadyUsed) {
        const replyMessage = `[rp aid=${accountId} to=${roomId}-${messageId}][pname:${accountId}]さん\n本日引けるおみくじはもう終了だよ(´・ω・｀)`;
        await sendchatwork(replyMessage, roomId);
        return;
    }

    const result = getOmikujiResult();
    const replyMessage = `[rp aid=${accountId} to=${roomId}-${messageId}][pname:${accountId}]さん\n${result}`;
    await sendchatwork(replyMessage, roomId);

    await saveOmikujiHistory(roomId, accountId);
}

// 確率に基づいておみくじの結果を決定する関数
function getOmikujiResult() {
    const rand = Math.random();
    if (rand < 0.001) {
        return 'ゆず！';
    } else if (rand < 0.001 + 0.109) {
        return '凶';
    } else if (rand < 0.001 + 0.109 + 0.19) {
        return '末吉';
    } else if (rand < 0.001 + 0.109 + 0.19 + 0.24) {
        return '吉';
    } else if (rand < 0.001 + 0.109 + 0.19 + 0.24 + 0.13) {
        return '小吉';
    } else if (rand < 0.001 + 0.109 + 0.19 + 0.24 + 0.13 + 0.10) {
        return '中吉';
    } else {
        return '大吉';
    }
}

// /statコマンドの処理
async function handleStatCommand(accountId, roomId, messageId) {
    try {
        const supabaseData = await get();
        if (!supabaseData || supabaseData.length === 0) {
            await sendchatwork(`[rp aid=${accountId} to=${roomId}-${messageId}][pname:${accountId}]さん\nごめんね。まだ統計データがないみたい(´・ω・｀)`, roomId);
            return;
        }

        const data = supabaseData[0];
        const lastUpdated = `${data.day} ${data.time}時`;
        const roomCount = data.list.length;

        const replyMessage = `[rp aid=${accountId} to=${roomId}-${messageId}][pname:${accountId}]さん\n現在の統計情報です。\n最終更新日時: ${lastUpdated}\n対象ルーム数: ${roomCount}部屋`;
        await sendchatwork(replyMessage, roomId);
    } catch (error) {
        console.error('Error in stat command:', error.response ? error.response.data : error.message);
        await sendchatwork(`[rp aid=${accountId} to=${roomId}-${messageId}][pname:${accountId}]さん\nごめん。統計情報の取得に失敗したみたい(´・ω・｀)`, roomId);
    }
}

// コマンドを処理するメイン関数
async function handleCommand(body, accountId, roomId, messageId) {
    const trimmedBody = body.trim();
    if (trimmedBody.startsWith('/start')) {
        await saving(body, trimmedBody, messageId, roomId, accountId);
        return true;
    }

    if (trimmedBody.startsWith('/topneo')) {
        await topNeo(body, trimmedBody, messageId, roomId, accountId);
        return true;
    }

    if (trimmedBody.startsWith('/topfile')) {
        await topFile(body, trimmedBody, messageId, roomId, accountId);
        return true;
    }

    if (trimmedBody.startsWith('/rmr')) {
        const parts = trimmedBody.split(' ');
        const targetRoomId = parts[1];
        await handleRankingReportCommand(targetRoomId || roomId, accountId, roomId, messageId);
        return true;
    }
    
    // /statコマンドの追加
    if (trimmedBody === '/stat') {
        await handleStatCommand(accountId, roomId, messageId);
        return true;
    }

    // 削除コマンド
    if (body.includes(`[rp aid=${YUZUBOT_ACCOUNT_ID} to=${roomId}-${messageId}]`) && trimmedBody.endsWith("削除")) {
        await handleDeleteCommand(body, accountId, roomId, messageId);
        return true;
    }

    if (trimmedBody.startsWith('/roominfo')) {
        const parts = trimmedBody.split(' ');
        const targetRoomId = parts[1];
        await handleRoomInfoCommand(targetRoomId, accountId, roomId, messageId);
        return true;
    }
    
    return false;
}

module.exports = {
    handleCommand,
    formatRanking,
    handleOmikujiCommand,
};
