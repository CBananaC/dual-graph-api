const express = require('express');
const cors = require('cors');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000; // 為了 Glitch 相容
const DATA_PATH = './data.json';

app.use(cors({ origin: '*' }));
app.use(express.json());

// ✅ 提供前端 HTML、JS、CSS 等檔案
app.use(express.static('.'));

// 預設首頁可直接看到
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/index.html');
});

// ✅ 讀取與快取 JSON 資料
let cachedData = loadData();

function loadData() {
    try {
        if (fs.existsSync(DATA_PATH)) {
            const rawData = fs.readFileSync(DATA_PATH, 'utf-8');
            return JSON.parse(rawData);
        } else {
            console.error("❌ data.json 不存在！");
            return {};
        }
    } catch (error) {
        console.error("❌ 讀取 data.json 失敗:", error.message);
        return {};
    }
}

fs.watchFile(DATA_PATH, (curr, prev) => {
    if (curr.mtime !== prev.mtime) {
        console.log("📌 data.json 變更，重新載入數據...");
        cachedData = loadData();
    }
});

// ✅ API 路由
app.get('/api/people', (req, res) => {
    res.json(cachedData.people || []);
});

app.get('/api/accusation-relationships', (req, res) => {
    res.json(cachedData.accusationRelationships || {});
});

app.get('/api/testimony-relationships', (req, res) => {
    res.json(cachedData.testimonyRelationships || {});
});

// ✅ 啟動伺服器
app.listen(PORT, () => {
    console.log(`🚀 伺服器運行於 http://localhost:${PORT}`);
});
