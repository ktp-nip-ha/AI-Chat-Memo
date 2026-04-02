const STORAGE_KEY = 'aichatmemo_data';

const Storage = {
    /**
     * localStorageからデータを読み込む
     */
    load() {
        const savedData = localStorage.getItem(STORAGE_KEY);
        const memos = savedData ? JSON.parse(savedData) : [];

        // 既存データに processed がない場合は false で補完
        return memos.map(memo => ({
            ...memo,
            processed: memo.processed ?? false
        }));
    },

    /**
     * localStorageにデータを保存する
     */
    save(memos) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(memos));
    },

    /**
     * 拡張された新しいデータ形式でメモオブジェクトを作成する
     */
    create(text) {
        const now = new Date().toISOString();
        return {
            id: Date.now().toString(),
            text: text,
            createdAt: new Date().toLocaleString('ja-JP'),
            updatedAt: now,
            processed: false,      // 新規メモは未処理(false)
            source: 'clipmemo-web',
            tags: [],
            summary: '',
            importance: 0,
            metadata: {
                version: '1.0',
                platform: 'web'
            }
        };
    }
};
