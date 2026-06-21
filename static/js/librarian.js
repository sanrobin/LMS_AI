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
  map: null,
  locationMarker: null, // Generic draft marker
  allLocations: [],
  locationMarkers: {},
  selectedGenre: null,

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

    // Initialize map
    this.initMap();
    await this.loadLocations();

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
      userBadge.innerHTML = `<span style="display:flex; align-items:center; gap:0.25rem;"><i data-lucide="key" width="16" height="16"></i> ${this.escapeHtml(this.user.username)}</span>`;
      if (window.lucide) lucide.createIcons({ root: userBadge });
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

    // Fix map rendering issue when container becomes visible
    if (tabName === 'locations' && this.map) {
      setTimeout(() => {
        this.map.invalidateSize();
      }, 10);
    }
  },

  // ── Books Management ────────────────────────────────────────

  async loadBooks(query = '') {
    try {
      const url = query ? `/api/books?q=${encodeURIComponent(query)}&limit=100` : '/api/books?limit=100';
      this.books = await App.api(url);
      this.renderBookTable();
      this.updateStats();
    } catch (err) {
      console.error('Failed to load books:', err);
    }
  },

  renderBookTable() {
    const tbody = document.getElementById('books-tbody');
    if (!tbody) return;

    if (!this.books || this.books.length === 0) {
      tbody.innerHTML = `
        <tr><td colspan="7" style="text-align: center; padding: 2rem; color: var(--text-muted);">
          No books found
        </td></tr>
      `;
      return;
    }

    tbody.innerHTML = this.books.map(book => `
      <tr>
        <td style="font-weight: 600; color: var(--text-primary);">${this.escapeHtml(book.title)}</td>
        <td>${this.escapeHtml(book.author)}</td>
        <td>${this.escapeHtml(book.genre || '—')}</td>
        <td><code style="font-size: 0.8rem; color: var(--text-muted);">${book.isbn || '—'}</code></td>
        <td>${App.statusBadge(book.status)}</td>
        <td>${book.borrowed_date ? App.formatDate(book.borrowed_date) : '—'}</td>
        <td>
          <div style="display: flex; gap: 0.3rem;">
            <button class="btn btn-secondary btn-sm" onclick="LibrarianDashboard.editBook(${book.id})" title="Edit">
              <i data-lucide="pencil" width="14" height="14"></i>
            </button>
            <button class="btn btn-danger btn-sm" onclick="LibrarianDashboard.deleteBook(${book.id})" title="Delete">
              <i data-lucide="trash-2" width="14" height="14"></i>
            </button>
          </div>
        </td>
      </tr>
    `).join('');
    
    if (window.lucide) lucide.createIcons({ root: tbody });
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
    const genreInput = document.getElementById('book-genre');
    const isbnInput = document.getElementById('book-isbn');
    const submitBtn = document.getElementById('book-submit-btn');

    if (book) {
      title.textContent = 'Edit Book';
      titleInput.value = book.title;
      authorInput.value = book.author;
      genreInput.value = book.genre || '';
      isbnInput.value = book.isbn || '';
      submitBtn.textContent = 'Update Book';
    } else {
      title.textContent = 'Add New Book';
      titleInput.value = '';
      authorInput.value = '';
      genreInput.value = '';
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
      genre: document.getElementById('book-genre').value.trim(),
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

  async loadLocations() {
    try {
      this.allLocations = await App.api('/api/locations');
      this.renderLocationsTable();
    } catch (err) {
      console.error('Failed to load locations', err);
    }
  },

  renderLocationsTable() {
    const tbody = document.getElementById('locations-tbody');
    if (!tbody) return;

    if (!this.allLocations || this.allLocations.length === 0) {
      tbody.innerHTML = `
        <tr><td colspan="4" style="text-align: center; padding: 2rem; color: var(--text-muted);">
          No locations mapped yet
        </td></tr>
      `;
      return;
    }

    tbody.innerHTML = this.allLocations.map(loc => `
      <tr>
        <td style="font-weight: 600; color: var(--text-primary);">${this.escapeHtml(loc.genre)}</td>
        <td>${this.escapeHtml(loc.shelf_name)}</td>
        <td><code style="font-size: 0.85rem; color: var(--text-muted);">X: ${loc.x_coord}, Y: ${loc.y_coord}</code></td>
        <td style="text-align: right;">
          <button class="btn btn-secondary btn-sm" onclick="LibrarianDashboard.openLocationModal('${this.escapeHtml(loc.genre)}')" title="Edit on Map">
            <i data-lucide="map" width="14" height="14"></i> Edit
          </button>
        </td>
      </tr>
    `).join('');
    
    if (window.lucide) lucide.createIcons({ root: tbody });
  },

  openLocationModal(genre = null) {
    this.selectedGenre = genre;
    const modal = document.getElementById('location-modal');
    const title = document.getElementById('loc-modal-title');
    
    const genreInput = document.getElementById('loc-genre');
    const xInput = document.getElementById('loc-x');
    const yInput = document.getElementById('loc-y');
    const shelfInput = document.getElementById('loc-shelf');

    if (this.locationMarker) {
      this.map.removeLayer(this.locationMarker);
      this.locationMarker = null;
    }

    let initialX = 500;
    let initialY = 350;

    if (genre) {
      const loc = this.allLocations.find(l => l.genre === genre);
      title.textContent = 'Edit Location';
      genreInput.value = loc.genre;
      genreInput.readOnly = true; // Prevent renaming for editing existing
      xInput.value = loc.x_coord;
      yInput.value = loc.y_coord;
      shelfInput.value = loc.shelf_name;
      initialX = loc.x_coord;
      initialY = loc.y_coord;
    } else {
      title.textContent = 'Add New Location';
      genreInput.value = '';
      genreInput.readOnly = false;
      xInput.value = initialX;
      yInput.value = initialY;
      shelfInput.value = '';
    }

    if (modal) modal.classList.add('active');

    setTimeout(() => {
      if (this.map) {
        this.map.invalidateSize();
        this.map.setView([initialY, initialX], 1);
        
        const icon = L.divIcon({
          className: '',
          html: `<div class="custom-pin highlighted-pin"><span><i data-lucide="map-pin" width="24" height="24" stroke="currentColor" fill="var(--bg-secondary)"></i></span></div>`,
          iconSize: [28, 28],
          iconAnchor: [14, 28],
        });
        
        this.locationMarker = L.marker([initialY, initialX], { icon, draggable: true }).addTo(this.map);
        
        this.locationMarker.on('dragend', (e) => {
          const pos = e.target.getLatLng();
          let x = Math.round(pos.lng);
          let y = Math.round(pos.lat);
          
          x = Math.max(0, Math.min(x, 1000));
          y = Math.max(0, Math.min(y, 700));
          
          e.target.setLatLng([y, x]); 
          
          xInput.value = x;
          yInput.value = y;
        });

        if (window.lucide) lucide.createIcons();
      }
    }, 10);
  },

  closeLocationModal() {
    const modal = document.getElementById('location-modal');
    if (modal) modal.classList.remove('active');
    this.selectedGenre = null;
  },

  initMap() {
    const imgWidth = 1000;
    const imgHeight = 700;
    const bounds = [[0, 0], [imgHeight, imgWidth]];

    this.map = L.map('librarian-map', {
      crs: L.CRS.Simple,
      minZoom: -1,
      maxZoom: 2,
      zoomControl: true,
      attributionControl: false,
    });

    L.imageOverlay('/static/img/floorplan.png', bounds).addTo(this.map);
    this.map.fitBounds(bounds);
    this.map.setView([imgHeight / 2, imgWidth / 2], 0);

    this.map.on('click', (e) => {
      const y = Math.round(e.latlng.lat);
      const x = Math.round(e.latlng.lng);
      
      if (x >= 0 && x <= imgWidth && y >= 0 && y <= imgHeight) {
        document.getElementById('loc-x').value = x;
        document.getElementById('loc-y').value = y;
        
        if (this.locationMarker) {
          this.locationMarker.setLatLng([y, x]);
        }
      }
    });
  },

  async handleLocationSubmit(e) {
    e.preventDefault();

    const genre = document.getElementById('loc-genre').value.trim();
    if (!genre) {
      App.toast('Please enter a genre first.', 'error');
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
      await App.api(`/api/locations/${encodeURIComponent(genre)}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
      App.toast('Location saved successfully!', 'success');

      this.closeLocationModal();
      await this.loadLocations();
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

    if (window.lucide) lucide.createIcons({ root: tbody });
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
