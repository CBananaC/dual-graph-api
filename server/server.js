const express = require('express');
const cors = require('cors');
const fs = require('fs');

const app = express();
const PORT = 3000;
const DATA_PATH = './data.json';

app.use(cors({ origin: '*' }));
app.use(express.json());

app.get('/', (req, res) => {
    res.send('Hello, World!');
});

let cachedData = loadData(); // 初始化快取數據

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

app.get('/api/people', (req, res) => {
    res.json(cachedData.people || []);
});

app.get('/api/accusation-relationships', (req, res) => {
    res.json(cachedData.accusationRelationships || {});
});

app.get('/api/testimony-relationships', (req, res) => {
    res.json(cachedData.testimonyRelationships || {});
});

app.listen(PORT, () => {
    console.log(`🚀 伺服器運行於 http://localhost:${PORT}`);
});