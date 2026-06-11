/**
 * Main Application Logic for おうちの冷蔵庫メモ ＆ 家計簿
 * Coordinates state, localStorage, periods calculation, integrated budgets, and premium recipes.
 * Format adapted for adult users (proper Kanji UI) with custom category fields and airy spacing.
 */

// APPLICATION STATE
let state = {
  fridgeItems: [],
  ledgerItems: [],
  settings: {
    startDay: 1, // 1 to 31
    carryOver: 0, // Carry over fund from last month
    budgets: {
      food: 20000,
      eat_out: 10000,
      daily_necessities: 5000,
      utilities: 10000,
      entertainment: 5000,
      travel_telecom: 5000,
      other: 5000
    },
    isPremium: false, // Simulator for mock premium subscription
    theme: 'light'
  }
};

// CATEGORY CONFIGURATIONS & LABELS (Will grow dynamically as users add custom categories)
const FRIDGE_CATEGORIES = {
  meat_fish: '肉・魚',
  vegetable: '野菜・果物',
  dairy: '乳製品',
  drink: '飲料',
  seasoning: '調味料',
  processed: '加工食品',
  other: 'その他'
};

const LEDGER_CATEGORIES = {
  food: '食費 (冷蔵庫連携)',
  eat_out: '外食',
  daily_necessities: '日用品',
  utilities: '光熱費',
  entertainment: '娯楽費',
  travel_telecom: '交通・通信費',
  other: 'その他'
};

// Active room tab in fridge ("fridge", "freezer", "vegetable")
let activeFridgeRoom = 'fridge';
// Checked fridge item IDs for recipe generation
let selectedIngredients = new Set();

// LOCAL STORAGE SYNC
function saveToStorage() {
  localStorage.setItem('smart_fridge_ledger_state_v2', JSON.stringify(state));
}

function loadFromStorage() {
  const data = localStorage.getItem('smart_fridge_ledger_state_v2');
  if (data) {
    try {
      state = JSON.parse(data);
      // Migrate schemas
      if (!state.fridgeItems) state.fridgeItems = [];
      if (!state.ledgerItems) state.ledgerItems = [];
      if (!state.settings) state.settings = {};
      
      const s = state.settings;
      if (s.startDay === undefined) s.startDay = 1;
      if (s.carryOver === undefined) s.carryOver = 0;
      if (s.isPremium === undefined) s.isPremium = false;
      if (s.theme === undefined) s.theme = 'light';
      
      if (!s.budgets) {
        s.budgets = {
          food: 20000,
          eat_out: 10000,
          daily_necessities: 5000,
          utilities: 10000,
          entertainment: 5000,
          travel_telecom: 5000,
          other: 5000
        };
      }
      const keys = ['food', 'eat_out', 'daily_necessities', 'utilities', 'entertainment', 'travel_telecom', 'other'];
      keys.forEach(k => {
        if (s.budgets[k] === undefined) s.budgets[k] = 5000;
      });
      
      state.fridgeItems.forEach(item => {
        if (!item.location) {
          if (item.category === 'vegetable') item.location = 'vegetable';
          else if (item.category === 'meat_fish') item.location = 'freezer';
          else item.location = 'fridge';
        }
        // If it is a custom category, register it to temporary map
        if (item.category && !FRIDGE_CATEGORIES[item.category]) {
          FRIDGE_CATEGORIES[item.category] = item.category;
        }
      });

      // Scan and register custom categories for Ledger
      state.ledgerItems.forEach(item => {
        if (item.category && !LEDGER_CATEGORIES[item.category]) {
          LEDGER_CATEGORIES[item.category] = item.category;
        }
      });
    } catch (e) {
      console.error('Error parsing storage data. Using defaults.', e);
    }
  } else {
    injectDemoData();
  }
}

// INJECT INITIAL SAMPLE DATA
function injectDemoData() {
  const today = new Date();
  const formatDate = (daysOffset) => {
    const d = new Date();
    d.setDate(today.getDate() + daysOffset);
    return d.toISOString().split('T')[0];
  };

  state.fridgeItems = [
    { id: 'f1', name: '牛乳', category: 'dairy', location: 'fridge', quantity: '1本', expiry: formatDate(-1), dateAdded: formatDate(-3) },
    { id: 'f2', name: '冷凍ギョーザ', category: 'processed', location: 'freezer', quantity: '1袋', expiry: formatDate(45), dateAdded: formatDate(-10) },
    { id: 'f3', name: 'キャベツ', category: 'vegetable', location: 'vegetable', quantity: '半玉', expiry: formatDate(2), dateAdded: formatDate(-2) },
    { id: 'f4', name: '豚バラ肉', category: 'meat_fish', location: 'fridge', quantity: '200g', expiry: formatDate(1), dateAdded: formatDate(-1) },
    { id: 'f5', name: 'マヨネーズ', category: 'seasoning', location: 'fridge', quantity: '1本', expiry: formatDate(90), dateAdded: formatDate(-15) },
    { id: 'f6', name: 'にんじん', category: 'vegetable', location: 'vegetable', quantity: '2本', expiry: formatDate(8), dateAdded: formatDate(-1) }
  ];

  state.ledgerItems = [
    { id: 'l1', date: formatDate(-3), name: 'スーパー買い出し (牛乳・野菜)', category: 'food', price: 1250 },
    { id: 'l2', date: formatDate(-1), name: 'お惣菜・弁当', category: 'food', price: 980 },
    { id: 'l3', date: formatDate(0), name: '居酒屋飲み会', category: 'eat_out', price: 4500 },
    { id: 'l4', date: formatDate(-5), name: '洗剤・ティッシュ', category: 'daily_necessities', price: 720 },
    { id: 'l5', date: formatDate(-7), name: 'スマートフォン代', category: 'travel_telecom', price: 4200 },
    { id: 'l6', date: formatDate(-2), name: '映画鑑賞チケット', category: 'entertainment', price: 1900 },
    { id: 'l7', date: formatDate(-10), name: '水道料金', category: 'utilities', price: 3800 }
  ];

  state.settings = {
    startDay: 15,
    carryOver: 3500,
    budgets: {
      food: 25000,
      eat_out: 12000,
      daily_necessities: 6000,
      utilities: 10000,
      entertainment: 8000,
      travel_telecom: 7000,
      other: 5000
    },
    isPremium: false,
    theme: 'light'
  };
  saveToStorage();
}

