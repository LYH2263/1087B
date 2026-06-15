const API_BASE = '/api';

let accessToken = null;
let refreshing = null;

function getStoredToken() {
  return localStorage.getItem('access_token') || sessionStorage.getItem('access_token');
}

function setStoredToken(token, remember) {
  localStorage.removeItem('access_token');
  sessionStorage.removeItem('access_token');
  if (!token) {
    return;
  }
  if (remember) {
    localStorage.setItem('access_token', token);
  } else {
    sessionStorage.setItem('access_token', token);
  }
}

function setAccessToken(token) {
  accessToken = token;
}

function getAccessToken() {
  if (!accessToken) {
    accessToken = getStoredToken();
  }
  return accessToken;
}

async function request(path, options = {}, retry = true) {
  const headers = options.headers || {};
  const token = getAccessToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    credentials: 'include'
  });

  if (response.status === 204) {
    return null;
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    if (response.status === 401 && retry) {
      await refresh();
      return request(path, options, false);
    }
    const message = data.message || data.error || '请求失败';
    const error = new Error(message);
    error.payload = data;
    throw error;
  }

  return data;
}

async function refresh() {
  if (refreshing) {
    return refreshing;
  }

  refreshing = request('/auth/refresh', { method: 'POST' }, false)
    .then((data) => {
      setAccessToken(data.accessToken);
      setStoredToken(data.accessToken, true);
      refreshing = null;
      return data;
    })
    .catch((error) => {
      setAccessToken(null);
      setStoredToken(null, false);
      refreshing = null;
      throw error;
    });

  return refreshing;
}

