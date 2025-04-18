document.addEventListener("DOMContentLoaded", function () {

    // =======================================
  // 頂部分頁導覽功能 (Tab Navigation)
  // =======================================
  const tabButtons = document.querySelectorAll(".tab-button");
  const sections = document.querySelectorAll(".page-section");

  tabButtons.forEach(button => {
    button.addEventListener("click", () => {
      // 移除所有按鈕及頁面區塊的 active 樣式
      tabButtons.forEach(btn => btn.classList.remove("active"));
      sections.forEach(section => section.classList.remove("active"));

      // 根據所點選的按鈕顯示相應分頁（透過 data-target 屬性）
      button.classList.add("active");
      const targetId = button.getAttribute("data-target");
      document.getElementById(targetId).classList.add("active");
    });
  });

  const API_BASE_URL = "https://dual-graph-api.onrender.com";

  let peopleData = {};              // { id: person }
  let fullAccusationData = {};      // 指控關係原始數據（edges）
  let fullTestimonyData = {};       // 證供關係原始數據（edges）
  let accusationGraph, testimonyGraph;
  let selectedPersonId = null;      // 從指控關係圖選中的 node
  let selectedGraphType = null;     // "accusation" 或 "testimony"
  let activeButton = null;          // "accuser"、"accused"、"showAll"
  // 記錄目前證供關係顯示模式，可能值 "accuser" 或 "accused"
  let testimonyRelationMode = null;
  let testimonyDisplayMode = "normal";

  // ====================================================
  // 新增：放大縮小按鈕函式 (Zoom Controls)
  // ====================================================
  function addZoomControls(network, container) {
    // 建立放大縮小按鈕容器
    const zoomContainer = document.createElement("div");
    zoomContainer.className = "zoom-controls";
    zoomContainer.style.position = "absolute";
    zoomContainer.style.bottom = "10px";
    zoomContainer.style.right = "10px";
    zoomContainer.style.zIndex = "10";

    // 建立放大按鈕
    const zoomInButton = document.createElement("button");
    zoomInButton.innerHTML = '<i class="fas fa-plus"></i>';
    zoomInButton.style.margin = "2px";
    zoomInButton.style.fontSize = "20px"; // 調大字體
    zoomInButton.style.padding = "8px 10px";

    // 建立縮小按鈕
    const zoomOutButton = document.createElement("button");
    zoomOutButton.innerHTML = '<i class="fas fa-minus"></i>';
    zoomOutButton.style.margin = "2px";
    zoomOutButton.style.fontSize = "20px"; // 調大字體
    zoomOutButton.style.padding = "8px 10px";

    // 加入按鈕到容器中
    zoomContainer.appendChild(zoomInButton);
    zoomContainer.appendChild(zoomOutButton);

    // 確保容器自身為相對定位
    container.style.position = "relative";
    container.appendChild(zoomContainer);

    // 事件：放大
    zoomInButton.addEventListener("click", () => {
      const currentScale = network.getScale();
      network.moveTo({ scale: currentScale * 1.5 });
    });

    // 事件：縮小
    zoomOutButton.addEventListener("click", () => {
      const currentScale = network.getScale();
      network.moveTo({ scale: currentScale / 1.5 });
    });
  }
  // ====================================================
  // 新增區段結束
  // ====================================================

  // ---------------------------
  // 通用輔助函式
  // ---------------------------
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
      "都督": "#8e73fa",
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
      if (edge.accuser && typeof edge.accuser === "string") {
        if (nameToId[edge.accuser]) {
          edge.accuser = nameToId[edge.accuser].toString();
        } else {
          console.warn("找不到人名 (accuser):", edge.accuser);
          edge.accuser = "";
        }
      }
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
      if (e.accuser) {
        if (!degreeMap[e.accuser]) degreeMap[e.accuser] = 0;
        degreeMap[e.accuser]++;
      }
      if (e.accused && Array.isArray(e.accused)) {
        e.accused.forEach(id => {
          if (!degreeMap[id]) degreeMap[id] = 0;
          degreeMap[id]++;
        });
      }
    });
    return degreeMap;
  }

  // ---------------------------
  // 繪製網絡圖（同一函式用於指控圖與證供圖）
  // ---------------------------
  function drawGraph(data, elementId, infoPanelId, clickCallback = null, isTestimonyGraph = false) {
    const nodesArray = data.nodes
      ? data.nodes.map(node => ({ ...node, color: getColorByIdentity(node.身份) }))
      : Object.values(peopleData).map(person => ({
          ...person,
          label: person.姓名,
          color: getColorByIdentity(person.身份)
      }));

    const relatedIds = new Set(data.edges.flatMap(edge => [edge.from, edge.to, ...(edge.accused || [])]));
    let filteredNodes = nodesArray.filter(node => relatedIds.has(node.id));

    let processedEdges = data.edges;
    if (isTestimonyGraph) {
      processedEdges = preprocessEdges(data.edges);
    }
    const edgesWithIds = processedEdges.map(edge => ({
      ...edge,
      id: edge.edgeId,
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

    // 保留原先縮放功能：ctrl+滾輪縮放圖表
    container.addEventListener("wheel", function (e) {
      if (e.ctrlKey) {
        e.preventDefault();
        const scaleFactor = 1 - e.deltaY * 0.015;
        const currentScale = network.getScale();
        const newScale = currentScale * scaleFactor;
        network.moveTo({ scale: newScale });
      }
    }, { passive: false });

    // ================================
    // 新增：呼叫放大縮小按鈕函式
    // ================================
    addZoomControls(network, container);
    // ================================

    network.on("click", function (params) {
      if (isTestimonyGraph) {
        // 證供圖點擊後僅更新右側資訊，不改變目前顯示的 edges
        if (params.nodes.length > 0) {
          const nodeId = params.nodes[0];
          showPersonInfo(nodeId, infoPanelId);
        } else if (params.edges.length > 0) {
          showTestimonyEdgeInfo(params.edges[0], edges.get(), infoPanelId);
        } else {
          document.getElementById(infoPanelId).innerHTML = "請雙擊人物或關係查看詳細資訊";
        }
        return;
      }
      // 指控圖點擊處理
      if (params.nodes.length > 0) {
        const nodeId = params.nodes[0];
        selectedPersonId = nodeId;
        selectedGraphType = "accusation";
        resetButtons();
        resetTestimonyGraph();
        document.getElementById("infoPanelTestimony").innerHTML = "請點擊篩選證供關係按鈕以顯示關係";
        testimonyRelationMode = null;
        showPersonInfo(nodeId, infoPanelId);
        if (clickCallback) clickCallback(nodeId);
      } else if (params.edges.length > 0) {
        selectedPersonId = null;
        selectedGraphType = null;
        resetButtons();
        resetTestimonyGraph();
        showAccusationEdgeInfo(params.edges[0], edges.get(), infoPanelId);
      } else {
        document.getElementById(infoPanelId).innerHTML = "請雙擊人物或關係查看詳細資訊";
      }
    });
    return { nodes, edges, network };
  }

  function filterTimelineEdges(engdate) {
    const filteredEdges = fullTestimonyData.edges.filter(edge => edge.Engdate === engdate);
    updateTimelineGraph(filteredEdges);
  }
  // 更新 Timeline 圖表（與證供圖相似）
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
      if (edge.accused && Array.isArray(edge.accused)) {
        edge.accused.forEach(id => allowedNodeIds.add(id));
      }
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
    timelineGraph.network.setData({ nodes, edges });
  }

  // ---------------------------
  // 指控圖操作（保持原有功能）
  // ---------------------------
  function filterAccusationGraphByIdentity(identity) {
    // 這裡改為檢查 person.身份 是否包含所選的身份關鍵字
    const allowedToNodes = Object.values(peopleData)
      .filter(person => person.身份 && person.身份.indexOf(identity) !== -1)
      .map(person => ({
        ...person,
        label: person.姓名,
        color: getColorByIdentity(person.身份)
      }));
  
    const allowedToIds = new Set(allowedToNodes.map(node => node.id));
  
    // 過濾指控關係邊：若邊的接收者（edge.to）屬於 allowedToIds，即表示其身份符合篩選條件
    const filteredEdges = fullAccusationData.edges.filter(edge => allowedToIds.has(edge.to));
  
    const processedEdges = preprocessEdges(filteredEdges);
    const edgesWithIds = processedEdges.map((edge, index) => ({
      ...edge,
      id: edge.edgeId || `edge-${index}`,
      originalData: edge
    }));
  
    const allowedNodeIds = new Set();
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
  
    accusationGraph.network.setData({ nodes, edges });
  }

  function restoreAccusationGraph() {
    const nodesArray = Object.values(peopleData).map(person => ({
      ...person,
      label: person.姓名,
      color: getColorByIdentity(person.身份)
    }));
    const relatedIds = new Set(fullAccusationData.edges.flatMap(edge => [edge.from, edge.to, ...(edge.accused || [])]));
    const filteredNodes = nodesArray.filter(node => relatedIds.has(node.id));
    const processedEdges = preprocessEdges(fullAccusationData.edges);
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
    accusationGraph.network.setData({ nodes, edges });
  }

  // ---------------------------
  // 證供圖操作：新功能（已修改為僅顯示有 edges 連結的 nodes）
  // ---------------------------
  // 修改後：針對選定 node 模式的篩選函式，使用子字串匹配（忽略大小寫和空白）
  function filterTestimonyEdgesByLabelForNode(chosenLabel) {
    let filteredEdges;
    const keyword = chosenLabel.trim().toLowerCase();
    if (chosenLabel === "全部") {
      if (testimonyRelationMode === "accuser") {
        filteredEdges = fullTestimonyData.edges.filter(edge => edge.accuser === selectedPersonId);
      } else if (testimonyRelationMode === "accused") {
        filteredEdges = fullTestimonyData.edges.filter(edge => edge.accused && edge.accused.includes(selectedPersonId));
      }
    } else {
      if (testimonyRelationMode === "accuser") {
        filteredEdges = fullTestimonyData.edges.filter(edge =>
          edge.accuser === selectedPersonId &&
          typeof edge.label === "string" &&
          edge.label.trim().toLowerCase().indexOf(keyword) !== -1
        );
      } else if (testimonyRelationMode === "accused") {
        filteredEdges = fullTestimonyData.edges.filter(edge =>
          edge.accused && edge.accused.includes(selectedPersonId) &&
          typeof edge.label === "string" &&
          edge.label.trim().toLowerCase().indexOf(keyword) !== -1
        );
      }
    }
    updateTestimonyGraph(filteredEdges);
  }

  // 修改後：針對全局模式的篩選函式，使用子字串匹配（忽略大小寫和空白）
  function filterTestimonyEdgesByLabelForAll(chosenLabel) {
    let filteredEdges;
    const keyword = chosenLabel.trim().toLowerCase();
    if (chosenLabel === "全部") {
      filteredEdges = fullTestimonyData.edges;
    } else {
      filteredEdges = fullTestimonyData.edges.filter(edge =>
        typeof edge.label === "string" &&
        edge.label.trim().toLowerCase().indexOf(keyword) !== -1
      );
    }
    updateTestimonyGraph(filteredEdges);
  }

  // 修改重點：更新證供圖的函式，僅顯示出現在 edges（處理後）的 nodes
  function updateTestimonyGraph(edgesArr) {
    const processedEdges = preprocessEdges(edgesArr);
    const edgesWithIds = processedEdges.map((edge, index) => ({
      ...edge,
      id: edge.edgeId || `edge-${index}`,
      originalData: edge
    }));
    let allowedNodeIds = new Set();
    // 以處理後的 edgesWithIds 取得所有出現過的 node id
    edgesWithIds.forEach(edge => {
      allowedNodeIds.add(edge.from);
      allowedNodeIds.add(edge.to);
      if (edge.accused && Array.isArray(edge.accused)) {
        edge.accused.forEach(id => allowedNodeIds.add(id));
      }
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
    testimonyGraph.network.setData({ nodes, edges });
  }

  // 修改重點：恢復證供圖時，同樣僅顯示有 edges 連結的 nodes
  function restoreTestimonyGraph() {
    const processedEdges = preprocessEdges(fullTestimonyData.edges);
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
    const nodesArray = fullTestimonyData.nodes
      ? fullTestimonyData.nodes.map(node => ({ ...node, color: getColorByIdentity(node.身份) }))
      : Object.values(peopleData).map(person => ({
          ...person,
          label: person.姓名,
          color: getColorByIdentity(person.身份)
      }));
    const filteredNodes = nodesArray.filter(node => allowedNodeIds.has(node.id));
    const degreeMap = getNodeDegrees(edgesWithIds);
    const finalNodes = filteredNodes.map(node => ({
      ...node,
      value: degreeMap[node.id] || 0
    }));
    const nodes = new vis.DataSet(finalNodes);
    const edges = new vis.DataSet(edgesWithIds);
    testimonyGraph.network.setData({ nodes, edges });
  }

  // ---------------------------
  // 原有：重置與資訊顯示
  // ---------------------------
  function resetButtons() {
    activeButton = null;
    const btnIds = ["accusedButton", "accuserButton", "showAllButton"];
    btnIds.forEach(id => {
      const btn = document.getElementById(id);
      btn.classList.remove("active");
      btn.style.backgroundColor = "";
    });
  }

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

  function showAccusationEdgeInfo(edgeId, edgesData, infoPanelId) {
    const edge = edgesData.find(edge => edge.id === edgeId);
    const infoPanel = document.getElementById(infoPanelId);
    if (edge) {
      infoPanel.innerHTML = `
        <h3>指控關係資訊</h3>
        <p><strong>關係類型：</strong> ${edge.label || "-"}</p>
      `;
    } else {
      console.error("❌ 無法找到該指控關係資訊，Edge ID:", edgeId);
      infoPanel.innerHTML = "<p>❌ 無法找到該指控關係的詳細資訊。</p>";
    }
  }

  function showTestimonyEdgeInfo(edgeId, edgesData, infoPanelId) {
    console.log("DEBUG: showTestimonyEdgeInfo 被呼叫，edgeId =", edgeId);
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
      console.error("❌ 無法找到該證供關係資訊，Edge ID:", edgeId);
      infoPanel.innerHTML = "<p>❌ 無法找到該證供關係的詳細資訊。</p>";
    }
  }

  // ---------------------------
  // 證供圖 新功能：篩選按鈕事件
  // ---------------------------
  document.querySelectorAll(".filter-testimony-button").forEach(btn => {
    btn.addEventListener("click", function () {
      document.querySelectorAll(".filter-testimony-button").forEach(b => b.classList.remove("active"));
      this.classList.add("active");
      const chosenLabel = this.getAttribute("data-label");
      if (selectedPersonId && (testimonyRelationMode === "accuser" || testimonyRelationMode === "accused")) {
        filterTestimonyEdgesByLabelForNode(chosenLabel);
      } else {
        filterTestimonyEdgesByLabelForAll(chosenLabel);
      }
    });
  });

  // ---------------------------
  // 指控圖操作（保持原有功能）
  // ---------------------------
  function filterAccusationGraphByIdentity(identity) {
    const allowedToNodes = Object.values(peopleData)
      .filter(person => person.身份 === identity)
      .map(person => ({
        ...person,
        label: person.姓名,
        color: getColorByIdentity(person.身份)
      }));
    const allowedToIds = new Set(allowedToNodes.map(node => node.id));
    const filteredEdges = fullAccusationData.edges.filter(edge => allowedToIds.has(edge.to));
    const processedEdges = preprocessEdges(filteredEdges);
    const edgesWithIds = processedEdges.map((edge, index) => ({
      ...edge,
      id: edge.edgeId || `edge-${index}`,
      originalData: edge
    }));
    const allowedNodeIds = new Set();
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
    accusationGraph.network.setData({ nodes, edges });
  }

  function restoreAccusationGraph() {
    const nodesArray = Object.values(peopleData).map(person => ({
      ...person,
      label: person.姓名,
      color: getColorByIdentity(person.身份)
    }));
    const relatedIds = new Set(fullAccusationData.edges.flatMap(edge => [edge.from, edge.to, ...(edge.accused || [])]));
    const filteredNodes = nodesArray.filter(node => relatedIds.has(node.id));
    const processedEdges = preprocessEdges(fullAccusationData.edges);
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
    accusationGraph.network.setData({ nodes, edges });
  }

  // ---------------------------
  // 證供圖「作為指控者／被指控者」與「顯示所有證供關係」按鈕事件
  // ---------------------------
  document.getElementById("accusedButton").addEventListener("click", function () {
    if (!selectedPersonId) return;
    testimonyRelationMode = "accused";
    this.classList.add("active");
    this.style.backgroundColor = "red";
    document.getElementById("accuserButton").classList.remove("active");
    document.getElementById("accuserButton").style.backgroundColor = "";
    document.getElementById("showAllButton").classList.remove("active");
    document.getElementById("showAllButton").style.backgroundColor = "";
    activeButton = "accused";
    testimonyDisplayMode = "normal";
    resetTestimonyGraph();
    document.getElementById("infoPanelTestimony").innerHTML = "請點擊篩選證供關係按鈕以顯示關係";
  });

  document.getElementById("accuserButton").addEventListener("click", function () {
    if (!selectedPersonId) return;
    testimonyRelationMode = "accuser";
    this.classList.add("active");
    this.style.backgroundColor = "red";
    document.getElementById("accusedButton").classList.remove("active");
    document.getElementById("accusedButton").style.backgroundColor = "";
    document.getElementById("showAllButton").classList.remove("active");
    document.getElementById("showAllButton").style.backgroundColor = "";
    activeButton = "accuser";
    testimonyDisplayMode = "normal";
    resetTestimonyGraph();
    document.getElementById("infoPanelTestimony").innerHTML = "請點擊篩選證供關係按鈕以顯示關係";
  });

  document.getElementById("showAllButton").addEventListener("click", function () {
    selectedPersonId = null;
    selectedGraphType = null;
    testimonyRelationMode = null;
    this.classList.add("active");
    this.style.backgroundColor = "red";
    document.getElementById("accusedButton").classList.remove("active");
    document.getElementById("accusedButton").style.backgroundColor = "";
    document.getElementById("accuserButton").classList.remove("active");
    document.getElementById("accuserButton").style.backgroundColor = "";
    activeButton = "showAll";
    restoreTestimonyGraph();
  });

  // ---------------------------
  // 證供圖點擊事件：僅更新資訊面板，不更新圖數據
  // ---------------------------
  function resetTestimonyGraph() {
    const nodes = new vis.DataSet([]);
    const edges = new vis.DataSet([]);
    testimonyGraph.network.setData({ nodes, edges });
  }

  function showAllTestimonyGraphAccusedOnly() {
    testimonyDisplayMode = "allAccusedOnly";
    let accusedSet = new Set();
    fullTestimonyData.edges.forEach(edge => {
      if (edge.accused) {
        edge.accused.forEach(id => accusedSet.add(id));
      }
    });
    const nodesArray = fullTestimonyData.nodes
      ? fullTestimonyData.nodes.map(node => ({ ...node, color: getColorByIdentity(node.身份) }))
      : Object.values(peopleData).map(person => ({
          ...person,
          label: person.姓名,
          color: getColorByIdentity(person.身份)
      }));
    const filteredNodes = nodesArray.filter(node => accusedSet.has(node.id));
    let filteredEdges = fullTestimonyData.edges;
    filteredEdges = preprocessEdges(filteredEdges);
    const filteredEdgesWithIds = filteredEdges.map(edge => ({
      ...edge,
      id: edge.edgeId,
      originalData: edge
    }))
      .filter(edge => edge.accused && edge.accused.some(id => accusedSet.has(id)));
    const nodes = new vis.DataSet(filteredNodes);
    const edges = new vis.DataSet(filteredEdgesWithIds);
    testimonyGraph.network.setData({ nodes, edges });
    document.getElementById("infoPanelTestimony").innerHTML = "請點擊人物或關係查看詳細資訊";
  }

  // ---------------------------
  // 證供圖操作：新功能
  // ---------------------------
  // 修改後：針對選定 node 模式的篩選函式，使用子字串匹配（忽略大小寫和空白）
  function filterTestimonyEdgesByLabelForNode(chosenLabel) {
    let filteredEdges;
    const keyword = chosenLabel.trim().toLowerCase();
    if (chosenLabel === "全部") {
      if (testimonyRelationMode === "accuser") {
        filteredEdges = fullTestimonyData.edges.filter(edge => edge.accuser === selectedPersonId);
      } else if (testimonyRelationMode === "accused") {
        filteredEdges = fullTestimonyData.edges.filter(edge => edge.accused && edge.accused.includes(selectedPersonId));
      }
    } else {
      if (testimonyRelationMode === "accuser") {
        filteredEdges = fullTestimonyData.edges.filter(edge =>
          edge.accuser === selectedPersonId &&
          typeof edge.label === "string" &&
          edge.label.trim().toLowerCase().indexOf(keyword) !== -1
        );
      } else if (testimonyRelationMode === "accused") {
        filteredEdges = fullTestimonyData.edges.filter(edge =>
          edge.accused && edge.accused.includes(selectedPersonId) &&
          typeof edge.label === "string" &&
          edge.label.trim().toLowerCase().indexOf(keyword) !== -1
        );
      }
    }
    updateTestimonyGraph(filteredEdges);
  }

  // 修改後：針對全局模式的篩選函式，使用子字串匹配（忽略大小寫和空白）
  function filterTestimonyEdgesByLabelForAll(chosenLabel) {
    let filteredEdges;
    const keyword = chosenLabel.trim().toLowerCase();
    if (chosenLabel === "全部") {
      filteredEdges = fullTestimonyData.edges;
    } else {
      filteredEdges = fullTestimonyData.edges.filter(edge =>
        typeof edge.label === "string" &&
        edge.label.trim().toLowerCase().indexOf(keyword) !== -1
      );
    }
    updateTestimonyGraph(filteredEdges);
  }

  // 修改重點：更新證供圖函式，僅顯示出現在 edges（處理後）的 nodes，不顯示孤立的 node
  function updateTestimonyGraph(edgesArr) {
    const processedEdges = preprocessEdges(edgesArr);
    const edgesWithIds = processedEdges.map((edge, index) => ({
      ...edge,
      id: edge.edgeId || `edge-${index}`,
      originalData: edge
    }));
    // 以處理後的 edgesWithIds 取得所有出現過的 node id
    let allowedNodeIds = new Set();
    edgesWithIds.forEach(edge => {
      allowedNodeIds.add(edge.from);
      allowedNodeIds.add(edge.to);
      if (edge.accused && Array.isArray(edge.accused)) {
        edge.accused.forEach(id => allowedNodeIds.add(id));
      }
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
    testimonyGraph.network.setData({ nodes, edges });
  }

  // 修改重點：恢復證供圖時，同樣僅顯示有 edges 連結的 nodes
  function restoreTestimonyGraph() {
    const processedEdges = preprocessEdges(fullTestimonyData.edges);
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
    const nodesArray = fullTestimonyData.nodes
      ? fullTestimonyData.nodes.map(node => ({ ...node, color: getColorByIdentity(node.身份) }))
      : Object.values(peopleData).map(person => ({
          ...person,
          label: person.姓名,
          color: getColorByIdentity(person.身份)
      }));
    const filteredNodes = nodesArray.filter(node => allowedNodeIds.has(node.id));
    const degreeMap = getNodeDegrees(edgesWithIds);
    const finalNodes = filteredNodes.map(node => ({
      ...node,
      value: degreeMap[node.id] || 0
    }));
    const nodes = new vis.DataSet(finalNodes);
    const edges = new vis.DataSet(edgesWithIds);
    testimonyGraph.network.setData({ nodes, edges });
  }

  // ---------------------------
  // 原有：重置與資訊顯示
  // ---------------------------
  function resetButtons() {
    activeButton = null;
    const btnIds = ["accusedButton", "accuserButton", "showAllButton"];
    btnIds.forEach(id => {
      const btn = document.getElementById(id);
      btn.classList.remove("active");
      btn.style.backgroundColor = "";
    });
  }

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

  function showAccusationEdgeInfo(edgeId, edgesData, infoPanelId) {
    const edge = edgesData.find(edge => edge.id === edgeId);
    const infoPanel = document.getElementById(infoPanelId);
    if (edge) {
      infoPanel.innerHTML = `
        <h3>指控關係資訊</h3>
        <p><strong>關係類型：</strong> ${edge.label || "-"}</p>
      `;
    } else {
      console.error("❌ 無法找到該指控關係資訊，Edge ID:", edgeId);
      infoPanel.innerHTML = "<p>❌ 無法找到該指控關係的詳細資訊。</p>";
    }
  }

  function showTestimonyEdgeInfo(edgeId, edgesData, infoPanelId) {
    console.log("DEBUG: showTestimonyEdgeInfo 被呼叫，edgeId =", edgeId);
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
      console.error("❌ 無法找到該證供關係資訊，Edge ID:", edgeId);
      infoPanel.innerHTML = "<p>❌ 無法找到該證供關係的詳細資訊。</p>";
    }
  }

  // ---------------------------
  // 證供圖 新功能：篩選按鈕事件
  // ---------------------------
  document.querySelectorAll(".filter-testimony-button").forEach(btn => {
    btn.addEventListener("click", function () {
      document.querySelectorAll(".filter-testimony-button").forEach(b => b.classList.remove("active"));
      this.classList.add("active");
      const chosenLabel = this.getAttribute("data-label");
      if (selectedPersonId && (testimonyRelationMode === "accuser" || testimonyRelationMode === "accused")) {
        filterTestimonyEdgesByLabelForNode(chosenLabel);
      } else {
        filterTestimonyEdgesByLabelForAll(chosenLabel);
      }
    });
  });

  // ---------------------------
  // 指控圖操作（保持原有功能）
  // ---------------------------
  function filterAccusationGraphByIdentity(identity) {
    const allowedToNodes = Object.values(peopleData)
      .filter(person => person.身份 === identity)
      .map(person => ({
        ...person,
        label: person.姓名,
        color: getColorByIdentity(person.身份)
      }));
    const allowedToIds = new Set(allowedToNodes.map(node => node.id));
    const filteredEdges = fullAccusationData.edges.filter(edge => allowedToIds.has(edge.to));
    const processedEdges = preprocessEdges(filteredEdges);
    const edgesWithIds = processedEdges.map((edge, index) => ({
      ...edge,
      id: edge.edgeId || `edge-${index}`,
      originalData: edge
    }));
    const allowedNodeIds = new Set();
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
    accusationGraph.network.setData({ nodes, edges });
  }

  function restoreAccusationGraph() {
    const nodesArray = Object.values(peopleData).map(person => ({
      ...person,
      label: person.姓名,
      color: getColorByIdentity(person.身份)
    }));
    const relatedIds = new Set(fullAccusationData.edges.flatMap(edge => [edge.from, edge.to, ...(edge.accused || [])]));
    const filteredNodes = nodesArray.filter(node => relatedIds.has(node.id));
    const processedEdges = preprocessEdges(fullAccusationData.edges);
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
    accusationGraph.network.setData({ nodes, edges });
  }

  // ---------------------------
  // 證供圖操作：新功能
  // ---------------------------
  // 修改後：針對選定 node 模式的篩選函式，使用子字串匹配（忽略大小寫和空白）
  function filterTestimonyEdgesByLabelForNode(chosenLabel) {
    let filteredEdges;
    const keyword = chosenLabel.trim().toLowerCase();
    if (chosenLabel === "全部") {
      if (testimonyRelationMode === "accuser") {
        filteredEdges = fullTestimonyData.edges.filter(edge => edge.accuser === selectedPersonId);
      } else if (testimonyRelationMode === "accused") {
        filteredEdges = fullTestimonyData.edges.filter(edge => edge.accused && edge.accused.includes(selectedPersonId));
      }
    } else {
      if (testimonyRelationMode === "accuser") {
        filteredEdges = fullTestimonyData.edges.filter(edge =>
          edge.accuser === selectedPersonId &&
          typeof edge.label === "string" &&
          edge.label.trim().toLowerCase().indexOf(keyword) !== -1
        );
      } else if (testimonyRelationMode === "accused") {
        filteredEdges = fullTestimonyData.edges.filter(edge =>
          edge.accused && edge.accused.includes(selectedPersonId) &&
          typeof edge.label === "string" &&
          edge.label.trim().toLowerCase().indexOf(keyword) !== -1
        );
      }
    }
    updateTestimonyGraph(filteredEdges);
  }

  // 修改後：針對全局模式的篩選函式，使用子字串匹配（忽略大小寫和空白）
  function filterTestimonyEdgesByLabelForAll(chosenLabel) {
    let filteredEdges;
    const keyword = chosenLabel.trim().toLowerCase();
    if (chosenLabel === "全部") {
      filteredEdges = fullTestimonyData.edges;
    } else {
      filteredEdges = fullTestimonyData.edges.filter(edge =>
        typeof edge.label === "string" &&
        edge.label.trim().toLowerCase().indexOf(keyword) !== -1
      );
    }
    updateTestimonyGraph(filteredEdges);
  }

  // ---------------------------
  // 更新證供圖函式：僅顯示有 edges 連結的 nodes
  // ---------------------------
  function updateTestimonyGraph(edgesArr) {
    const processedEdges = preprocessEdges(edgesArr);
    const edgesWithIds = processedEdges.map((edge, index) => ({
      ...edge,
      id: edge.edgeId || `edge-${index}`,
      originalData: edge
    }));
    // 以處理後的 edgesWithIds 取得所有出現過的 node id
    let allowedNodeIds = new Set();
    edgesWithIds.forEach(edge => {
      allowedNodeIds.add(edge.from);
      allowedNodeIds.add(edge.to);
      if (edge.accused && Array.isArray(edge.accused)) {
        edge.accused.forEach(id => allowedNodeIds.add(id));
      }
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
    testimonyGraph.network.setData({ nodes, edges });
  }

  // 恢復證供圖函式：同樣僅顯示有 edges 連結的 nodes
  function restoreTestimonyGraph() {
    const processedEdges = preprocessEdges(fullTestimonyData.edges);
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
    const nodesArray = fullTestimonyData.nodes
      ? fullTestimonyData.nodes.map(node => ({ ...node, color: getColorByIdentity(node.身份) }))
      : Object.values(peopleData).map(person => ({
          ...person,
          label: person.姓名,
          color: getColorByIdentity(person.身份)
      }));
    const filteredNodes = nodesArray.filter(node => allowedNodeIds.has(node.id));
    const degreeMap = getNodeDegrees(edgesWithIds);
    const finalNodes = filteredNodes.map(node => ({
      ...node,
      value: degreeMap[node.id] || 0
    }));
    const nodes = new vis.DataSet(finalNodes);
    const edges = new vis.DataSet(edgesWithIds);
    testimonyGraph.network.setData({ nodes, edges });
  }

  // ---------------------------
  // 原有：重置與資訊顯示
  // ---------------------------
  function resetButtons() {
    activeButton = null;
    const btnIds = ["accusedButton", "accuserButton", "showAllButton"];
    btnIds.forEach(id => {
      const btn = document.getElementById(id);
      btn.classList.remove("active");
      btn.style.backgroundColor = "";
    });
  }

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

  function showAccusationEdgeInfo(edgeId, edgesData, infoPanelId) {
    const edge = edgesData.find(edge => edge.id === edgeId);
    const infoPanel = document.getElementById(infoPanelId);
    if (edge) {
      infoPanel.innerHTML = `
        <h3>指控關係資訊</h3>
        <p><strong>關係類型：</strong> ${edge.label || "-"}</p>
      `;
    } else {
      console.error("❌ 無法找到該指控關係資訊，Edge ID:", edgeId);
      infoPanel.innerHTML = "<p>❌ 無法找到該指控關係的詳細資訊。</p>";
    }
  }

  function showTestimonyEdgeInfo(edgeId, edgesData, infoPanelId) {
    console.log("DEBUG: showTestimonyEdgeInfo 被呼叫，edgeId =", edgeId);
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
      console.error("❌ 無法找到該證供關係資訊，Edge ID:", edgeId);
      infoPanel.innerHTML = "<p>❌ 無法找到該證供關係的詳細資訊。</p>";
    }
  }

  // ---------------------------
  // 證供圖 新功能：篩選按鈕事件
  // ---------------------------
  document.querySelectorAll(".filter-testimony-button").forEach(btn => {
    btn.addEventListener("click", function () {
      document.querySelectorAll(".filter-testimony-button").forEach(b => b.classList.remove("active"));
      this.classList.add("active");
      const chosenLabel = this.getAttribute("data-label");
      if (selectedPersonId && (testimonyRelationMode === "accuser" || testimonyRelationMode === "accused")) {
        filterTestimonyEdgesByLabelForNode(chosenLabel);
      } else {
        filterTestimonyEdgesByLabelForAll(chosenLabel);
      }
    });
  });

  // ---------------------------
  // 指控圖操作（保持原有功能）
  // ---------------------------
  function filterAccusationGraphByIdentity(identity) {
    const allowedToNodes = Object.values(peopleData)
      .filter(person => person.身份 === identity)
      .map(person => ({
        ...person,
        label: person.姓名,
        color: getColorByIdentity(person.身份)
      }));
    const allowedToIds = new Set(allowedToNodes.map(node => node.id));
    const filteredEdges = fullAccusationData.edges.filter(edge => allowedToIds.has(edge.to));
    const processedEdges = preprocessEdges(filteredEdges);
    const edgesWithIds = processedEdges.map((edge, index) => ({
      ...edge,
      id: edge.edgeId || `edge-${index}`,
      originalData: edge
    }));
    const allowedNodeIds = new Set();
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
    accusationGraph.network.setData({ nodes, edges });
  }

  function restoreAccusationGraph() {
    const nodesArray = Object.values(peopleData).map(person => ({
      ...person,
      label: person.姓名,
      color: getColorByIdentity(person.身份)
    }));
    const relatedIds = new Set(fullAccusationData.edges.flatMap(edge => [edge.from, edge.to, ...(edge.accused || [])]));
    const filteredNodes = nodesArray.filter(node => relatedIds.has(node.id));
    const processedEdges = preprocessEdges(fullAccusationData.edges);
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
    accusationGraph.network.setData({ nodes, edges });
  }

  // ---------------------------
  // 證供圖操作：新功能（已修改為僅顯示有 edges 連結的 nodes）
  // ---------------------------
  function filterTestimonyEdgesByLabelForNode(chosenLabel) {
    let filteredEdges;
    const keyword = chosenLabel.trim().toLowerCase();
    if (chosenLabel === "全部") {
      if (testimonyRelationMode === "accuser") {
        filteredEdges = fullTestimonyData.edges.filter(edge => edge.accuser === selectedPersonId);
      } else if (testimonyRelationMode === "accused") {
        filteredEdges = fullTestimonyData.edges.filter(edge => edge.accused && edge.accused.includes(selectedPersonId));
      }
    } else {
      if (testimonyRelationMode === "accuser") {
        filteredEdges = fullTestimonyData.edges.filter(edge =>
          edge.accuser === selectedPersonId &&
          typeof edge.label === "string" &&
          edge.label.trim().toLowerCase().indexOf(keyword) !== -1
        );
      } else if (testimonyRelationMode === "accused") {
        filteredEdges = fullTestimonyData.edges.filter(edge =>
          edge.accused && edge.accused.includes(selectedPersonId) &&
          typeof edge.label === "string" &&
          edge.label.trim().toLowerCase().indexOf(keyword) !== -1
        );
      }
    }
    updateTestimonyGraph(filteredEdges);
  }

  function filterTestimonyEdgesByLabelForAll(chosenLabel) {
    let filteredEdges;
    const keyword = chosenLabel.trim().toLowerCase();
    if (chosenLabel === "全部") {
      filteredEdges = fullTestimonyData.edges;
    } else {
      filteredEdges = fullTestimonyData.edges.filter(edge =>
        typeof edge.label === "string" &&
        edge.label.trim().toLowerCase().indexOf(keyword) !== -1
      );
    }
    updateTestimonyGraph(filteredEdges);
  }

  // ---------------------------
  // 重置與資訊顯示（原有）
  // ---------------------------
  function resetButtons() {
    activeButton = null;
    const btnIds = ["accusedButton", "accuserButton", "showAllButton"];
    btnIds.forEach(id => {
      const btn = document.getElementById(id);
      btn.classList.remove("active");
      btn.style.backgroundColor = "";
    });
  }

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

  function showAccusationEdgeInfo(edgeId, edgesData, infoPanelId) {
    const edge = edgesData.find(edge => edge.id === edgeId);
    const infoPanel = document.getElementById(infoPanelId);
    if (edge) {
      infoPanel.innerHTML = `
        <h3>指控關係資訊</h3>
        <p><strong>關係類型：</strong> ${edge.label || "-"}</p>
      `;
    } else {
      console.error("❌ 無法找到該指控關係資訊，Edge ID:", edgeId);
      infoPanel.innerHTML = "<p>❌ 無法找到該指控關係的詳細資訊。</p>";
    }
  }

  function showTestimonyEdgeInfo(edgeId, edgesData, infoPanelId) {
    console.log("DEBUG: showTestimonyEdgeInfo 被呼叫，edgeId =", edgeId);
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
      console.error("❌ 無法找到該證供關係資訊，Edge ID:", edgeId);
      infoPanel.innerHTML = "<p>❌ 無法找到該證供關係的詳細資訊。</p>";
    }
  }

  // ---------------------------
  // 證供圖 新功能：篩選按鈕事件
  // ---------------------------
  document.querySelectorAll(".filter-testimony-button").forEach(btn => {
    btn.addEventListener("click", function () {
      document.querySelectorAll(".filter-testimony-button").forEach(b => b.classList.remove("active"));
      this.classList.add("active");
      const chosenLabel = this.getAttribute("data-label");
      if (selectedPersonId && (testimonyRelationMode === "accuser" || testimonyRelationMode === "accused")) {
        filterTestimonyEdgesByLabelForNode(chosenLabel);
      } else {
        filterTestimonyEdgesByLabelForAll(chosenLabel);
      }
    }); 
  });

  // ---------------------------
  // 指控圖操作（保持原有功能）
  // ---------------------------
  function filterAccusationGraphByIdentity(identity) {
    const allowedToNodes = Object.values(peopleData)
      .filter(person => person.身份 === identity)
      .map(person => ({
        ...person,
        label: person.姓名,
        color: getColorByIdentity(person.身份)
      }));
    const allowedToIds = new Set(allowedToNodes.map(node => node.id));
    const filteredEdges = fullAccusationData.edges.filter(edge => allowedToIds.has(edge.to));
    const processedEdges = preprocessEdges(filteredEdges);
    const edgesWithIds = processedEdges.map((edge, index) => ({
      ...edge,
      id: edge.edgeId || `edge-${index}`,
      originalData: edge
    }));
    const allowedNodeIds = new Set();
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
    accusationGraph.network.setData({ nodes, edges });
  }

  function restoreAccusationGraph() {
    const nodesArray = Object.values(peopleData).map(person => ({
      ...person,
      label: person.姓名,
      color: getColorByIdentity(person.身份)
    }));
    const relatedIds = new Set(fullAccusationData.edges.flatMap(edge => [edge.from, edge.to, ...(edge.accused || [])]));
    const filteredNodes = nodesArray.filter(node => relatedIds.has(node.id));
    const processedEdges = preprocessEdges(fullAccusationData.edges);
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
    accusationGraph.network.setData({ nodes, edges });
  }

  async function loadData() {
    peopleData = await fetchPeopleData();
    console.log("✅ 人物數據加載完成:", peopleData);
    const nameToId = {};
    Object.keys(peopleData).forEach(id => {
      const person = peopleData[id];
      nameToId[person.姓名] = id;
    });
    // 取得指控關係資料
    fetch(`${API_BASE_URL}/api/accusation-relationships`)
      .then(response => response.json())
      .then(data => {
        data = convertRelationshipData(data, nameToId);
        data.edges = data.edges.map((edge, index) => ({ ...edge, edgeId: `edge-${index}` }));
        fullAccusationData = data;
        accusationGraph = drawGraph(data, "accusationGraph", "infoPanel", null, false);
      })
      .catch(error => console.error("❌ 指控關係數據載入錯誤:", error));
    // 取得證供關係資料
    fetch(`${API_BASE_URL}/api/testimony-relationships`)
      .then(response => response.json())
      .then(data => {
        data = convertRelationshipData(data, nameToId);
        data.edges = data.edges.map((edge, index) => ({ ...edge, edgeId: `edge-${index}` }));
        fullTestimonyData = data;
        testimonyGraph = drawGraph(data, "testimonyGraph", "infoPanelTestimony", null, true);
      })
      .catch(error => console.error("❌ 證供關係數據載入錯誤:", error));
  }

  loadData();

  const identityButtons = document.querySelectorAll(".filter-identity-button");
  identityButtons.forEach(button => {
    button.addEventListener("click", function () {
      identityButtons.forEach(btn => btn.classList.remove("active"));
      this.classList.add("active");
      const identity = this.getAttribute("data-identity");
      if (identity === "全部") {
        restoreAccusationGraph();
      } else {
        filterAccusationGraphByIdentity(identity);
      }
    });
  });

  const testimonyButtons = document.querySelectorAll(".filter-testimony-button");
  testimonyButtons.forEach(button => {
    button.addEventListener("click", function () {
      testimonyButtons.forEach(btn => btn.classList.remove("active"));
      this.classList.add("active");
      const chosenLabel = this.getAttribute("data-label");
      if (selectedPersonId && (testimonyRelationMode === "accuser" || testimonyRelationMode === "accused")) {
        filterTestimonyEdgesByLabelForNode(chosenLabel);
      } else {
        filterTestimonyEdgesByLabelForAll(chosenLabel);
      }
    });
  });
    // 新增：Timeline 頁面上的時間線按鈕事件
    const timelineButtons = document.querySelectorAll(".timeline-filter-button");
    timelineButtons.forEach(button => {
      button.addEventListener("click", function () {
        // 清除其它 timeline 按鈕 active 樣式（如有多個）
        timelineButtons.forEach(btn => btn.classList.remove("active"));
        this.classList.add("active");
        // 根據 data-engdate 屬性進行過濾
        const engdate = this.getAttribute("data-engdate");
        filterTimelineEdges(engdate);
      });
    });
});
