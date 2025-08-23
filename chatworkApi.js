const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

const CHATWORK_API_TOKEN = process.env.CHATWORK_API_TOKEN;

// Chatworkにメッセージを送信する
async function sendchatwork(message, roomId) {
    try {
        const url = `https://api.chatwork.com/v2/rooms/${roomId}/messages`;
        await axios.post(url, new URLSearchParams({ body: message }), {
            headers: {
                'X-ChatWorkToken': CHATWORK_API_TOKEN,
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });
    } catch (error) {
        console.error('Chatworkメッセージ送信エラー:', error.response?.data || error.message);
    }
}

// URLから画像を取得し、Chatworkにファイルとして送信する
async function sendFile(roomId, url, message = '') {
    try {
        const response = await axios({
            method: 'get',
            url: url,
            responseType: 'arraybuffer',
            maxContentLength: 5 * 1024 * 1024,
        });

        const formData = new FormData();
        formData.append('file', response.data, {
            filename: 'image.jpeg',
            contentType: 'image/jpeg'
        });
        formData.append('message', message);

        const uploadUrl = `https://api.chatwork.com/v2/rooms/${roomId}/files`;
        const headers = {
            ...formData.getHeaders(),
            'x-chatworktoken': CHATWORK_API_TOKEN,
        };

        await axios.post(uploadUrl, formData, { headers });
    } catch (error) {
        console.error('ファイル送信エラー:', error.response?.data || error.message);
        if (error.response?.status === 413) {
            console.error('エラー: データサイズが5MBを超えています。');
        }
    }
}

// メッセージを削除する
async function deleteMessages(messageBody, roomId) {
    const match = messageBody.match(/\[rp to=(\d+)-(\d+)\]/);
    if (!match) {
        console.error('削除対象のメッセージIDが見つかりません。');
        return;
    }
    const targetMessageId = match[2];

    try {
        const url = `https://api.chatwork.com/v2/rooms/${roomId}/messages/${targetMessageId}`;
        await axios.delete(url, {
            headers: {
                'X-ChatWorkToken': CHATWORK_API_TOKEN
            }
        });
    } catch (error) {
        console.error('メッセージ削除エラー:', error.response?.data || error.message);
    }
}

module.exports = {
    sendchatwork,
    sendFile,
    deleteMessages
};
