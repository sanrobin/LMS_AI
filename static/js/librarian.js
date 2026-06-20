/**
 * ═══════════════════════════════════════════════════════════════
 *  Librarian Dashboard Controller
 *  Book CRUD, map management, and circulation tracking.
 * ═══════════════════════════════════════════════════════════════
 */

const LibrarianDashboard = {
  user: null,
  books: [],
  circulation: [],
  currentTab: 'books',
  editingBookId: null,

  /**
   * Initialize the librarian dashboard.
   */
  async init() {
    // Auth + role check
    this.user = await App.requireAuth('librarian');
    if (!this.user) return;

    // Update navbar
    this.updateNavbar();

    // Bind tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => this.switchTab(btn.dataset.tab));
    });

    // Load initial data
    await this.loadBooks();
    await this.loadCirculation();

    // Bind book form
    const bookForm = document.getElementById('book-form');
    if (bookForm) bookForm.addEventListener('submit', (e) => this.handleBookSubmit(e));

    // Bind location form
    const locForm = document.getElementById('location-form');
    if (locForm) locForm.addEventListener('submit', (e) => this.handleLocationSubmit(e));

    // Bind search
    const searchInput = document.getElementById('lib-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', App.debounce((e) => {
        this.loadBooks(e.target.value);
      }, 300));
    }
  },

  /**
   * Update navbar with user info.
   */
  updateNavbar() {
    const userBadge = document.getElementById('user-badge');
    if (userBadge && this.user) {
      userBadge.textContent = `🔑 ${this.user.username}`;
    }
  },

  // ── Tab Management ──────────────────────────────────────────

  switchTab(tabName) {
    this.currentTab = tabName;

    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabName);
    });

    // Update tab panels
    document.querySelectorAll('.tab-panel').forEach(panel => {
      panel.classList.toggle('active', panel.id === `tab-${tabName}`);
    });
  },

  // ── Books Management ────────────────────────────────────────

  async loadBooks(query = '') {
    try {
      const url = query ? `/api/books?q=${encodeURIComponent(query)}&limit=100` : '/api/books?limit=100';
      this.books = await App.api(url);
      this.renderBookTable();
      this.updateStats();
      this.populateBookSelect();
    } catch (err) {
      console.error('Failed to load books:', err);
    }
  },

  renderBookTable() {
    const tbody = document.getElementById('books-tbody');
    if (!tbody) return;

    if (!this.books || this.books.length === 0) {
      tbody.innerHTML = `
        <tr><td colspan="6" style="text-align: center; padding: 2rem; color: var(--text-muted);">
          No books found
        </td></tr>
      `;
      return;
    }

    tbody.innerHTML = this.books.map(book => `
      <tr>
        <td style="font-weight: 600; color: var(--text-primary);">${this.escapeHtml(book.title)}</td>
        <td>${this.escapeHtml(book.author)}</td>
        <td><code style="font-size: 0.8rem; color: var(--text-muted);">${book.isbn || '—'}</code></td>
        <td>${App.statusBadge(book.status)}</td>
        <td>${book.borrowed_date ? App.formatDate(book.borrowed_date) : '—'}</td>
        <td>
          <div style="display: flex; gap: 0.3rem;">
            <button class="btn btn-secondary btn-sm" onclick="LibrarianDashboard.editBook(${book.id})" title="Edit">
              ✏️
            </button>
            <button class="btn btn-danger btn-sm" onclick="LibrarianDashboard.deleteBook(${book.id})" title="Delete">
              🗑️
            </button>
          </div>
        </td>
      </tr>
    `).join('');
  },

  /**
   * Open the book modal for adding or editing.
   */
  openBookModal(book = null) {
    this.editingBookId = book ? book.id : null;

    const modal = document.getElementById('book-modal');
    const title = document.getElementById('modal-title');
    const titleInput = document.getElementById('book-title');
    const authorInput = document.getElementById('book-author');
    const isbnInput = document.getElementById('book-isbn');
    const submitBtn = document.getElementById('book-submit-btn');

    if (book) {
      title.textContent = 'Edit Book';
      titleInput.value = book.title;
      authorInput.value = book.author;
      isbnInput.value = book.isbn || '';
      submitBtn.textContent = 'Update Book';
    } else {
      title.textContent = 'Add New Book';
      titleInput.value = '';
      authorInput.value = '';
      isbnInput.value = '';
      submitBtn.textContent = 'Add Book';
    }

    if (modal) modal.classList.add('active');
  },

  closeBookModal() {
    const modal = document.getElementById('book-modal');
    if (modal) modal.classList.remove('active');
    this.editingBookId = null;
  },

  async handleBookSubmit(e) {
    e.preventDefault();

    const data = {
      title: document.getElementById('book-title').value.trim(),
      author: document.getElementById('book-author').value.trim(),
      isbn: document.getElementById('book-isbn').value.trim() || null,
    };

    try {
      if (this.editingBookId) {
        await App.api(`/api/books/${this.editingBookId}`, {
          method: 'PUT',
          body: JSON.stringify(data),
        });
        App.toast('Book updated successfully!', 'success');
      } else {
        await App.api('/api/books', {
          method: 'POST',
          body: JSON.stringify(data),
        });
        App.toast('Book added successfully!', 'success');
      }

      this.closeBookModal();
      await this.loadBooks();
    } catch (err) {
      // Error toast handled by App.api
    }
  },

  async editBook(bookId) {
    try {
      const book = await App.api(`/api/books/${bookId}`);
      if (book) this.openBookModal(book);
    } catch (err) {
      console.error('Failed to load book for edit:', err);
    }
  },

  async deleteBook(bookId) {
    if (!confirm('Are you sure you want to delete this book?')) return;

    try {
      await App.api(`/api/books/${bookId}`, { method: 'DELETE' });
      App.toast('Book deleted.', 'success');
      await this.loadBooks();
    } catch (err) {
      // Error toast handled by App.api
    }
  },

  // ── Location Management ─────────────────────────────────────

  /**
   * Populate the book dropdown in the location form.
   */
  populateBookSelect() {
    const select = document.getElementById('loc-book-select');
    if (!select) return;

    select.innerHTML = '<option value="">Select a book...</option>' +
      this.books.map(b => `<option value="${b.id}">${b.title} (ID: ${b.id})</option>`).join('');
  },

  /**
   * Load existing location for selected book.
   */
  async onBookSelectChange() {
    const bookId = document.getElementById('loc-book-select').value;
    if (!bookId) return;

    try {
      const loc = await App.api(`/api/locations/${bookId}`);
      if (loc) {
        document.getElementById('loc-x').value = loc.x_coord;
        document.getElementById('loc-y').value = loc.y_coord;
        document.getElementById('loc-shelf').value = loc.shelf_name;
      }
    } catch {
      // No existing location — clear fields
      document.getElementById('loc-x').value = '';
      document.getElementById('loc-y').value = '';
      document.getElementById('loc-shelf').value = '';
    }
  },

  async handleLocationSubmit(e) {
    e.preventDefault();

    const bookId = document.getElementById('loc-book-select').value;
    if (!bookId) {
      App.toast('Please select a book first.', 'error');
      return;
    }

    const data = {
      x_coord: parseFloat(document.getElementById('loc-x').value),
      y_coord: parseFloat(document.getElementById('loc-y').value),
      shelf_name: document.getElementById('loc-shelf').value.trim(),
    };

    if (isNaN(data.x_coord) || isNaN(data.y_coord) || !data.shelf_name) {
      App.toast('Please fill in all location fields.', 'error');
      return;
    }

    try {
      await App.api(`/api/locations/${bookId}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
      App.toast('Location updated successfully!', 'success');

      // Reset form
      document.getElementById('location-form').reset();
    } catch (err) {
      // Error toast handled by App.api
    }
  },

  // ── Circulation ─────────────────────────────────────────────

  async loadCirculation(sortBy = 'duration', sortOrder = 'desc') {
    try {
      this.circulation = await App.api(
        `/api/circulation?sort_by=${sortBy}&sort_order=${sortOrder}`
      );
      this.renderCirculationTable();
    } catch (err) {
      console.error('Failed to load circulation:', err);
    }
  },

  renderCirculationTable() {
    const tbody = document.getElementById('circ-tbody');
    if (!tbody) return;

    if (!this.circulation || this.circulation.length === 0) {
      tbody.innerHTML = `
        <tr><td colspan="7" style="text-align: center; padding: 2rem; color: var(--text-muted);">
          No circulation records found
        </td></tr>
      `;
      return;
    }

    tbody.innerHTML = this.circulation.map(rec => {
      const rowClass = rec.is_overdue ? 'row-overdue' : '';
      const durationClass = App.getDurationClass(rec.duration_days || 0);
      const statusBadge = rec.return_date
        ? '<span class="badge badge-available">Returned</span>'
        : (rec.is_overdue
          ? '<span class="badge badge-overdue">⚠ Overdue</span>'
          : '<span class="badge badge-borrowed">Active</span>');

      return `
        <tr class="${rowClass}">
          <td style="font-weight: 600; color: var(--text-primary);">${this.escapeHtml(rec.book_title)}</td>
          <td>${this.escapeHtml(rec.username)}</td>
          <td>${App.formatDate(rec.borrow_date)}</td>
          <td>${rec.return_date ? App.formatDate(rec.return_date) : '—'}</td>
          <td><span class="${durationClass}" style="font-weight: 600;">${rec.duration_days} days</span></td>
          <td>${statusBadge}</td>
        </tr>
      `;
    }).join('');
  },

  sortCirculation(sortBy) {
    // Toggle sort order
    this._lastSortOrder = this._lastSortOrder === 'desc' ? 'asc' : 'desc';
    this.loadCirculation(sortBy, this._lastSortOrder);
  },

  // ── Stats ───────────────────────────────────────────────────

  updateStats() {
    const totalEl = document.getElementById('stat-total-books');
    const availEl = document.getElementById('stat-available-books');
    const borrowedEl = document.getElementById('stat-borrowed-books');
    const overdueEl = document.getElementById('stat-overdue');

    const total = this.books?.length || 0;
    const available = this.books?.filter(b => b.status === 'available').length || 0;
    const borrowed = total - available;
    const overdue = this.circulation?.filter(r => r.is_overdue).length || 0;

    if (totalEl) totalEl.textContent = total;
    if (availEl) availEl.textContent = available;
    if (borrowedEl) borrowedEl.textContent = borrowed;
    if (overdueEl) overdueEl.textContent = overdue;
  },

  // ── Utility ─────────────────────────────────────────────────

  escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  },
};

// Boot on DOM ready
document.addEventListener('DOMContentLoaded', () => LibrarianDashboard.init());
