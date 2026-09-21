/**
 * 智光商工115學年度新生繡學號管理系統 - 核心邏輯腳本
 * 工作流程：先點選同學姓名 -> 立即出現專屬要繡什麼衣服的品項與收費登記面板
 * 支援 31 位學生名冊、自動算費、即時搜尋與催繳篩選、資料自動儲存、A4列印與 CSV 匯出匯入
 */

// 品項單價與定義 (依據 03 PDF 官方規範)
const ITEM_PRICES = {
  item1: 55, // 夏季短袖制服上衣
  item2: 55, // 冬季長袖制服上衣
  item3: 55, // 夏季短袖運動上衣
  item4: 55, // 冬季長袖運動上衣
  item5: 55, // 各科實習服
  item6: 55, // 帽子
  item7: 65  // 冬季棒球運動外套
};

const ITEM_META = {
  item1: { short: "短袖制服", full: "夏季短袖制服上衣", price: 55, icon: "👕" },
  item2: { short: "長袖制服", full: "冬季長袖制服上衣", price: 55, icon: "👔" },
  item3: { short: "短袖運動", full: "夏季短袖運動上衣", price: 55, icon: "🎽" },
  item4: { short: "長袖運動", full: "冬季長袖運動上衣", price: 55, icon: "🏃" },
  item5: { short: "實習服", full: "各科實習服", price: 55, icon: "🥼" },
  item6: { short: "帽子", full: "帽子", price: 55, icon: "🧢" },
  item7: { short: "棒球外套", full: "冬季棒球運動外套", price: 65, icon: "🧥", highlight: true }
};

const TOTAL_STUDENTS = 31; // 官方 03 收費明細表固定 31 人

// 系統核心資料狀態
let appData = {
  className: "資處一仁",
  leaderSign: "",
  affairsSign: "",
  tutorSign: "",
  students: []
};

// 介面與篩選狀態
let currentViewMode = "picker"; // 'picker' (選人登記模式) 或 'table' (完整試算表)
let searchKeyword = "";
let statusFilter = "all";       // 'all' | 'unpaid' | 'paid'
let selectedSeat = 1;           // 當前選中正在登記衣服的學生座號 (1~31)

// 初始化預設 31 位學生名單
function initDefaultStudents() {
  const students = [];
  for (let i = 1; i <= TOTAL_STUDENTS; i++) {
    students.push({
      seat: i,
      name: "",
      studentId: "",
      item1: 0,
      item2: 0,
      item3: 0,
      item4: 0,
      item5: 0,
      item6: 0,
      item7: 0,
      paid: false,
      sign: ""
    });
  }
  return students;
}

// 載入 LocalStorage 儲存之資料
function loadSavedData() {
  try {
    const saved = localStorage.getItem("ck_embroidery_data_v1");
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && typeof parsed === "object") {
        appData.className = parsed.className || "資處一仁";
        if (appData.className === "資處一甲") appData.className = "資處一仁";
        appData.leaderSign = parsed.leaderSign || "";
        appData.affairsSign = parsed.affairsSign || "";
        appData.tutorSign = parsed.tutorSign || "";
        if (Array.isArray(parsed.students) && parsed.students.length > 0) {
          appData.students = parsed.students;
        } else {
          appData.students = initDefaultStudents();
        }
      } else {
        appData.students = initDefaultStudents();
      }
      while (appData.students.length < TOTAL_STUDENTS) {
        const nextSeat = appData.students.length + 1;
        appData.students.push({
          seat: nextSeat,
          name: "",
          studentId: "",
          item1: 0,
          item2: 0,
          item3: 0,
          item4: 0,
          item5: 0,
          item6: 0,
          item7: 0,
          paid: false,
          sign: ""
        });
      }
    } else {
      appData.students = initDefaultStudents();
    }
  } catch (e) {
    console.error("載入本機儲存失敗，使用預設值", e);
    appData = {
      className: "資處一仁",
      leaderSign: "",
      affairsSign: "",
      tutorSign: "",
      students: initDefaultStudents()
    };
  }
}

// 儲存至 LocalStorage
function saveData() {
  try {
    localStorage.setItem("ck_embroidery_data_v1", JSON.stringify(appData));
  } catch (e) {
    console.error("儲存失敗", e);
  }
}

// 計算單一學生金額與總件數
function calculateStudentTotal(student) {
  let total = 0;
  let count = 0;
  for (let key in ITEM_PRICES) {
    const qty = parseInt(student[key] || 0, 10);
    total += qty * ITEM_PRICES[key];
    count += qty;
  }
  return { total, count };
}

// -------------------------------------------------------------
// 模式切換：選人登記模式 (picker) vs 完整試算表 (table)
// -------------------------------------------------------------
function switchViewMode(mode) {
  currentViewMode = mode;
  const btnPicker = document.getElementById("btnViewPicker");
  const btnTable = document.getElementById("btnViewTable");
  const pickerGrid = document.getElementById("studentPickerGrid");
  const tableCard = document.getElementById("tableViewCard");
  const mobileToggleBtn = document.getElementById("mobileToggleModeBtn");

  if (mode === "picker") {
    if (btnPicker) btnPicker.classList.add("active");
    if (btnTable) btnTable.classList.remove("active");
    if (pickerGrid) pickerGrid.style.display = "grid";
    if (tableCard) tableCard.classList.add("view-hidden");
    if (mobileToggleBtn) mobileToggleBtn.innerHTML = "📊 轉表格";
  } else {
    if (btnPicker) btnPicker.classList.remove("active");
    if (btnTable) btnTable.classList.add("active");
    if (pickerGrid) pickerGrid.style.display = "none";
    if (tableCard) tableCard.classList.remove("view-hidden");
    if (mobileToggleBtn) mobileToggleBtn.innerHTML = "👤 選同學";
  }
}

function quickToggleViewMode() {
  switchViewMode(currentViewMode === "picker" ? "table" : "picker");
}

// -------------------------------------------------------------
// 搜尋與篩選邏輯
// -------------------------------------------------------------
function handleStudentSearch(val) {
  searchKeyword = (val || "").trim().toLowerCase();
  const clearBtn = document.getElementById("clearSearchBtn");
  if (clearBtn) clearBtn.style.display = searchKeyword ? "flex" : "none";
  renderAll();
}

function clearSearch() {
  const input = document.getElementById("studentSearchInput");
  if (input) input.value = "";
  handleStudentSearch("");
}

function setStatusFilter(filter) {
  statusFilter = filter;
  document.querySelectorAll(".status-filter-chip").forEach(chip => {
    if (chip.getAttribute("data-filter") === filter) {
      chip.classList.add("active");
    } else {
      chip.classList.remove("active");
    }
  });
  renderAll();
}

function checkStudentFilterMatch(student) {
  if (statusFilter === "unpaid" && student.paid) return false;
  if (statusFilter === "paid" && !student.paid) return false;

  if (searchKeyword) {
    const seatStr = String(student.seat);
    const seatPad = student.seat < 10 ? `0${student.seat}` : `${student.seat}`;
    const nameStr = (student.name || "").toLowerCase();
    const idStr = (student.studentId || "").toLowerCase();

    if (!seatStr.includes(searchKeyword) &&
        !seatPad.includes(searchKeyword) &&
        !nameStr.includes(searchKeyword) &&
        !idStr.includes(searchKeyword)) {
      return false;
    }
  }
  return true;
}

