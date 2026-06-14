export function createViewController({
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
}) {
  function formatCurrency(value) {
    return `¥${Number(value).toFixed(2)}`;
  }

  function formatCountdown(ms) {
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

  function getAdjustedNow() {
    const now = Date.now();
    return new Date(now + (state.flashSales.clientTimeOffset || 0));
  }

  function getFlashSaleStatus(flashSale) {
    const now = getAdjustedNow();
    const startTime = new Date(flashSale.startTime);
    const endTime = new Date(flashSale.endTime);
    
    if (now < startTime) return { status: 'UPCOMING', label: '即将开始', countdownTo: startTime };
    if (now >= startTime && now <= endTime) return { status: 'ONGOING', label: '立即抢购', countdownTo: endTime };
    return { status: 'ENDED', label: '已结束', countdownTo: null };
  }

  function getFlashSaleCountdownMs(flashSale) {
    const statusInfo = getFlashSaleStatus(flashSale);
    if (!statusInfo.countdownTo) return 0;
    return statusInfo.countdownTo.getTime() - getAdjustedNow().getTime();
  }

  function formatStatus(status) {
    const map = {
      PENDING_PAYMENT: '待支付',
      PAID: '已支付',
      SHIPPED: '已发货',
      COMPLETED: '已完成',
      CANCELED: '已取消',
      REFUNDED: '已退款'
    };
    return map[status] || status;
  }

  function formatInvoiceStatus(status) {
    const map = {
      PENDING: '待开具',
      ISSUED: '已开具',
      REJECTED: '已驳回'
    };
    return map[status] || status;
  }

  function formatInvoiceTitleType(type) {
    const map = {
      PERSONAL: '个人',
      ENTERPRISE: '企业'
    };
    return map[type] || type;
  }

  function formatBookListStatus(status) {
    const map = {
      DRAFT: '草稿',
      PUBLISHED: '已上线',
      ARCHIVED: '已归档'
    };
    return map[status] || status;
  }

  function setNavActive(view) {
    document.querySelectorAll('.nav-btn').forEach((btn) => {
      const active = btn.dataset.view === view;
      btn.classList.toggle('bg-slate-200', active);
      btn.classList.toggle('text-slate-900', active);
    });
  }

  function updateAuthUI() {
    if (state.user) {
      loginBtn.classList.add('hidden');
      logoutBtn.classList.remove('hidden');
      userChip.classList.remove('hidden');
      userChip.textContent = `${state.user.username} · ${state.user.role === 'ADMIN' ? '管理员' : '用户'}`;
    } else {
      loginBtn.classList.remove('hidden');
      logoutBtn.classList.add('hidden');
      userChip.classList.add('hidden');
      userChip.textContent = '';
    }
    if (adminNavBtn) {
      adminNavBtn.classList.toggle('hidden', !state.user || state.user.role !== 'ADMIN');
    }
    if (adminNavSection) {
      adminNavSection.classList.toggle('hidden', !state.user || state.user.role !== 'ADMIN');
    }
  }

  function renderSkeleton(count = 6) {
    return `<div class="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">${Array.from({ length: count })
      .map(
        () => `
        <div class="card p-4 animate-pulse space-y-4">
          <div class="h-40 bg-slate-200 rounded-xl"></div>
          <div class="h-4 bg-slate-200 rounded"></div>
          <div class="h-3 bg-slate-100 rounded w-2/3"></div>
          <div class="h-8 bg-slate-200 rounded"></div>
        </div>
      `
      )
      .join('')}</div>`;
  }

  function renderFlashSaleCard(flashSale) {
    const statusInfo = getFlashSaleStatus(flashSale);
    const countdownMs = getFlashSaleCountdownMs(flashSale);
    const remainingStock = flashSale.stock - flashSale.soldCount;
    const stockPercent = Math.max(0, Math.min(100, (remainingStock / flashSale.stock) * 100));
    const isSoldOut = remainingStock <= 0;
    
    let buttonClass = 'btn-primary';
    let buttonDisabled = '';
    let buttonLabel = statusInfo.label;
    
    if (statusInfo.status === 'UPCOMING') {
      buttonClass = 'btn-outline';
      buttonDisabled = 'disabled';
    } else if (statusInfo.status === 'ENDED' || isSoldOut) {
      buttonClass = 'btn-outline opacity-60';
      buttonDisabled = 'disabled';
      buttonLabel = isSoldOut ? '已售罄' : '已结束';
    }
    
    const statusBadge = statusInfo.status === 'ONGOING' 
      ? '<span class="badge badge-active">🔥 正在秒杀</span>'
      : statusInfo.status === 'UPCOMING'
        ? '<span class="badge">⏰ 即将开始</span>'
        : '<span class="badge badge-inactive">已结束</span>';

    const book = flashSale.book || {};
    const loading = state.flashSales.purchaseLoading[flashSale.id];

    return `
      <div class="card hover-card p-4 flex flex-col gap-3 relative overflow-hidden" data-flash-sale-id="${flashSale.id}">
        <div class="absolute top-2 right-2 z-10">
          ${statusBadge}
        </div>
        <div class="flex gap-4">
          <div class="w-28 h-36 rounded-xl overflow-hidden bg-slate-100 flex-shrink-0">
            <img src="${book.coverUrl || '/covers/cover-1.svg'}" alt="${book.title || ''}" class="w-full h-full object-contain" />
          </div>
          <div class="flex-1 min-w-0">
            <h3 class="font-semibold text-base truncate">${book.title || ''}</h3>
            <p class="text-xs text-slate-500 truncate">${book.author || ''}</p>
            <div class="mt-2 flex items-baseline gap-2">
              <span class="text-2xl font-bold text-red-500">${formatCurrency(flashSale.salePrice)}</span>
              <span class="text-sm text-slate-400 line-through">${formatCurrency(book.originalPrice || flashSale.originalPrice || 0)}</span>
            </div>
            <div class="mt-2">
              <div class="flex justify-between text-xs text-slate-500 mb-1">
                <span>剩余 ${remainingStock} 件</span>
                <span>已抢 ${flashSale.soldCount} 件</span>
              </div>
              <div class="h-2 bg-slate-200 rounded-full overflow-hidden">
                <div class="h-full bg-gradient-to-r from-red-400 to-red-500 rounded-full transition-all duration-500" style="width: ${stockPercent}%"></div>
              </div>
            </div>
          </div>
        </div>
        <div class="bg-slate-50 rounded-lg p-3">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="text-xs text-slate-500">
                ${statusInfo.status === 'UPCOMING' ? '距开始' : '距结束'}
              </span>
              <span class="font-mono text-sm font-semibold text-slate-800" data-countdown="${flashSale.id}">
                ${formatCountdown(countdownMs)}
              </span>
            </div>
            <button class="${buttonClass} text-sm" data-action="purchase-flash-sale" data-id="${flashSale.id}" ${buttonDisabled} ${loading ? 'disabled' : ''}>
              ${loading ? '抢购中...' : buttonLabel}
            </button>
          </div>
        </div>
      </div>
    `;
  }

  function renderFlashSaleSection() {
    const items = state.flashSales.items || [];
    if (items.length === 0) return '';

    const ongoing = items.filter(item => getFlashSaleStatus(item).status === 'ONGOING');
    const upcoming = items.filter(item => getFlashSaleStatus(item).status === 'UPCOMING');
    const displayItems = [...ongoing, ...upcoming].slice(0, 5);

    if (displayItems.length === 0) return '';

    const cards = displayItems.map(item => renderFlashSaleCard(item)).join('');

    return `
      <div class="card p-5 bg-gradient-to-br from-red-50 to-orange-50 border-red-100">
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-2">
            <span class="text-2xl">⚡</span>
            <h3 class="text-xl font-bold text-slate-800">限时秒杀</h3>
            <span class="text-xs text-slate-500">先到先得</span>
          </div>
          <div class="text-xs text-slate-500">
            服务器时间: <span class="font-mono" id="server-time-display">${state.flashSales.serverTime ? new Date(state.flashSales.serverTime).toLocaleTimeString() : '--:--:--'}</span>
          </div>
        </div>
        ${state.loading.flashSales 
          ? `<div class="animate-pulse h-48 bg-white rounded-xl"></div>`
          : `<div class="grid md:grid-cols-2 xl:grid-cols-3 gap-4">${cards}</div>`
        }
      </div>
    `;
  }

  function renderBooks() {
    const search = state.bookSearch;
    const categoryOptions = state.categories
      .map((cat) => `<option value="${cat.id}" ${search.categoryId === cat.id ? 'selected' : ''}>${cat.name}</option>`)
      .join('');

    const bookCards = state.books
      .map(
        (book) => `
        <div class="card hover-card p-4 flex flex-col gap-3">
          <div class="rounded-xl overflow-hidden h-44 bg-slate-100">
            <img src="${book.coverUrl}" alt="${book.title}" class="w-full h-full object-contain" />
          </div>
          <div>
            <h3 class="font-semibold text-lg">${book.title}</h3>
            <p class="text-sm text-slate-500">${book.author}</p>
            <div class="flex flex-wrap gap-2 mt-2">
              <span class="badge">${book.category?.name || '未分类'}</span>
              <span class="badge">库存 ${book.stock}</span>
              <span class="badge">销量 ${book.sales}</span>
            </div>
          </div>
          <div class="flex items-center justify-between">
            <p class="text-lg font-semibold text-slate-900">${formatCurrency(book.price)}</p>
            <div class="flex gap-2">
              <button class="btn-outline" data-action="view-book-detail" data-id="${book.id}">详情</button>
              <button class="btn-primary" data-action="add-to-cart" data-id="${book.id}">加入购物车</button>
            </div>
          </div>
        </div>
      `
      )
      .join('');

    viewTitle.innerHTML = `
      <div>
        <h2 class="text-xl font-semibold">书籍查询</h2>
        <p class="text-sm text-slate-500">支持多条件筛选与排序</p>
      </div>
    `;

    const flashSaleSection = renderFlashSaleSection();

    viewContent.innerHTML = `
      ${flashSaleSection}
      <div class="card p-5">
        <form class="grid md:grid-cols-6 gap-3" data-form="book-search" novalidate>
          <input class="input md:col-span-2" name="title" placeholder="书名" value="${escapeHtmlAttr(search.title)}" />
          <input class="input" name="author" placeholder="作者" value="${escapeHtmlAttr(search.author)}" />
          <input class="input" name="isbn" placeholder="ISBN" value="${escapeHtmlAttr(search.isbn)}" />
          <select class="input" name="categoryId">
            <option value="">全部分类</option>
            ${categoryOptions}
          </select>
          <select class="input" name="sort">
            <option value="" ${search.sort === '' ? 'selected' : ''}>默认排序</option>
            <option value="sales_desc" ${search.sort === 'sales_desc' ? 'selected' : ''}>销量最高</option>
            <option value="price_asc" ${search.sort === 'price_asc' ? 'selected' : ''}>价格最低</option>
            <option value="price_desc" ${search.sort === 'price_desc' ? 'selected' : ''}>价格最高</option>
          </select>
          <input class="input" name="minPrice" placeholder="最低价" value="${escapeHtmlAttr(search.minPrice)}" />
          <input class="input" name="maxPrice" placeholder="最高价" value="${escapeHtmlAttr(search.maxPrice)}" />
          <div class="md:col-span-6 flex flex-wrap justify-end gap-2">
            <button class="btn-primary" type="submit">查询</button>
            <button class="btn-outline" type="button" data-action="reset-search">重置</button>
          </div>
        </form>
      </div>
      ${state.loading.books ? renderSkeleton() : `<div class="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">${bookCards || '<div class="text-slate-500">暂无书籍</div>'}</div>`}
    `;
  }

  function renderCart() {
    viewTitle.innerHTML = `
      <div>
        <h2 class="text-xl font-semibold">购物车</h2>
        <p class="text-sm text-slate-500">管理选购书籍并批量结算</p>
      </div>
    `;

    if (!state.user) {
      viewContent.innerHTML = `<div class="card p-6 text-slate-500">请先登录后查看购物车。</div>`;
      return;
    }

    const total = state.cart.reduce((sum, item) => sum + item.book.price * item.quantity, 0);

    const cartList = state.cart
      .map(
        (item) => `
      <div class="flex flex-col md:flex-row md:items-center gap-4 border-b border-slate-200 pb-4">
        <img src="${item.book.coverUrl}" alt="${item.book.title}" class="w-24 h-24 object-contain rounded-xl bg-white" />
        <div class="flex-1">
          <h3 class="font-semibold">${item.book.title}</h3>
          <p class="text-sm text-slate-500">${item.book.author}</p>
          <p class="text-sm text-slate-500">单价 ${formatCurrency(item.book.price)}</p>
        </div>
        <div class="flex items-center gap-3">
          <input class="input w-20" type="number" min="1" value="${item.quantity}" data-action="update-qty" data-id="${item.id}" />
          <button class="btn-outline" data-action="remove-cart" data-id="${item.id}">删除</button>
        </div>
      </div>
    `
      )
      .join('');

    const addressOptions = state.addresses
      .map(
        (addr) => `
        <option value="${addr.id}" ${addr.isDefault ? 'selected' : ''}>
          ${addr.recipient} ${addr.phone} ${addr.state}${addr.city}${addr.line1}
        </option>
      `
      )
      .join('');

    viewContent.innerHTML = `
      <div class="card p-6 space-y-4">
        ${state.cart.length === 0 ? '<p class="text-slate-500">购物车为空</p>' : cartList}
        ${state.cart.length > 0 ? `<div class="flex flex-wrap items-center justify-between gap-3">
          <p class="text-lg font-semibold">合计 ${formatCurrency(total)}</p>
          <div class="flex gap-2">
            <button class="btn-outline" data-action="clear-cart">清空购物车</button>
          </div>
        </div>` : ''}
      </div>

      <div class="card p-6 space-y-4">
        <h3 class="text-lg font-semibold">订单确认</h3>
        <form data-form="checkout" class="space-y-3" novalidate>
          <div class="space-y-1">
            <select class="input input-lg" name="addressId" required>
              <option value="">选择配送地址</option>
              ${addressOptions}
            </select>
          </div>
          <div class="grid md:grid-cols-3 gap-3" data-error-group="paymentMethod">
            <label class="card p-3 flex items-center gap-2 cursor-pointer">
              <input type="radio" name="paymentMethod" value="WECHAT" checked /> 微信支付
            </label>
            <label class="card p-3 flex items-center gap-2 cursor-pointer">
              <input type="radio" name="paymentMethod" value="ALIPAY" /> 支付宝
            </label>
            <label class="card p-3 flex items-center gap-2 cursor-pointer">
              <input type="radio" name="paymentMethod" value="COD" /> 货到付款
            </label>
          </div>
          <div class="flex justify-end">
            <button class="btn-primary" type="submit">生成待支付订单</button>
          </div>
        </form>
      </div>
    `;
  }

  function renderOrders() {
    viewTitle.innerHTML = `
      <div>
        <h2 class="text-xl font-semibold">订单管理</h2>
        <p class="text-sm text-slate-500">跟踪订单状态与售后服务</p>
      </div>
    `;

    if (!state.user) {
      viewContent.innerHTML = `<div class="card p-6 text-slate-500">请先登录后查看订单。</div>`;
      return;
    }

    if (state.orders.length === 0) {
      viewContent.innerHTML = `<div class="card p-6 text-slate-500">暂无订单</div>`;
      return;
    }

    viewContent.innerHTML = state.orders
      .map(
        (order) => `
        <div class="card p-6 space-y-4">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p class="text-xs text-slate-400">订单号 ${order.id}</p>
              <h3 class="text-lg font-semibold">${formatStatus(order.status)}</h3>
            </div>
            <div class="text-right">
              <p class="text-sm text-slate-500">金额</p>
              <p class="text-lg font-semibold">${formatCurrency(order.total)}</p>
            </div>
          </div>
          <div class="space-y-3">
            ${order.items
              .map(
                (item) => `
              <div class="flex items-center gap-3">
                <img src="${item.coverUrl}" alt="${item.title}" class="w-16 h-16 rounded-lg object-contain bg-white" />
                <div class="flex-1">
                  <p class="font-medium">${item.title}</p>
                  <p class="text-xs text-slate-500">${item.author} · ${item.quantity} 本</p>
                </div>
                <p class="text-sm font-semibold">${formatCurrency(item.price)}</p>
              </div>
            `
              )
              .join('')}
          </div>
          <div class="flex flex-wrap gap-2">
            ${order.status === 'PENDING_PAYMENT' ? `<button class="btn-primary" data-action="pay-order" data-id="${order.id}">立即支付（模拟）</button>` : ''}
            ${order.status === 'PENDING_PAYMENT' ? `<button class="btn-outline" data-action="cancel-order" data-id="${order.id}">取消订单</button>` : ''}
            ${order.status === 'SHIPPED' ? `<button class="btn-primary" data-action="confirm-order" data-id="${order.id}">确认收货</button>` : ''}
            ${order.status === 'COMPLETED' && !order.reviewText ? `<button class="btn-outline" data-action="review-order" data-id="${order.id}">评价订单</button>` : ''}
            ${order.reviewText ? `<span class="badge">已评价 ${order.rating}⭐</span>` : ''}
            ${['PAID', 'SHIPPED', 'COMPLETED'].includes(order.status) && !order.hasInvoice ? `<button class="btn-outline" data-action="apply-invoice" data-id="${order.id}">申请发票</button>` : ''}
            ${order.hasInvoice ? `<span class="badge ${order.invoiceStatus === 'ISSUED' ? 'badge-active' : ''}">发票：${formatInvoiceStatus(order.invoiceStatus)}</span>` : ''}
          </div>
        </div>
      `
      )
      .join('');
  }

  function renderInvoices() {
    viewTitle.innerHTML = `
      <div>
        <h2 class="text-xl font-semibold">我的发票</h2>
        <p class="text-sm text-slate-500">发票申请记录与下载</p>
      </div>
    `;

    if (!state.user) {
      viewContent.innerHTML = `<div class="card p-6 text-slate-500">请先登录后查看发票。</div>`;
      return;
    }

    if (state.loading.invoices) {
      viewContent.innerHTML = `<div class="card p-6"><div class="animate-pulse space-y-4">
        ${Array.from({ length: 3 }).map(() => '<div class="h-24 bg-slate-200 rounded-xl"></div>').join('')}
      </div></div>`;
      return;
    }

    if (state.invoices.length === 0) {
      viewContent.innerHTML = `<div class="card p-6 text-slate-500">暂无发票记录</div>`;
      return;
    }

    viewContent.innerHTML = state.invoices
      .map(
        (invoice) => {
          const statusBadge = invoice.status === 'ISSUED'
            ? '<span class="badge badge-active">已开具</span>'
            : invoice.status === 'PENDING'
              ? '<span class="badge">待开具</span>'
              : '<span class="badge badge-inactive">已驳回</span>';

          return `
        <div class="card p-6 space-y-4">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p class="text-xs text-slate-400">发票申请号 ${invoice.id}</p>
              <h3 class="text-lg font-semibold">${formatInvoiceTitleType(invoice.titleType)} · ${invoice.titleName}</h3>
            </div>
            <div class="text-right">
              ${statusBadge}
              <p class="text-sm text-slate-500 mt-1">申请时间 ${new Date(invoice.createdAt).toLocaleString()}</p>
            </div>
          </div>
          <div class="grid md:grid-cols-3 gap-3 text-sm">
            <div class="bg-slate-50 rounded-xl p-3">
              <p class="text-xs text-slate-400">关联订单</p>
              <p class="font-medium">${invoice.orderId}</p>
            </div>
            <div class="bg-slate-50 rounded-xl p-3">
              <p class="text-xs text-slate-400">发票金额</p>
              <p class="font-medium">${formatCurrency(invoice.order?.total || 0)}</p>
            </div>
            <div class="bg-slate-50 rounded-xl p-3">
              <p class="text-xs text-slate-400">接收邮箱</p>
              <p class="font-medium">${invoice.email}</p>
            </div>
          </div>
          ${invoice.taxNumber ? `
          <div class="text-sm">
            <span class="text-slate-400">企业税号：</span>
            <span class="font-medium">${invoice.taxNumber}</span>
          </div>
          ` : ''}
          ${invoice.status === 'ISSUED' && invoice.invoiceNumber ? `
          <div class="text-sm">
            <span class="text-slate-400">发票号码：</span>
            <span class="font-medium">${invoice.invoiceNumber}</span>
          </div>
          <div class="bg-teal-50 border border-teal-100 rounded-xl p-3 text-sm text-teal-700 whitespace-pre-wrap">${escapeHtmlAttr(invoice.invoiceContent || '')}</div>
          ` : ''}
          ${invoice.status === 'REJECTED' && invoice.rejectReason ? `
          <div class="bg-red-50 border border-red-100 rounded-xl p-3 text-sm text-red-700">
            <p class="font-medium">驳回原因：</p>
            <p>${escapeHtmlAttr(invoice.rejectReason)}</p>
          </div>
          ` : ''}
          <div class="flex flex-wrap gap-2">
            ${invoice.status === 'ISSUED' ? `<button class="btn-primary" data-action="download-invoice" data-id="${invoice.id}">下载发票</button>` : ''}
            ${invoice.status === 'REJECTED' ? `<button class="btn-outline" data-action="apply-invoice" data-id="${invoice.orderId}">重新申请</button>` : ''}
          </div>
        </div>
      `;
        }
      )
      .join('');
  }

  function renderProfile() {
    viewTitle.innerHTML = `
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-xl font-semibold">个人中心</h2>
          <p class="text-sm text-slate-500">管理账户与地址信息</p>
        </div>
      </div>
    `;

    if (!state.user) {
      viewContent.innerHTML = `<div class="card p-6 text-slate-500">请先登录后查看个人信息。</div>`;
      return;
    }

    const editingAddress = state.profile.editingAddress;
    const addressList = state.addresses
      .map(
        (addr) => `
        <div class="border border-slate-200 rounded-xl p-3 flex flex-col gap-2 ${addr.isDefault ? 'address-default' : ''}">
          <p class="font-semibold">${addr.recipient} <span class="text-xs text-slate-500">${addr.phone}</span></p>
          <p class="text-sm text-slate-500">${addr.state}${addr.city}${addr.line1} ${addr.postalCode}</p>
          <div class="flex gap-2">
            <button class="btn-outline" data-action="set-default" data-id="${addr.id}">${addr.isDefault ? '默认地址' : '设为默认'}</button>
            <button class="btn-outline" data-action="edit-address" data-id="${addr.id}">编辑</button>
            <button class="btn-outline" data-action="delete-address" data-id="${addr.id}">删除</button>
          </div>
        </div>
      `
      )
      .join('');

    viewContent.innerHTML = `
      <div class="card p-6 space-y-4">
        <h3 class="text-lg font-semibold">账号信息</h3>
        <div class="grid md:grid-cols-3 gap-3">
          <div class="bg-slate-50 rounded-xl p-3">
            <p class="text-xs text-slate-400">用户名</p>
            <p class="font-semibold">${state.user.username}</p>
          </div>
          <div class="bg-slate-50 rounded-xl p-3">
            <p class="text-xs text-slate-400">邮箱</p>
            <p class="font-semibold">${state.user.email}</p>
          </div>
          <div class="bg-slate-50 rounded-xl p-3">
            <p class="text-xs text-slate-400">手机号</p>
            <p class="font-semibold">${state.user.phone}</p>
          </div>
        </div>
      </div>

      <div class="card p-6 space-y-4">
        <h3 class="text-lg font-semibold">${editingAddress ? '编辑配送地址' : '新增配送地址'}</h3>
        <div class="grid md:grid-cols-2 gap-3">${addressList || '<p class="text-slate-500">暂无地址</p>'}</div>
        <form data-form="address" class="grid md:grid-cols-2 gap-3" novalidate>
          <input type="hidden" name="addressId" value="${editingAddress?.id || ''}" />
          <div class="space-y-1">
            <input class="input" name="recipient" placeholder="收件人" value="${editingAddress?.recipient || ''}" required />
          </div>
          <div class="space-y-1">
            <input class="input" name="phone" placeholder="手机号" value="${editingAddress?.phone || ''}" required />
          </div>
          <div class="space-y-1 md:col-span-2">
            <input class="input" name="line1" placeholder="详细地址" value="${editingAddress?.line1 || ''}" required />
          </div>
          <div class="space-y-1">
            <input class="input" name="city" placeholder="城市" value="${editingAddress?.city || ''}" required />
          </div>
          <div class="space-y-1">
            <input class="input" name="state" placeholder="省份" value="${editingAddress?.state || ''}" required />
          </div>
          <div class="space-y-1">
            <input class="input" name="postalCode" placeholder="邮编" value="${editingAddress?.postalCode || ''}" required />
          </div>
          <label class="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" name="isDefault" ${editingAddress?.isDefault ? 'checked' : ''} /> 设为默认地址
          </label>
          <div class="md:col-span-2 flex justify-end gap-2">
            <button class="btn-primary" type="submit">${editingAddress ? '保存地址' : '新增地址'}</button>
            ${editingAddress ? '<button class="btn-outline" type="button" data-action="cancel-edit-address">取消编辑</button>' : ''}
          </div>
        </form>
      </div>
    `;
  }

  function renderAdmin() {
    viewTitle.innerHTML = `
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-xl font-semibold">管理控制台</h2>
          <p class="text-sm text-slate-500">书籍、分类与订单运营</p>
        </div>
      </div>
    `;

    if (!state.user || state.user.role !== 'ADMIN') {
      viewContent.innerHTML = `<div class="card p-6 text-slate-500">仅管理员可访问。</div>`;
      return;
    }

    const adminTabs = `
      <div class="flex flex-wrap gap-2">
        <button class="btn-outline" data-action="admin-tab" data-tab="books">书籍管理</button>
        <button class="btn-outline" data-action="admin-tab" data-tab="categories">分类管理</button>
        <button class="btn-outline" data-action="admin-tab" data-tab="orders">订单管理</button>
        <button class="btn-outline" data-action="admin-tab" data-tab="flash-sales">秒杀管理</button>
        <button class="btn-outline" data-action="admin-tab" data-tab="invoices">发票管理</button>
        <button class="btn-outline" data-action="admin-tab" data-tab="book-lists">书单管理</button>
        <button class="btn-outline" data-action="admin-tab" data-tab="qna">问答管理</button>
      </div>
    `;

    let content = '';
    if (state.admin.tab === 'books') {
      const categoryOptions = state.admin.categories
        .map(
          (cat) =>
            `<option value="${cat.id}" ${state.admin.editingBook?.category?.id === cat.id ? 'selected' : ''}>${cat.name}</option>`
        )
        .join('');

      const bookRows = state.admin.books
        .map(
          (book) => `
        <div class="border border-slate-200 rounded-xl p-4 flex flex-col gap-3 hover-card">
          <div class="flex justify-between">
            <div>
              <h4 class="font-semibold">${book.title}</h4>
              <p class="text-sm text-slate-500">${book.author} · ${book.isbn}</p>
            </div>
            <span class="badge ${book.status === 'ACTIVE' ? 'badge-active' : 'badge-inactive'}">${book.status === 'ACTIVE' ? '上架中' : '已下架'}</span>
          </div>
          <div class="flex flex-wrap gap-2 text-sm text-slate-600">
            <span>价格：${formatCurrency(book.price)}</span>
            <span>库存：${book.stock}</span>
            <span>分类：${book.category?.name || '-'}</span>
          </div>
          <div class="flex flex-wrap gap-2">
            <button class="btn-outline" data-action="edit-book" data-id="${book.id}">编辑</button>
            ${book.status === 'ACTIVE'
              ? `<button class="btn-outline" data-action="deactivate-book" data-id="${book.id}">下架</button>`
              : `<button class="btn-outline" data-action="restore-book" data-id="${book.id}">上架</button>`}
          </div>
        </div>
      `
        )
        .join('');

      content = `
        <div class="card p-6 space-y-4">
          <h3 class="text-lg font-semibold">${state.admin.editingBook ? '编辑书籍' : '新增书籍'}</h3>
          <form data-form="admin-book" class="grid md:grid-cols-2 gap-3" novalidate>
            <div class="space-y-1">
              <input class="input" name="title" placeholder="书名" value="${state.admin.editingBook?.title || ''}" required />
            </div>
            <div class="space-y-1">
              <input class="input" name="author" placeholder="作者" value="${state.admin.editingBook?.author || ''}" required />
            </div>
            <div class="space-y-1">
              <input class="input" name="isbn" placeholder="ISBN" value="${state.admin.editingBook?.isbn || ''}" required />
            </div>
            <div class="space-y-1">
              <input class="input" name="price" placeholder="价格" value="${state.admin.editingBook?.price || ''}" required />
            </div>
            <div class="space-y-1">
              <input class="input" name="stock" placeholder="库存" value="${state.admin.editingBook?.stock || ''}" required />
            </div>
            <div class="space-y-1">
              <select class="input" name="categoryId" required>
                <option value="">选择分类</option>
                ${categoryOptions}
              </select>
            </div>
            <div class="space-y-2">
              <input class="input" type="file" name="coverFile" accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml" />
              ${state.admin.editingBook?.coverUrl ? `<div class="flex items-center gap-3 text-xs text-slate-500"><img src="${state.admin.editingBook.coverUrl}" alt="cover" class="w-16 h-16 rounded-lg object-contain bg-white border border-slate-200" /><span>当前封面</span></div>` : '<p class="text-xs text-slate-500">支持 jpg/png/webp/gif/svg，最大 2MB</p>'}
            </div>
            <div class="space-y-1 md:col-span-2">
              <textarea class="input" name="description" placeholder="书籍简介" rows="3" required>${state.admin.editingBook?.description || ''}</textarea>
            </div>
            <div class="md:col-span-2 flex justify-end">
              <button class="btn-primary" type="submit">${state.admin.editingBook ? '保存修改' : '添加书籍'}</button>
            </div>
          </form>
        </div>
        <div class="grid lg:grid-cols-2 gap-4">${bookRows || '<div class="text-slate-500">暂无书籍</div>'}</div>
      `;
    }

    if (state.admin.tab === 'categories') {
      const categoryList = state.admin.categories
        .map(
          (cat) => `
        <div class="border border-slate-200 rounded-xl p-4 flex items-center justify-between hover-card">
          <span>${cat.name}</span>
          <button class="btn-outline" data-action="delete-category" data-id="${cat.id}">删除</button>
        </div>
      `
        )
        .join('');

      content = `
        <div class="card p-6 space-y-4">
          <h3 class="text-lg font-semibold">新增分类</h3>
          <form data-form="admin-category" class="flex flex-col md:flex-row gap-3" novalidate>
            <div class="flex-1 space-y-1">
              <input class="input" name="name" placeholder="分类名称" required />
            </div>
            <button class="btn-primary" type="submit">添加</button>
          </form>
        </div>
        <div class="grid md:grid-cols-2 gap-4">${categoryList || '<div class="text-slate-500">暂无分类</div>'}</div>
      `;
    }

    if (state.admin.tab === 'orders') {
      const stats = state.admin.stats || { statusCounts: {}, revenue: 0 };
      const orderCards = state.admin.orders
        .map(
          (order) => `
        <div class="border border-slate-200 rounded-xl p-4 space-y-3 hover-card">
          <div class="flex justify-between">
            <div>
              <p class="text-xs text-slate-400">订单号 ${order.id}</p>
              <p class="font-semibold">${order.user.username} · ${formatStatus(order.status)}</p>
            </div>
            <p class="font-semibold">${formatCurrency(order.total)}</p>
          </div>
          <div class="text-xs text-slate-500">${order.recipient} ${order.phone}</div>
          <div class="flex flex-wrap gap-2">
            ${order.status === 'PENDING_PAYMENT' ? `<button class="btn-outline" data-action="admin-accept" data-id="${order.id}">接单</button>` : ''}
            ${order.status === 'PAID' ? `<button class="btn-outline" data-action="admin-ship" data-id="${order.id}">发货</button>` : ''}
            ${['PAID', 'SHIPPED'].includes(order.status) ? `<button class="btn-outline" data-action="admin-refund" data-id="${order.id}">退款</button>` : ''}
          </div>
        </div>
      `
        )
        .join('');

      content = `
        <div class="card p-6 space-y-4">
          <div class="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 class="text-lg font-semibold">订单统计</h3>
              <p class="text-sm text-slate-500">实时订单数据与收入</p>
            </div>
            <button class="btn-outline" data-action="export-orders">导出报表</button>
          </div>
          <div class="grid md:grid-cols-4 gap-3">
            ${Object.entries(stats.statusCounts)
              .map(
                ([key, value]) => `
              <div class="bg-slate-50 rounded-xl p-3">
                <p class="text-xs text-slate-400">${formatStatus(key)}</p>
                <p class="text-lg font-semibold">${value}</p>
              </div>
            `
              )
              .join('')}
            <div class="bg-slate-50 rounded-xl p-3">
              <p class="text-xs text-slate-400">累计收入</p>
              <p class="text-lg font-semibold">${formatCurrency(stats.revenue)}</p>
            </div>
          </div>
        </div>
        <div class="grid lg:grid-cols-2 gap-4">${orderCards || '<div class="text-slate-500">暂无订单</div>'}</div>
      `;
    }

    if (state.admin.tab === 'flash-sales') {
      const bookOptions = state.admin.books
        .filter(book => book.status === 'ACTIVE')
        .map(
          (book) =>
            `<option value="${book.id}" ${state.admin.editingFlashSale?.bookId === book.id ? 'selected' : ''}>${book.title} - ${formatCurrency(book.price)}</option>`
        )
        .join('');

      const editing = state.admin.editingFlashSale;
      const now = new Date();
      const defaultStartTime = editing?.startTime 
        ? new Date(editing.startTime).toISOString().slice(0, 16)
        : new Date(now.getTime() + 5 * 60000).toISOString().slice(0, 16);
      const defaultEndTime = editing?.endTime
        ? new Date(editing.endTime).toISOString().slice(0, 16)
        : new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString().slice(0, 16);

      const flashSaleRows = state.admin.flashSales
        .map(
          (fs) => {
            const statusInfo = getFlashSaleStatus(fs);
            const statusBadge = statusInfo.status === 'ONGOING' 
              ? '<span class="badge badge-active">进行中</span>'
              : statusInfo.status === 'UPCOMING'
                ? '<span class="badge">即将开始</span>'
                : '<span class="badge badge-inactive">已结束</span>';
            
            return `
        <div class="border border-slate-200 rounded-xl p-4 flex flex-col gap-3 hover-card">
          <div class="flex justify-between items-start">
            <div>
              <h4 class="font-semibold">${fs.book?.title || '未知书籍'}</h4>
              <p class="text-sm text-slate-500">${fs.book?.author || ''}</p>
            </div>
            ${statusBadge}
          </div>
          <div class="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
            <div>
              <p class="text-xs text-slate-400">秒杀价</p>
              <p class="font-semibold text-red-500">${formatCurrency(fs.salePrice)}</p>
            </div>
            <div>
              <p class="text-xs text-slate-400">原价</p>
              <p class="text-slate-500 line-through">${formatCurrency(fs.originalPrice || 0)}</p>
            </div>
            <div>
              <p class="text-xs text-slate-400">库存/已售</p>
              <p>${fs.remainingStock || (fs.stock - fs.soldCount)} / ${fs.soldCount}</p>
            </div>
            <div>
              <p class="text-xs text-slate-400">每人限购</p>
              <p>${fs.perUserLimit} 件</p>
            </div>
          </div>
          <div class="text-xs text-slate-500">
            <span>开始：${new Date(fs.startTime).toLocaleString()}</span>
            <span class="mx-2">|</span>
            <span>结束：${new Date(fs.endTime).toLocaleString()}</span>
          </div>
          <div class="flex flex-wrap gap-2">
            <button class="btn-outline" data-action="edit-flash-sale" data-id="${fs.id}">编辑</button>
            ${fs.soldCount === 0 ? `<button class="btn-outline" data-action="delete-flash-sale" data-id="${fs.id}">删除</button>` : ''}
          </div>
        </div>
      `;
          }
        )
        .join('');

      content = `
        <div class="card p-6 space-y-4">
          <h3 class="text-lg font-semibold">${editing ? '编辑秒杀场次' : '新增秒杀场次'}</h3>
          <form data-form="admin-flash-sale" class="grid md:grid-cols-2 gap-3" novalidate>
            <input type="hidden" name="flashSaleId" value="${editing?.id || ''}" />
            <div class="space-y-1 md:col-span-2">
              <label class="text-sm text-slate-600">参与书籍</label>
              <select class="input" name="bookId" required>
                <option value="">请选择书籍</option>
                ${bookOptions}
              </select>
            </div>
            <div class="space-y-1">
              <label class="text-sm text-slate-600">秒杀价</label>
              <input class="input" name="salePrice" type="number" step="0.01" placeholder="秒杀价格" value="${editing?.salePrice || ''}" required />
            </div>
            <div class="space-y-1">
              <label class="text-sm text-slate-600">秒杀库存</label>
              <input class="input" name="stock" type="number" placeholder="秒杀库存数量" value="${editing?.stock || ''}" required />
            </div>
            <div class="space-y-1">
              <label class="text-sm text-slate-600">开始时间</label>
              <input class="input" name="startTime" type="datetime-local" value="${defaultStartTime}" required />
            </div>
            <div class="space-y-1">
              <label class="text-sm text-slate-600">结束时间</label>
              <input class="input" name="endTime" type="datetime-local" value="${defaultEndTime}" required />
            </div>
            <div class="space-y-1">
              <label class="text-sm text-slate-600">每人限购</label>
              <input class="input" name="perUserLimit" type="number" placeholder="每人限购数量" value="${editing?.perUserLimit || 1}" required />
            </div>
            <div class="md:col-span-2 flex justify-end gap-2">
              ${editing ? '<button class="btn-outline" type="button" data-action="cancel-edit-flash-sale">取消编辑</button>' : ''}
              <button class="btn-primary" type="submit">${editing ? '保存修改' : '创建秒杀'}</button>
            </div>
          </form>
        </div>
        <div class="grid lg:grid-cols-2 gap-4">${flashSaleRows || '<div class="text-slate-500">暂无秒杀场次</div>'}</div>
      `;
    }

    if (state.admin.tab === 'invoices') {
      const stats = state.admin.invoiceStats || { statusCounts: {} };
      const invoiceCards = state.admin.invoices
        .map(
          (invoice) => {
            const statusBadge = invoice.status === 'ISSUED'
              ? '<span class="badge badge-active">已开具</span>'
              : invoice.status === 'PENDING'
                ? '<span class="badge">待开具</span>'
                : '<span class="badge badge-inactive">已驳回</span>';

            return `
        <div class="border border-slate-200 rounded-xl p-4 space-y-3 hover-card">
          <div class="flex justify-between items-start">
            <div>
              <p class="text-xs text-slate-400">发票申请号 ${invoice.id}</p>
              <p class="font-semibold">${formatInvoiceTitleType(invoice.titleType)} · ${invoice.titleName}</p>
            </div>
            ${statusBadge}
          </div>
          <div class="text-xs text-slate-500">
            <p>申请人：${invoice.user?.username || '-'} (${invoice.user?.email || '-'})</p>
            <p>订单号：${invoice.orderId}</p>
            <p>订单金额：${formatCurrency(invoice.order?.total || 0)}</p>
            <p>接收邮箱：${invoice.email}</p>
          </div>
          ${invoice.taxNumber ? `<p class="text-xs text-slate-500">税号：${invoice.taxNumber}</p>` : ''}
          ${invoice.invoiceNumber ? `<p class="text-xs text-slate-500">发票号码：${invoice.invoiceNumber}</p>` : ''}
          ${invoice.status === 'REJECTED' && invoice.rejectReason ? `
          <p class="text-xs text-red-600">驳回原因：${escapeHtmlAttr(invoice.rejectReason)}</p>
          ` : ''}
          <div class="flex flex-wrap gap-2">
            ${invoice.status === 'PENDING' ? `<button class="btn-primary" data-action="admin-issue-invoice" data-id="${invoice.id}">开具发票</button>` : ''}
            ${invoice.status === 'PENDING' ? `<button class="btn-outline" data-action="admin-reject-invoice" data-id="${invoice.id}">驳回</button>` : ''}
            ${invoice.status === 'ISSUED' ? `<button class="btn-outline" data-action="admin-view-invoice" data-id="${invoice.id}">查看发票</button>` : ''}
          </div>
        </div>
      `;
          }
        )
        .join('');

      content = `
        <div class="card p-6 space-y-4">
          <div class="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 class="text-lg font-semibold">发票统计</h3>
              <p class="text-sm text-slate-500">发票申请与开具情况</p>
            </div>
          </div>
          <div class="grid md:grid-cols-3 gap-3">
            ${['PENDING', 'ISSUED', 'REJECTED'].map(status => `
              <div class="bg-slate-50 rounded-xl p-3">
                <p class="text-xs text-slate-400">${formatInvoiceStatus(status)}</p>
                <p class="text-lg font-semibold">${stats.statusCounts?.[status] || 0}</p>
              </div>
            `).join('')}
          </div>
        </div>
        <div class="grid lg:grid-cols-2 gap-4">${invoiceCards || '<div class="text-slate-500">暂无发票申请</div>'}</div>
      `;
    }

    if (state.admin.tab === 'book-lists') {
      const editing = state.admin.editingBookList;
      const selected = state.admin.selectedBookList;

      if (selected) {
        const availableBooks = state.admin.books
          .filter(book => book.status === 'ACTIVE' && !selected.items.some(item => item.bookId === book.id));
        
        const bookOptions = availableBooks
          .map(book => `<option value="${book.id}">${book.title} - ${formatCurrency(book.price)}</option>`)
          .join('');

        const bookItems = selected.items
          .map((item, index) => {
            const book = item.book;
            if (!book) return '';
            
            const statusBadge = book.status === 'ACTIVE'
              ? '<span class="badge badge-active">在售</span>'
              : '<span class="badge badge-inactive">已下架</span>';

            return `
              <div class="border border-slate-200 rounded-xl p-4 flex flex-col md:flex-row md:items-center gap-4 hover-card" data-book-id="${book.id}">
                <div class="flex items-center gap-3">
                  <button class="btn-outline text-sm px-2 py-1" data-action="move-book-up" data-id="${book.id}" ${index === 0 ? 'disabled' : ''}>↑</button>
                  <button class="btn-outline text-sm px-2 py-1" data-action="move-book-down" data-id="${book.id}" ${index === selected.items.length - 1 ? 'disabled' : ''}>↓</button>
                  <span class="w-8 text-center font-semibold text-slate-400">${index + 1}</span>
                </div>
                <img src="${book.coverUrl}" alt="${book.title}" class="w-16 h-16 object-contain rounded-lg bg-white" />
                <div class="flex-1">
                  <p class="font-semibold">${book.title}</p>
                  <p class="text-xs text-slate-500">${book.author}</p>
                  <div class="flex gap-2 mt-1">
                    ${statusBadge}
                    <span class="badge">${formatCurrency(book.price)}</span>
                  </div>
                </div>
                <div class="flex gap-2">
                  <button class="btn-outline" data-action="remove-book-from-list" data-id="${book.id}">移除</button>
                </div>
              </div>
            `;
          })
          .join('');

        content = `
          <div class="card p-6 space-y-4">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-4">
                <button class="btn-outline" data-action="back-to-book-lists">← 返回书单列表</button>
                <div>
                  <h3 class="text-lg font-semibold">管理书单：${selected.title}</h3>
                  <p class="text-sm text-slate-500">添加、移除书籍或调整顺序</p>
                </div>
              </div>
              <span class="badge ${selected.status === 'PUBLISHED' ? 'badge-active' : ''}">${formatBookListStatus(selected.status)}</span>
            </div>
          </div>

          <div class="card p-6 space-y-4">
            <h3 class="text-lg font-semibold">添加书籍</h3>
            <form data-form="admin-add-book-to-list" class="flex flex-col md:flex-row gap-3" novalidate>
              <input type="hidden" name="bookListId" value="${selected.id}" />
              <div class="flex-1">
                <select class="input" name="bookId" required>
                  <option value="">选择要添加的书籍</option>
                  ${bookOptions || '<option value="" disabled>没有可添加的书籍</option>'}
                </select>
              </div>
              <button class="btn-primary" type="submit" ${availableBooks.length === 0 ? 'disabled' : ''}>添加</button>
            </form>
          </div>

          <div class="card p-6 space-y-4">
            <div class="flex items-center justify-between">
              <h3 class="text-lg font-semibold">书单书籍（${selected.items.length} 本）</h3>
              <p class="text-xs text-slate-500">拖拽或使用上下箭头调整顺序</p>
            </div>
            ${selected.items.length === 0 ? '<p class="text-slate-500">书单为空，请添加书籍</p>' : `<div class="space-y-3">${bookItems}</div>`}
          </div>

          <div class="card p-6 space-y-4">
            <h3 class="text-lg font-semibold">书单操作</h3>
            <div class="flex flex-wrap gap-2">
              ${selected.status === 'DRAFT' ? `<button class="btn-primary" data-action="publish-book-list" data-id="${selected.id}">上线书单</button>` : ''}
              ${selected.status === 'PUBLISHED' ? `<button class="btn-outline" data-action="unpublish-book-list" data-id="${selected.id}">下线书单</button>` : ''}
              <button class="btn-outline" data-action="edit-book-list" data-id="${selected.id}">编辑信息</button>
              <button class="btn-outline text-red-600" data-action="delete-book-list" data-id="${selected.id}">删除书单</button>
            </div>
          </div>
        `;
      } else if (editing) {
        content = `
          <div class="card p-6 space-y-4">
            <div class="flex items-center gap-4">
              <button class="btn-outline" data-action="back-to-book-lists">← 返回书单列表</button>
              <h3 class="text-lg font-semibold">${editing.id ? '编辑书单' : '新增书单'}</h3>
            </div>
            <form data-form="admin-book-list" class="grid md:grid-cols-2 gap-3" novalidate>
              <input type="hidden" name="bookListId" value="${editing.id || ''}" />
              <div class="space-y-1 md:col-span-2">
                <label class="text-sm text-slate-600">书单标题</label>
                <input class="input" name="title" placeholder="书单标题" value="${escapeHtmlAttr(editing.title || '')}" required />
              </div>
              <div class="space-y-2">
                <label class="text-sm text-slate-600">封面图片</label>
                <input class="input" type="file" name="coverFile" accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml" />
                ${editing.coverUrl ? `<div class="flex items-center gap-3 text-xs text-slate-500"><img src="${editing.coverUrl}" alt="cover" class="w-16 h-16 rounded-lg object-contain bg-white border border-slate-200" /><span>当前封面</span></div>` : '<p class="text-xs text-slate-500">支持 jpg/png/webp/gif/svg，最大 2MB</p>'}
                <input type="hidden" name="coverUrl" value="${escapeHtmlAttr(editing.coverUrl || '')}" />
              </div>
              <div class="space-y-1">
                <label class="text-sm text-slate-600">排序值</label>
                <input class="input" name="sortOrder" type="number" min="0" placeholder="排序值，数字越小越靠前" value="${editing.sortOrder ?? 0}" required />
              </div>
              <div class="space-y-1 md:col-span-2">
                <label class="text-sm text-slate-600">书单简介</label>
                <textarea class="input" name="description" placeholder="书单简介" rows="3" required>${escapeHtmlAttr(editing.description || '')}</textarea>
              </div>
              <div class="md:col-span-2 flex justify-end gap-2">
                <button class="btn-outline" type="button" data-action="cancel-edit-book-list">取消</button>
                <button class="btn-primary" type="submit">${editing.id ? '保存修改' : '创建书单'}</button>
              </div>
            </form>
          </div>
        `;
      } else {
        const bookListRows = state.admin.bookLists
          .map(
            (list) => {
              const statusBadge = list.status === 'PUBLISHED'
                ? '<span class="badge badge-active">已上线</span>'
                : list.status === 'DRAFT'
                  ? '<span class="badge">草稿</span>'
                  : '<span class="badge badge-inactive">已归档</span>';

              return `
                <div class="border border-slate-200 rounded-xl p-4 flex flex-col gap-3 hover-card">
                  <div class="flex gap-4">
                    <div class="w-24 h-32 rounded-xl overflow-hidden bg-slate-100 flex-shrink-0">
                      <img src="${list.coverUrl}" alt="${list.title}" class="w-full h-full object-cover" />
                    </div>
                    <div class="flex-1 min-w-0">
                      <div class="flex justify-between items-start">
                        <div>
                          <h4 class="font-semibold">${list.title}</h4>
                          <p class="text-sm text-slate-500 line-clamp-2">${list.description}</p>
                        </div>
                        ${statusBadge}
                      </div>
                      <div class="flex flex-wrap gap-2 mt-2 text-sm text-slate-600">
                        <span>书籍数：${list.itemCount}</span>
                        <span>排序：${list.sortOrder}</span>
                        <span>创建时间：${new Date(list.createdAt).toLocaleDateString()}</span>
                      </div>
                      <div class="flex flex-wrap gap-2 mt-3">
                        <button class="btn-outline" data-action="manage-book-list" data-id="${list.id}">管理书籍</button>
                        <button class="btn-outline" data-action="edit-book-list" data-id="${list.id}">编辑</button>
                        ${list.status === 'DRAFT' ? `<button class="btn-primary" data-action="publish-book-list" data-id="${list.id}">上线</button>` : ''}
                        ${list.status === 'PUBLISHED' ? `<button class="btn-outline" data-action="unpublish-book-list" data-id="${list.id}">下线</button>` : ''}
                        <button class="btn-outline text-red-600" data-action="delete-book-list" data-id="${list.id}">删除</button>
                      </div>
                    </div>
                  </div>
                </div>
              `;
            }
          )
          .join('');

        content = `
          <div class="card p-6 space-y-4">
            <div class="flex items-center justify-between">
              <h3 class="text-lg font-semibold">书单管理</h3>
              <button class="btn-primary" data-action="create-book-list">+ 新增书单</button>
            </div>
          </div>
          <div class="space-y-4">${bookListRows || '<div class="card p-6 text-slate-500">暂无书单，请创建新书单</div>'}</div>
        `;
      }
    }

    if (state.admin.tab === 'qna') {
      const qnaStats = state.admin.qnaStats || {};
      const qnaTab = state.admin.qnaTab || 'questions';

      let qnaSubTabs = `
        <div class="flex gap-2 mb-4">
          <button class="btn-outline text-sm ${qnaTab === 'questions' ? 'btn-primary' : ''}" data-action="admin-qna-tab" data-tab="questions">问题管理 (${qnaStats.questionCount || 0})</button>
          <button class="btn-outline text-sm ${qnaTab === 'answers' ? 'btn-primary' : ''}" data-action="admin-qna-tab" data-tab="answers">回答管理 (${qnaStats.answerCount || 0})</button>
        </div>
      `;

      let qnaStatsHtml = `
        <div class="card p-5 mb-4">
          <div class="grid md:grid-cols-5 gap-3">
            <div class="bg-slate-50 rounded-xl p-3">
              <p class="text-xs text-slate-400">问题总数</p>
              <p class="text-xl font-semibold">${qnaStats.questionCount || 0}</p>
            </div>
            <div class="bg-slate-50 rounded-xl p-3">
              <p class="text-xs text-slate-400">回答总数</p>
              <p class="text-xl font-semibold">${qnaStats.answerCount || 0}</p>
            </div>
            <div class="bg-slate-50 rounded-xl p-3">
              <p class="text-xs text-slate-400">点赞总数</p>
              <p class="text-xl font-semibold">${qnaStats.totalLikes || 0}</p>
            </div>
            <div class="bg-teal-50 rounded-xl p-3">
              <p class="text-xs text-slate-400">近7天新问题</p>
              <p class="text-xl font-semibold text-teal-700">${qnaStats.recentQuestions || 0}</p>
            </div>
            <div class="bg-teal-50 rounded-xl p-3">
              <p class="text-xs text-slate-400">近7天新回答</p>
              <p class="text-xl font-semibold text-teal-700">${qnaStats.recentAnswers || 0}</p>
            </div>
          </div>
        </div>
      `;

      let qnaListHtml = '';
      if (qnaTab === 'questions') {
        const questionRows = (state.admin.questions || [])
          .map(
            (q) => `
            <div class="border border-slate-200 rounded-xl p-4 flex flex-col gap-3 hover-card">
              <div class="flex justify-between items-start gap-3">
                <div class="flex-1 min-w-0">
                  <p class="font-medium text-slate-800 whitespace-pre-wrap break-words">${escapeHtmlAttr(q.content)}</p>
                  <div class="flex flex-wrap gap-2 mt-2 text-xs text-slate-500">
                    <span>书籍：${q.book?.title || '-'}</span>
                    <span>提问人：${q.user?.username || '-'}</span>
                    <span>时间：${new Date(q.createdAt).toLocaleString()}</span>
                  </div>
                </div>
                <div class="flex flex-wrap gap-2 items-center flex-shrink-0">
                  <span class="badge">${q.answerCount || 0} 回答</span>
                  <button class="btn-outline text-red-600 text-sm" data-action="admin-delete-question" data-id="${q.id}">删除</button>
                </div>
              </div>
            </div>
          `
          )
          .join('');

        qnaListHtml = `
          <div class="card p-5 space-y-4">
            <h3 class="text-lg font-semibold">问题列表</h3>
            <div class="space-y-3">
              ${questionRows || '<div class="text-slate-500 text-center py-6">暂无问题</div>'}
            </div>
          </div>
        `;
      } else {
        const answerRows = (state.admin.answers || [])
          .map(
            (a) => `
            <div class="border border-slate-200 rounded-xl p-4 flex flex-col gap-3 hover-card">
              <div class="flex justify-between items-start gap-3">
                <div class="flex-1 min-w-0">
                  <p class="font-medium text-slate-800 whitespace-pre-wrap break-words">${escapeHtmlAttr(a.content)}</p>
                  <div class="flex flex-wrap gap-2 mt-2 text-xs text-slate-500">
                    <span>书籍：${a.question?.book?.title || '-'}</span>
                    <span>问题：${escapeHtmlAttr(a.question?.content || '').slice(0, 50)}...</span>
                    <span>回答人：${a.user?.username || '-'}</span>
                    <span>时间：${new Date(a.createdAt).toLocaleString()}</span>
                  </div>
                </div>
                <div class="flex flex-wrap gap-2 items-center flex-shrink-0">
                  <span class="badge">👍 ${a.likeCount || 0}</span>
                  <button class="btn-outline text-red-600 text-sm" data-action="admin-delete-answer" data-id="${a.id}">删除</button>
                </div>
              </div>
            </div>
          `
          )
          .join('');

        qnaListHtml = `
          <div class="card p-5 space-y-4">
            <h3 class="text-lg font-semibold">回答列表</h3>
            <div class="space-y-3">
              ${answerRows || '<div class="text-slate-500 text-center py-6">暂无回答</div>'}
            </div>
          </div>
        `;
      }

      content = qnaStatsHtml + qnaSubTabs + qnaListHtml;
    }

    viewContent.innerHTML = `${adminTabs}${content}`;
  }

  function renderBookLists() {
    viewTitle.innerHTML = `
      <div>
        <h2 class="text-xl font-semibold">专题书单</h2>
        <p class="text-sm text-slate-500">精选好书合集，发现更多精彩</p>
      </div>
    `;

    if (state.loading.bookLists) {
      viewContent.innerHTML = renderSkeleton();
      return;
    }

    if (state.bookLists.length === 0) {
      viewContent.innerHTML = `<div class="card p-6 text-slate-500">暂无专题书单</div>`;
      return;
    }

    const bookListCards = state.bookLists
      .map(
        (list) => `
        <div class="card hover-card p-4 flex flex-col gap-3 cursor-pointer" data-action="view-book-list" data-id="${list.id}">
          <div class="rounded-xl overflow-hidden h-44 bg-slate-100">
            <img src="${list.coverUrl}" alt="${list.title}" class="w-full h-full object-cover" />
          </div>
          <div>
            <h3 class="font-semibold text-lg">${list.title}</h3>
            <p class="text-sm text-slate-500 line-clamp-2">${list.description}</p>
            <div class="flex flex-wrap gap-2 mt-2">
              <span class="badge">${list.itemCount} 本书</span>
              <span class="badge">更新于 ${new Date(list.createdAt).toLocaleDateString()}</span>
            </div>
          </div>
          <button class="btn-primary mt-auto" data-action="view-book-list" data-id="${list.id}">查看详情</button>
        </div>
      `
      )
      .join('');

    viewContent.innerHTML = `<div class="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">${bookListCards}</div>`;
  }

  function renderBookListDetail() {
    const list = state.currentBookList;

    if (!list) {
      viewContent.innerHTML = `<div class="card p-6 text-slate-500">书单不存在</div>`;
      return;
    }

    viewTitle.innerHTML = `
      <div class="flex items-center gap-4">
        <button class="btn-outline" data-action="back-to-book-lists">← 返回列表</button>
        <div>
          <h2 class="text-xl font-semibold">${list.title}</h2>
          <p class="text-sm text-slate-500">${list.description}</p>
        </div>
      </div>
    `;

    if (state.loading.bookListDetail) {
      viewContent.innerHTML = renderSkeleton();
      return;
    }

    const activeItems = list.items.filter(item => item.book?.isActive);
    const inactiveItems = list.items.filter(item => item.book && !item.book.isActive);

    if (list.items.length === 0) {
      viewContent.innerHTML = `
        <div class="card p-6">
          <div class="text-center py-10">
            <p class="text-slate-500">该书单暂无书籍</p>
          </div>
        </div>
      `;
      return;
    }

    const activeBookCards = activeItems
      .map(
        (item) => `
        <div class="card hover-card p-4 flex flex-col gap-3">
          <div class="rounded-xl overflow-hidden h-44 bg-slate-100">
            <img src="${item.book.coverUrl}" alt="${item.book.title}" class="w-full h-full object-contain" />
          </div>
          <div>
            <h3 class="font-semibold text-lg">${item.book.title}</h3>
            <p class="text-sm text-slate-500">${item.book.author}</p>
            <div class="flex flex-wrap gap-2 mt-2">
              <span class="badge">库存 ${item.book.stock}</span>
            </div>
          </div>
          <div class="flex items-center justify-between">
            <p class="text-lg font-semibold text-slate-900">${formatCurrency(item.book.price)}</p>
            <button class="btn-primary" data-action="add-to-cart" data-id="${item.bookId}">加入购物车</button>
          </div>
        </div>
      `
      )
      .join('');

    const inactiveBookCards = inactiveItems.length > 0 ? `
      <div class="card p-5">
        <h3 class="text-lg font-semibold mb-4 text-slate-500">以下书籍已下架</h3>
        <div class="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          ${inactiveItems
            .map(
              (item) => `
            <div class="card p-4 flex flex-col gap-3 opacity-60">
              <div class="rounded-xl overflow-hidden h-44 bg-slate-100">
                <img src="${item.book.coverUrl}" alt="${item.book.title}" class="w-full h-full object-contain grayscale" />
              </div>
              <div>
                <h3 class="font-semibold text-lg">${item.book.title}</h3>
                <p class="text-sm text-slate-500">${item.book.author}</p>
                <div class="flex flex-wrap gap-2 mt-2">
                  <span class="badge badge-inactive">已下架</span>
                </div>
              </div>
              <div class="flex items-center justify-between">
                <p class="text-lg font-semibold text-slate-400 line-through">${formatCurrency(item.book.price)}</p>
                <button class="btn-outline" disabled>暂不可购</button>
              </div>
            </div>
          `
            )
            .join('')}
        </div>
      </div>
    ` : '';

    viewContent.innerHTML = `
      <div class="card p-5 mb-4">
        <div class="flex flex-col md:flex-row gap-6">
          <div class="w-full md:w-48 h-64 rounded-xl overflow-hidden bg-slate-100 flex-shrink-0">
            <img src="${list.coverUrl}" alt="${list.title}" class="w-full h-full object-cover" />
          </div>
          <div class="flex-1">
            <h2 class="text-2xl font-bold mb-2">${list.title}</h2>
            <p class="text-slate-600 mb-4">${list.description}</p>
            <div class="flex flex-wrap gap-2">
              <span class="badge">共 ${list.itemCount} 本书</span>
              <span class="badge">${activeItems.length} 本可购买</span>
              <span class="badge">更新于 ${new Date(list.createdAt).toLocaleDateString()}</span>
            </div>
          </div>
        </div>
      </div>
      ${activeItems.length > 0 ? `
        <div class="card p-5">
          <h3 class="text-lg font-semibold mb-4">书单书籍</h3>
          <div class="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">${activeBookCards}</div>
        </div>
      ` : ''}
      ${inactiveBookCards}
    `;
  }

  function renderBookDetail() {
    const book = state.currentBook;
    const questions = state.bookQuestions.items || [];
    const qnaSort = state.bookQuestions.sort || 'time';
    const currentPage = state.bookQuestions.page || 1;
    const totalPages = state.bookQuestions.totalPages || 0;
    const total = state.bookQuestions.total || 0;

    viewTitle.innerHTML = `
      <div class="flex items-center gap-4">
        <button class="btn-outline" data-action="back-to-books">← 返回列表</button>
        <div>
          <h2 class="text-xl font-semibold">书籍详情</h2>
          <p class="text-sm text-slate-500">查看书籍信息与读者问答</p>
        </div>
      </div>
    `;

    if (state.loading.bookDetail || state.bookQuestions.loading) {
      viewContent.innerHTML = `
        <div class="card p-6">
          <div class="animate-pulse space-y-6">
            <div class="flex gap-6">
              <div class="w-48 h-64 bg-slate-200 rounded-xl"></div>
              <div class="flex-1 space-y-4">
                <div class="h-8 bg-slate-200 rounded w-3/4"></div>
                <div class="h-4 bg-slate-100 rounded w-1/2"></div>
                <div class="h-32 bg-slate-100 rounded"></div>
              </div>
            </div>
            <div class="h-96 bg-slate-100 rounded-xl"></div>
          </div>
        </div>
      `;
      return;
    }

    if (!book) {
      viewContent.innerHTML = `<div class="card p-6 text-slate-500">书籍不存在或已下架</div>`;
      return;
    }

    const questionItemsHtml = questions.map((q) => {
      const answersHtml = (q.answers || []).map((a) => {
        const likeBtnClass = a.hasLiked ? 'btn-primary' : 'btn-outline';
        const adminBadge = a.isAdmin ? '<span class="badge badge-active ml-2">管理员</span>' : '';
        return `
          <div class="border-l-4 border-slate-200 pl-4 py-3">
            <div class="flex items-start justify-between gap-3">
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 mb-1">
                  <span class="text-sm font-medium text-slate-700">${escapeHtmlAttr(a.user?.username || '匿名用户')}</span>
                  ${adminBadge}
                  <span class="text-xs text-slate-400">${new Date(a.createdAt).toLocaleString()}</span>
                </div>
                <p class="text-sm text-slate-700 whitespace-pre-wrap break-words">${escapeHtmlAttr(a.content)}</p>
              </div>
              <button 
                class="${likeBtnClass} text-sm flex-shrink-0 flex items-center gap-1" 
                data-action="like-answer" 
                data-id="${a.id}"
                data-liked="${a.hasLiked}"
              >
                <span>${a.hasLiked ? '❤️' : '🤍'}</span>
                <span>${a.likeCount || 0}</span>
              </button>
            </div>
          </div>
        `;
      }).join('');

      const noAnswers = (q.answers || []).length === 0 ? '<p class="text-sm text-slate-400 py-2">暂无回答，快来抢沙发！</p>' : '';

      return `
        <div class="border border-slate-200 rounded-xl p-5 space-y-4 bg-white">
          <div class="flex items-start justify-between gap-3">
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 mb-2">
                <span class="text-sm font-semibold text-slate-800">${escapeHtmlAttr(q.user?.username || '匿名用户')}</span>
                <span class="text-xs text-slate-400">${new Date(q.createdAt).toLocaleString()}</span>
                <span class="badge ml-auto">${q.answerCount || 0} 个回答</span>
              </div>
              <p class="text-slate-800 whitespace-pre-wrap break-words">${escapeHtmlAttr(q.content)}</p>
            </div>
          </div>
          
          <div class="space-y-2">
            ${answersHtml}
            ${noAnswers}
          </div>

          <form data-form="answer" data-question-id="${q.id}" class="space-y-3 pt-2 border-t border-slate-100" novalidate>
            <textarea 
              class="input" 
              name="content" 
              rows="2" 
              placeholder="写下你的回答...（管理员或已购买过的用户可回答）" 
              required
            ></textarea>
            <div class="flex justify-end">
              <button class="btn-primary text-sm" type="submit">提交回答</button>
            </div>
          </form>
        </div>
      `;
    }).join('');

    const paginationHtml = totalPages > 1 ? `
      <div class="flex justify-center items-center gap-2 pt-4">
        <button 
          class="btn-outline" 
          data-action="qna-prev-page"
          ${currentPage <= 1 ? 'disabled' : ''}
        >上一页</button>
        <span class="text-sm text-slate-500">第 ${currentPage} / ${totalPages} 页（共 ${total} 个问题）</span>
        <button 
          class="btn-outline" 
          data-action="qna-next-page"
          ${currentPage >= totalPages ? 'disabled' : ''}
        >下一页</button>
      </div>
    ` : '';

    viewContent.innerHTML = `
      <div class="card p-6 mb-6">
        <div class="flex flex-col md:flex-row gap-8">
          <div class="w-full md:w-56 h-72 rounded-xl overflow-hidden bg-slate-100 flex-shrink-0 mx-auto md:mx-0">
            <img src="${book.coverUrl}" alt="${book.title}" class="w-full h-full object-contain" />
          </div>
          <div class="flex-1 space-y-4">
            <div>
              <h2 class="text-2xl font-bold mb-1">${book.title}</h2>
              <p class="text-slate-500">${book.author}</p>
            </div>
            <div class="flex flex-wrap gap-3">
              <span class="badge badge-active">${book.category?.name || '未分类'}</span>
              <span class="badge">库存 ${book.stock} 本</span>
              <span class="badge">销量 ${book.sales}</span>
              <span class="badge">ISBN: ${book.isbn}</span>
            </div>
            <div class="pt-2">
              <p class="text-xs text-slate-400 mb-1">简介</p>
              <p class="text-slate-700 whitespace-pre-wrap">${escapeHtmlAttr(book.description)}</p>
            </div>
            <div class="flex items-center gap-4 pt-2">
              <p class="text-3xl font-bold text-red-500">${formatCurrency(book.price)}</p>
              <button class="btn-primary text-lg px-6" data-action="add-to-cart" data-id="${book.id}">加入购物车</button>
            </div>
          </div>
        </div>
      </div>

      <div class="card p-6">
        <div class="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <h3 class="text-xl font-semibold">💬 读者问答</h3>
            <p class="text-sm text-slate-500">共 ${total} 个问题 · 登录用户可提问，管理员或已购读者可回答</p>
          </div>
          <div class="flex gap-2">
            <button 
              class="btn-outline text-sm ${qnaSort === 'time' ? 'btn-primary' : ''}" 
              data-action="qna-sort" 
              data-sort="time"
            >最新</button>
            <button 
              class="btn-outline text-sm ${qnaSort === 'hot' ? 'btn-primary' : ''}" 
              data-action="qna-sort" 
              data-sort="hot"
            >最热</button>
          </div>
        </div>

        <form data-form="question" class="space-y-3 mb-6" novalidate>
          <textarea 
            class="input" 
            name="content" 
            rows="3" 
            placeholder="有什么关于这本书的问题？登录后可提问..." 
            required
          ></textarea>
          <div class="flex justify-between items-center">
            <p class="text-xs text-slate-400">* 请文明发言，违规内容将被删除</p>
            <button class="btn-primary" type="submit">${state.user ? '提交问题' : '登录后提问'}</button>
          </div>
        </form>

        <div class="space-y-4">
          ${questionItemsHtml || '<div class="card p-6 text-center text-slate-500">暂无问题，快来提第一个问题吧！</div>'}
        </div>

        ${paginationHtml}
      </div>
    `;
  }

  const viewRenderers = {
    books: renderBooks,
    cart: renderCart,
    orders: renderOrders,
    invoices: renderInvoices,
    profile: renderProfile,
    admin: renderAdmin,
    'book-lists': renderBookLists,
    'book-list-detail': renderBookListDetail,
    'book-detail': renderBookDetail
  };

  function renderView() {
    setNavActive(state.view);
    const renderer = viewRenderers[state.view];
    if (renderer) renderer();
  }

  function safeRender() {
    try {
      renderView();
    } catch (error) {
      viewContent.innerHTML = `<div class="card p-6 text-slate-500">页面渲染失败，请刷新重试。</div>`;
      showToast('页面渲染失败', 'error');
    }
  }

  return {
    formatCurrency,
    formatStatus,
    formatInvoiceStatus,
    formatInvoiceTitleType,
    formatBookListStatus,
    setNavActive,
    updateAuthUI,
    renderView,
    safeRender
  };
}
