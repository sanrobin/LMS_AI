/**
 * ═══════════════════════════════════════════════════════════════
 *  Shared Application Utilities
 *  Auth helpers, API client, toast notifications, etc.
 * ═══════════════════════════════════════════════════════════════
 */

const App = {
  // ── API Client ────────────────────────────────────────────────

  /**
   * Make an authenticated API request.
   * Automatically includes credentials (cookies) and handles errors.
   */
  async api(url, options = {}) {
    const defaults = {
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
    };

    const config = { ...defaults, ...options };
    if (options.headers) {
      config.headers = { ...defaults.headers, ...options.headers };
    }

    try {
      const response = await fetch(url, config);

      // Handle auth errors
      if (response.status === 401) {
        if (window.location.pathname !== '/login' && window.location.pathname !== '/register') {
          window.location.href = '/login';
        }
        return null;
      }

      if (response.status === 204) {
        return { success: true };
      }

      const isJson = response.headers.get('content-type')?.includes('application/json');
      let data;
      if (isJson) {
        data = await response.json();
      } else {
        const text = await response.text();
        if (!response.ok) {
          throw new Error(text || `Request failed (${response.status})`);
        }
        return text;
      }

      if (!response.ok) {
        let errMsg = data?.detail;
        if (data && Array.isArray(data.detail)) {
          // Format FastAPI/Pydantic validation errors nicely
          errMsg = data.detail.map(e => e.msg).join('; ');
        }
        throw new Error(errMsg || `Request failed (${response.status})`);
      }

      return data;
    } catch (error) {
      if (error.message !== 'Failed to fetch') {
        App.toast(error.message, 'error');
      }
      throw error;
    }
  },

  // ── Auth Helpers ──────────────────────────────────────────────

  /**
   * Check if the user is authenticated and get their profile.
   */
  async getUser() {
    try {
      return await this.api('/auth/me');
    } catch {
      return null;
    }
  },

  /**
   * Redirect to login if not authenticated.
   * Optionally check for a required role.
   */
  async requireAuth(requiredRole = null) {
    const user = await this.getUser();
    if (!user) {
      window.location.href = '/login';
      return null;
    }
    if (requiredRole && user.role !== requiredRole) {
      window.location.href = user.role === 'librarian' ? '/librarian' : '/dashboard';
      return null;
    }
    return user;
  },

  /**
   * Log out the current user.
   */
  async logout() {
    await this.api('/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  },

  // ── Toast Notifications ───────────────────────────────────────

  /**
   * Show a toast notification.
   * @param {string} message - The message to display
   * @param {string} type - 'success' | 'error' | 'info'
   * @param {number} duration - Auto-dismiss in ms (default 4000)
   */
  toast(message, type = 'info', duration = 4000) {
    let container = document.querySelector('.toast-container');
    if (!container) {
      container = document.createElement('div');
      container.className = 'toast-container';
      document.body.appendChild(container);
    }

    const icons = {
      success: '<i data-lucide="check-circle" width="16" height="16"></i>',
      error: '<i data-lucide="x-circle" width="16" height="16"></i>',
      info: '<i data-lucide="info" width="16" height="16"></i>',
      warning: '<i data-lucide="alert-triangle" width="16" height="16"></i>',
    };

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span style="display:flex; align-items:center;">${icons[type] || icons.info}</span><span>${message}</span>`;
    container.appendChild(toast);
    if (window.lucide) lucide.createIcons({ root: toast });

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  },

  // ── Formatting Helpers ────────────────────────────────────────

  /**
   * Format a date string to a readable format.
   */
  formatDate(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  },

  /**
   * Get the duration badge class based on days.
   */
  getDurationClass(days) {
    if (days > 14) return 'duration-overdue';
    if (days > 7) return 'duration-warning';
    return 'duration-normal';
  },

  /**
   * Get the status badge HTML.
   */
  statusBadge(status, isOverdue = false) {
    if (isOverdue) {
      return '<span class="badge badge-overdue" style="display:inline-flex; align-items:center; gap:0.25rem;"><i data-lucide="alert-triangle" width="14" height="14"></i> Overdue</span>';
    }
    if (status === 'available') {
      return '<span class="badge badge-available" style="display:inline-flex; align-items:center; gap:0.25rem;"><i data-lucide="check-circle" width="14" height="14"></i> Available</span>';
    }
    return '<span class="badge badge-borrowed" style="display:inline-flex; align-items:center; gap:0.25rem;"><i data-lucide="book-open" width="14" height="14"></i> Borrowed</span>';
  },

  /**
   * Debounce a function call.
   */
  debounce(fn, delay = 300) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  },

  // ── Markdown-like formatting ──────────────────────────────────
  
  /**
   * Convert basic markdown to HTML for chat messages.
   */
  formatMarkdown(text) {
    if (!text) return '';
    return text
      // Bold
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      // Italic
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      // Bullet points
      .replace(/^[-•]\s+(.+)$/gm, '<li>$1</li>')
      // Wrap consecutive <li> in <ul>
      .replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul>$1</ul>')
      // Line breaks
      .replace(/\n/g, '<br>');
  },

  // ── Idle Timer ────────────────────────────────────────────────
  
  /**
   * Monitor user inactivity and auto-logout after 20 minutes.
   */
  initIdleTimer() {
    if (window.location.pathname === '/login' || window.location.pathname === '/register' || window.location.pathname === '/') {
      return;
    }

    const WARNING_TIME = 18 * 60 * 1000; // 18 minutes
    const LOGOUT_TIME = 20 * 60 * 1000;  // 20 minutes
    
    let lastActiveTime = Date.now();
    let warningShown = false;

    // Throttle the reset to avoid triggering on every single mousemove pixel
    const resetTimer = this.debounce(() => {
      lastActiveTime = Date.now();
      warningShown = false;
    }, 1000);

    ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'].forEach(event => {
      window.addEventListener(event, resetTimer, { passive: true });
    });

    setInterval(() => {
      const idleTime = Date.now() - lastActiveTime;

      if (idleTime >= LOGOUT_TIME) {
        this.logout();
      } else if (idleTime >= WARNING_TIME && !warningShown) {
        this.toast('You will be logged out in 2 minutes due to inactivity.', 'warning', 120000);
        warningShown = true;
      }
    }, 10000); // Check every 10 seconds
  }
};

document.addEventListener('DOMContentLoaded', () => {
  if (typeof App.initIdleTimer === 'function') {
    App.initIdleTimer();
  }
});