// -------------------------------------------------------------
// 👤 第一步：渲染 31 位同學點選名冊 (一排 6 個)
// -------------------------------------------------------------
function renderStudentPickerGrid() {
  const container = document.getElementById("studentPickerGrid");
  if (!container) return;
  container.innerHTML = "";

  let matchedCount = 0;

  appData.students.forEach((student, index) => {
    const isMatch = checkStudentFilterMatch(student);
    if (!isMatch) return;

    matchedCount++;
    const calc = calculateStudentTotal(student);
    const seatPad = student.seat < 10 ? `0${student.seat}` : `${student.seat}`;
    const displayName = student.name ? escapeHtml(student.name) : "未填";

    let statusClass = "empty";
    let statusBadgeHtml = `<span class="grid-status-txt empty">-</span>`;

    if (student.paid) {
      statusClass = "paid";
      statusBadgeHtml = `<span class="grid-status-txt paid">✅ $${calc.total}</span>`;
    } else if (calc.total > 0) {
      statusClass = "unpaid-items";
      statusBadgeHtml = `<span class="grid-status-txt unpaid">⚠️ $${calc.total}</span>`;
    }

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `student-grid-cell ${statusClass} ${student.seat === selectedSeat ? 'is-selected' : ''}`;
    btn.id = `picker-item-${student.seat}`;
    btn.onclick = () => openClothesPicker(student.seat);
    btn.title = `座號 ${student.seat}：${student.name || '未填姓名'} (點擊選衣服)`;

    btn.innerHTML = `
      <div class="cell-seat-tag">${seatPad}</div>
      <div class="cell-name-txt">${displayName}</div>
      <div class="cell-badge-row">${statusBadgeHtml}</div>
    `;

    container.appendChild(btn);
  });

  if (matchedCount === 0) {
    container.innerHTML = `
      <div class="empty-search-state">
        <div class="empty-icon">🔍</div>
        <h3>查無符合條件的學生</h3>
        <p>找不到符合「${escapeHtml(searchKeyword || '篩選條件')}」的名單，請嘗試更換關鍵字或點選「全部」。</p>
        <button type="button" class="btn btn-secondary btn-sm" onclick="clearSearch(); setStatusFilter('all');">重設搜尋條件</button>
      </div>
    `;
  }
}

// -------------------------------------------------------------
// 👕 第二步：開啟專屬衣服選擇面板 (Clothes Picker Drawer)
// -------------------------------------------------------------
function openClothesPicker(seat) {
  selectedSeat = seat;
  const drawer = document.getElementById("clothesPickerDrawer");
  if (!drawer) return;

  drawer.style.display = "flex";
  document.body.style.overflow = "hidden"; // 防止背景滾動

  renderSelectedStudentClothes();
  highlightPickerCard(seat);
}

function closeClothesPicker() {
  commitCurrentSheetInputs(); // 關閉前確認當前學生姓名已存檔
  const drawer = document.getElementById("clothesPickerDrawer");
  if (drawer) {
    drawer.style.display = "none";
  }
  document.body.style.overflow = "";
  renderAll(); // 關閉時重新整理列表
}

function handleOverlayClick(event) {
  if (event.target.id === "clothesPickerDrawer") {
    closeClothesPicker();
  }
}

function highlightPickerCard(seat) {
  document.querySelectorAll(".student-grid-cell").forEach(c => c.classList.remove("is-selected"));
  const targetCard = document.getElementById(`picker-item-${seat}`);
  if (targetCard) {
    targetCard.classList.add("is-selected");
  }
}

// 渲染當前選中學生的衣服清單
function renderSelectedStudentClothes() {
  const student = appData.students[selectedSeat - 1];
  if (!student) return;

  const calc = calculateStudentTotal(student);
  const seatPad = student.seat < 10 ? `0${student.seat}` : `${student.seat}`;

  // 表頭資訊
  const seatBadge = document.getElementById("sheetSeatBadge");
  const nameInput = document.getElementById("sheetStudentName");
  const idInput = document.getElementById("sheetStudentId");
  if (seatBadge) seatBadge.textContent = `#${seatPad}`;
  if (nameInput) nameInput.value = student.name || "";
  if (idInput) idInput.value = student.studentId || "";

  // 費用與件數
  const totalAmount = document.getElementById("sheetTotalAmount");
  const totalQty = document.getElementById("sheetTotalQty");
  if (totalAmount) totalAmount.textContent = `$${calc.total}`;
  if (totalQty) totalQty.textContent = `(共 ${calc.count} 件)`;

  // 繳費按鈕狀態
  const paidBtn = document.getElementById("sheetPaidBtn");
  if (paidBtn) {
    if (student.paid) {
      paidBtn.className = "sheet-paid-btn paid";
      paidBtn.innerHTML = `✅ 已繳費 $${calc.total}`;
    } else {
      paidBtn.className = "sheet-paid-btn unpaid";
      paidBtn.innerHTML = `⬜ 點擊標記為已繳費`;
    }
  }

  // 換人按鈕名稱提示
  const prevSeat = selectedSeat > 1 ? selectedSeat - 1 : TOTAL_STUDENTS;
  const nextSeat = selectedSeat < TOTAL_STUDENTS ? selectedSeat + 1 : 1;
  const prevStudent = appData.students[prevSeat - 1];
  const nextStudent = appData.students[nextSeat - 1];
  const btnPrev = document.getElementById("btnPrevStudent");
  const btnNext = document.getElementById("btnNextStudent");
  if (btnPrev) btnPrev.textContent = `⬅ 上一位 (#${prevSeat} ${prevStudent.name || ''})`;
  if (btnNext) btnNext.textContent = `下一位 (#${nextSeat} ${nextStudent.name || ''}) ➡`;

  // 渲染 7 種衣服品項步進器
  const itemsContainer = document.getElementById("sheetItemsList");
  if (!itemsContainer) return;
  itemsContainer.innerHTML = "";

  for (let key in ITEM_META) {
    const meta = ITEM_META[key];
    const qty = parseInt(student[key] || 0, 10);
    const subtotal = qty * meta.price;
    const isHigh = meta.highlight ? "highlight-jacket" : "";

    const itemRow = document.createElement("div");
    itemRow.className = `sheet-item-row ${qty > 0 ? 'has-qty' : ''}`;
    itemRow.innerHTML = `
      <div class="sheet-item-left">
        <span class="sheet-item-icon">${meta.icon}</span>
        <div class="sheet-item-text">
          <div class="sheet-item-main-title">
            ${meta.full}
            <span class="sheet-item-unit-price ${isHigh}">$${meta.price}</span>
          </div>
          <div class="sheet-item-subtotal">小計：<b>$${subtotal}</b></div>
        </div>
      </div>
      <div class="sheet-item-stepper">
        <button type="button" class="sheet-step-btn minus" onclick="stepQtyForSelected('${key}', -1)" aria-label="減少一件">-</button>
        <input type="number" min="0" max="20" class="sheet-step-val ${qty > 0 ? 'active' : ''}" value="${qty}" onchange="setQtyForSelected('${key}', this.value)">
        <button type="button" class="sheet-step-btn plus" onclick="stepQtyForSelected('${key}', 1)" aria-label="增加一件">+</button>
      </div>
    `;
    itemsContainer.appendChild(itemRow);
  }
}

// 調整當前選中學生的衣服數量
function stepQtyForSelected(itemKey, delta) {
  const student = appData.students[selectedSeat - 1];
  let current = parseInt(student[itemKey] || 0, 10);
  current = Math.max(0, current + delta);
  student[itemKey] = current;
  saveData();
  renderSelectedStudentClothes();
  updateGlobalStatsOnly();
}

