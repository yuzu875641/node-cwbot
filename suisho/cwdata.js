// ============================
// CWからデータを取得するモジュール。
// ============================

const axios = require('axios');
//APIリクエスト分散用のサブトークン
const CHATWORK_API_TOKEN = process.env.CHATWORK_API_TOKENmain;

//指定したルームの情報
async function getChatworkRoom(roomId) {
  try {
    const response = await axios.get(
      `https://api.chatwork.com/v2/rooms/${roomId}`,
      {
        headers: {
          "X-ChatWorkToken": CHATWORK_API_TOKEN,
        },
      }
    );

    const roominfo = response.data;
    return roominfo;
  } catch (error) {
    console.error(
      "Error fetching Chatwork members:",
      error.response?.data || error.message
    );
    return null;
  }
}

//ルームの招待リンク
async function getChatworkRoomlink(roomId) {
  try {
    const response = await axios.get(
      `https://api.chatwork.com/v2/rooms/${roomId}/link`,
      {
        headers: {
          "X-ChatWorkToken": CHATWORK_API_TOKEN,
        },
      }
    );

    const roomlink = response.data.url;
    return roomlink;
  } catch (error) {
    console.error(
      "Error fetching Chatwork members:",
      error.response?.data || error.message
    );
    return "招待リンクを取得できませんでした";
  }
}

//ルームの利用者数
async function getChatworkRoomMemberCount(roomId) {    
    try {
      const response = await axios
        .get(`https://api.chatwork.com/v2/rooms/${roomId}/members`, 
          {
            headers: {
                'X-ChatWorkToken': CHATWORK_API_TOKEN,
            }
        });
        
      return response.data.length;
    } catch (error) {
        console.error(`Error: ${error.response.status} - ${error.response.data}`);
        return "メンバー数のデータがありません";
    }
}

//ルームの利用者一覧
async function getChatworkMembers(roomId) {
  try {
    const response = await axios.get(
      `https://api.chatwork.com/v2/rooms/${roomId}/members`,
      {
        headers: {
          "X-ChatWorkToken": CHATWORK_API_TOKEN,
        },
      }
    );

    const members = response.data;
    return members;
  } catch (error) {
    console.error(
      "メンバー一覧を取得できません:",
      error.response?.data || error.message
    );
    return null;
  }
}

//指定した利用者1人
async function getChatworkMember(roomId, accountId) {
  const members = await getChatworkMembers(roomId);
  if (members) {
    const member = members.find((member) => member.account_id === Number(accountId));
    console.log(member);
    return member;
  }
  return null;
}

//指定したメッセージを1つ取得
async function getChatworkmessage(roomId, messageId) {
  try {
    const response = await axios.get(
      `https://api.chatwork.com/v2/rooms/${roomId}/messages/${messageId}`,
      {
        headers: {
          "X-ChatWorkToken": CHATWORK_API_TOKEN,
        },
      }
    );

    const roominfo = response.data;
    return roominfo;
  } catch (error) {
    console.error(
      "Chatworkのメッセージ取得に失敗:",
      error.response?.data || error.message
    );
    return null;
  }
}

//ルームのメッセージを直近に取得したところから取得
async function msLogsLow(roomId) {
  try {
    const response = await axios.get(`https://api.chatwork.com/v2/rooms/${roomId}/messages?force=0`, {
      headers: {
        'X-ChatWorkToken': CHATWORK_API_TOKEN
      }
    });
    return response.data;
  } catch (error) {
    console.error('エラーが発生しました:', error);
    return false;
  }
}

//ルームのメッセージを100件取得
async function msLogsMax(roomId) {
  try {
    const response = await axios.get(`https://api.chatwork.com/v2/rooms/${roomId}/messages?force=1`, {
      headers: {
        'X-ChatWorkToken': CHATWORK_API_TOKEN
      }
    });
    return response.data;
  } catch (error) {
    console.error('エラーが発生しました:', error);
    return false;
  }
}

//指定した利用者が管理者かどうか
async function isUserAdmin(accountId, roomId) {
  try {
    const response = await axios.get(`https://api.chatwork.com/v2/rooms/${roomId}/members`, {
      headers: {
        'X-ChatWorkToken': CHATWORK_API_TOKEN
      }
    });
    const member = response.data.find(m => m.account_id === accountId);

    if (member && member.role === 'admin') {
      return true;
    } else {
      return false;
    }
  } catch (error) {
    console.error('エラーが発生しました:', error);
    return false;
  }
}

//ルーム一覧
const baibair = [382623217];
async function getChatworkRoomlist() {
  try {
    const response = await axios.get(
      `https://api.chatwork.com/v2/rooms`,
      {
        headers: {
          "X-ChatWorkToken": CHATWORK_API_TOKEN,
        },
      }
    );
    const list = response.data;
    const roomlist = list.filter(item =>
      item.type !== 'direct' && !baibair.includes(item.room_id)
    );
    return roomlist;
  } catch (error) {
    console.error(
      "ルーム一覧を取得できなかった！:",
      error.response?.data || error.message
    );
    return;
  }
}

module.exports = {
    getChatworkRoom,
    getChatworkRoomlink,
    getChatworkRoomMemberCount,
    getChatworkMembers,
    getChatworkMember,
    getChatworkmessage,
    msLogsLow,
    msLogsMax,
    isUserAdmin,
    getChatworkRoomlist
};