// ----------------------------------------------------
// DATE PERIOD CALCULATIONS
// ----------------------------------------------------
function getSafeDate(year, month, day) {
  const maxDays = new Date(year, month + 1, 0).getDate();
  const safeDay = Math.min(day, maxDays);
  return new Date(year, month, safeDay);
}

function getCurrentPeriod(startDay, refDate = new Date()) {
  const year = refDate.getFullYear();
  const month = refDate.getMonth();

  let periodStart;
  let periodEnd;

  const thisMonthStart = getSafeDate(year, month, startDay);

  if (refDate >= thisMonthStart) {
    periodStart = thisMonthStart;
    const nextMonthStart = getSafeDate(year, month + 1, startDay);
    periodEnd = new Date(nextMonthStart.getTime());
    periodEnd.setDate(periodEnd.getDate() - 1);
  } else {
    periodStart = getSafeDate(year, month - 1, startDay);
    periodEnd = new Date(thisMonthStart.getTime());
    periodEnd.setDate(periodEnd.getDate() - 1);
  }

  periodStart.setHours(0, 0, 0, 0);
  periodEnd.setHours(23, 59, 59, 999);

  const startMonthNum = periodStart.getMonth() + 1;
  const startDayNum = periodStart.getDate();
  const endMonthNum = periodEnd.getMonth() + 1;
  const endDayNum = periodEnd.getDate();
  const label = `${startMonthNum}月期 (${startMonthNum}/${startDayNum} 〜 ${endMonthNum}/${endDayNum})`;

  return { start: periodStart, end: periodEnd, label: label };
}

function isDateInPeriod(dateStr, period) {
  const itemDate = new Date(dateStr);
  itemDate.setHours(12, 0, 0, 0);
  return itemDate >= period.start && itemDate <= period.end;
}

// DOM ELEMENTS
const sections = {
  dashboard: document.getElementById('section-dashboard'),
  fridge: document.getElementById('section-fridge'),
  ledger: document.getElementById('section-ledger'),
  settings: document.getElementById('section-settings')
};

const pageTitle = document.getElementById('page-title');
const pageSubtitle = document.getElementById('page-subtitle');
const navButtons = document.querySelectorAll('.nav-btn, .mobile-nav-btn');

// DYNAMICALLY POPULATE CATEGORY FILTERS
function updateFilterDropdowns() {
  const fridgeDropdown = document.getElementById('fridge-category-filter');
  const ledgerDropdown = document.getElementById('ledger-category-filter');

  const selectedFridgeVal = fridgeDropdown.value;
  const selectedLedgerVal = ledgerDropdown.value;

  // 1. Fridge categories
  fridgeDropdown.innerHTML = '<option value="all">すべてのカテゴリ</option>';
  Object.keys(FRIDGE_CATEGORIES).forEach(key => {
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = FRIDGE_CATEGORIES[key];
    fridgeDropdown.appendChild(opt);
  });
  fridgeDropdown.value = selectedFridgeVal;
  if (!fridgeDropdown.value) fridgeDropdown.value = 'all'; // Fallback if old deleted

  // 2. Ledger categories
  ledgerDropdown.innerHTML = '<option value="all">すべてのカテゴリ</option>';
  Object.keys(LEDGER_CATEGORIES).forEach(key => {
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = LEDGER_CATEGORIES[key];
    ledgerDropdown.appendChild(opt);
  });
  ledgerDropdown.value = selectedLedgerVal;
  if (!ledgerDropdown.value) ledgerDropdown.value = 'all';
}

