import { z } from 'zod';
import {
  loginSchema,
  registerSchema,
  forgotSchema,
  resetSchema,
  reviewSchema,
  checkoutSchema,
  addressSchema,
  adminBookSchema,
  adminCategorySchema,
  flashSaleCreateSchema,
  flashSalePurchaseSchema,
  invoiceApplySchema,
  invoiceRejectSchema,
  adminBookListSchema,
  bookListAddBookSchema,
  COVER_MAX_SIZE,
  COVER_TYPES
} from '../validation/schemas.js';

function getFormData(form) {
  const data = new FormData(form);
  return Object.fromEntries(data.entries());
}

function clearFormErrors(form) {
  form.querySelectorAll('.error-text').forEach((el) => el.remove());
  form.querySelectorAll('.input-error').forEach((el) => {
    el.classList.remove('input-error');
    el.removeAttribute('aria-invalid');
  });
  form.querySelectorAll('.field-error').forEach((el) => el.classList.remove('field-error'));
}

function markFieldError(field, message) {
  if (!field) return;
  field.classList.add('input-error');
  field.setAttribute('aria-invalid', 'true');
  const msg = document.createElement('p');
  msg.className = 'error-text';
  msg.textContent = message;
  field.insertAdjacentElement('afterend', msg);
}

function applyZodErrors(form, error) {
  const issues = error.issues || error.errors || [];
  const seen = new Set();

  issues.forEach((issue) => {
    const name = issue.path?.[0];
    if (!name || seen.has(name)) return;
    seen.add(name);

    const fields = Array.from(form.querySelectorAll(`[name="${name}"]`));
    if (!fields.length) return;

    if (fields.length > 1 && fields[0].type === 'radio') {
      fields.forEach((field) => {
        const card = field.closest('.card') || field.closest('label');
        if (card) card.classList.add('field-error');
        field.setAttribute('aria-invalid', 'true');
      });
      const group =
        form.querySelector(`[data-error-group="${name}"]`) ||
        fields[fields.length - 1].parentElement;
      if (group) {
        const msg = document.createElement('p');
        msg.className = 'error-text';
        msg.textContent = issue.message;
        group.insertAdjacentElement('afterend', msg);
      }
      return;
    }

    fields.forEach((field) => markFieldError(field, issue.message));
  });
}

function handleZodError(form, error) {
  if (error instanceof z.ZodError) {
    applyZodErrors(form, error);
    return true;
  }
  return false;
}

function handleApiValidationError(form, error) {
  const issues = error?.payload?.details;
  if (!Array.isArray(issues) || issues.length === 0) {
    return false;
  }

  applyZodErrors(form, { issues });
  return true;
}

function clearFieldError(field) {
  if (!field) return;
  const form = field.closest('form');
  if (field.type === 'radio' && form) {
    const group = form.querySelector(`[data-error-group="${field.name}"]`);
    if (group && group.nextElementSibling?.classList.contains('error-text')) {
      group.nextElementSibling.remove();
    }
    form.querySelectorAll(`[name="${field.name}"]`).forEach((radio) => {
      const card = radio.closest('.card') || radio.closest('label');
      if (card) card.classList.remove('field-error');
      radio.removeAttribute('aria-invalid');
    });
    return;
  }

  field.classList.remove('input-error');
  field.removeAttribute('aria-invalid');
  if (field.nextElementSibling?.classList.contains('error-text')) {
    field.nextElementSibling.remove();
  }
}

function validateCoverFile(file, form) {
  if (!file) return true;
  const input = form.querySelector('[name="coverFile"]');
  if (!COVER_TYPES.includes(file.type)) {
    markFieldError(input, '仅支持 JPG/PNG/WEBP/GIF/SVG 格式');
    return false;
  }
  if (file.size > COVER_MAX_SIZE) {
    markFieldError(input, '图片大小不能超过 2MB');
    return false;
  }
  return true;
}

