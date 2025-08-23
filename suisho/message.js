// suisho/message.js
const axios = require('axios');

async function sendchatwork(messageBody, roomId) {
    const CHATWORK_API_TOKEN = process.env.CHATWORK_API_TOKEN;
    try {
        await axios.post(
            `https://api.chatwork.com/v2/rooms/${roomId}/messages`,
            { body: messageBody },
            { headers: { 'X-ChatWorkToken': CHATWORK_API_TOKEN } }
        );
        console.log(`Successfully sent message to room ${roomId}.`);
    } catch (error) {
        console.error('Failed to send message from suisho/message.js:', error.response.data);
    }
}

module.exports = {
    sendchatwork
};
