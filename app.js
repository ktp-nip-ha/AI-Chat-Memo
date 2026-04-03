const SERVER_LOAD_URL = "https://ss1.xrea.com/hazukipasta.s223.xrea.com/aichatmemo/load.php";
const SERVER_SAVE_URL = "https://ss1.xrea.com/hazukipasta.s223.xrea.com/aichatmemo/save.php";
// DOM要素の取得
const memoInput = document.getElementById('memoInput');
const saveBtn = document.getElementById('saveBtn');
const exportBtn = document.getElementById('exportBtn');
const deleteProcessedBtn = document.getElementById('deleteProcessedBtn');
const searchInput = document.getElementById('searchInput');
const unprocessedOnly = document.getElementById('unprocessedOnly');
const memoList = document.getElementById('memoList');

let memos = [];

/**
 * 初期化処理
 */
async function init() {
    await loadFromServer();
}

async function loadFromServer() {
    try {
        const res = await fetch(SERVER_LOAD_URL);
        const data = await res.json();
        const serverMemos = Array.isArray(data) ? data : [];
        
        const localMemos = Storage.load();
        
        // サーバーとローカルをマージ
        memos = mergeMemos(localMemos, serverMemos);
        
        // 最新の状態をローカルに保存
        Storage.save(memos);
        render();
    } catch (e) {
        console.error("Failed to load from server:", e);
        memos = Storage.load();
        render();
    }
}

/**
 * 保存ボタン押下時の処理
 */
async function handleSave() {
    const text = memoInput.value.trim();
    if (!text) return;

    const newMemo = Storage.create(text);
    memos.unshift(newMemo);

    Storage.save(memos);

    await saveToServer(memos);

    render();
    memoInput.value = '';
}

/**
 * 2つのメモリストをサーバー基準でマージする
 * - 同じIDの場合は updatedAt が新しい方を優先
 * - サーバーに存在しないローカルデータは、一度も同期されていない（_synced: false）場合のみ維持
 */
function mergeMemos(localMemos, serverMemos) {
    const map = new Map();

    const getTimestamp = (memo) => {
        return memo.updatedAt ? new Date(memo.updatedAt).getTime() : 0;
    };

    // 1. サーバーデータを基準にセット (サーバーにあるものは同期済みとする)
    serverMemos.forEach(sMemo => {
        map.set(String(sMemo.id), { ...sMemo, _synced: true });
    });

    // 2. ローカルデータの判定
    localMemos.forEach(lMemo => {
        const memoKey = String(lMemo.id);
        const sMemo = map.get(memoKey);
        if (sMemo) {
            // サーバーにもある場合：updatedAt が新しい方を採用
            const lTime = getTimestamp(lMemo);
            const sTime = getTimestamp(sMemo);
            if (lTime > sTime) {
                map.set(memoKey, { ...lMemo, _synced: true });
            }
        } else {
            // サーバーにない場合
            if (lMemo._synced === false) {
                // 一度も同期されていない（完全な新規）なら維持
                map.set(memoKey, lMemo);
            }
            // 同期済みのはずなのにサーバーにないなら「削除された」とみなし、マージ結果に含めない
        }
    });

    return Array.from(map.values());
}

async function saveToServer(localMemos, options = {}) {
    try {
        const res = await fetch(SERVER_LOAD_URL);
        const serverData = await res.json();
        const serverMemos = Array.isArray(serverData) ? serverData : [];

        const deletedIdSet = new Set((options.deletedIds || []).map(id => String(id)));
        const merged = mergeMemos(localMemos, serverMemos).filter(memo => !deletedIdSet.has(String(memo.id)));
        
        // サーバーに保存するデータは全て同期済みとしてマーク
        const syncedMemos = merged.map(m => ({ ...m, _synced: true }));

        await fetch(SERVER_SAVE_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(syncedMemos)
        });

        memos = syncedMemos;
        Storage.save(memos);
        render(); // 最新の状態を反映
    } catch (e) {
        console.error("Failed to save to server:", e);
    }
}
window.saveToServer = saveToServer;

/**
 * 削除ボタン押下時の処理
 */
window.deleteMemo = async function (id) {
    const targetId = String(id);
    memos = memos.filter(memo => String(memo.id) !== targetId);
    Storage.save(memos);

    await saveToServer(memos, { deletedIds: [targetId] });

    render();
};

/**
 * エクスポート済み（processed:true）のメモを一括削除する
 */
async function handleDeleteProcessed() {
    if (confirm('エクスポート済みのメモを削除します。よろしいですか？')) {
        const deletedIds = memos.filter(memo => memo.processed).map(memo => String(memo.id));
        memos = memos.filter(memo => !memo.processed);
        Storage.save(memos);

        await saveToServer(memos, { deletedIds });

        render();
    }
}

/**
 * 画面を描画する
 */
function render() {
    const keyword = searchInput.value.toLowerCase();
    const isUnprocessedOnly = unprocessedOnly ? unprocessedOnly.checked : false;
    memoList.innerHTML = '';
    const getMemoTime = (memo) => {
        const updatedAtTime = Date.parse(memo.updatedAt || '');
        if (!Number.isNaN(updatedAtTime)) return updatedAtTime;
        const createdAtTime = Date.parse(memo.createdAt || '');
        if (!Number.isNaN(createdAtTime)) return createdAtTime;
        const idTime = Number(memo.id);
        return Number.isNaN(idTime) ? 0 : idTime;
    };

    memos
        .filter(memo => {
            const matchKeyword = memo.text.toLowerCase().includes(keyword);
            const matchUnprocessed = isUnprocessedOnly ? !memo.processed : true;
            return matchKeyword && matchUnprocessed;
        })
        .sort((a, b) => getMemoTime(b) - getMemoTime(a))
        .forEach(memo => {
            const memoItem = document.createElement('div');
            memoItem.className = 'memo-item';

            const memoText = document.createElement('div');
            memoText.className = 'memo-text';
            memoText.textContent = memo.text;

            const memoFooter = document.createElement('div');
            memoFooter.className = 'memo-footer';

            const memoDate = document.createElement('span');
            memoDate.className = 'memo-date';
            memoDate.textContent = memo.createdAt;

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'delete-btn';
            deleteBtn.textContent = '削除';
            deleteBtn.addEventListener('click', () => window.deleteMemo(String(memo.id)));

            memoFooter.appendChild(memoDate);
            memoFooter.appendChild(deleteBtn);
            memoItem.appendChild(memoText);
            memoItem.appendChild(memoFooter);
            memoList.appendChild(memoItem);
        });
}

// イベントリスナー
saveBtn.addEventListener('click', handleSave);
if (exportBtn) exportBtn.addEventListener('click', () => Exporter.downloadJson());
if (deleteProcessedBtn) deleteProcessedBtn.addEventListener('click', handleDeleteProcessed);
if (searchInput) searchInput.addEventListener('input', render);
if (unprocessedOnly) unprocessedOnly.addEventListener('change', render);

init();
