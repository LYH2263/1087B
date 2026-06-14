import './styles.css';
import { api } from './api';
import { state, normalizeBookSearch, escapeHtmlAttr } from './state';
import { createViewController } from './views/view-controller';
import { bindEventHandlers } from './handlers/event-binders';

const viewContent = document.getElementById('view-content');
const viewTitle = document.getElementById('view-title');
const modal = document.getElementById('modal');
const toastHost = document.getElementById('toast');
const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const userChip = document.getElementById('user-chip');
const adminNavBtn = document.querySelector('[data-view="admin"]');
const adminNavSection = document.getElementById('admin-nav');

document.querySelectorAll('.nav-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    setView(btn.dataset.view);
  });
});

const toastMap = [
  [/(network|fetch|failed to fetch|timeout)/i, '网络请求失败，请检查连接'],
  [/invalid credentials|invalid password|unauthorized|invalid token/i, '账号或密码错误'],
  [/username exists|username_exists/i, '用户名已被占用'],
  [/email exists|email_exists/i, '邮箱已被占用'],
  [/phone exists|phone_exists/i, '手机号已被占用'],
  [/account exists|user exists|already exists/i, '账号已存在'],
  [/validation_error|输入校验失败/i, '提交信息不完整或格式有误'],
  [/not found/i, '未找到相关数据'],
  [/insufficient stock/i, '库存不足'],
  [/cart empty|cart_empty/i, '当前购物车为空,请到书籍查询页面购买书籍.'],
  [/order not/gi, '订单状态不匹配，请刷新后重试'],
  [/order not payable|order_not_payable/i, '该订单当前不可支付'],
  [/address not found/i, '未找到收货地址'],
  [/category exists/i, '分类已存在'],
  [/book exists/i, '书籍已存在'],
  [/invalid_file_type/i, '仅支持 JPG/PNG/WEBP/GIF/SVG 格式图片'],
  [/file_too_large/i, '图片大小不能超过 2MB'],
  [/forbidden/i, '没有权限执行该操作'],
  [/internal server error/i, '服务器开小差了，请稍后再试'],
  [/FLASH_SALE_NOT_FOUND|flash_sale_not_found/i, '秒杀场次不存在'],
  [/FLASH_SALE_NOT_STARTED|flash_sale_not_started/i, '秒杀还未开始'],
  [/FLASH_SALE_ENDED|flash_sale_ended/i, '秒杀已结束'],
  [/FLASH_SALE_OUT_OF_STOCK|flash_sale_out_of_stock/i, '秒杀已售罄'],
  [/FLASH_SALE_PURCHASE_LIMIT|flash_sale_purchase_limit/i, '您已参与过本场秒杀，每人限购一次'],
  [/FLASH_SALE_QUANTITY_EXCEEDS_LIMIT|flash_sale_quantity_exceeds_limit/i, '购买数量超过限购限制'],
  [/FLASH_SALE_PRICE_TOO_HIGH|flash_sale_price_too_high/i, '秒杀价必须低于原价'],
  [/FLASH_SALE_OVERLAPPING|flash_sale_overlapping/i, '同一书籍不能有重叠的秒杀场次'],
  [/FLASH_SALE_HAS_ORDERS|flash_sale_has_orders/i, '该场次已有订单，无法删除'],
  [/FLASH_SALE_STOCK_TOO_LOW|flash_sale_stock_too_low/i, '库存不能低于已售数量'],
  [/BOOK_NOT_ACTIVE|book_not_active/i, '该书籍未上架'],
  [/INVOICE_NOT_FOUND|invoice_not_found/i, '发票不存在'],
  [/INVOICE_ALREADY_EXISTS|invoice_already_exists/i, '该订单已有有效发票申请'],
  [/INVOICE_NOT_PENDING|invoice_not_pending/i, '该发票状态不支持此操作'],
  [/ORDER_REFUNDED_CANNOT_INVOICE|order_refunded_cannot_invoice/i, '退款订单不可开具发票'],
  [/ORDER_NOT_PAID|order_not_paid/i, '订单未支付，不能申请发票'],
  [/BOOK_LIST_NOT_FOUND|book_list_not_found/i, '书单不存在'],
  [/BOOK_ALREADY_IN_LIST|book_already_in_list/i, '该书已在书单中'],
  [/BOOK_NOT_IN_LIST|book_not_in_list/i, '该书不在书单中'],
  [/BOOKS_NOT_IN_LIST|books_not_in_list/i, '部分书籍不在书单中'],
  [/BOOK_LIST_NOT_PUBLISHED|book_list_not_published/i, '书单未上线']
  ,
  [/QUESTION_NOT_FOUND|question_not_found/i, '问题不存在'],
  [/ANSWER_NOT_FOUND|answer_not_found/i, '回答不存在'],
  [/ANSWER_PERMISSION_DENIED|answer_permission_denied/i, '仅管理员或已购该书的用户可回答']
];

