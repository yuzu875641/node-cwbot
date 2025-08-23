// ============================
// メンションを受けた際の処理。
// ============================

const sccheck = require('../suisho/sccheck');
const messageedit = require('../suisho/message');

const CWinfoplay = require('../module/CWinfo');
const wakameAI = require('../module/gemini');
const jouchowakame = require('../module/joucho');
const wakamemiaq = require('../module/miaq');
const omikuji = require('../module/omikuji');
const wakameSetUp = require('../module/setup');
const wakametube = require('../module/wakametube');
const ranking = require('../module/tops');
const memberfound = require('../module/memberll');

const urlFile = require('../module/plusfile');

const jihouchan = require('../webhook/jihou');
const doujin = require('../jihou/h');

const restartok = require('../server/restart');

//コマンドリスト
const commands = {
  "ヘルプ": wakameSetUp.wakamehelp,
  "youtube": wakametube.getwakametube,
  "ai": wakameAI.generateGemini,
  "deepseek": wakameAI.DeepSeek,
  "deepseekja": wakameAI.deepseekJa,
  "カス文章": wakameAI.kasu,
  "miaq": wakamemiaq,
  "おみくじ": omikuji.omikuji,
  "アカウントくじ": omikuji.userkuji,
  "ランダムユーザー": CWinfoplay.RandomMember,
  "memberinfos": CWinfoplay.Memberinfos,
  "membericon": CWinfoplay.Membericon,
  "roominfo": CWinfoplay.Roominfo,
  "roominfos": CWinfoplay.Roominfos,
  "roomicon": CWinfoplay.Roomicon,
  "file": urlFile.file,
  "htmlget": jouchowakame.htmlget,
  "shotget": jouchowakame.shotget,
  "imageAI": jouchowakame.imageAI,
  "ggimage": jouchowakame.ggimageAI,
  "時報": jihouchan.jihoum,
  "image": jihouchan.omakasendFile,
  "harusame": jihouchan.rimage,
  "gif": jihouchan.gif,
  "キャラ": jihouchan.waifu,
  "同人": doujin.search,
  "findUser": memberfound.mememe,
  "tops": ranking.topNeo,
  "topshack": ranking.topNeoHack,
  "topfile": ranking.topFile,
  "topssave": ranking.saving,
  "restart": restartok
};

//コマンド
function getCommand(body) {
  const pattern = /\/(.*?)\//;
  const match = body.match(pattern);
  return match ? match[1] : null;
}

async function mentionWebhook(req, res) {
  
    const accountId = req.body.webhook_event.from_account_id;
    const roomId = req.body.webhook_event.room_id;
    const messageId = req.body.webhook_event.message_id;
    const body = req.body.webhook_event.body;  
    const message = body.replace(/\[To:\d+\ゆずbotさん|\/.*?\/|\s+/g, "");

    try {
        if (body.includes("削除")) {
            await messageedit.deleteMessages(body, message, messageId, roomId, accountId);
            return res.sendStatus(200);
        }
      
        if (body.includes("ok")) {
            await doujin.wakamedo(body, message, messageId, roomId, accountId);
            return res.sendStatus(200);
        }

        if (body.includes("[rp aid=10617115]")) {
            return res.sendStatus(200);
        }

        

        const command = getCommand(body);
        if (command && commands[command]) {
            await commands[command](body, message, messageId, roomId, accountId);
        }

        res.sendStatus(200);
    } catch (error) {
        console.error('Error processing webhook:', error);
        res.sendStatus(500);
    }
}

module.exports = {
    mentionWebhook,
    getCommand
};