function setQtyForSelected(itemKey, val) {
  const student = appData.students[selectedSeat - 1];
  let num = parseInt(val, 10);
  if (isNaN(num) || num < 0) num = 0;
  student[itemKey] = num;
  saveData();
  renderSelectedStudentClothes();
  updateGlobalStatsOnly();
}

// 當前選中學生切換繳費狀態
function toggleSelectedStudentPaid() {
  const student = appData.students[selectedSeat - 1];
  student.paid = !student.paid;
  saveData();
  renderSelectedStudentClothes();
  updateGlobalStatsOnly();
  showToast(student.paid ? `✅ 座號 ${student.seat} 號已標記為【已繳費】！` : `ℹ️ 座號 ${student.seat} 號已改為【未繳費】`);
}

// 一鍵套用全套 7 件給當前選中學生
function applyStandardSetToSelected() {
  const student = appData.students[selectedSeat - 1];
  student.item1 = 1;
  student.item2 = 1;
  student.item3 = 1;
  student.item4 = 1;
  student.item5 = 1;
  student.item6 = 1;
  student.item7 = 1;
  saveData();
  renderSelectedStudentClothes();
  updateGlobalStatsOnly();
  showToast(`⭐ 座號 ${student.seat} 號已套用標準全套 7 件 ($395)！`);
}

// 清空當前選中學生件數
function clearSelectedStudentQuantities() {
  const student = appData.students[selectedSeat - 1];
  student.item1 = 0;
  student.item2 = 0;
  student.item3 = 0;
  student.item4 = 0;
  student.item5 = 0;
  student.item6 = 0;
  student.item7 = 0;
  student.paid = false;
  saveData();
  renderSelectedStudentClothes();
  updateGlobalStatsOnly();
  showToast(`🧹 座號 ${student.seat} 號送繡件數已清空！`);
}

// 即時強制儲存抽屜輸入框中正在輸入的姓名與學號 (防止尚未失焦就切換或匯出造成文字遺失)
function commitCurrentSheetInputs() {
  if (selectedSeat >= 1 && selectedSeat <= TOTAL_STUDENTS) {
    const student = appData.students[selectedSeat - 1];
    if (student) {
      const nameInput = document.getElementById("sheetStudentName");
      const idInput = document.getElementById("sheetStudentId");
      if (nameInput) student.name = (nameInput.value || "").trim();
      if (idInput) student.studentId = (idInput.value || "").trim();
      saveData();
      const cell = document.querySelector(`#picker-item-${student.seat} .cell-name-txt`);
      if (cell) cell.textContent = student.name || "未填";
    }
  }
}

// 更新當前選中學生的姓名與學號 (oninput 即時觸發)
function updateSelectedStudentName(val) {
  if (selectedSeat < 1 || selectedSeat > TOTAL_STUDENTS) return;
  const student = appData.students[selectedSeat - 1];
  if (!student) return;
  student.name = (val || "").trim();
  saveData();
  const cell = document.querySelector(`#picker-item-${student.seat} .cell-name-txt`);
  if (cell) {
    cell.textContent = student.name || "未填";
  }
}

function updateSelectedStudentId(val) {
  if (selectedSeat < 1 || selectedSeat > TOTAL_STUDENTS) return;
  const student = appData.students[selectedSeat - 1];
  if (!student) return;
  student.studentId = (val || "").trim();
  saveData();
}

// 快速前後換人 (上一位 / 下一位)
function navigateStudent(delta) {
  commitCurrentSheetInputs(); // 換人前先將當前輸入框姓名立即存檔！
  let nextSeat = selectedSeat + delta;
  if (nextSeat < 1) nextSeat = TOTAL_STUDENTS;
  if (nextSeat > TOTAL_STUDENTS) nextSeat = 1;
  openClothesPicker(nextSeat);
}

// 僅更新頂部與底部統計數據 (不打亂當前彈窗)
function updateGlobalStatsOnly() {
  let grandTotalAmount = 0;
  let grandTotalItems = 0;
  let paidCount = 0;
  let paidAmount = 0;

  appData.students.forEach(student => {
    const calc = calculateStudentTotal(student);
    grandTotalAmount += calc.total;
    grandTotalItems += calc.count;
    if (student.paid) {
      paidCount++;
      paidAmount += calc.total;
    }
  });

  const unpaidCount = TOTAL_STUDENTS - paidCount;
  updateSummaryStats(grandTotalAmount, grandTotalItems, paidCount, paidAmount);

  const filterCountAll = document.getElementById("filterCountAll");
  const filterCountUnpaid = document.getElementById("filterCountUnpaid");
  const filterCountPaid = document.getElementById("filterCountPaid");
  if (filterCountAll) filterCountAll.textContent = TOTAL_STUDENTS;
  if (filterCountUnpaid) filterCountUnpaid.textContent = unpaidCount;
  if (filterCountPaid) filterCountPaid.textContent = paidCount;

  const mobileGrandTotal = document.getElementById("mobileSumGrandTotal");
  const mobilePaid = document.getElementById("mobileSumPaid");
  const mobilePaidCount = document.getElementById("mobileSumPaidCount");
  if (mobileGrandTotal) mobileGrandTotal.textContent = `$${grandTotalAmount.toLocaleString()}`;
  if (mobilePaid) mobilePaid.textContent = `$${paidAmount.toLocaleString()}`;
  if (mobilePaidCount) mobilePaidCount.textContent = `(${paidCount}/${TOTAL_STUDENTS}人)`;

  const expTotalEl = document.getElementById("expectedClassTotal");
  if (expTotalEl) expTotalEl.textContent = `$${grandTotalAmount.toLocaleString()}`;
}

// -------------------------------------------------------------
// 全域總渲染器
// -------------------------------------------------------------
function renderAll() {
  let classItemTotals = { item1: 0, item2: 0, item3: 0, item4: 0, item5: 0, item6: 0, item7: 0 };
  let grandTotalAmount = 0;
  let grandTotalItems = 0;
  let paidCount = 0;
  let paidAmount = 0;

  appData.students.forEach(student => {
    const calc = calculateStudentTotal(student);
    grandTotalAmount += calc.total;
    grandTotalItems += calc.count;
    if (student.paid) {
      paidCount++;
      paidAmount += calc.total;
    }
    for (let key in classItemTotals) {
      classItemTotals[key] += parseInt(student[key] || 0, 10);
    }
  });

  const unpaidCount = TOTAL_STUDENTS - paidCount;

  updateSummaryStats(grandTotalAmount, grandTotalItems, paidCount, paidAmount);

  const filterCountAll = document.getElementById("filterCountAll");
  const filterCountUnpaid = document.getElementById("filterCountUnpaid");
  const filterCountPaid = document.getElementById("filterCountPaid");
  if (filterCountAll) filterCountAll.textContent = TOTAL_STUDENTS;
  if (filterCountUnpaid) filterCountUnpaid.textContent = unpaidCount;
  if (filterCountPaid) filterCountPaid.textContent = paidCount;

  const mobileGrandTotal = document.getElementById("mobileSumGrandTotal");
  const mobilePaid = document.getElementById("mobileSumPaid");
  const mobilePaidCount = document.getElementById("mobileSumPaidCount");
  if (mobileGrandTotal) mobileGrandTotal.textContent = `$${grandTotalAmount.toLocaleString()}`;
  if (mobilePaid) mobilePaid.textContent = `$${paidAmount.toLocaleString()}`;
  if (mobilePaidCount) mobilePaidCount.textContent = `(${paidCount}/${TOTAL_STUDENTS}人)`;

  const expTotalEl = document.getElementById("expectedClassTotal");
  if (expTotalEl) expTotalEl.textContent = `$${grandTotalAmount.toLocaleString()}`;

  renderStudentPickerGrid();
  renderTableRows(classItemTotals, grandTotalAmount);

  const drawer = document.getElementById("clothesPickerDrawer");
  if (drawer && drawer.style.display !== "none") {
    renderSelectedStudentClothes();
  }
}