function toChineseToast(message) {
  if (!message) return '操作失败，请稍后再试';
  const found = toastMap.find(([regex]) => regex.test(message));
  if (found) return found[1];
  if (/^[\u4e00-\u9fa5]/.test(message)) return message;
  return '操作失败，请检查输入或稍后再试';
}

function showToast(message, type = 'info') {
  const el = document.createElement('div');
  const color = type === 'error' ? 'bg-red-500' : type === 'success' ? 'bg-emerald-500' : 'bg-slate-800';
  el.className = `text-white px-4 py-2 rounded-xl shadow-lg text-sm ${color}`;
  el.textContent = toChineseToast(message);
  toastHost.appendChild(el);
  setTimeout(() => {
    el.remove();
  }, 2000);
}

function openModal(content) {
  modal.innerHTML = `
    <div class="card w-full max-w-lg p-6 relative">
      <button class="absolute right-4 top-4 text-slate-400 hover:text-slate-700" data-action="close-modal">✕</button>
      ${content}
    </div>
  `;
  modal.classList.remove('hidden');
  modal.classList.add('flex');
}

function closeModal() {
  modal.classList.add('hidden');
  modal.classList.remove('flex');
  modal.innerHTML = '';
}

const { updateAuthUI, safeRender } = createViewController({
  state,
  viewContent,
  viewTitle,
  loginBtn,
  logoutBtn,
  userChip,
  adminNavBtn,
  adminNavSection,
  escapeHtmlAttr,
  showToast
});

async function loadBooks(params = {}) {
  state.bookSearch = normalizeBookSearch(params);
  state.loading.books = true;
  safeRender();
  state.books = await api.getBooks(state.bookSearch);
  state.loading.books = false;
  safeRender();
}

async function loadCategories() {
  state.categories = await api.getCategories();
}

async function loadCart() {
  if (!state.user) return;
  state.cart = await api.getCart();
}

async function loadOrders() {
  if (!state.user) return;
  const [orders, invoices] = await Promise.all([
    api.getOrders(),
    api.getInvoices().catch(() => [])
  ]);
  state.orders = orders.map(order => {
    const invoice = invoices.find(inv => inv.orderId === order.id);
    return {
      ...order,
      hasInvoice: !!invoice,
      invoiceStatus: invoice?.status
    };
  });
}

async function loadInvoices() {
  if (!state.user) return;
  state.loading.invoices = true;
  safeRender();
  state.invoices = await api.getInvoices();
  state.loading.invoices = false;
  safeRender();
}

async function loadAddresses() {
  if (!state.user) return;
  state.addresses = await api.getAddresses();
}

async function loadAdmin() {
  if (!state.user || state.user.role !== 'ADMIN') return;
  state.loading.admin = true;
  const [books, categories, orders, stats, flashSales, invoices, invoiceStats, bookLists, questions, answers, qnaStats] = await Promise.all([
    api.admin.getBooks(),
    api.admin.getCategories(),
    api.admin.getOrders(),
    api.admin.getOrderStats(),
    api.admin.getFlashSales(),
    api.admin.getInvoices(),
    api.admin.getInvoiceStats(),
    api.admin.getBookLists(),
    api.admin.getQuestions(),
    api.admin.getAnswers(),
    api.admin.getQnaStats()
  ]);
  state.admin.books = books;
  state.admin.categories = categories;
  state.admin.orders = orders;
  state.admin.stats = stats;
  state.admin.flashSales = flashSales;
  state.admin.invoices = invoices;
  state.admin.invoiceStats = invoiceStats;
  state.admin.bookLists = bookLists;
  state.admin.questions = questions;
  state.admin.answers = answers;
  state.admin.qnaStats = qnaStats;
  state.loading.admin = false;
}

async function loadBookLists() {
  state.loading.bookLists = true;
  safeRender();
  state.bookLists = await api.getBookLists();
  state.loading.bookLists = false;
  safeRender();
}

