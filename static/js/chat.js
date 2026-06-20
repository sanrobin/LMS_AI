/**
 * ═══════════════════════════════════════════════════════════════
 *  AI Chat Widget Module
 *  Slide-out chat panel with conversation bubbles and typing indicator.
 * ═══════════════════════════════════════════════════════════════
 */

const Chat = {
  isOpen: false,
  isLoading: false,

  /**
   * Initialize the chat widget — bind events and set initial state.
   */
  init() {
    const fab = document.getElementById('chat-fab');
    const closeBtn = document.getElementById('chat-close');
    const sendBtn = document.getElementById('chat-send');
    const input = document.getElementById('chat-input');

    if (fab) fab.addEventListener('click', () => this.toggle());
    if (closeBtn) closeBtn.addEventListener('click', () => this.toggle());
    if (sendBtn) sendBtn.addEventListener('click', () => this.sendMessage());

    if (input) {
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          this.sendMessage();
        }
      });
    }

    // Add welcome message
    this.addMessage(
      '👋 Hi! I\'m your AI Library Assistant. Ask me for book recommendations, ' +
      'topic explanations, or help finding resources in our library!',
      'assistant'
    );
  },

  /**
   * Toggle the chat panel open/closed.
   */
  toggle() {
    const panel = document.getElementById('chat-panel');
    const fab = document.getElementById('chat-fab');

    this.isOpen = !this.isOpen;

    if (panel) panel.classList.toggle('open', this.isOpen);
    if (fab) fab.classList.toggle('hidden', this.isOpen);

    // Focus input when opening
    if (this.isOpen) {
      const input = document.getElementById('chat-input');
      if (input) setTimeout(() => input.focus(), 300);
    }
  },

  /**
   * Send a message to the AI assistant.
   */
  async sendMessage() {
    const input = document.getElementById('chat-input');
    const message = input?.value?.trim();

    if (!message || this.isLoading) return;

    // Add user message to chat
    this.addMessage(message, 'user');
    input.value = '';

    // Show typing indicator
    this.setTyping(true);
    this.isLoading = true;

    try {
      const data = await App.api('/api/ai/chat', {
        method: 'POST',
        body: JSON.stringify({ message }),
      });

      this.setTyping(false);

      if (data && data.reply) {
        this.addMessage(data.reply, 'assistant');

        // Show sources if available
        if (data.sources && data.sources.length > 0) {
          const sourceText = '📎 Sources: ' + data.sources.join(', ');
          this.addMessage(sourceText, 'assistant');
        }
      }
    } catch (err) {
      this.setTyping(false);
      this.addMessage(
        '⚠️ Sorry, I encountered an error. Please try again in a moment.',
        'assistant'
      );
    } finally {
      this.isLoading = false;
    }
  },

  /**
   * Add a message bubble to the chat panel.
   * @param {string} text - The message text
   * @param {string} sender - 'user' or 'assistant'
   */
  addMessage(text, sender) {
    const container = document.getElementById('chat-messages');
    if (!container) return;

    const msg = document.createElement('div');
    msg.className = `chat-message ${sender}`;

    // Format assistant messages with markdown-like rendering
    if (sender === 'assistant') {
      msg.innerHTML = App.formatMarkdown(text);
    } else {
      msg.textContent = text;
    }

    container.appendChild(msg);

    // Auto-scroll to bottom
    container.scrollTop = container.scrollHeight;
  },

  /**
   * Show or hide the typing indicator.
   */
  setTyping(show) {
    const indicator = document.getElementById('typing-indicator');
    if (indicator) {
      indicator.classList.toggle('show', show);
      // Scroll to show typing indicator
      if (show) {
        const container = document.getElementById('chat-messages');
        if (container) container.scrollTop = container.scrollHeight;
      }
    }
  },
};
