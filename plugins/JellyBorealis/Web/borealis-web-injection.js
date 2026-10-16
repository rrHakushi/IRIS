(function () {
    'use strict';

    const PLUGIN_ID = "f9a4c810-7213-4d43-9821-2e65d8a9b12d";
    let pluginConfig = null;

    console.log('%c[Borealis Plugin] CLIENT SCRIPT LOADED - MONOCHROME ZINC THEME ACTIVE', 'background: #18181b; color: #fafafa; border: 1px solid #27272a; font-size: 13px; font-weight: 600; padding: 4px 10px; border-radius: 6px;');

    // Inject self-contained CSS once
    function injectStyles() {
        if (!document.getElementById('borealis-modal-css')) {
            const cssUrl = typeof ApiClient !== 'undefined' && ApiClient.getUrl ? ApiClient.getUrl('Borealis/Modal.css') : '/Borealis/Modal.css';
            const link = document.createElement('link');
            link.id = 'borealis-modal-css';
            link.rel = 'stylesheet';
            link.href = cssUrl;
            document.head.appendChild(link);
        }
    }

    function getIconUrl() {
        return typeof ApiClient !== 'undefined' && ApiClient.getUrl ? ApiClient.getUrl('Borealis/Icon.png') : '/Borealis/Icon.png';
    }

    // Authentic Tabler Icons (Tabler stroke & structure, RTL & logical CSS compatible)
    const ICONS = {
        borealis: (size = 20) => `<img src="${getIconUrl()}" class="borealis-btn-icon" style="width:${size}px; height:${size}px;" alt="Borealis" />`,
        sparkles: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="tabler-icon tabler-icon-sparkles"><path d="M16 18a2 2 0 0 1 2 2a2 2 0 0 1 2 -2a2 2 0 0 1 -2 -2a2 2 0 0 1 -2 2m0 -12a2 2 0 0 1 2 2a2 2 0 0 1 2 -2a2 2 0 0 1 -2 -2a2 2 0 0 1 -2 2m-7 12a6 6 0 0 1 6 -6a6 6 0 0 1 -6 -6a6 6 0 0 1 -6 6a6 6 0 0 1 6 6"></path></svg>`,
        heart: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="tabler-icon tabler-icon-heart"><path d="M19.5 12.572l-7.5 7.428l-7.5 -7.428a5 5 0 1 1 7.5 -6.566a5 5 0 1 1 7.5 6.572"></path></svg>`,
        heartFilled: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="none" class="tabler-icon tabler-icon-heart-filled"><path d="M6.979 3.074a6 6 0 0 1 4.988 1.425l.037 .033l.034 -.03a6 6 0 0 1 4.733 -1.44l.246 .036a6 6 0 0 1 3.364 10.008l-.18 .185l-.048 .041l-7.45 7.379a1 1 0 0 1 -1.313 .082l-.094 -.082l-7.493 -7.422a6 6 0 0 1 3.176 -10.215z"></path></svg>`,
        star: `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="tabler-icon tabler-icon-star"><path d="M12 17.75l-6.172 3.245l1.179 -6.873l-5 -4.867l6.9 -1l3.086 -6.253l3.086 6.253l6.9 1l-5 4.867l1.179 6.873l-6.158 -3.245"></path></svg>`,
        rotateCcw: `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="tabler-icon tabler-icon-rotate"><path d="M19.95 11a8 8 0 1 0 -.5 4m.5 5v-5h-5"></path></svg>`,
        calendar: `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="tabler-icon tabler-icon-calendar"><path d="M4 7a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2v-12"></path><path d="M16 3v4"></path><path d="M8 3v4"></path><path d="M4 11h16"></path><path d="M11 15h1"></path><path d="M12 15v3"></path></svg>`,
        note: `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="tabler-icon tabler-icon-note"><path d="M13 20l7 -7"></path><path d="M13 20v-6a1 1 0 0 1 1 -1h6v-7a2 2 0 0 0 -2 -2h-12a2 2 0 0 0 -2 2v12a2 2 0 0 0 2 2h7"></path></svg>`,
        link: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="tabler-icon tabler-icon-link"><path d="M9 15l6 -6"></path><path d="M11 6l.463 -.536a5 5 0 0 1 7.071 7.072l-.534 .464"></path><path d="M13 18l-.397 .534a5.068 5.068 0 0 1 -7.127 0a4.972 4.972 0 0 1 0 -7.071l.524 -.463"></path></svg>`,
        check: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="tabler-icon tabler-icon-check"><path d="M5 12l5 5l10 -10"></path></svg>`,
        chevronDown: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="tabler-icon tabler-icon-chevron-down"><path d="M6 9l6 6l6 -6"></path></svg>`,
        chevronUp: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="tabler-icon tabler-icon-chevron-up"><path d="M6 15l6 -6l6 6"></path></svg>`,
        deviceTv: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="tabler-icon tabler-icon-device-tv"><path d="M3 9a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v9a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2l0 -9"></path><path d="M16 3l-4 4l-4 -4"></path></svg>`,
        close: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="tabler-icon tabler-icon-x"><path d="M18 6l-12 12"></path><path d="M6 6l12 12"></path></svg>`,
        edit: `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="tabler-icon tabler-icon-edit"><path d="M7 7h-1a2 2 0 0 0 -2 2v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2 -2v-1"></path><path d="M20.385 6.585a2.1 2.1 0 0 0 -2.97 -2.97l-8.415 8.385v3h3l8.385 -8.415"></path><path d="M16 5l3 3"></path></svg>`,
        trash: `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="tabler-icon tabler-icon-trash"><path d="M4 7l16 0"></path><path d="M10 11l0 6"></path><path d="M14 11l0 6"></path><path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12"></path><path d="M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3"></path></svg>`,
        search: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="tabler-icon tabler-icon-search"><path d="M3 10a7 7 0 1 0 14 0a7 7 0 1 0 -14 0"></path><path d="M21 21l-6 -6"></path></svg>`,
        activity: `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="tabler-icon tabler-icon-activity"><path d="M3 12h4l3 8l4 -16l3 8h4"></path></svg>`,
        lock: `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="tabler-icon tabler-icon-lock"><path d="M5 13a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2v6a2 2 0 0 1 -2 2h-10a2 2 0 0 1 -2 -2v-6z"></path><path d="M8 11v-4a4 4 0 1 1 8 0v4"></path></svg>`
    };

    async function loadConfig() {
        try {
            const config = await ApiClient.getPluginConfiguration(PLUGIN_ID);
            const currentUserId = ApiClient.getCurrentUserId();
            const userConfig = (config.UserConfigs || []).find(u => u.JellyfinUserId === currentUserId) || {};
            pluginConfig = {
                baseUrl: userConfig.BorealisServerUrl || "http://localhost:4000",
                apiKey: userConfig.ApiKey || "",
                mappings: config.LibraryMappings || []
            };
        } catch (e) {
            console.error('[Borealis Plugin] Failed to load configuration:', e);
        }
    }

    function getItemDetails(item) {
        let title = item.Name || "";
        let targetId = item.Id;

        if (item.Type === "Episode" || item.Type === "Season") {
            title = item.SeriesName || item.Name;
            targetId = item.SeriesId || item.Id;
        }

        const candidateIds = [
            item.SeriesId,
            item.SeasonId,
            item.Id,
            item.ParentId,
            ...(item.AncestorIds || [])
        ].filter(Boolean);

        let mediaType = "tv";
        if (pluginConfig && Array.isArray(pluginConfig.mappings) && pluginConfig.mappings.length > 0) {
            const ancestorIds = [
                item.LibraryId,
                item.ParentId,
                item.SeriesId,
                item.SeasonId,
                ...(item.AncestorIds || [])
            ].filter(Boolean);

            const matchedMapping = pluginConfig.mappings.find(m => ancestorIds.includes(m.LibraryId));
            if (matchedMapping && matchedMapping.MediaType) {
                mediaType = matchedMapping.MediaType;
            }
        }

        if (mediaType === "tv") {
            if (item.Type === "Movie") {
                mediaType = "movie";
            } else if (item.Path && /anime/i.test(item.Path)) {
                mediaType = "anime";
            } else if (Array.isArray(item.Genres) && item.Genres.some(g => /anime/i.test(g))) {
                mediaType = "anime";
            }
        }

        return { mediaType, title, targetId, candidateIds, isMovie: item.Type === "Movie" || mediaType === "movie" };
    }

    function getProxyUrl(path) {
        if (typeof ApiClient !== 'undefined' && ApiClient.getUrl) {
            return ApiClient.getUrl(path);
        }
        return `/${path.replace(/^\//, '')}`;
    }

    async function fetchWithTimeout(url, options = {}, timeoutMs = 8000) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        try {
            return await fetch(url, { ...options, signal: controller.signal });
        } finally {
            clearTimeout(timer);
        }
    }

    function formatDateInput(val) {
        if (!val) return "";
        try {
            let d;
            if (typeof val === 'number') {
                d = new Date(val > 100000000000 ? val : val * 1000);
            } else if (typeof val === 'string') {
                if (!isNaN(Number(val)) && !val.includes('-') && !val.includes('/')) {
                    const num = Number(val);
                    d = new Date(num > 100000000000 ? num : num * 1000);
                } else {
                    d = new Date(val);
                }
            } else {
                d = new Date(val);
            }
            if (isNaN(d.getTime())) return "";
            return d.toISOString().split('T')[0];
        } catch {
            return "";
        }
    }

    function isModalOpen() {
        const backdrop = document.getElementById('borealis-modal-backdrop');
        return Boolean(backdrop && backdrop.style.display !== 'none' && !backdrop.classList.contains('borealis-closing'));
    }

    let previousActiveElement = null;

    function setupGlobalInputIsolation() {
        if (window._borealisIsolationInitialized) return;
        window._borealisIsolationInitialized = true;

        const handleCaptureKey = (e) => {
            if (!isModalOpen()) return;

            const backdrop = document.getElementById('borealis-modal-backdrop');
            if (!backdrop) return;

            // Global Escape key: close modal cleanly and block Jellyfin shortcuts
            if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                closeModal();
                return;
            }

            const isInside = backdrop.contains(e.target);

            // Tab navigation: focus trap within modal card
            if (e.key === 'Tab') {
                const card = document.getElementById('borealis-modal-card');
                if (card) {
                    const focusables = Array.from(card.querySelectorAll('button:not([disabled]), [href], input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'))
                        .filter(el => el.offsetParent !== null);
                    if (focusables.length > 0) {
                        const first = focusables[0];
                        const last = focusables[focusables.length - 1];
                        if (e.shiftKey && (document.activeElement === first || !card.contains(document.activeElement))) {
                            e.preventDefault();
                            e.stopPropagation();
                            last.focus();
                            return;
                        } else if (!e.shiftKey && (document.activeElement === last || !card.contains(document.activeElement))) {
                            e.preventDefault();
                            e.stopPropagation();
                            first.focus();
                            return;
                        }
                    }
                }
            }

            if (!isInside) {
                // Keystroke occurred outside modal! Block it completely from Jellyfin playback / shortcuts!
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();

                // Redirect focus back into search input or modal input
                const searchInput = document.getElementById('borealis-search-input');
                if (searchInput) {
                    searchInput.focus();

                    // If user pressed a printable key (space, letter, number, etc.), insert into search input
                    if (e.type === 'keydown' && e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
                        const start = searchInput.selectionStart ?? searchInput.value.length;
                        const end = searchInput.selectionEnd ?? searchInput.value.length;
                        const val = searchInput.value;
                        searchInput.value = val.slice(0, start) + e.key + val.slice(end);
                        searchInput.setSelectionRange(start + 1, start + 1);
                        searchInput.dispatchEvent(new Event('input', { bubbles: true }));
                    }
                } else {
                    const anyInput = backdrop.querySelector('input:not([type="hidden"]), textarea, select');
                    if (anyInput) anyInput.focus();
                }
            }
        };

        ['keydown', 'keyup', 'keypress'].forEach(type => {
            window.addEventListener(type, handleCaptureKey, true);
        });

        // Block wheel scrolling outside modal card to protect Jellyfin volume / scroll
        window.addEventListener('wheel', (e) => {
            if (!isModalOpen()) return;
            const card = document.getElementById('borealis-modal-card');
            if (!card || !card.contains(e.target)) {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
            }
        }, { capture: true, passive: false });

        // Block pointer and mouse events outside modal backdrop
        ['pointerdown', 'mousedown', 'click', 'contextmenu'].forEach(type => {
            window.addEventListener(type, (e) => {
                if (!isModalOpen()) return;
                const backdrop = document.getElementById('borealis-modal-backdrop');
                if (backdrop && !backdrop.contains(e.target)) {
                    e.preventDefault();
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                }
            }, true);
        });
    }

    function createModalContainer() {
        let backdrop = document.getElementById('borealis-modal-backdrop');
        if (backdrop) {
            return backdrop;
        }

        backdrop = document.createElement('div');
        backdrop.id = 'borealis-modal-backdrop';
        backdrop.className = 'dark';

        backdrop.innerHTML = `
            <div id="borealis-modal-card">
                <div id="borealis-modal-content" class="flex flex-col h-full overflow-hidden"></div>
            </div>
        `;

        document.body.appendChild(backdrop);

        // Stop all bubbling keyboard and wheel events inside modal from leaking to Jellyfin document listeners
        ['keydown', 'keyup', 'keypress'].forEach(evt => {
            backdrop.addEventListener(evt, (e) => {
                e.stopPropagation();
            }, false);
        });

        backdrop.addEventListener('wheel', (e) => {
            const card = document.getElementById('borealis-modal-card');
            if (card && card.contains(e.target)) {
                e.stopPropagation();
            } else {
                e.preventDefault();
                e.stopPropagation();
            }
        }, { passive: false });

        ['pointerdown', 'mousedown', 'mouseup'].forEach(evt => {
            backdrop.addEventListener(evt, (e) => {
                e.stopPropagation();
            }, false);
        });

        backdrop.addEventListener('click', (e) => {
            e.stopPropagation();
            if (e.target === backdrop) closeModal();
        });

        return backdrop;
    }

    function openModal() {
        injectStyles();
        setupGlobalInputIsolation();
        previousActiveElement = document.activeElement;
        const backdrop = createModalContainer();
        backdrop.classList.remove('borealis-closing');
        backdrop.style.display = 'flex';
        setTimeout(() => backdrop.classList.add('borealis-show'), 10);
    }

    function closeModal() {
        const backdrop = document.getElementById('borealis-modal-backdrop');
        if (backdrop) {
            backdrop.classList.add('borealis-closing');
            backdrop.classList.remove('borealis-show');
            setTimeout(() => {
                backdrop.style.display = 'none';
                backdrop.classList.remove('borealis-closing');
                if (previousActiveElement && typeof previousActiveElement.focus === 'function') {
                    try { previousActiveElement.focus(); } catch (_) {}
                    previousActiveElement = null;
                }
            }, 180);
        }
    }

    function getCurrentlyPlayingItemId() {
        try {
            if (typeof PlaybackManager !== 'undefined') {
                const player = typeof PlaybackManager.getPlayer === 'function' ? PlaybackManager.getPlayer() : null;
                if (player && typeof PlaybackManager.currentItem === 'function') {
                    const item = PlaybackManager.currentItem(player);
                    if (item && item.Id) return item.Id;
                }
                if (typeof PlaybackManager.currentItem === 'function') {
                    const item = PlaybackManager.currentItem();
                    if (item && item.Id) return item.Id;
                }
            }
        } catch (e) {}

        const osdEl = document.querySelector('.videoOsd [data-id], .osdRightControls [data-id], .osdBottomControls [data-id], .osd-buttons [data-id], .videoOsd-buttons [data-id]');
        if (osdEl && osdEl.getAttribute('data-id')) {
            return osdEl.getAttribute('data-id');
        }

        return null;
    }

    function getCurrentItemId() {
        const isVideoActive = Boolean(document.querySelector('.videoOsd, .videoPlayerContainer, video'));
        if (isVideoActive) {
            const playingId = getCurrentlyPlayingItemId();
            if (playingId) return playingId;
        }

        if (typeof PlaybackManager !== 'undefined') {
            try {
                const player = typeof PlaybackManager.getPlayer === 'function' ? PlaybackManager.getPlayer() : null;
                if (player && typeof PlaybackManager.currentItem === 'function') {
                    const current = PlaybackManager.currentItem(player);
                    if (current && current.Id) return current.Id;
                }
                if (typeof PlaybackManager.currentItem === 'function') {
                    const current = PlaybackManager.currentItem();
                    if (current && current.Id) return current.Id;
                }
            } catch (e) {}
        }

        const detailPage = document.querySelector('.itemDetailPage, .mainDetailButtons, .detailButtons');
        if (detailPage) {
            const detailBtn = detailPage.querySelector('[data-id], .btnUserRating, .btnFavorite');
            if (detailBtn && detailBtn.getAttribute('data-id')) {
                return detailBtn.getAttribute('data-id');
            }
        }

        const hash = window.location.hash || window.location.href;
        if (hash.includes('id=')) {
            const id = hash.split('id=')[1]?.split('&')[0];
            if (id) return id;
        }

        const ratingBtn = document.querySelector('.btnUserRating, [is="emby-ratingbutton"], .btnPlaystate, [data-action="favorite"], [data-action="like"]');
        if (ratingBtn && ratingBtn.getAttribute('data-id')) return ratingBtn.getAttribute('data-id');
        const itemEl = document.querySelector('[data-id]');
        if (itemEl && itemEl.getAttribute('data-id')) return itemEl.getAttribute('data-id');
        return null;
    }

    async function saveServerMapping(userId, targetId, borealisId, mediaType) {
        try {
            console.log(`[Borealis Plugin] Persisting mapping to server: targetId=${targetId} -> borealisId=${borealisId} (${mediaType})`);
            const proxyUrl = getProxyUrl(`Borealis/Api/Mapping?userId=${encodeURIComponent(userId || '')}&itemId=${encodeURIComponent(targetId)}&borealisMediaId=${borealisId}&mediaType=${encodeURIComponent(mediaType)}`);
            await fetch(proxyUrl, { method: 'POST' });
        } catch (e) {
            console.error('[Borealis Plugin] Failed to persist mapping to server:', e);
        }
    }

    async function handleBorealisButtonClick(itemId) {
        openModal();
        const content = document.getElementById('borealis-modal-content');
        content.innerHTML = '<div class="text-center p-12 text-muted-foreground font-semibold">Loading Borealis Media Data...</div>';

        if (!pluginConfig) await loadConfig();

        try {
            const currentUserId = ApiClient.getCurrentUserId();
            const item = await ApiClient.getItem(currentUserId, itemId);
            const { mediaType: defaultMediaType, title, targetId, candidateIds, isMovie } = getItemDetails(item);

            let savedBorealisId = null;
            let activeMediaType = defaultMediaType;

            try {
                const candParam = (candidateIds && candidateIds.length > 0) ? `&candidateIds=${encodeURIComponent(candidateIds.join(','))}` : '';
                const mapRes = await fetch(getProxyUrl(`Borealis/Api/Mapping?userId=${encodeURIComponent(currentUserId || '')}&itemId=${encodeURIComponent(targetId)}${candParam}`));
                if (mapRes.ok) {
                    const mapData = await mapRes.json();
                    if (mapData && (mapData.borealisMediaId)) {
                        savedBorealisId = (mapData.borealisMediaId).toString();
                        if (mapData.mediaType) {
                            activeMediaType = mapData.mediaType;
                        }
                    }
                }
            } catch (e) {
                console.warn('[Borealis Plugin] Error fetching server mapping:', e);
            }

            if (savedBorealisId) {
                renderFullEditDialog(currentUserId, targetId, activeMediaType, parseInt(savedBorealisId, 10), title, candidateIds, isMovie, item);
            } else {
                renderSearchView(currentUserId, targetId, activeMediaType, title, candidateIds, isMovie, item);
            }
        } catch (err) {
            console.error('[Borealis Plugin] Item fetch error:', err);
            content.innerHTML = `<div class="text-center p-8 text-destructive">Failed to load item details from Jellyfin server.</div>`;
        }
    }

    // Search View to Link Borealis Title (Monochrome Design)
    async function renderSearchView(userId, targetId, initialMediaType, defaultTitle, candidateIds = [], isMovie = false, jellyfinItem = null, returnToParent = null) {
        let currentSearchType = (initialMediaType && initialMediaType !== 'manga') ? initialMediaType : (isMovie ? "movie" : "tv");
        const content = document.getElementById('borealis-modal-content');

        content.innerHTML = `
            <div class="p-6 flex flex-col gap-4">
                <div class="flex justify-between items-center">
                    <div class="flex items-center gap-2">
                        ${ICONS.borealis(22)}
                        <h3 class="m-0 text-base sm:text-lg font-bold text-foreground">Link Media to Borealis</h3>
                    </div>
                    <button type="button" class="flex size-8 cursor-pointer items-center justify-center rounded-full border border-border bg-background text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" id="borealis-modal-close-btn" aria-label="Close">
                        ${ICONS.close}
                    </button>
                </div>

                <!-- Media Type Tabs (Monochrome Zinc) -->
                <div class="borealis-tab-bar" id="borealis-search-type-pills">
                    <button type="button" class="borealis-tab-btn ${currentSearchType === 'anime' ? 'active' : ''}" data-type="anime">Anime</button>
                    <button type="button" class="borealis-tab-btn ${currentSearchType === 'tv' ? 'active' : ''}" data-type="tv">TV Shows</button>
                    <button type="button" class="borealis-tab-btn ${currentSearchType === 'movie' ? 'active' : ''}" data-type="movie">Movies</button>
                </div>

                <div class="flex gap-2.5">
                    <input type="text" id="borealis-search-input" class="borealis-input-control" value="${(defaultTitle || '').replace(/"/g, '&quot;')}" placeholder="Search title (min 3 characters)..." />
                    <button type="button" class="borealis-btn-save flex items-center gap-1.5" id="borealis-search-btn">
                        ${ICONS.search} Search
                    </button>
                </div>
                <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3.5 max-h-[420px] overflow-y-auto pr-1 borealis-custom-scrollbar" id="borealis-search-results">
                    <div class="col-span-full text-center p-8 text-muted-foreground text-xs font-mono">Searching Borealis API...</div>
                </div>
            </div>
        `;

        document.getElementById('borealis-modal-close-btn').addEventListener('click', () => {
            if (returnToParent) {
                returnToParent();
            } else {
                closeModal();
            }
        });
        const searchInput = document.getElementById('borealis-search-input');
        const searchBtn = document.getElementById('borealis-search-btn');

        // Type pills listener
        document.querySelectorAll('#borealis-search-type-pills button').forEach(pill => {
            pill.addEventListener('click', () => {
                currentSearchType = pill.getAttribute('data-type');
                document.querySelectorAll('#borealis-search-type-pills button').forEach(p => {
                    if (p.getAttribute('data-type') === currentSearchType) {
                        p.classList.add('active');
                    } else {
                        p.classList.remove('active');
                    }
                });
                doSearch();
            });
        });

        const doSearch = async () => {
            const rawQuery = searchInput.value.trim();
            if (!rawQuery || rawQuery.length < 3) {
                const resultsContainer = document.getElementById('borealis-search-results');
                if (resultsContainer) {
                    resultsContainer.innerHTML = '<div class="col-span-full text-center p-8 text-muted-foreground text-xs">Please enter at least 3 characters to search.</div>';
                }
                return;
            }

            const resultsContainer = document.getElementById('borealis-search-results');
            resultsContainer.innerHTML = '<div class="col-span-full text-center p-8 text-muted-foreground text-xs">Searching Borealis API...</div>';

            const cleanQuery = rawQuery
                .replace(/\s*\([^)]*\)/g, '')
                .replace(/\s*\[[^\]]*\]/g, '')
                .replace(/\s+-\s+\d+.*$/, '')
                .trim();

            try {
                const proxyUrl = getProxyUrl(`Borealis/Api/Search?mediaType=${encodeURIComponent(currentSearchType)}&query=${encodeURIComponent(cleanQuery || rawQuery)}&userId=${encodeURIComponent(userId || '')}`);
                const res = await fetchWithTimeout(proxyUrl, {}, 8000);
                if (!res.ok) {
                    const errText = await res.json().catch(() => ({ message: `HTTP ${res.status}` }));
                    throw new Error(errText.message || `HTTP ${res.status}`);
                }
                const items = await res.json();

                if (!Array.isArray(items) || items.length === 0) {
                    resultsContainer.innerHTML = '<div class="col-span-full text-center p-8 text-muted-foreground text-xs">No matching titles found in Borealis.</div>';
                    return;
                }

                resultsContainer.innerHTML = items.map(item => {
                    const titleText = item.titlePrimary || item.title || 'Untitled';
                    const subText = item.titleSecondary || item.titleNative || '';
                    const yearText = item.releaseDateYear || item.seasonYear || item.firstAiredYear || '';
                    const cover = item.coverImage || 'https://via.placeholder.com/150x220?text=No+Cover';

                    return `
                        <div class="bg-card border border-border rounded-xl overflow-hidden cursor-pointer transition-all p-2 flex flex-col gap-2 borealis-search-card" data-id="${item.id}" data-type="${currentSearchType}">
                            <div class="aspect-[2/3] w-full rounded-lg overflow-hidden bg-muted relative">
                                <img src="${cover}" class="w-full h-full object-cover transition-transform duration-200" />
                                ${yearText ? `<span class="absolute top-1.5 right-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-black/80 text-white backdrop-blur-xs">${yearText}</span>` : ''}
                            </div>
                            <div class="flex flex-col min-w-0 px-0.5">
                                <span class="text-xs font-bold text-foreground truncate">${titleText}</span>
                                ${subText ? `<span class="text-[10px] text-muted-foreground truncate">${subText}</span>` : ''}
                            </div>
                        </div>
                    `;
                }).join('');

                resultsContainer.querySelectorAll('.borealis-search-card').forEach(card => {
                    card.addEventListener('click', async () => {
                        const borealisId = parseInt(card.getAttribute('data-id'), 10);
                        const itemType = card.getAttribute('data-type') || currentSearchType;
                        await saveServerMapping(userId, targetId, borealisId, itemType);
                        if (returnToParent) {
                            returnToParent();
                        } else {
                            renderFullEditDialog(userId, targetId, itemType, borealisId, defaultTitle, candidateIds, isMovie, jellyfinItem);
                        }
                    });
                });
            } catch (e) {
                resultsContainer.innerHTML = `<div class="col-span-full text-center p-8 text-destructive text-xs">Search error: ${e.message}</div>`;
            }
        };

        searchBtn.addEventListener('click', doSearch);

        // Stop keyboard event propagation directly on the search input and handle Enter/Escape
        searchInput.addEventListener('keydown', (e) => {
            e.stopPropagation();
            if (e.key === 'Enter') {
                e.preventDefault();
                doSearch();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                if (returnToParent) {
                    returnToParent();
                } else {
                    closeModal();
                }
            }
        });
        searchInput.addEventListener('keyup', (e) => {
            e.stopPropagation();
        });
        searchInput.addEventListener('keypress', (e) => {
            e.stopPropagation();
        });

        // Ensure search input is immediately focused with cursor at the end
        const focusSearch = () => {
            const input = document.getElementById('borealis-search-input');
            if (input) {
                input.focus();
                try {
                    const len = input.value.length;
                    input.setSelectionRange(len, len);
                } catch (_) {}
            }
        };
        focusSearch();
        requestAnimationFrame(focusSearch);
        setTimeout(focusSearch, 50);
        setTimeout(focusSearch, 150);

        doSearch();
    }

    // Modern Monochrome Zinc 1:1 Modal Dialog Implementation (General, Episodes, Jellyfin)
    async function renderFullEditDialog(userId, targetId, mediaType, borealisId, fallbackTitle, candidateIds = [], isMovie = false, jellyfinItem = null) {
        const content = document.getElementById('borealis-modal-content');
        content.innerHTML = '<div class="text-center p-16 text-muted-foreground font-semibold">Loading Borealis media details...</div>';

        let mediaDetails = null;
        let isFavorited = false;
        let listEntry = null;

        const effectiveIsMovie = isMovie || mediaType === "movie";
        const uParam = `&userId=${encodeURIComponent(userId || '')}`;

        try {
            const [detRes, favRes, entryRes] = await Promise.all([
                fetchWithTimeout(getProxyUrl(`Borealis/Api/Details?mediaType=${encodeURIComponent(mediaType)}&id=${borealisId}${uParam}`), {}, 8000).catch(e => { console.error('[Borealis Plugin] Details error:', e); return null; }),
                fetchWithTimeout(getProxyUrl(`Borealis/Api/FavoriteStatus?mediaType=${encodeURIComponent(mediaType)}&id=${borealisId}${uParam}`), {}, 8000).catch(e => { console.error('[Borealis Plugin] FavoriteStatus error:', e); return null; }),
                fetchWithTimeout(getProxyUrl(`Borealis/Api/Entry?mediaType=${encodeURIComponent(mediaType)}&id=${borealisId}${uParam}`), {}, 8000).catch(e => { console.error('[Borealis Plugin] Entry error:', e); return null; })
            ]);

            if (detRes && detRes.ok) mediaDetails = await detRes.json();
            if (favRes && favRes.ok) {
                const favData = await favRes.json();
                isFavorited = Boolean(favData.isFavorited || favData.favorited || favData.isFavorite);
            }
            if (entryRes && entryRes.ok) listEntry = await entryRes.json();
        } catch (e) {
            console.warn('[Borealis Plugin] Parallel fetch exception:', e);
        }

        // Fetch Jellyfin seasons ONLY if not a movie
        let jellyfinSeasons = [];
        let seasonMappings = {};
        if (!effectiveIsMovie && typeof ApiClient !== 'undefined' && ApiClient.getItems) {
            try {
                const sRes = await ApiClient.getItems(userId, { parentId: targetId, includeItemTypes: "Season", sortBy: "SortName" });
                if (sRes && Array.isArray(sRes.Items) && sRes.Items.length > 0) {
                    jellyfinSeasons = sRes.Items;
                    await Promise.all(jellyfinSeasons.map(async (s) => {
                        try {
                            const mRes = await fetch(getProxyUrl(`Borealis/Api/Mapping?userId=${encodeURIComponent(userId || '')}&itemId=${encodeURIComponent(s.Id)}`));
                            if (mRes.ok) {
                                const mData = await mRes.json();
                                const sBorealisId = mData?.borealisMediaId;
                                if (sBorealisId) {
                                    mData.resolvedTitle = mData.displayTitle || `Borealis #${sBorealisId}`;
                                    seasonMappings[s.Id] = mData;
                                }
                            }
                        } catch {}
                    }));
                }
            } catch (e) {
                console.warn('[Borealis Plugin] Failed to fetch Jellyfin seasons:', e);
            }
        }

        const actualMedia = (mediaDetails && (mediaDetails.media || mediaDetails.data || mediaDetails.item)) || mediaDetails || (listEntry && (listEntry.media || listEntry.data)) || null;
        const rawMedia = actualMedia || { id: borealisId, type: mediaType, titlePrimary: fallbackTitle };
        const titleText = rawMedia.titlePrimary || rawMedia.title || rawMedia.name || rawMedia.titleEnglish || rawMedia.titleRomaji || rawMedia.titleNative || fallbackTitle;
        const coverImageLarge = rawMedia.coverImage || rawMedia.posterImage || rawMedia.image || rawMedia.cover || '';
        const bannerImage = rawMedia.bannerImage || rawMedia.backdropImage || rawMedia.coverImage || '';

        const actualEntry = (listEntry && (listEntry.entry || listEntry.data)) || listEntry;
        let hasListEntry = Boolean(actualEntry && (actualEntry.id !== undefined || actualEntry.status !== undefined));
        let listStatus = (actualEntry?.status || "PLANNING").toUpperCase();
        let score = actualEntry?.score !== undefined && actualEntry?.score !== null ? actualEntry.score.toString() : "";
        let progress = actualEntry?.progress !== undefined ? actualEntry.progress : 0;
        let rewatches = actualEntry?.rewatched !== undefined ? actualEntry.rewatched.toString() : "0";
        let notes = actualEntry?.notes || "";
        let isPrivate = Boolean(actualEntry?.private);
        let startDateStr = formatDateInput(actualEntry?.startedAt || actualEntry?.startDate);
        let finishDateStr = formatDateInput(actualEntry?.completedAt || actualEntry?.endDate);
        let watchedEpisodes = actualEntry?.watchedEpisodes || [];

        const totalEpisodes = rawMedia.episodeCount || (Array.isArray(rawMedia.episodes) ? rawMedia.episodes.length : null);
        const hasEpisodesTab = (mediaType === "tv" || mediaType === "anime") && !effectiveIsMovie;

        // Effective TV seasons & episodes from Borealis
        let borealisTvSeasons = rawMedia.seasons || [];
        if (mediaType === "tv" && Array.isArray(rawMedia.episodes) && rawMedia.episodes.length > 0) {
            const seasonsMap = {};
            rawMedia.episodes.forEach(ep => {
                const sNum = ep.seasonNumber || 1;
                if (!seasonsMap[sNum]) {
                    const matchSeason = (rawMedia.seasons || []).find(s => s.seasonNumber === sNum);
                    seasonsMap[sNum] = {
                        seasonNumber: sNum,
                        title: matchSeason?.titlePrimary || matchSeason?.title || `Season ${sNum}`,
                        episodes: []
                    };
                }
                seasonsMap[sNum].episodes.push(ep);
            });
            borealisTvSeasons = Object.values(seasonsMap).sort((a, b) => a.seasonNumber - b.seasonNumber);
        } else if (mediaType === "tv" && borealisTvSeasons.length === 0 && totalEpisodes) {
            borealisTvSeasons = [{
                seasonNumber: 1,
                title: "Season 1",
                episodeCount: totalEpisodes,
                episodes: Array.from({ length: totalEpisodes }, (_, idx) => ({ episodeNumber: idx + 1, titlePrimary: `Episode ${idx + 1}` }))
            }];
        }

        // For TV shows: if watchedEpisodes array is not populated, but progress count is > 0, populate watchedEpisodes
        if (mediaType === "tv" && (!watchedEpisodes || watchedEpisodes.length === 0) && progress > 0) {
            let remaining = progress;
            watchedEpisodes = [];
            for (const s of borealisTvSeasons) {
                const eps = s.episodes || [];
                for (const ep of eps) {
                    if (remaining > 0) {
                        watchedEpisodes.push({
                            seasonNumber: s.seasonNumber,
                            episodeNumber: ep.episodeNumber || ep.number,
                            watchedAt: actualEntry?.updatedAt || new Date().toISOString()
                        });
                        remaining--;
                    }
                }
            }
        }

        // Active tab state
        let activeTab = "general";

        const formatDisplayDate = (dStr) => {
            if (!dStr) return '<span style="color:#52525b;">Select date</span>';
            try {
                const parts = dStr.split('-');
                if (parts.length === 3) {
                    const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
                    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                }
            } catch {}
            return dStr;
        };

        content.innerHTML = `
            <!-- Top Banner Header with Backdrop Image and Overlay Vignette -->
            <div class="borealis-header-banner">
                ${bannerImage ? `<img src="${bannerImage}" class="w-full h-full object-cover brightness-60" />` : `<div class="w-full h-full bg-card"></div>`}
                <div class="absolute inset-0 bg-gradient-to-t from-[#0b0b0e] via-[#0b0b0e]/70 to-transparent"></div>

                <!-- Tabler Close Button -->
                <button type="button" id="borealis-modal-close" class="borealis-header-close" aria-label="Close">
                    ${ICONS.close}
                </button>

                <!-- Header Bottom: Poster + Title + Favorite + Save -->
                <div class="absolute inset-x-0 bottom-0 z-20 flex items-end justify-between p-3.5 sm:p-4">
                    <div class="flex min-w-0 items-end gap-3.5 sm:gap-4">
                        <div class="borealis-header-poster">
                            ${coverImageLarge ? `<img src="${coverImageLarge}" />` : `<div class="flex size-full items-center justify-center text-[10px] text-muted-foreground font-mono">No Image</div>`}
                        </div>
                        <div class="flex min-w-0 flex-col pb-0.5">
                            <h2 class="borealis-header-title">
                                ${titleText}
                            </h2>
                        </div>
                    </div>

                    <div class="flex shrink-0 items-center gap-2 pb-0.5">
                        <button type="button" id="borealis-fav-btn" class="borealis-btn-fav" title="Toggle Favorite">
                            ${isFavorited ? ICONS.heartFilled : ICONS.heart}
                        </button>
                        <button type="button" id="borealis-save-btn" class="borealis-btn-save">
                            Save
                        </button>
                    </div>
                </div>
            </div>

            <!-- Body Area -->
            <div class="flex flex-col gap-4 p-4 sm:p-5 overflow-y-auto borealis-custom-scrollbar flex-1 font-mono" id="borealis-modal-body">
                <!-- Pill Navigation Tabs Bar -->
                <div class="borealis-tab-bar">
                    <button type="button" id="tab-btn-general" class="borealis-tab-btn active">
                        General
                    </button>
                    ${hasEpisodesTab ? `
                        <button type="button" id="tab-btn-episodes" class="borealis-tab-btn">
                            Episodes (<span id="episodes-badge-count">${mediaType === 'tv' ? watchedEpisodes.length : progress}</span>/${totalEpisodes ?? '?'})
                        </button>
                    ` : ''}
                    <button type="button" id="tab-btn-jellyfin" class="borealis-tab-btn">
                        Jellyfin
                    </button>
                </div>

                ${!actualMedia ? `
                    <div class="borealis-card-section p-3.5 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
                        <div class="flex flex-col gap-0.5">
                            <span class="font-bold text-white">Borealis #${borealisId} not found or server unreachable</span>
                            <span class="text-[11px] text-[#8e8e93]">Check that your Borealis Server URL points to your server IP address in Jellyfin Settings, or relink this title in the Jellyfin tab.</span>
                        </div>
                        <button type="button" onclick="document.getElementById('tab-btn-jellyfin')?.click()" class="borealis-tab-btn bg-[#18181d] text-white border border-[#27272e] shrink-0 cursor-pointer">
                            Jellyfin Tab &rarr;
                        </button>
                    </div>
                ` : ''}

                <!-- 1. GENERAL TAB PANE -->
                <div id="tab-pane-general" class="flex flex-col gap-4">
                    <!-- Status, Score, Rewatches, Episode Progress, Dates Card -->
                    <div class="borealis-card-section space-y-4">
                        <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
                            <!-- Status -->
                            <div class="space-y-1.5">
                                <label class="borealis-field-label">
                                    ${ICONS.activity} STATUS
                                </label>
                                <select id="borealis-status-select" class="borealis-input-control cursor-pointer">
                                    ${getStatusOptions(mediaType).map(opt => `<option value="${opt.value}" ${listStatus === opt.value ? 'selected' : ''}>${opt.label}</option>`).join('')}
                                </select>
                            </div>

                            <!-- Score -->
                            <div class="space-y-1.5">
                                <label class="borealis-field-label">
                                    ${ICONS.star} SCORE (0 - 10) <span class="text-red-400">*</span>
                                </label>
                                <input type="number" id="borealis-score-input" min="0" max="10" step="0.5" value="${score}" placeholder="0 - 10" class="borealis-input-control" />
                            </div>

                            <!-- Rewatches -->
                            <div class="space-y-1.5">
                                <label class="borealis-field-label">
                                    ${ICONS.rotateCcw} REWATCHES
                                </label>
                                <input type="number" id="borealis-rewatches-input" min="0" value="${rewatches}" class="borealis-input-control" />
                            </div>
                        </div>

                        <!-- Episode Progress Row (Shown for Series / TV / Anime) -->
                        ${(hasEpisodesTab || totalEpisodes) ? `
                            <div class="space-y-1.5">
                                <label class="borealis-field-label">
                                    ${ICONS.deviceTv} EPISODE PROGRESS
                                </label>
                                <div class="borealis-progress-split">
                                    <input type="number" id="borealis-episode-progress-input" min="0" max="${totalEpisodes || ''}" value="${mediaType === 'tv' ? watchedEpisodes.length : progress}" />
                                    <span>/ ${totalEpisodes || '?'}</span>
                                </div>
                            </div>
                        ` : ''}

                        <!-- Dates Row -->
                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div class="space-y-1.5">
                                <label class="borealis-field-label">
                                    ${ICONS.calendar} START DATE
                                </label>
                                <div class="borealis-date-box" id="borealis-start-date-container">
                                    <div class="borealis-date-display" id="borealis-start-date-display">
                                        ${ICONS.calendar} <span>${formatDisplayDate(startDateStr)}</span>
                                    </div>
                                    <input type="date" id="borealis-start-date" value="${startDateStr}" class="borealis-date-picker-hidden" />
                                    <button type="button" id="borealis-start-date-clear" class="borealis-date-clear-btn" title="Clear Date">
                                        ${ICONS.close}
                                    </button>
                                </div>
                            </div>
                            <div class="space-y-1.5">
                                <label class="borealis-field-label">
                                    ${ICONS.calendar} FINISH DATE
                                </label>
                                <div class="borealis-date-box" id="borealis-finish-date-container">
                                    <div class="borealis-date-display" id="borealis-finish-date-display">
                                        ${ICONS.calendar} <span>${formatDisplayDate(finishDateStr)}</span>
                                    </div>
                                    <input type="date" id="borealis-finish-date" value="${finishDateStr}" class="borealis-date-picker-hidden" />
                                    <button type="button" id="borealis-finish-date-clear" class="borealis-date-clear-btn" title="Clear Date">
                                        ${ICONS.close}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Personal Notes Card (Encrypted Notice) -->
                    <div class="borealis-card-section space-y-2">
                        <label class="borealis-field-label">
                            ${ICONS.note} NOTES
                        </label>
                        <div class="borealis-notes-notice">
                            <span class="text-[#8e8e93]">${ICONS.lock}</span>
                            <span>Notes are encrypted and accessible in the web app</span>
                        </div>
                    </div>

                    <!-- Private Entry & Danger Actions -->
                    <div class="flex items-center justify-between gap-3 pt-1 flex-wrap">
                        <label class="flex items-center gap-2 cursor-pointer select-none text-xs text-[#8e8e93] hover:text-white">
                            <input type="checkbox" id="borealis-private-checkbox" ${isPrivate ? 'checked' : ''} class="cursor-pointer" />
                            Private List Entry
                        </label>

                        <div class="flex items-center gap-2">
                            ${hasListEntry ? `
                                <button type="button" id="borealis-delete-entry-btn" class="borealis-btn-delete">
                                    Delete
                                </button>
                            ` : ''}
                        </div>
                    </div>
                </div>

                <!-- 2. EPISODES TAB PANE -->
                ${hasEpisodesTab ? `
                    <div id="tab-pane-episodes" class="hidden flex-col gap-3">
                        ${mediaType === 'tv' ? `
                            <!-- TV Series Seasons Accordion -->
                            <div class="flex flex-col gap-2 max-h-[380px] overflow-y-auto borealis-custom-scrollbar pr-1" id="borealis-tv-seasons-container">
                                ${borealisTvSeasons.map(s => {
                                    const sNum = s.seasonNumber;
                                    const eps = s.episodes || [];
                                    const epCount = s.episodeCount || eps.length;
                                    const watchedInSeason = eps.filter(ep => watchedEpisodes.some(w => (w.seasonNumber === sNum || w.seasonNum === sNum) && (w.episodeNumber === (ep.episodeNumber || ep.number) || w.episodeNum === (ep.episodeNumber || ep.number)))).length;
                                    const isComplete = epCount > 0 && watchedInSeason >= epCount;
                                    const percent = epCount > 0 ? Math.round((watchedInSeason / epCount) * 100) : 0;

                                    return `
                                        <div class="borealis-season-card" id="season-card-${sNum}">
                                            <div class="borealis-season-header" onclick="window.borealisToggleSeasonAccordion(${sNum})">
                                                <div class="flex items-center gap-3">
                                                    <input type="checkbox" id="season-chk-${sNum}" ${isComplete ? 'checked' : ''} onclick="event.stopPropagation(); window.borealisToggleSeasonComplete(${sNum}, this.checked);" class="cursor-pointer" />
                                                    <span class="borealis-season-title">${s.title || `Season ${sNum}`}</span>
                                                </div>
                                                <div class="flex items-center gap-2.5">
                                                    <span id="season-badge-${sNum}" class="borealis-season-badge ${isComplete ? 'complete' : ''}">
                                                        ${watchedInSeason} / ${epCount || '?'} Ep (${percent}%)
                                                    </span>
                                                    <span id="chevron-season-${sNum}">${ICONS.chevronDown}</span>
                                                </div>
                                            </div>
                                            <div class="borealis-season-body hidden borealis-custom-scrollbar" id="season-eps-${sNum}">
                                                ${eps.map(ep => {
                                                    const epNum = ep.episodeNumber || ep.number;
                                                    const epTitle = ep.titlePrimary || ep.title || ep.name || `Episode ${epNum}`;
                                                    const isWatched = watchedEpisodes.some(w => (w.seasonNumber === sNum || w.seasonNum === sNum) && (w.episodeNumber === epNum || w.episodeNum === epNum));

                                                    return `
                                                        <button type="button" id="tv-ep-btn-${sNum}-${epNum}" class="borealis-ep-btn ${isWatched ? 'watched' : ''}" onclick="window.borealisToggleTvEpisode(${sNum}, ${epNum})">
                                                            <span class="truncate pr-1">${epNum}. ${epTitle}</span>
                                                            <span class="tv-ep-check">${isWatched ? ICONS.check : ''}</span>
                                                        </button>
                                                    `;
                                                }).join('')}
                                            </div>
                                        </div>
                                    `;
                                }).join('')}
                            </div>
                        ` : `
                            <!-- Anime Episode Grid -->
                            <div class="borealis-card-section space-y-3">
                                <div class="flex items-center justify-between">
                                    <span id="borealis-anime-episodes-header" class="text-xs font-bold text-white">Episodes (${progress} / ${totalEpisodes || '?'})</span>
                                    <div class="flex items-center gap-2">
                                        <button type="button" onclick="window.borealisSetAnimeProgress(${totalEpisodes || 0})" class="text-[11px] font-semibold text-white hover:underline cursor-pointer">Mark all as watched</button>
                                        <span class="text-[#52525b]">|</span>
                                        <button type="button" onclick="window.borealisSetAnimeProgress(0)" class="text-[11px] font-semibold text-[#8e8e93] hover:text-white cursor-pointer">Clear</button>
                                    </div>
                                </div>
                                <div id="borealis-anime-grid-container" class="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2 max-h-[300px] overflow-y-auto borealis-custom-scrollbar pr-1">
                                    ${Array.from({ length: totalEpisodes || progress || 12 }, (_, i) => i + 1).map(num => {
                                        const isWatched = num <= progress;
                                        return `
                                            <button type="button" data-ep-num="${num}" onclick="window.borealisSetAnimeProgress(${isWatched && num === progress ? num - 1 : num})" class="borealis-anime-grid-btn ${isWatched ? 'watched' : ''}">
                                                ${num}
                                            </button>
                                        `;
                                    }).join('')}
                                </div>
                            </div>
                        `}
                    </div>
                ` : ''}

                <!-- 3. JELLYFIN TAB PANE -->
                <div id="tab-pane-jellyfin" class="hidden flex-col gap-3.5">
                    <!-- Current Jellyfin Item Mapping Card -->
                    <div class="borealis-card-section space-y-3">
                        <div class="flex items-center justify-between">
                            <label class="borealis-field-label">
                                ${ICONS.deviceTv} Jellyfin Item Link
                            </label>
                            <span class="text-[10px] font-mono text-[#8e8e93] bg-[#141418] px-2 py-0.5 rounded-md border border-[#26262c]">${targetId}</span>
                        </div>

                        <div class="flex items-center justify-between bg-[#141418] border border-[#26262c] rounded-xl p-3 text-xs">
                            <div class="flex flex-col min-w-0">
                                <span class="font-bold text-white truncate">${jellyfinItem?.Name || fallbackTitle}</span>
                                <span class="text-[11px] text-[#8e8e93] font-medium">Linked to Borealis #${borealisId} (${mediaType})</span>
                            </div>
                            <div class="flex items-center gap-2 shrink-0">
                                <button type="button" id="borealis-change-link-btn" class="bg-[#1c1c22] hover:bg-[#25252c] text-white border border-[#27272e] text-xs font-semibold px-3 py-1.5 rounded-lg cursor-pointer transition-all">
                                    Change Link
                                </button>
                                <button type="button" id="borealis-unlink-mapping-btn" class="bg-transparent hover:bg-destructive/15 text-destructive border border-destructive/30 text-xs font-semibold px-3 py-1.5 rounded-lg cursor-pointer transition-all">
                                    Unlink
                                </button>
                            </div>
                        </div>
                    </div>

                    <!-- Jellyfin Seasons Linking Section (Only for TV / Anime, NEVER for movies) -->
                    ${(!effectiveIsMovie && jellyfinSeasons.length > 0) ? `
                        <div class="borealis-card-section space-y-3">
                            <div class="flex items-center justify-between">
                                <label class="borealis-field-label">
                                    ${ICONS.link} Seasons & Linked Borealis Media
                                </label>
                                <span class="text-[10px] text-[#8e8e93] font-semibold bg-[#141418] px-2 py-0.5 rounded-md border border-[#26262c]">${jellyfinSeasons.length} Seasons</span>
                            </div>

                            <div class="flex flex-col gap-2 max-h-[260px] overflow-y-auto pr-1 borealis-custom-scrollbar">
                                ${jellyfinSeasons.map(s => {
                                    const sMap = seasonMappings[s.Id];
                                    const isMapped = Boolean(sMap && (sMap.borealisMediaId || sMap.aquilaMediaId));
                                    const sBorealisId = sMap?.borealisMediaId;
                                    const sTitle = sMap?.resolvedTitle || (isMapped ? `Borealis #${sBorealisId}` : 'Unlinked (not mapped)');
                                    const safeName = (s.Name || 'Season').replace(/'/g, "\\'");

                                    return `
                                        <div class="flex items-center justify-between bg-[#141418] border border-[#26262c] rounded-lg p-2.5 px-3 text-xs shrink-0">
                                            <div class="flex items-center gap-2 min-w-0">
                                                <span class="font-bold text-[10px] text-white bg-[#101014] border border-[#26262c] px-2 py-0.5 rounded-md shrink-0">${s.Name}</span>
                                                ${isMapped ? `
                                                    <span class="font-bold text-white truncate max-w-[160px] sm:max-w-[260px]">${sTitle}</span>
                                                    <span class="font-mono text-[10px] text-[#8e8e93] font-semibold shrink-0">#${sBorealisId}</span>
                                                ` : `
                                                    <span class="text-[#8e8e93]/70 italic text-[11px]">Unlinked (not mapped)</span>
                                                `}
                                            </div>
                                            <div class="flex items-center gap-1 shrink-0">
                                                ${isMapped ? `
                                                    <button type="button" class="p-1.5 text-white hover:bg-[#222228] rounded-md cursor-pointer text-xs font-semibold flex items-center gap-1" onclick="window.borealisEditSeasonMedia('${s.Id}', '${mediaType}', ${sBorealisId}, '${safeName}')">${ICONS.edit} Edit</button>
                                                    <button type="button" class="p-1.5 text-destructive hover:bg-destructive/15 rounded-md cursor-pointer text-xs font-semibold" onclick="window.borealisUnlinkSeasonMedia('${s.Id}')">Unlink</button>
                                                ` : `
                                                    <button type="button" class="bg-[#1c1c22] hover:bg-[#25252c] text-white border border-[#27272e] text-[11px] font-semibold px-2.5 py-1 rounded-md cursor-pointer transition-all" onclick="window.borealisLinkSeasonMedia('${s.Id}', '${safeName}')">+ Link Media</button>
                                                `}
                                            </div>
                                        </div>
                                    `;
                                }).join('')}
                            </div>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;

        document.getElementById('borealis-modal-close').addEventListener('click', closeModal);

        // Tab Switching Logic
        const tabGenBtn = document.getElementById('tab-btn-general');
        const tabEpsBtn = document.getElementById('tab-btn-episodes');
        const tabJellyfinBtn = document.getElementById('tab-btn-jellyfin');
        const paneGen = document.getElementById('tab-pane-general');
        const paneEps = document.getElementById('tab-pane-episodes');
        const paneJellyfin = document.getElementById('tab-pane-jellyfin');

        const allTabBtns = [tabGenBtn, tabEpsBtn, tabJellyfinBtn].filter(Boolean);
        const allPanes = [paneGen, paneEps, paneJellyfin].filter(Boolean);

        const setActiveTab = (tab) => {
            activeTab = tab;
            allTabBtns.forEach(btn => btn.classList.remove('active'));
            allPanes.forEach(pane => {
                pane.classList.add('hidden');
                pane.classList.remove('flex');
            });

            if (tab === "general" && tabGenBtn && paneGen) {
                tabGenBtn.classList.add('active');
                paneGen.classList.remove('hidden');
                paneGen.classList.add('flex');
            } else if (tab === "episodes" && tabEpsBtn && paneEps) {
                tabEpsBtn.classList.add('active');
                paneEps.classList.remove('hidden');
                paneEps.classList.add('flex');
            } else if ((tab === "jellyfin" || tab === "connections") && tabJellyfinBtn && paneJellyfin) {
                tabJellyfinBtn.classList.add('active');
                paneJellyfin.classList.remove('hidden');
                paneJellyfin.classList.add('flex');
            }
        };

        tabGenBtn?.addEventListener('click', () => setActiveTab("general"));
        tabEpsBtn?.addEventListener('click', () => setActiveTab("episodes"));
        tabJellyfinBtn?.addEventListener('click', () => setActiveTab("jellyfin"));

        // Score Input Clamp (0 - 10)
        const scoreInput = document.getElementById('borealis-score-input');
        const clampScore = (el) => {
            if (!el || el.value === '') return;
            const raw = parseFloat(el.value);
            if (isNaN(raw)) {
                el.value = '';
            } else if (raw < 0) {
                el.value = 0;
            } else if (raw > 10) {
                el.value = 10;
            }
        };
        scoreInput?.addEventListener('keydown', (e) => {
            if (e.key === '-' || e.key === '+' || e.key === 'e' || e.key === 'E') {
                e.preventDefault();
            }
        });
        scoreInput?.addEventListener('input', (e) => clampScore(e.target));
        scoreInput?.addEventListener('change', (e) => clampScore(e.target));
        scoreInput?.addEventListener('blur', (e) => clampScore(e.target));

        // Date and Progress Input Listeners with showPicker() modal opening
        const startDateInput = document.getElementById('borealis-start-date');
        const startDisplay = document.getElementById('borealis-start-date-display');
        const openStartDatePicker = () => {
            if (startDateInput) {
                if (typeof startDateInput.showPicker === 'function') {
                    try { startDateInput.showPicker(); } catch { startDateInput.focus(); }
                } else {
                    startDateInput.focus();
                }
            }
        };
        startDateInput?.addEventListener('change', (e) => {
            if (startDisplay) startDisplay.innerHTML = `${ICONS.calendar} <span>${formatDisplayDate(e.target.value)}</span>`;
        });
        document.getElementById('borealis-start-date-container')?.addEventListener('click', (e) => {
            if (e.target.closest('#borealis-start-date-clear')) return;
            openStartDatePicker();
        });
        startDateInput?.addEventListener('click', (e) => {
            e.stopPropagation();
            openStartDatePicker();
        });
        document.getElementById('borealis-start-date-clear')?.addEventListener('click', (e) => {
            e.stopPropagation();
            if (startDateInput) startDateInput.value = '';
            if (startDisplay) startDisplay.innerHTML = `${ICONS.calendar} <span>${formatDisplayDate('')}</span>`;
        });

        const finishDateInput = document.getElementById('borealis-finish-date');
        const finishDisplay = document.getElementById('borealis-finish-date-display');
        const openFinishDatePicker = () => {
            if (finishDateInput) {
                if (typeof finishDateInput.showPicker === 'function') {
                    try { finishDateInput.showPicker(); } catch { finishDateInput.focus(); }
                } else {
                    finishDateInput.focus();
                }
            }
        };
        finishDateInput?.addEventListener('change', (e) => {
            if (finishDisplay) finishDisplay.innerHTML = `${ICONS.calendar} <span>${formatDisplayDate(e.target.value)}</span>`;
        });
        document.getElementById('borealis-finish-date-container')?.addEventListener('click', (e) => {
            if (e.target.closest('#borealis-finish-date-clear')) return;
            openFinishDatePicker();
        });
        finishDateInput?.addEventListener('click', (e) => {
            e.stopPropagation();
            openFinishDatePicker();
        });
        document.getElementById('borealis-finish-date-clear')?.addEventListener('click', (e) => {
            e.stopPropagation();
            if (finishDateInput) finishDateInput.value = '';
            if (finishDisplay) finishDisplay.innerHTML = `${ICONS.calendar} <span>${formatDisplayDate('')}</span>`;
        });

        const epProgInput = document.getElementById('borealis-episode-progress-input');
        epProgInput?.addEventListener('input', (e) => {
            const val = parseInt(e.target.value, 10) || 0;
            const badgeCount = document.getElementById('episodes-badge-count');
            if (badgeCount) badgeCount.textContent = val.toString();
        });

        // Global functions for episode and season interactions
        window.borealisToggleSeasonAccordion = (sNum) => {
            const grid = document.getElementById(`season-eps-${sNum}`);
            const chev = document.getElementById(`chevron-season-${sNum}`);
            if (!grid) return;
            if (grid.classList.contains('hidden')) {
                grid.classList.remove('hidden');
                grid.classList.add('grid');
                if (chev) chev.innerHTML = ICONS.chevronUp;
            } else {
                grid.classList.add('hidden');
                grid.classList.remove('grid');
                if (chev) chev.innerHTML = ICONS.chevronDown;
            }
        };

        function updateSeasonBadgeAndCheckbox(sNum) {
            const season = borealisTvSeasons.find(s => s.seasonNumber === sNum);
            const eps = season?.episodes || [];
            const epCount = season?.episodeCount || eps.length;
            const watchedInSeason = eps.filter(ep => watchedEpisodes.some(w => (w.seasonNumber === sNum || w.seasonNum === sNum) && (w.episodeNumber === (ep.episodeNumber || ep.number) || w.episodeNum === (ep.episodeNumber || ep.number)))).length;
            const isComplete = epCount > 0 && watchedInSeason >= epCount;
            const percent = epCount > 0 ? Math.round((watchedInSeason / epCount) * 100) : 0;

            const chk = document.getElementById(`season-chk-${sNum}`);
            if (chk) chk.checked = isComplete;

            const badgeSpan = document.getElementById(`season-badge-${sNum}`);
            if (badgeSpan) {
                badgeSpan.className = `borealis-season-badge ${isComplete ? 'complete' : ''}`;
                badgeSpan.innerText = `${watchedInSeason} / ${epCount || '?'} Ep (${percent}%)`;
            }
        }

        window.borealisToggleTvEpisode = (sNum, epNum) => {
            const existingIdx = watchedEpisodes.findIndex(w => (w.seasonNumber === sNum || w.seasonNum === sNum) && (w.episodeNumber === epNum || w.episodeNum === epNum));
            let isNowWatched = false;
            if (existingIdx !== -1) {
                watchedEpisodes.splice(existingIdx, 1);
                isNowWatched = false;
            } else {
                watchedEpisodes.push({ seasonNumber: sNum, episodeNumber: epNum, watchedAt: new Date().toISOString() });
                isNowWatched = true;
            }

            const epBtn = document.getElementById(`tv-ep-btn-${sNum}-${epNum}`);
            if (epBtn) {
                if (isNowWatched) {
                    epBtn.className = 'borealis-ep-btn watched';
                    const iconSpan = epBtn.querySelector('.tv-ep-check');
                    if (iconSpan) iconSpan.innerHTML = ICONS.check;
                } else {
                    epBtn.className = 'borealis-ep-btn';
                    const iconSpan = epBtn.querySelector('.tv-ep-check');
                    if (iconSpan) iconSpan.innerHTML = '';
                }
            }

            updateSeasonBadgeAndCheckbox(sNum);
            const badge = document.getElementById('episodes-badge-count');
            if (badge) badge.innerText = watchedEpisodes.length;
        };

        window.borealisToggleSeasonComplete = (sNum, isChecked) => {
            const season = borealisTvSeasons.find(s => s.seasonNumber === sNum);
            const eps = season?.episodes || [];
            if (isChecked) {
                eps.forEach(ep => {
                    const epNum = ep.episodeNumber || ep.number;
                    if (!watchedEpisodes.some(w => (w.seasonNumber === sNum || w.seasonNum === sNum) && (w.episodeNumber === epNum || w.episodeNum === epNum))) {
                        watchedEpisodes.push({ seasonNumber: sNum, episodeNumber: epNum, watchedAt: new Date().toISOString() });
                    }
                });
            } else {
                watchedEpisodes = watchedEpisodes.filter(w => (w.seasonNumber !== sNum && w.seasonNum !== sNum));
            }

            eps.forEach(ep => {
                const epNum = ep.episodeNumber || ep.number;
                const epBtn = document.getElementById(`tv-ep-btn-${sNum}-${epNum}`);
                if (epBtn) {
                    if (isChecked) {
                        epBtn.className = 'borealis-ep-btn watched';
                        const iconSpan = epBtn.querySelector('.tv-ep-check');
                        if (iconSpan) iconSpan.innerHTML = ICONS.check;
                    } else {
                        epBtn.className = 'borealis-ep-btn';
                        const iconSpan = epBtn.querySelector('.tv-ep-check');
                        if (iconSpan) iconSpan.innerHTML = '';
                    }
                }
            });

            updateSeasonBadgeAndCheckbox(sNum);
            const badge = document.getElementById('episodes-badge-count');
            if (badge) badge.innerText = watchedEpisodes.length;
        };

        window.borealisSetAnimeProgress = (newProg) => {
            progress = Math.max(0, newProg);
            const progInput = document.getElementById('borealis-anime-progress-input');
            if (progInput) progInput.value = progress;
            const badge = document.getElementById('episodes-badge-count');
            if (badge) badge.innerText = progress;

            const headerEl = document.getElementById('borealis-anime-episodes-header');
            if (headerEl) headerEl.innerText = `Episodes (${progress} / ${totalEpisodes || '?'})`;

            const grid = document.getElementById('borealis-anime-grid-container');
            if (grid) {
                grid.querySelectorAll('button[data-ep-num]').forEach(btn => {
                    const num = parseInt(btn.getAttribute('data-ep-num'), 10);
                    const isWatched = num <= progress;
                    btn.className = isWatched ? 'borealis-anime-grid-btn watched' : 'borealis-anime-grid-btn';
                    btn.setAttribute('onclick', `window.borealisSetAnimeProgress(${isWatched && num === progress ? num - 1 : num})`);
                });
            }
        };

        // Jellyfin season mapping actions
        window.borealisLinkSeasonMedia = (seasonId, seasonName) => {
            renderSearchView(userId, seasonId, mediaType, `${titleText} ${seasonName}`, candidateIds, false, jellyfinItem, () => {
                renderFullEditDialog(userId, targetId, mediaType, borealisId, fallbackTitle, candidateIds, isMovie, jellyfinItem).then(() => {
                    setActiveTab("jellyfin");
                });
            });
        };

        window.borealisEditSeasonMedia = (seasonId, sType, sBorealisId, seasonName) => {
            renderFullEditDialog(userId, seasonId, sType, sBorealisId, `${titleText} ${seasonName}`, candidateIds, false, jellyfinItem);
        };

        window.borealisUnlinkSeasonMedia = async (seasonId) => {
            try {
                await fetch(getProxyUrl(`Borealis/Api/Mapping?userId=${encodeURIComponent(userId || '')}&itemId=${encodeURIComponent(seasonId)}`), { method: 'DELETE' });
                renderFullEditDialog(userId, targetId, mediaType, borealisId, fallbackTitle, candidateIds, isMovie, jellyfinItem).then(() => {
                    setActiveTab("jellyfin");
                });
            } catch (e) {
                console.error('[Borealis Plugin] Failed to unlink season:', e);
            }
        };

        // Favorite Toggle
        const favBtn = document.getElementById('borealis-fav-btn');
        favBtn.addEventListener('click', async () => {
            const nextState = !isFavorited;
            isFavorited = nextState;
            favBtn.innerHTML = isFavorited ? ICONS.heartFilled : ICONS.heart;

            try {
                if (nextState) {
                    await fetch(getProxyUrl(`Borealis/Api/Favorite?mediaType=${encodeURIComponent(mediaType)}&id=${borealisId}&title=${encodeURIComponent(titleText)}`), { method: 'POST' });
                } else {
                    await fetch(getProxyUrl(`Borealis/Api/Favorite?mediaType=${encodeURIComponent(mediaType)}&id=${borealisId}`), { method: 'DELETE' });
                }
            } catch (e) {
                console.error('[Borealis Plugin] Failed to toggle favorite:', e);
            }
        });

        // Change Link button (on Connections tab)
        document.getElementById('borealis-change-link-btn')?.addEventListener('click', () => {
            renderSearchView(userId, targetId, mediaType, titleText, candidateIds, isMovie, jellyfinItem);
        });

        // Unlink button (on Connections tab)
        document.getElementById('borealis-unlink-mapping-btn')?.addEventListener('click', async () => {
            try {
                const candParam = (candidateIds && candidateIds.length > 0) ? `&candidateIds=${encodeURIComponent(candidateIds.join(','))}` : '';
                await fetch(getProxyUrl(`Borealis/Api/Mapping?userId=${encodeURIComponent(userId || '')}&itemId=${encodeURIComponent(targetId)}${candParam}`), { method: 'DELETE' });
                renderSearchView(userId, targetId, mediaType, titleText, candidateIds, isMovie, jellyfinItem);
            } catch (e) {
                console.error('[Borealis Plugin] Error unlinking mapping:', e);
            }
        });

        // Delete entry button (on General tab)
        document.getElementById('borealis-delete-entry-btn')?.addEventListener('click', async () => {
            if (!confirm(`Are you sure you want to remove this ${mediaType} from your Borealis list?`)) return;
            try {
                const res = await fetch(getProxyUrl(`Borealis/Api/Entry?mediaType=${encodeURIComponent(mediaType)}&id=${borealisId}`), { method: 'DELETE' });
                if (res.ok) closeModal();
                else alert('Failed to delete entry from Borealis.');
            } catch (e) {
                alert('Error deleting entry from Borealis.');
            }
        });

        // Save Entry Button
        document.getElementById('borealis-save-btn').addEventListener('click', async () => {
            const saveBtn = document.getElementById('borealis-save-btn');
            saveBtn.disabled = true;
            saveBtn.innerText = 'Saving...';

            const statusSelect = document.getElementById('borealis-status-select');
            const currentStatus = statusSelect ? statusSelect.value : listStatus;
            const scoreVal = document.getElementById('borealis-score-input')?.value;
            const rewatchesVal = document.getElementById('borealis-rewatches-input')?.value;
            const progInput = document.getElementById('borealis-episode-progress-input') || document.getElementById('borealis-anime-progress-input');
            const notesVal = document.getElementById('borealis-notes-input')?.value;
            const startVal = document.getElementById('borealis-start-date')?.value;
            const finishVal = document.getElementById('borealis-finish-date')?.value;
            const privChecked = document.getElementById('borealis-private-checkbox')?.checked;

            let finalProg = progInput ? parseInt(progInput.value, 10) : (mediaType === 'tv' ? watchedEpisodes.length : 0);
            if (isNaN(finalProg)) finalProg = 0;

            if (mediaType === 'tv' && progInput) {
                const desiredCount = finalProg;
                if (desiredCount !== watchedEpisodes.length) {
                    let remaining = desiredCount;
                    watchedEpisodes = [];
                    for (const s of borealisTvSeasons) {
                        const eps = s.episodes || [];
                        for (const ep of eps) {
                            if (remaining > 0) {
                                watchedEpisodes.push({
                                    seasonNumber: s.seasonNumber,
                                    episodeNumber: ep.episodeNumber || ep.number,
                                    watchedAt: new Date().toISOString()
                                });
                                remaining--;
                            }
                        }
                    }
                }
            }

            let parsedScore = null;
            if (scoreVal !== undefined && scoreVal !== null && scoreVal !== '') {
                const s = parseFloat(scoreVal);
                if (!isNaN(s)) {
                    parsedScore = Math.min(10, Math.max(0, s));
                }
            }

            const dto = {
                status: currentStatus,
                score: parsedScore,
                notes: actualEntry?.notes ?? null,
                rewatched: rewatchesVal ? parseInt(rewatchesVal, 10) : 0,
                private: privChecked ?? false,
                startedAt: startVal ? new Date(startVal).toISOString() : null,
                completedAt: finishVal ? new Date(finishVal).toISOString() : null,
                progress: finalProg
            };

            if (mediaType === 'tv') {
                dto.watchedEpisodes = watchedEpisodes;
                dto.seasons = borealisTvSeasons.map(s => {
                    const sNum = s.seasonNumber;
                    const eps = s.episodes || [];
                    const watchedCount = eps.filter(ep => watchedEpisodes.some(w => (w.seasonNumber === sNum || w.seasonNum === sNum) && (w.episodeNumber === (ep.episodeNumber || ep.number) || w.episodeNum === (ep.episodeNumber || ep.number)))).length;
                    const isComplete = eps.length > 0 && watchedCount >= eps.length;
                    return {
                        seasonNumber: sNum,
                        status: isComplete ? "COMPLETED" : (watchedCount > 0 ? "WATCHING" : "PLANNING"),
                        progress: watchedCount
                    };
                });
            }

            try {
                const res = await fetch(getProxyUrl(`Borealis/Api/Save?mediaType=${encodeURIComponent(mediaType)}&id=${borealisId}`), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(dto)
                });

                if (res.ok) {
                    closeModal();
                } else {
                    alert('Failed to save list entry to Borealis.');
                    saveBtn.disabled = false;
                    saveBtn.innerText = 'Save';
                }
            } catch (err) {
                console.error('[Borealis Plugin] Save exception:', err);
                alert('Error saving entry to Borealis server.');
                saveBtn.disabled = false;
                saveBtn.innerText = 'Save';
            }
        });

        const notesInput = document.getElementById('borealis-notes-input');
        if (notesInput) {
            ['keydown', 'keyup', 'keypress'].forEach(evt => {
                notesInput.addEventListener(evt, (e) => {
                    e.stopPropagation();
                });
            });
        }
    }

    function getStatusOptions(mediaType) {
        if (mediaType === "movie") {
            return [
                { value: "COMPLETED", label: "✓ Completed" },
                { value: "PLANNING", label: "Planning" },
                { value: "DROPPED", label: "Dropped" }
            ];
        }
        return [
            { value: "COMPLETED", label: "✓ Completed" },
            { value: "WATCHING", label: "Watching" },
            { value: "PLANNING", label: "Planning" },
            { value: "ON_HOLD", label: "On Hold" },
            { value: "DROPPED", label: "Dropped" }
        ];
    }

    function createBorealisButton() {
        const btn = document.createElement('button');
        btn.setAttribute('is', 'emby-button');
        btn.setAttribute('type', 'button');
        btn.className = 'button-flat btnBorealisEditModal detailButton emby-button';
        btn.title = 'Manage in Borealis';
        btn.innerHTML = `
            <div class="detailButton-content">
                <span class="detailButton-icon" style="display:inline-flex; align-items:center; justify-content:center; width:22px; height:22px;">
                    ${ICONS.borealis(20)}
                </span>
            </div>
        `;

        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();

            let itemId = null;
            const isVideoOSD = Boolean(btn.closest('.videoOsd, .osdRightControls, .osdBottomControls, .videoPlayerContainer') || document.querySelector('.videoOsd, video'));

            if (isVideoOSD) {
                itemId = getCurrentlyPlayingItemId();
            }

            if (!itemId) {
                const parentWithId = btn.closest('[data-id]');
                if (parentWithId) itemId = parentWithId.getAttribute('data-id');
            }

            if (!itemId) {
                const siblingFav = btn.parentNode ? btn.parentNode.querySelector('.btnUserRating, [is="emby-ratingbutton"], .btnOsdUserData, [data-id]') : null;
                if (siblingFav && siblingFav.getAttribute('data-id')) {
                    itemId = siblingFav.getAttribute('data-id');
                }
            }

            if (!itemId) {
                itemId = getCurrentItemId();
            }

            console.log(`[Borealis WebClient] Borealis button clicked: Resolved itemId=${itemId} (isVideoOSD=${isVideoOSD})`);
            if (itemId) handleBorealisButtonClick(itemId);
        });

        return btn;
    }

    // High performance inline buttons injection
    function injectInlineButtons() {
        // 1. Detail page rating / favorite buttons (inject immediately next to favorite)
        const favButtons = document.querySelectorAll('.btnUserRating, button[is="emby-ratingbutton"], .btnFavorite, .btnDetailFavorite, button[data-action="favorite"], button[data-action="like"], .btnOsdUserData');
        favButtons.forEach(favBtn => {
            // Never inject into library item cards
            if (favBtn.closest('.card, .cardOverlay, .cardOverlayButton, .cardFooter, .cardOverlayContainer, .innerCardFooter, .itemCard')) {
                return;
            }

            const parent = favBtn.parentNode;
            if (parent && !parent.querySelector('.btnBorealisEditModal')) {
                const btn = createBorealisButton();
                parent.insertBefore(btn, favBtn.nextSibling);
            }
        });

        // 2. Action button containers
        const containers = document.querySelectorAll('.mainDetailButtons, .detailButtons, .osdRightControls, .osdControls-right, .osdBottomControls, .videoOsd, .osd-buttons, .videoOsdBottom');
        containers.forEach(container => {
            if (container.closest('.card, .cardOverlay, .cardOverlayButton, .cardFooter, .cardOverlayContainer, .innerCardFooter, .itemCard')) {
                return;
            }

            if (container.querySelector('.btnBorealisEditModal')) return;

            const btn = createBorealisButton();
            container.appendChild(btn);
        });
    }

    // High performance debounced UI update scheduler
    let updateScheduled = false;
    function scheduleUiUpdate(delay = 120) {
        if (updateScheduled) return;
        updateScheduled = true;
        setTimeout(() => {
            updateScheduled = false;
            try {
                injectStyles();
                injectInlineButtons();
            } catch (e) {
                console.error('[Borealis Plugin] Exception during UI iteration:', e);
            }
        }, delay);
    }

    // Hook into Jellyfin SPA routing and lifecycle events
    window.addEventListener('viewshow', () => scheduleUiUpdate(50));
    window.addEventListener('pageshow', () => scheduleUiUpdate(50));
    window.addEventListener('hashchange', () => scheduleUiUpdate(100));
    window.addEventListener('popstate', () => scheduleUiUpdate(100));

    // Selective MutationObserver (ignores video time ticks, track changes, subtitle mutations)
    const observer = new MutationObserver((mutations) => {
        let shouldSchedule = false;
        for (let i = 0; i < mutations.length; i++) {
            const m = mutations[i];
            if (m.addedNodes.length > 0) {
                for (let j = 0; j < m.addedNodes.length; j++) {
                    const node = m.addedNodes[j];
                    if (node.nodeType === 1) { // Element node
                        // Ignore subtitles or video time slider ticks
                        if (node.classList && (node.classList.contains('osdTimeText') || node.classList.contains('track-text') || node.classList.contains('sliderBubbleText'))) {
                            continue;
                        }
                        if (node.matches && (
                            node.matches('.mainDetailButtons, .detailButtons, .btnUserRating, [is="emby-ratingbutton"], .videoOsd, .osdRightControls, .itemDetailPage') ||
                            node.querySelector?.('.mainDetailButtons, .detailButtons, .btnUserRating, [is="emby-ratingbutton"]')
                        )) {
                            shouldSchedule = true;
                            break;
                        }
                    }
                }
            }
            if (shouldSchedule) break;
        }

        if (shouldSchedule) {
            scheduleUiUpdate(100);
        }
    });

    if (document.body) {
        observer.observe(document.body, { childList: true, subtree: true });
    }

    document.addEventListener('DOMContentLoaded', () => scheduleUiUpdate(0));
    scheduleUiUpdate(0);
})();
