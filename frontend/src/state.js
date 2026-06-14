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
    maxPrice: ''
  },
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
    orders: [],
    stats: null,
    editingBook: null,
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
    qnaTab: 'questions'
  },
  profile: {
    editingAddress: null
  }
};

export function normalizeBookSearch(params = {}) {
  return {
    title: String(params.title || '').trim(),
    author: String(params.author || '').trim(),
    isbn: String(params.isbn || '').trim(),
    categoryId: String(params.categoryId || '').trim(),
    sort: String(params.sort || '').trim(),
    minPrice: String(params.minPrice || '').trim(),
    maxPrice: String(params.maxPrice || '').trim()
  };
}

export function escapeHtmlAttr(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
