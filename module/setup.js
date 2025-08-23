const messageedit = require('../suisho/message');
const getCWdata = require('../suisho/cwdata');

async function wakamehelp(body, message, messageId, roomId, accountId) {
    try {
        const ms = `[rp aid=${accountId} to=${roomId}-${messageId}][pname:${accountId}]さん\n[info][title]ヘルプ[/title]/help/\n/omikuji/\n/randamuser/\n/memberinfos/ID\n/roominfos/ID\n/roomicon/ID[/info]`
        await messageedit.sendchatwork(ms, roomId);
        return;
    } catch (error) {
        console.log(error);
        return;
    }
}

async function test(body, message, messageId, roomId, accountId) {
    try {
        const ms = `[rp aid=${accountId} to=${roomId}-${messageId}][pname:${accountId}]さん\nテスト成功です`
        await messageedit.sendchatwork(ms, roomId);
        return;
    } catch (error) {
        console.log(error);
        return;
    }
}

async function wakamehelp(body, message, messageId, roomId, accountId) {
    try {
        const ms = `[rp aid=${accountId} to=${roomId}-${messageId}][pname:${accountId}]さん\n[info][title]ヘルプ[/title]使い方\n[hr]メンションと/コマンド名/で実行できます\n[To:10617115]ゆずbotさん/おみくじ/ みたいな感じ\n[hr]ヘルプ\n/help/\n\nAI\n/ai/AIに聞きたいこと\n/deepseek/AIに聞きたいこと\n/deepseekja/AIに聞きたいこと\n/カス文章/AIに聞きたいこと\n\n運ゲー\n/おみくじ/\n/アカウントくじ/\n/ランダムユーザー/\n\nChatWorkの情報\n/memberinfos/ユーザーID\n/membericon/ユーザーID\n/roominfo/ルームID\n/roominfos/ルームID(リンクあり)\n/roomicon/ルームID\n/findUser/ユーザーID\n\nその他\n/youtube/検索したいワード\n/同人/URLかID\n/tops/\n/topfile/\n/topssave/\n/削除/[qt][to=1111-2222][/qt]\n/restart/ ボット再起動`
        await messageedit.sendchatwork(ms, roomId);
        return;
    } catch (error) {
        console.log(error);
        return;
    }
}


module.exports = {
    wakamehelp,
    test
};