async function loadBookListDetail(id) {
  state.loading.bookListDetail = true;
  safeRender();
  state.currentBookList = await api.getBookList(id);
  state.loading.bookListDetail = false;
  safeRender();
}

async function loadBookDetail(bookId) {
  state.loading.bookDetail = true;
  state.bookQuestions.loading = true;
  safeRender();
  try {
    const book = state.books.find(b => b.id === bookId) || await api.getBooks().then(books => books.find(b => b.id === bookId));
    state.currentBook = book || null;
    const result = await api.getBookQuestions(bookId, {
      page: state.bookQuestions.page,
      pageSize: state.bookQuestions.pageSize,
      sort: state.bookQuestions.sort
    });
    state.bookQuestions.items = result.items;
    state.bookQuestions.total = result.total;
    state.bookQuestions.totalPages = result.totalPages;
    state.bookQuestions.page = result.page;
    state.bookQuestions.sort = result.sort;
  } finally {
    state.loading.bookDetail = false;
    state.bookQuestions.loading = false;
    safeRender();
  }
}

async function reloadBookQuestions() {
  if (!state.currentBook) return;
  state.bookQuestions.loading = true;
  safeRender();
  try {
    const result = await api.getBookQuestions(state.currentBook.id, {
      page: state.bookQuestions.page,
      pageSize: state.bookQuestions.pageSize,
      sort: state.bookQuestions.sort
    });
    state.bookQuestions.items = result.items;
    state.bookQuestions.total = result.total;
    state.bookQuestions.totalPages = result.totalPages;
    state.bookQuestions.page = result.page;
    state.bookQuestions.sort = result.sort;
  } finally {
    state.bookQuestions.loading = false;
    safeRender();
  }
}

async function loadFlashSales() {
  state.loading.flashSales = true;
  try {
    const data = await api.getActiveFlashSales();
    state.flashSales.serverTime = data.serverTime;
    state.flashSales.items = data.items;
    
    const serverTime = new Date(data.serverTime).getTime();
    const clientTime = Date.now();
    state.flashSales.clientTimeOffset = serverTime - clientTime;
  } catch (error) {
    state.flashSales.items = [];
  } finally {
    state.loading.flashSales = false;
  }
}

let countdownInterval = null;
function startCountdownTimer() {
  if (countdownInterval) clearInterval(countdownInterval);
  
  countdownInterval = setInterval(() => {
    const items = state.flashSales.items || [];
    let needsRender = false;
    
    for (const item of items) {
      const oldStatus = getItemStatus(item);
      updateItemCountdown(item);
      const newStatus = getItemStatus(item);
      
      if (oldStatus !== newStatus) {
        needsRender = true;
      }
    }
    
    updateCountdownDisplay();
    
    if (needsRender && state.view === 'books') {
      safeRender();
    }
  }, 1000);
}

function getItemStatus(item) {
  const now = new Date(Date.now() + (state.flashSales.clientTimeOffset || 0));
  const startTime = new Date(item.startTime);
  const endTime = new Date(item.endTime);
  
  if (now < startTime) return 'UPCOMING';
  if (now >= startTime && now <= endTime) return 'ONGOING';
  return 'ENDED';
}

function updateItemCountdown(item) {
  const now = new Date(Date.now() + (state.flashSales.clientTimeOffset || 0));
  const startTime = new Date(item.startTime);
  const endTime = new Date(item.endTime);
  
  if (now < startTime) {
    item.countdownMs = startTime.getTime() - now.getTime();
  } else if (now <= endTime) {
    item.countdownMs = endTime.getTime() - now.getTime();
  } else {
    item.countdownMs = 0;
  }
}

function updateCountdownDisplay() {
  const items = state.flashSales.items || [];
  
  for (const item of items) {
    const countdownEl = document.querySelector(`[data-countdown="${item.id}"]`);
    if (countdownEl) {
      countdownEl.textContent = formatCountdownMs(item.countdownMs || 0);
    }
  }
  
  const serverTimeEl = document.getElementById('server-time-display');
  if (serverTimeEl) {
    const now = new Date(Date.now() + (state.flashSales.clientTimeOffset || 0));
    serverTimeEl.textContent = now.toLocaleTimeString();
  }
}

