document.addEventListener("DOMContentLoaded", function () {

  // --------------------------------------------
  // 頂部分頁導航功能
  // --------------------------------------------
  const tabButtons = document.querySelectorAll(".tab-button");
  const sections = document.querySelectorAll(".page-section");
  tabButtons.forEach(button => {
    button.addEventListener("click", () => {
      tabButtons.forEach(btn => btn.classList.remove("active"));
      sections.forEach(section => section.classList.remove("active"));
      button.classList.add("active");
      const targetId = button.getAttribute("data-target");
      if (targetId) {
        document.getElementById(targetId).classList.add("active");
      }
    });
  });

  // --------------------------------------------
  // 全域變數與 API 設定
  // --------------------------------------------
  const API_BASE_URL = "http://localhost:3000"; // 上線前請調整
  let peopleData = {};
  let fullTestimonyData = {};
  let timelineGraph;
  let trendChartInstance = null;
  let detailChartInstance = null;
  let selectedFilterTime = null;
  let redLineActive = false;
  let lastDetail = null;
  let currentTrendTimeGroup = "yearly";

  // --------------------------------------------
  // 趨勢圖時間軸設定
  // --------------------------------------------
  const yearlyFilterTimes = [
    "失記日期","洪武八年","洪武十一年","洪武十二年","洪武十三年",
    "洪武二十一年","洪武二十三年","洪武二十四年",
    "洪武二十五年","洪武二十六年"
  ];

  const monthlyFilterTimes = [
    "失記日期","洪武八年","洪武十一年","洪武十二年","洪武十三年","洪武二十一年","洪武二十三年",
    "洪武二十四年失記的日","洪武二十四年二月","洪武二十四年三月","洪武二十四年四月","洪武二十四年九月",
    "洪武二十五年正月","洪武二十五年二月","洪武二十五年五月","洪武二十五年八月",
    "洪武二十五年九月","洪武二十五年十月","洪武二十五年十一月","洪武二十五年十二月",
    "洪武二十五年閏十二月",
    "洪武二十六年失記的日","洪武二十六年正月",
    "洪武二十六年二月","洪武二十六年三月","洪武二十六年四月"
  ];
  // 先定義空陣列，稍後向後端取得
  const dailyFilterTimes = [
    "失記日期","洪武八年","洪武十一年","洪武十二年","洪武十三年",
    "洪武二十一年","洪武二十三年",

    "洪武二十四年失記的日","洪武二十四年二月","洪武二十四年三月","洪武二十四年四月","洪武二十四年九月",
    "洪武二十五年正月","洪武二十五年二月","洪武二十五年五月","洪武二十五年八月",
    "洪武二十五年九月","洪武二十五年十月","洪武二十五年十一月","洪武二十五年十二月",
    "洪武二十五年閏十二月",

    "洪武二十六年失記的日",
    "洪武二十六年正月失記的日",
    "洪武二十六年正月初三日",
    "洪武二十六年正月初七日",
    "洪武二十六年正月十二日",
    "洪武二十六年正月十三日",
    "洪武二十六年正月十五日",
    "洪武二十六年正月十六日",
    "洪武二十六年正月十七日",
    "洪武二十六年正月十八日",
    "洪武二十六年正月二十日",
    "洪武二十六年正月二十一日",
    "洪武二十六年正月二十二日",
    "洪武二十六年正月二十四日",
    "洪武二十六年正月二十七日",
    "洪武二十六年正月二十八日",
    "洪武二十六年正月二十九日",
    "洪武二十六年二月失記的日",
    "洪武二十六年二月初一日",
    "洪武二十六年二月初二日",
    "洪武二十六年二月初三日",
    "洪武二十六年二月初五日",
    "洪武二十六年二月初六日",
    "洪武二十六年二月初七日",
    "洪武二十六年二月初八日",
    "洪武二十六年二月十八日",
    "洪武二十六年三月初二日",
    "洪武二十六年三月十四日",
    "洪武二十六年四月失記的日",
    "洪武二十六年四月初二日",
    "洪武二十六年四月初七日"
  ];

  // --------------------------------------------
  // 趨勢圖設定
  // --------------------------------------------
  const trendChartConfig = {
    filterLabels: [
      "參與胡惟庸謀反","透露謀反動機","透露謀反計劃",
      "邀約謀反","答應參與謀反","聯絡","秘密商議",
      "要求隱暪謀反","聚兵預備謀反","屯積兵馬","謀逆",
      "藍玉事敗後計劃謀反"
    ],
    dateMapping: {},
    labelMapping: {
      "聯絡馬俊": "聯絡","幫藍玉聯絡": "聯絡","聯絡陳桓": "聯絡","聯絡許指揮等指揮": "聯絡",
      "聯絡藍田": "聯絡","聯絡藍玉": "聯絡","聯絡茆貴": "聯絡","聯絡胡玉": "聯絡",
      "聯絡胡指揮": "聯絡","聯絡王禮": "聯絡","幫張翼聯絡": "聯絡","聯絡法古": "聯絡",
      "聯絡曹震": "聯絡","聯絡張翼": "聯絡","聯絡何貴": "聯絡","聯絡何榮": "聯絡",
      "幫詹紱聯絡": "聯絡","幫茆鼎聯絡": "聯絡","幫楊春聯絡": "聯絡","幫何宏聯絡": "聯絡",
      "幫汪福德聯絡": "聯絡","聯絡汪福德": "聯絡",
      "取兵馬": "屯積兵馬","借兵馬": "屯積兵馬","屯積兵馬": "屯積兵馬"
    }
  };

  // --------------------------------------------
  // 固定標記的事件線及其標籤
  // --------------------------------------------
  const FIXED_LINES = [
    { value: "洪武十三年",   label: "胡惟庸案"    },
    { value: "洪武二十三年", label: "李善長案"    },
    { value: "洪武二十五年", label: "葉昇被誅、藍玉獲封太子太傅"    },
    { value: "洪武二十六年", label: "藍玉案"      },

    { value: "洪武二十五年八月", label: "葉昇被誅"    },
    { value: "洪武二十五年十二月", label: "藍玉獲封太子太傅"},
    { value: "洪武二十六年二月", label: "藍玉案"      }
  ];

  // --------------------------------------------
  // 輔助函式
  // --------------------------------------------
  function applyMapping(str, mapping) {
    if (!mapping) return str;
    return mapping[str] || str;
  }
  function getRandomColor() {
    const r = Math.floor(Math.random()*156)+100,
          g = Math.floor(Math.random()*156)+100,
          b = Math.floor(Math.random()*156)+100;
    return `rgb(${r},${g},${b})`;
  }
  function getColorByIdentity(identity) {
    // 如果給的是陣列，就取第 0 項
    const key = Array.isArray(identity) ? identity[0] : identity;
    const mapping = {
      "功臣": "#73a0fa", "藍玉": "#73d8fa",
      "僕役": "#cfcfcf", "親屬": "#faa073",
      "文官": "#cfcfcf", "武官": "#fa73c4",
      "皇帝": "#faf573","胡惟庸功臣": "#73fa9e",
      "都督": "#8e73fa"
    };
    return mapping[key] || "#999999";
  }

  function addZoomControls(network, container) {
    const zoomContainer = document.createElement("div");
    zoomContainer.className = "zoom-controls";
    Object.assign(zoomContainer.style, { position:"absolute", bottom:"10px", right:"10px", zIndex:"10" });
    ["plus","minus"].forEach(sym => {
      const btn = document.createElement("button");
      btn.innerHTML = sym==="plus" ? '<i class="fas fa-plus"></i>' : '<i class="fas fa-minus"></i>';
      Object.assign(btn.style, { margin:"2px", fontSize:"20px", padding:"8px 10px" });
      btn.addEventListener("click", () => {
        const scale = network.getScale() * (sym==="plus" ? 1.5 : 1/1.5);
        network.moveTo({ scale });
      });
      zoomContainer.appendChild(btn);
    });
    container.style.position = "relative";
    container.appendChild(zoomContainer);
  }
  async function fetchPeopleData() {
    try {
      const res = await fetch(`${API_BASE_URL}/api/people`);
      const data = await res.json();
      return data.reduce((acc,p) => {
        p.id = p.id.toString();
        acc[p.id] = p;
        return acc;
      }, {});
    } catch (e) {
      console.error("❌ 無法獲取人物數據:", e);
      return {};
    }
  }
  function convertRelationshipData(data, nameToId) {
    return data.edges.map(edge => {
      ["From","To","Label","Text","Reference"].forEach(K => {
        if (edge[K] && !edge[K.toLowerCase()]) edge[K.toLowerCase()] = edge[K];
      });
      ["from","to","accuser"].forEach(f => {
        if (typeof edge[f] === "string") edge[f] = nameToId[edge[f]]?.toString() || "";
      });
      if (Array.isArray(edge.accused)) {
        edge.accused = edge.accused.map(v => nameToId[v]?.toString() || "");
      }
      return edge;
    });
  }
  function preprocessEdges(edges) {
    const groups = {};
    edges.forEach(e => {
      const key = `${e.from}_${e.to}`;
      (groups[key] ||= []).push(e);
    });
    return Object.values(groups).flatMap(arr => {
      if (arr.length === 1) return arr;
      return arr.map((e,i) => ({
        ...e,
        smooth: {
          enabled: true,
          type: i%2 ? "curvedCW" : "curvedCCW",
          roundness: 0.1 + i*0.1
        }
      }));
    });
  }
  function getNodeDegrees(edges) {
    const dm = {};
    edges.forEach(e => {
      dm[e.from] = (dm[e.from] || 0) + 1;
      dm[e.to]   = (dm[e.to]   || 0) + 1;
    });
    return dm;
  }

  
  // --------------------------------------------
  // Chart.js 插件：動態紅線 + 固定灰色虛線與標籤 + 灰色區域與區域文字標記
  // --------------------------------------------
  const verticalLinePlugin = {
    id: "verticalLinePlugin",
    afterDraw(chart, args, opts) {
      const v = opts.value; if (!v) return;
      const { ctx, chartArea:{top,bottom}, scales:{x} } = chart;
      const idx = chart.data.labels.indexOf(v);
      if (idx < 0) return;
      const xPos = x.getPixelForValue(v);
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(xPos, top);
      ctx.lineTo(xPos, bottom);
      ctx.lineWidth = opts.lineWidth || 2;
      ctx.strokeStyle = opts.color || "rgba(255,0,0,0.8)";
      ctx.stroke();
      ctx.restore();
    }
  };
  const fixedLinesPlugin = {
    id: "fixedLinesPlugin",
    afterDraw(chart, args, opts) {
      const lines = opts.lines || [];
      if (!lines.length) return;
      const { ctx, chartArea:{top,bottom}, scales:{x}, data } = chart;
      ctx.save();
      ctx.setLineDash(opts.dash || [5,5]);
      ctx.strokeStyle = opts.color || "gray";
      ctx.lineWidth = opts.lineWidth || 1;
      ctx.fillStyle = opts.color || "gray";
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.font = "15px sans-serif";
      lines.forEach(item => {
        const idx = data.labels.indexOf(item.value);
        if (idx < 0) return;
        const xPos = x.getPixelForValue(item.value);
        ctx.beginPath();
        ctx.moveTo(xPos, top);
        ctx.lineTo(xPos, bottom);
        ctx.stroke();
        ctx.fillText(item.label, xPos, top - -20);
      });
      ctx.restore();
    }
  };
  const regionPlugin = {
    id: "regionPlugin",
    afterDraw(chart, args, opts) {
      const { start, end, color, label, labelColor } = opts;
      if (!start || !end) return;
      const { ctx, chartArea:{top,bottom}, scales:{x}, data } = chart;
      const idxStart = data.labels.indexOf(start);
      const idxEnd   = data.labels.indexOf(end);
      if (idxStart < 0 || idxEnd < 0) return;
      const xStart = x.getPixelForValue(start);
      const xEnd   = x.getPixelForValue(end);
      // 畫灰色區域
      ctx.save();
      ctx.fillStyle = color || "rgba(128,128,128,0.2)";
      ctx.fillRect(xStart, top, xEnd - xStart, bottom - top);
      // 畫區域文字（深灰色）
      ctx.fillStyle = labelColor || "#555";
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.font = "15px sans-serif";
      const xMid = (xStart + xEnd) / 2;
      ctx.fillText(label || "", xMid, top - -20);
      ctx.restore();
    }
  };
  Chart.register(verticalLinePlugin, fixedLinesPlugin, regionPlugin, ChartDataLabels);

  // --------------------------------------------
  // Timeline 圖表繪製——只顯示有 edges 的 nodes
  // --------------------------------------------
  function drawTimelineGraph(data, elementId, infoPanelId) {
    const nodesArray = data.nodes
      ? data.nodes.map(n => ({ ...n, color:getColorByIdentity(n.身份) }))
      : Object.values(peopleData).map(p => ({ ...p, label:p.姓名, color:getColorByIdentity(p.身份) }));
    const relatedIds = new Set(data.edges.flatMap(e => [e.from,e.to]));
    let filteredNodes = nodesArray.filter(n => relatedIds.has(n.id));

    const processed = preprocessEdges(data.edges);
    const edgesWithIds = processed.map((e,i) => ({
      ...e, id: e.edgeId || `edge-${i}`, originalData: e
    }));

    const degreeMap = getNodeDegrees(edgesWithIds);
    filteredNodes = filteredNodes.map(n => ({ ...n, value: degreeMap[n.id] || 0 }));

    const nodes = new vis.DataSet(filteredNodes);
    const edges = new vis.DataSet(edgesWithIds);
    const container = document.getElementById(elementId);

    const options = {
      nodes: {
        shape: "dot",
        font: { color:"#000", align:"center", size:20, vadjust:-60 },
        scaling: { min:35, max:100 }
      },
      edges: {
        arrows: { to:{enabled:true} },
        length: 350,
        font: { size:13, multi:"html" },
        smooth: { enabled:true, type:"dynamic", roundness:0.2 }
      },
      physics: {
        enabled:true,
        solver:"forceAtlas2Based",
        forceAtlas2Based:{ gravitationalConstant:-500, springLength:100, springConstant:1, avoidOverlap:0 },
        stabilization:{ iterations:0, updateInterval:0 }
      },
      interaction:{ zoomView:false, dragView:true }
    };

    const network = new vis.Network(container, { nodes, edges }, options);
    container.addEventListener("wheel", e => {
      if(e.ctrlKey){
        e.preventDefault();
        const newScale = network.getScale() * (1 - e.deltaY * 0.015);
        network.moveTo({ scale: newScale });
      }
    }, { passive:false });
    addZoomControls(network, container);

    network.on("click", params => {
      if (params.nodes.length > 0) {
        showPersonInfo(params.nodes[0], infoPanelId);
      } else if (params.edges.length > 0) {
        showTestimonyEdgeInfo(params.edges[0], edges.get(), infoPanelId);
      } else {
        document.getElementById(infoPanelId).innerHTML = "請雙擊人物或關係查看詳細資訊";
      }
    });

    return { network, nodes, edges };
  }

  function updateTimelineGraph(edgesArr) {
    const processed = preprocessEdges(edgesArr);
    const edgesWithIds = processed.map((e,i) => ({
      ...e, id: e.edgeId || `edge-${i}`, originalData: e
    }));
    const fromToSet = new Set();
    edgesWithIds.forEach(e => {
      fromToSet.add(e.from);
      fromToSet.add(e.to);
    });
  
    // 2. allowed 一開始就是這些 from/to
    const allowed = new Set(fromToSet);
  
    // 3. 只有當 accused 也在 from/to 裡才加入
    edgesWithIds.forEach(e => {
      if (Array.isArray(e.accused)) {
        e.accused.forEach(id => {
          if (fromToSet.has(id)) {
            allowed.add(id);
          }
        });
      }
    });

 const filteredNodes = Object.values(peopleData)
    .filter(p => allowed.has(p.id))
    .map(p => ({
      ...p,
      label: p.姓名,
      color: getColorByIdentity(p.身份)
    }));

  // 根據 degree 設定 value
  const degreeMap = getNodeDegrees(edgesWithIds);
  const finalNodes = filteredNodes.map(n => ({
    ...n,
    value: degreeMap[n.id] || 0
  }));

  // 更新 vis.js  data
  const nodesDs = new vis.DataSet(finalNodes);
  const edgesDs = new vis.DataSet(edgesWithIds);
  timelineGraph.network.setData({ nodes: nodesDs, edges: edgesDs });
}

  // --------------------------------------------
  // 趨勢圖與互動（包含 daily 支援）
  // --------------------------------------------
  function buildTrendChart() {
    const canvas = document.getElementById("trendChart");
    if(!canvas || !fullTestimonyData.edges) return;
    const ctx = canvas.getContext("2d");
    if(trendChartInstance) trendChartInstance.destroy();

    // 決定 pool：支援 yearly / monthly / daily
    let pool;
    if (currentTrendTimeGroup === "yearly") {
      pool = yearlyFilterTimes;
    } else if (currentTrendTimeGroup === "monthly") {
      pool = monthlyFilterTimes;
    } else {
      pool = dailyFilterTimes;
    }

    const labels = pool.map(t => applyMapping(t, trendChartConfig.dateMapping));
    const series = trendChartConfig.filterLabels.map(l => applyMapping(l, trendChartConfig.labelMapping));
    const counts = {};
    series.forEach(s => counts[s] = Array(labels.length).fill(0));
    fullTestimonyData.edges.forEach(e => {
      for(let i=0; i<pool.length; i++){
        if (e.Date?.includes(pool[i])) {
          const mt = applyMapping(pool[i], trendChartConfig.dateMapping);
          const ml = applyMapping(e.label||"未標記", trendChartConfig.labelMapping);
          const idx = labels.indexOf(mt);
          if (idx >= 0 && series.includes(ml)) counts[ml][idx]++;
          break;
        }
      }
    });

    const datasets = series.map(s => ({
      label: s,
      data: counts[s],
      borderColor: getRandomColor(),
      backgroundColor: "transparent",
      fill: false,
      tension: 0.1,
      pointRadius: 4
    }));

    trendChartInstance = new Chart(ctx, {
      type: "line",
      data: { labels, datasets },
      options: {
        layout: { padding: { top:30, bottom:30 } },
        responsive: true,
        plugins: {
          title:{ display:true, text:"證供關係罪名趨勢圖" },
          verticalLinePlugin:{ value:null, lineWidth:2, color:"rgba(255,0,0,0.8)" },
          fixedLinesPlugin:{ lines: FIXED_LINES, color:"gray", dash:[5,5], lineWidth:1 },
          regionPlugin:{ 
            start: "洪武二十六年二月失記的日", 
            end:   "洪武二十六年二月十八日", 
            color: "rgba(128,128,128,0.2)",
            label: "「藍玉謀反」",
            labelColor: "#555"
          },
          datalabels:{ display:false },
          legend:{
            onClick:(e,item,leg) => {
              const ds = leg.chart.data.datasets[item.datasetIndex];
              showLineChart(leg.chart.data.labels, ds.data, ds.label, ds.borderColor);
            }
          }
        },
        scales:{
          x:{ title:{ display:true, text:"時間" } },
          y:{ title:{ display:true, text:"罪名次數" }, beginAtZero:true }
        }
      }
    });

    // 確保 detailChart canvas
    if(!document.getElementById("detailChart")){
      const c = document.createElement("canvas");
      c.id="detailChart"; c.width=800; c.height=400;
      document.querySelector(".trend-chart-section").appendChild(c);
    }
    canvas.removeEventListener("click", onTrendClick);
    canvas.addEventListener("click", onTrendClick);

    if(selectedFilterTime) highlightTimeOnChart(selectedFilterTime);
    updateDetailChart();
  }

  const detailContainer = document.getElementById("detailContainer");

// 隱藏／摧毀 detailChart 的函式
function hideDetailChart() {
  if (detailChartInstance) {
    detailChartInstance.destroy();
    detailChartInstance = null;
  }
  detailContainer.style.display = "none";
}

  // --------------------------------------------
  // Bar / Line 詳細圖 & 互動
  // --------------------------------------------
  function showBarChart(itemLabels, itemValues, title, colors) {
    // 先显示 detailContainer
    document.getElementById("detailContainer").style.display = "block";
  
    // 1. 合并数据并按 value 降序排序
    const arr = itemLabels.map((lbl, i) => ({
      label: lbl,
      value: itemValues[i],
      color: colors[i]
    }));
    arr.sort((a, b) => b.value - a.value);
  
    // 2. 拆回排序后的三个数组
    const sortedLabels = arr.map(d => d.label);
    const sortedValues = arr.map(d => d.value);
    const sortedColors = arr.map(d => d.color);
  
    // 3. 销毁旧实例
    const ctx = document.getElementById("detailChart").getContext("2d");
    if (detailChartInstance) {
      detailChartInstance.destroy();
      detailChartInstance = null;
    }
  
    // 4. 重新建一个 bar chart
    detailChartInstance = new Chart(ctx, {
      type: "bar",
      data: {
        labels: sortedLabels,
        datasets: [{
          label: title,
          data: sortedValues,
          backgroundColor: sortedColors
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: { padding: { top: 30, bottom: 30 } },
        scales: {
          y: { beginAtZero: true }
        },
        plugins: {
          title: { display: true, text: title },
          legend: {
            display: true,
            position: "top",
            labels: {
              generateLabels: chart => {
                const ds = chart.data.datasets[0];
                return chart.data.labels
                  .map((lbl, i) => {
                    const v = ds.data[i];
                    if (v <= 0) return null;
                    const bg = Array.isArray(ds.backgroundColor)
                      ? ds.backgroundColor[i]
                      : ds.backgroundColor;
                    return {
                      text: lbl,
                      fillStyle: bg,
                      strokeStyle: bg,
                      hidden: !chart.getDataVisibility(i),
                      index: i,
                      datasetIndex: 0
                    };
                  })
                  .filter(x => x);
              }
            },
            onClick: (e, legendItem, legend) => {
              const chart = legend.chart;
              chart.toggleDataVisibility(legendItem.index);
              chart.update();
            }
          },
          fixedLinesPlugin: {
            lines: FIXED_LINES,
            color: "gray",
            dash: [5, 5],
            lineWidth: 1
          },
          regionPlugin: {
            start: "洪武二十六年二月失記的日",
            end:   "洪武二十六年二月十八日",
            color: "rgba(128,128,128,0.2)",
            label: "「藍玉謀反」",
            labelColor: "#555"
          },
          datalabels: { anchor: "end", align: "top", formatter: v => v }
        }
      }
    });
  
    lastDetail = { mode: "bar" };
  }

  function showLineChart(xLabels, yValues, seriesLabel, color) {
    detailContainer.style.display = "block";
    const ctx = document.getElementById("detailChart").getContext("2d");
    if(detailChartInstance) detailChartInstance.destroy();
    detailChartInstance = new Chart(ctx, {
      type: "line",
      data: {
        labels: xLabels,
        datasets: [{
          label: seriesLabel,
          data: yValues,
          borderColor: color,
          backgroundColor: color,
          fill: false,
          tension: 0.1,
          pointRadius: 5
        }]
      },
      options: {
        layout: { padding: { top:30, bottom:30 } },
        responsive: true,
        plugins: {
          title: { display: true, text: seriesLabel },
          fixedLinesPlugin: { lines: FIXED_LINES, color: "gray", dash:[5,5], lineWidth:1 },
          regionPlugin:{ 
            start: "洪武二十六年二月失記的日", 
            end:   "洪武二十六年二月十八日", 
            color: "rgba(128,128,128,0.2)",
            label: "「藍玉謀反」",
            labelColor: "#555"
          },
          datalabels: { anchor: "end", align: "top", formatter: v => v }
        },
        scales: { y: { beginAtZero: true } }
      }
    });
    lastDetail = { mode: "line", crimeLabel: seriesLabel };
  }
  hideDetailChart();

  function updateDetailChart() {
    if(!lastDetail) return;
    const ch = trendChartInstance;
    if(lastDetail.mode === "bar") {
      if(!selectedFilterTime) return;
      const idx = ch.data.labels.indexOf(selectedFilterTime);
      if(idx < 0) return;
      const labs = ch.data.datasets.map(ds=>ds.label);
      const vals = ch.data.datasets.map(ds=>ds.data[idx]);
      const cols = ch.data.datasets.map(ds=>ds.borderColor);
      showBarChart(labs, vals, selectedFilterTime, cols);
    } else {
      const ds = ch.data.datasets.find(d=>d.label === lastDetail.crimeLabel);
      if(!ds) return;
      showLineChart(ch.data.labels, ds.data, ds.label, ds.borderColor);
    }
  }

  function onTrendClick(evt) {
    const chart = trendChartInstance;
    const pts = chart.getElementsAtEventForMode(evt, 'nearest', { intersect: true }, false);
    if(pts.length) {
      const idx = pts[0].index;
      const lab = chart.data.labels[idx];
      const cols = chart.data.datasets.map(ds=>ds.borderColor);
      const vals = chart.data.datasets.map(ds=>ds.data[idx]);
      showBarChart(chart.data.datasets.map(ds=>ds.label), vals, lab, cols);
      return;
    }
    if(redLineActive && selectedFilterTime) {
      const xPix = chart.scales.x.getPixelForValue(selectedFilterTime);
      const rect = evt.target.getBoundingClientRect();
      const x = evt.clientX - rect.left;
      if(Math.abs(x - xPix) < 6) {
        const idx = chart.data.labels.indexOf(selectedFilterTime);
        const cols = chart.data.datasets.map(ds=>ds.borderColor);
        const vals = chart.data.datasets.map(ds=>ds.data[idx]);
        showBarChart(chart.data.datasets.map(ds=>ds.label), vals, selectedFilterTime, cols);
        return;
      }
    }
    const dsels = chart.getElementsAtEventForMode(evt, 'dataset', { intersect: false }, false);
    if(dsels.length) {
      const di = dsels[0].datasetIndex;
      const ds = chart.data.datasets[di];
      showLineChart(chart.data.labels, ds.data, ds.label, ds.borderColor);
    }
  }

  function highlightTimeOnChart(engdate) {
    if(!trendChartInstance) return;
      // 需要跳過紅線的按鈕清單
  const noRedDates = [
    "洪武二十四年",
    "洪武二十五年",
    "洪武二十六年",
    "洪武二十六年失記的日",
    "洪武二十六年正月",
    "洪武二十六年二月",
    "洪武二十六年三月",
    "洪武二十六年四月"
  ];

  // 如果是在日計模式，且按到上述日期，就不畫紅線
  if (currentTrendTimeGroup === "daily" && noRedDates.includes(engdate)) {
    trendChartInstance.options.plugins.verticalLinePlugin.value = null;
    trendChartInstance.update();
    return;
  }
    const labels = trendChartInstance.data.labels;
    const match = labels.find(l=>engdate.includes(l)||l.includes(engdate)) || null;
    selectedFilterTime = match;
    if(match) {
      redLineActive = true;
      trendChartInstance.options.plugins.verticalLinePlugin.value = match;
      trendChartInstance.update();
    }
  }

  // --------------------------------------------
  // 顯示人物/關係 詳細
  // --------------------------------------------
  function showPersonInfo(nodeId, infoPanelId) {
    const infoPanel = document.getElementById(infoPanelId);
    const person = peopleData[nodeId];
    if (!person) {
      infoPanel.innerHTML = "<p>❌ 無法找到該人物的詳細資料。</p>";
      return;
    }
  
    // 定義要顯示的欄位與對應的標籤
    const fields = [
      { key: "姓名",     label: "名字" },
      { key: "年齡",     label: "年齡" },
      { key: "種族",     label: "種族" },
      { key: "籍貫",     label: "籍貫" },
      { key: "親屬關係", label: "親屬關係" },
      { key: "身份",     label: "身份" },
      { key: "職位",     label: "職位" },
      { key: "下場",     label: "下場" },
      { key: "原文",     label: "原文" },
      { key: "資料來源", label: "資料來源" }
    ];
  
    // 動態組 HTML，只對有值的欄位建立 <p>
    let html = `<h3>人物資訊</h3>`;
    fields.forEach(f => {
      const val = person[f.key];
      if (val != null && val !== "") {
        html += `<p><strong>${f.label}：</strong>${val}</p>`;
      }
    });
  
    infoPanel.innerHTML = html;
  }
  

  function showTestimonyEdgeInfo(edgeId, edgesData, infoPanelId) {
    const clicked = edgesData.find(e => e.id.toString() === edgeId.toString());
    const infoPanel = document.getElementById(infoPanelId);
    if(clicked && clicked.originalData) {
      const o = clicked.originalData;
      const acc = o.accuser ? peopleData[o.accuser]?.姓名 : "-";
      const acs = o.accused?.map(id => peopleData[id]?.姓名 || "-").join("、") || "";
      infoPanel.innerHTML = `
        <h3>證供關係資訊</h3>
        <p><strong>關係類型：</strong>${o.label||"-"}</p>
        <p><strong>作供者：</strong>${acc}</p>
        <p><strong>被供者：</strong>${acs}</p>
        <p><strong>發生日期：</strong>${o.Date||"-"}</p>
        <p><strong>說明：</strong>${o.Conclusion||"-"}</p>
        <p><strong>供詞原文：</strong>${o.Text||"-"}</p>
        <p><strong>詳細內容：</strong>${o.Reference||"-"}</p>
      `;
    } else {
      infoPanel.innerHTML = "<p>❌ 無法找到該證供關係的詳細資訊。</p>";
    }
  }

  // --------------------------------------------
  // 載入資料與初始化
  // --------------------------------------------
  async function loadData(){
    peopleData = await fetchPeopleData();
    const nameToId = {};
    Object.values(peopleData).forEach(p => nameToId[p.姓名] = p.id);

      // --------- 多重身份拆陣列 -----------
  Object.values(peopleData).forEach(p => {
    if (typeof p.身份 === "string") {
      p.身份 = p.身份
        .split(/[、,]/)
        .map(s => s.trim())
        .filter(s => s);
    }
  });

    if(document.getElementById("timelineGraph")){
      fetch(`${API_BASE_URL}/api/testimony-relationships`)
        .then(r => r.json())
        .then(raw => {
          const edges = convertRelationshipData(raw, nameToId);
          edges.forEach((e,i) => e.edgeId = `edge-${i}`);
          fullTestimonyData.edges = edges;
          timelineGraph = drawTimelineGraph({edges},"timelineGraph","infoPanelTimeline");
          buildTrendChart();
        })
        .catch(e => console.error("❌ 證供關係數據載入錯誤:", e));
    }
  }
  loadData();

  // --------------------------------------------
  // 綁定「篩選時間」按鈕
  // --------------------------------------------
  document.querySelectorAll(".timeline-filter-button").forEach(btn => {
    btn.addEventListener("click", function() {
      document.querySelectorAll(".timeline-filter-button").forEach(b => b.classList.remove("active"));
      this.classList.add("active");
      const engdate = this.getAttribute("data-engdate");
      selectedFilterTime = engdate;
      redLineActive = true;
      filterTimelineEdges(engdate);
    });
  });

  // --------------------------------------------
  // 綁定「按年／按月／按日」按鈕
  // --------------------------------------------
  const btnYearly = document.getElementById("btnYearly");
  const btnMonthly = document.getElementById("btnMonthly");
  const btnDaily   = document.getElementById("btnDaily");

  if (btnYearly) {
    btnYearly.addEventListener("click", () => {
      currentTrendTimeGroup = "yearly";
      btnYearly.classList.add("active");
      btnMonthly.classList.remove("active");
      btnDaily.classList.remove("active");
      buildTrendChart();
    });
  }
  if (btnMonthly) {
    btnMonthly.addEventListener("click", () => {
      currentTrendTimeGroup = "monthly";
      btnMonthly.classList.add("active");
      btnYearly.classList.remove("active");
      btnDaily.classList.remove("active");
      buildTrendChart();
    });
  }
  if (btnDaily) {
    btnDaily.addEventListener("click", () => {
      currentTrendTimeGroup = "daily";
      btnDaily.classList.add("active");
      btnYearly.classList.remove("active");
      btnMonthly.classList.remove("active");
      buildTrendChart();
    });
  }

  // --------------------------------------------
  // 篩選並更新時間線關係圖 & 全部統計Bar
  // --------------------------------------------
  function filterTimelineEdges(timeStr) {
    if (timeStr === "全部") {
      updateTimelineGraph(fullTestimonyData.edges);
      // 全部罪行總計

      const seriesAll = trendChartConfig.filterLabels.map(l => applyMapping(l, trendChartConfig.labelMapping));
      const countsAll = {};
      seriesAll.forEach(s => countsAll[s] = 0);
      fullTestimonyData.edges.forEach(e => {
        trendChartConfig.filterLabels.forEach(raw => {
          if (e.label?.includes(raw)) {
            countsAll[ applyMapping(raw, trendChartConfig.labelMapping) ]++;
          }
        });
      });
  
      const labelsAll = seriesAll;
      const valuesAll = labelsAll.map(s => countsAll[s]);
      const colorsAll = seriesAll.map(_ => getRandomColor());
  
      // 顯示 bar chart
      showBarChart(labelsAll, valuesAll, "全部罪名統計", colorsAll);
  
    } else {
      // 篩出該時間的 edges
      const filtered = fullTestimonyData.edges.filter(e => e.Date && e.Date.includes(timeStr));
      updateTimelineGraph(filtered);
      highlightTimeOnChart(timeStr);
  
      // 統計該時間的罪名
      const series = trendChartConfig.filterLabels.map(l => applyMapping(l, trendChartConfig.labelMapping));
      const counts = {};
      series.forEach(s => counts[s] = 0);
      filtered.forEach(e => {
        trendChartConfig.filterLabels.forEach(raw => {
          if (e.label?.includes(raw)) {
            counts[ applyMapping(raw, trendChartConfig.labelMapping) ]++;
          }
        });
      });
  
      const labels = series;
      const values = labels.map(s => counts[s]);
      const colors = series.map(_ => getRandomColor());
  
      // 顯示 bar chart（並自動展開 detailContainer）
      showBarChart(labels, values, `${timeStr} 罪名統計`, colors);
    }
  }
});
