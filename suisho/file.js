// suisho/file.js
const { createClient } = require('@supabase/supabase-js');

// 環境変数からSupabaseの情報を取得
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

// Supabaseクライアントを初期化
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// `miaq`の`require`文を削除
// const miaq = require('../src/miaq');

// Supabaseからファイル情報を取得する関数
exports.getSupabaseFileInfo = async () => {
    try {
        const { data, error } = await supabase
            .from('notes')
            .select('id, title, content');
        
        if (error) {
            console.error('Error fetching data from Supabase:', error.message);
            return "Supabaseから情報を取得できませんでした。";
        }

        if (data && data.length > 0) {
            let response = "ノート一覧:\n";
            data.forEach(note => {
                response += `・${note.title} (ID: ${note.id})\n`;
            });
            return response;
        } else {
            return "ノートがありません。";
        }
    } catch (err) {
        console.error("Unexpected error:", err.message);
        return "予期せぬエラーが発生しました。";
    }
};

// ... `sendFile` のエラーを修正するための関数を定義
// 存在しないので、ここでは定義しない
// もし、この機能が必要であれば、ここにコードを追加してください

// このファイルからエクスポートする機能
module.exports = {
  getSupabaseFileInfo,
  // sendFile, // `sendFile`が定義されていないため、この行を削除
};
