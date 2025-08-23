//============================
// ChatWorkの情報を利用します。
// ============================

const messageedit = require('../suisho/message');
const getCWdata = require('../suisho/cwdata');
const filetocw = require('../suisho/file');

//利用者ランダム表示
async function RandomMember(body, message, messageId, roomId, accountId) {
  try {
    const members = await getCWdata.getChatworkMembers(roomId);

    if (!members || members.length === 0) {
      return;
    }

    const randomIndex = Math.floor(Math.random() * members.length);
    const randomMember = members[randomIndex];

    await messageedit.sendchatwork(`[rp aid=${accountId} to=${roomId}-${messageId}][pname:${accountId}]さん\n[piconname:${randomMember.account_id}]さんが選ばれました！`, roomId);
  } catch (error) {
    await messageedit.sendchatwork(`[rp aid=${accountId} to=${roomId}-${messageId}][pname:${accountId}]さん\nエラー。あらら`, roomId);
  }
}

//メンバー1人の情報
async function Memberinfos(body, message, messageId, roomId, accountId) {
  try {
    const memberinfos = await getCWdata.getChatworkMember(roomId, message);
    
    const member = `[info][title][picon:${message}]${memberinfos.name}[/title]ID: ${memberinfos.chatwork_id}\n組織名: ${memberinfos.organization_name}\nアイコンURL: ${memberinfos.avatar_image_url.replace(/rsz\./g, '')}[/info]`;
    
    await messageedit.sendchatwork(`[rp aid=${accountId} to=${roomId}-${messageId}][pname:${accountId}]さん\n${member}`, roomId);
  } catch (error) {
    await messageedit.sendchatwork(`[rp aid=${accountId} to=${roomId}-${messageId}][pname:${accountId}]さん\nエラー。あらら`, roomId);
  }
}

//メンバーのアイコンをうp
async function Membericon(body, message, messageId, roomId, accountId) {
  try {
    const memberinfos = await getCWdata.getChatworkMember(roomId, message);
    
    const membericon = `${memberinfos.avatar_image_url.replace(/rsz\./g, '')}`;
    
    await filetocw.sendFile(roomId, membericon, `${memberinfos.name}`, accountId, messageId);
  } catch (error) {
    await messageedit.sendchatwork(`[rp aid=${accountId} to=${roomId}-${messageId}][pname:${accountId}]さん\nエラー。あらら`, roomId);
  }
}

//ルームの情報
async function Roominfo(body, message, messageId, roomId, accountId) {
  if(message == 391163626){
    await messageedit.sendchatwork(`[rp aid=${accountId} to=${roomId}-${messageId}][pname:${accountId}]さん\n[info][title]ペンギン水族館[/title]メンバー数: Error
メッセージ数: Error
ファイル数: Error
タスク数: Error
アイコンURL: https://appdata.chatwork.com/icon/6MoBPdml78.png[/info]`, roomId);
    return;
  }
  try {
    const roominfos = await getCWdata.getChatworkRoom(message);
    const roommembernumber = await getCWdata.getChatworkRoomMemberCount(message);
    
    const room = `[info][title]${roominfos.name}[/title]メンバー数: ${roommembernumber}\nメッセージ数: ${roominfos.message_num}\nファイル数: ${roominfos.file_num}\nタスク数: ${roominfos.task_num}\nアイコンURL: ${roominfos.icon_path.replace(/rsz\./g, '')}[/info]`;
    
    await messageedit.sendchatwork(`[rp aid=${accountId} to=${roomId}-${messageId}][pname:${accountId}]さん\n${room}`, roomId);
  } catch (error) {
    console.log(error);
    await messageedit.sendchatwork(`[rp aid=${accountId} to=${roomId}-${messageId}][pname:${accountId}]さん\nごめん。そのルームの情報はないみたい(´・ω・｀)`, roomId);
  }
}

//ルームの情報(部屋リンクあり)
async function Roominfos(body, message, messageId, roomId, accountId) {
  try {
    const roominfos = await getCWdata.getChatworkRoom(message);
    const roomlink = await getCWdata.getChatworkRoomlink(message);
    const roommembernumber = await getCWdata.getChatworkRoomMemberCount(message);
    
    const room = `[info][title]${roominfos.name}[/title]メンバー数: ${roommembernumber}\nメッセージ数: ${roominfos.message_num}\nファイル数: ${roominfos.file_num}\nタスク数: ${roominfos.task_num}\nアイコンURL: ${roominfos.icon_path.replace(/rsz\./g, '')}[/info]`;
    
    await messageedit.sendchatwork(`[rp aid=${accountId} to=${roomId}-${messageId}][pname:${accountId}]さん\n${room}`, roomId);
  } catch (error) {
    console.log(error);
    await messageedit.sendchatwork(`[rp aid=${accountId} to=${roomId}-${messageId}][pname:${accountId}]さん\nごめん。そのルームの情報はないみたい(´・ω・｀)`, roomId);
  }
}

//ルームアイコン
async function Roomicon(body, message, messageId, roomId, accountId) {
  try {
    const roominfos = await getCWdata.getChatworkRoom(message);
    
    const membericon = `${roominfos.icon_path.replace(/rsz\./g, '')}`;
    
    await filetocw.sendFile(roomId, membericon, `${roominfos.name}`, accountId, messageId);
  } catch (error) {
    await messageedit.sendchatwork(`[rp aid=${accountId} to=${roomId}-${messageId}][pname:${accountId}]さん\nエラー。あらら`, roomId);
  }
}

module.exports = {
    RandomMember,
    Memberinfos,
    Membericon,
    Roominfo,
    Roominfos,
    Roomicon
};
