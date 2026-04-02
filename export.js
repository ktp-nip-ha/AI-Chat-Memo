const Exporter = {
    /**
     * メモデータをJSONファイルとしてダウンロードし、処理済み状態を更新する
     */
    async downloadJson() {
        // ① メモ取得
        const currentMemos = typeof getMemos === 'function' ? getMemos() : (typeof Storage !== 'undefined' ? Storage.load() : []);

        if (currentMemos.length === 0) {
            alert('エクスポートするメモがありません。');
            return;
        }

        // ② processed更新（updatedAtも現在時刻にする）
        const now = new Date().toISOString();
        const updatedMemos = currentMemos.map(memo => ({
            ...memo,
            processed: true,
            updatedAt: now
        }));

        // ③ 保存
        if (typeof saveMemos === 'function') {
            saveMemos(updatedMemos);
        } else if (typeof Storage !== 'undefined') {
            Storage.save(updatedMemos);
            // app.jsのグローバルなmemos変数も更新
            if (typeof memos !== 'undefined') {
                memos = updatedMemos;
            }
        }

        // ④ サーバーへ保存（自動同期）
        if (typeof saveToServer === 'function') {
            console.log("エクスポート状態を同期中...");
            await saveToServer(updatedMemos);
        }

        // ⑤ JSON出力
        const jsonString = JSON.stringify(updatedMemos, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        
        const date = new Date();
        const yyyy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const dd = String(date.getDate()).padStart(2, '0');
        const filename = `clipmemo_${yyyy}${mm}${dd}.json`;

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();

        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        // ⑤ 再描画
        if (typeof render === 'function') {
            render();
        }
    }
};