export function bindEventHandlers({
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
  safeRender,
  openModal,
  closeModal,
  openLoginModal,
  openRegisterModal,
  openForgotModal,
  openResetModal
}) {
  const modalActionHandlers = {
    'close-modal': closeModal,
    'show-register': openRegisterModal,
    'show-login': openLoginModal,
    'show-forgot': openForgotModal
  };

  modal.addEventListener('click', (event) => {
    if (event.target === modal) {
      closeModal();
      return;
    }
    const action = event.target?.dataset?.action;
    const handler = modalActionHandlers[action];
    if (handler) handler();
  });

  document.addEventListener('input', (event) => {
    const field = event.target;
    if (!(field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement || field instanceof HTMLSelectElement)) {
      return;
    }
    if (!field.closest('form')) return;
    clearFieldError(field);
  });

  const modalFormHandlers = {
    login: async (form) => {
      const data = getFormData(form);
      const parsed = loginSchema.parse({
        account: data.account,
        password: data.password,
        remember: Boolean(data.remember)
      });
      const response = await api.login(parsed);
      api.setToken(response.accessToken, parsed.remember);
      state.user = response.user;
      updateAuthUI();
      closeModal();
      showToast('登录成功', 'success');
      await setView('books');
    },
    register: async (form) => {
      const data = getFormData(form);
      const parsed = registerSchema.parse({
        username: data.username,
        email: data.email,
        phone: data.phone,
        password: data.password
      });
      await api.register(parsed);
      showToast('注册成功，请登录', 'success');
      openLoginModal();
    },
    forgot: async (form) => {
      const data = getFormData(form);
      const parsed = forgotSchema.parse({ account: data.account, method: data.method });
      const response = await api.forgotPassword(parsed);
      const methodText = parsed.method === 'email' ? '邮箱' : '手机';
      showToast(`验证码已发送至您的${methodText}，验证码：${response.code}`, 'success');
      openResetModal();
    },
    reset: async (form) => {
      const data = getFormData(form);
      const parsed = resetSchema.parse({ token: data.token, newPassword: data.newPassword });
      await api.resetPassword(parsed);
      showToast('密码已更新', 'success');
      openLoginModal();
    },
    review: async (form) => {
      const data = getFormData(form);
      const parsed = reviewSchema.parse({
        rating: data.rating,
        reviewText: data.reviewText
      });
      await api.reviewOrder(form.dataset.order, parsed);
      closeModal();
      await loadOrders();
      safeRender();
      showToast('评价已提交', 'success');
    },
    'invoice-apply': async (form) => {
      const data = getFormData(form);
      const parsed = invoiceApplySchema.parse({
        orderId: data.orderId,
        titleType: data.titleType,
        titleName: data.titleName,
        taxNumber: data.taxNumber || undefined,
        email: data.email
      });
      const submitBtn = form.querySelector('button[type="submit"]');
      const originalText = submitBtn?.textContent;
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = '提交中...';
      }
      try {
        await api.applyInvoice(parsed);
        closeModal();
        showToast('发票申请已提交', 'success');
        if (typeof loadOrders === 'function') await loadOrders();
        if (typeof loadInvoices === 'function') await loadInvoices();
        safeRender();
      } finally {
        if (submitBtn && document.body.contains(submitBtn)) {
          submitBtn.disabled = false;
          submitBtn.textContent = originalText || '提交申请';
        }
      }
    },
    'invoice-reject': async (form) => {
      const data = getFormData(form);
      const parsed = invoiceRejectSchema.parse({
        reason: data.reason
      });
      const invoiceId = form.dataset.invoiceId;
      await api.admin.rejectInvoice(invoiceId, parsed);
      closeModal();
      showToast('发票已驳回', 'success');
      if (typeof loadAdmin === 'function') await loadAdmin();
      safeRender();
    }
  };

  modal.addEventListener('change', (event) => {
    const target = event.target;
    if (target.name === 'titleType') {
      const form = target.closest('form');
      if (form && form.dataset.form === 'invoice-apply') {
        updateTaxNumberVisibility(form);
      }
    }
  });

  modal.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;
    const formType = form.dataset.form;
    const handler = modalFormHandlers[formType];
    if (!handler) return;

    try {
      clearFormErrors(form);
      await handler(form);
    } catch (error) {
      if (handleZodError(form, error)) return;
      if (handleApiValidationError(form, error)) return;
      showToast(error.message || '操作失败', 'error');
    }
  });

  const contentFormHandlers = {
    'book-search': async (form) => {
      const data = getFormData(form);
      await loadBooks(normalizeBookSearch(data));
    },
    checkout: async (form) => {
      const data = getFormData(form);
      const parsed = checkoutSchema.parse({
        addressId: data.addressId,
        paymentMethod: data.paymentMethod
      });
      const submitBtn = form.querySelector('button[type="submit"]');
      const originalText = submitBtn?.textContent;
      if (submitBtn) {
        if (submitBtn.disabled) return;
        submitBtn.disabled = true;
        submitBtn.textContent = '处理中...';
      }

      try {
        await api.checkout(parsed);
        showToast('订单已生成，请完成支付', 'success');
        await loadCart();
        await loadOrders();
        state.view = 'orders';
        safeRender();
      } finally {
        if (submitBtn && document.body.contains(submitBtn)) {
          submitBtn.disabled = false;
          submitBtn.textContent = originalText || '生成待支付订单';
        }
      }
    },
    address: async (form) => {
      const data = getFormData(form);
      const parsed = addressSchema.parse({
        ...data,
        isDefault: Boolean(data.isDefault)
      });
      if (data.addressId) {
        await api.updateAddress(data.addressId, parsed);
        showToast('地址已更新', 'success');
      } else {
        await api.addAddress(parsed);
        showToast('地址已新增', 'success');
      }
      await loadAddresses();
      state.profile.editingAddress = null;
      safeRender();
    },
    'admin-book': async (form) => {
      const data = getFormData(form);
      const coverFile = data.coverFile instanceof File && data.coverFile.size > 0 ? data.coverFile : null;
      let coverUrl = state.admin.editingBook?.coverUrl || '';
      if (!validateCoverFile(coverFile, form)) {
        return;
      }
      if (coverFile) {
        const upload = await api.admin.uploadCover(coverFile);
        coverUrl = upload.url;
      }
      const payload = adminBookSchema.parse({
        title: data.title,
        author: data.author,
        isbn: data.isbn,
        description: data.description,
        price: data.price,
        stock: data.stock,
        coverUrl,
        categoryId: data.categoryId
      });
      if (state.admin.editingBook) {
        await api.admin.updateBook(state.admin.editingBook.id, payload);
        state.admin.editingBook = null;
        showToast('书籍已更新', 'success');
      } else {
        await api.admin.createBook(payload);
        showToast('书籍已添加', 'success');
      }
      await loadAdmin();
      safeRender();
      form.reset();
    },
    'admin-category': async (form) => {
      const data = getFormData(form);
      const parsed = adminCategorySchema.parse({ name: data.name });
      await api.admin.createCategory(parsed);
      showToast('分类已添加', 'success');
      await loadAdmin();
      safeRender();
      form.reset();
    },
    'admin-flash-sale': async (form) => {
      const data = getFormData(form);
      const parsed = flashSaleCreateSchema.parse({
        bookId: data.bookId,
        salePrice: data.salePrice,
        stock: data.stock,
        startTime: data.startTime,
        endTime: data.endTime,
        perUserLimit: data.perUserLimit
      });
      
      if (data.flashSaleId) {
        await api.admin.updateFlashSale(data.flashSaleId, parsed);
        state.admin.editingFlashSale = null;
        showToast('秒杀场次已更新', 'success');
      } else {
        await api.admin.createFlashSale(parsed);
        showToast('秒杀场次已创建', 'success');
      }
      await loadAdmin();
      safeRender();
      form.reset();
    },
    'flash-sale-purchase': async (form) => {
      const data = getFormData(form);
      const parsed = flashSalePurchaseSchema.parse({
        flashSaleId: data.flashSaleId,
        quantity: data.quantity,
        addressId: data.addressId,
        paymentMethod: data.paymentMethod
      });
      
      const submitBtn = form.querySelector('button[type="submit"]');
      const originalText = submitBtn?.textContent;
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = '抢购中...';
      }
      
      try {
        const result = await api.purchaseFlashSale(parsed);
        showToast(`抢购成功！订单号：${result.orderId}`, 'success');
        closeModal();
        await loadFlashSales();
        await loadOrders();
        if (typeof state === 'object' && state.view === 'books') {
          safeRender();
        }
      } finally {
        if (submitBtn && document.body.contains(submitBtn)) {
          submitBtn.disabled = false;
          submitBtn.textContent = originalText || '立即抢购';
        }
      }
    },
    'admin-book-list': async (form) => {
      const data = getFormData(form);
      const coverFile = data.coverFile instanceof File && data.coverFile.size > 0 ? data.coverFile : null;
      let coverUrl = state.admin.editingBookList?.coverUrl || data.coverUrl || '';
      
      if (!validateCoverFile(coverFile, form)) {
        return;
      }
      
      if (coverFile) {
        const upload = await api.admin.uploadCover(coverFile);
        coverUrl = upload.url;
      }
      
      const payload = adminBookListSchema.parse({
        title: data.title,
        coverUrl,
        description: data.description,
        sortOrder: data.sortOrder
      });
      
      if (data.bookListId) {
        await api.admin.updateBookList(data.bookListId, payload);
        state.admin.editingBookList = null;
        showToast('书单已更新', 'success');
      } else {
        await api.admin.createBookList(payload);
        showToast('书单已创建', 'success');
      }
      
      await loadAdmin();
      safeRender();
      form.reset();
    },
    'admin-add-book-to-list': async (form) => {
      const data = getFormData(form);
      const parsed = bookListAddBookSchema.parse({
        bookId: data.bookId
      });
      
      const updated = await api.admin.addBookToList(data.bookListId, parsed);
      state.admin.selectedBookList = updated;
      showToast('书籍已添加', 'success');
      await loadAdmin();
      safeRender();
    }
  };

  viewContent.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;
    const formType = form.dataset.form;
    const handler = contentFormHandlers[formType];
    if (!handler) return;

    try {
      clearFormErrors(form);
      await handler(form);
    } catch (error) {
      if (handleZodError(form, error)) return;
      if (handleApiValidationError(form, error)) return;
      showToast(error.message || '提交失败', 'error');
    }
  });

  const contentActionHandlers = {
    'add-to-cart': async (target) => {
      if (!state.user) {
        openLoginModal();
        return;
      }
      await api.addToCart({ bookId: target.dataset.id, quantity: 1 });
      showToast('已加入购物车', 'success');
    },
    'reset-search': async (target) => {
      const form = target.closest('form');
      if (form) {
        form.reset();
        clearFormErrors(form);
      }
      state.bookSearch = normalizeBookSearch();
      await loadBooks(state.bookSearch);
    },
    'remove-cart': async (target) => {
      await api.removeCart(target.dataset.id);
      await loadCart();
      safeRender();
    },
    'clear-cart': async () => {
      await api.clearCart();
      await loadCart();
      safeRender();
    },
    'cancel-order': async (target) => {
      await api.cancelOrder(target.dataset.id);
      await loadOrders();
      safeRender();
    },
    'pay-order': async (target) => {
      await api.payOrder(target.dataset.id);
      await loadOrders();
      safeRender();
      showToast('支付成功', 'success');
    },
    'confirm-order': async (target) => {
      await api.confirmOrder(target.dataset.id);
      await loadOrders();
      safeRender();
    },
    'review-order': async (target) => {
      const orderId = target.dataset.id;
      openModal(`
        <div class="space-y-4">
          <h3 class="text-lg font-semibold">评价订单</h3>
          <form data-form="review" data-order="${orderId}" class="space-y-3" novalidate>
            <input class="input" name="rating" type="number" min="1" max="5" placeholder="评分 1-5" required />
            <textarea class="input" name="reviewText" rows="3" placeholder="评价内容" required></textarea>
            <button class="btn-primary w-full" type="submit">提交评价</button>
          </form>
        </div>
      `);
    },
    'set-default': async (target) => {
      await api.setDefaultAddress(target.dataset.id);
      await loadAddresses();
      if (state.profile.editingAddress?.id === target.dataset.id) {
        state.profile.editingAddress = state.addresses.find((item) => item.id === target.dataset.id) || null;
      }
      safeRender();
    },
    'edit-address': async (target) => {
      state.profile.editingAddress = state.addresses.find((item) => item.id === target.dataset.id) || null;
      safeRender();
    },
    'cancel-edit-address': async () => {
      state.profile.editingAddress = null;
      safeRender();
    },
    'delete-address': async (target) => {
      await api.deleteAddress(target.dataset.id);
      await loadAddresses();
      if (state.profile.editingAddress?.id === target.dataset.id) {
        state.profile.editingAddress = null;
      }
      safeRender();
    },
    'admin-tab': async (target) => {
      state.admin.tab = target.dataset.tab;
      safeRender();
    },
    'edit-book': async (target) => {
      const book = state.admin.books.find((item) => item.id === target.dataset.id);
      state.admin.editingBook = book;
      safeRender();
    },
    'deactivate-book': async (target) => {
      await api.admin.deactivateBook(target.dataset.id);
      await loadAdmin();
      safeRender();
    },
    'restore-book': async (target) => {
      await api.admin.restoreBook(target.dataset.id);
      await loadAdmin();
      safeRender();
    },
    'delete-category': async (target) => {
      await api.admin.deleteCategory(target.dataset.id);
      await loadAdmin();
      safeRender();
    },
    'admin-accept': async (target) => {
      await api.admin.acceptOrder(target.dataset.id);
      await loadAdmin();
      safeRender();
    },
    'admin-ship': async (target) => {
      await api.admin.shipOrder(target.dataset.id);
      await loadAdmin();
      safeRender();
    },
    'admin-refund': async (target) => {
      await api.admin.refundOrder(target.dataset.id);
      await loadAdmin();
      safeRender();
    },
    'export-orders': async () => {
      const response = await api.admin.exportOrders();
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'orders.csv';
      link.click();
      URL.revokeObjectURL(url);
    },
    'purchase-flash-sale': async (target) => {
      if (!state.user) {
        openLoginModal();
        return;
      }
      
      const flashSaleId = target.dataset.id;
      const flashSale = state.flashSales.items?.find(item => item.id === flashSaleId);
      if (!flashSale) {
        showToast('秒杀场次不存在', 'error');
        return;
      }
      
      const now = new Date(Date.now() + (state.flashSales.clientTimeOffset || 0));
      const startTime = new Date(flashSale.startTime);
      const endTime = new Date(flashSale.endTime);
      
      if (now < startTime) {
        showToast('秒杀还未开始', 'error');
        return;
      }
      if (now > endTime) {
        showToast('秒杀已结束', 'error');
        return;
      }
      
      const remainingStock = flashSale.stock - flashSale.soldCount;
      if (remainingStock <= 0) {
        showToast('秒杀已售罄', 'error');
        return;
      }
      
      if (!state.addresses || state.addresses.length === 0) {
        try {
          await loadAddresses();
        } catch (e) {
          // ignore
        }
      }
      
      const addressOptions = (state.addresses || [])
        .map(
          (addr) => `
          <option value="${addr.id}" ${addr.isDefault ? 'selected' : ''}>
            ${addr.recipient} ${addr.phone} ${addr.state}${addr.city}${addr.line1}
          </option>
        `
        )
        .join('');
      
      if (!addressOptions) {
        showToast('请先添加收货地址', 'error');
        return;
      }
      
      const book = flashSale.book || {};
      
      openModal(`
        <div class="space-y-4">
          <h3 class="text-lg font-semibold">确认抢购</h3>
          <div class="flex gap-3 p-3 bg-slate-50 rounded-xl">
            <img src="${book.coverUrl || '/covers/cover-1.svg'}" alt="${book.title || ''}" class="w-16 h-20 object-contain rounded-lg bg-white" />
            <div class="flex-1">
              <p class="font-semibold">${book.title || ''}</p>
              <p class="text-sm text-slate-500">${book.author || ''}</p>
              <div class="flex items-baseline gap-2 mt-1">
                <span class="text-lg font-bold text-red-500">${formatCurrencyLocal(flashSale.salePrice)}</span>
                <span class="text-xs text-slate-400 line-through">${formatCurrencyLocal(book.originalPrice || flashSale.originalPrice || 0)}</span>
              </div>
            </div>
          </div>
          <form data-form="flash-sale-purchase" class="space-y-3" novalidate>
            <input type="hidden" name="flashSaleId" value="${flashSaleId}" />
            <div class="space-y-1">
              <label class="text-sm text-slate-600">购买数量</label>
              <input class="input" type="number" name="quantity" min="1" max="${Math.min(flashSale.perUserLimit, remainingStock)}" value="1" required />
              <p class="text-xs text-slate-500">每人限购 ${flashSale.perUserLimit} 件，剩余 ${remainingStock} 件</p>
            </div>
            <div class="space-y-1">
              <label class="text-sm text-slate-600">收货地址</label>
              <select class="input" name="addressId" required>
                <option value="">请选择收货地址</option>
                ${addressOptions}
              </select>
            </div>
            <div class="space-y-1">
              <label class="text-sm text-slate-600">支付方式</label>
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
            </div>
            <button class="btn-primary w-full" type="submit">立即抢购</button>
          </form>
        </div>
      `);
    },
    'edit-flash-sale': async (target) => {
      const fs = state.admin.flashSales.find((item) => item.id === target.dataset.id);
      state.admin.editingFlashSale = fs;
      safeRender();
    },
    'cancel-edit-flash-sale': async () => {
      state.admin.editingFlashSale = null;
      safeRender();
    },
    'delete-flash-sale': async (target) => {
      if (!confirm('确定要删除这个秒杀场次吗？删除后无法恢复。')) {
        return;
      }
      await api.admin.deleteFlashSale(target.dataset.id);
      await loadAdmin();
      safeRender();
      showToast('秒杀场次已删除', 'success');
    },
    'apply-invoice': async (target) => {
      if (!state.user) {
        openLoginModal();
        return;
      }
      const orderId = target.dataset.id;
      const order = state.orders?.find(o => o.id === orderId);
      if (!order) {
        showToast('订单不存在', 'error');
        return;
      }
      if (order.status === 'REFUNDED') {
        showToast('退款订单不可申请发票', 'error');
        return;
      }
      if (order.hasInvoice && order.invoiceStatus !== 'REJECTED') {
        showToast('该订单已有发票申请', 'error');
        return;
      }
      openModal(`
        <div class="space-y-4">
          <h3 class="text-lg font-semibold">申请电子发票</h3>
          <p class="text-sm text-slate-500">订单号：${orderId} · 金额：${formatCurrencyLocal(order.total)}</p>
          <form data-form="invoice-apply" data-order="${orderId}" class="space-y-3" novalidate>
            <input type="hidden" name="orderId" value="${orderId}" />
            <div class="space-y-1">
              <label class="text-sm text-slate-600">抬头类型</label>
              <div class="grid grid-cols-2 gap-3" data-error-group="titleType">
                <label class="card p-3 flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="titleType" value="PERSONAL" checked /> 个人
                </label>
                <label class="card p-3 flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="titleType" value="ENTERPRISE" /> 企业
                </label>
              </div>
            </div>
            <div class="space-y-1">
              <label class="text-sm text-slate-600">抬头名称</label>
              <input class="input" name="titleName" placeholder="请输入抬头名称" required />
            </div>
            <div class="space-y-1" id="tax-number-field">
              <label class="text-sm text-slate-600">企业税号</label>
              <input class="input" name="taxNumber" placeholder="请输入18位统一社会信用代码" />
              <p class="text-xs text-slate-400">企业抬头必填，请输入18位统一社会信用代码</p>
            </div>
            <div class="space-y-1">
              <label class="text-sm text-slate-600">接收邮箱</label>
              <input class="input" name="email" type="email" placeholder="请输入邮箱地址" required />
            </div>
            <button class="btn-primary w-full" type="submit">提交申请</button>
          </form>
        </div>
      `);
      setupInvoiceForm();
    },
    'download-invoice': async (target) => {
      const invoiceId = target.dataset.id;
      const invoice = state.invoices?.find(inv => inv.id === invoiceId);
      if (!invoice || !invoice.invoiceContent) {
        showToast('发票内容不存在', 'error');
        return;
      }
      const blob = new Blob([invoice.invoiceContent], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `发票_${invoice.invoiceNumber || invoice.id}.txt`;
      link.click();
      URL.revokeObjectURL(url);
      showToast('发票已下载', 'success');
    },
    'admin-issue-invoice': async (target) => {
      const invoiceId = target.dataset.id;
      if (!confirm('确定要开具这张发票吗？')) {
        return;
      }
      await api.admin.issueInvoice(invoiceId);
      showToast('发票已开具', 'success');
      if (typeof loadAdmin === 'function') await loadAdmin();
      safeRender();
    },
    'admin-reject-invoice': async (target) => {
      const invoiceId = target.dataset.id;
      openModal(`
        <div class="space-y-4">
          <h3 class="text-lg font-semibold">驳回发票申请</h3>
          <form data-form="invoice-reject" data-invoice-id="${invoiceId}" class="space-y-3" novalidate>
            <div class="space-y-1">
              <label class="text-sm text-slate-600">驳回原因</label>
              <textarea class="input" name="reason" rows="3" placeholder="请填写驳回原因" required></textarea>
            </div>
            <button class="btn-primary w-full" type="submit">确认驳回</button>
          </form>
        </div>
      `);
    },
    'admin-view-invoice': async (target) => {
      const invoiceId = target.dataset.id;
      const invoice = state.admin.invoices?.find(inv => inv.id === invoiceId);
      if (!invoice) {
        showToast('发票不存在', 'error');
        return;
      }
      openModal(`
        <div class="space-y-4">
          <h3 class="text-lg font-semibold">发票详情</h3>
          <div class="space-y-2 text-sm">
            <p><span class="text-slate-400">发票号码：</span>${invoice.invoiceNumber || '-'}</p>
            <p><span class="text-slate-400">抬头类型：</span>${invoice.titleType === 'PERSONAL' ? '个人' : '企业'}</p>
            <p><span class="text-slate-400">抬头名称：</span>${invoice.titleName}</p>
            ${invoice.taxNumber ? `<p><span class="text-slate-400">税号：</span>${invoice.taxNumber}</p>` : ''}
            <p><span class="text-slate-400">金额：</span>${formatCurrencyLocal(invoice.order?.total || 0)}</p>
            <p><span class="text-slate-400">开票时间：</span>${invoice.issuedAt ? new Date(invoice.issuedAt).toLocaleString() : '-'}</p>
          </div>
          <div class="bg-teal-50 border border-teal-100 rounded-xl p-4 text-sm text-teal-700 whitespace-pre-wrap">${escapeHtml(invoice.invoiceContent || '')}</div>
        </div>
      `);
    },
    'view-book-list': async (target) => {
      const id = target.dataset.id;
      await loadBookListDetail(id);
      state.view = 'book-list-detail';
      safeRender();
    },
    'back-to-book-lists': async () => {
      state.currentBookList = null;
      state.admin.editingBookList = null;
      state.admin.selectedBookList = null;
      if (state.admin.tab === 'book-lists') {
        safeRender();
      } else {
        state.view = 'book-lists';
        await loadBookLists();
        safeRender();
      }
    },
    'create-book-list': async () => {
      state.admin.editingBookList = { title: '', coverUrl: '', description: '', sortOrder: 0 };
      state.admin.selectedBookList = null;
      safeRender();
    },
    'edit-book-list': async (target) => {
      const id = target.dataset.id;
      const list = state.admin.bookLists?.find(item => item.id === id) || state.admin.selectedBookList;
      if (list) {
        state.admin.editingBookList = { ...list };
        state.admin.selectedBookList = null;
      }
      safeRender();
    },
    'cancel-edit-book-list': async () => {
      state.admin.editingBookList = null;
      safeRender();
    },
    'manage-book-list': async (target) => {
      const id = target.dataset.id;
      const list = state.admin.bookLists?.find(item => item.id === id);
      if (list) {
        const fullList = await api.admin.getBookList(id);
        state.admin.selectedBookList = fullList;
        state.admin.editingBookList = null;
      }
      safeRender();
    },
    'delete-book-list': async (target) => {
      if (!confirm('确定要删除这个书单吗？删除后无法恢复。')) {
        return;
      }
      await api.admin.deleteBookList(target.dataset.id);
      state.admin.selectedBookList = null;
      state.admin.editingBookList = null;
      showToast('书单已删除', 'success');
      await loadAdmin();
      safeRender();
    },
    'publish-book-list': async (target) => {
      if (!confirm('确定要上线这个书单吗？上线后用户端将可见。')) {
        return;
      }
      const updated = await api.admin.publishBookList(target.dataset.id);
      if (state.admin.selectedBookList?.id === target.dataset.id) {
        state.admin.selectedBookList = updated;
      }
      showToast('书单已上线', 'success');
      await loadAdmin();
      safeRender();
    },
    'unpublish-book-list': async (target) => {
      if (!confirm('确定要下线这个书单吗？下线后用户端将不可见。')) {
        return;
      }
      const updated = await api.admin.unpublishBookList(target.dataset.id);
      if (state.admin.selectedBookList?.id === target.dataset.id) {
        state.admin.selectedBookList = updated;
      }
      showToast('书单已下线', 'success');
      await loadAdmin();
      safeRender();
    },
    'remove-book-from-list': async (target) => {
      if (!confirm('确定要从书单中移除这本书吗？')) {
        return;
      }
      const bookId = target.dataset.id;
      const listId = state.admin.selectedBookList?.id;
      if (!listId) return;
      
      const updated = await api.admin.removeBookFromList(listId, bookId);
      state.admin.selectedBookList = updated;
      showToast('书籍已移除', 'success');
      await loadAdmin();
      safeRender();
    },
    'move-book-up': async (target) => {
      const bookId = target.dataset.id;
      const list = state.admin.selectedBookList;
      if (!list) return;
      
      const items = list.items;
      const index = items.findIndex(item => item.bookId === bookId);
      if (index <= 0) return;
      
      const newOrder = [...items];
      [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
      
      const bookIds = newOrder.map(item => item.bookId);
      const updated = await api.admin.reorderBooksInList(list.id, { bookIds });
      state.admin.selectedBookList = updated;
      await loadAdmin();
      safeRender();
    },
    'move-book-down': async (target) => {
      const bookId = target.dataset.id;
      const list = state.admin.selectedBookList;
      if (!list) return;
      
      const items = list.items;
      const index = items.findIndex(item => item.bookId === bookId);
      if (index < 0 || index >= items.length - 1) return;
      
      const newOrder = [...items];
      [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
      
      const bookIds = newOrder.map(item => item.bookId);
      const updated = await api.admin.reorderBooksInList(list.id, { bookIds });
      state.admin.selectedBookList = updated;
      await loadAdmin();
      safeRender();
    }
  };
  
  function formatCurrencyLocal(value) {
    return `¥${Number(value).toFixed(2)}`;
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function setupInvoiceForm() {
    const form = document.querySelector('[data-form="invoice-apply"]');
    if (!form) return;
    updateTaxNumberVisibility(form);
  }

  function updateTaxNumberVisibility(form) {
    const titleType = form.querySelector('input[name="titleType"]:checked')?.value;
    const taxNumberField = document.getElementById('tax-number-field');
    if (!taxNumberField) return;
    if (titleType === 'ENTERPRISE') {
      taxNumberField.style.display = '';
    } else {
      taxNumberField.style.display = 'none';
    }
  }

  viewContent.addEventListener('click', async (event) => {
    const actionTarget = event.target.closest('[data-action]');
    if (!(actionTarget instanceof HTMLElement)) return;
    const action = actionTarget.dataset.action;
    const handler = contentActionHandlers[action];
    if (!handler) return;

    try {
      await handler(actionTarget);
    } catch (error) {
      showToast(error.message || '操作失败', 'error');
    }
  });

  const contentChangeHandlers = {
    'update-qty': async (target) => {
      await api.updateCart(target.dataset.id, { quantity: Number(target.value) });
      await loadCart();
      safeRender();
    }
  };

  viewContent.addEventListener('change', async (event) => {
    const target = event.target;
    const action = target?.dataset?.action;
    const handler = contentChangeHandlers[action];
    if (!handler) return;

    try {
      await handler(target);
    } catch (error) {
      showToast(error.message || '更新失败', 'error');
    }
  });

  window.addEventListener('error', () => {
    showToast('页面发生错误', 'error');
  });

  window.addEventListener('unhandledrejection', () => {
    showToast('请求失败，请稍后重试', 'error');
  });
}
