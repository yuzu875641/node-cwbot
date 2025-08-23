const messageedit = require('../suisho/message');
const getCWdata = require('../suisho/cwdata');

let getOk = null;

async function mememe(body, message, messageId, roomId, accountId) {
  if (!message || message.length === 0) {
    await messageedit.sendchatwork(`[rp aid=${accountId} to=${roomId}-${messageId}][pname:${accountId}]さん\nアカウントIDを指定してください`, roomId);
    return;
  }
  const currentTime = Date.now();
  if (getOk !== null && currentTime - getOk < 300000) {
    await messageedit.sendchatwork(`[rp aid=${accountId} to=${roomId}-${messageId}][pname:${accountId}]さん\nこのコマンドは短い期間に連続して使用できません。`, roomId);
    return;
  }

  const chatworkRoomlist = await getCWdata.getChatworkRoomlist();
  const cwroomList = chatworkRoomlist.slice(0, 150);
        
  if (!cwroomList.length) {
    await messageedit.sendchatwork(`[rp aid=${accountId} to=${roomId}-${messageId}][pname:${accountId}]さん\nデータの取得に失敗しました。時間をおいてやってみてねー`, roomId);
    return;
  }
  
  const roomsWithUser = [];
  getOk = currentTime;
  for (const room of cwroomList) {
    const users = await getCWdata.getChatworkMembers(room.room_id);
    if (!users || users.length === 0) {
      continue;
    }
    
    const userFound = users.find(user => user.account_id == message);

    if (userFound) {
      let roleString;

      switch (userFound.role) {
       case 'admin':
          roleString = '管理者';
          break;
       case "member":
          roleString = 'メンバー';
          break;
       case 'readonly':
         roleString = '閲覧';
         break;
       default:
         roleString = userFound.role;
         break;
       }
      
      roomsWithUser.push(` ${room.name}\n(ID: ${room.room_id}) - ${roleString}`);
    }
  }
  
  if (roomsWithUser.length > 0) {
    const ssms = roomsWithUser.join('\n[hr]\n');

    await messageedit.sendchatwork(`[rp aid=${accountId} to=${roomId}-${messageId}][pname:${accountId}]さん\n[piconname:${message}]さんが入っているルーム\n[info]${ssms}[/info]`, roomId);
  } else {
    await messageedit.sendchatwork(`[rp aid=${accountId} to=${roomId}-${messageId}][pname:${accountId}]さん\nうーん、その利用者が入っているルームが見つかりません。`, roomId);
  }
}


module.exports = {
    mememe
};
