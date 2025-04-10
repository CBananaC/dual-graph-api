const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000; // 為了 Render/Glitch 相容
const DATA_PATH = path.join(__dirname, 'data.json');

// ✅ 提供前端 HTML、JS、CSS 等靜態檔案
app.use(cors({
  origin: ['https://cbananac.github.io', 'http://localhost:3000']
}));
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// ✅ 預設首頁（處理根目錄請求）
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// ✅ 快取 data.json 的資料
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

// ✅ 自動監測 data.json 有變動時重新載入
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
    res.json({ edges: cachedData.accusationRelationships || [] });
});

app.get('/api/testimony-relationships', (req, res) => {
    res.json({ edges: cachedData.testimonyRelationships || [] });
});

// ✅ 啟動伺服器
app.listen(PORT, () => {
    console.log(`🚀 伺服器運行於 http://localhost:${PORT}`);
});
