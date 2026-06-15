export function createViewController({
  state,
  viewContent,
  viewTitle,
  loginBtn,
  logoutBtn,
  userChip,
  adminNavBtn,
  adminNavSection,
  comparisonBar,
  comparisonNavBadge,
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

  function formatPreSaleStatus(status) {
    const map = {
      UPCOMING: '即将开售',
      ONGOING: '预售中',
      ARRIVED: '已到货',
      ENDED: '已结束'
    };
    return map[status] || status;
  }

  function formatReservationStatus(status) {
    const map = {
      PENDING: '待到货',
      NOTIFIED: '已通知',
      FULFILLED: '已购买',
      CANCELED: '已取消'
    };
    return map[status] || status;
  }

  function formatDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  }

  function formatDateTime(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function setNavActive(view) {
    document.querySelectorAll('.nav-btn').forEach((btn) => {
      const active = btn.dataset.view === view;
      btn.classList.toggle('bg-slate-200', active);
      btn.classList.toggle('text-slate-900', active);
    });
  }

  function updateComparisonUI() {
    const count = state.comparison.items.length;
    const maxItems = 4;

    if (comparisonNavBadge) {
      if (count > 0) {
        comparisonNavBadge.textContent = count;
        comparisonNavBadge.classList.remove('hidden');
      } else {
        comparisonNavBadge.classList.add('hidden');
      }
    }

    if (comparisonBar) {
      if (count > 0) {
        const books = state.books.filter(book => state.comparison.items.includes(book.id));
        const activeBooks = books.filter(b => b.status === 'ACTIVE');
        const inactiveCount = books.length - activeBooks.length;

        const bookPreviews = books
          .map(
            (book) => `
            <div class="comparison-bar-item relative flex-shrink-0 ${book.status !== 'ACTIVE' ? 'opacity-60' : ''}">
              <img src="${book.coverUrl}" alt="${book.title}" class="w-12 h-16 object-contain rounded-lg bg-slate-100" />
              <button class="comparison-bar-remove absolute -top-1 -right-1 bg-red-500 text-white w-5 h-5 rounded-full flex items-center justify-center text-xs hover:bg-red-600" data-action="remove-from-comparison" data-id="${book.id}">×</button>
              ${book.status !== 'ACTIVE' ? '<span class="absolute -bottom-1 left-0 right-0 text-[10px] bg-red-500 text-white text-center rounded">已下架</span>' : ''}
            </div>
          `
          )
          .join('');

        comparisonBar.innerHTML = `
          <div class="comparison-bar-content mx-4 mb-4 card p-4">
            <div class="flex flex-wrap items-center justify-between gap-4">
              <div class="flex items-center gap-4">
                <div class="flex items-center gap-2">
                  <span class="text-2xl">📚</span>
                  <div>
                    <p class="font-semibold">书籍对比</p>
                    <p class="text-sm text-slate-500">已选择 ${count} / ${maxItems} 本${inactiveCount > 0 ? `（${inactiveCount} 本已下架）` : ''}</p>
                  </div>
                </div>
                <div class="flex items-center gap-2">
                  ${bookPreviews}
                </div>
              </div>
              <div class="flex items-center gap-2">
                <button class="btn-outline" data-action="clear-comparison">清空</button>
                <button class="btn-primary" data-action="go-to-comparison" ${activeBooks.length < 2 ? 'disabled' : ''}>${activeBooks.length < 2 ? '至少选择2本' : '去对比'}</button>
              </div>
            </div>
          </div>
        `;
        comparisonBar.classList.remove('hidden');
      } else {
        comparisonBar.classList.add('hidden');
        comparisonBar.innerHTML = '';
      }
    }
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

  function renderPreSaleSection() {
    const items = state.preSales.items || [];
    if (items.length === 0) return '';

    const displayItems = items.slice(0, 6);

    const cards = displayItems.map(item => {
      const book = item.book || {};
      const isSoldOut = item.remainingStock <= 0;
      
      return `
        <div class="card hover-card p-4 flex flex-col gap-3 relative overflow-hidden" data-pre-sale-id="${item.id}">
          <div class="absolute top-2 right-2 z-10">
            <span class="badge badge-active bg-orange-500">🔥 预售中</span>
          </div>
          <div class="flex gap-4">
            <div class="w-28 h-36 rounded-xl overflow-hidden bg-slate-100 flex-shrink-0">
              <img src="${book.coverUrl || '/covers/cover-1.svg'}" alt="${book.title || ''}" class="w-full h-full object-contain" />
            </div>
            <div class="flex-1 min-w-0">
              <h3 class="font-semibold text-base truncate">${book.title || ''}</h3>
              <p class="text-xs text-slate-500 truncate">${book.author || ''}</p>
              <div class="mt-2">
                <span class="text-2xl font-bold text-orange-500">${formatCurrency(book.price || 0)}</span>
              </div>
              <div class="mt-2">
                <p class="text-xs text-slate-500">
                  预计到货：${formatDate(item.expectedArrivalDate)}
                </p>
              </div>
              <div class="mt-1">
                <p class="text-xs text-slate-500">
                  已预约 ${item.reservationCount} / ${item.preSaleStock} 件
                </p>
              </div>
            </div>
          </div>
          <div class="bg-orange-50 rounded-lg p-3">
            <div class="flex items-center justify-between">
              <span class="text-xs text-slate-500">
                ${isSoldOut ? '预约已满' : '抢先预约，到货优先购'}
              </span>
              <button class="btn-primary bg-orange-500 hover:bg-orange-600 text-sm" data-action="reserve-book" data-id="${item.id}" ${isSoldOut ? 'disabled' : ''}>
                ${isSoldOut ? '已约满' : '立即预约'}
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');

    return `
      <div class="card p-5 bg-gradient-to-br from-orange-50 to-amber-50 border-orange-100">
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-2">
            <span class="text-2xl">📦</span>
            <h3 class="text-xl font-bold text-slate-800">新书预售</h3>
            <span class="text-xs text-slate-500">到货通知</span>
          </div>
          <button class="text-sm text-orange-600 hover:text-orange-700" data-action="go-to-reservations">
            我的预约 →
          </button>
        </div>
        ${state.preSales.loading 
          ? `<div class="animate-pulse h-48 bg-white rounded-xl"></div>`
          : `<div class="grid md:grid-cols-2 xl:grid-cols-3 gap-4">${cards}</div>`
        }
      </div>
    `;
  }

  function renderTagCloud() {
    const tags = state.tagCloud || [];
    if (tags.length === 0) return '';

    const maxCount = Math.max(...tags.map(t => t.bookCount));
    const minCount = Math.min(...tags.map(t => t.bookCount));
    const selectedTagIds = state.bookSearch.tagIds || [];
    const tagLogic = state.bookSearch.tagLogic || 'OR';

    function getTagSize(count) {
      if (maxCount === minCount) return 'text-base';
      const ratio = (count - minCount) / (maxCount - minCount);
      if (ratio < 0.33) return 'text-sm';
      if (ratio < 0.66) return 'text-base';
      if (ratio < 0.85) return 'text-lg';
      return 'text-xl font-semibold';
    }

    const tagElements = tags
      .map(tag => {
        const isSelected = selectedTagIds.includes(tag.id);
        const sizeClass = getTagSize(tag.bookCount);
        const bgClass = isSelected ? 'bg-teal-500 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200';
        return `
          <button 
            class="tag-cloud-item px-3 py-1.5 rounded-full ${sizeClass} ${bgClass} transition-colors"
            data-action="toggle-tag-filter"
            data-tag-id="${tag.id}"
            data-selected="${isSelected}"
          >
            ${escapeHtmlAttr(tag.name)}
            <span class="text-xs opacity-70 ml-1">(${tag.bookCount})</span>
          </button>
        `;
      })
      .join('');

    return `
      <div class="card p-5">
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-2">
            <span class="text-xl">🏷️</span>
            <h3 class="text-lg font-semibold">标签云</h3>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-sm text-slate-500">筛选逻辑：</span>
            <select class="input input-sm" name="tagLogic" data-action="change-tag-logic">
              <option value="OR" ${tagLogic === 'OR' ? 'selected' : ''}>或（满足任一）</option>
              <option value="AND" ${tagLogic === 'AND' ? 'selected' : ''}>与（全部满足）</option>
            </select>
            ${selectedTagIds.length > 0 ? `<button class="btn-outline btn-sm" data-action="clear-tag-filter">清除标签</button>` : ''}
          </div>
        </div>
        <div class="flex flex-wrap gap-2">
          ${tagElements}
        </div>
        ${selectedTagIds.length > 0 ? `
          <p class="text-xs text-slate-500 mt-3">
            已选 ${selectedTagIds.length} 个标签，${tagLogic === 'AND' ? '需同时满足所有标签' : '满足任一标签即可'}
          </p>
        ` : ''}
      </div>
    `;
  }

  function renderBookTags(tags) {
    if (!tags || tags.length === 0) return '';
    return tags
      .map(tag => `<span class="badge badge-tag" style="${tag.color ? `background-color: ${tag.color}20; color: ${tag.color}; border-color: ${tag.color}40;` : ''}">${escapeHtmlAttr(tag.name)}</span>`)
      .join('');
  }

  function renderBooks() {
    const search = state.bookSearch;
    const categoryOptions = state.categories
      .map((cat) => `<option value="${cat.id}" ${search.categoryId === cat.id ? 'selected' : ''}>${cat.name}</option>`)
      .join('');

    const bookCards = state.books
      .map(
        (book) => {
          const isInComparison = state.comparison.items.includes(book.id);
          const isInactive = book.status !== 'ACTIVE';
          const tagBadges = renderBookTags(book.tags);
          const hasPreSale = book.preSale && book.preSale.status !== 'ARRIVED' && book.preSale.status !== 'ENDED';
          const isPreSaleArrived = book.preSale && book.preSale.status === 'ARRIVED';
          
          let preSaleBadge = '';
          let preSaleInfo = '';
          let buyButton = '';
          
          if (hasPreSale) {
            preSaleBadge = '<span class="badge badge-active bg-orange-500">🔥 预售</span>';
            preSaleInfo = `<span class="badge badge-tag text-orange-600 bg-orange-50" style="border-color: #fed7aa;">预计 ${formatDate(book.preSale.expectedArrivalDate)} 到货</span>`;
            buyButton = `<button class="btn-primary bg-orange-500 hover:bg-orange-600" data-action="reserve-book" data-id="${book.preSale.id}" ${isInactive ? 'disabled' : ''}>立即预约</button>`;
          } else if (isPreSaleArrived) {
            preSaleBadge = '<span class="badge badge-active bg-emerald-500">✓ 已到货</span>';
            buyButton = `<button class="btn-primary" data-action="add-to-cart" data-id="${book.id}" ${isInactive ? 'disabled' : ''}>加入购物车</button>`;
          } else {
            buyButton = `<button class="btn-primary" data-action="add-to-cart" data-id="${book.id}" ${isInactive ? 'disabled' : ''}>加入购物车</button>`;
          }
          
          return `
        <div class="card hover-card p-4 flex flex-col gap-3 ${isInactive ? 'opacity-60' : ''}" data-book-id="${book.id}">
          <div class="flex justify-between items-start">
            <label class="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" 
                class="comparison-checkbox w-4 h-4 text-teal-600 rounded focus:ring-teal-500" 
                data-action="toggle-comparison" 
                data-id="${book.id}"
                ${isInComparison ? 'checked' : ''}
                ${isInactive ? 'disabled' : ''}
              />
              <span class="text-xs text-slate-600">加入对比</span>
            </label>
            <div class="flex gap-1">
              ${preSaleBadge}
              ${isInactive ? '<span class="badge badge-inactive">已下架</span>' : ''}
            </div>
          </div>
          <div class="rounded-xl overflow-hidden h-44 bg-slate-100">
            <img src="${book.coverUrl}" alt="${book.title}" class="w-full h-full object-contain" />
          </div>
          <div>
            <h3 class="font-semibold text-lg">${book.title}</h3>
            <p class="text-sm text-slate-500">${book.author}</p>
            <div class="flex flex-wrap gap-2 mt-2">
              <span class="badge">${book.category?.name || '未分类'}</span>
              ${tagBadges}
              ${preSaleInfo}
            </div>
            <div class="flex flex-wrap gap-2 mt-1">
              ${hasPreSale 
                ? `<span class="badge">预约 ${book.preSale.reservationCount}/${book.preSale.preSaleStock}</span>`
                : `<span class="badge">库存 ${book.stock}</span>`
              }
              <span class="badge">销量 ${book.sales}</span>
            </div>
          </div>
          <div class="flex items-center justify-between">
            <p class="text-lg font-semibold text-slate-900 ${isInactive ? 'line-through text-slate-400' : ''}">${formatCurrency(book.price)}</p>
            <div class="flex gap-2">
              <button class="btn-outline" data-action="view-book-detail" data-id="${book.id}">详情</button>
              ${buyButton}
            </div>
          </div>
        </div>
      `;
        }
      )
      .join('');

    viewTitle.innerHTML = `
      <div>
        <h2 class="text-xl font-semibold">书籍查询</h2>
        <p class="text-sm text-slate-500">支持多条件筛选与排序</p>
      </div>
    `;

    const flashSaleSection = renderFlashSaleSection();
    const preSaleSection = renderPreSaleSection();
    const tagCloudSection = renderTagCloud();

    viewContent.innerHTML = `
      ${flashSaleSection}
      ${preSaleSection}
      ${tagCloudSection}
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
    const shipping = state.shipping.calculation;
    const recommendations = state.shipping.recommendations || [];
    const shippingFee = shipping ? shipping.shippingFee : 0;
    const freeShipping = shipping ? shipping.freeShipping : false;
    const shortAmount = shipping ? shipping.shortAmount : 0;
    const totalWithShipping = shipping ? shipping.totalAmount : total;

    const cartList = state.cart
      .map(
        (item) => `
      <div class="flex flex-col md:flex-row md:items-center gap-4 border-b border-slate-200 pb-4">
        <label class="flex items-center gap-2 cursor-pointer flex-shrink-0">
          <input type="checkbox" class="cart-item-check w-4 h-4 text-teal-600 rounded" data-action="toggle-cart-item" data-id="${item.id}" checked />
        </label>
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

    const shippingInfoHtml = shipping ? `
      <div class="bg-slate-50 rounded-xl p-4 space-y-2">
        <div class="flex justify-between text-sm">
          <span class="text-slate-600">商品金额</span>
          <span class="font-medium">${formatCurrency(shipping.itemsAmount)}</span>
        </div>
        <div class="flex justify-between text-sm">
          <span class="text-slate-600">运费</span>
          <span class="font-medium ${freeShipping ? 'text-emerald-600' : ''}">${freeShipping ? '免运费' : formatCurrency(shippingFee)}</span>
        </div>
        ${!freeShipping && shortAmount > 0 ? `
          <div class="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm">
            <p class="text-amber-700 font-medium">🚚 再买 <span class="text-amber-800 font-bold">${formatCurrency(shortAmount)}</span> 即可包邮！</p>
          </div>
        ` : ''}
        ${freeShipping ? `
          <div class="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm">
            <p class="text-emerald-700 font-medium">🎉 已满包邮门槛，免运费！</p>
          </div>
        ` : ''}
        <div class="flex justify-between text-base font-semibold pt-2 border-t border-slate-200">
          <span>合计</span>
          <span class="text-red-500">${formatCurrency(totalWithShipping)}</span>
        </div>
      </div>
    ` : `
      <div class="bg-slate-50 rounded-xl p-4 space-y-2">
        <div class="flex justify-between text-base font-semibold">
          <span>合计</span>
          <span class="text-red-500">${formatCurrency(total)}</span>
        </div>
      </div>
    `;

    const recommendationsHtml = recommendations.length > 0 ? `
      <div class="card p-5 space-y-4">
        <div class="flex items-center gap-2">
          <span class="text-xl">💡</span>
          <h3 class="text-lg font-semibold">凑单推荐</h3>
          <span class="text-sm text-slate-500">价格接近差额，加购即可包邮</span>
        </div>
        <div class="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
          ${recommendations.map(book => `
            <div class="border border-slate-200 rounded-xl p-3 flex gap-3 hover-card">
              <img src="${book.coverUrl}" alt="${book.title}" class="w-16 h-20 object-contain rounded-lg bg-white flex-shrink-0" />
              <div class="flex-1 min-w-0">
                <p class="font-medium text-sm truncate">${book.title}</p>
                <p class="text-xs text-slate-500 truncate">${book.author}</p>
                <p class="text-sm font-semibold text-red-500 mt-1">${formatCurrency(book.price)}</p>
                <button class="btn-primary text-xs mt-1 px-2 py-1" data-action="add-to-cart" data-id="${book.id}">加购</button>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    ` : '';

    viewContent.innerHTML = `
      <div class="card p-6 space-y-4">
        ${state.cart.length === 0 ? '<p class="text-slate-500">购物车为空</p>' : cartList}
        ${state.cart.length > 0 ? `
        <div class="flex flex-wrap items-center justify-between gap-3 pt-2">
          <div class="flex items-center gap-3">
            <label class="flex items-center gap-2 cursor-pointer text-sm text-slate-600">
              <input type="checkbox" id="select-all-cart" class="w-4 h-4 text-teal-600 rounded" checked />
              全选
            </label>
          </div>
          <button class="btn-outline" data-action="clear-cart">清空购物车</button>
        </div>
        ${shippingInfoHtml}
        ` : ''}
      </div>

      ${!freeShipping && shortAmount > 0 ? recommendationsHtml : ''}

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
          <div class="bg-slate-50 rounded-xl p-3 space-y-1 text-sm">
            <div class="flex justify-between">
              <span class="text-slate-500">商品金额</span>
              <span>${formatCurrency(order.itemsAmount || (order.total - (order.shipping || 0)))}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-slate-500">运费</span>
              <span>${order.shipping > 0 ? formatCurrency(order.shipping) : '免运费'}</span>
            </div>
            <div class="flex justify-between font-semibold pt-1 border-t border-slate-200">
              <span>订单总额</span>
              <span class="text-red-500">${formatCurrency(order.total)}</span>
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
            ${order.reviewImageUrls && order.reviewImageUrls.length > 0 ? `<span class="badge">📷 ${order.reviewImageUrls.length}图</span>` : ''}
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

  function renderReservations() {
    viewTitle.innerHTML = `
      <div>
        <h2 class="text-xl font-semibold">我的预约</h2>
        <p class="text-sm text-slate-500">预售书籍到货将第一时间通知您</p>
      </div>
    `;

    if (!state.user) {
      viewContent.innerHTML = `<div class="card p-6 text-slate-500">请先登录后查看预约。</div>`;
      return;
    }

    if (state.reservations.loading) {
      viewContent.innerHTML = `<div class="card p-6"><div class="animate-pulse space-y-4">
        ${Array.from({ length: 3 }).map(() => '<div class="h-24 bg-slate-200 rounded-xl"></div>').join('')}
      </div></div>`;
      return;
    }

    if (state.reservations.items.length === 0) {
      viewContent.innerHTML = `
        <div class="card p-10 text-center">
          <div class="text-5xl mb-4">📦</div>
          <p class="text-slate-500 mb-4">暂无预约记录</p>
          <button class="btn-primary" data-action="go-to-books">去逛逛新书</button>
        </div>
      `;
      return;
    }

    viewContent.innerHTML = state.reservations.items
      .map(
        (reservation) => {
          const book = reservation.book || {};
          const preSale = reservation.preSale || {};
          const statusBadge = reservation.status === 'PENDING'
            ? '<span class="badge">待到货</span>'
            : reservation.status === 'NOTIFIED'
              ? '<span class="badge badge-active bg-emerald-500">已到货</span>'
              : reservation.status === 'FULFILLED'
                ? '<span class="badge badge-active">已购买</span>'
                : '<span class="badge badge-inactive">已取消</span>';

          return `
        <div class="card p-6 space-y-4">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p class="text-xs text-slate-400">预约时间 ${formatDateTime(reservation.createdAt)}</p>
              <h3 class="text-lg font-semibold">${statusBadge} ${formatReservationStatus(reservation.status)}</h3>
            </div>
          </div>
          <div class="flex items-center gap-4">
            <img src="${book.coverUrl || '/covers/cover-1.svg'}" alt="${book.title || ''}" class="w-20 h-28 rounded-lg object-contain bg-white" />
            <div class="flex-1 min-w-0">
              <p class="font-semibold truncate">${book.title || ''}</p>
              <p class="text-sm text-slate-500 truncate">${book.author || ''}</p>
              <p class="text-lg font-semibold text-orange-500 mt-1">${formatCurrency(book.price || 0)}</p>
              <p class="text-xs text-slate-500 mt-1">
                预计到货：${formatDate(preSale.expectedArrivalDate)}
              </p>
            </div>
          </div>
          <div class="flex flex-wrap gap-2">
            ${reservation.status === 'PENDING' ? `<button class="btn-outline" data-action="cancel-reservation" data-id="${reservation.id}">取消预约</button>` : ''}
            ${reservation.status === 'NOTIFIED' ? `<button class="btn-primary bg-orange-500 hover:bg-orange-600" data-action="buy-reserved-book" data-id="${reservation.bookId}">立即购买</button>` : ''}
          </div>
        </div>
      `;
        }
      )
      .join('');
  }

  function renderNotifications() {
    viewTitle.innerHTML = `
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-xl font-semibold">消息通知</h2>
          <p class="text-sm text-slate-500">${state.notifications.unreadCount || 0} 条未读消息</p>
        </div>
        ${state.notifications.unreadCount > 0 ? '<button class="btn-outline btn-sm" data-action="read-all-notifications">全部已读</button>' : ''}
      </div>
    `;

    if (!state.user) {
      viewContent.innerHTML = `<div class="card p-6 text-slate-500">请先登录后查看通知。</div>`;
      return;
    }

    if (state.notifications.loading) {
      viewContent.innerHTML = `<div class="card p-6"><div class="animate-pulse space-y-4">
        ${Array.from({ length: 3 }).map(() => '<div class="h-16 bg-slate-200 rounded-xl"></div>').join('')}
      </div></div>`;
      return;
    }

    if (state.notifications.items.length === 0) {
      viewContent.innerHTML = `
        <div class="card p-10 text-center">
          <div class="text-5xl mb-4">🔔</div>
          <p class="text-slate-500">暂无通知消息</p>
        </div>
      `;
      return;
    }

    viewContent.innerHTML = `
      <div class="space-y-2">
        ${state.notifications.items
          .map(
            (notification) => `
          <div class="card p-4 cursor-pointer hover:bg-slate-50 transition-colors ${notification.read ? 'opacity-60' : ''}" data-action="read-notification" data-id="${notification.id}">
            <div class="flex items-start gap-3">
              <div class="text-2xl flex-shrink-0">
                ${notification.type === 'PRE_SALE_ARRIVAL' ? '📦' : notification.type === 'ORDER' ? '📋' : '🔔'}
              </div>
              <div class="flex-1 min-w-0">
                <div class="flex items-center justify-between gap-2">
                  <h4 class="font-semibold truncate">${notification.title}</h4>
                  ${!notification.read ? '<span class="w-2 h-2 bg-red-500 rounded-full flex-shrink-0"></span>' : ''}
                </div>
                <p class="text-sm text-slate-600 mt-1 line-clamp-2">${notification.content}</p>
                <p class="text-xs text-slate-400 mt-2">${formatDateTime(notification.createdAt)}</p>
              </div>
            </div>
          </div>
        `
          )
          .join('')}
      </div>
    `;
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
          
          <div class="md:col-span-2 space-y-2">
            <label class="text-sm text-slate-600 font-medium">💡 智能填写</label>
            <div class="flex gap-2">
              <input 
                class="input flex-1" 
                name="smartInput" 
                placeholder="粘贴完整地址文本，如：张三 13800001111 浙江省杭州市西湖区文三路 100 号" 
              />
              <button class="btn-primary flex-shrink-0" type="button" data-action="parse-address" id="parse-address-btn">
                一键解析
              </button>
            </div>
            <p class="text-xs text-slate-500">支持姓名、手机号、省市、详细地址的智能识别，多种分隔符和顺序均可识别</p>
            <div id="parse-warnings" class="hidden"></div>
          </div>
          
          <div class="md:col-span-2 border-t border-slate-200 pt-2">
            <p class="text-xs text-slate-500 mb-3">以下字段可手动调整：</p>
          </div>
          
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
        <button class="btn-outline" data-action="admin-tab" data-tab="tags">标签管理</button>
        <button class="btn-outline" data-action="admin-tab" data-tab="orders">订单管理</button>
        <button class="btn-outline" data-action="admin-tab" data-tab="flash-sales">秒杀管理</button>
        <button class="btn-outline" data-action="admin-tab" data-tab="pre-sales">预售管理</button>
        <button class="btn-outline" data-action="admin-tab" data-tab="invoices">发票管理</button>
        <button class="btn-outline" data-action="admin-tab" data-tab="book-lists">书单管理</button>
        <button class="btn-outline" data-action="admin-tab" data-tab="qna">问答管理</button>
        <button class="btn-outline" data-action="admin-tab" data-tab="shipping-rules">运费规则</button>
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

      const editingTagIds = state.admin.editingBookTags?.map(t => t.id) || [];
      const tagCheckboxes = state.admin.tags
        .map(tag => {
          const isChecked = editingTagIds.includes(tag.id);
          return `
            <label class="inline-flex items-center gap-2 cursor-pointer px-3 py-1.5 rounded-lg border ${isChecked ? 'bg-teal-50 border-teal-200' : 'bg-white border-slate-200 hover:border-slate-300'}">
              <input type="checkbox" name="tagIds" value="${tag.id}" ${isChecked ? 'checked' : ''} class="w-4 h-4 text-teal-600 rounded" />
              <span class="text-sm" style="${tag.color ? `color: ${tag.color};` : ''}">${escapeHtmlAttr(tag.name)}</span>
            </label>
          `;
        })
        .join('');

      const bookRows = state.admin.books
        .map(
          (book) => {
            const bookTagBadges = renderBookTags(book.tags);
            return `
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
          ${bookTagBadges ? `<div class="flex flex-wrap gap-1">${bookTagBadges}</div>` : ''}
          <div class="flex flex-wrap gap-2">
            <button class="btn-outline" data-action="edit-book" data-id="${book.id}">编辑</button>
            ${book.status === 'ACTIVE'
              ? `<button class="btn-outline" data-action="deactivate-book" data-id="${book.id}">下架</button>`
              : `<button class="btn-outline" data-action="restore-book" data-id="${book.id}">上架</button>`}
          </div>
        </div>
      `;
          }
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
            ${state.admin.editingBook ? `
            <div class="space-y-2 md:col-span-2">
              <label class="text-sm text-slate-600">标签</label>
              <div class="flex flex-wrap gap-2 p-3 bg-slate-50 rounded-xl">
                ${tagCheckboxes || '<span class="text-sm text-slate-400">暂无标签，请先在标签管理中创建</span>'}
              </div>
            </div>
            ` : ''}
            <div class="md:col-span-2 flex justify-end gap-2">
              ${state.admin.editingBook ? '<button class="btn-outline" type="button" data-action="cancel-edit-book">取消</button>' : ''}
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

    if (state.admin.tab === 'tags') {
      const tagList = state.admin.tags
        .map(
          (tag) => `
        <div class="border border-slate-200 rounded-xl p-4 flex items-center justify-between hover-card">
          <div class="flex items-center gap-3">
            <span class="badge" style="${tag.color ? `background-color: ${tag.color}20; color: ${tag.color}; border-color: ${tag.color}40;` : ''}">${escapeHtmlAttr(tag.name)}</span>
            <span class="text-xs text-slate-500">${tag.bookCount} 本书</span>
          </div>
          <div class="flex gap-2">
            <button class="btn-outline" data-action="edit-tag" data-id="${tag.id}">编辑</button>
            <button class="btn-outline text-red-600" data-action="delete-tag" data-id="${tag.id}">删除</button>
          </div>
        </div>
      `
        )
        .join('');

      const editingTag = state.admin.editingTag;

      content = `
        <div class="card p-6 space-y-4">
          <h3 class="text-lg font-semibold">${editingTag ? '编辑标签' : '新增标签'}</h3>
          <form data-form="admin-tag" class="grid md:grid-cols-3 gap-3" novalidate>
            <input type="hidden" name="tagId" value="${editingTag?.id || ''}" />
            <div class="space-y-1">
              <label class="text-sm text-slate-600">标签名称</label>
              <input class="input" name="name" placeholder="标签名称" value="${escapeHtmlAttr(editingTag?.name || '')}" required />
            </div>
            <div class="space-y-1">
              <label class="text-sm text-slate-600">标签颜色（可选）</label>
              <input class="input" type="color" name="color" value="${editingTag?.color || '#3b82f6'}" />
            </div>
            <div class="flex items-end gap-2">
              <button class="btn-primary" type="submit">${editingTag ? '保存修改' : '添加标签'}</button>
              ${editingTag ? '<button class="btn-outline" type="button" data-action="cancel-edit-tag">取消</button>' : ''}
            </div>
          </form>
        </div>
        <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-4">${tagList || '<div class="text-slate-500">暂无标签</div>'}</div>
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

    if (state.admin.tab === 'pre-sales') {
      const bookOptions = state.admin.books
        .filter(book => book.status === 'ACTIVE')
        .map(
          (book) =>
            `<option value="${book.id}" ${state.admin.editingPreSale?.bookId === book.id ? 'selected' : ''}>${book.title} - ${formatCurrency(book.price)}</option>`
        )
        .join('');

      const editing = state.admin.editingPreSale;

      const preSaleRows = state.admin.preSales?.items?.length
        ? state.admin.preSales.items
            .map((preSale) => {
              const statusBadge = preSale.status === 'UPCOMING' || preSale.status === 'ONGOING'
                ? '<span class="badge">预售中</span>'
                : preSale.status === 'ARRIVED'
                  ? '<span class="badge badge-active">已到货</span>'
                  : '<span class="badge badge-inactive">已结束</span>';

              return `
        <div class="border border-slate-200 rounded-xl p-4 space-y-3 hover-card">
          <div class="flex justify-between items-start">
            <div>
              <h4 class="font-semibold">${preSale.book?.title || '未知书籍'}</h4>
              <p class="text-sm text-slate-500">${preSale.book?.author || ''}</p>
            </div>
            ${statusBadge}
          </div>
          <div class="text-sm text-slate-600 space-y-1">
            <p>预计到货：${formatDate(preSale.expectedArrivalDate)}</p>
            <p>预售库存：${preSale.preSaleStock} 本</p>
            <p>已预约：${preSale.reservationCount} 人</p>
            ${preSale.arrivedAt ? `<p class="text-emerald-600">实际到货：${formatDateTime(preSale.arrivedAt)}</p>` : ''}
          </div>
          <div class="flex flex-wrap gap-2">
            <button class="btn-outline" data-action="view-pre-sale" data-id="${preSale.id}">查看详情</button>
            ${(preSale.status === 'UPCOMING' || preSale.status === 'ONGOING') ? `<button class="btn-outline" data-action="edit-pre-sale" data-id="${preSale.id}">编辑</button>` : ''}
            ${(preSale.status === 'UPCOMING' || preSale.status === 'ONGOING') ? `<button class="btn-primary bg-orange-500 hover:bg-orange-600" data-action="arrive-pre-sale" data-id="${preSale.id}">标记到货</button>` : ''}
            ${(preSale.status === 'UPCOMING' || preSale.status === 'ONGOING') ? `<button class="btn-outline text-red-500" data-action="delete-pre-sale" data-id="${preSale.id}">删除</button>` : ''}
          </div>
        </div>
      `;
            })
            .join('')
        : '<div class="text-slate-500">暂无预售活动</div>';

      content = `
        <div class="card p-6 space-y-4">
          <h3 class="text-lg font-semibold">${editing ? '编辑预售' : '新增预售'}</h3>
          <form data-form="admin-pre-sale" class="grid md:grid-cols-2 gap-3" novalidate>
            ${editing ? `<input type="hidden" name="id" value="${editing.id}" />` : ''}
            <div class="space-y-1">
              <label class="text-sm text-slate-600">选择书籍</label>
              <select class="input" name="bookId" ${editing ? 'disabled' : ''} required>
                <option value="">请选择书籍</option>
                ${bookOptions}
              </select>
            </div>
            <div class="space-y-1">
              <label class="text-sm text-slate-600">预计到货日期</label>
              <input class="input" type="date" name="expectedArrivalDate" value="${editing?.expectedArrivalDate?.split('T')[0] || ''}" required />
            </div>
            <div class="space-y-1">
              <label class="text-sm text-slate-600">预售库存</label>
              <input class="input" type="number" name="preSaleStock" placeholder="预售库存数量" value="${editing?.preSaleStock || 100}" min="1" required />
            </div>
            <div class="md:col-span-2 flex justify-end gap-2">
              ${editing ? '<button class="btn-outline" type="button" data-action="cancel-edit-pre-sale">取消编辑</button>' : ''}
              <button class="btn-primary" type="submit">${editing ? '保存修改' : '创建预售'}</button>
            </div>
          </form>
        </div>
        <div class="grid lg:grid-cols-2 gap-4">${preSaleRows}</div>
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

    if (state.admin.tab === 'shipping-rules') {
      const editing = state.admin.editingShippingRule;
      const rules = state.admin.shippingRules || [];

      const ruleCards = rules.map(rule => {
        const typeLabel = rule.type === 'FIXED' ? '固定运费' : '按件运费';
        const activeBadge = rule.isActive
          ? '<span class="badge badge-active">启用</span>'
          : '<span class="badge badge-inactive">禁用</span>';

        return `
          <div class="border border-slate-200 rounded-xl p-4 flex flex-col gap-3 hover-card">
            <div class="flex justify-between items-start">
              <div>
                <h4 class="font-semibold">${escapeHtmlAttr(rule.name)}</h4>
                <p class="text-sm text-slate-500">${typeLabel}</p>
              </div>
              ${activeBadge}
            </div>
            <div class="grid grid-cols-2 gap-2 text-sm">
              <div>
                <p class="text-xs text-slate-400">运费</p>
                <p class="font-semibold text-red-500">${formatCurrency(rule.fee)}${rule.type === 'PER_ITEM' ? '/件' : ''}</p>
              </div>
              <div>
                <p class="text-xs text-slate-400">包邮门槛</p>
                <p class="font-semibold">${rule.freeThreshold ? formatCurrency(rule.freeThreshold) : '无'}</p>
              </div>
            </div>
            <div class="flex flex-wrap gap-2">
              <button class="btn-outline" data-action="edit-shipping-rule" data-id="${rule.id}">编辑</button>
              ${rule.isActive
                ? `<button class="btn-outline" data-action="deactivate-shipping-rule" data-id="${rule.id}">禁用</button>`
                : `<button class="btn-primary" data-action="activate-shipping-rule" data-id="${rule.id}">启用</button>`
              }
              <button class="btn-outline text-red-600" data-action="delete-shipping-rule" data-id="${rule.id}">删除</button>
            </div>
          </div>
        `;
      }).join('');

      content = `
        <div class="card p-6 space-y-4">
          <h3 class="text-lg font-semibold">${editing ? '编辑运费规则' : '新增运费规则'}</h3>
          <form data-form="admin-shipping-rule" class="grid md:grid-cols-2 gap-3" novalidate>
            <input type="hidden" name="ruleId" value="${editing?.id || ''}" />
            <div class="space-y-1">
              <label class="text-sm text-slate-600">规则名称</label>
              <input class="input" name="name" placeholder="如：标准运费" value="${escapeHtmlAttr(editing?.name || '')}" required />
            </div>
            <div class="space-y-1">
              <label class="text-sm text-slate-600">运费类型</label>
              <select class="input" name="type" required>
                <option value="FIXED" ${editing?.type === 'FIXED' ? 'selected' : ''}>固定运费</option>
                <option value="PER_ITEM" ${editing?.type === 'PER_ITEM' ? 'selected' : ''}>按件运费</option>
              </select>
            </div>
            <div class="space-y-1">
              <label class="text-sm text-slate-600">运费金额（元）</label>
              <input class="input" name="fee" type="number" step="0.01" placeholder="运费金额" value="${editing?.fee || ''}" required />
            </div>
            <div class="space-y-1">
              <label class="text-sm text-slate-600">包邮门槛（元，留空则无包邮）</label>
              <input class="input" name="freeThreshold" type="number" step="0.01" placeholder="满 X 元包邮" value="${editing?.freeThreshold || ''}" />
            </div>
            <label class="flex items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" name="isActive" ${editing?.isActive !== false ? 'checked' : ''} /> 启用该规则
            </label>
            <div class="flex justify-end gap-2">
              ${editing ? '<button class="btn-outline" type="button" data-action="cancel-edit-shipping-rule">取消</button>' : ''}
              <button class="btn-primary" type="submit">${editing ? '保存修改' : '创建规则'}</button>
            </div>
          </form>
        </div>
        <div class="grid lg:grid-cols-2 gap-4">${ruleCards || '<div class="text-slate-500">暂无运费规则</div>'}</div>
      `;
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

    const reviews = state.bookReviews.items || [];
    const reviewSort = state.bookReviews.sort || 'latest';
    const reviewPage = state.bookReviews.page || 1;
    const reviewTotalPages = state.bookReviews.totalPages || 0;
    const reviewTotal = state.bookReviews.total || 0;

    viewTitle.innerHTML = `
      <div class="flex items-center gap-4">
        <button class="btn-outline" data-action="back-to-books">← 返回列表</button>
        <div>
          <h2 class="text-xl font-semibold">书籍详情</h2>
          <p class="text-sm text-slate-500">查看书籍信息、评价与读者问答</p>
        </div>
      </div>
    `;

    if (state.loading.bookDetail || state.bookQuestions.loading || state.bookReviews.loading) {
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

      <div class="card p-6 mb-6">
        <div class="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <h3 class="text-xl font-semibold">⭐ 图文评价</h3>
            <p class="text-sm text-slate-500">共 ${reviewTotal} 条评价</p>
          </div>
          <div class="flex gap-2">
            <button 
              class="btn-outline text-sm ${reviewSort === 'hasImage' ? 'btn-primary' : ''}" 
              data-action="review-sort" 
              data-sort="hasImage"
            >有图优先</button>
            <button 
              class="btn-outline text-sm ${reviewSort === 'latest' ? 'btn-primary' : ''}" 
              data-action="review-sort" 
              data-sort="latest"
            >最新</button>
            <button 
              class="btn-outline text-sm ${reviewSort === 'likes' ? 'btn-primary' : ''}" 
              data-action="review-sort" 
              data-sort="likes"
            >最赞</button>
          </div>
        </div>

        ${reviews.length > 0 ? `
          <div class="space-y-4">
            ${reviews.map((r) => {
              const imagesHtml = (r.reviewImageUrls || []).length > 0
                ? `<div class="flex flex-wrap gap-2 mt-2">${
                    r.reviewImageUrls.map((url, idx) => 
                      `<img src="${url}" alt="评价图片" class="w-16 h-16 object-cover rounded-lg border border-slate-200 cursor-pointer hover:opacity-80 transition-opacity" data-action="open-gallery" data-images="${escapeHtmlAttr(JSON.stringify(r.reviewImageUrls))}" data-index="${idx}" />`
                    ).join('')
                  }</div>`
                : '';
              const likeBtnClass = r.hasLiked ? 'btn-primary' : 'btn-outline';
              return `
                <div class="border border-slate-200 rounded-xl p-5 space-y-3 bg-white">
                  <div class="flex items-start justify-between gap-3">
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center gap-2 mb-2">
                        <span class="text-sm font-semibold text-slate-800">${escapeHtmlAttr(r.username)}</span>
                        <span class="text-xs text-slate-400">${new Date(r.reviewedAt).toLocaleString()}</span>
                        <span class="badge ml-auto">${'⭐'.repeat(r.rating || 0)}</span>
                      </div>
                      <p class="text-slate-700 whitespace-pre-wrap break-words">${escapeHtmlAttr(r.reviewText)}</p>
                      ${imagesHtml}
                    </div>
                  </div>
                  <div class="flex justify-end">
                    <button 
                      class="${likeBtnClass} text-sm flex items-center gap-1" 
                      data-action="like-review" 
                      data-id="${r.id}"
                    >
                      <span>${r.hasLiked ? '❤️' : '🤍'}</span>
                      <span>${r.likeCount || 0}</span>
                    </button>
                  </div>
                </div>
              `;
            }).join('')}
          </div>

          ${reviewTotalPages > 1 ? `
            <div class="flex justify-center items-center gap-2 pt-4">
              <button 
                class="btn-outline" 
                data-action="review-prev-page"
                ${reviewPage <= 1 ? 'disabled' : ''}
              >上一页</button>
              <span class="text-sm text-slate-500">第 ${reviewPage} / ${reviewTotalPages} 页（共 ${reviewTotal} 条）</span>
              <button 
                class="btn-outline" 
                data-action="review-next-page"
                ${reviewPage >= reviewTotalPages ? 'disabled' : ''}
              >下一页</button>
            </div>
          ` : ''}
        ` : '<div class="card p-6 text-center text-slate-500">暂无评价</div>'}
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

  function renderComparison() {
    viewTitle.innerHTML = `
      <div>
        <h2 class="text-xl font-semibold">书籍对比</h2>
        <p class="text-sm text-slate-500">多维度对比，帮您找到最合适的书籍</p>
      </div>
    `;

    const allBooks = state.books.filter(book => state.comparison.items.includes(book.id));
    const activeBooks = allBooks.filter(b => b.status === 'ACTIVE');
    const inactiveBooks = allBooks.filter(b => b.status !== 'ACTIVE');

    if (allBooks.length === 0) {
      viewContent.innerHTML = `
        <div class="card p-12 text-center">
          <div class="text-6xl mb-4">📚</div>
          <h3 class="text-xl font-semibold mb-2">暂无对比书籍</h3>
          <p class="text-slate-500 mb-6">请在书籍列表中勾选"加入对比"，最多可选择 4 本书</p>
          <button class="btn-primary" data-action="back-to-books">去选书</button>
        </div>
      `;
      return;
    }

    const fields = [
      { key: 'cover', label: '封面', type: 'cover' },
      { key: 'title', label: '书名', type: 'text' },
      { key: 'author', label: '作者', type: 'text' },
      { key: 'price', label: '价格', type: 'currency' },
      { key: 'stock', label: '库存', type: 'number' },
      { key: 'category', label: '分类', type: 'category' },
      { key: 'sales', label: '销量', type: 'number' },
      { key: 'isbn', label: 'ISBN', type: 'text' },
      { key: 'status', label: '状态', type: 'status' },
      { key: 'actions', label: '操作', type: 'actions' }
    ];

    function getFieldValue(book, field) {
      if (field.type === 'cover') {
        return `<img src="${book.coverUrl}" alt="${book.title}" class="w-24 h-32 object-contain rounded-lg bg-slate-100" />`;
      }
      if (field.type === 'category') {
        return book.category?.name || '未分类';
      }
      if (field.type === 'currency') {
        return formatCurrency(book[field.key]);
      }
      if (field.type === 'status') {
        const isActive = book.status === 'ACTIVE';
        return `<span class="badge ${isActive ? 'badge-active' : 'badge-inactive'}">${isActive ? '上架中' : '已下架'}</span>`;
      }
      if (field.type === 'actions') {
        const isInactive = book.status !== 'ACTIVE';
        return `
          <div class="flex flex-wrap gap-2">
            <button class="btn-outline" data-action="remove-from-comparison" data-id="${book.id}">移除</button>
            <button class="btn-primary" data-action="add-to-cart" data-id="${book.id}" ${isInactive ? 'disabled' : ''}>${isInactive ? '已下架' : '加入购物车'}</button>
          </div>
        `;
      }
      return book[field.key] ?? '-';
    }

    function isFieldDifferent(books, field) {
      if (field.type === 'cover' || field.type === 'actions') return false;
      const values = books.map(book => {
        if (field.type === 'category') return book.category?.id || '';
        return String(book[field.key] ?? '');
      });
      return new Set(values).size > 1;
    }

    const inactiveWarning = inactiveBooks.length > 0 ? `
      <div class="card p-4 mb-4 bg-red-50 border-red-200">
        <p class="text-red-600 text-sm">
          ⚠️ 有 ${inactiveBooks.length} 本书籍已下架，已从对比表格中移除。
          <button class="underline ml-2" data-action="clear-inactive-comparison">移除此类书籍</button>
        </p>
      </div>
    ` : '';

    if (activeBooks.length < 2) {
      viewContent.innerHTML = `
        ${inactiveWarning}
        <div class="card p-12 text-center">
          <div class="text-6xl mb-4">📊</div>
          <h3 class="text-xl font-semibold mb-2">请选择至少 2 本可对比的书籍</h3>
          <p class="text-slate-500 mb-6">当前只有 ${activeBooks.length} 本有效书籍可供对比</p>
          <div class="flex justify-center gap-2">
            <button class="btn-outline" data-action="back-to-books">继续选书</button>
            <button class="btn-outline" data-action="clear-comparison">清空对比</button>
          </div>
        </div>
      `;
      return;
    }

    const tableRows = fields
      .map(field => {
        const isDifferent = isFieldDifferent(activeBooks, field);
        const diffClass = isDifferent ? 'comparison-diff' : '';
        return `
          <tr class="border-b border-slate-200 ${diffClass}">
            <th class="text-left py-4 px-4 font-semibold text-slate-700 bg-slate-50 w-28 ${field.key === 'cover' ? 'align-top' : ''}">${field.label}</th>
            ${activeBooks.map(book => {
              const isInactive = book.status !== 'ACTIVE';
              return `
                <td class="py-4 px-4 text-center ${isInactive ? 'opacity-50' : ''}">
                  ${getFieldValue(book, field)}
                </td>
              `;
            }).join('')}
          </tr>
        `;
      })
      .join('');

    const headerCells = activeBooks
      .map(book => `
        <th class="py-4 px-4 text-center border-b-2 border-slate-300">
          <div class="font-semibold text-lg">${book.title}</div>
          <div class="text-sm text-slate-500">${book.author}</div>
        </th>
      `)
      .join('');

    viewContent.innerHTML = `
      ${inactiveWarning}
      <div class="card p-4 mb-4">
        <div class="flex flex-wrap items-center justify-between gap-4">
          <div class="flex items-center gap-2">
            <span class="text-2xl">📊</span>
            <div>
              <p class="font-semibold">正在对比 ${activeBooks.length} 本书籍</p>
              <p class="text-sm text-slate-500">差异项已高亮显示</p>
            </div>
          </div>
          <div class="flex flex-wrap gap-2">
            <button class="btn-outline" data-action="back-to-books">继续选书</button>
            <button class="btn-outline" data-action="clear-comparison">清空对比</button>
          </div>
        </div>
      </div>
      
      <div class="card p-4 overflow-x-auto">
        <table class="w-full border-collapse">
          <thead>
            <tr>
              <th class="py-4 px-4 text-left font-semibold text-slate-700 bg-slate-50 w-28 border-b-2 border-slate-300">属性</th>
              ${headerCells}
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>
      </div>
    `;
  }

  const viewRenderers = {
    books: renderBooks,
    cart: renderCart,
    orders: renderOrders,
    invoices: renderInvoices,
    reservations: renderReservations,
    notifications: renderNotifications,
    profile: renderProfile,
    admin: renderAdmin,
    'book-lists': renderBookLists,
    'book-list-detail': renderBookListDetail,
    'book-detail': renderBookDetail,
    comparison: renderComparison
  };

  function renderView() {
    setNavActive(state.view);
    const renderer = viewRenderers[state.view];
    if (renderer) renderer();
  }

  function safeRender() {
    try {
      renderView();
      updateComparisonUI();
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
    updateComparisonUI,
    renderView,
    safeRender
  };
}