function formatCountdownMs(ms) {
  if (ms <= 0) return '00:00:00';
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  
  if (days > 0) {
    return `${days}天 ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

const viewLoaders = {
  books: async () => {
    await loadCategories();
    await loadBooks(state.bookSearch);
    await loadFlashSales();
  },
  'book-lists': loadBookLists,
  'book-list-detail': async () => {},
  'book-detail': async () => {},
  cart: async () => {
    await loadCart();
    await loadAddresses();
  },
  orders: loadOrders,
  invoices: loadInvoices,
  profile: loadAddresses,
  admin: loadAdmin
};

async function setView(view) {
  state.view = view;
  try {
    const loader = viewLoaders[view];
    if (loader) await loader();
  } catch (error) {
    showToast(error.message || '加载失败', 'error');
  }
  safeRender();
}

function openLoginModal() {
  openModal(`
    <div class="space-y-4">
      <h3 class="text-lg font-semibold">账号登录</h3>
      <form data-form="login" class="space-y-3" novalidate>
        <input class="input" name="account" placeholder="用户名 / 手机 / 邮箱" required />
        <input class="input" type="password" name="password" placeholder="密码" required />
        <label class="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" name="remember" /> 记住登录状态
        </label>
        <button class="btn-primary w-full" type="submit">登录</button>
      </form>
      <div class="flex justify-between text-sm">
        <button class="text-teal-700" data-action="show-register">注册新账号</button>
        <button class="text-teal-700" data-action="show-forgot">忘记密码</button>
      </div>
    </div>
  `);
}

function openRegisterModal() {
  openModal(`
    <div class="space-y-4">
      <h3 class="text-lg font-semibold">创建账号</h3>
      <form data-form="register" class="space-y-3" novalidate>
        <input class="input" name="username" placeholder="用户名" required />
        <input class="input" name="email" placeholder="邮箱" required />
        <input class="input" name="phone" placeholder="手机号" required />
        <input class="input" type="password" name="password" placeholder="密码 (含大小写 + 数字)" required />
        <button class="btn-primary w-full" type="submit">注册</button>
      </form>
      <button class="text-teal-700 text-sm" data-action="show-login">已有账号？登录</button>
    </div>
  `);
}

function openForgotModal() {
  openModal(`
    <div class="space-y-4">
      <h3 class="text-lg font-semibold">找回密码</h3>
      <form data-form="forgot" class="space-y-3" novalidate>
        <input class="input" name="account" placeholder="用户名 / 手机 / 邮箱" required />
        <div class="space-y-2">
          <p class="text-sm text-slate-600">选择验证码接收方式</p>
          <div class="grid grid-cols-2 gap-3" data-error-group="method">
            <label class="card p-3 flex items-center gap-2 cursor-pointer">
              <input type="radio" name="method" value="email" checked /> 邮箱
            </label>
            <label class="card p-3 flex items-center gap-2 cursor-pointer">
              <input type="radio" name="method" value="sms" /> 短信
            </label>
          </div>
        </div>
        <button class="btn-primary w-full" type="submit">发送验证码</button>
      </form>
      <button class="text-teal-700 text-sm" data-action="show-login">返回登录</button>
    </div>
  `);
}

function openResetModal(token = '') {
  openModal(`
    <div class="space-y-4">
      <h3 class="text-lg font-semibold">重置密码</h3>
      <form data-form="reset" class="space-y-3" novalidate>
        <input class="input" name="token" placeholder="请输入验证码" value="${token}" required />
        <input class="input" type="password" name="newPassword" placeholder="新密码" required />
        <button class="btn-primary w-full" type="submit">更新密码</button>
      </form>
    </div>
  `);
}

loginBtn.addEventListener('click', openLoginModal);
logoutBtn.addEventListener('click', async () => {
  await api.logout();
  api.clearToken();
  state.user = null;
  updateAuthUI();
  showToast('已退出登录', 'success');
  await setView('books');
});

bindEventHandlers({
  state,
  api,
  modal,
  viewContent,
  showToast,
  updateAuthUI,
  setView,
  loadBooks,
  normalizeBookSearch,
  loadCart,
  loadOrders,
  loadInvoices,
  loadAddresses,
  loadAdmin,
  loadFlashSales,
  loadBookLists,
  loadBookListDetail,
  loadBookDetail,
  reloadBookQuestions,
  safeRender,
  openModal,
  closeModal,
  openLoginModal,
  openRegisterModal,
  openForgotModal,
  openResetModal
});

async function bootstrap() {
  api.initToken();
  try {
    const me = await api.getMe();
    state.user = me;
  } catch (error) {
    state.user = null;
  }

  updateAuthUI();
  await setView('books');
  startCountdownTimer();
}

bootstrap();