export const api = {
  initToken() {
    const stored = getStoredToken();
    if (stored) {
      setAccessToken(stored);
    }
    return stored;
  },
  setToken(token, remember) {
    setAccessToken(token);
    setStoredToken(token, remember);
  },
  clearToken() {
    setAccessToken(null);
    setStoredToken(null, false);
  },
  request,
  login(payload) {
    return request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  },
  register(payload) {
    return request('/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  },
  logout() {
    return request('/auth/logout', { method: 'POST' });
  },
  forgotPassword(payload) {
    return request('/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  },
  resetPassword(payload) {
    return request('/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  },
  getMe() {
    return request('/auth/me');
  },
  getBooks(params = {}) {
    const queryParams = { ...params };
    if (queryParams.tagIds && Array.isArray(queryParams.tagIds)) {
      queryParams.tagIds = queryParams.tagIds.join(',');
    }
    const query = new URLSearchParams(queryParams).toString();
    return request(`/books${query ? `?${query}` : ''}`);
  },
  getCategories() {
    return request('/books/categories');
  },
  getTagCloud() {
    return request('/books/tags/cloud');
  },
  getCart() {
    return request('/cart');
  },
  addToCart(payload) {
    return request('/cart', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  },
  updateCart(itemId, payload) {
    return request(`/cart/${itemId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  },
  removeCart(itemId) {
    return request(`/cart/${itemId}`, { method: 'DELETE' });
  },
  clearCart() {
    return request('/cart', { method: 'DELETE' });
  },
  getOrders() {
    return request('/orders');
  },
  checkout(payload) {
    return request('/orders/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  },
  payOrder(orderId) {
    return request(`/orders/${orderId}/pay`, { method: 'POST' });
  },
  cancelOrder(orderId) {
    return request(`/orders/${orderId}/cancel`, { method: 'POST' });
  },
  confirmOrder(orderId) {
    return request(`/orders/${orderId}/confirm`, { method: 'POST' });
  },
  reviewOrder(orderId, payload) {
    const formData = new FormData();
    formData.append('rating', payload.rating);
    formData.append('reviewText', payload.reviewText);
    if (payload.images) {
      for (const file of payload.images) {
        formData.append('images', file);
      }
    }
    return request(`/orders/${orderId}/review`, {
      method: 'POST',
      body: formData
    });
  },
  likeReview(orderId) {
    return request(`/orders/${orderId}/review-like`, {
      method: 'POST'
    });
  },
  getBookReviews(bookId, params = {}) {
    const query = new URLSearchParams(params).toString();
    return request(`/books/${bookId}/reviews${query ? `?${query}` : ''}`);
  },
  getAddresses() {
    return request('/addresses');
  },
  addAddress(payload) {
    return request('/addresses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  },
  updateAddress(id, payload) {
    return request(`/addresses/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  },
  setDefaultAddress(id) {
    return request(`/addresses/${id}/default`, { method: 'POST' });
  },
  deleteAddress(id) {
    return request(`/addresses/${id}`, { method: 'DELETE' });
  },
  parseAddress(text) {
    return request('/addresses/parse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });
  },
  getServerTime() {
    return request('/flash-sales/time');
  },
  getActiveFlashSales() {
    return request('/flash-sales/active');
  },
  getFlashSale(id) {
    return request(`/flash-sales/${id}`);
  },
  purchaseFlashSale(payload) {
    return request('/flash-sales/purchase', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  },
  getMyFlashSaleOrders() {
    return request('/flash-sales/orders/mine');
  },
  getInvoices() {
    return request('/invoices');
  },
  getInvoice(id) {
    return request(`/invoices/${id}`);
  },
  applyInvoice(payload) {
    return request('/invoices/apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  },
  getBookLists() {
    return request('/book-lists');
  },
  getBookList(id) {
    return request(`/book-lists/${id}`);
  },
  getBookQuestions(bookId, params = {}) {
    const query = new URLSearchParams(params).toString();
    return request(`/books/${bookId}/questions${query ? `?${query}` : ''}`);
  },
  createQuestion(bookId, payload) {
    return request(`/books/${bookId}/questions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  },
  createAnswer(questionId, payload) {
    return request(`/questions/${questionId}/answers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  },
  likeAnswer(answerId) {
    return request(`/answers/${answerId}/like`, {
      method: 'POST'
    });
  },
  getActivePreSales() {
    return request('/pre-sales/active');
  },
  getPreSale(id) {
    return request(`/pre-sales/${id}`);
  },
  getBookPreSale(bookId) {
    return request(`/pre-sales/book/${bookId}`);
  },
  reservePreSale(preSaleId) {
    return request('/pre-sales/reserve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ preSaleId })
    });
  },
  cancelReservation(reservationId) {
    return request(`/pre-sales/reservations/${reservationId}/cancel`, {
      method: 'POST'
    });
  },
  getMyReservations() {
    return request('/pre-sales/reservations/mine');
  },
  getNotifications(params = {}) {
    const query = new URLSearchParams(params).toString();
    return request(`/pre-sales/notifications${query ? `?${query}` : ''}`);
  },
  markNotificationRead(id) {
    return request(`/pre-sales/notifications/${id}/read`, {
      method: 'POST'
    });
  },
  markAllNotificationsRead() {
    return request('/pre-sales/notifications/read-all', {
      method: 'POST'
    });
  },
  calculateShipping(payload) {
    return request('/shipping/calculate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  },
  getShippingRecommendations(params = {}) {
    const query = new URLSearchParams(params).toString();
    return request(`/shipping/recommendations${query ? `?${query}` : ''}`);
  },
  admin: {
    getBooks(params = {}) {
      const query = new URLSearchParams(params).toString();
      return request(`/admin/books${query ? `?${query}` : ''}`);
    },
    getFlashSales(params = {}) {
      const query = new URLSearchParams(params).toString();
      return request(`/admin/flash-sales${query ? `?${query}` : ''}`);
    },
    getFlashSale(id) {
      return request(`/admin/flash-sales/${id}`);
    },
    createFlashSale(payload) {
      return request('/admin/flash-sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    },
    updateFlashSale(id, payload) {
      return request(`/admin/flash-sales/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    },
    deleteFlashSale(id) {
      return request(`/admin/flash-sales/${id}`, { method: 'DELETE' });
    },
    createBook(payload) {
      return request('/admin/books', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    },
    updateBook(id, payload) {
      return request(`/admin/books/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    },
    deactivateBook(id) {
      return request(`/admin/books/${id}`, { method: 'DELETE' });
    },
    restoreBook(id) {
      return request(`/admin/books/${id}/restore`, { method: 'POST' });
    },
    getCategories() {
      return request('/admin/categories');
    },
    createCategory(payload) {
      return request('/admin/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    },
    deleteCategory(id) {
      return request(`/admin/categories/${id}`, { method: 'DELETE' });
    },
    getOrders(params = {}) {
      const query = new URLSearchParams(params).toString();
      return request(`/admin/orders${query ? `?${query}` : ''}`);
    },
    getOrderStats() {
      return request('/admin/orders/stats');
    },
    acceptOrder(id) {
      return request(`/admin/orders/${id}/accept`, { method: 'POST' });
    },
    shipOrder(id) {
      return request(`/admin/orders/${id}/ship`, { method: 'POST' });
    },
    refundOrder(id) {
      return request(`/admin/orders/${id}/refund`, { method: 'POST' });
    },
    exportOrders() {
      return fetch(`${API_BASE}/admin/orders/export`, {
        method: 'GET',
        credentials: 'include',
        headers: getAccessToken() ? { Authorization: `Bearer ${getAccessToken()}` } : {}
      });
    },
    uploadCover(file) {
      const formData = new FormData();
      formData.append('file', file);
      return request('/admin/upload', {
        method: 'POST',
        body: formData
      });
    },
    getInvoices(params = {}) {
      const query = new URLSearchParams(params).toString();
      return request(`/admin/invoices${query ? `?${query}` : ''}`);
    },
    getInvoiceStats() {
      return request('/admin/invoices/stats');
    },
    getInvoice(id) {
      return request(`/admin/invoices/${id}`);
    },
    issueInvoice(id) {
      return request(`/admin/invoices/${id}/issue`, { method: 'POST' });
    },
    rejectInvoice(id, payload) {
      return request(`/admin/invoices/${id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    },
    getBookLists(params = {}) {
      const query = new URLSearchParams(params).toString();
      return request(`/admin/book-lists${query ? `?${query}` : ''}`);
    },
    getBookList(id) {
      return request(`/admin/book-lists/${id}`);
    },
    createBookList(payload) {
      return request('/admin/book-lists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    },
    updateBookList(id, payload) {
      return request(`/admin/book-lists/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    },
    deleteBookList(id) {
      return request(`/admin/book-lists/${id}`, { method: 'DELETE' });
    },
    publishBookList(id) {
      return request(`/admin/book-lists/${id}/publish`, { method: 'POST' });
    },
    unpublishBookList(id) {
      return request(`/admin/book-lists/${id}/unpublish`, { method: 'POST' });
    },
    addBookToList(bookListId, payload) {
      return request(`/admin/book-lists/${bookListId}/books`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    },
    removeBookFromList(bookListId, bookId) {
      return request(`/admin/book-lists/${bookListId}/books/${bookId}`, { method: 'DELETE' });
    },
    reorderBooksInList(bookListId, payload) {
      return request(`/admin/book-lists/${bookListId}/reorder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    },
    getQuestions(params = {}) {
      const query = new URLSearchParams(params).toString();
      return request(`/admin/questions${query ? `?${query}` : ''}`);
    },
    getAnswers(params = {}) {
      const query = new URLSearchParams(params).toString();
      return request(`/admin/answers${query ? `?${query}` : ''}`);
    },
    getQnaStats() {
      return request('/admin/qna/stats');
    },
    deleteQuestion(id) {
      return request(`/admin/questions/${id}`, { method: 'DELETE' });
    },
    deleteAnswer(id) {
      return request(`/admin/answers/${id}`, { method: 'DELETE' });
    },
    getTags() {
      return request('/admin/tags');
    },
    createTag(payload) {
      return request('/admin/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    },
    updateTag(id, payload) {
      return request(`/admin/tags/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    },
    deleteTag(id) {
      return request(`/admin/tags/${id}`, { method: 'DELETE' });
    },
    getBookTags(bookId) {
      return request(`/admin/books/${bookId}/tags`);
    },
    updateBookTags(bookId, tagIds) {
      return request(`/admin/books/${bookId}/tags`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tagIds })
      });
    },
    getPreSales(params = {}) {
      const query = new URLSearchParams(params).toString();
      return request(`/admin/pre-sales${query ? `?${query}` : ''}`);
    },
    getPreSale(id) {
      return request(`/admin/pre-sales/${id}`);
    },
    createPreSale(payload) {
      return request('/admin/pre-sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    },
    updatePreSale(id, payload) {
      return request(`/admin/pre-sales/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    },
    markPreSaleArrived(id) {
      return request(`/admin/pre-sales/${id}/arrive`, {
        method: 'POST'
      });
    },
    deletePreSale(id) {
      return request(`/admin/pre-sales/${id}`, { method: 'DELETE' });
    },
    getShippingRules() {
      return request('/admin/shipping-rules');
    },
    createShippingRule(payload) {
      return request('/admin/shipping-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    },
    updateShippingRule(id, payload) {
      return request(`/admin/shipping-rules/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    },
    deleteShippingRule(id) {
      return request(`/admin/shipping-rules/${id}`, { method: 'DELETE' });
    }
  }
};