// -------------------------------------------------------------
// 📊 試算表格渲染 (Table View)
// -------------------------------------------------------------
function renderTableRows(classItemTotals, grandTotalAmount) {
  const tbody = document.getElementById("studentTableBody");
  if (!tbody) return;
  tbody.innerHTML = "";

  appData.students.forEach((student, index) => {
    const isMatch = checkStudentFilterMatch(student);
    const calc = calculateStudentTotal(student);

    const tr = document.createElement("tr");
    tr.id = `row-student-${student.seat}`;
    if (!isMatch) {
      tr.style.display = "none";
    }

    tr.innerHTML = `
      <td class="seat-col sticky-col-seat">${student.seat}</td>
      <td class="sticky-col-name">
        <input type="text" class="cell-input-text" placeholder="姓名" value="${escapeHtml(student.name)}" oninput="updateStudentInfo(${index}, 'name', this.value)" onchange="updateStudentInfo(${index}, 'name', this.value)">
      </td>
      <td>
        <input type="text" class="cell-input-text" placeholder="學號" value="${escapeHtml(student.studentId)}" oninput="updateStudentInfo(${index}, 'studentId', this.value)" onchange="updateStudentInfo(${index}, 'studentId', this.value)">
      </td>
      ${renderTableQtyCell(index, 'item1', student.item1)}
      ${renderTableQtyCell(index, 'item2', student.item2)}
      ${renderTableQtyCell(index, 'item3', student.item3)}
      ${renderTableQtyCell(index, 'item4', student.item4)}
      ${renderTableQtyCell(index, 'item5', student.item5)}
      ${renderTableQtyCell(index, 'item6', student.item6)}
      ${renderTableQtyCell(index, 'item7', student.item7)}
      <td class="col-total" id="student-total-${student.seat}">$${calc.total}</td>
      <td>
        <label class="status-paid">
          <input type="checkbox" ${student.paid ? 'checked' : ''} onchange="togglePaid(${index}, this.checked)">
          <span>${student.paid ? '已繳' : '未繳'}</span>
        </label>
      </td>
    `;

    tbody.appendChild(tr);
  });

  for (let key in classItemTotals) {
    const el = document.getElementById(`footer-${key}`);
    if (el) el.textContent = classItemTotals[key];
  }
  const footerGrandTotal = document.getElementById("footer-grand-total");
  if (footerGrandTotal) footerGrandTotal.textContent = `$${grandTotalAmount.toLocaleString()}`;
}

function renderTableQtyCell(studentIndex, itemKey, value) {
  const numVal = parseInt(value || 0, 10);
  const hasValClass = numVal > 0 ? 'has-value' : '';
  return `
    <td>
      <div class="qty-control">
        <button type="button" class="qty-btn" onclick="stepTableQty(${studentIndex}, '${itemKey}', -1)">-</button>
        <input type="number" min="0" max="20" class="qty-input ${hasValClass}" value="${numVal}" onchange="setTableQty(${studentIndex}, '${itemKey}', this.value)">
        <button type="button" class="qty-btn" onclick="stepTableQty(${studentIndex}, '${itemKey}', 1)">+</button>
      </div>
    </td>
  `;
}

function updateStudentInfo(index, field, value) {
  appData.students[index][field] = value.trim();
  saveData();
  renderStudentPickerGrid();
}

function stepTableQty(index, itemKey, delta) {
  let current = parseInt(appData.students[index][itemKey] || 0, 10);
  current = Math.max(0, current + delta);
  appData.students[index][itemKey] = current;
  saveData();
  renderAll();
}

function setTableQty(index, itemKey, val) {
  let num = parseInt(val, 10);
  if (isNaN(num) || num < 0) num = 0;
  appData.students[index][itemKey] = num;
  saveData();
  renderAll();
}

function togglePaid(index, isPaid) {
  appData.students[index].paid = isPaid;
  saveData();
  renderAll();
}

function updateSummaryStats(totalAmount, totalItems, paidCount, paidAmount) {
  const statAmount = document.getElementById("statGrandTotal");
  const statItems = document.getElementById("statTotalItems");
  const statPaidStudents = document.getElementById("statPaidStudents");
  const statPaidAmount = document.getElementById("statPaidAmount");

  if (statAmount) statAmount.textContent = `$${totalAmount.toLocaleString()}`;
  if (statItems) statItems.textContent = `${totalItems} 件`;
  if (statPaidStudents) statPaidStudents.textContent = `${paidCount} / ${TOTAL_STUDENTS} 人`;
  if (statPaidAmount) statPaidAmount.textContent = `$${paidAmount.toLocaleString()}`;

  const printClass = document.getElementById("printClassHeader");
  if (printClass) printClass.textContent = appData.className || "______";
}

// -------------------------------------------------------------
// 批次與工具操作
// -------------------------------------------------------------
function applyStandardSetToAll() {
  if (!confirm("確定要為全班 31 位同學一鍵套用【標準全套7件組 (各1件)】嗎？\n(包含短制、長制、短運、長運、實習服、帽子、外套，每人 $395 元)")) {
    return;
  }
  appData.students.forEach(s => {
    s.item1 = 1;
    s.item2 = 1;
    s.item3 = 1;
    s.item4 = 1;
    s.item5 = 1;
    s.item6 = 1;
    s.item7 = 1;
  });
  saveData();
  renderAll();
  showToast("✅ 已成功套用全班標準全套 7 件！");
}

function fillSampleRoster() {
  if (!confirm("要自動產生 31 位同學的示範學號與姓名嗎？\n(學號將從 115001 ~ 115031)")) {
    return;
  }
  const surnames = ["陳", "林", "黃", "張", "李", "王", "吳", "劉", "蔡", "楊", "許", "鄭", "謝", "郭", "洪", "曾", "邱", "廖", "賴", "周", "徐", "蘇", "葉", "莊", "呂", "江", "何", "蕭", "羅", "高", "潘"];
  const names = ["冠宇", "柏翰", "宇軒", "品睿", "宥廷", "彥廷", "柏宇", "奕辰", "家豪", "冠廷", "品妍", "子晴", "詠晴", "羽彤", "詩涵", "恩綺", "佳穎", "語彤", "雨萱", "晴雅", "明勳", "俊諺", "志偉", "建霖", "思妤", "欣宜", "宜芳", "雅筑", "佩辰", "郁婷", "凱文"];

  appData.students.forEach((s, idx) => {
    s.name = surnames[idx % surnames.length] + names[idx % names.length];
    s.studentId = `1150${(idx + 1).toString().padStart(2, '0')}`;
    if (s.item1 === 0 && s.item3 === 0) {
      s.item1 = 1;
      s.item3 = 1;
      s.item2 = 1;
      s.item4 = 1;
      s.item5 = 1;
      s.item6 = 1;
      s.item7 = 1;
    }
  });

  saveData();
  renderAll();
  showToast("🎉 已成功建立 31 位學生示範名單與送繡件數！");
}

function clearAllQuantities() {
  if (!confirm("確定要將全班 31 位同學的送繡件數全部歸零 (清空) 嗎？")) {
    return;
  }
  appData.students.forEach(s => {
    s.item1 = 0;
    s.item2 = 0;
    s.item3 = 0;
    s.item4 = 0;
    s.item5 = 0;
    s.item6 = 0;
    s.item7 = 0;
    s.paid = false;
  });
  saveData();
  renderAll();
  showToast("🧹 已清空所有送繡數量！");
}

