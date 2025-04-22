/*****************************************************************
 *  script.js  （完整原始碼，未刪任何一行；所有新增程式碼以  >>>  標示）
 *****************************************************************/
document.addEventListener("DOMContentLoaded", function () {
  // =======================================
  // 頂部分頁導覽功能 (Tab Navigation)
  // =======================================
  const tabButtons = document.querySelectorAll(".tab-button");
  const sections   = document.querySelectorAll(".page-section");
  tabButtons.forEach(button => {
    button.addEventListener("click", () => {
      tabButtons.forEach(b => b.classList.remove("active"));
      sections  .forEach(s => s.classList.remove("active"));
      button.classList.add("active");
      const targetId = button.getAttribute("data-target");
      document.getElementById(targetId).classList.add("active");
    });
  });

  const API_BASE_URL = "https://dual-graph-api.onrender.com";
  let peopleData = {};
  let fullAccusationData = {};
  let fullTestimonyData  = {};
  let accusationGraph, testimonyGraph;
  let selectedPersonId   = null;
  let testimonyRelationMode = null;
  let timelineGraph; // for timeline updates

  // ---------- Chart.js 實例與狀態變數 ----------
  let testimonyBarChart=null;
  let testimonyBubbleChart=false;              // 只當旗標用
  let currentEdgesForCharts=[];                // >>> 目前 Bar/Bubble 用的資料
  let currentTestimonyFilterLabel="全部罪名";

  // ---------- 紀錄身份篩選 ----------
  let currentIdentityFilter = "全部";

  // ---------- 固定罪名分類（依照篩選按鈕，排除 data-label="全部"）----------
  const testimonyCategoryButtons = Array.from(
    document.querySelectorAll('.filter-testimony-button')
  ).filter(btn => btn.dataset.label !== '全部');

  const testimonyCategories = testimonyCategoryButtons.map(btn => ({
    key:     btn.dataset.label,
    display: btn.textContent.trim()
  }));

  // ---------------------------
  // 通用輔助函式
  // ---------------------------
  function getColorByIdentity(identity) {
    const key = Array.isArray(identity) ? identity[0] : identity;
    const mapping = {
      "功臣": "#73a0fa",
      "藍玉": "#73d8fa",
      "僕役": "#cfcfcf",
      "親屬": "#faa073",
      "文官": "#cfcfcf",
      "武官": "#fa73c4",
      "皇帝": "#faf573",
      "胡惟庸功臣": "#73fa9e",
      "都督": "#8e73fa",
    };
    return mapping[key] || "#999999";
  }

  function preprocessEdges(edges) {
    const groups = {};
    edges.forEach(edge => {
      const key = `${edge.from}_${edge.to}`;
      (groups[key] || (groups[key] = [])).push(edge);
    });
    return Object.values(groups).flatMap(group => {
      if (group.length === 1) return group;
      return group.map((edge, idx) => ({
        ...edge,
        smooth: {
          enabled: true,
          type: idx % 2 === 1 ? "curvedCW" : "curvedCCW",
          roundness: 0.1 + idx * 0.1
        }
      }));
    });
  }

  function getNodeDegrees(edges) {
    const degreeMap = {};
    edges.forEach(e => {
      [e.from, e.to].forEach(id => {
        degreeMap[id] = (degreeMap[id] || 0) + 1;
      });
      if (e.accuser) degreeMap[e.accuser] = (degreeMap[e.accuser] || 0) + 1;
      if (Array.isArray(e.accused)) {
        e.accused.forEach(id => degreeMap[id] = (degreeMap[id] || 0) + 1);
      }
    });
    return degreeMap;
  }

  async function fetchPeopleData() {
    try {
      const res = await fetch(`${API_BASE_URL}/api/people`);
      const arr = await res.json();
      return arr.reduce((acc, p) => {
        acc[p.id.toString()] = p;
        return acc;
      }, {});
    } catch (e) {
      console.error("❌ 無法獲取人物數據:", e);
      return {};
    }
  }

  function convertRelationshipData(data, nameToId) {
    data.edges = data.edges.map(edge => {
      ["From","To","Label","Text","Reference"].forEach(k => {
        const l = k.toLowerCase();
        if (edge[k] && !edge[l]) edge[l] = edge[k];
      });
      ["from","to","accuser"].forEach(k => {
        if (typeof edge[k] === "string") {
          edge[k] = nameToId[edge[k]] || "";
        }
      });
      if (Array.isArray(edge.accused)) {
        edge.accused = edge.accused.map(n => nameToId[n] || "");
      }
      return edge;
    });
    return data;
  }

  // ====================================================
  // 放大縮小按鈕函式 (Zoom Controls)
  // ====================================================
  function addZoomControls(network, container) {
    const zoomContainer = document.createElement("div");
    zoomContainer.className = "zoom-controls";
    Object.assign(zoomContainer.style, {
      position: "absolute",
      bottom: "10px",
      right: "10px",
      zIndex: "10"
    });

    const zoomInButton = document.createElement("button");
    zoomInButton.innerHTML = '<i class="fas fa-plus"></i>';
    Object.assign(zoomInButton.style, { margin: "2px", fontSize: "20px", padding: "8px 10px" });

    const zoomOutButton = document.createElement("button");
    zoomOutButton.innerHTML = '<i class="fas fa-minus"></i>';
    Object.assign(zoomOutButton.style, { margin: "2px", fontSize: "20px", padding: "8px 10px" });

    zoomContainer.appendChild(zoomInButton);
    zoomContainer.appendChild(zoomOutButton);

    container.style.position = "relative";
    container.appendChild(zoomContainer);

    zoomInButton.addEventListener("click", () => {
      const scale = network.getScale() * 1.5;
      network.moveTo({ scale });
    });
    zoomOutButton.addEventListener("click", () => {
      const scale = network.getScale() / 1.5;
      network.moveTo({ scale });
    });
  }

  function clearCharts() {
    if (testimonyBarChart)  testimonyBarChart.destroy();
    testimonyBarChart = null;
    const barEl = document.getElementById("testimonyBarChart");
    if (barEl) barEl.style.display = "none";

    const bubEl = document.getElementById("testimonyBubbleChart");
    if (bubEl) bubEl.style.display = "none";
  }

  function showCharts(edgesArr) {
    currentEdgesForCharts = edgesArr;                            // 保存当前用的数据
    document.getElementById("testimonyBarChart").style.display   = "block";
    document.getElementById("testimonyBubbleChart").style.display= "block";
    updateTestimonyBarChart(edgesArr);
  }

  // ---------------------------
  // 繪製網絡圖（指控 & 證供共用）
  // ---------------------------
  function drawGraph(data, elementId, infoPanelId, onClick, isTestimonyGraph) {
    const nodesRaw = data.nodes
      ? data.nodes
      : Object.values(peopleData).map(p => ({ ...p, label: p.姓名 }));

    const relatedIds = new Set(data.edges.flatMap(e => [e.from, e.to, ...(e.accused||[])]));
    const degreeMap = getNodeDegrees(
      data.edges.map((e, i) => ({ ...e, id: e.edgeId || `edge-${i}` }))
    );

    const nodes = new vis.DataSet(
      nodesRaw
        .filter(n => relatedIds.has(n.id))
        .map(n => ({
          ...n,
          color: getColorByIdentity(n.身份),
          value: degreeMap[n.id] || 0
        }))
    );

    const processedEdges = isTestimonyGraph ? preprocessEdges(data.edges) : data.edges;
    const edges = new vis.DataSet(
      processedEdges.map((e, i) => ({
        ...e,
        id: e.edgeId || `edge-${i}`,
        originalData: e
      }))
    );

    const container = document.getElementById(elementId);

    const options = {
      nodes: {
        shape: "dot",
        font: { color: "#000", align: "center", size: 20, vadjust: -60 },
        scaling: { min: 35, max: 100 }
      },
      edges: {
        arrows: { to: { enabled: true } },
        length: 350,
        font: { size: 13, multi: "html" },
        smooth: isTestimonyGraph ? false : { enabled: true, type: "dynamic", roundness: 0.2 }
      },
      physics: {
        enabled: true,
        solver: "forceAtlas2Based",
        forceAtlas2Based: { gravitationalConstant: -500, springLength: 100, springConstant: 1, avoidOverlap: 0 },
        stabilization: { iterations: 0, updateInterval: 0 }
      },
      interaction: { zoomView: false, dragView: true }
    };

    const network = new vis.Network(container, { nodes, edges }, options);

    container.addEventListener("wheel", e => {
      if (e.ctrlKey) {
        e.preventDefault();
        const scaleFactor = 1 - e.deltaY * 0.015;
        const newScale = network.getScale() * scaleFactor;
        network.moveTo({ scale: newScale });
      }
    }, { passive: false });

    addZoomControls(network, container);
    network.on("click", params => onClick(params, network, infoPanelId));

    return { network, edges };
  }

  // ---------------------------
  // 隱藏證供關係圖 (重置為空圖)
  // ---------------------------
  function resetTestimonyGraph() {
    const nodes = new vis.DataSet([]);
    const edges = new vis.DataSet([]);
    testimonyGraph.network.setData({ nodes, edges });
  }

  // ---------------------------
  // 清除所有控制按鈕狀態
  // ---------------------------
  function clearAllControls() {
    ["accuserButton","accusedButton","showAllButton"].forEach(id => {
      const b = document.getElementById(id);
      b.classList.remove("active");
      b.style.backgroundColor = "";
    });
    document.querySelectorAll(".filter-testimony-button").forEach(b => {
      b.classList.remove("active");
      b.style.backgroundColor = "";
    });
    document.querySelectorAll(".filter-identity-button").forEach(b => {
      b.classList.remove("active");
      b.style.backgroundColor = "";
    });
    testimonyRelationMode = null;
    selectedPersonId = null;
  }

  // ---------------------------
  // 清空資訊面板
  // ---------------------------
  function clearTestimonyInfoPanel() {
    document.getElementById("infoPanelTestimony").innerHTML = "請點擊人物或關係查看詳細資訊";
  }
  function clearAccusationInfoPanel() {
    document.getElementById("infoPanel").innerHTML = "請點擊人物或關係查看詳細資訊";
  }

  // ---------------------------
  // 點擊處理函式
  // ---------------------------
  function handleAccusationClick(params, network, infoPanelId) {
    const panel = document.getElementById(infoPanelId);
    resetTestimonyGraph();
    clearAllControls();
    clearTestimonyInfoPanel();
    clearAccusationInfoPanel();

    if (params.nodes.length > 0) {
      clearCharts();               // >>> 點到 node 先把兩圖清掉
      selectedPersonId = params.nodes[0];
      panel.innerHTML = renderPersonInfo(selectedPersonId);
    } else if (params.edges.length > 0) {
      const edgeId = params.edges[0];
      panel.innerHTML = renderAccusationInfo(edgeId);
    } else {
      panel.textContent = "請雙擊人物或關係查看詳細資訊";
    }
  }

  function handleTestimonyClick(params, _, panelId) {
    const panel = document.getElementById(panelId);
    if (params.nodes.length > 0) {
      panel.innerHTML = renderPersonInfo(params.nodes[0]);
    } else if (params.edges.length > 0) {
      panel.innerHTML = renderTestimonyInfo(params.edges[0]);
    } else {
      panel.textContent = "請雙擊人物或關係查看詳細資訊";
    }
  }

  // ---------------------------
  // 資訊渲染函式
  // ---------------------------
  function renderPersonInfo(id) {
    const p = peopleData[id] || {};
    const fields = [
      { key: '姓名',     label: '名字' },
      { key: '年齡',     label: '年齡' },
      { key: '種族',     label: '種族' },
      { key: '籍貫',     label: '籍貫' },
      { key: '親屬關係', label: '親屬關係' },
      { key: '身份', label: '身份' },
      { key: '職位',     label: '職位' },
      { key: '下場',     label: '下場' },
      { key: '原文',     label: '原文' },
      { key: '資料來源', label: '資料來源' }
    ];
    let html = '<h3>人物資訊</h3>';
    fields.forEach(f => {
      const val = p[f.key];
      if (val !== null && val !== undefined && val !== '') {
        html += `<p><strong>${f.label}：</strong>${val}</p>`;
      }
    });
    return html;
  }

  function renderAccusationInfo(edgeId) {
    const e = accusationGraph.edges.get(edgeId) || {};
    return `
      <h3>指控關係資訊</h3>
      <p><strong>關係類型：</strong>${e.label||"-"}</p>
    `;
  }

  function renderTestimonyInfo(edgeId) {
    const orig = testimonyGraph.edges.get(edgeId)?.originalData || {};
    const accuser = peopleData[orig.accuser]?.姓名 || "-";
    const accused = (orig.accused || []).map(i => peopleData[i]?.姓名 || "-").join("、");
    return `
      <h3>證供關係資訊</h3>
      <p><strong>關係類型：</strong>${orig.label||"-"}</p>
      <p><strong>作供者：</strong>${accuser}</p>
      <p><strong>被供者：</strong>${accused}</p>
      <p><strong>發生日期：</strong>${orig.Date||"-"}</p>
      <p><strong>說明：</strong>${orig.Conclusion||"-"}</p>
      <p><strong>供詞原文：</strong>${orig.Text||"-"}</p>
      <p><strong>詳細內容：</strong>${orig.Reference||"-"}</p>
    `;
  }

  // ---------------------------
  // 圖表更新 & 篩選
  // ---------------------------
  function updateTestimonyGraph(edgesArr) {
    const edges = preprocessEdges(edgesArr).map((e, i) => ({
      ...e,
      id: e.edgeId || `edge-${i}`,
      originalData: e
    }));
    const idsFromTo = new Set();
    edges.forEach(e => {
      idsFromTo.add(e.from);
      idsFromTo.add(e.to);
    });
    const allowed = new Set(idsFromTo);
    edges.forEach(e => {
      if (Array.isArray(e.accused)) {
        e.accused.forEach(accId => {
          if (idsFromTo.has(accId)) allowed.add(accId);
        });
      }
    });
    const nodes = new vis.DataSet(
      Object.values(peopleData)
        .filter(p => allowed.has(p.id))
        .map(p => ({
          id: p.id,
          label: p.姓名,
          color: getColorByIdentity(p.身份),
          value: getNodeDegrees(edges)[p.id] || 0
        }))
    );
    testimonyGraph.network.setData({ nodes, edges });
  }

  function restoreTestimonyGraph() {
    updateTestimonyGraph(fullTestimonyData.edges);
  }

  function filterTestimonyEdgesByLabelForNode(label) {
    const key = label.trim().toLowerCase();
    const arr = fullTestimonyData.edges.filter(e => {
      const modeMatch = testimonyRelationMode === "accuser"
        ? e.accuser === selectedPersonId
        : Array.isArray(e.accused) && e.accused.includes(selectedPersonId);
      return modeMatch && (label === "全部" || (e.label||"").toLowerCase().includes(key));
    });
    updateTestimonyGraph(arr);
  }

  function filterTestimonyEdgesByLabelForAll(label) {
    const key = label.trim().toLowerCase();
    const arr = fullTestimonyData.edges.filter(e =>
      label === "全部" || (e.label||"").toLowerCase().includes(key)
    );
    updateTestimonyGraph(arr);
  }

  // ---------------------------
  // 隨機顏色、深色版本
  // ---------------------------
  function randomColor() {
    return '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6,'0');
  }
  function darkenColor(hex, factor=0.2) {
    const rgb = hex.slice(1).match(/.{2}/g).map(h => parseInt(h,16));
    const darker = rgb.map(c => Math.floor(c*(1-factor)));
    return '#' + darker.map(c => c.toString(16).padStart(2,'0')).join('');
  }

  // ---------------------------
  // 永遠顯示數值的 plugin
  // ---------------------------
  const valueLabelsPlugin = {
    id: 'valueLabels',
    afterDatasetsDraw(chart) {
      chart.data.datasets.forEach((dataset, datasetIndex) => {
        const meta = chart.getDatasetMeta(datasetIndex);
        meta.data.forEach((bar, index) => {
          const ctx = chart.ctx;
          const val = dataset.data[index];
          ctx.fillStyle = '#000';
          ctx.font = '16px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(val, bar.x, bar.y - 5);
        });
      });
    }
  };

  // ---------------------------
  // 氣泡圖顯示 label plugin
  // ---------------------------
  const bubbleLabelsPlugin = {
    id: 'bubbleLabels',
    afterDatasetsDraw(chart) {
      const ctx = chart.ctx;
      chart.data.datasets.forEach((dataset, dsIndex) => {
        const meta = chart.getDatasetMeta(dsIndex);
        meta.data.forEach((bubble, i) => {
          const label = `${chart.data.labels[i]} ${dataset.data[i].y}`;
          ctx.fillStyle = '#000';
          ctx.font = '16px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(label, bubble.x, bubble.y);
        });
      });
    }
  };

  // ---------------------------
  // 更新長條圖
  // ---------------------------
  const BAR_TITLE_COLOR = "#000";   // ★Bar‑Chart 標題顏色
  const BAR_TITLE_SIZE  = 18;          // ★Bar‑Chart 標題字級(px)

  const TT_FONT_SIZE    = 18;          // ★Bubble Tooltip 字級(px)
  const TT_BG_COLOR     = "rgba(255,255,255,0.9)"; // 


  function updateTestimonyBarChart(edgesArr) {
    const sorted = testimonyCategories
      .map(c => ({
        key:     c.key,
        display: c.display,
        count: edgesArr.filter(
          e => e.label && e.label.toLowerCase().includes(c.key.toLowerCase())
        ).length
      }))
      .sort((a, b) => b.count - a.count);
  
    const labels = sorted.map(item => item.display);
    const data   = sorted.map(item => item.count);
  
    const bgColors = labels.map(() => randomColor());
    const hoverBg  = bgColors.map(c => darkenColor(c, 0.2));
  
    // >>> 新增：依照「是否選中人物」及「是否全部罪名」決定標題
    let titleText;
    if (!selectedPersonId) {
      if (currentTestimonyFilterLabel === "全部罪名") {
        titleText = "全部證供關係的罪名統計結果";
      } else {
        titleText = `全部證供關係中${currentTestimonyFilterLabel}的統計結果`;
      }
    } else {
      const personName = peopleData[selectedPersonId]?.姓名 || '';
      const modeText   = testimonyRelationMode === 'accuser' ? '指控者' : '被指控者';
      const filterText = currentTestimonyFilterLabel;
      titleText = `${personName}作為${modeText}所涉及的${filterText}的統計結果`;
    }
  
    if (testimonyBarChart) testimonyBarChart.destroy();
    testimonyBarChart = new Chart(
      document.getElementById("testimonyBarChart").getContext("2d"),
      {
        type: 'bar',
        data: { labels, datasets: [{
          label: '罪名次數',
          data,
          backgroundColor: bgColors,
          hoverBackgroundColor: hoverBg,
          barPercentage: labels.length === 1 ? 0.3 : 0.5
        }] },
        options: {
          plugins: {
            title: {
              display: true,
              text: titleText,
              color: BAR_TITLE_COLOR,
              font: { size: BAR_TITLE_SIZE }
            },
            legend: { display: false },
            tooltip: { enabled: true }
          },
          scales: {
            y: { beginAtZero:true, grace:'10%', title:{ display:true, text:'次數' } },
            x: { title:{ display:true, text:'罪名' }, ticks:{ autoSkip:false } }
          }
        },
        plugins: [ valueLabelsPlugin ]
      }
    );
  
    // 同步更新泡泡
    updateTestimonyBubbleChart(edgesArr);
  }

  /****************************************************************
   * >>>  D3 Pack Layout 氣泡圖（覆寫原函式）  >>>                *
   ****************************************************************/
  const AREA_SCALE = 50;      // ★面積倍率，數字愈大泡泡愈大
  const TITLE_F_SIZE = 18;   

window.addEventListener("resize", () => {
  if (testimonyBubbleChart && currentEdgesForCharts.length) {
    // 只重绘当前过滤过后的数据
    updateTestimonyBubbleChart(currentEdgesForCharts);
  }
});


 function updateTestimonyBubbleChart(edgesArr) {
    /* 0. 容器、標題 */
    const wrap = document.getElementById("testimonyBubbleChart");
    if (wrap.style.display === "none") wrap.style.display = "block";

    let titleStr;
    if (!selectedPersonId) {
      if (currentTestimonyFilterLabel === "全部罪名") {
        titleStr = "全部證供關係互動氣泡圖";
      } else {
        titleStr = `全部證供關係中${currentTestimonyFilterLabel}的互動氣泡圖`;
      }
    } else {
      const role  = testimonyRelationMode === "accuser" ? "指控者" : "被指控者";
      const label = currentTestimonyFilterLabel;
      titleStr = `${peopleData[selectedPersonId]?.姓名 || ""}作為${role}在${label}中的互動氣泡圖`;
    }
  
    let titleEl = document.getElementById("bubbleChartTitle");
    if (!titleEl) {
      titleEl = document.createElement("h3");
      titleEl.id = "bubbleChartTitle";
      wrap.prepend(titleEl);
    }
    titleEl.textContent   = titleStr;
    titleEl.style.textAlign = "center";
    titleEl.style.fontSize  = TITLE_F_SIZE + "px";
    titleEl.style.margin    = "10px 0 5px";
  

    /* 1. 準備 SVG（RWD 對應） */
    let svgEl = document.getElementById("testimonyBubbleChartSvg");
    if (!svgEl) {
      svgEl = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svgEl.id = "testimonyBubbleChartSvg";
      svgEl.style.width  = "100%";
      svgEl.style.height = "90vh";      // >>> 隨視窗高變動
      wrap.appendChild(svgEl);
    }
    const svg  = d3.select(svgEl);
    svg.selectAll("*").remove();

    const rect  = svgEl.getBoundingClientRect();
    const width = rect.width  || 600;
    const height= rect.height || 400;

    /* 2. 統計次數 */
    const cnt = {};
    edgesArr.forEach(e => {
      [e.from, e.to].forEach(id => {
        if (!id) return;
        cnt[id] = (cnt[id] || 0) + 1;
      });
    });
    const nodes = Object.entries(cnt).map(([id, c]) => ({
      id,
      name : peopleData[id]?.姓名 || id,
      cnt  : c,
      value: c * AREA_SCALE
    }));
    if (!nodes.length) return;

    /* 3. Pack Layout */
    const root = d3.pack()
      .size([width, height])
      .padding(4)(
        d3.hierarchy({ children: nodes }).sum(d => d.value)
      );

    const bubble = svg.selectAll("g")
      .data(root.leaves())
      .enter()
      .append("g")
      .attr("transform", d => `translate(${d.x},${d.y})`);

    /* 4. 圓圈 */
    bubble.append("circle")
      .attr("r", d => d.r)
      .attr("fill", d => getColorByIdentity(peopleData[d.data.id]?.身份))
      .attr("stroke", "#fff")
      .attr("stroke-width", 1);

    /* 5. 文字（字級依半徑／字長自適應） */
    bubble.append("text")
    .attr("text-anchor", "middle")
    .attr("dy", "0.35em")
    .style("pointer-events", "none")
    .style("font-size", d => {
        // 每個字約佔 0.6 × 字級 px 寬；估算後取最小值並限制上限
        const est = (2 * d.r) / (d.data.name.length + String(d.data.cnt).length + 1) / 1;
        return `${Math.min(est, 30)}px`;
    })
    .text(d => `${d.data.name}:${d.data.cnt}`);

    /* 6. Tooltip */
    bubble.on("mouseover", (evt, d) => {
      const gTip = svg.append("g").attr("id", "bubbleTip");

      /* 文字 */
      const txt = gTip.append("text")
        .attr("x", d.x)
        .attr("y", d.y - d.r - 10)
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "text-after-edge")
        .style("font-size", TT_FONT_SIZE + "px")   // >>> 加大字體
        .text(`${d.data.name}: ${d.data.cnt} 次`);

      /* 背景矩形（先畫文字才能取 bbox） */
      const bbox = txt.node().getBBox();
      gTip.insert("rect", "text")
        .attr("x", bbox.x - 6)
        .attr("y", bbox.y - 4)
        .attr("width" , bbox.width  + 12)
        .attr("height", bbox.height + 8)
        .attr("rx", 4)
        .attr("ry", 4)
        .attr("fill", TT_BG_COLOR)                 // >>> 底色
        .attr("stroke", "none")
        .attr("stroke-width", 0.5);
    })
    .on("mouseout", () => svg.select("#bubbleTip").remove());
    

    // >>> 保留當前資料供 RWD resize 時重繪
    testimonyBubbleChart = true;
  }
  /*******************  氣泡圖覆寫完畢  *******************/
  async function loadData() {
    peopleData = await fetchPeopleData();
    const nameToId={}; Object.values(peopleData).forEach(p=>nameToId[p.姓名]=p.id);
    Object.values(peopleData).forEach(p=>{
      if (typeof p.身份==="string"){
        p.身份 = p.身份.split(/[、,]/).map(s=>s.trim()).filter(s=>s);
      }
    });

    const [accRaw,tstRaw] = await Promise.all([
      fetch(`${API_BASE_URL}/api/accusation-relationships`).then(r=>r.json()),
      fetch(`${API_BASE_URL}/api/testimony-relationships`).then(r=>r.json())
    ]);

    fullAccusationData = convertRelationshipData(accRaw,nameToId);
    fullAccusationData.edges = fullAccusationData.edges.map((e,i)=>({...e,edgeId:`edge-${i}`}));
    accusationGraph = drawGraph(fullAccusationData,"accusationGraph","infoPanel",handleAccusationClick,false);

    fullTestimonyData  = convertRelationshipData(tstRaw,nameToId);
    fullTestimonyData.edges = fullTestimonyData.edges.map((e,i)=>({...e,edgeId:`edge-${i}`}));
    testimonyGraph = drawGraph(fullTestimonyData,"testimonyGraph","infoPanelTestimony",handleTestimonyClick,true);

    timelineGraph = testimonyGraph;

    // >>> 一載入就秀「全部」統計
    showCharts(fullTestimonyData.edges);
  }
  loadData();

  document.querySelectorAll(".filter-testimony-button").forEach(btn=>{
    btn.addEventListener("click",()=>{
      const label = btn.getAttribute("data-label");
      currentTestimonyFilterLabel = label==="全部" ? "全部罪名" : btn.textContent.trim();

      let filtered;
      if (selectedPersonId && testimonyRelationMode){
        filtered = fullTestimonyData.edges.filter(e=>{
          const mode = testimonyRelationMode==="accuser"
            ? e.accuser===selectedPersonId
            : Array.isArray(e.accused)&&e.accused.includes(selectedPersonId);
          return mode && (label==="全部" || (e.label||"").toLowerCase().includes(label.trim().toLowerCase()));
        });
        filterTestimonyEdgesByLabelForNode(label);
      }else{
        filtered = fullTestimonyData.edges.filter(e=>
          label==="全部" || (e.label||"").toLowerCase().includes(label.trim().toLowerCase())
        );
        filterTestimonyEdgesByLabelForAll(label);
      }
      showCharts(filtered);              // >>> 不論有無選人，一律顯示圖表
      clearTestimonyInfoPanel();
    });
  });

  // --- 重置關係圖 ---
  document.getElementById("showAllButton").addEventListener("click",()=>{
    selectedPersonId=null; testimonyRelationMode=null;
    restoreTestimonyGraph();
    showCharts(fullTestimonyData.edges);       // >>> 顯示全部統計
    clearTestimonyInfoPanel();
  });

  // ---------------------------
  // 身份篩選 & 還原
  // ---------------------------
  function filterAccusationGraphByIdentity(identity) {
    currentIdentityFilter = identity;
    const edgesArr = fullAccusationData.edges.filter(e => {
      const fromIdents = peopleData[e.from]?.身份 || [];
      const toIdents   = peopleData[e.to]?.身份   || [];
      return fromIdents.includes(identity) || toIdents.includes(identity);
    });
    const processed = preprocessEdges(edgesArr).map((e, i) => ({ ...e, id: e.edgeId || `edge-${i}` }));
    const nodeIds = new Set(processed.flatMap(e => [e.from, e.to]));
    const edges = new vis.DataSet(processed);
    const nodes = new vis.DataSet(
      Object.values(peopleData)
        .filter(p => nodeIds.has(p.id))
        .map(p => ({
          id:    p.id,
          label: p.姓名,
          color: Array.isArray(p.身份) && p.身份.includes(identity)
                   ? getColorByIdentity(identity)
                   : getColorByIdentity(p.身份),
          value: getNodeDegrees(processed)[p.id] || 0
        }))
    );
    accusationGraph.network.setData({ nodes, edges });
  }

  function restoreAccusationGraph() {
    currentIdentityFilter = "全部";
    const processed = preprocessEdges(fullAccusationData.edges)
      .map((e, i) => ({ ...e, id: e.edgeId || `edge-${i}` }));
    const nodeIds = new Set(processed.flatMap(e => [e.from, e.to]));
    const edges = new vis.DataSet(processed);
    const nodes = new vis.DataSet(
      Object.values(peopleData)
        .filter(p => nodeIds.has(p.id))
        .map(p => ({
          id:    p.id,
          label: p.姓名,
          color: getColorByIdentity(p.身份),
          value: getNodeDegrees(processed)[p.id] || 0
        }))
    );
    accusationGraph.network.setData({ nodes, edges });
  }

  // ---------------------------
  // 時間線篩選
  // ---------------------------
  function filterTimelineEdges(engdate) {
    updateTimelineGraph(fullTestimonyData.edges.filter(e => e.Engdate === engdate));
    clearTestimonyInfoPanel();
  }
  function updateTimelineGraph(edgesArr) {
    const edges = preprocessEdges(edgesArr).map((e, i) => ({ ...e, id: e.edgeId || `edge-${i}` }));
    const nodeIds = new Set(edges.flatMap(e => [e.from, e.to]));
    const nodes = new vis.DataSet(
      Object.values(peopleData)
        .filter(p => nodeIds.has(p.id))
        .map(p => ({
          id:    p.id,
          label: p.姓名,
          color: getColorByIdentity(p.身份),
          value: getNodeDegrees(edges)[p.id] || 0
        }))
    );
    timelineGraph.network.setData({ nodes, edges });
  }

  // ---------------------------
  // 通用按鈕綁定 (取消 reset 的 active)
  // ---------------------------
  function bindButtons(selector, handler) {
    document.querySelectorAll(selector).forEach(btn => {
      btn.addEventListener("click", () => {
        const resetBtn = document.getElementById("showAllButton");
        if (resetBtn.classList.contains("active")) {
          resetBtn.classList.remove("active");
          resetBtn.style.backgroundColor = "";
        }
        document.querySelectorAll(selector).forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        handler(btn);
      });
    });
  }

  // ---------------------------
  // 載入資料並初始化圖表
  // ---------------------------
  async function loadData() {
    peopleData = await fetchPeopleData();
    const nameToId = {};
    Object.values(peopleData).forEach(p => nameToId[p.姓名] = p.id);

    Object.values(peopleData).forEach(p => {
      if (typeof p.身份 === "string") {
        p.身份 = p.身份
          .split(/[、,]/)
          .map(s => s.trim())
          .filter(s => s);
      }
    });

    const [accRaw, tstRaw] = await Promise.all([
      fetch(`${API_BASE_URL}/api/accusation-relationships`).then(r => r.json()),
      fetch(`${API_BASE_URL}/api/testimony-relationships`).then(r => r.json())
    ]);

    const accData = convertRelationshipData(accRaw, nameToId);
    accData.edges = accData.edges.map((e, i) => ({ ...e, edgeId: `edge-${i}` }));
    fullAccusationData = accData;
    accusationGraph = drawGraph(accData, "accusationGraph", "infoPanel", handleAccusationClick, false);

    const tstData = convertRelationshipData(tstRaw, nameToId);
    tstData.edges = tstData.edges.map((e, i) => ({ ...e, edgeId: `edge-${i}` }));
    fullTestimonyData = tstData;
    testimonyGraph = drawGraph(tstData, "testimonyGraph", "infoPanelTestimony", handleTestimonyClick, true);

    timelineGraph = testimonyGraph;
    document.getElementById("testimonyBarChart").style.display   = "block"; // >>>
    document.getElementById("testimonyBubbleChart").style.display= "block"; // >>>
    updateTestimonyBarChart(fullTestimonyData.edges);                         // >>>

    document.getElementById("testimonyBarChart").style.display   = "block";
    document.getElementById("testimonyBubbleChart").style.display= "block";
    updateTestimonyBarChart(fullTestimonyData.edges);
  }

  loadData();

  // -------- 綁定身份篩選按鈕 -----------
  bindButtons(".filter-identity-button", btn => {
    const id = btn.getAttribute("data-identity");
    if (id === "全部") {
      restoreAccusationGraph();
    } else {
      filterAccusationGraphByIdentity(id);
    }
    clearAccusationInfoPanel();
  });

  // -------- 綁定證供罪名篩選按鈕 -----------
  bindButtons(".filter-testimony-button", btn => {
    const label = btn.getAttribute("data-label");
    currentTestimonyFilterLabel = label === "全部" ? "全部罪名" : btn.textContent.trim();
    let filtered;
    if (selectedPersonId && testimonyRelationMode) {
      filtered = fullTestimonyData.edges.filter(e => {
        const modeMatch = testimonyRelationMode === "accuser"
          ? e.accuser === selectedPersonId
          : Array.isArray(e.accused) && e.accused.includes(selectedPersonId);
        return modeMatch && (label === "全部" || (e.label||"").toLowerCase().includes(label.trim().toLowerCase()));
      });
      filterTestimonyEdgesByLabelForNode(label);
    } else {
      filtered = fullTestimonyData.edges.filter(e =>
        label === "全部" || (e.label||"").toLowerCase().includes(label.trim().toLowerCase())
      );
      filterTestimonyEdgesByLabelForAll(label);
    }
    if (selectedPersonId && testimonyRelationMode) {
      const barEl = document.getElementById("testimonyBarChart");
      const bubEl = document.getElementById("testimonyBubbleChart");
      if (bubEl) bubEl.style.display = "block";
      if (barEl) {
        barEl.style.display = "block";
        updateTestimonyBarChart(filtered);
      }
    }
    clearTestimonyInfoPanel();
  });

  // -------- 綁定時間線篩選按鈕 -----------
  bindButtons(".timeline-filter-button", btn => {
    filterTimelineEdges(btn.getAttribute("data-engdate"));
  });

  // -------- 證供模式按鈕 (指控者/被指控者/重置) -----------
  ["accuserButton","accusedButton","showAllButton"].forEach(id => {
    const btn = document.getElementById(id);
    btn.addEventListener("click", () => {
      if (id !== "showAllButton" && !selectedPersonId) return;
      currentTestimonyFilterLabel = "全部罪名";
      document.querySelectorAll(".filter-testimony-button").forEach(b => {
        b.classList.remove("active");
        b.style.backgroundColor = "";
      });
      ["accuserButton","accusedButton","showAllButton"].forEach(bid => {
        const b = document.getElementById(bid);
        b.classList.toggle("active", bid === id);
        b.style.backgroundColor = bid === id ? "red" : "";
      });
      if (id === "showAllButton") {
        selectedPersonId = null;
        testimonyRelationMode = null;
        restoreTestimonyGraph();
        const barEl = document.getElementById("testimonyBarChart");
        if (barEl) barEl.style.display = "none";
        const bubEl = document.getElementById("testimonyBubbleChart");
        if (bubEl) bubEl.style.display = "none";
      } else {
        testimonyRelationMode = id === "accuserButton" ? "accuser" : "被指控者";
        const filtered = fullTestimonyData.edges.filter(edge =>
          (testimonyRelationMode === "accuser"
            ? edge.accuser === selectedPersonId
            : Array.isArray(edge.accused) && edge.accused.includes(selectedPersonId))
        );
        updateTestimonyGraph(filtered);
        const barEl = document.getElementById("testimonyBarChart");
        const bubEl = document.getElementById("testimonyBubbleChart");
        if (barEl) {
          barEl.style.display = "block";
          updateTestimonyBarChart(filtered);
        }
        if (bubEl) bubEl.style.display = "block";
      }
      clearTestimonyInfoPanel();
    });
  });

});
/*************************  script.js  End  *************************/
