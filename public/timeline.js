document.addEventListener("DOMContentLoaded", function () {
    // =======================================
    // 頂部分頁導航功能（若各分頁獨立存在可選擇忽略）
    // =======================================
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
  
    // =======================================
    // 全域變數與 API 設定
    // =======================================
    const API_BASE_URL = "https://dual-graph-api.onrender.com"; // 請根據實際環境調整
    let peopleData = {};
    let fullAccusationData = {}; // 雖然 Timeline 不使用指控資料，但保留以供身份篩選使用（可根據需求移除）
    let fullTestimonyData = {};
    let accusationGraph, testimonyGraph, timelineGraph;
    let selectedPersonId = null;
    let selectedGraphType = null;
    let activeButton = null;
    let testimonyRelationMode = null;
    let testimonyDisplayMode = "normal";
  
    // =======================================
    // 放大縮小按鈕函式 (Zoom Controls)
    // =======================================
    function addZoomControls(network, container) {
      const zoomContainer = document.createElement("div");
      zoomContainer.className = "zoom-controls";
      zoomContainer.style.position = "absolute";
      zoomContainer.style.bottom = "10px";
      zoomContainer.style.right = "10px";
      zoomContainer.style.zIndex = "10";
    
      const zoomInButton = document.createElement("button");
      zoomInButton.innerHTML = '<i class="fas fa-plus"></i>';
      zoomInButton.style.margin = "2px";
      zoomInButton.style.fontSize = "20px";
      zoomInButton.style.padding = "8px 10px";
    
      const zoomOutButton = document.createElement("button");
      zoomOutButton.innerHTML = '<i class="fas fa-minus"></i>';
      zoomOutButton.style.margin = "2px";
      zoomOutButton.style.fontSize = "20px";
      zoomOutButton.style.padding = "8px 10px";
    
      zoomContainer.appendChild(zoomInButton);
      zoomContainer.appendChild(zoomOutButton);
      container.style.position = "relative";
      container.appendChild(zoomContainer);
    
      zoomInButton.addEventListener("click", () => {
        const currentScale = network.getScale();
        network.moveTo({ scale: currentScale * 1.5 });
      });
      zoomOutButton.addEventListener("click", () => {
        const currentScale = network.getScale();
        network.moveTo({ scale: currentScale / 1.5 });
      });
    }
    
    // =======================================
    // 通用輔助函式
    // =======================================
    function getColorByIdentity(identity) {
      const mapping = {
        "功臣": "#73a0fa",
        "藍玉": "#73d8fa",
        "僕役": "#cfcfcf",
        "親屬": "#cfcfcf",
        "文官": "#cfcfcf",
        "武官": "#fa73c4",
        "皇帝": "#faf573",
        "胡惟庸功臣": "#73fa9e",
        "都督": "#8e73fa"
      };
      return mapping[identity] || "#999999";
    }
    
    function preprocessEdges(edges) {
      const groups = {};
      edges.forEach(edge => {
        const key = `${edge.from}_${edge.to}`;
        if (!groups[key]) groups[key] = [];
        groups[key].push(edge);
      });
      const result = [];
      for (const key in groups) {
        const group = groups[key];
        if (group.length === 1) {
          result.push(group[0]);
        } else {
          group.forEach((edge, index) => {
            edge.smooth = {
              enabled: true,
              type: index % 2 === 1 ? "curvedCW" : "curvedCCW",
              roundness: 0.1 + index * 0.1
            };
            result.push(edge);
          });
        }
      }
      return result;
    }
    
    async function fetchPeopleData() {
      try {
        const response = await fetch(`${API_BASE_URL}/api/people`);
        const data = await response.json();
        return data.reduce((acc, person) => {
          person.id = person.id.toString();
          acc[person.id] = person;
          return acc;
        }, {});
      } catch (error) {
        console.error("❌ 無法獲取人物數據:", error);
        return {};
      }
    }
    
    function convertRelationshipData(data, nameToId) {
        data.edges = data.edges.map(edge => {
          if (edge.From && !edge.from) { edge.from = edge.From; }
          if (edge.To && !edge.to) { edge.to = edge.To; }
          if (edge.Label && !edge.label) { edge.label = edge.Label; }
          if (edge.Text && !edge.text) { edge.text = edge.Text; }
          if (edge.Reference && !edge.reference) { edge.reference = edge.Reference; }
      
          if (typeof edge.from === "string") {
            if (nameToId[edge.from]) {
              edge.from = nameToId[edge.from].toString();
            } else {
              console.warn("找不到人名 (from):", edge.from);
              edge.from = "";
            }
          }
          if (typeof edge.to === "string") {
            if (nameToId[edge.to]) {
              edge.to = nameToId[edge.to].toString();
            } else {
              console.warn("找不到人名 (to):", edge.to);
              edge.to = "";
            }
          }
          // 新增：轉換 accuser 欄位
          if (edge.accuser && typeof edge.accuser === "string") {
            if (nameToId[edge.accuser]) {
              edge.accuser = nameToId[edge.accuser].toString();
            } else {
              console.warn("找不到人名 (accuser):", edge.accuser);
              edge.accuser = "";
            }
          }
          // 新增：轉換 accused 欄位
          if (edge.accused && Array.isArray(edge.accused)) {
            edge.accused = edge.accused.map(item => {
              if (typeof item === "string") {
                if (nameToId[item]) {
                  return nameToId[item].toString();
                } else {
                  console.warn("找不到人名 (accused):", item);
                  return "";
                }
              }
              return item;
            });
          }
          return edge;
        });
        return data;
      }
    
    function getNodeDegrees(edges) {
      const degreeMap = {};
      edges.forEach(e => {
        if (!degreeMap[e.from]) degreeMap[e.from] = 0;
        degreeMap[e.from]++;
        if (!degreeMap[e.to]) degreeMap[e.to] = 0;
        degreeMap[e.to]++;
        return;
      });
      return degreeMap;
    }
    
    // =======================================
    // 繪製圖表函式（用於 Timeline 頁面）
    // =======================================
    function drawTimelineGraph(data, elementId, infoPanelId) {
      const nodesArray = data.nodes
        ? data.nodes.map(node => ({ ...node, color: getColorByIdentity(node.身份) }))
        : Object.values(peopleData).map(person => ({
            ...person,
            label: person.姓名,
            color: getColorByIdentity(person.身份)
        }));
    
      const relatedIds = new Set(data.edges.flatMap(edge => [edge.from, edge.to]));
      let filteredNodes = nodesArray.filter(node => relatedIds.has(node.id));
    
      const processedEdges = preprocessEdges(data.edges);
      const edgesWithIds = processedEdges.map((edge, index) => ({
        ...edge,
        id: edge.edgeId || `edge-${index}`,
        originalData: edge
      }));
    
      const degreeMap = getNodeDegrees(edgesWithIds);
      filteredNodes = filteredNodes.map(node => ({
        ...node,
        value: degreeMap[node.id] || 0
      }));
    
      const nodes = new vis.DataSet(filteredNodes);
      const edges = new vis.DataSet(edgesWithIds);
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
          smooth: { enabled: true, type: "dynamic", roundness: 0.2 }
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
    
      container.addEventListener("wheel", function (e) {
        if (e.ctrlKey) {
          e.preventDefault();
          const scaleFactor = 1 - e.deltaY * 0.015;
          const currentScale = network.getScale();
          const newScale = currentScale * scaleFactor;
          network.moveTo({ scale: newScale });
        }
      }, { passive: false });
    
      addZoomControls(network, container);
    
      network.on("click", function (params) {
        // Timeline 頁面只顯示節點與邊點選後的資訊
        if (params.nodes.length > 0) {
          const nodeId = params.nodes[0];
          showPersonInfo(nodeId, infoPanelId);
        } else if (params.edges.length > 0) {
          showTestimonyEdgeInfo(params.edges[0], edges.get(), infoPanelId);
        } else {
          document.getElementById(infoPanelId).innerHTML = "請雙擊人物或關係查看詳細資訊";
        }
      });
    
      return { nodes, edges, network };
    }
    
    // =======================================
    // Timeline 新功能：根據 Engdate 篩選 Timeline 邊
    // =======================================
    function filterTimelineEdges(timeStr) {
        if (timeStr === "全部") {
          // 當選擇全部時，顯示所有證供關係邊
          updateTimelineGraph(fullTestimonyData.edges);
        } else {
          // 過濾出 Date 屬性中包含所選時間字串的邊
          const filteredEdges = fullTestimonyData.edges.filter(edge => {
            // 確保 edge.Date 存在且是字串，再進行子字串比對
            return edge.Date && edge.Date.includes(timeStr);
          });
          updateTimelineGraph(filteredEdges);
        }
      }
    
    function updateTimelineGraph(edgesArr) {
      const processedEdges = preprocessEdges(edgesArr);
      const edgesWithIds = processedEdges.map((edge, index) => ({
        ...edge,
        id: edge.edgeId || `edge-${index}`,
        originalData: edge
      }));
      let allowedNodeIds = new Set();
      edgesWithIds.forEach(edge => {
        allowedNodeIds.add(edge.from);
        allowedNodeIds.add(edge.to);
      });
      const filteredNodes = Object.values(peopleData)
        .filter(person => allowedNodeIds.has(person.id))
        .map(person => ({
          ...person,
          label: person.姓名,
          color: getColorByIdentity(person.身份)
        }));
      const degreeMap = getNodeDegrees(edgesWithIds);
      const finalNodes = filteredNodes.map(node => ({
        ...node,
        value: degreeMap[node.id] || 0
      }));
      const nodes = new vis.DataSet(finalNodes);
      const edges = new vis.DataSet(edgesWithIds);
      if (timelineGraph && timelineGraph.network) {
        timelineGraph.network.setData({ nodes, edges });
      }
    }
    
    // =======================================
    // 身份篩選功能（從 script.js 抽取，並修改以作用於 Timeline 圖表）
    // =======================================
    function filterTimelineGraphByIdentity(identity) {
      // 根據身份篩選使用 fullTestimonyData 中的邊
      const allowedNodes = Object.values(peopleData)
        .filter(person => person.身份 === identity)
        .map(person => ({
          ...person,
          label: person.姓名,
          color: getColorByIdentity(person.身份)
        }));
      const allowedIds = new Set(allowedNodes.map(node => node.id));
      const filteredEdges = fullTestimonyData.edges.filter(edge => allowedIds.has(edge.to));
      const processedEdges = preprocessEdges(filteredEdges);
      const edgesWithIds = processedEdges.map((edge, index) => ({
        ...edge,
        id: edge.edgeId || `edge-${index}`,
        originalData: edge
      }));
      let allowedNodeIds = new Set();
      filteredEdges.forEach(edge => {
        allowedNodeIds.add(edge.from);
        allowedNodeIds.add(edge.to);
      });
      const filteredNodes = Object.values(peopleData)
        .filter(person => allowedNodeIds.has(person.id))
        .map(person => ({
          ...person,
          label: person.姓名,
          color: getColorByIdentity(person.身份)
        }));
      const degreeMap = getNodeDegrees(edgesWithIds);
      const finalNodes = filteredNodes.map(node => ({
        ...node,
        value: degreeMap[node.id] || 0
      }));
      const nodes = new vis.DataSet(finalNodes);
      const edges = new vis.DataSet(edgesWithIds);
      if (timelineGraph && timelineGraph.network) {
        timelineGraph.network.setData({ nodes, edges });
      }
    }
    
    function restoreTimelineGraph() {
      const nodesArray = Object.values(peopleData).map(person => ({
        ...person,
        label: person.姓名,
        color: getColorByIdentity(person.身份)
      }));
      const relatedIds = new Set(fullTestimonyData.edges.flatMap(edge => [edge.from, edge.to]));
      const filteredNodes = nodesArray.filter(node => relatedIds.has(node.id));
      const processedEdges = preprocessEdges(fullTestimonyData.edges);
      const edgesWithIds = processedEdges.map((edge, index) => ({
        ...edge,
        id: edge.edgeId || `edge-${index}`,
        originalData: edge
      }));
      const degreeMap = getNodeDegrees(edgesWithIds);
      const finalNodes = filteredNodes.map(node => ({
        ...node,
        value: degreeMap[node.id] || 0
      }));
      const nodes = new vis.DataSet(finalNodes);
      const edges = new vis.DataSet(edgesWithIds);
      if (timelineGraph && timelineGraph.network) {
        timelineGraph.network.setData({ nodes, edges });
      }
    }
    
    // =======================================
    // 共用：點選節點與邊後在資訊面板顯示資料
    // =======================================
    function showPersonInfo(nodeId, infoPanelId) {
      const infoPanel = document.getElementById(infoPanelId);
      const person = peopleData[nodeId];
      if (person) {
        infoPanel.innerHTML = `
          <h3>人物資訊</h3>
          <p><strong>名字：</strong> ${person.姓名 || ""}</p>
          <p><strong>年齡：</strong> ${person.年齡 || "-"}</p>
          <p><strong>種族：</strong> ${person.種族 || "-"}</p>
          <p><strong>籍貫：</strong> ${person.籍貫 || "-"}</p>
          <p><strong>親屬關係：</strong> ${person.親屬關係 || "-"}</p>
          <p><strong>身份：</strong> ${person.身份 || "-"}</p>
          <p><strong>職位：</strong> ${person.職位 || "-"}</p>
          <p><strong>下場：</strong> ${person.下場 || "-"}</p>
          <p><strong>原文：</strong> ${person.原文 || "-"}</p>
          <p><strong>資料來源：</strong> ${person.資料來源 || "-"}</p>
        `;
      } else {
        infoPanel.innerHTML = "<p>❌ 無法找到該人物的詳細資料。</p>";
      }
    }
    
    function showTestimonyEdgeInfo(edgeId, edgesData, infoPanelId) {
      const clickedEdge = edgesData.find(edge => edge.id.toString() === edgeId.toString());
      const infoPanel = document.getElementById(infoPanelId);
      if (clickedEdge && clickedEdge.originalData) {
        const orig = clickedEdge.originalData;
        const accuserName = orig.accuser && peopleData[orig.accuser] ? peopleData[orig.accuser].姓名 : "-";
        const accusedNames = orig.accused
          ? orig.accused.map(id => (peopleData[id] ? peopleData[id].姓名 : "-")).join("、")
          : "";
        infoPanel.innerHTML = `
          <h3>證供關係資訊</h3>
          <p><strong>關係類型：</strong> ${orig.label || "-"}</p>
          <p><strong>作供者：</strong> ${accuserName}</p>
          <p><strong>被供者：</strong> ${accusedNames}</p>
          <p><strong>發生日期：</strong> ${orig.Date || "-"}</p>
          <p><strong>說明：</strong> ${orig.Conclusion || "-"}</p>
          <p><strong>供詞原文：</strong> ${orig.Text || "-"}</p>
          <p><strong>詳細內容：</strong> ${orig.Reference || "-"}</p>
        `;
      } else {
        infoPanel.innerHTML = "<p>❌ 無法找到該證供關係的詳細資訊。</p>";
      }
    }
    
    // =======================================
    // 身份篩選：將原有篩選身份功能加入 Timeline 頁面
    // =======================================
    const identityButtons = document.querySelectorAll(".filter-identity-button");
    identityButtons.forEach(button => {
      button.addEventListener("click", function () {
        identityButtons.forEach(btn => btn.classList.remove("active"));
        this.classList.add("active");
        const identity = this.getAttribute("data-identity");
        if (identity === "全部") {
          restoreTimelineGraph();
        } else {
          filterTimelineGraphByIdentity(identity);
        }
      });
    });
    
    // =======================================
    // Timeline 篩選按鈕事件（依 Engdate 篩選）
    // =======================================
    const timelineButtons = document.querySelectorAll(".timeline-filter-button");
    timelineButtons.forEach(button => {
      button.addEventListener("click", function () {
        timelineButtons.forEach(btn => btn.classList.remove("active"));
        this.classList.add("active");
        const engdate = this.getAttribute("data-engdate");
        filterTimelineEdges(engdate);
      });
    });
    
    // =======================================
    // 資料載入與初始化
    // =======================================
    async function loadData() {
      peopleData = await fetchPeopleData();
      const nameToId = {};
      Object.keys(peopleData).forEach(id => {
        const person = peopleData[id];
        nameToId[person.姓名] = id;
      });
      // 取得證供關係資料以初始化 Timeline 圖表
      if (document.getElementById("timelineGraph")) {
        fetch(`${API_BASE_URL}/api/testimony-relationships`)
          .then(response => response.json())
          .then(data => {
            data = convertRelationshipData(data, nameToId);
            data.edges = data.edges.map((edge, index) => ({ ...edge, edgeId: `edge-${index}` }));
            fullTestimonyData = data;
            timelineGraph = drawTimelineGraph(data, "timelineGraph", "infoPanelTimeline");
          })
          .catch(error => console.error("❌ 證供關係數據載入錯誤:", error));
      }
    }
    
    loadData();
  });
