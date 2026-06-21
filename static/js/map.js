/**
 * ═══════════════════════════════════════════════════════════════
 *  Leaflet.js Map Module
 *  Renders the library floorplan with interactive book pins.
 * ═══════════════════════════════════════════════════════════════
 */

const LibraryMap = {
  map: null,
  markers: {},       // genre → marker
  allLocations: [],

  /**
   * Initialize the Leaflet map with a static floorplan image.
   * Uses L.CRS.Simple for pixel-based coordinates.
   */
  init() {
    // Floorplan image dimensions (must match the generated image)
    const imgWidth = 1000;
    const imgHeight = 700;
    const bounds = [[0, 0], [imgHeight, imgWidth]];

    // Create map with simple CRS (no geographic projection)
    this.map = L.map('library-map', {
      crs: L.CRS.Simple,
      minZoom: -1,
      maxZoom: 2,
      zoomControl: true,
      attributionControl: false,
    });

    // Add the floorplan as an image overlay
    L.imageOverlay('/static/img/floorplan.png', bounds).addTo(this.map);

    // Fit the map to the image bounds
    this.map.fitBounds(bounds);

    // Set initial view centered on the image
    this.map.setView([imgHeight / 2, imgWidth / 2], 0);
  },

  /**
   * Load all book locations and place markers on the map.
   */
  async loadLocations() {
    try {
      this.allLocations = await App.api('/api/locations');
      this.renderMarkers(this.allLocations);
    } catch (err) {
      console.error('Failed to load locations:', err);
    }
  },

  /**
   * Render pin markers for a list of locations.
   * @param {Array} locations - Array of {genre, x_coord, y_coord, shelf_name}
   */
  renderMarkers(locations) {
    // Clear existing markers
    Object.values(this.markers).forEach(m => m.remove());
    this.markers = {};

    locations.forEach(loc => {
      // Create custom div icon
      const icon = L.divIcon({
        className: 'custom-pin',
        html: `<span><i data-lucide="map-pin" stroke="currentColor" fill="var(--bg-secondary)" width="24" height="24"></i></span>`,
        iconSize: [28, 28],
        iconAnchor: [14, 28],
        tooltipAnchor: [0, -28],
      });

      // Note: Leaflet uses [lat, lng] which maps to [y, x] in pixel coords
      const marker = L.marker([loc.y_coord, loc.x_coord], { icon }).addTo(this.map);

      // Bind tooltip
      marker.bindTooltip(`
        <div style="text-align: center; font-family: var(--font-main);">
          <strong>Genre: ${loc.genre}</strong><br>
          <span style="color: var(--text-secondary); font-size: 0.8rem;" class="flex-center-justify"><i data-lucide="map-pin" width="12" height="12"></i> ${loc.shelf_name}</span>
        </div>
      `, { direction: 'top', className: 'custom-tooltip', opacity: 0.9 });

      this.markers[loc.genre] = marker;
    });

    setTimeout(() => { if (window.lucide) lucide.createIcons(); }, 10);
  },

  /**
   * Highlight a specific book on the map.
   * Zooms to it and opens its popup with detailed info.
   */
  highlightGenre(genre, bookTitle, bookAuthor, shelfName) {
    const marker = this.markers[genre];
    if (!marker) {
      App.toast('Location not available for this genre.', 'info');
      return;
    }

    // Reset all pins to default style
    Object.values(this.markers).forEach(m => {
      const el = m.getElement();
      if (el) {
        const pin = el.querySelector('.custom-pin');
        if (pin) pin.classList.remove('highlighted-pin');
      }
    });

    // Highlight the selected pin
    const el = marker.getElement();
    if (el) {
      const pin = el.querySelector('.custom-pin');
      if (pin) pin.classList.add('highlighted-pin');
    }

    // Update tooltip content with book details
    marker.setTooltipContent(`
      <div style="min-width: 180px;">
        <strong style="color: var(--accent-blue); font-size: 0.95rem;">${bookTitle}</strong><br>
        <span style="color: var(--text-secondary); font-size: 0.8rem;">by ${bookAuthor}</span><br>
        <span style="color: var(--status-available); font-size: 0.8rem; margin-top: 4px; display: inline-block;">
          📍 ${shelfName || 'Unknown shelf'}
        </span>
      </div>
    `);

    // Pan and zoom to the marker
    this.map.setView(marker.getLatLng(), 1, { animate: true });
    marker.openTooltip();
  },

  /**
   * Reset map to show all markers without highlighting.
   */
  resetView() {
    Object.values(this.markers).forEach(m => {
      const el = m.getElement();
      if (el) {
        const pin = el.querySelector('.custom-pin');
        if (pin) pin.classList.remove('highlighted-pin');
      }
    });

    if (this.map) {
      this.map.fitBounds([[0, 0], [700, 1000]]);
    }
  },
};