// -------------------------------------------------------------
// 📊 Excel 與 CSV 完美雙向同步與匯出專區
// -------------------------------------------------------------

// 1. 匯出 Excel 原生試算表 (.xls) - 保證繁體中文 100% 正確、不亂碼、排版美觀、自動計算金額
function exportToExcel() {
  commitCurrentSheetInputs(); // 匯出前強制將正在輸入的姓名學號存檔

  let totalSum = 0;
  let itemSums = { item1: 0, item2: 0, item3: 0, item4: 0, item5: 0, item6: 0, item7: 0 };
  let totalItemsCount = 0;

  appData.students.forEach(s => {
    const calc = calculateStudentTotal(s);
    totalSum += calc.total;
    totalItemsCount += calc.count;
    for (let k in itemSums) itemSums[k] += parseInt(s[k] || 0, 10);
  });

  let rowsHtml = "";
  appData.students.forEach(s => {
    const calc = calculateStudentTotal(s);
    const signText = s.paid ? "已繳費" : "";
    rowsHtml += `
      <tr>
        <td style="text-align: center; mso-number-format: '0';">${s.seat}</td>
        <td style="text-align: center; mso-number-format: '\\@'; font-weight: bold;">${escapeHtml(s.name)}</td>
        <td style="text-align: center; mso-number-format: '\\@';">${escapeHtml(s.studentId)}</td>
        <td style="text-align: center; mso-number-format: '0';">${s.item1 || 0}</td>
        <td style="text-align: center; mso-number-format: '0';">${s.item2 || 0}</td>
        <td style="text-align: center; mso-number-format: '0';">${s.item3 || 0}</td>
        <td style="text-align: center; mso-number-format: '0';">${s.item4 || 0}</td>
        <td style="text-align: center; mso-number-format: '0';">${s.item5 || 0}</td>
        <td style="text-align: center; mso-number-format: '0';">${s.item6 || 0}</td>
        <td style="text-align: center; mso-number-format: '0'; background-color: #fef3c7; font-weight: bold;">${s.item7 || 0}</td>
        <td style="text-align: right; mso-number-format: '$#,##0'; font-weight: bold;">$${calc.total}</td>
        <td style="text-align: center; ${s.paid ? 'color: #16a34a; font-weight: bold;' : ''}">${signText}</td>
      </tr>
    `;
  });

  const excelTemplate = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" 
          xmlns:x="urn:schemas-microsoft-com:office:excel" 
          xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
      <!--[if gte mso 9]>
      <xml>
        <x:ExcelWorkbook>
          <x:ExcelWorksheets>
            <x:ExcelWorksheet>
              <x:Name>收費明細表</x:Name>
              <x:WorksheetOptions>
                <x:DisplayGridlines/>
              </x:WorksheetOptions>
            </x:ExcelWorksheet>
          </x:ExcelWorksheets>
        </x:ExcelWorkbook>
      </xml>
      <![endif]-->
      <style>
        body { font-family: "微軟正黑體", "Microsoft JhengHei", Arial, sans-serif; font-size: 11pt; }
        table { border-collapse: collapse; table-layout: fixed; width: 100%; }
        th, td { border: 0.5pt solid #94a3b8; padding: 5px 6px; font-size: 10.5pt; font-family: "微軟正黑體", "Microsoft JhengHei", Arial, sans-serif; }
        th { background-color: #f1f5f9; font-weight: bold; text-align: center; vertical-align: middle; }
        .main-title { font-size: 16pt; font-weight: bold; text-align: center; border: none; height: 42px; vertical-align: middle; }
        .sign-row { font-size: 11pt; font-weight: bold; border: none; height: 32px; vertical-align: middle; }
        .footer-total { background-color: #e2e8f0; font-weight: bold; }
      </style>
    </head>
    <body>
      <table>
        <tr>
          <td colspan="12" class="main-title">智光商工115學年度新生繡學號各班收費明細表</td>
        </tr>
        <tr>
          <td colspan="3" class="sign-row">班級：${escapeHtml(appData.className || '資處一仁')}</td>
          <td colspan="3" class="sign-row">班長簽章：${escapeHtml(appData.leaderSign || '')}</td>
          <td colspan="3" class="sign-row">總務股長簽章：${escapeHtml(appData.affairsSign || '')}</td>
          <td colspan="3" class="sign-row">導師簽章：${escapeHtml(appData.tutorSign || '')}</td>
        </tr>
        <tr>
          <th style="width: 50px;">座號</th>
          <th style="width: 85px;">姓名</th>
          <th style="width: 95px;">學號</th>
          <th style="width: 95px;">夏季短袖<br>制服上衣 ($55)</th>
          <th style="width: 95px;">冬季長袖<br>制服上衣 ($55)</th>
          <th style="width: 95px;">夏季短袖<br>運動上衣 ($55)</th>
          <th style="width: 95px;">冬季長袖<br>運動上衣 ($55)</th>
          <th style="width: 85px;">各科<br>實習服 ($55)</th>
          <th style="width: 70px;">帽子<br>($55)</th>
          <th style="width: 105px; background-color: #fef3c7; color: #b45309;">冬季棒球<br>運動外套 ($65)</th>
          <th style="width: 85px;">合計 (元)</th>
          <th style="width: 80px;">簽名/繳費</th>
        </tr>
        ${rowsHtml}
        <tr class="footer-total">
          <td colspan="3" style="text-align: center; font-weight: bold;">全班各品項總件數合計</td>
          <td style="text-align: center; font-weight: bold;">${itemSums.item1}</td>
          <td style="text-align: center; font-weight: bold;">${itemSums.item2}</td>
          <td style="text-align: center; font-weight: bold;">${itemSums.item3}</td>
          <td style="text-align: center; font-weight: bold;">${itemSums.item4}</td>
          <td style="text-align: center; font-weight: bold;">${itemSums.item5}</td>
          <td style="text-align: center; font-weight: bold;">${itemSums.item6}</td>
          <td style="text-align: center; font-weight: bold; background-color: #fef3c7;">${itemSums.item7}</td>
          <td style="text-align: right; font-weight: bold; color: #1e3a8a;">$${totalSum.toLocaleString()}</td>
          <td style="text-align: center;">共${totalItemsCount}件</td>
        </tr>
      </table>
    </body>
    </html>
  `;

  const blob = new Blob([excelTemplate], { type: "application/vnd.ms-excel;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `03_智光商工115學年度新生繡學號各班收費明細表_${appData.className || '各班'}_31人.xls`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast("📊 已下載 Excel 專用檔 (.xls)！繁體中文保證 100% 正確不亂碼！");
}

// 2. 一鍵複製整份名細表至 Excel 剪貼簿 (在 Excel 直接按 Ctrl+V 貼上即可，絕無亂碼)
function copyTableToClipboard() {
  commitCurrentSheetInputs();

  let tsv = "智光商工115學年度新生繡學號各班收費明細表\t\t\t\t\t\t\t\t\t\t\t\n";
  tsv += `班級: ${appData.className || '資處一仁'}\t\t班長簽章: ${appData.leaderSign || ''}\t\t總務股長簽章: ${appData.affairsSign || ''}\t\t導師簽章: ${appData.tutorSign || ''}\t\t\t\t\n`;
  tsv += "座號\t姓名\t學號\t夏季短袖制服上衣 ($55)\t冬季長袖制服上衣 ($55)\t夏季短袖運動上衣 ($55)\t冬季長袖運動上衣 ($55)\t各科實習服 ($55)\t帽子 ($55)\t冬季棒球運動外套 ($65)\t合計 (元)\t簽名/繳費\n";

  let totalSum = 0;
  let itemSums = { item1: 0, item2: 0, item3: 0, item4: 0, item5: 0, item6: 0, item7: 0 };

  appData.students.forEach(s => {
    const calc = calculateStudentTotal(s);
    totalSum += calc.total;
    for (let k in itemSums) itemSums[k] += parseInt(s[k] || 0, 10);
    const signText = s.paid ? "已繳費" : "";
    tsv += `${s.seat}\t${s.name || ''}\t${s.studentId || ''}\t${s.item1}\t${s.item2}\t${s.item3}\t${s.item4}\t${s.item5}\t${s.item6}\t${s.item7}\t${calc.total}\t${signText}\n`;
  });

  tsv += `全班統計\t全班總計\t\t${itemSums.item1}\t${itemSums.item2}\t${itemSums.item3}\t${itemSums.item4}\t${itemSums.item5}\t${itemSums.item6}\t${itemSums.item7}\t總額: ${totalSum}元\t\n`;

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(tsv).then(() => {
      showToast("📋 已複製全班明細表！請打開 Excel 按 Ctrl+V 貼上，繁體字保證正確！");
    }).catch(() => {
      fallbackClipboard(tsv);
    });
  } else {
    fallbackClipboard(tsv);
  }
}

function fallbackClipboard(text) {
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.position = "fixed";
  ta.style.left = "-9999px";
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand("copy");
    showToast("📋 已複製全班明細表！打開 Excel 按 Ctrl+V 即可直接貼上！");
  } catch (e) {
    alert("複製失敗，請直接點選【下載 Excel 檔】！");
  }
  document.body.removeChild(ta);
}

// -------------------------------------------------------------
// 📲 手機 ⇄ 電腦 跨裝置同步精靈核心功能
// -------------------------------------------------------------

function openSyncHubModal(defaultTab) {
  const modal = document.getElementById("syncHubModal");
  if (!modal) return;
  modal.style.display = "flex";
  document.body.style.overflow = "hidden";
  
  const isMobile = window.innerWidth <= 768;
  switchSyncTab(defaultTab || (isMobile ? 'phone' : 'pc'));

  const codeBox = document.getElementById("phoneGeneratedCode");
  if (codeBox) {
    codeBox.value = generateSyncCode();
  }
}

function closeSyncHubModal() {
  const modal = document.getElementById("syncHubModal");
  if (modal) {
    modal.style.display = "none";
  }
  document.body.style.overflow = "";
}

function handleSyncOverlayClick(event) {
  if (event.target.id === "syncHubModal") {
    closeSyncHubModal();
  }
}

function switchSyncTab(tab) {
  const tabPhone = document.getElementById("tabSyncFromPhone");
  const tabPC = document.getElementById("tabSyncToPC");
  const panelPhone = document.getElementById("syncPanelPhone");
  const panelPC = document.getElementById("syncPanelPC");

  if (tab === "phone") {
    if (tabPhone) tabPhone.classList.add("active");
    if (tabPC) tabPC.classList.remove("active");
    if (panelPhone) panelPhone.classList.add("active");
    if (panelPC) panelPC.classList.remove("active");
    const codeBox = document.getElementById("phoneGeneratedCode");
    if (codeBox) codeBox.value = generateSyncCode();
  } else {
    if (tabPhone) tabPhone.classList.remove("active");
    if (tabPC) tabPC.classList.add("active");
    if (panelPhone) panelPhone.classList.remove("active");
    if (panelPC) panelPC.classList.add("active");
  }
}

function utf8ToBase64(str) {
  return window.btoa(unescape(encodeURIComponent(str)));
}

function base64ToUtf8(str) {
  return decodeURIComponent(escape(window.atob(str)));
}

function generateSyncCode() {
  commitCurrentSheetInputs();
  const minimal = {
    c: appData.className || "資處一仁",
    l: appData.leaderSign || "",
    a: appData.affairsSign || "",
    t: appData.tutorSign || "",
    s: appData.students.map(s => [
      s.seat,
      s.name || "",
      s.studentId || "",
      s.item1 || 0,
      s.item2 || 0,
      s.item3 || 0,
      s.item4 || 0,
      s.item5 || 0,
      s.item6 || 0,
      s.item7 || 0,
      s.paid ? 1 : 0
    ])
  };
  return utf8ToBase64(JSON.stringify(minimal));
}

function getSyncLink() {
  const code = generateSyncCode();
  const base = window.location.href.split('#')[0];
  return `${base}#sync=${code}`;
}

function copySyncLink() {
  const link = getSyncLink();
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(link).then(() => {
      showToast("🔗 電腦同步連結已複製！傳至 LINE 電腦點開即同步！");
    }).catch(() => {
      prompt("請複製以下電腦同步連結（傳到 LINE/郵件）：", link);
    });
  } else {
    prompt("請複製以下電腦同步連結（傳到 LINE/郵件）：", link);
  }
}

function copySyncCodeOnly() {
  const code = generateSyncCode();
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(code).then(() => {
      showToast("📋 同步代碼已複製！請傳到 LINE 給電腦貼上！");
    }).catch(() => {
      prompt("請複製以下同步代碼：", code);
    });
  } else {
    prompt("請複製以下同步代碼：", code);
  }
}

function shareViaNavigator() {
  const link = getSyncLink();
  if (navigator.share) {
    navigator.share({
      title: "智光商工繡學號名冊 - 手機同步",
      text: "請在電腦點開此連結即可自動同步全班資料：",
      url: link
    }).catch(() => {
      copySyncLink();
    });
  } else {
    copySyncLink();
  }
}

function loadSyncCode(code) {
  try {
    if (!code) return false;
    code = code.trim();
    if (code.includes("sync=")) {
      code = code.split("sync=")[1].split("&")[0];
    }
    const jsonStr = base64ToUtf8(code);
    const data = JSON.parse(jsonStr);
    if (data && data.s && Array.isArray(data.s)) {
      appData.className = data.c || "資處一仁";
      appData.leaderSign = data.l || "";
      appData.affairsSign = data.a || "";
      appData.tutorSign = data.t || "";
      data.s.forEach(arr => {
        const seat = arr[0];
        if (seat >= 1 && seat <= TOTAL_STUDENTS) {
          const s = appData.students[seat - 1];
          s.name = arr[1] || "";
          s.studentId = arr[2] || "";
          s.item1 = parseInt(arr[3], 10) || 0;
          s.item2 = parseInt(arr[4], 10) || 0;
          s.item3 = parseInt(arr[5], 10) || 0;
          s.item4 = parseInt(arr[6], 10) || 0;
          s.item5 = parseInt(arr[7], 10) || 0;
          s.item6 = parseInt(arr[8], 10) || 0;
          s.item7 = parseInt(arr[9], 10) || 0;
          s.paid = arr[10] === 1;
        }
      });
      saveData();
      renderAll();

      const ci = document.getElementById("classInput");
      if (ci) ci.value = appData.className;
      const li = document.getElementById("leaderInput");
      if (li) li.value = appData.leaderSign;
      const ai = document.getElementById("affairsInput");
      if (ai) ai.value = appData.affairsSign;
      const ti = document.getElementById("tutorInput");
      if (ti) ti.value = appData.tutorSign;

      return true;
    }
  } catch (err) {
    console.error("解析同步碼失敗", err);
  }
  return false;
}

function applySyncCodeFromInput() {
  const input = document.getElementById("syncCodeInput");
  if (!input || !input.value.trim()) {
    alert("請先在輸入框貼上手機傳來的同步連結或代碼！");
    return;
  }
  let str = input.value.trim();
  if (str.includes("sync=")) {
    str = str.split("sync=")[1].split("&")[0];
  }
  const ok = loadSyncCode(str);
  if (ok) {
    closeSyncHubModal();
    showToast("🎉 成功同步！全班 31 位同學資料已載入電腦！");
    input.value = "";
  } else {
    alert("同步代碼格式不正確，請確認已完整複製手機傳送的代碼！");
  }
}

function exportSyncBackupFile() {
  commitCurrentSheetInputs();
  const backup = {
    version: "1.0",
    exportTime: new Date().toISOString(),
    className: appData.className,
    leaderSign: appData.leaderSign,
    affairsSign: appData.affairsSign,
    tutorSign: appData.tutorSign,
    students: appData.students
  };
  const jsonStr = JSON.stringify(backup, null, 2);
  const blob = new Blob([jsonStr], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `智光商工繡學號同步備份_${appData.className || '資處一仁'}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast("📥 已下載手機同步備份檔 (.json)！請傳給電腦匯入！");
}

function handleSyncBackupFileImport(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const content = e.target.result;
      if (file.name.endsWith(".json") || content.trim().startsWith("{")) {
        const parsed = JSON.parse(content);
        if (parsed.students && Array.isArray(parsed.students)) {
          appData.className = parsed.className || appData.className;
          appData.leaderSign = parsed.leaderSign || "";
          appData.affairsSign = parsed.affairsSign || "";
          appData.tutorSign = parsed.tutorSign || "";
          appData.students = parsed.students;
          saveData();
          renderAll();
          closeSyncHubModal();
          showToast("🎉 成功從備份檔同步全班 31 位學生資料！");
          return;
        }
      }
      parseAndLoadCSVText(content);
      closeSyncHubModal();
    } catch (err) {
      alert("檔案讀取或解析失敗，請確認檔案是否正確！");
    }
  };
  reader.readAsText(file, "UTF-8");
  event.target.value = "";
}

function checkUrlHashSync() {
  if (window.location.hash && window.location.hash.includes("sync=")) {
    const raw = window.location.hash.split("sync=")[1];
    if (raw) {
      const ok = loadSyncCode(raw);
      if (ok) {
        showToast("🎉 已成功自同步連結載入全班名冊與費用資料！");
        history.replaceState(null, "", window.location.pathname + window.location.search);
      }
    }
  }
}

// 3. 匯出標準相容 CSV 檔 (內嵌微軟專用 UTF-8 BOM，解決 Windows Excel 開啟繁體中文亂碼問題)
function exportToCSV() {
  commitCurrentSheetInputs();

  let csvContent = "\uFEFF"; // 微軟 Excel UTF-8 BOM
  csvContent += `"智光商工115學年度新生繡學號各班收費明細表",,,,,,,,,,,
`;
  csvContent += `"班級: ${escapeCsv(appData.className)}","","班長簽章: ${escapeCsv(appData.leaderSign)}","","總務股長簽章: ${escapeCsv(appData.affairsSign)}","","導師簽章: ${escapeCsv(appData.tutorSign)}",,,,,
`;
  csvContent += `"座號","姓名","學號","夏季短袖制服上衣 ($55)","冬季長袖制服上衣 ($55)","夏季短袖運動上衣 ($55)","冬季長袖運動上衣 ($55)","各科實習服 ($55)","帽子 ($55)","冬季棒球運動外套 ($65)","合計 (元)","簽名/繳費"
`;

  let totalSum = 0;
  let itemSums = { item1: 0, item2: 0, item3: 0, item4: 0, item5: 0, item6: 0, item7: 0 };

  appData.students.forEach(s => {
    const calc = calculateStudentTotal(s);
    totalSum += calc.total;
    for (let k in itemSums) itemSums[k] += parseInt(s[k] || 0, 10);

    const signText = s.paid ? "已繳費" : "";
    csvContent += `"${s.seat}","${escapeCsv(s.name)}","${escapeCsv(s.studentId)}","${s.item1}","${s.item2}","${s.item3}","${s.item4}","${s.item5}","${s.item6}","${s.item7}","${calc.total}","${signText}"
`;
  });

  csvContent += `"全班統計","全班總計","","${itemSums.item1}","${itemSums.item2}","${itemSums.item3}","${itemSums.item4}","${itemSums.item5}","${itemSums.item6}","${itemSums.item7}","總額: ${totalSum}元",""
`;

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `03_智光商工115學年度新生繡學號各班收費明細表_${appData.className || '各班'}_31人.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast("📥 已匯出相容 CSV 檔（已加入微軟 UTF-8 BOM 修正字體）！");
}

// 4. 匯入 CSV/TXT 名冊 (自動偵測 UTF-8、UTF-16 與 Excel 預設 Big5 編碼，解決亂碼問題)
function handleCSVImport(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    const buffer = e.target.result;
    const uint8 = new Uint8Array(buffer);
    let text = "";

    // 檢查是否有 UTF-16LE BOM
    if (uint8.length >= 2 && uint8[0] === 0xFF && uint8[1] === 0xFE) {
      text = new TextDecoder("utf-16le").decode(buffer);
    } else {
      try {
        // 先嘗試以嚴格模式 UTF-8 解碼，若遇到無效位元組會拋出例外
        text = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
      } catch (err) {
        // UTF-8 解碼失敗，代表是在繁體中文 Windows Excel 以 Big5 (ANSI/CP950) 儲存的 CSV！
        try {
          text = new TextDecoder("big5").decode(buffer);
        } catch (b5Err) {
          text = new TextDecoder("utf-8").decode(buffer);
        }
      }
    }

    parseAndLoadCSVText(text);
    event.target.value = ""; // 重設讓同檔名可以重複上傳
  };
  reader.readAsArrayBuffer(file);
}

// 解析並載入名單文字內容
function parseAndLoadCSVText(text) {
  if (!text) return;
  // 去除可能的 BOM
  if (text.charCodeAt(0) === 0xFEFF) {
    text = text.slice(1);
  }

  const lines = text.split(/\r\n|\n/);
  let parsedCount = 0;

  for (let line of lines) {
    line = line.trim();
    if (!line) continue;

    // 解析表頭班級與幹部簽名
    if (line.includes("班級:") || line.includes("班級：")) {
      const matchClass = line.match(/班級[：:]\s*([^",\t]+)/);
      if (matchClass && matchClass[1]) {
        appData.className = matchClass[1].trim();
        const ci = document.getElementById("classInput");
        if (ci) ci.value = appData.className;
        const pc = document.getElementById("printClassHeader");
        if (pc) pc.textContent = appData.className;
      }
      const matchLeader = line.match(/班長簽章[：:]\s*([^",\t]+)/);
      if (matchLeader && matchLeader[1]) {
        appData.leaderSign = matchLeader[1].trim();
        const li = document.getElementById("leaderInput");
        if (li) li.value = appData.leaderSign;
      }
      const matchAffairs = line.match(/總務股長簽章[：:]\s*([^",\t]+)/);
      if (matchAffairs && matchAffairs[1]) {
        appData.affairsSign = matchAffairs[1].trim();
        const ai = document.getElementById("affairsInput");
        if (ai) ai.value = appData.affairsSign;
      }
      const matchTutor = line.match(/導師簽章[：:]\s*([^",\t]+)/);
      if (matchTutor && matchTutor[1]) {
        appData.tutorSign = matchTutor[1].trim();
        const ti = document.getElementById("tutorInput");
        if (ti) ti.value = appData.tutorSign;
      }
      continue;
    }

    const cols = splitCsvLine(line);
    const seatNum = parseInt(cols[0], 10);
    if (!isNaN(seatNum) && seatNum >= 1 && seatNum <= TOTAL_STUDENTS) {
      const student = appData.students[seatNum - 1];
      if (cols[1] !== undefined) student.name = cols[1].trim();
      if (cols[2] !== undefined) student.studentId = cols[2].trim();
      if (cols[3] !== undefined) student.item1 = parseInt(cols[3], 10) || 0;
      if (cols[4] !== undefined) student.item2 = parseInt(cols[4], 10) || 0;
      if (cols[5] !== undefined) student.item3 = parseInt(cols[5], 10) || 0;
      if (cols[6] !== undefined) student.item4 = parseInt(cols[6], 10) || 0;
      if (cols[7] !== undefined) student.item5 = parseInt(cols[7], 10) || 0;
      if (cols[8] !== undefined) student.item6 = parseInt(cols[8], 10) || 0;
      if (cols[9] !== undefined) student.item7 = parseInt(cols[9], 10) || 0;
      if (cols[11] !== undefined) {
        student.paid = cols[11].includes("已繳") || cols[11].includes("已");
      }
      parsedCount++;
    }
  }

  saveData();
  renderAll();
  showToast(`✅ 成功匯入 ${parsedCount} 位同學名冊與資料！繁體字完全正確！`);
}

// 支援逗號與 Tab 且支援引號包覆的 CSV 行分割器
function splitCsvLine(line) {
  const result = [];
  let cur = '';
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuote && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuote = !inQuote;
      }
    } else if ((char === ',' || char === '\t') && !inQuote) {
      result.push(cur.trim());
      cur = '';
    } else {
      cur += char;
    }
  }
  result.push(cur.trim());
  return result;
}

function calcCashTotal() {
  const denominations = [
    { id: "cash-1000", subId: "sub-1000", val: 1000 },
    { id: "cash-500", subId: "sub-500", val: 500 },
    { id: "cash-100", subId: "sub-100", val: 100 },
    { id: "cash-50", subId: "sub-50", val: 50 },
    { id: "cash-10", subId: "sub-10", val: 10 },
    { id: "cash-5", subId: "sub-5", val: 5 },
    { id: "cash-1", subId: "sub-1", val: 1 }
  ];

  let actualCash = 0;
  denominations.forEach(d => {
    const el = document.getElementById(d.id);
    const count = el ? parseInt(el.value || 0, 10) : 0;
    const sub = count * d.val;
    actualCash += sub;
    const subEl = document.getElementById(d.subId);
    if (subEl) subEl.textContent = `$${sub.toLocaleString()}`;
  });

  const actualEl = document.getElementById("actualCashTotal");
  if (actualEl) actualEl.textContent = `$${actualCash.toLocaleString()}`;

  let expectedAmount = 0;
  appData.students.forEach(s => {
    expectedAmount += calculateStudentTotal(s).total;
  });

  const diffEl = document.getElementById("cashDiffAlert");
  if (diffEl) {
    const diff = actualCash - expectedAmount;
    if (actualCash === 0 && expectedAmount > 0) {
      diffEl.className = "diff-alert info";
      diffEl.innerHTML = "💡 請輸入各面額實際收到的張數或枚數進行對帳";
    } else if (diff === 0) {
      diffEl.className = "diff-alert match";
      diffEl.innerHTML = `🎉 現金實收金額 ($${actualCash.toLocaleString()}) 與應收總額 ($${expectedAmount.toLocaleString()}) 完全相符！無差額！`;
    } else if (diff > 0) {
      diffEl.className = "diff-alert mismatch";
      diffEl.innerHTML = `⚠️ 現金實收多了 $${diff.toLocaleString()} 元 (實收: $${actualCash.toLocaleString()}，應收: $${expectedAmount.toLocaleString()})`;
    } else {
      diffEl.className = "diff-alert mismatch";
      diffEl.innerHTML = `⚠️ 現金實收短少 $${Math.abs(diff).toLocaleString()} 元 (實收: $${actualCash.toLocaleString()}，應收: $${expectedAmount.toLocaleString()})`;
    }
  }
}

function switchTab(tabId) {
  document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
  document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));

  const targetBtn = document.querySelector(`[data-tab="${tabId}"]`);
  const targetContent = document.getElementById(tabId);

  if (targetBtn) targetBtn.classList.add("active");
  if (targetContent) targetContent.classList.add("active");

  const mobileBar = document.getElementById("mobileSummaryBar");
  if (mobileBar) {
    mobileBar.style.display = tabId === "tab-fee-detail" ? "flex" : "none";
  }

  if (tabId === "tab-cash") {
    calcCashTotal();
  }
}

function triggerPrint() {
  switchTab("tab-fee-detail");
  window.print();
}

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function showToast(msg) {
  let toast = document.getElementById("sysToast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "sysToast";
    toast.className = "sys-toast-notification";
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.classList.add("show");
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => {
    toast.classList.remove("show");
  }, 2200);
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str).replace(/[&<>"']/g, function(m) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
  });
}

function escapeCsv(str) {
  if (!str) return "";
  return String(str).replace(/"/g, '""');
}

// -------------------------------------------------------------
// 初始化綁定
// -------------------------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
  loadSavedData();
  checkUrlHashSync(); // 自動檢查是否有來自手機的同步連結 (#sync=...)
  switchViewMode("picker"); // 預設進入「點名字再選衣服」模式

  const classInput = document.getElementById("classInput");
  if (classInput) {
    classInput.value = appData.className || "資處一仁";
    classInput.addEventListener("input", (e) => {
      appData.className = e.target.value;
      const p = document.getElementById("printClassHeader");
      if (p) p.textContent = e.target.value || "______";
      saveData();
    });
  }

  const leaderInput = document.getElementById("leaderInput");
  if (leaderInput) {
    leaderInput.value = appData.leaderSign || "";
    leaderInput.addEventListener("input", (e) => {
      appData.leaderSign = e.target.value;
      const p = document.getElementById("printLeaderHeader");
      if (p) p.textContent = e.target.value ? ` ${e.target.value}` : "";
      saveData();
    });
    const p = document.getElementById("printLeaderHeader");
    if (p && appData.leaderSign) p.textContent = ` ${appData.leaderSign}`;
  }

  const affairsInput = document.getElementById("affairsInput");
  if (affairsInput) {
    affairsInput.value = appData.affairsSign || "";
    affairsInput.addEventListener("input", (e) => {
      appData.affairsSign = e.target.value;
      const p = document.getElementById("printAffairsHeader");
      if (p) p.textContent = e.target.value ? ` ${e.target.value}` : "";
      saveData();
    });
    const p = document.getElementById("printAffairsHeader");
    if (p && appData.affairsSign) p.textContent = ` ${appData.affairsSign}`;
  }

  const tutorInput = document.getElementById("tutorInput");
  if (tutorInput) {
    tutorInput.value = appData.tutorSign || "";
    tutorInput.addEventListener("input", (e) => {
      appData.tutorSign = e.target.value;
      const p = document.getElementById("printTutorHeader");
      if (p) p.textContent = e.target.value ? ` ${e.target.value}` : "";
      saveData();
    });
    const p = document.getElementById("printTutorHeader");
    if (p && appData.tutorSign) p.textContent = ` ${appData.tutorSign}`;
  }

  renderAll();

  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const tabId = btn.getAttribute("data-tab");
      switchTab(tabId);
    });
  });
});
