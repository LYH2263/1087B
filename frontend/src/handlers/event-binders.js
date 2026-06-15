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
  adminTagSchema,
  flashSaleCreateSchema,
  flashSalePurchaseSchema,
  invoiceApplySchema,
  invoiceRejectSchema,
  adminBookListSchema,
  bookListAddBookSchema,
  questionSchema,
  answerSchema,
  shippingRuleSchema,
  COVER_MAX_SIZE,
  COVER_TYPES,
  REVIEW_IMAGE_MAX_SIZE,
  REVIEW_IMAGE_TYPES,
  REVIEW_IMAGE_MAX_COUNT
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
  comparisonBar,
  showToast,
  updateAuthUI,
  updateComparisonUI,
  updateNotificationBadge,
  setView,
  loadBooks,
  normalizeBookSearch,
  loadCart,
  loadOrders,
  loadInvoices,
  loadAddresses,
  loadAdmin,
  loadFlashSales,
  loadPreSales,
  loadMyReservations,
  loadNotifications,
  loadBookLists,
  loadBookListDetail,
  loadBookDetail,
  reloadBookQuestions,
  loadBookReviews,
  safeRender,
  openModal,
  closeModal,
  openLoginModal,
  openRegisterModal,
  openForgotModal,
  openResetModal,
  addToComparison,
  removeFromComparison,
  clearComparison,
  isInComparison,
  getComparisonCount,
  getMaxComparisonItems
}) {
  const MAX_COMPARISON_ITEMS = 4;
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
      try {
        await Promise.all([
          typeof loadNotifications === 'function' ? loadNotifications().catch(() => {}) : Promise.resolve(),
          typeof loadMyReservations === 'function' ? loadMyReservations().catch(() => {}) : Promise.resolve()
        ]);
      } catch (e) {
        // ignore
      }
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
      const imageInput = form.querySelector('input[name="reviewImages"]');
      const files = imageInput?.files ? Array.from(imageInput.files) : [];
      const oversized = files.filter(f => f.size > REVIEW_IMAGE_MAX_SIZE);
      if (oversized.length > 0) {
        markFieldError(imageInput, '图片大小不能超过 5MB');
        return;
      }
      const invalidType = files.filter(f => !REVIEW_IMAGE_TYPES.includes(f.type));
      if (invalidType.length > 0) {
        markFieldError(imageInput, '仅支持 JPG/PNG/WEBP 格式');
        return;
      }
      if (files.length > REVIEW_IMAGE_MAX_COUNT) {
        markFieldError(imageInput, `最多上传 ${REVIEW_IMAGE_MAX_COUNT} 张图片`);
        return;
      }
      const submitBtn = form.querySelector('button[type="submit"]');
      const originalText = submitBtn?.textContent;
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = '提交中...';
      }
      try {
        await api.reviewOrder(form.dataset.order, {
          ...parsed,
          images: files
        });
        closeModal();
        await loadOrders();
        safeRender();
        showToast('评价已提交', 'success');
      } catch (error) {
        if (handleZodError(form, error)) return;
        if (handleApiValidationError(form, error)) return;
        showToast(error.message || '评价提交失败', 'error');
      } finally {
        if (submitBtn && document.body.contains(submitBtn)) {
          submitBtn.disabled = false;
          submitBtn.textContent = originalText || '提交评价';
        }
      }
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
      const checkedCheckboxes = viewContent.querySelectorAll('.cart-item-check:checked');
      const selectedItemIds = checkedCheckboxes.length > 0
        ? Array.from(checkedCheckboxes).map(cb => cb.dataset.id)
        : state.cart.map(item => item.id);

      const parsed = checkoutSchema.parse({
        addressId: data.addressId,
        paymentMethod: data.paymentMethod,
        selectedItemIds
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
        if (typeof loadShippingCalculation === 'function') await loadShippingCalculation();
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
      const { smartInput, ...addressData } = data;
      const parsed = addressSchema.parse({
        ...addressData,
        isDefault: Boolean(addressData.isDefault)
      });
      if (addressData.addressId) {
        await api.updateAddress(addressData.addressId, parsed);
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
      
      const tagIds = form.querySelectorAll('input[name="tagIds"]:checked');
      const selectedTagIds = Array.from(tagIds).map(el => el.value);
      
      if (state.admin.editingBook) {
        await api.admin.updateBook(state.admin.editingBook.id, payload);
        await api.admin.updateBookTags(state.admin.editingBook.id, { tagIds: selectedTagIds });
        state.admin.editingBook = null;
        state.admin.editingBookTags = [];
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
    'admin-tag': async (form) => {
      const data = getFormData(form);
      const parsed = adminTagSchema.parse({
        name: data.name,
        color: data.color
      });
      if (data.tagId) {
        await api.admin.updateTag(data.tagId, parsed);
        state.admin.editingTag = null;
        showToast('标签已更新', 'success');
      } else {
        await api.admin.createTag(parsed);
        showToast('标签已添加', 'success');
      }
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
    'admin-pre-sale': async (form) => {
      const data = getFormData(form);
      
      if (data.id) {
        const payload = {
          expectedArrivalDate: data.expectedArrivalDate,
          preSaleStock: Number(data.preSaleStock)
        };
        await api.admin.updatePreSale(data.id, payload);
        state.admin.editingPreSale = null;
        showToast('预售已更新', 'success');
      } else {
        const payload = {
          bookId: data.bookId,
          expectedArrivalDate: data.expectedArrivalDate,
          preSaleStock: Number(data.preSaleStock)
        };
        await api.admin.createPreSale(payload);
        showToast('预售已创建', 'success');
      }
      if (typeof loadAdmin === 'function') await loadAdmin();
      if (typeof loadPreSales === 'function') await loadPreSales();
      safeRender();
      form.reset();
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
    },
    question: async (form) => {
      if (!state.user) {
        openLoginModal();
        return;
      }
      const data = getFormData(form);
      const parsed = questionSchema.parse({ content: data.content });
      
      if (!state.currentBook) {
        showToast('书籍信息不存在', 'error');
        return;
      }
      
      await api.createQuestion(state.currentBook.id, parsed);
      showToast('提问成功', 'success');
      form.reset();
      state.bookQuestions.page = 1;
      await reloadBookQuestions();
      safeRender();
    },
    answer: async (form) => {
      if (!state.user) {
        openLoginModal();
        return;
      }
      const data = getFormData(form);
      const questionId = form.dataset.questionId;
      const parsed = answerSchema.parse({ content: data.content });
      
      if (!questionId) {
        showToast('问题不存在', 'error');
        return;
      }
      
      await api.createAnswer(questionId, parsed);
      showToast('回答成功', 'success');
      form.reset();
      await reloadBookQuestions();
      safeRender();
    },
    'admin-shipping-rule': async (form) => {
      const data = getFormData(form);
      const parsed = shippingRuleSchema.parse({
        name: data.name,
        type: data.type,
        fee: data.fee,
        freeThreshold: data.freeThreshold || null,
        isActive: data.isActive === 'on'
      });

      if (data.ruleId) {
        await api.admin.updateShippingRule(data.ruleId, parsed);
        state.admin.editingShippingRule = null;
        showToast('运费规则已更新', 'success');
      } else {
        await api.admin.createShippingRule(parsed);
        showToast('运费规则已创建', 'success');
      }
      if (typeof loadAdmin === 'function') await loadAdmin();
      safeRender();
      form.reset();
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
      if (state.view === 'cart' && typeof loadShippingCalculation === 'function') {
        await loadCart();
        await loadShippingCalculation();
      }
    },
    'toggle-tag-filter': async (target) => {
      const tagId = target.dataset.tagId;
      const currentTagIds = [...state.bookSearch.tagIds];
      const index = currentTagIds.indexOf(tagId);
      
      if (index > -1) {
        currentTagIds.splice(index, 1);
      } else {
        currentTagIds.push(tagId);
      }
      
      state.bookSearch.tagIds = currentTagIds;
      await loadBooks(state.bookSearch);
    },
    'change-tag-logic': async (target) => {
      state.bookSearch.tagLogic = target.dataset.logic;
      await loadBooks(state.bookSearch);
    },
    'clear-tag-filter': async () => {
      state.bookSearch.tagIds = [];
      await loadBooks(state.bookSearch);
    },
    'toggle-comparison': async (target) => {
      const bookId = target.dataset.id;
      const isChecked = target.checked;

      if (isChecked) {
        const book = state.books.find(b => b.id === bookId);
        if (book && book.status !== 'ACTIVE') {
          target.checked = false;
          showToast('已下架书籍不可加入对比', 'error');
          return;
        }

        if (isInComparison(bookId)) {
          showToast('该书已在对比列表中', 'error');
          return;
        }

        if (getComparisonCount() >= MAX_COMPARISON_ITEMS) {
          target.checked = false;
          showToast(`最多只能对比 ${MAX_COMPARISON_ITEMS} 本书`, 'error');
          return;
        }

        const result = addToComparison(bookId);
        if (result.success) {
          showToast('已加入对比', 'success');
        } else if (result.reason === 'duplicate') {
          target.checked = false;
          showToast('该书已在对比列表中', 'error');
        } else if (result.reason === 'limit') {
          target.checked = false;
          showToast(`最多只能对比 ${MAX_COMPARISON_ITEMS} 本书`, 'error');
        }
      } else {
        removeFromComparison(bookId);
        showToast('已从对比中移除', 'success');
      }

      if (state.view === 'comparison') {
        safeRender();
      } else {
        updateComparisonUI();
      }
    },
    'remove-from-comparison': async (target) => {
      const bookId = target.dataset.id;
      removeFromComparison(bookId);
      showToast('已从对比中移除', 'success');
      safeRender();
    },
    'clear-comparison': async () => {
      if (!confirm('确定要清空对比列表吗？')) {
        return;
      }
      clearComparison();
      showToast('对比列表已清空', 'success');
      safeRender();
    },
    'clear-inactive-comparison': async () => {
      const books = state.books.filter(book => state.comparison.items.includes(book.id));
      const inactiveIds = books.filter(b => b.status !== 'ACTIVE').map(b => b.id);
      inactiveIds.forEach(id => removeFromComparison(id));
      showToast(`已移除 ${inactiveIds.length} 本已下架书籍`, 'success');
      safeRender();
    },
    'go-to-comparison': async () => {
      const books = state.books.filter(book => state.comparison.items.includes(book.id));
      const activeBooks = books.filter(b => b.status === 'ACTIVE');
      if (activeBooks.length < 2) {
        showToast('请至少选择 2 本有效书籍进行对比', 'error');
        return;
      }
      state.view = 'comparison';
      safeRender();
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
      if (typeof loadShippingCalculation === 'function') await loadShippingCalculation();
      safeRender();
    },
    'clear-cart': async () => {
      await api.clearCart();
      await loadCart();
      if (typeof loadShippingCalculation === 'function') await loadShippingCalculation();
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
            <textarea class="input" name="reviewText" rows="3" placeholder="评价内容（3-500字）" required></textarea>
            <div class="space-y-2">
              <label class="text-sm text-slate-600">上传图片（最多${REVIEW_IMAGE_MAX_COUNT}张，支持JPG/PNG/WEBP，单张不超过5MB）</label>
              <input class="input" name="reviewImages" type="file" accept="image/png,image/jpeg,image/webp" multiple />
              <div id="review-image-previews" class="flex flex-wrap gap-2"></div>
            </div>
            <button class="btn-primary w-full" type="submit">提交评价</button>
          </form>
        </div>
      `);
      const fileInput = document.querySelector('form[data-form="review"] input[name="reviewImages"]');
      if (fileInput) {
        fileInput.addEventListener('change', (e) => {
          const previews = document.getElementById('review-image-previews');
          if (!previews) return;
          previews.innerHTML = '';
          const files = Array.from(e.target.files);
          if (files.length > REVIEW_IMAGE_MAX_COUNT) {
            markFieldError(fileInput, `最多上传 ${REVIEW_IMAGE_MAX_COUNT} 张图片`);
            return;
          }
          files.forEach(file => {
            if (!REVIEW_IMAGE_TYPES.includes(file.type)) return;
            if (file.size > REVIEW_IMAGE_MAX_SIZE) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
              const img = document.createElement('img');
              img.src = ev.target.result;
              img.className = 'w-16 h-16 object-cover rounded-lg border border-slate-200';
              img.alt = 'preview';
              previews.appendChild(img);
            };
            reader.readAsDataURL(file);
          });
        });
      }
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
    'parse-address': async (target) => {
      const form = target.closest('form');
      if (!form) return;
      
      const smartInput = form.querySelector('[name="smartInput"]');
      const text = smartInput?.value?.trim();
      
      if (!text) {
        showToast('请先粘贴地址文本', 'error');
        smartInput?.focus();
        return;
      }
      
      const parseBtn = target;
      const originalText = parseBtn.textContent;
      parseBtn.disabled = true;
      parseBtn.textContent = '解析中...';
      
      try {
        const result = await api.parseAddress(text);
        
        const fields = {
          recipient: form.querySelector('[name="recipient"]'),
          phone: form.querySelector('[name="phone"]'),
          line1: form.querySelector('[name="line1"]'),
          city: form.querySelector('[name="city"]'),
          state: form.querySelector('[name="state"]'),
          postalCode: form.querySelector('[name="postalCode"]')
        };
        
        const fieldLabels = {
          recipient: '收件人',
          phone: '手机号',
          line1: '详细地址',
          city: '城市',
          state: '省份',
          postalCode: '邮编'
        };
        
        Object.keys(fields).forEach(key => {
          if (result[key] && fields[key]) {
            fields[key].value = result[key];
            clearFieldError(fields[key]);
            fields[key].classList.add('ring-2', 'ring-teal-400', 'ring-opacity-50');
            setTimeout(() => {
              fields[key].classList.remove('ring-2', 'ring-teal-400', 'ring-opacity-50');
            }, 1500);
          }
        });
        
        const warningsContainer = form.querySelector('#parse-warnings');
        if (warningsContainer) {
          if (result.warnings && result.warnings.length > 0) {
            const criticalWarnings = result.warnings.filter(w => !w.includes('邮编'));
            const minorWarnings = result.warnings.filter(w => w.includes('邮编'));
            
            let html = '';
            if (criticalWarnings.length > 0) {
              html += `
                <div class="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-1">
                  <p class="text-sm font-medium text-amber-800">⚠️ 部分字段未识别，请手动补充：</p>
                  <ul class="text-sm text-amber-700 space-y-0.5">
                    ${criticalWarnings.map(w => `<li>• ${w}</li>`).join('')}
                  </ul>
                </div>
              `;
            }
            if (minorWarnings.length > 0) {
              html += `
                <div class="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-2">
                  <p class="text-sm text-blue-700">ℹ️ ${minorWarnings.join('、')}</p>
                </div>
              `;
            }
            
            warningsContainer.innerHTML = html;
            warningsContainer.classList.remove('hidden');
          } else {
            warningsContainer.innerHTML = `
              <div class="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                <p class="text-sm text-emerald-700">✅ 所有字段识别成功！请核对后提交</p>
              </div>
            `;
            warningsContainer.classList.remove('hidden');
          }
        }
        
        const successCount = Object.keys(fields).filter(key => result[key]).length;
        showToast(`已解析 ${successCount}/6 个字段`, 'success');
        
      } catch (error) {
        showToast(error.message || '解析失败，请重试', 'error');
      } finally {
        parseBtn.disabled = false;
        parseBtn.textContent = originalText;
      }
    },
    'admin-tab': async (target) => {
      state.admin.tab = target.dataset.tab;
      safeRender();
    },
    'edit-book': async (target) => {
      const book = state.admin.books.find((item) => item.id === target.dataset.id);
      state.admin.editingBook = book;
      state.admin.editingBookTags = book?.tags || [];
      safeRender();
    },
    'cancel-edit-book': async () => {
      state.admin.editingBook = null;
      state.admin.editingBookTags = [];
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
    'edit-tag': async (target) => {
      const tag = state.admin.tags.find((item) => item.id === target.dataset.id);
      state.admin.editingTag = tag;
      safeRender();
    },
    'cancel-edit-tag': async () => {
      state.admin.editingTag = null;
      safeRender();
    },
    'delete-tag': async (target) => {
      await api.admin.deleteTag(target.dataset.id);
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
    'reserve-book': async (target) => {
      if (!state.user) {
        openLoginModal();
        return;
      }
      const preSaleId = target.dataset.preSaleId || target.dataset.id;
      if (!preSaleId) {
        showToast('预售信息不存在', 'error');
        return;
      }
      await api.reservePreSale({ preSaleId });
      showToast('预约成功，到货后将第一时间通知您', 'success');
      if (typeof loadPreSales === 'function') await loadPreSales();
      if (typeof loadMyReservations === 'function') await loadMyReservations();
      safeRender();
    },
    'cancel-reservation': async (target) => {
      if (!confirm('确定要取消这个预约吗？')) {
        return;
      }
      const reservationId = target.dataset.id;
      await api.cancelReservation(reservationId);
      showToast('预约已取消', 'success');
      if (typeof loadMyReservations === 'function') await loadMyReservations();
      if (typeof loadPreSales === 'function') await loadPreSales();
      safeRender();
    },
    'buy-reserved-book': async (target) => {
      const bookId = target.dataset.id;
      await api.addToCart({ bookId, quantity: 1 });
      showToast('已加入购物车', 'success');
      state.view = 'cart';
      if (typeof setView === 'function') {
        await setView('cart');
      } else {
        safeRender();
      }
    },
    'go-to-books': async () => {
      state.view = 'books';
      safeRender();
    },
    'go-to-reservations': async () => {
      if (!state.user) {
        openLoginModal();
        return;
      }
      state.view = 'reservations';
      if (typeof setView === 'function') {
        await setView('reservations');
      } else {
        safeRender();
      }
    },
    'edit-pre-sale': async (target) => {
      const preSale = state.admin.preSales?.items?.find((item) => item.id === target.dataset.id);
      if (preSale) {
        state.admin.editingPreSale = preSale;
      }
      safeRender();
    },
    'cancel-edit-pre-sale': async () => {
      state.admin.editingPreSale = null;
      safeRender();
    },
    'delete-pre-sale': async (target) => {
      if (!confirm('确定要删除这个预售活动吗？删除后无法恢复。')) {
        return;
      }
      await api.admin.deletePreSale(target.dataset.id);
      showToast('预售活动已删除', 'success');
      if (typeof loadAdmin === 'function') await loadAdmin();
      if (typeof loadPreSales === 'function') await loadPreSales();
      safeRender();
    },
    'arrive-pre-sale': async (target) => {
      if (!confirm('确定标记该书已到货吗？标记后将向所有预约用户发送到货通知。')) {
        return;
      }
      await api.admin.markPreSaleArrived(target.dataset.id);
      showToast('已标记到货，通知已发送', 'success');
      if (typeof loadAdmin === 'function') await loadAdmin();
      if (typeof loadPreSales === 'function') await loadPreSales();
      safeRender();
    },
    'view-pre-sale': async (target) => {
      const preSaleId = target.dataset.id;
      const preSale = state.admin.preSales?.items?.find(item => item.id === preSaleId);
      if (!preSale) return;
      
      const book = preSale.book || {};
      openModal(`
        <div class="space-y-4">
          <h3 class="text-lg font-semibold">预售详情</h3>
          <div class="flex gap-4">
            <img src="${book.coverUrl || '/covers/cover-1.svg'}" alt="${book.title || ''}" class="w-20 h-28 rounded-lg object-contain bg-white" />
            <div class="flex-1">
              <p class="font-semibold">${book.title || ''}</p>
              <p class="text-sm text-slate-500">${book.author || ''}</p>
              <p class="text-orange-500 font-semibold">${formatCurrencyLocal(book.price || 0)}</p>
            </div>
          </div>
          <div class="space-y-2 text-sm">
            <p><span class="text-slate-400">状态：</span>${preSale.status === 'UPCOMING' ? '即将开售' : preSale.status === 'ONGOING' ? '预售中' : preSale.status === 'ARRIVED' ? '已到货' : '已结束'}</p>
            <p><span class="text-slate-400">预计到货：</span>${preSale.expectedArrivalDate ? new Date(preSale.expectedArrivalDate).toLocaleDateString() : '-'}</p>
            <p><span class="text-slate-400">预售库存：</span>${preSale.preSaleStock || 0} 本</p>
            <p><span class="text-slate-400">已预约：</span>${preSale.reservationCount || 0} 人</p>
            ${preSale.arrivedAt ? `<p><span class="text-slate-400">实际到货：</span>${new Date(preSale.arrivedAt).toLocaleString()}</p>` : ''}
          </div>
        </div>
      `);
    },
    'read-notification': async (target) => {
      const notificationId = target.dataset.id;
      try {
        await api.markNotificationRead(notificationId);
        const notification = state.notifications.items?.find(n => n.id === notificationId);
        if (notification && !notification.read) {
          notification.read = true;
          state.notifications.unreadCount = Math.max(0, (state.notifications.unreadCount || 0) - 1);
        }
        if (typeof updateNotificationBadge === 'function') updateNotificationBadge();
        safeRender();
      } catch (e) {
        // ignore
      }
    },
    'read-all-notifications': async () => {
      try {
        await api.markAllNotificationsRead();
        if (state.notifications.items) {
          state.notifications.items.forEach(n => n.read = true);
        }
        state.notifications.unreadCount = 0;
        if (typeof updateNotificationBadge === 'function') updateNotificationBadge();
        showToast('已全部标记为已读', 'success');
        safeRender();
      } catch (e) {
        showToast(e.message || '操作失败', 'error');
      }
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
    },
    'view-book-detail': async (target) => {
      const bookId = target.dataset.id;
      await loadBookDetail(bookId);
      state.view = 'book-detail';
      safeRender();
    },
    'back-to-books': async () => {
      state.currentBook = null;
      state.bookQuestions = { items: [], total: 0, page: 1, pageSize: 10, totalPages: 0, sort: 'time', loading: false };
      state.bookReviews = { items: [], total: 0, page: 1, pageSize: 10, totalPages: 0, sort: 'latest', loading: false };
      state.view = 'books';
      await loadBooks(state.bookSearch);
      safeRender();
    },
    'like-answer': async (target) => {
      if (!state.user) {
        openLoginModal();
        return;
      }
      const answerId = target.dataset.id;
      const result = await api.likeAnswer(answerId);
      await reloadBookQuestions();
      safeRender();
      showToast(result.liked ? '点赞成功' : '已取消点赞', 'success');
    },
    'qna-sort': async (target) => {
      const sort = target.dataset.sort;
      state.bookQuestions.sort = sort;
      state.bookQuestions.page = 1;
      await reloadBookQuestions();
      safeRender();
    },
    'qna-prev-page': async () => {
      if (state.bookQuestions.page <= 1) return;
      state.bookQuestions.page--;
      await reloadBookQuestions();
      safeRender();
    },
    'qna-next-page': async () => {
      const pageSize = state.bookQuestions.pageSize || 10;
      const maxPage = Math.ceil((state.bookQuestions.total || 0) / pageSize);
      if (state.bookQuestions.page >= maxPage) return;
      state.bookQuestions.page++;
      await reloadBookQuestions();
      safeRender();
    },
    'like-review': async (target) => {
      if (!state.user) {
        openLoginModal();
        return;
      }
      const orderId = target.dataset.id;
      const result = await api.likeReview(orderId);
      await loadBookReviews();
      safeRender();
      showToast(result.liked ? '点赞成功' : '已取消点赞', 'success');
    },
    'review-sort': async (target) => {
      const sort = target.dataset.sort;
      state.bookReviews.sort = sort;
      state.bookReviews.page = 1;
      await loadBookReviews();
      safeRender();
    },
    'review-prev-page': async () => {
      if (state.bookReviews.page <= 1) return;
      state.bookReviews.page--;
      await loadBookReviews();
      safeRender();
    },
    'review-next-page': async () => {
      const pageSize = state.bookReviews.pageSize || 10;
      const maxPage = Math.ceil((state.bookReviews.total || 0) / pageSize);
      if (state.bookReviews.page >= maxPage) return;
      state.bookReviews.page++;
      await loadBookReviews();
      safeRender();
    },
    'open-gallery': async (target) => {
      const imageUrls = JSON.parse(target.dataset.images || '[]');
      const startIndex = parseInt(target.dataset.index || '0', 10);
      if (!imageUrls.length) return;

      let currentIndex = startIndex;

      function renderGallery() {
        const url = imageUrls[currentIndex];
        modal.innerHTML = `
          <div class="card w-full max-w-2xl p-4 relative">
            <button class="absolute right-4 top-4 text-slate-400 hover:text-slate-700 z-10 text-xl" data-action="close-modal">✕</button>
            <div class="flex items-center justify-center mb-3" style="min-height:400px;">
              <img src="${url}" alt="评价图片" class="max-h-[70vh] max-w-full object-contain rounded-lg" />
            </div>
            <div class="flex items-center justify-between">
              <button class="btn-outline" data-action="gallery-prev" ${currentIndex <= 0 ? 'disabled' : ''}>← 上一张</button>
              <span class="text-sm text-slate-500">${currentIndex + 1} / ${imageUrls.length}</span>
              <button class="btn-outline" data-action="gallery-next" ${currentIndex >= imageUrls.length - 1 ? 'disabled' : ''}>下一张 →</button>
            </div>
          </div>
        `;
      }

      function onKeydown(e) {
        if (e.key === 'ArrowLeft') {
          if (currentIndex > 0) { currentIndex--; renderGallery(); }
        } else if (e.key === 'ArrowRight') {
          if (currentIndex < imageUrls.length - 1) { currentIndex++; renderGallery(); }
        } else if (e.key === 'Escape') {
          cleanup();
          closeModal();
        }
      }

      function cleanup() {
        document.removeEventListener('keydown', onKeydown);
        modal.removeEventListener('click', galleryClickHandler);
      }

      function galleryClickHandler(event) {
        if (event.target === modal) {
          cleanup();
          closeModal();
          return;
        }
        const action = event.target?.dataset?.action;
        if (action === 'gallery-prev' && currentIndex > 0) {
          currentIndex--;
          renderGallery();
        } else if (action === 'gallery-next' && currentIndex < imageUrls.length - 1) {
          currentIndex++;
          renderGallery();
        } else if (action === 'close-modal') {
          cleanup();
          closeModal();
        }
      }

      renderGallery();
      modal.classList.remove('hidden');
      modal.classList.add('flex');
      document.addEventListener('keydown', onKeydown);
      modal.addEventListener('click', galleryClickHandler);
    },
    'admin-qna-tab': async (target) => {
      state.admin.qnaTab = target.dataset.tab;
      safeRender();
    },
    'admin-delete-question': async (target) => {
      if (!confirm('确定要删除这个问题吗？删除后无法恢复。')) {
        return;
      }
      await api.admin.deleteQuestion(target.dataset.id);
      showToast('问题已删除', 'success');
      await loadAdmin();
      safeRender();
    },
    'admin-delete-answer': async (target) => {
      if (!confirm('确定要删除这个回答吗？删除后无法恢复。')) {
        return;
      }
      await api.admin.deleteAnswer(target.dataset.id);
      showToast('回答已删除', 'success');
      await loadAdmin();
      safeRender();
    },
    'edit-shipping-rule': async (target) => {
      const rule = state.admin.shippingRules.find(r => r.id === target.dataset.id);
      state.admin.editingShippingRule = rule || null;
      safeRender();
    },
    'cancel-edit-shipping-rule': async () => {
      state.admin.editingShippingRule = null;
      safeRender();
    },
    'deactivate-shipping-rule': async (target) => {
      await api.admin.updateShippingRule(target.dataset.id, { isActive: false });
      showToast('运费规则已禁用', 'success');
      if (typeof loadAdmin === 'function') await loadAdmin();
      safeRender();
    },
    'activate-shipping-rule': async (target) => {
      await api.admin.updateShippingRule(target.dataset.id, { isActive: true });
      showToast('运费规则已启用', 'success');
      if (typeof loadAdmin === 'function') await loadAdmin();
      safeRender();
    },
    'delete-shipping-rule': async (target) => {
      if (!confirm('确定要删除这条运费规则吗？删除后无法恢复。')) {
        return;
      }
      await api.admin.deleteShippingRule(target.dataset.id);
      showToast('运费规则已删除', 'success');
      if (typeof loadAdmin === 'function') await loadAdmin();
      safeRender();
    },
    'toggle-cart-item': async (target) => {
      safeRender();
      if (typeof loadShippingCalculation === 'function') {
        loadShippingCalculation();
      }
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

  if (comparisonBar) {
    comparisonBar.addEventListener('click', async (event) => {
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
  }

  const contentChangeHandlers = {
    'update-qty': async (target) => {
      await api.updateCart(target.dataset.id, { quantity: Number(target.value) });
      await loadCart();
      if (typeof loadShippingCalculation === 'function') await loadShippingCalculation();
      safeRender();
    },
    'toggle-comparison': async (target) => {
      const handler = contentActionHandlers['toggle-comparison'];
      if (handler) {
        await handler(target);
      }
    },
    'change-tag-logic': async (target) => {
      state.bookSearch.tagLogic = target.value;
      await loadBooks(state.bookSearch);
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
