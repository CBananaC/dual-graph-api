const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_PATH = './data.json';

app.use(cors({ origin: '*' }));
app.use(express.json());

// ✅ 提供前端 HTML、JS、CSS 等檔案
app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'cover.html'));
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

// ✅ API 路由修正
app.get('/api/people', (req, res) => {
    res.json(cachedData.people || []);
});

app.get('/api/accusation-relationships', (req, res) => {
    const edges = cachedData.accusationRelationships?.edges;
    if (Array.isArray(edges)) {
        res.json({ edges });
    } else {
        res.json({ edges: [] });
    }
});

app.get('/api/testimony-relationships', (req, res) => {
    const edges = cachedData.testimonyRelationships?.edges;
    if (Array.isArray(edges)) {
        res.json({ edges });
    } else {
        res.json({ edges: [] });
    }
});

// ✅ 啟動伺服器
app.listen(PORT, () => {
    console.log(`🚀 伺服器運行於 http://localhost:${PORT}`);
});
