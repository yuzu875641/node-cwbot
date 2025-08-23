// webhook/mention.js
const chatwork = require('../module/CWinfo');
const suisho = require('../suisho/file');

// メンションメッセージを処理する関数
exports.handleMention = async (data) => {
    const roomId = data.room_id;
    const message = data.body;
    
    console.log(`Received mention in room ${roomId}: ${message}`);
    
    // ここでメッセージの内容に応じて処理を分岐
    if (message.includes('ファイル')) {
        const fileInfo = await suisho.getSupabaseFileInfo();
        // ファイル情報をチャットワークに送信
        chatwork.sendMessage(roomId, fileInfo);
    } else {
        // デフォルトの応答
        chatwork.sendMessage(roomId, "はい、何かお手伝いできることはありますか？");
    }
};
