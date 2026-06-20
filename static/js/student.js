/**
 * ═══════════════════════════════════════════════════════════════
 *  Student Dashboard Controller
 *  Search, book grid, map interaction, and borrowing.
 * ═══════════════════════════════════════════════════════════════
 */

const StudentDashboard = {
  user: null,
  books: [],
  myBooks: [],

  /**
   * Initialize the student dashboard.
   */
  async init() {
    // Auth check
    this.user = await App.requireAuth();
    if (!this.user) return;

    // If librarian, redirect to librarian dashboard
    if (this.user.role === 'librarian') {
      window.location.href = '/librarian';
      return;
    }

    // Update navbar
    this.updateNavbar();

    // Initialize map
    LibraryMap.init();
    await LibraryMap.loadLocations();

    // Load data
    await this.loadBooks();
    await this.loadMyBooks();

    // Bind search
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
      searchInput.addEventListener('input', App.debounce((e) => {
        this.searchBooks(e.target.value);
      }, 300));
    }

    // Initialize chat
    Chat.init();
  },

  /**
   * Update navbar with user info.
   */
  updateNavbar() {
    const userBadge = document.getElementById('user-badge');
    if (userBadge && this.user) {
      userBadge.textContent = `📚 ${this.user.username}`;
    }
  },

  /**
   * Load all books from API.
   */
  async loadBooks(query = '') {
    try {
      const url = query ? `/api/books?q=${encodeURIComponent(query)}` : '/api/books';
      this.books = await App.api(url);
      this.renderBookGrid(this.books);
      this.updateStats();
    } catch (err) {
      console.error('Failed to load books:', err);
    }
  },

  /**
   * Search books by query.
   */
  async searchBooks(query) {
    await this.loadBooks(query);
  },

  /**
   * Load the student's borrowed books.
   */
  async loadMyBooks() {
    try {
      this.myBooks = await App.api('/api/my-books');
      this.renderMyBooks();
      this.updateStats();
    } catch (err) {
      console.error('Failed to load my books:', err);
    }
  },

  /**
   * Render the book grid.
   */
  renderBookGrid(books) {
    const grid = document.getElementById('book-grid');
    if (!grid) return;

    if (!books || books.length === 0) {
      grid.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1;">
          <div class="icon">📚</div>
          <p>No books found. Try a different search term.</p>
        </div>
      `;
      return;
    }

    grid.innerHTML = books.map(book => `
      <div class="glass-card book-card" data-book-id="${book.id}" onclick="StudentDashboard.selectBook(${book.id})">
        <div class="book-title">${this.escapeHtml(book.title)}</div>
        <div class="book-author" style="margin-bottom: 2px;">by ${this.escapeHtml(book.author)}</div>
        <div style="font-size: 0.8rem; color: var(--accent-blue); margin-bottom: 8px; font-weight: 500;">
          ${this.escapeHtml(book.genre || 'Uncategorized')}
        </div>
        <div class="book-meta">
          ${App.statusBadge(book.status)}
          ${book.isbn ? `<span class="book-isbn">${book.isbn}</span>` : ''}
        </div>
        ${book.status === 'available' ? `
          <button class="btn btn-primary btn-sm" style="width: 100%; margin-top: 0.75rem;"
            onclick="event.stopPropagation(); StudentDashboard.borrowBook(${book.id})">
            📖 Borrow
          </button>
        ` : ''}
      </div>
    `).join('');
  },

  /**
   * Render the "My Books" section.
   */
  renderMyBooks() {
    const container = document.getElementById('my-books-list');
    if (!container) return;

    if (!this.myBooks || this.myBooks.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <p>You haven't borrowed any books yet.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = this.myBooks.map(book => `
      <div class="glass-card" style="display: flex; align-items: center; justify-content: space-between; padding: 1rem; margin-bottom: 0.5rem;">
        <div>
          <div style="font-weight: 600; font-size: 0.9rem;">${this.escapeHtml(book.title)}</div>
          <div style="font-size: 0.8rem; color: var(--text-muted);">
            Held for <span class="${App.getDurationClass(book.days_held)}">${book.days_held} days</span>
          </div>
        </div>
        <button class="btn btn-secondary btn-sm" onclick="StudentDashboard.returnBook(${book.book_id})">
          ↩ Return
        </button>
      </div>
    `).join('');
  },

  /**
   * Select a book to highlight on the map.
   */
  async selectBook(bookId) {
    try {
      const book = await App.api(`/api/books/${bookId}`);
      if (book) {
        if (book.genre) {
          LibraryMap.highlightGenre(book.genre, book.title, book.author, book.shelf_name);
        } else {
          App.toast('This book does not have an assigned genre location.', 'info');
        }

        // Scroll to map
        const mapEl = document.getElementById('library-map');
        if (mapEl) mapEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    } catch (err) {
      console.error('Failed to select book:', err);
    }
  },

  /**
   * Borrow a book.
   */
  async borrowBook(bookId) {
    try {
      const result = await App.api(`/api/borrow/${bookId}`, { method: 'POST' });
      if (result) {
        App.toast(result.message, 'success');
        await this.loadBooks();
        await this.loadMyBooks();
      }
    } catch (err) {
      // Error toast already shown by App.api
    }
  },

  /**
   * Return a borrowed book.
   */
  async returnBook(bookId) {
    try {
      const result = await App.api(`/api/return/${bookId}`, { method: 'POST' });
      if (result) {
        App.toast(result.message, 'success');
        await this.loadBooks();
        await this.loadMyBooks();
      }
    } catch (err) {
      // Error toast already shown by App.api
    }
  },

  /**
   * Update dashboard statistics.
   */
  updateStats() {
    const totalEl = document.getElementById('stat-total');
    const availableEl = document.getElementById('stat-available');
    const borrowedEl = document.getElementById('stat-my-borrowed');

    if (totalEl) totalEl.textContent = this.books.length;
    if (availableEl) {
      availableEl.textContent = this.books.filter(b => b.status === 'available').length;
    }
    if (borrowedEl) borrowedEl.textContent = this.myBooks?.length || 0;
  },

  /**
   * Escape HTML to prevent XSS in rendered content.
   */
  escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  },
};

// Boot on DOM ready
document.addEventListener('DOMContentLoaded', () => StudentDashboard.init());