// ROUTING / NAVIGATION
function navigateTo(targetId) {
  Object.keys(sections).forEach(key => {
    if (key === targetId) {
      sections[key].classList.add('active');
    } else {
      sections[key].classList.remove('active');
    }
  });

  navButtons.forEach(btn => {
    if (btn.getAttribute('data-target') === targetId) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  if (targetId !== 'fridge') {
    selectedIngredients.clear();
    updateRecipeActionBar();
  }

  updateFilterDropdowns();

  switch (targetId) {
    case 'dashboard':
      pageTitle.textContent = 'ダッシュボード';
      pageSubtitle.textContent = '今日の冷蔵庫と家計簿のまとめです。';
      renderDashboard();
      break;
    case 'fridge':
      pageTitle.textContent = '冷蔵庫の中身';
      pageSubtitle.textContent = '保存場所を選んで、食材を追加・編集できます。';
      renderFridge();
      break;
    case 'ledger':
      pageTitle.textContent = '家計簿';
      pageSubtitle.textContent = 'カテゴリごとの予算設定や支出グラフを確認できます。';
      renderLedger();
      break;
    case 'settings':
      pageTitle.textContent = '管理設定';
      pageSubtitle.textContent = 'データのバックアップ、アプリの初期化を行います。';
      renderSettings();
      break;
  }
}

// THEME TOGGLE
function initTheme() {
  const body = document.body;
  if (state.settings.theme === 'light') {
    body.classList.remove('dark-theme');
    body.classList.add('light-theme');
  } else {
    body.classList.remove('light-theme');
    body.classList.add('dark-theme');
  }
  ledgerCharts.setTheme(state.settings.theme);
}

function toggleTheme() {
  state.settings.theme = state.settings.theme === 'dark' ? 'light' : 'dark';
  saveToStorage();
  initTheme();
}

// DAYS DIFFERENCE
function getDaysDifference(targetDateStr) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const targetDate = new Date(targetDateStr);
  targetDate.setHours(0, 0, 0, 0);

  const diffTime = targetDate.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

// 1. RENDER DASHBOARD
function renderDashboard() {
  let expiredCount = 0;
  let warningCount = 0;

  state.fridgeItems.forEach(item => {
    const diff = getDaysDifference(item.expiry);
    if (diff < 0) {
      expiredCount++;
    } else if (diff <= 3) {
      warningCount++;
    }
  });

  document.getElementById('dash-expired-count').textContent = expiredCount;
  document.getElementById('dash-warning-count').textContent = warningCount;
  document.getElementById('dash-total-count').textContent = state.fridgeItems.length;

  const period = getCurrentPeriod(state.settings.startDay);
  document.getElementById('dash-period-label').textContent = `${period.label} の支出`;

  const periodExpenses = state.ledgerItems
    .filter(item => isDateInPeriod(item.date, period))
    .reduce((sum, item) => sum + Number(item.price), 0);

  const sumBudgets = Object.values(state.settings.budgets).reduce((sum, val) => sum + Number(val), 0);
  const totalBudgetWithCarryOver = sumBudgets + Number(state.settings.carryOver);

  document.getElementById('dash-expense-total').textContent = `¥${periodExpenses.toLocaleString()}`;
  document.getElementById('dash-budget-limit').textContent = `¥${totalBudgetWithCarryOver.toLocaleString()}`;

  const fillBar = document.getElementById('budget-progress-bar');
  const percent = totalBudgetWithCarryOver > 0 
    ? Math.min(100, Math.max(0, (periodExpenses / totalBudgetWithCarryOver) * 100)) 
    : 0;
  fillBar.style.width = `${percent}%`;

  if (percent >= 90) {
    fillBar.style.background = 'var(--danger)';
  } else if (percent >= 70) {
    fillBar.style.background = 'var(--warning)';
  } else {
    fillBar.style.background = 'linear-gradient(to right, var(--primary), #ffa585)';
  }

  const budgetStatusText = document.getElementById('dash-budget-status');
  if (periodExpenses <= totalBudgetWithCarryOver) {
    const rem = totalBudgetWithCarryOver - periodExpenses;
    budgetStatusText.innerHTML = `残りの予算: <strong class="text-success">¥${rem.toLocaleString()}</strong>`;
  } else {
    const over = periodExpenses - totalBudgetWithCarryOver;
    budgetStatusText.innerHTML = `<span class="text-danger"><i data-lucide="alert-circle" style="width:14px;height:14px;display:inline-block;vertical-align:middle;"></i> 予算を <strong>¥${over.toLocaleString()}</strong> 超過！</span>`;
  }

  // EXPIRING ITEMS LIST
  const expiringContainer = document.getElementById('dash-expiring-list');
  const sortedExpiring = [...state.fridgeItems]
    .sort((a, b) => new Date(a.expiry) - new Date(b.expiry))
    .slice(0, 5);

  if (sortedExpiring.length === 0) {
    expiringContainer.innerHTML = `
      <div class="empty-state">
        <i data-lucide="smile" class="text-success"></i>
        <p>期限が近い食材はありません。</p>
      </div>
    `;
  } else {
    expiringContainer.innerHTML = sortedExpiring.map(item => {
      const diff = getDaysDifference(item.expiry);
      let statusClass = 'badge-success';
      let statusText = `あと ${diff} 日`;
      
      if (diff < 0) {
        statusClass = 'badge-danger';
        statusText = `期限切れ (${Math.abs(diff)}日経過)`;
      } else if (diff === 0) {
        statusClass = 'badge-danger';
        statusText = '今日まで';
      } else if (diff <= 3) {
        statusClass = 'badge-warning';
        statusText = `あと ${diff} 日`;
      }

      const roomLabels = { fridge: '冷蔵', freezer: '冷凍', vegetable: '野菜' };
      const locationLabel = roomLabels[item.location] || '冷蔵';

      return `
        <div class="compact-item">
          <div class="compact-item-info">
            <span class="compact-item-badge ${statusClass}"></span>
            <div>
              <strong>${escapeHtml(item.name)}</strong>
              <div class="text-sm text-secondary">${locationLabel}室 ・ ${FRIDGE_CATEGORIES[item.category] || item.category} ${item.quantity ? `・ ${escapeHtml(item.quantity)}` : ''}</div>
            </div>
          </div>
          <div class="compact-item-meta">
            <span class="text-sm font-semibold ${diff <= 3 ? 'text-danger' : 'text-secondary'}">${statusText}</span>
            <div class="text-sm text-muted">${item.expiry}</div>
          </div>
        </div>
      `;
    }).join('');
  }

  // RECENT EXPENSES LIST
  const expenseContainer = document.getElementById('dash-expense-list');
  const sortedExpenses = [...state.ledgerItems]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 5);

  if (sortedExpenses.length === 0) {
    expenseContainer.innerHTML = `
      <div class="empty-state">
        <i data-lucide="shopping-bag" class="text-secondary"></i>
        <p>支出の履歴はありません。</p>
      </div>
    `;
  } else {
    expenseContainer.innerHTML = sortedExpenses.map(item => {
      const catLabel = LEDGER_CATEGORIES[item.category] || item.category;
      return `
        <div class="compact-item">
          <div class="compact-item-info">
            <div>
              <strong>${escapeHtml(item.name)}</strong>
              <div class="text-sm text-secondary">${catLabel}</div>
            </div>
          </div>
          <div class="compact-item-meta">
            <span class="font-semibold text-primary">¥${Number(item.price).toLocaleString()}</span>
            <div class="text-sm text-muted">${item.date}</div>
          </div>
        </div>
      `;
    }).join('');
  }

  lucide.createIcons();
}

// 2. RENDER FRIDGE MANAGER
const searchInput = document.getElementById('fridge-search-input');
const categoryFilter = document.getElementById('fridge-category-filter');
const sortFilter = document.getElementById('fridge-sort-filter');
const fridgeGrid = document.getElementById('fridge-items-container');
const roomButtons = document.querySelectorAll('.room-tab');

function renderFridge() {
  const query = searchInput.value.toLowerCase().trim();
  const category = categoryFilter.value;
  const sortBy = sortFilter.value;

  let filtered = state.fridgeItems.filter(item => {
    const matchRoom = item.location === activeFridgeRoom;
    const matchQuery = item.name.toLowerCase().includes(query);
    const matchCategory = category === 'all' || item.category === category;
    return matchRoom && matchQuery && matchCategory;
  });

  filtered.sort((a, b) => {
    if (sortBy === 'expiry_asc') {
      return new Date(a.expiry) - new Date(b.expiry);
    } else if (sortBy === 'expiry_desc') {
      return new Date(b.expiry) - new Date(a.expiry);
    } else if (sortBy === 'name_asc') {
      return a.name.localeCompare(b.name, 'ja');
    } else if (sortBy === 'date_desc') {
      return new Date(b.dateAdded || 0) - new Date(a.dateAdded || 0);
    }
    return 0;
  });

  const roomNames = { fridge: '冷蔵室', freezer: '冷凍室', vegetable: '野菜室' };

  if (filtered.length === 0) {
    fridgeGrid.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1; padding: 4rem 1.5rem;">
        <i data-lucide="cookie" class="text-muted"></i>
        <p>${roomNames[activeFridgeRoom]}には食材が登録されていません。</p>
      </div>
    `;
  } else {
    fridgeGrid.innerHTML = filtered.map(item => {
      const diff = getDaysDifference(item.expiry);
      let borderClass = 'indicator-success';
      let statusText = `あと ${diff} 日`;
      let textDanger = '';

      if (diff < 0) {
        borderClass = 'indicator-danger';
        statusText = `期限切れ (${Math.abs(diff)}日経過)`;
        textDanger = 'text-danger';
      } else if (diff === 0) {
        borderClass = 'indicator-danger';
        statusText = '今日まで';
        textDanger = 'text-danger';
      } else if (diff <= 3) {
        borderClass = 'indicator-warning';
        statusText = `あと ${diff} 日`;
        textDanger = 'text-warning';
      }

      const isChecked = selectedIngredients.has(item.id) ? 'checked' : '';
      const isSelectedClass = selectedIngredients.has(item.id) ? 'selected' : '';

      return `
        <div class="glass-card fridge-card ${isSelectedClass}" id="fridge-card-${item.id}">
          <div class="fridge-card-indicator ${borderClass}"></div>
          
          <input type="checkbox" class="fridge-card-select-checkbox" data-id="${item.id}" ${isChecked} onchange="toggleIngredientSelection('${item.id}', this.checked)">

          <div class="fridge-card-header">
            <span class="fridge-card-cat">${FRIDGE_CATEGORIES[item.category] || item.category}</span>
            <div class="fridge-card-actions">
              <button class="btn-action edit" onclick="openEditItemModal('${item.id}')" title="編集"><i data-lucide="edit-2"></i></button>
              <button class="btn-action delete" onclick="deleteFridgeItem('${item.id}')" title="削除"><i data-lucide="trash-2"></i></button>
            </div>
          </div>
          <h4 class="fridge-card-title">${escapeHtml(item.name)}</h4>
          <div class="fridge-card-details">
            <div class="fridge-card-detail-item">
              <i data-lucide="shopping-bag"></i>
              <span>数量: ${escapeHtml(item.quantity || '設定なし')}</span>
            </div>
            <div class="fridge-card-detail-item">
              <i data-lucide="clock"></i>
              <span class="${textDanger}">${statusText} (${item.expiry})</span>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  lucide.createIcons();
  updateRecipeActionBar();
}

// Switch Fridge Rooms Tabs
roomButtons.forEach(btn => {
  btn.addEventListener('click', (e) => {
    roomButtons.forEach(b => b.classList.remove('active'));
    e.currentTarget.classList.add('active');
    activeFridgeRoom = e.currentTarget.getAttribute('data-room');
    renderFridge();
  });
});

// MULTI-SELECT HANDLER FOR INGREDIENTS
window.toggleIngredientSelection = function(id, isChecked) {
  const card = document.getElementById(`fridge-card-${id}`);
  if (isChecked) {
    selectedIngredients.add(id);
    card?.classList.add('selected');
  } else {
    selectedIngredients.delete(id);
    card?.classList.remove('selected');
  }
  updateRecipeActionBar();
};

function updateRecipeActionBar() {
  const bar = document.getElementById('fridge-recipe-action-bar');
  const countEl = document.getElementById('selected-items-count');
  
  if (selectedIngredients.size > 0) {
    countEl.textContent = selectedIngredients.size;
    bar.style.display = 'flex';
  } else {
    bar.style.display = 'none';
  }
}

// 3. RENDER LEDGER
const ledgerSearch = document.getElementById('ledger-search-input');
const ledgerFilter = document.getElementById('ledger-category-filter');
const ledgerBody = document.getElementById('ledger-list-body');

function populateLedgerBudgetForm() {
  document.getElementById('ledger-start-day-input').value = state.settings.startDay;
  document.getElementById('ledger-carry-over-input').value = state.settings.carryOver;
  
  document.getElementById('budget-food').value = state.settings.budgets.food;
  document.getElementById('budget-eat_out').value = state.settings.budgets.eat_out;
  document.getElementById('budget-necessities').value = state.settings.budgets.daily_necessities;
  document.getElementById('budget-utilities').value = state.settings.budgets.utilities;
  document.getElementById('budget-entertainment').value = state.settings.budgets.entertainment;
  document.getElementById('budget-travel_telecom').value = state.settings.budgets.travel_telecom;
  document.getElementById('budget-other').value = state.settings.budgets.other;
}

function renderLedger() {
  const query = ledgerSearch.value.toLowerCase().trim();
  const category = ledgerFilter.value;

  const period = getCurrentPeriod(state.settings.startDay);
  
  const startStr = period.start.toISOString().split('T')[0].replace(/-/g, '/');
  const endStr = period.end.toISOString().split('T')[0].replace(/-/g, '/');
  document.getElementById('ledger-current-period-text').textContent = `やりくり集計期間: ${startStr} 〜 ${endStr}`;

  let filtered = state.ledgerItems.filter(item => {
    const matchPeriod = isDateInPeriod(item.date, period);
    const matchQuery = item.name.toLowerCase().includes(query) || (LEDGER_CATEGORIES[item.category] && LEDGER_CATEGORIES[item.category].toLowerCase().includes(query));
    const matchCategory = category === 'all' || item.category === category;
    return matchPeriod && matchQuery && matchCategory;
  });

  filtered.sort((a, b) => new Date(b.date) - new Date(a.date));

  if (filtered.length === 0) {
    ledgerBody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align: center; padding: 3rem; color: var(--text-muted);">
          <i data-lucide="book-open" style="width: 36px; height: 36px; opacity: 0.5; display: block; margin: 0 auto 1rem;"></i>
          この期間のお買い物履歴はありません。
        </td>
      </tr>
    `;
  } else {
    ledgerBody.innerHTML = filtered.map(item => {
      const catLabel = LEDGER_CATEGORIES[item.category] || item.category;
      return `
        <tr id="ledger-row-${item.id}">
          <td class="font-semibold">${item.date}</td>
          <td>${escapeHtml(item.name)}</td>
          <td><span class="fridge-card-cat">${catLabel}</span></td>
          <td class="font-semibold text-primary">¥${Number(item.price).toLocaleString()}</td>
          <td>
            <button class="btn-action delete" onclick="deleteLedgerItem('${item.id}')" title="削除">
              <i data-lucide="trash-2" style="width:16px; height:16px;"></i>
            </button>
          </td>
        </tr>
      `;
    }).join('');
  }

  // AGGREGATE CHART DATA
  const categoryTotals = {
    food: 0,
    eat_out: 0,
    daily_necessities: 0,
    utilities: 0,
    entertainment: 0,
    travel_telecom: 0,
    other: 0
  };

  state.ledgerItems.forEach(item => {
    if (isDateInPeriod(item.date, period)) {
      const cat = item.category;
      if (categoryTotals[cat] !== undefined) {
        categoryTotals[cat] += Number(item.price);
      } else {
        // Dynamic custom category aggregation
        if (categoryTotals[cat] === undefined) {
          categoryTotals[cat] = 0;
        }
        categoryTotals[cat] += Number(item.price);
      }
    }
  });

  const months = [];
  const monthlyData = { labels: [], data: [] };
  
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const mStr = d.toISOString().substring(0, 7);
    months.push(mStr);
    
    const parts = mStr.split('-');
    monthlyData.labels.push(`${parseInt(parts[1])}月`);
  }

  monthlyData.data = months.map(m => {
    return state.ledgerItems
      .filter(item => item.date.startsWith(m))
      .reduce((sum, item) => sum + Number(item.price), 0);
  });

  ledgerCharts.renderPieChart('ledger-pie-chart', categoryTotals);
  ledgerCharts.renderBarChart('ledger-bar-chart', monthlyData);

  lucide.createIcons();
}

// 4. RENDER SETTINGS
function renderSettings() {
  const pStatus = document.getElementById('premium-plan-status-text');
  const btnPrem = document.getElementById('btn-toggle-premium-mock');

  if (state.settings.isPremium) {
    pStatus.textContent = 'プレミアムプラン (体験中)';
    pStatus.className = 'text-success';
    btnPrem.textContent = '無料プランに戻す';
    btnPrem.className = 'btn btn-secondary';
  } else {
    pStatus.textContent = '無料プラン';
    pStatus.className = 'text-secondary';
    btnPrem.textContent = 'プレミアムプランをお試し';
    btnPrem.className = 'btn btn-primary';
  }
}

// SAVE LEDGER BUDGET FORM
document.getElementById('btn-save-ledger-budget').addEventListener('click', () => {
  const startDay = parseInt(document.getElementById('ledger-start-day-input').value) || 1;
  const carryOver = parseInt(document.getElementById('ledger-carry-over-input').value) || 0;

  state.settings.startDay = startDay;
  state.settings.carryOver = carryOver;

  state.settings.budgets.food = parseInt(document.getElementById('budget-food').value) || 0;
  state.settings.budgets.eat_out = parseInt(document.getElementById('budget-eat_out').value) || 0;
  state.settings.budgets.daily_necessities = parseInt(document.getElementById('budget-necessities').value) || 0;
  state.settings.budgets.utilities = parseInt(document.getElementById('budget-utilities').value) || 0;
  state.settings.budgets.entertainment = parseInt(document.getElementById('budget-entertainment').value) || 0;
  state.settings.budgets.travel_telecom = parseInt(document.getElementById('budget-travel_telecom').value) || 0;
  state.settings.budgets.other = parseInt(document.getElementById('budget-other').value) || 0;

  saveToStorage();
  
  document.getElementById('budget-settings-details').open = false;

  renderLedger();
  alert('今期の予算と集計設定を保存しました！');
});

// ADD/EDIT ITEM MODAL & ACTIONS
const itemModal = document.getElementById('modal-item-form');
const itemForm = document.getElementById('form-fridge-item');
const syncLedgerCheck = document.getElementById('form-item-sync-ledger');
const priceContainer = document.getElementById('form-item-price-container');

const formItemCategorySelect = document.getElementById('form-item-category');
const formItemCustomContainer = document.getElementById('form-item-custom-category-container');
const formItemCustomInput = document.getElementById('form-item-custom-category');

// Show/Hide custom input on selection change
formItemCategorySelect.addEventListener('change', (e) => {
  if (e.target.value === 'custom') {
    formItemCustomContainer.style.display = 'block';
    formItemCustomInput.required = true;
  } else {
    formItemCustomContainer.style.display = 'none';
    formItemCustomInput.required = false;
  }
});

function openAddItemModal() {
  document.getElementById('item-modal-title').textContent = '食材の登録';
  document.getElementById('form-item-id').value = '';
  itemForm.reset();
  
  document.getElementById('form-item-location').value = activeFridgeRoom;
  formItemCustomContainer.style.display = 'none';
  formItemCustomInput.required = false;

  const d = new Date();
  d.setDate(d.getDate() + 5);
  document.getElementById('form-item-expiry').value = d.toISOString().split('T')[0];

  syncLedgerCheck.checked = true;
  priceContainer.style.display = 'flex';
  
  itemModal.classList.add('active');
}

function openEditItemModal(id) {
  const item = state.fridgeItems.find(i => i.id === id);
  if (!item) return;

  document.getElementById('item-modal-title').textContent = '食材の編集';
  document.getElementById('form-item-id').value = item.id;
  document.getElementById('form-item-name').value = item.name;
  document.getElementById('form-item-location').value = item.location || 'fridge';
  document.getElementById('form-item-quantity').value = item.quantity || '';
  document.getElementById('form-item-expiry').value = item.expiry;

  // Set category dropdown value
  const standardKeys = ['meat_fish', 'vegetable', 'dairy', 'drink', 'seasoning', 'processed', 'other'];
  if (standardKeys.includes(item.category)) {
    formItemCategorySelect.value = item.category;
    formItemCustomContainer.style.display = 'none';
    formItemCustomInput.required = false;
  } else {
    // Custom category
    formItemCategorySelect.value = 'custom';
    formItemCustomContainer.style.display = 'block';
    formItemCustomInput.value = item.category;
    formItemCustomInput.required = true;
  }

  syncLedgerCheck.checked = false;
  priceContainer.style.display = 'none';

  itemModal.classList.add('active');
}

function closeItemModal() {
  itemModal.classList.remove('active');
}

// Delete Fridge Item
window.deleteFridgeItem = function(id) {
  if (confirm('この食材を冷蔵庫から削除しますか？\n（※家計簿の履歴は削除されません）')) {
    state.fridgeItems = state.fridgeItems.filter(item => item.id !== id);
    selectedIngredients.delete(id);
    saveToStorage();
    if (sections.fridge.classList.contains('active')) {
      renderFridge();
    } else {
      renderDashboard();
    }
  }
};

window.openEditItemModal = openEditItemModal;

// Delete Ledger Item
window.deleteLedgerItem = function(id) {
  if (confirm('このお買い物の記録を家計簿から削除しますか？')) {
    state.ledgerItems = state.ledgerItems.filter(item => item.id !== id);
    saveToStorage();
    renderLedger();
  }
};

// Form Item Save
itemForm.addEventListener('submit', (e) => {
  e.preventDefault();

  const id = document.getElementById('form-item-id').value;
  const name = document.getElementById('form-item-name').value.trim();
  const location = document.getElementById('form-item-location').value;
  let category = formItemCategorySelect.value;
  const quantity = document.getElementById('form-item-quantity').value.trim();
  const expiry = document.getElementById('form-item-expiry').value;
  const syncLedger = syncLedgerCheck.checked;
  const price = parseInt(document.getElementById('form-item-price').value) || 0;

  if (category === 'custom') {
    const customVal = formItemCustomInput.value.trim();
    if (!customVal) {
      alert('新しいカテゴリ名を入力してください。');
      return;
    }
    category = customVal;
    // Register custom label dynamically
    FRIDGE_CATEGORIES[category] = category;
  }

  if (!name || !expiry) return;

  const todayStr = new Date().toISOString().split('T')[0];

  if (id) {
    const index = state.fridgeItems.findIndex(i => i.id === id);
    if (index !== -1) {
      state.fridgeItems[index] = {
        ...state.fridgeItems[index],
        name,
        location,
        category,
        quantity,
        expiry
      };
    }
  } else {
    const newId = 'f_' + Date.now();
    state.fridgeItems.push({
      id: newId,
      name,
      location,
      category,
      quantity,
      expiry,
      dateAdded: todayStr
    });

    if (syncLedger && price > 0) {
      // Set food category or custom food category if custom was added
      // If food added dynamically register ledger category map
      const ledgerCat = (formItemCategorySelect.value === 'custom') ? category : 'food';
      LEDGER_CATEGORIES[ledgerCat] = (formItemCategorySelect.value === 'custom') ? category : '食費 (冷蔵庫連携)';
      
      state.ledgerItems.push({
        id: 'l_' + Date.now(),
        date: todayStr,
        name: name,
        category: ledgerCat,
        price: price
      });
    }
  }

  saveToStorage();
  closeItemModal();
  updateFilterDropdowns();
  
  if (sections.dashboard.classList.contains('active')) {
    renderDashboard();
  } else {
    activeFridgeRoom = location;
    roomButtons.forEach(b => {
      if (b.getAttribute('data-room') === location) b.classList.add('active');
      else b.classList.remove('active');
    });
    renderFridge();
  }
});

// MANUAL LEDGER REGISTER & TOGGLES
const ledgerModal = document.getElementById('modal-ledger-manual');
const ledgerForm = document.getElementById('form-ledger-manual');

const formLedgerCategorySelect = document.getElementById('form-ledger-category');
const formLedgerCustomContainer = document.getElementById('form-ledger-custom-category-container');
const formLedgerCustomInput = document.getElementById('form-ledger-custom-category');

formLedgerCategorySelect.addEventListener('change', (e) => {
  if (e.target.value === 'custom') {
    formLedgerCustomContainer.style.display = 'block';
    formLedgerCustomInput.required = true;
  } else {
    formLedgerCustomContainer.style.display = 'none';
    formLedgerCustomInput.required = false;
  }
});

function openLedgerModal() {
  ledgerForm.reset();
  document.getElementById('form-ledger-date').value = new Date().toISOString().split('T')[0];
  formLedgerCustomContainer.style.display = 'none';
  formLedgerCustomInput.required = false;
  ledgerModal.classList.add('active');
}

function closeLedgerModal() {
  ledgerModal.classList.remove('active');
}

ledgerForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const date = document.getElementById('form-ledger-date').value;
  const name = document.getElementById('form-ledger-name').value.trim();
  let category = formLedgerCategorySelect.value;
  const price = parseInt(document.getElementById('form-ledger-price').value) || 0;

  if (category === 'custom') {
    const customVal = formLedgerCustomInput.value.trim();
    if (!customVal) {
      alert('新しいカテゴリ名を入力してください。');
      return;
    }
    category = customVal;
    LEDGER_CATEGORIES[category] = category;
  }

  if (!date || !name || price <= 0) return;

  state.ledgerItems.push({
    id: 'l_' + Date.now(),
    date,
    name,
    category,
    price
  });

  saveToStorage();
  closeLedgerModal();
  updateFilterDropdowns();
  renderLedger();
});

// CAMERA & OCR MODAL ACTIONS
const ocrModal = document.getElementById('modal-ocr-camera');
const cameraStream = document.getElementById('camera-stream');
const captureCanvas = document.getElementById('camera-capture-canvas');
const btnCapture = document.getElementById('btn-camera-capture');
const btnFacing = document.getElementById('btn-camera-toggle-facing');
const ocrLoader = document.getElementById('ocr-loader');
const ocrResultContainer = document.getElementById('ocr-result-container');
const ocrResultText = document.getElementById('ocr-result-text');
const fileFallback = document.getElementById('btn-camera-upload-fallback');

async function openOcrModal() {
  ocrLoader.style.display = 'none';
  ocrResultContainer.style.display = 'none';
  ocrModal.classList.add('active');

  try {
    await window.ocrManager.startCamera(cameraStream);
  } catch (error) {
    alert('カメラの起動に失敗しました。画像ファイル選択から読み取りを行ってください。');
    console.error('Camera startup failed:', error);
  }
}

function closeOcrModal() {
  window.ocrManager.stopCamera();
  ocrModal.classList.remove('active');
}

btnCapture.addEventListener('click', async () => {
  const dataUrl = window.ocrManager.captureGuideRegion(cameraStream, captureCanvas);
  if (!dataUrl) return;
  processOcrImage(dataUrl);
});

fileFallback.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(event) {
    processOcrImage(event.target.result);
  };
  reader.readAsDataURL(file);
});

async function processOcrImage(imageDataUrl) {
  ocrLoader.style.display = 'flex';
  ocrResultContainer.style.display = 'none';

  try {
    await window.ocrManager.initWorker();
    const rawText = await window.ocrManager.recognizeText(imageDataUrl);
    const parsedDate = window.ocrManager.parseExpiryDate(rawText);

    ocrLoader.style.display = 'none';

    if (parsedDate) {
      ocrResultContainer.style.display = 'flex';
      ocrResultText.textContent = `${parsedDate}`;
      
      setTimeout(() => {
        document.getElementById('form-item-expiry').value = parsedDate;
        closeOcrModal();
      }, 1500);
    } else {
      alert(`日付を検出できませんでした。枠に日付を合わせて撮り直すか、手動で入力してください。\n(検出結果: "${rawText.substring(0, 40)}")`);
    }
  } catch (error) {
    ocrLoader.style.display = 'none';
    alert('文字認識の処理中にエラーが発生しました。');
    console.error(error);
  }
}

btnFacing.addEventListener('click', async () => {
  try {
    await window.ocrManager.toggleFacingMode(cameraStream);
  } catch (err) {
    console.error(err);
  }
});

// RECIPE SUGGESTIONS & PREMIUM MOCK SIMULATION
const premiumIntroModal = document.getElementById('modal-premium-intro');
const recipeProposalModal = document.getElementById('modal-recipe-proposal');

document.getElementById('btn-recipe-suggest').addEventListener('click', () => {
  if (selectedIngredients.size === 0) return;

  if (!state.settings.isPremium) {
    premiumIntroModal.classList.add('active');
  } else {
    openRecipeProposalModal();
  }
});

document.getElementById('btn-premium-demo-unlock').addEventListener('click', () => {
  state.settings.isPremium = true;
  saveToStorage();
  premiumIntroModal.classList.remove('active');
  openRecipeProposalModal();
});

document.getElementById('btn-toggle-premium-mock').addEventListener('click', () => {
  state.settings.isPremium = !state.settings.isPremium;
  saveToStorage();
  renderSettings();
  alert(`プレミアム機能を ${state.settings.isPremium ? '有効化' : '無効化'} しました。`);
});

function openRecipeProposalModal() {
  const selectedItems = Array.from(selectedIngredients).map(id => {
    const item = state.fridgeItems.find(f => f.id === id);
    return item ? item.name : '';
  }).filter(name => name !== '');

  const ingredientsStr = selectedItems.join(' ');
  document.getElementById('recipe-selected-ingredients').textContent = selectedItems.join(', ');

  const cookpadUrl = `https://cookpad.com/search/${encodeURIComponent(ingredientsStr)}`;
  document.getElementById('link-recipe-cookpad').href = cookpadUrl;

  const kurashiruUrl = `https://www.kurashiru.com/search?query=${encodeURIComponent(ingredientsStr)}`;
  document.getElementById('link-recipe-kurashiru').href = kurashiruUrl;

  const delishUrl = `https://delishkitchen.tv/search?q=${encodeURIComponent(ingredientsStr)}`;
  document.getElementById('link-recipe-delish').href = delishUrl;

  recipeProposalModal.classList.add('active');
}

// Modal closes
document.getElementById('btn-close-premium-modal').addEventListener('click', () => premiumIntroModal.classList.remove('active'));
document.getElementById('btn-close-recipe-modal').addEventListener('click', () => recipeProposalModal.classList.remove('active'));

// BACKUP & RESTORE
document.getElementById('btn-export-data').addEventListener('click', () => {
  const jsonStr = JSON.stringify(state, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `fridge_ledger_backup_${new Date().toISOString().substring(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
});

document.getElementById('btn-import-data-file').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(event) {
    try {
      const imported = JSON.parse(event.target.result);
      if (imported.fridgeItems && imported.ledgerItems && imported.settings) {
        state = imported;
        saveToStorage();
        initTheme();
        populateLedgerBudgetForm();
        updateFilterDropdowns();
        navigateTo('dashboard');
        alert('データを正常に読み込みました。');
      } else {
        alert('無効なファイル形式です。');
      }
    } catch (err) {
      alert('ファイルの読み込みに失敗しました。');
    }
  };
  reader.readAsText(file);
});

// RESET APP
document.getElementById('btn-reset-app').addEventListener('click', () => {
  if (confirm('警告: すべてのデータが完全に削除されますが、よろしいですか？')) {
    localStorage.removeItem('smart_fridge_ledger_state_v2');
    state = {
      fridgeItems: [],
      ledgerItems: [],
      settings: {
        startDay: 1,
        carryOver: 0,
        budgets: {
          food: 20000,
          eat_out: 10000,
          daily_necessities: 5000,
          utilities: 10000,
          entertainment: 5000,
          travel_telecom: 5000,
          other: 5000
        },
        isPremium: false,
        theme: 'light'
      }
    };
    saveToStorage();
    initTheme();
    populateLedgerBudgetForm();
    updateFilterDropdowns();
    navigateTo('dashboard');
    alert('すべてのデータを削除しました。');
  }
});

// INITIALISE START DAYS SELECT BOX OPTIONS (1 to 31)
function initStartDaySelectOptions() {
  const select = document.getElementById('ledger-start-day-input');
  select.innerHTML = '';
  for (let i = 1; i <= 31; i++) {
    const opt = document.createElement('option');
    opt.value = i;
    opt.textContent = i;
    select.appendChild(opt);
  }
}

// EVENT LISTENERS BINDINGS
document.addEventListener('DOMContentLoaded', () => {
  initStartDaySelectOptions();
  loadFromStorage();
  initTheme();
  populateLedgerBudgetForm();
  updateFilterDropdowns();
  navigateTo('dashboard');

  navButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      const target = e.currentTarget.getAttribute('data-target');
      navigateTo(target);
    });
  });

  document.getElementById('theme-toggle-desktop').addEventListener('click', toggleTheme);
  document.getElementById('btn-quick-add').addEventListener('click', openAddItemModal);
  document.getElementById('btn-ledger-add-manual').addEventListener('click', openLedgerModal);

  document.getElementById('btn-close-item-modal').addEventListener('click', closeItemModal);
  document.getElementById('btn-cancel-item-modal').addEventListener('click', closeItemModal);
  document.getElementById('btn-close-ledger-modal').addEventListener('click', closeLedgerModal);
  document.getElementById('btn-cancel-ledger-modal').addEventListener('click', closeLedgerModal);
  document.getElementById('btn-close-ocr-modal').addEventListener('click', closeOcrModal);

  document.getElementById('btn-trigger-ocr').addEventListener('click', openOcrModal);

  searchInput.addEventListener('input', renderFridge);
  categoryFilter.addEventListener('change', renderFridge);
  sortFilter.addEventListener('change', renderFridge);

  ledgerSearch.addEventListener('input', renderLedger);
  ledgerFilter.addEventListener('change', renderLedger);

  document.getElementById('btn-dash-fridge-all').addEventListener('click', () => navigateTo('fridge'));
  document.getElementById('btn-dash-ledger-all').addEventListener('click', () => navigateTo('ledger'));

  syncLedgerCheck.addEventListener('change', (e) => {
    priceContainer.style.display = e.target.checked ? 'flex' : 'none';
  });
});

function escapeHtml(string) {
  if (!string) return '';
  return String(string).replace(/[&<>"']/g, function (s) {
    return {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[s];
  });
}
