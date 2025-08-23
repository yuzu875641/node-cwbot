// suisho/cwdata.js
const axios = require('axios');

async function getChatworkRoomlist() {
    const CHATWORK_API_TOKEN = process.env.CHATWORK_API_TOKEN;
    try {
        const response = await axios.get(
            `https://api.chatwork.com/v2/rooms`,
            { headers: { 'X-ChatWorkToken': CHATWORK_API_TOKEN } }
        );
        return response.data;
    } catch (error) {
        console.error('Failed to get room list from suisho/cwdata.js:', error.response.data);
        return null;
    }
}

module.exports = {
    getChatworkRoomlist
};
