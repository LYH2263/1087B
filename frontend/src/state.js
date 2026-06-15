const COMPARISON_STORAGE_KEY = 'book_comparison_items';
const MAX_COMPARISON_ITEMS = 4;

export const state = {
  user: null,
  view: 'books',
  books: [],
  categories: [],
  bookSearch: {
    title: '',
    author: '',
    isbn: '',
    categoryId: '',
    sort: '',
    minPrice: '',
    maxPrice: '',
    tagIds: [],
    tagLogic: 'OR'
  },
  tagCloud: [],
  currentBook: null,
  bookQuestions: {
    items: [],
    total: 0,
    page: 1,
    pageSize: 10,
    totalPages: 0,
    sort: 'time',
    loading: false
  },
  cart: [],
  orders: [],
  invoices: [],
  addresses: [],
  bookLists: [],
  currentBookList: null,
  flashSales: {
    items: [],
    serverTime: null,
    clientTimeOffset: 0,
    loading: false,
    purchaseLoading: {}
  },
  comparison: {
    items: []
  },
  preSales: {
    items: [],
    loading: false
  },
  reservations: {
    items: [],
    loading: false
  },
  notifications: {
    items: [],
    unreadCount: 0,
    loading: false
  },
  shipping: {
    calculation: null,
    recommendations: [],
    loading: false
  },
  loading: {
    books: false,
    cart: false,
    orders: false,
    invoices: false,
    addresses: false,
    admin: false,
    flashSales: false,
    bookLists: false,
    bookListDetail: false,
    bookDetail: false
  },
  admin: {
    tab: 'books',
    books: [],
    categories: [],
    tags: [],
    orders: [],
    stats: null,
    editingBook: null,
    editingBookTags: [],
    editingTag: null,
    flashSales: [],
    editingFlashSale: null,
    invoices: [],
    invoiceStats: null,
    bookLists: [],
    editingBookList: null,
    selectedBookList: null,
    questions: [],
    answers: [],
    qnaStats: null,
    qnaTab: 'questions',
    preSales: [],
    editingPreSale: null,
    preSaleTab: 'list',
    shippingRules: [],
    editingShippingRule: null
  },
  profile: {
    editingAddress: null
  }
};

export function initComparison() {
  try {
    const stored = localStorage.getItem(COMPARISON_STORAGE_KEY);
    if (stored) {
      state.comparison.items = JSON.parse(stored);
    }
  } catch (e) {
    state.comparison.items = [];
  }
}

export function saveComparison() {
  try {
    localStorage.setItem(COMPARISON_STORAGE_KEY, JSON.stringify(state.comparison.items));
  } catch (e) {
    // ignore
  }
}

export function addToComparison(bookId) {
  if (state.comparison.items.includes(bookId)) {
    return { success: false, reason: 'duplicate' };
  }
  if (state.comparison.items.length >= MAX_COMPARISON_ITEMS) {
    return { success: false, reason: 'limit' };
  }
  state.comparison.items.push(bookId);
  saveComparison();
  return { success: true };
}

export function removeFromComparison(bookId) {
  const index = state.comparison.items.indexOf(bookId);
  if (index > -1) {
    state.comparison.items.splice(index, 1);
    saveComparison();
    return true;
  }
  return false;
}

export function clearComparison() {
  state.comparison.items = [];
  saveComparison();
}

export function isInComparison(bookId) {
  return state.comparison.items.includes(bookId);
}

export function getComparisonCount() {
  return state.comparison.items.length;
}

export function getMaxComparisonItems() {
  return MAX_COMPARISON_ITEMS;
}

export function getComparisonBooks() {
  return state.books.filter(book => state.comparison.items.includes(book.id));
}

export function normalizeBookSearch(params = {}) {
  let tagIds = [];
  if (params.tagIds) {
    if (Array.isArray(params.tagIds)) {
      tagIds = params.tagIds.map(String);
    } else if (typeof params.tagIds === 'string') {
      tagIds = params.tagIds.split(',').filter(Boolean);
    }
  }
  
  return {
    title: String(params.title || '').trim(),
    author: String(params.author || '').trim(),
    isbn: String(params.isbn || '').trim(),
    categoryId: String(params.categoryId || '').trim(),
    sort: String(params.sort || '').trim(),
    minPrice: String(params.minPrice || '').trim(),
    maxPrice: String(params.maxPrice || '').trim(),
    tagIds,
    tagLogic: params.tagLogic === 'AND' ? 'AND' : 'OR'
  };
}

export function escapeHtmlAttr(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
