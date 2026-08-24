(function () {
    'use strict';

    const PLUGIN_ID = "f9a4c810-7213-4d43-9821-2e65d8a9b12d";
    let pluginConfig = null;

    console.log('%c[Aquila Plugin] CLIENT SCRIPT LOADED - TAILWIND 1:1 RrMediaEditDialog ACTIVE', 'background: #8b5cf6; color: #ffffff; font-size: 14px; font-weight: bold; padding: 6px 12px; border-radius: 4px;');

    // Inject CSS & Tailwind CDN
    function injectStylesAndTailwind() {
        if (!document.getElementById('aquila-modal-css')) {
            const cssUrl = typeof ApiClient !== 'undefined' && ApiClient.getUrl ? ApiClient.getUrl('Aquila/Modal.css') : '/Aquila/Modal.css';
            const link = document.createElement('link');
            link.id = 'aquila-modal-css';
            link.rel = 'stylesheet';
            link.href = cssUrl;
            document.head.appendChild(link);
        }

        if (!document.getElementById('aquila-tailwind-cdn')) {
            const script = document.createElement('script');
            script.id = 'aquila-tailwind-cdn';
            script.src = 'https://cdn.tailwindcss.com';
            script.onload = () => {
                if (window.tailwind) {
                    window.tailwind.config = {
                        darkMode: 'class',
                        theme: {
                            extend: {
                                colors: {
                                    border: 'var(--border)',
                                    input: 'var(--input)',
                                    ring: 'var(--ring)',
                                    background: 'var(--background)',
                                    foreground: 'var(--foreground)',
                                    primary: {
                                        DEFAULT: 'var(--primary)',
                                        foreground: 'var(--primary-foreground)'
                                    },
                                    secondary: {
                                        DEFAULT: 'var(--secondary)',
                                        foreground: 'var(--secondary-foreground)'
                                    },
                                    destructive: {
                                        DEFAULT: 'var(--destructive)',
                                        foreground: 'var(--destructive-foreground)'
                                    },
                                    muted: {
                                        DEFAULT: 'var(--muted)',
                                        foreground: 'var(--muted-foreground)'
                                    },
                                    card: {
                                        DEFAULT: 'var(--card)',
                                        foreground: 'var(--card-foreground)'
                                    },
                                    popover: {
                                        DEFAULT: 'var(--popover)',
                                        foreground: 'var(--popover-foreground)'
                                    },
                                    accent: {
                                        DEFAULT: 'var(--accent)',
                                        foreground: 'var(--accent-foreground)'
                                    }
                                }
                            }
                        }
                    };
                }
            };
            document.head.appendChild(script);
        }
    }

    const ICONS = {
        aquila: `<img src="https://runerra.org/aquila/aquila-512-left-ring.png" style="width:24px; height:24px; object-fit:contain; display:inline-block; vertical-align:middle;" alt="Aquila" />`,
        sparkles: `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3l1.912 5.813a2 2 0 001.275 1.275L21 12l-5.813 1.912a2 2 0 00-1.275 1.275L12 21l-1.912-5.813a2 2 0 00-1.275-1.275L3 12l5.813-1.912a2 2 0 001.275-1.275L12 3z"/></svg>`,
        heart: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l8.78-8.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>`,
        heartFilled: `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l8.78-8.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>`,
        star: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
        rotateCcw: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 102.13-9.36L1 10"/></svg>`,
        calendar: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
        note: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`,
        link: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>`,
        search: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`,
        check: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>`,
        chevronDown: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>`,
        chevronUp: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="18 15 12 9 6 15"/></svg>`
    };

    const BASE_PROVIDERS = [
        { key: "anilist", name: "AniList", caps: ["ANIME", "MANGA"] },
        { key: "mal", name: "MyAnimeList", caps: ["ANIME", "MANGA"] },
        { key: "kitsu", name: "Kitsu", caps: ["ANIME", "MANGA"] },
        { key: "shikimori", name: "Shikimori", caps: ["ANIME", "MANGA"] },
        { key: "trakt", name: "Trakt", caps: ["TV_SHOWS", "MOVIES"] },
        { key: "tmdb", name: "TMDB", caps: ["TV_SHOWS", "MOVIES"] },
        { key: "simkl", name: "Simkl", caps: ["ANIME", "TV_SHOWS", "MOVIES"] }
    ];

    async function loadConfig() {
        try {
            const config = await ApiClient.getPluginConfiguration(PLUGIN_ID);
            const currentUserId = ApiClient.getCurrentUserId();
            const userConfig = (config.UserConfigs || []).find(u => u.JellyfinUserId === currentUserId) || {};
            pluginConfig = {
                baseUrl: userConfig.AquilaServerUrl || "",
                apiKey: userConfig.ApiKey || "",
                mappings: config.LibraryMappings || []
            };
        } catch (e) {
            console.error('[Aquila Plugin] Failed to load configuration:', e);
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

        return { mediaType, title, targetId, candidateIds };
    }

    function getProxyUrl(path) {
        if (typeof ApiClient !== 'undefined' && ApiClient.getUrl) {
            return ApiClient.getUrl(path);
        }
        return `/${path.replace(/^\//, '')}`;
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

    function createModalContainer() {
        let backdrop = document.getElementById('aquila-modal-backdrop');
        if (backdrop) return backdrop;

        backdrop = document.createElement('div');
        backdrop.id = 'aquila-modal-backdrop';
        backdrop.className = 'dark aquila-modal-backdrop';

        backdrop.innerHTML = `
            <div class="relative flex flex-col gap-0 max-h-[90vh] w-[92vw] max-w-[680px] p-0 overflow-hidden bg-[#0d0e15] border border-white/10 text-foreground shadow-2xl rounded-3xl" id="aquila-modal-card">
                <div id="aquila-modal-content" class="flex flex-col h-full overflow-hidden"></div>
            </div>
        `;

        document.body.appendChild(backdrop);
        backdrop.addEventListener('click', (e) => {
            if (e.target === backdrop) closeModal();
        });

        return backdrop;
    }

    function openModal() {
        injectStylesAndTailwind();
        const backdrop = createModalContainer();
        backdrop.style.display = 'flex';
        setTimeout(() => backdrop.classList.add('aquila-show'), 10);
    }

    function closeModal() {
        const backdrop = document.getElementById('aquila-modal-backdrop');
        if (backdrop) {
            backdrop.classList.remove('aquila-show');
            setTimeout(() => { backdrop.style.display = 'none'; }, 250);
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

    function resolveTitles(item) {
        let primary = "";
        let romaji = "";
        let native = "";

        if (item) {
            if (typeof item.title === 'object' && item.title !== null) {
                primary = item.title.english || item.title.userPreferred || item.title.romaji || item.title.native || "";
                romaji = item.title.romaji || "";
                native = item.title.native || "";
            } else if (typeof item.title === 'string' && item.title.trim()) {
                primary = item.title.trim();
            }

            if (!primary) {
                primary = item.titlePrimary || item.titleEnglish || item.name || "";
            }
            if (!romaji) {
                romaji = item.titleRomaji || item.titleSecondary || item.secondaryTitle || "";
            }
            if (!native) {
                native = item.titleNative || "";
            }
        }

        const displayTitle = primary || romaji || native || "Untitled";
        const subTitle = (romaji && romaji !== displayTitle) ? romaji : ((native && native !== displayTitle) ? native : "");

        return { displayTitle, subTitle, primary, romaji, native };
    }

    function clearLegacyLocalStorageMappings() {
        try {
            const keysToRemove = [];
            for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                if (k && (k.startsWith('aquila_map_') || k.startsWith('aquila_map_type_'))) {
                    keysToRemove.push(k);
                }
            }
            keysToRemove.forEach(k => localStorage.removeItem(k));
        } catch (e) {}
    }

    async function saveServerMapping(userId, targetId, aquilaId, mediaType, displayTitle = "", maxProgress = null) {
        try {
            console.log(`[Aquila Plugin] Persisting mapping to server: targetId=${targetId} -> aquilaId=${aquilaId} (${mediaType})`);
            const proxyUrl = getProxyUrl(`Aquila/Api/Mapping?userId=${encodeURIComponent(userId)}&itemId=${encodeURIComponent(targetId)}&aquilaMediaId=${aquilaId}&mediaType=${encodeURIComponent(mediaType)}`);
            await fetch(proxyUrl, { method: 'POST' });
        } catch (e) {
            console.error('[Aquila Plugin] Failed to persist mapping to server:', e);
        }
    }

    async function addServerMappingEntry(userId, targetId, entry) {
        try {
            console.log(`[Aquila Plugin] Appending entry to mapping: targetId=${targetId} -> aquilaId=${entry.aquilaMediaId}`);
            const proxyUrl = getProxyUrl(`Aquila/Api/Mapping/Entry?userId=${encodeURIComponent(userId)}&itemId=${encodeURIComponent(targetId)}`);
            await fetch(proxyUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(entry)
            });
        } catch (e) {
            console.error('[Aquila Plugin] Failed to append entry to server:', e);
        }
    }

    async function removeServerMappingEntry(userId, targetId, aquilaId) {
        try {
            console.log(`[Aquila Plugin] Removing entry from mapping: targetId=${targetId} -> aquilaId=${aquilaId}`);
            const proxyUrl = getProxyUrl(`Aquila/Api/Mapping/Entry?userId=${encodeURIComponent(userId)}&itemId=${encodeURIComponent(targetId)}&aquilaMediaId=${aquilaId}`);
            await fetch(proxyUrl, { method: 'DELETE' });
        } catch (e) {
            console.error('[Aquila Plugin] Failed to remove entry from server:', e);
        }
    }

    async function reorderServerMappingEntries(userId, targetId, idsInOrder) {
        try {
            console.log(`[Aquila Plugin] Reordering mapping entries: targetId=${targetId} -> order=[${idsInOrder.join(', ')}]`);
            const proxyUrl = getProxyUrl(`Aquila/Api/Mapping/Reorder?userId=${encodeURIComponent(userId)}&itemId=${encodeURIComponent(targetId)}`);
            await fetch(proxyUrl, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(idsInOrder)
            });
        } catch (e) {
            console.error('[Aquila Plugin] Failed to reorder entries on server:', e);
        }
    }

    async function handleAquilaButtonClick(itemId) {
        openModal();
        const content = document.getElementById('aquila-modal-content');
        content.innerHTML = '<div class="text-center p-12 text-muted-foreground font-semibold">Loading Aquila Media Data...</div>';

        if (!pluginConfig) await loadConfig();

        try {
            const currentUserId = ApiClient.getCurrentUserId();
            const item = await ApiClient.getItem(currentUserId, itemId);
            const { mediaType: defaultMediaType, title, targetId, candidateIds } = getItemDetails(item);

            let savedAquilaId = null;
            let activeMediaType = defaultMediaType;

            try {
                const candParam = (candidateIds && candidateIds.length > 0) ? `&candidateIds=${encodeURIComponent(candidateIds.join(','))}` : '';
                const mapRes = await fetch(getProxyUrl(`Aquila/Api/Mapping?userId=${encodeURIComponent(currentUserId || '')}&itemId=${encodeURIComponent(targetId)}${candParam}`));
                if (mapRes.ok) {
                    const mapData = await mapRes.json();
                    if (mapData && mapData.aquilaMediaId) {
                        savedAquilaId = mapData.aquilaMediaId.toString();
                        if (mapData.mediaType) {
                            activeMediaType = mapData.mediaType;
                        }
                    }
                }
            } catch (e) {
                console.warn('[Aquila Plugin] Error fetching server mapping:', e);
            }

            if (savedAquilaId) {
                renderFullEditDialog(currentUserId, targetId, activeMediaType, parseInt(savedAquilaId, 10), title, candidateIds);
            } else {
                renderSearchView(currentUserId, targetId, activeMediaType, title, candidateIds);
            }
        } catch (err) {
            console.error('[Aquila Plugin] Item fetch error:', err);
            content.innerHTML = `<div class="text-center p-8 text-destructive">Failed to load item details from Jellyfin server.</div>`;
        }
    }

    // Search View to Link Aquila Title
    async function renderSearchView(userId, targetId, initialMediaType, defaultTitle, candidateIds = [], isAppendMode = false) {
        let currentSearchType = (initialMediaType && initialMediaType !== 'manga') ? initialMediaType : "tv";
        const content = document.getElementById('aquila-modal-content');

        content.innerHTML = `
            <div class="p-6 flex flex-col gap-4">
                <div class="flex justify-between items-center">
                    <h3 class="m-0 text-lg font-bold text-foreground">${isAppendMode ? 'Add Linked Season / Entry' : 'Link Media to Aquila'}</h3>
                    <button class="text-muted-foreground hover:text-foreground text-xl font-bold bg-transparent border-0 cursor-pointer" id="aquila-modal-close-btn">&times;</button>
                </div>
                <p class="m-0 text-muted-foreground text-xs">${isAppendMode ? 'Search and select an additional season or entry to append to this media link sequence.' : 'This title is not linked to an Aquila Realm entry yet. Search and select a title below to link it.'}</p>


                <!-- Media Type Tabs -->
                <div class="flex items-center gap-2" id="aquila-search-type-pills">
                    <button class="px-3.5 py-1.5 text-xs font-bold rounded-xl cursor-pointer transition-colors ${currentSearchType === 'anime' ? 'bg-primary text-primary-foreground shadow-xs' : 'bg-muted/60 text-muted-foreground hover:text-foreground'}" data-type="anime">Anime</button>
                    <button class="px-3.5 py-1.5 text-xs font-bold rounded-xl cursor-pointer transition-colors ${currentSearchType === 'tv' ? 'bg-primary text-primary-foreground shadow-xs' : 'bg-muted/60 text-muted-foreground hover:text-foreground'}" data-type="tv">TV Shows</button>
                    <button class="px-3.5 py-1.5 text-xs font-bold rounded-xl cursor-pointer transition-colors ${currentSearchType === 'movie' ? 'bg-primary text-primary-foreground shadow-xs' : 'bg-muted/60 text-muted-foreground hover:text-foreground'}" data-type="movie">Movies</button>
                </div>

                <div class="flex gap-2.5">
                    <input type="text" id="aquila-search-input" class="w-full px-3.5 py-2 bg-background/80 border border-border/70 text-foreground rounded-xl text-xs font-semibold" value="${(defaultTitle || '').replace(/"/g, '&quot;')}" placeholder="Search title..." />
                    <button class="bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-5 rounded-xl text-xs cursor-pointer shadow-md shadow-primary/20" id="aquila-search-btn">Search</button>
                </div>
                <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 max-h-[420px] overflow-y-auto pr-1" id="aquila-search-results">
                    <div class="col-span-full text-center p-8 text-muted-foreground text-xs">Searching API database...</div>
                </div>
            </div>
        `;

        document.getElementById('aquila-modal-close-btn').addEventListener('click', closeModal);
        const searchInput = document.getElementById('aquila-search-input');
        const searchBtn = document.getElementById('aquila-search-btn');

        // Type pills listener
        document.querySelectorAll('#aquila-search-type-pills button').forEach(pill => {
            pill.addEventListener('click', () => {
                currentSearchType = pill.getAttribute('data-type');
                document.querySelectorAll('#aquila-search-type-pills button').forEach(p => {
                    if (p.getAttribute('data-type') === currentSearchType) {
                        p.className = 'px-3.5 py-1.5 text-xs font-bold rounded-xl cursor-pointer transition-colors bg-primary text-primary-foreground shadow-xs';
                    } else {
                        p.className = 'px-3.5 py-1.5 text-xs font-bold rounded-xl cursor-pointer transition-colors bg-muted/60 text-muted-foreground hover:text-foreground';
                    }
                });
                doSearch();
            });
        });

        const fetchSearchResults = async (type, q) => {
            try {
                const proxyUrl = getProxyUrl(`Aquila/Api/Search?mediaType=${encodeURIComponent(type)}&query=${encodeURIComponent(q)}&userId=${encodeURIComponent(userId || '')}`);
                const res = await fetch(proxyUrl);
                if (res.ok) {
                    const items = await res.json();
                    if (Array.isArray(items)) {
                        return items.map(item => ({ ...item, resolvedType: type }));
                    }
                }
            } catch (e) {}
            return [];
        };

        const doSearch = async () => {
            const rawQuery = searchInput.value.trim();
            if (!rawQuery) return;

            const resultsContainer = document.getElementById('aquila-search-results');
            resultsContainer.innerHTML = '<div class="col-span-full text-center p-8 text-muted-foreground text-xs">Searching API database...</div>';

            const cleanQuery = rawQuery
                .replace(/\s*\([^)]*\)/g, '')
                .replace(/\s*\[[^\]]*\]/g, '')
                .replace(/\s*-\s*Season\s*\d+/gi, '')
                .replace(/\s*Season\s*\d+/gi, '')
                .replace(/\s*S\d+$/gi, '')
                .trim();

            // 1. Try selected media type with exact query
            let items = await fetchSearchResults(currentSearchType, rawQuery);

            // 2. Try selected media type with cleaned query if exact returned 0
            if (items.length === 0 && cleanQuery && cleanQuery !== rawQuery) {
                items = await fetchSearchResults(currentSearchType, cleanQuery);
            }

            // 3. Fallback to alternative media types if still 0
            if (items.length === 0) {
                const fallbackTypes = ['anime', 'tv', 'movie'].filter(t => t !== currentSearchType);
                for (const fbType of fallbackTypes) {
                    items = await fetchSearchResults(fbType, rawQuery);
                    if (items.length === 0 && cleanQuery && cleanQuery !== rawQuery) {
                        items = await fetchSearchResults(fbType, cleanQuery);
                    }
                    if (items.length > 0) break;
                }
            }

            if (!Array.isArray(items) || items.length === 0) {
                resultsContainer.innerHTML = '<div class="col-span-full text-center p-8 text-muted-foreground text-xs">No matching titles found on Aquila server.</div>';
                return;
            }

            resultsContainer.innerHTML = items.map(item => {
                const { displayTitle, subTitle } = resolveTitles(item);
                const itemType = item.resolvedType || currentSearchType;
                const cover = item.coverImage || item.image || (typeof item.coverImage === 'object' ? item.coverImage?.large : '') || 'https://via.placeholder.com/150x225?text=No+Cover';
                const epCount = item.episodes || item.episodeCount;

                return `
                    <div class="bg-card/40 border border-border/60 rounded-2xl overflow-hidden cursor-pointer hover:border-primary hover:shadow-lg hover:shadow-primary/10 transition-all flex flex-col h-full group aquila-search-card" data-id="${item.id}" data-type="${itemType}" data-title="${(displayTitle).replace(/"/g, '&quot;')}">
                        <div class="relative w-full aspect-[2/3] bg-muted overflow-hidden">
                            <img src="${cover}" alt="${displayTitle}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                            <span class="absolute top-1.5 right-1.5 uppercase text-[9px] font-extrabold bg-background/90 backdrop-blur-md px-2 py-0.5 rounded-lg text-primary border border-border/60 shadow-xs">${itemType}</span>
                        </div>
                        <div class="p-3 flex flex-col justify-between flex-1 gap-1 text-left">
                            <div class="font-bold text-xs leading-snug text-foreground break-words group-hover:text-primary transition-colors">
                                ${displayTitle}
                            </div>
                            ${subTitle ? `<div class="text-[10px] text-muted-foreground/80 line-clamp-2 leading-tight break-words font-normal">${subTitle}</div>` : ''}
                            ${epCount ? `<div class="text-[10px] text-muted-foreground/60 font-medium mt-1">${epCount} Ep</div>` : ''}
                        </div>
                    </div>
                `;
            }).join('');

            document.querySelectorAll('.aquila-search-card').forEach(card => {
                card.addEventListener('click', async () => {
                    const aquilaId = parseInt(card.getAttribute('data-id'), 10);
                    const cardTitle = card.getAttribute('data-title');
                    const itemType = card.getAttribute('data-type') || currentSearchType;
                    if (isAppendMode) {
                        await addServerMappingEntry(userId, targetId, { aquilaMediaId: aquilaId, mediaType: itemType, displayTitle: cardTitle });
                    } else {
                        await saveServerMapping(userId, targetId, aquilaId, itemType, cardTitle);
                    }
                    renderFullEditDialog(userId, targetId, itemType, aquilaId, cardTitle, candidateIds);
                });
            });
        };

        searchBtn.addEventListener('click', doSearch);
        searchInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') doSearch(); });
        doSearch();
    }

    // Full 1:1 RrMediaEditDialog Implementation
    async function renderFullEditDialog(userId, targetId, mediaType, aquilaId, fallbackTitle, candidateIds = []) {
        console.group('[Aquila Plugin] [RENDER FULL EDIT DIALOG]');
        console.log('[Aquila Plugin] Init params:', { userId, targetId, mediaType, aquilaId, fallbackTitle, candidateIds });

        const content = document.getElementById('aquila-modal-content');
        content.innerHTML = '<div class="text-center p-16 text-muted-foreground font-semibold">Loading media details & entry...</div>';

        let mediaDetails = null;
        let isFavorited = false;
        let listEntry = null;
        let userConnectionsList = [];
        let currentMapping = null;

        const capParam = mediaType === "tv" ? "TV_SHOWS" : mediaType === "movie" ? "MOVIES" : mediaType.toUpperCase();

        try {
            console.log('[Aquila Plugin] Fetching parallel data from Aquila proxy endpoints...');
            const [detRes, favRes, entryRes, connRes, mapRes] = await Promise.all([
                fetch(getProxyUrl(`Aquila/Api/Details?mediaType=${encodeURIComponent(mediaType)}&id=${aquilaId}`)).catch(e => { console.error('[Aquila Plugin] Details fetch error:', e); return null; }),
                fetch(getProxyUrl(`Aquila/Api/FavoriteStatus?mediaType=${encodeURIComponent(mediaType)}&id=${aquilaId}`)).catch(e => { console.error('[Aquila Plugin] FavoriteStatus fetch error:', e); return null; }),
                fetch(getProxyUrl(`Aquila/Api/Entry?mediaType=${encodeURIComponent(mediaType)}&id=${aquilaId}`)).catch(e => { console.error('[Aquila Plugin] Entry fetch error:', e); return null; }),
                fetch(getProxyUrl(`Aquila/Api/Connections?capabilities=${encodeURIComponent(capParam)}`)).catch(e => { console.error('[Aquila Plugin] Connections fetch error:', e); return null; }),
                fetch(getProxyUrl(`Aquila/Api/Mapping?userId=${encodeURIComponent(userId || '')}&itemId=${encodeURIComponent(targetId)}`)).catch(e => { console.error('[Aquila Plugin] Mapping fetch error:', e); return null; })
            ]);

            if (detRes && detRes.ok) {
                mediaDetails = await detRes.json();
                console.log('[Aquila Plugin] Loaded Media Details:', mediaDetails);
            }
            if (favRes && favRes.ok) {
                const favData = await favRes.json();
                isFavorited = Boolean(favData.favorited);
                console.log('[Aquila Plugin] Favorite Status:', isFavorited);
            }
            if (entryRes && entryRes.ok) {
                listEntry = await entryRes.json();
                console.log('[Aquila Plugin] Loaded User List Entry:', listEntry);
            }
            if (connRes && connRes.ok) {
                const connData = await connRes.json();
                console.log('[Aquila Plugin] Raw Active User Connections Response:', connData);
                if (Array.isArray(connData)) {
                    userConnectionsList = connData.map((c) => (c.provider || c.name || "").toLowerCase());
                }
                console.log('[Aquila Plugin] Parsed User Connections List:', userConnectionsList);
            }
            if (mapRes && mapRes.ok) {
                currentMapping = await mapRes.json();
                console.log('[Aquila Plugin] Loaded Server Mapping for Item:', currentMapping);
            }
        } catch (e) {
            console.warn('[Aquila Plugin] Error during parallel data fetch:', e);
        }

        let jellyfinSeasons = [];
        let seasonMappings = {};
        if (typeof ApiClient !== 'undefined' && ApiClient.getItems) {
            try {
                const sRes = await ApiClient.getItems(userId, { parentId: targetId, includeItemTypes: "Season", sortBy: "SortName" });
                if (sRes && Array.isArray(sRes.Items) && sRes.Items.length > 0) {
                    jellyfinSeasons = sRes.Items;
                    console.log('[Aquila Plugin] [SEASONS] Found Jellyfin seasons for targetId=', targetId, jellyfinSeasons);
                    await Promise.all(jellyfinSeasons.map(async (s) => {
                        try {
                            const mRes = await fetch(getProxyUrl(`Aquila/Api/Mapping?userId=${encodeURIComponent(userId || '')}&itemId=${encodeURIComponent(s.Id)}`));
                            if (mRes.ok) {
                                const mData = await mRes.json();
                                if (mData && mData.aquilaMediaId) {
                                    let displayTitle = mData.displayTitle || (mData.entries && mData.entries[0]?.displayTitle);
                                    const sType = mData.mediaType || mediaType;
                                    if (!displayTitle) {
                                        try {
                                            const dRes = await fetch(getProxyUrl(`Aquila/Api/Details?mediaType=${encodeURIComponent(sType)}&id=${mData.aquilaMediaId}`));
                                            if (dRes.ok) {
                                                const dData = await dRes.json();
                                                const rawT = dData || {};
                                                displayTitle = (typeof rawT.title === 'object' && rawT.title !== null)
                                                    ? (rawT.title.english || rawT.title.romaji || rawT.titlePrimary || s.Name)
                                                    : (rawT.title || rawT.titlePrimary || s.Name);
                                            }
                                        } catch (e) {
                                            // fallback
                                        }
                                    }
                                    mData.resolvedTitle = displayTitle || `Aquila #${mData.aquilaMediaId}`;
                                    seasonMappings[s.Id] = mData;
                                    console.log(`[Aquila Plugin] [SEASONS] Found mapping for season '${s.Name}' (${s.Id}):`, mData);
                                }
                            }
                        } catch (err) {
                            // unmapped season
                        }
                    }));
                }
            } catch (e) {
                console.warn('[Aquila Plugin] Failed to fetch Jellyfin seasons:', e);
            }
        }

        const rawMedia = mediaDetails || { id: aquilaId, type: mediaType, title: fallbackTitle };
        const titleText = (typeof rawMedia.title === 'object' && rawMedia.title !== null)
            ? (rawMedia.title.english || rawMedia.title.romaji || rawMedia.titlePrimary || fallbackTitle)
            : (rawMedia.title || rawMedia.titlePrimary || fallbackTitle);

        const coverImageLarge = (typeof rawMedia.coverImage === 'object' && rawMedia.coverImage !== null)
            ? rawMedia.coverImage.large
            : (typeof rawMedia.coverImage === 'string' ? rawMedia.coverImage : rawMedia.coverImageLarge || '');

        const bannerImage = rawMedia.bannerImage || rawMedia.banner || '';

        let hasListEntry = Boolean(listEntry);
        let listStatus = listEntry?.status || "PLANNING";
        let score = listEntry?.score ? listEntry.score.toString() : "";
        let progress = listEntry?.progress !== undefined ? listEntry.progress.toString() : "";
        let rewatches = listEntry?.rewatched !== undefined ? listEntry.rewatched.toString() : "0";
        let notes = listEntry?.notes || "";
        let startDateStr = formatDateInput(listEntry?.startDate);
        let finishDateStr = formatDateInput(listEntry?.endDate);
        let watchedEpisodes = listEntry?.watchedEpisodes || [];
        let connections = listEntry?.connections || {};
        let updateConnection = Object.keys(connections).length > 0;

        // Dates leave empty unless user specified
        const scoreMax = 10;
        const totalEpisodes = rawMedia.episodeCount || (Array.isArray(rawMedia.episodes) ? rawMedia.episodes.length : undefined);

        let seasons = rawMedia.seasons || [];
        if (Array.isArray(rawMedia.seasons) && Array.isArray(rawMedia.episodes)) {
            seasons = rawMedia.seasons.map((s) => ({
                ...s,
                number: s.seasonNumber ?? s.number,
                name: s.titlePrimary ?? s.name,
                episodeCount: s.episodeCount ?? (rawMedia.episodes.filter((ep) => ep.seasonNumber === (s.seasonNumber ?? s.number)).length),
                episodes: rawMedia.episodes
                    .filter((ep) => ep.seasonNumber === (s.seasonNumber ?? s.number))
                    .map((ep) => ({
                        id: ep.id,
                        number: ep.episodeNumber ?? ep.number,
                        name: ep.titlePrimary ?? ep.name
                    }))
            }));
        }

        console.log('[Aquila Plugin] Modal State ready:', { titleText, listStatus, progress, startDateStr, finishDateStr, userConnectionsList, hasListEntry });
        console.groupEnd();

        content.innerHTML = `
            <!-- Header Banner Section (1:1 RrMediaEditDialogHeader) -->
            <div class="relative h-44 sm:h-52 w-full overflow-hidden bg-muted shrink-0">
                ${bannerImage ? `<img src="${bannerImage}" class="w-full h-full object-cover transition-opacity" />` : `<div class="w-full h-full bg-muted"></div>`}
                <div class="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent"></div>
                <button id="aquila-modal-close" class="absolute top-3 right-3 z-30 p-2 text-muted-foreground hover:text-foreground text-xl font-bold bg-background/40 backdrop-blur-md rounded-full cursor-pointer transition-colors">&times;</button>
                <div class="absolute bottom-4 left-4 right-4 sm:left-6 sm:right-6 flex items-end gap-3 sm:gap-5 z-10">
                    <div class="relative shrink-0">
                        ${coverImageLarge ? `<img src="${coverImageLarge}" class="relative w-20 sm:w-24 aspect-2/3 rounded-2xl shadow-lg object-cover bg-background border border-border shrink-0" style="width:88px !important; height:132px !important; object-fit:cover !important;" />` : `<div class="relative w-20 sm:w-24 aspect-2/3 rounded-2xl shadow-lg bg-muted border border-border overflow-hidden flex items-center justify-center shrink-0"></div>`}
                    </div>
                    <div class="flex-1 min-w-0 pb-1 flex flex-col gap-1.5">
                        <div class="flex items-center gap-2 flex-wrap">
                            <span class="inline-flex items-center gap-1 uppercase text-[9px] font-extrabold tracking-wider bg-primary/10 text-primary border border-primary/25 rounded-full px-2.5 py-0.5 shadow-xs">
                                ${ICONS.sparkles} ${mediaType}
                            </span>
                        </div>
                        <h2 class="text-base sm:text-xl font-bold tracking-tight line-clamp-2 text-foreground drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                            ${titleText}
                        </h2>
                    </div>
                    <div class="pb-1 flex gap-2 sm:gap-3 items-center shrink-0">
                        <button id="aquila-fav-btn" class="size-10 rounded-xl flex items-center justify-center border transition-all cursor-pointer shadow-xs ${isFavorited ? 'bg-destructive/15 border-destructive/30 text-destructive shadow-destructive/10' : 'bg-background/80 border-border/60 text-muted-foreground hover:text-foreground hover:bg-muted/60'}">
                            ${isFavorited ? ICONS.heartFilled : ICONS.heart}
                        </button>
                        <button id="aquila-save-btn" class="bg-primary hover:bg-primary/90 text-primary-foreground shadow-md shadow-primary/20 font-bold px-4 sm:px-6 rounded-xl cursor-pointer h-10 text-xs sm:text-sm">
                            Save
                        </button>
                    </div>
                </div>
            </div>

            <!-- Body -->
            <div class="p-5 sm:p-6 pt-4 bg-transparent flex-1 flex flex-col gap-4 overflow-y-auto no-scrollbar" id="aquila-modal-body-container">
                ${mediaType === 'tv' ? `
                    <div class="bg-muted/60 backdrop-blur-xs p-1 rounded-xl w-full sm:w-fit grid grid-cols-2 border border-border/60 shadow-xs">
                        <button class="rounded-lg text-xs font-bold transition-all p-2 cursor-pointer text-primary bg-background shadow-xs" id="tab-btn-general">General</button>
                        <button class="rounded-lg text-xs font-bold transition-all p-2 cursor-pointer text-muted-foreground hover:text-foreground" id="tab-btn-episodes">Episodes (${watchedEpisodes.length}/${seasons.reduce((acc, s) => acc + (s.episodeCount || 0), 0)})</button>
                    </div>
                ` : ''}

                <!-- General Tab Pane -->
                <div id="tab-pane-general" class="flex flex-col gap-4">
                    <div class="bg-card/40 border border-border/60 backdrop-blur-xs rounded-2xl p-4 sm:p-5 flex flex-col gap-4 shadow-xs">
                        <div class="grid grid-cols-1 sm:grid-cols-6 gap-4">
                            <!-- Status -->
                            <div class="sm:col-span-2 flex flex-col gap-1.5">
                                <label class="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 px-0.5">Status</label>
                                <select id="aquila-status-select" class="w-full bg-background/80 border border-border/70 text-foreground h-10 px-3 text-xs font-medium hover:bg-muted/50 rounded-xl transition-all cursor-pointer shadow-xs">
                                    ${getStatusOptions(mediaType).map(opt => `<option value="${opt.value}" ${listStatus === opt.value ? 'selected' : ''}>${opt.label}</option>`).join('')}
                                </select>
                            </div>

                            <!-- Score -->
                            <div class="sm:col-span-2 flex flex-col gap-1.5">
                                <label class="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 px-0.5">
                                    ${ICONS.star} Score <span class="text-[10px] text-muted-foreground/60 font-normal lowercase">(0 - ${scoreMax})</span>
                                </label>
                                <input type="number" id="aquila-score-input" min="0" max="${scoreMax}" step="0.1" value="${score}" placeholder="0 - ${scoreMax}" class="bg-background/80 border border-border/70 text-foreground h-10 px-3 text-xs font-semibold rounded-xl" />
                            </div>

                            <!-- Rewatches -->
                            <div class="sm:col-span-2 flex flex-col gap-1.5">
                                <label class="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 px-0.5">
                                    ${ICONS.rotateCcw} Total Rewatches
                                </label>
                                <input type="number" id="aquila-rewatches-input" min="0" value="${rewatches}" class="bg-background/80 border border-border/70 text-foreground h-10 px-3 text-xs font-semibold rounded-xl" />
                            </div>

                            <!-- Progress (Anime) -->
                            ${mediaType === 'anime' ? `
                                <div class="sm:col-span-2 flex flex-col gap-1.5">
                                    <label class="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 px-0.5">Episode Progress</label>
                                    <input type="number" id="aquila-progress-input" min="0" max="${totalEpisodes || ''}" value="${progress}" placeholder="0 / ${totalEpisodes || '?'}" class="bg-background/80 border border-border/70 text-foreground h-10 px-3 text-xs font-semibold rounded-xl" />
                                </div>
                            ` : ''}
                        </div>

                        <!-- Dates -->
                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-border/40 pt-3.5">
                            <div class="flex flex-col gap-1.5">
                                <label class="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 px-0.5">
                                    ${ICONS.calendar} Start Date
                                </label>
                                <input type="date" id="aquila-start-date" value="${startDateStr}" class="bg-background/80 border border-border/70 text-foreground h-10 px-3 text-xs font-medium rounded-xl" />
                            </div>
                            <div class="flex flex-col gap-1.5">
                                <label class="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 px-0.5">
                                    ${ICONS.calendar} Finish Date
                                </label>
                                <input type="date" id="aquila-finish-date" value="${finishDateStr}" class="bg-background/80 border border-border/70 text-foreground h-10 px-3 text-xs font-medium rounded-xl" />
                            </div>
                        </div>
                    </div>

                    <!-- Jellyfin Seasons & Mapped Media Section Card -->
                    ${jellyfinSeasons.length > 0 ? `
                        <div class="bg-card/40 border border-border/60 backdrop-blur-xs rounded-2xl p-4 sm:p-5 flex flex-col gap-3 shadow-xs">
                            <div class="flex items-center justify-between">
                                <label class="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 px-0.5">
                                    ${ICONS.link} Seasons & Linked Aquila Media
                                </label>
                                <span class="text-[10px] text-muted-foreground font-semibold bg-muted px-2 py-0.5 rounded-lg">${jellyfinSeasons.length} Seasons</span>
                            </div>
                            <div class="flex flex-col gap-2 max-h-[260px] overflow-y-auto pr-1">
                                ${jellyfinSeasons.map(s => {
                                    const sMap = seasonMappings[s.Id];
                                    const isMapped = Boolean(sMap && sMap.aquilaMediaId);
                                    const sAquilaId = sMap?.aquilaMediaId;
                                    const sTitle = sMap?.resolvedTitle || sMap?.displayTitle || (sMap ? `Aquila #${sAquilaId}` : 'Unlinked');
                                    const sType = sMap?.mediaType || mediaType;
                                    const safeName = (s.Name || 'Season').replace(/'/g, "\\'");
                                    return `
                                        <div class="flex items-center justify-between bg-background/80 border border-border/60 rounded-xl p-2.5 px-3 text-xs shrink-0">
                                            <div class="flex items-center gap-2 min-w-0">
                                                <span class="font-extrabold text-[10px] text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-lg shrink-0">${s.Name}</span>
                                                ${isMapped ? `
                                                    <span class="font-bold text-foreground truncate max-w-[160px] sm:max-w-[260px]">${sTitle}</span>
                                                    <span class="font-mono text-[10px] text-muted-foreground font-semibold shrink-0">#${sAquilaId}</span>
                                                ` : `
                                                    <span class="text-muted-foreground/70 italic text-[11px]">Unlinked (not mapped)</span>
                                                `}
                                            </div>
                                            <div class="flex items-center gap-1 shrink-0">
                                                ${isMapped ? `
                                                    <button class="p-1.5 text-primary hover:bg-primary/15 rounded-lg cursor-pointer text-xs font-bold flex items-center justify-center" title="Edit this season's Aquila media" onclick="window.aquilaEditSeasonMedia('${s.Id}', '${sType}', ${sAquilaId}, '${safeName}')">✏️ Edit</button>
                                                    <button class="p-1 text-destructive hover:bg-destructive/15 rounded-lg cursor-pointer text-xs font-semibold" title="Unlink this season" onclick="window.aquilaUnlinkSeasonMedia('${s.Id}')">Unlink</button>
                                                ` : `
                                                    <button class="bg-primary/10 hover:bg-primary/20 text-primary border border-primary/25 text-[11px] font-bold px-2.5 py-1 rounded-xl cursor-pointer transition-all" onclick="window.aquilaLinkSeasonMedia('${s.Id}', '${safeName}')">+ Link Media</button>
                                                `}
                                            </div>
                                        </div>
                                    `;
                                }).join('')}
                            </div>
                        </div>
                    ` : ''}

                    <!-- Notes Section Card -->
                    <div class="bg-card/40 border border-border/60 backdrop-blur-xs rounded-2xl p-4 sm:p-5 flex flex-col gap-2 shadow-xs">
                        <label class="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 px-0.5">
                            ${ICONS.note} Personal Notes
                        </label>
                        <textarea id="aquila-notes-input" placeholder="Add personal notes..." class="bg-background/80 border border-border/70 text-foreground min-h-24 resize-y rounded-xl p-3 text-xs font-medium">${notes}</textarea>
                    </div>

                    <!-- Connections Section Card -->
                    <div class="bg-card/40 border border-border/60 backdrop-blur-xs rounded-2xl p-4 sm:p-5 flex flex-col gap-3 shadow-xs">
                        <div class="flex items-center gap-2">
                            <input type="checkbox" id="aquila-update-connection" ${updateConnection ? 'checked' : ''} class="border-border accent-purple-500 cursor-pointer" />
                            <label for="aquila-update-connection" class="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 cursor-pointer select-none">
                                ${ICONS.link} Update list from connection
                            </label>
                        </div>

                        <div id="aquila-connections-container" class="${updateConnection ? 'block' : 'hidden'}">
                            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1 w-full" id="aquila-connections-grid">
                                <!-- Populated dynamically -->
                            </div>
                        </div>
                    </div>

                    <!-- Footer Action Buttons -->
                    <div class="mt-2 flex justify-between items-center gap-2 flex-wrap">
                        <button class="bg-transparent hover:bg-destructive/15 text-destructive border border-destructive/30 hover:border-destructive/50 text-xs font-semibold rounded-xl cursor-pointer px-4 h-9 transition-colors shadow-xs" id="aquila-unlink-mapping-btn">Unlink Title</button>
                        ${hasListEntry ? `
                            <button class="bg-transparent hover:bg-destructive hover:text-destructive-foreground border border-border/60 hover:border-destructive/50 text-muted-foreground text-xs font-semibold rounded-xl cursor-pointer px-4 h-9 transition-colors shadow-xs" id="aquila-delete-entry-btn">Delete Entry</button>
                        ` : ''}
                    </div>
                </div>

                <!-- Episodes Tab Pane (TV Shows) -->
                ${mediaType === 'tv' ? `
                    <div id="tab-pane-episodes" class="hidden flex-col gap-3">
                        <div class="max-h-100 overflow-y-auto pr-1 flex flex-col gap-2.5 w-full" id="aquila-seasons-list">
                            <!-- Populated dynamically -->
                        </div>
                    </div>
                ` : ''}
            </div>

            <!-- Search Modal Overlay (for Connections) -->
            <div class="absolute inset-0 bg-background/95 backdrop-blur-2xl z-50 p-6 flex flex-col gap-3 rounded-3xl hidden" id="aquila-conn-search-modal">
                <div class="flex items-center justify-between">
                    <h4 class="text-sm font-bold uppercase tracking-wider text-muted-foreground" id="aquila-search-modal-title">Search Connection</h4>
                    <button class="bg-transparent hover:bg-muted border border-border/60 text-foreground text-xs font-bold rounded-xl cursor-pointer h-8 px-3" id="aquila-conn-search-close">&times;</button>
                </div>
                <div class="flex gap-2">
                    <input type="text" id="aquila-conn-search-input" class="w-full bg-background/80 border border-border/70 text-foreground h-9 px-3 text-xs font-medium rounded-xl" value="${titleText}" />
                    <button class="bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-4 rounded-xl text-xs cursor-pointer" id="aquila-conn-search-btn">Search</button>
                </div>
                <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 max-h-[350px] overflow-y-auto mt-2" id="aquila-conn-search-results"></div>
            </div>

            <!-- Confirm Delete Dialog Box -->
            <div class="absolute inset-0 bg-background/80 backdrop-blur-md z-50 flex items-center justify-center p-4 hidden" id="aquila-confirm-dialog">
                <div class="bg-background/95 border border-border/60 rounded-2xl p-6 max-w-sm w-full shadow-2xl flex flex-col gap-4">
                    <h4 class="text-sm font-bold uppercase tracking-wider text-muted-foreground m-0">Confirm Deletion</h4>
                    <p class="text-xs text-muted-foreground/80 m-0">Are you sure you want to remove this ${mediaType} from your list?</p>
                    <div class="flex justify-end gap-2 mt-2">
                        <button class="bg-transparent hover:bg-muted border border-border/60 text-foreground text-xs font-bold rounded-xl cursor-pointer h-9 px-4" id="aquila-confirm-cancel">Cancel</button>
                        <button class="bg-destructive text-destructive-foreground hover:bg-destructive/95 text-xs font-bold rounded-xl cursor-pointer h-9 px-4" id="aquila-confirm-delete">Delete</button>
                    </div>
                </div>
            </div>
        `;

        document.getElementById('aquila-modal-close').addEventListener('click', closeModal);

        // Favorite Toggle
        const favBtn = document.getElementById('aquila-fav-btn');
        favBtn.addEventListener('click', async () => {
            const nextState = !isFavorited;
            isFavorited = nextState;
            favBtn.className = `size-10 rounded-xl flex items-center justify-center border transition-all cursor-pointer shadow-xs ${isFavorited ? 'bg-destructive/15 border-destructive/30 text-destructive shadow-destructive/10' : 'bg-background/80 border-border/60 text-muted-foreground hover:text-foreground hover:bg-muted/60'}`;
            favBtn.innerHTML = isFavorited ? ICONS.heartFilled : ICONS.heart;
            console.log('[Aquila Plugin] [FAVORITE TOGGLE] Next state:', nextState, 'Aquila ID:', aquilaId);

            try {
                if (nextState) {
                    await fetch(getProxyUrl(`Aquila/Api/Favorite?type=${encodeURIComponent(mediaType)}&targetId=${aquilaId}`), { method: 'POST' });
                } else {
                    await fetch(getProxyUrl(`Aquila/Api/Favorite?mediaType=${encodeURIComponent(mediaType)}&id=${aquilaId}`), { method: 'DELETE' });
                }
            } catch (e) {
                console.error('[Aquila Plugin] Failed to toggle favorite:', e);
            }
        });

        // Tab Switching (TV Shows)
        if (mediaType === 'tv') {
            const tabGenBtn = document.getElementById('tab-btn-general');
            const tabEpsBtn = document.getElementById('tab-btn-episodes');
            const paneGen = document.getElementById('tab-pane-general');
            const paneEps = document.getElementById('tab-pane-episodes');

            tabGenBtn.addEventListener('click', () => {
                tabGenBtn.className = "rounded-lg text-xs font-bold transition-all p-2 cursor-pointer text-primary bg-background shadow-xs";
                tabEpsBtn.className = "rounded-lg text-xs font-bold transition-all p-2 cursor-pointer text-muted-foreground hover:text-foreground";
                paneGen.classList.remove('hidden');
                paneGen.classList.add('flex');
                paneEps.classList.add('hidden');
                paneEps.classList.remove('flex');
            });

            tabEpsBtn.addEventListener('click', () => {
                tabEpsBtn.className = "rounded-lg text-xs font-bold transition-all p-2 cursor-pointer text-primary bg-background shadow-xs";
                tabGenBtn.className = "rounded-lg text-xs font-bold transition-all p-2 cursor-pointer text-muted-foreground hover:text-foreground";
                paneEps.classList.remove('hidden');
                paneEps.classList.add('flex');
                paneGen.classList.add('hidden');
                paneGen.classList.remove('flex');
                renderTvEpisodesList();
            });
        }

        window.aquilaLinkSeasonMedia = (seasonId, seasonName) => {
            console.log('[Aquila Plugin] [LINK SEASON MEDIA] Opening search for seasonId:', seasonId, 'Name:', seasonName);
            renderSearchView(userId, seasonId, mediaType, `${titleText} ${seasonName}`, candidateIds);
        };

        window.aquilaEditSeasonMedia = (seasonId, sType, sAquilaId, seasonName) => {
            console.log('[Aquila Plugin] [EDIT SEASON MEDIA] Editing Aquila ID:', sAquilaId, 'for seasonId:', seasonId);
            renderFullEditDialog(userId, seasonId, sType, sAquilaId, `${titleText} ${seasonName}`, candidateIds);
        };

        window.aquilaUnlinkSeasonMedia = async (seasonId) => {
            console.log('[Aquila Plugin] [UNLINK SEASON MEDIA] Unlinking seasonId:', seasonId);
            try {
                await fetch(getProxyUrl(`Aquila/Api/Mapping?userId=${encodeURIComponent(userId || '')}&itemId=${encodeURIComponent(seasonId)}`), { method: 'DELETE' });
                renderFullEditDialog(userId, targetId, mediaType, aquilaId, fallbackTitle, candidateIds);
            } catch (e) {
                console.error('[Aquila Plugin] Failed to unlink season:', e);
            }
        };

        // Status Select
        const statusSelect = document.getElementById('aquila-status-select');
        statusSelect.addEventListener('change', (e) => {
            listStatus = e.target.value;
            console.log('[Aquila Plugin] [STATUS SELECT CHANGE] New listStatus:', listStatus);
            if (listStatus === "COMPLETED") {
                if (mediaType === "anime" && totalEpisodes && !progress) {
                    progress = totalEpisodes.toString();
                    const progInput = document.getElementById('aquila-progress-input');
                    if (progInput) progInput.value = progress;
                }
            }
        });

        // Connection Toggle
        const connToggle = document.getElementById('aquila-update-connection');
        const connContainer = document.getElementById('aquila-connections-container');
        connToggle.addEventListener('change', (e) => {
            updateConnection = e.target.checked;
            console.log('[Aquila Plugin] [CONNECTION TOGGLE] updateConnection =', updateConnection);
            if (updateConnection) connContainer.classList.remove('hidden');
            else connContainer.classList.add('hidden');
        });

        // Active Connections Grid (Filtered to only user-connected providers or linked ones)
        function renderConnectionsGrid() {
            const grid = document.getElementById('aquila-connections-grid');
            if (!grid) return;

            const connectedProviders = BASE_PROVIDERS.filter(p => {
                const pKeyLower = p.key.toLowerCase();
                const isUserConnected = userConnectionsList.includes(pKeyLower) ||
                    (pKeyLower === 'mal' && userConnectionsList.includes('myanimelist')) ||
                    (pKeyLower === 'myanimelist' && userConnectionsList.includes('mal'));
                const isAlreadyLinked = !!connections[p.key] ||
                    (p.key === 'mal' && !!connections['myanimelist']) ||
                    (p.key === 'myanimelist' && !!connections['mal']);
                return p.caps.includes(capParam) && (isUserConnected || isAlreadyLinked);
            });

            console.log('[Aquila Plugin] [CONNECTIONS GRID FILTER] User active connections:', userConnectionsList, 'Filtered providers:', connectedProviders.map(p => p.key));

            if (connectedProviders.length === 0) {
                grid.innerHTML = `
                    <div class="col-span-full text-center py-5 text-xs text-muted-foreground bg-background/50 border border-dashed border-border/70 rounded-xl flex items-center justify-center gap-2 font-medium">
                        No active connections connected to your Aquila account. Connect external accounts in your Aquila Settings tab.
                    </div>
                `;
                return;
            }

            grid.innerHTML = connectedProviders.map(p => {
                const connVal = connections[p.key] || (p.key === 'mal' ? connections['myanimelist'] : (p.key === 'myanimelist' ? connections['mal'] : undefined));
                const linkedId = typeof connVal === 'object' ? connVal?.id : connVal;

                if (linkedId) {
                    return `
                        <div class="border border-border/60 rounded-xl overflow-hidden bg-background/80 p-3 flex justify-between items-center text-xs">
                            <div class="flex items-center gap-2">
                                <span class="font-extrabold text-[10px] tracking-wider uppercase text-foreground">${p.name}</span>
                                <span class="text-[10px] font-mono font-bold text-primary bg-primary/10 border border-primary/25 px-2 py-0.5 rounded-md">#${linkedId}</span>
                            </div>
                            <button class="bg-transparent hover:bg-destructive/10 text-muted-foreground hover:text-destructive text-xs font-semibold px-2 py-1 rounded-lg cursor-pointer transition-colors" onclick="window.aquilaUnlinkProvider('${p.key}')">Unlink</button>
                        </div>
                    `;
                }

                return `
                    <button class="w-full flex justify-between items-center bg-background/70 border border-dashed border-border/70 hover:border-primary/50 text-foreground h-11 px-3.5 rounded-xl transition-all hover:bg-primary/5 text-xs font-semibold group cursor-pointer shadow-xs" onclick="window.aquilaOpenConnSearch('${p.key}', '${p.name}')">
                        <span class="uppercase text-[11px] font-bold tracking-wider">${p.name}</span>
                        <span class="flex items-center gap-1 text-[11px] font-medium text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-lg group-hover:bg-primary/20 transition-colors">+ Connect</span>
                    </button>
                `;
            }).join('');
        }
        renderConnectionsGrid();

        window.aquilaUnlinkProvider = (providerKey) => {
            delete connections[providerKey];
            if (providerKey === 'mal') delete connections['myanimelist'];
            if (providerKey === 'myanimelist') delete connections['mal'];
            renderConnectionsGrid();
        };

        window.aquilaOpenConnSearch = (providerKey, providerName) => {
            const searchModal = document.getElementById('aquila-conn-search-modal');
            const searchTitle = document.getElementById('aquila-search-modal-title');
            const searchInput = document.getElementById('aquila-conn-search-input');
            const searchResults = document.getElementById('aquila-conn-search-results');

            searchTitle.innerText = `Search ${providerName}`;
            searchModal.classList.remove('hidden');
            searchResults.innerHTML = '<div class="col-span-full text-center p-6 text-muted-foreground text-xs">Searching external connection...</div>';

            const doConnSearch = async () => {
                const q = searchInput.value.trim();
                if (!q) return;
                try {
                    const res = await fetch(getProxyUrl(`Aquila/Api/ConnectionSearch?provider=${providerKey}&mediaType=${mediaType}&query=${encodeURIComponent(q)}`));
                    if (!res.ok) throw new Error(`HTTP ${res.status}`);
                    const items = await res.json();

                    if (!Array.isArray(items) || items.length === 0) {
                        searchResults.innerHTML = '<div class="col-span-full text-center p-6 text-muted-foreground text-xs">No results found.</div>';
                        return;
                    }

                    searchResults.innerHTML = items.map(item => `
                        <div class="bg-card/40 border border-border/60 rounded-xl overflow-hidden cursor-pointer hover:border-primary transition-all flex flex-col aquila-search-card" data-id="${item.id}">
                            <img src="${item.coverImage || item.image || 'https://via.placeholder.com/120x160'}" class="w-full h-32 object-cover bg-muted" />
                            <div class="p-2 text-xs font-semibold text-center text-foreground truncate">${item.title || item.name}</div>
                        </div>
                    `).join('');

                    searchResults.querySelectorAll('.aquila-search-card').forEach(card => {
                        card.addEventListener('click', () => {
                            const resId = card.getAttribute('data-id');
                            connections[providerKey] = { id: resId };
                            searchModal.classList.add('hidden');
                            renderConnectionsGrid();
                        });
                    });
                } catch (e) {
                    searchResults.innerHTML = `<div class="col-span-full text-center p-6 text-destructive text-xs">Search failed: ${e.message}</div>`;
                }
            };

            document.getElementById('aquila-conn-search-btn').onclick = doConnSearch;
            document.getElementById('aquila-conn-search-close').onclick = () => { searchModal.classList.add('hidden'); };
            doConnSearch();
        };

        // Render TV Episodes Accordion (for TV Shows)
        function renderTvEpisodesList() {
            const container = document.getElementById('aquila-seasons-list');
            if (!container) return;

            if (!seasons || seasons.length === 0) {
                container.innerHTML = `<div class="text-center p-8 text-xs text-muted-foreground bg-card/40 border border-dashed border-border/60 rounded-2xl">No season or episode data available.</div>`;
                return;
            }

            container.innerHTML = seasons.map((season) => {
                const sNum = season.number;
                const seasonEps = season.episodes || [];
                const watchedInSeason = seasonEps.filter(ep => watchedEpisodes.some(w => w.seasonNum === sNum && w.episodeNum === ep.number)).length;
                const isCompleted = season.episodeCount > 0 && watchedInSeason === season.episodeCount;
                const percent = season.episodeCount > 0 ? Math.round((watchedInSeason / season.episodeCount) * 100) : 0;

                return `
                    <div class="border border-border/60 rounded-2xl bg-card/40 backdrop-blur-xs overflow-hidden shadow-xs transition-all hover:border-border" id="season-card-${sNum}">
                        <div class="flex items-center justify-between p-3.5 bg-background/50 cursor-pointer select-none hover:bg-muted/40 transition-colors" onclick="window.aquilaToggleSeasonAccordion(${sNum})">
                            <div class="flex items-center gap-3">
                                <input type="checkbox" ${isCompleted ? 'checked' : ''} onclick="event.stopPropagation(); window.aquilaToggleSeasonWatched(${sNum}, this.checked);" class="border-border accent-purple-500 cursor-pointer" />
                                <span class="font-bold text-xs sm:text-sm text-foreground">${season.name || `Season ${sNum}`}</span>
                            </div>
                            <div class="flex items-center gap-2.5">
                                <span class="text-[10px] font-bold px-2.5 py-0.5 rounded-full ${isCompleted ? 'bg-primary/10 text-primary border border-primary/25' : 'bg-muted/60 text-muted-foreground border border-border/60'}">${watchedInSeason} / ${season.episodeCount || '?'} Ep (${percent}%)</span>
                                <span id="chevron-season-${sNum}">${ICONS.chevronDown}</span>
                            </div>
                        </div>
                        <div class="p-3 max-h-52 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-2 border-t border-border/50 bg-muted/10 hidden" id="season-eps-${sNum}">
                            ${seasonEps.map(ep => {
                                const isWatched = watchedEpisodes.some(w => w.seasonNum === sNum && w.episodeNum === ep.number);
                                return `
                                    <button class="flex items-center justify-between p-2.5 rounded-xl border text-left transition-all text-xs font-semibold cursor-pointer ${isWatched ? 'bg-primary/10 border-primary/30 text-primary shadow-xs' : 'bg-background/80 border-border/60 hover:bg-muted/60 text-foreground'}" onclick="window.aquilaToggleEpisodeWatched(${sNum}, ${ep.number})">
                                        <span class="truncate pr-1">${ep.number}. ${ep.name || `Episode ${ep.number}`}</span>
                                        ${isWatched ? ICONS.check : ''}
                                    </button>
                                `;
                            }).join('')}
                        </div>
                    </div>
                `;
            }).join('');
        }

        window.aquilaToggleSeasonAccordion = (sNum) => {
            const grid = document.getElementById(`season-eps-${sNum}`);
            const chev = document.getElementById(`chevron-season-${sNum}`);
            if (grid.classList.contains('hidden')) {
                grid.classList.remove('hidden');
                grid.classList.add('grid');
                chev.innerHTML = ICONS.chevronUp;
            } else {
                grid.classList.add('hidden');
                grid.classList.remove('grid');
                chev.innerHTML = ICONS.chevronDown;
            }
        };

        window.aquilaToggleEpisodeWatched = async (seasonNum, episodeNum) => {
            try {
                const res = await fetch(getProxyUrl(`Aquila/Api/Episode?id=${aquilaId}`), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ seasonNum, episodeNum })
                });

                if (res.ok) {
                    const data = await res.json();
                    if (data.watched) {
                        watchedEpisodes.push({ seasonNum, episodeNum });
                    } else {
                        watchedEpisodes = watchedEpisodes.filter(ep => !(ep.seasonNum === seasonNum && ep.episodeNum === episodeNum));
                    }
                    renderTvEpisodesList();
                }
            } catch (e) {
                console.error('[Aquila Plugin] Error toggling episode:', e);
            }
        };

        window.aquilaToggleSeasonWatched = async (seasonNum, checked) => {
            const season = seasons.find(s => s.number === seasonNum);
            if (!season) return;

            try {
                const res = await fetch(getProxyUrl(`Aquila/Api/Season?id=${aquilaId}`), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ seasonNum, episodes: season.episodes, watched: checked })
                });

                if (res.ok) {
                    if (checked) {
                        watchedEpisodes = [
                            ...watchedEpisodes.filter(ep => ep.seasonNum !== seasonNum),
                            ...(season.episodes || []).map(ep => ({ seasonNum, episodeNum: ep.number }))
                        ];
                    } else {
                        watchedEpisodes = watchedEpisodes.filter(ep => ep.seasonNum !== seasonNum);
                    }
                    renderTvEpisodesList();
                }
            } catch (e) {
                console.error('[Aquila Plugin] Error toggling season:', e);
            }
        };

        // Unlink Mapping Action
        const unlinkBtn = document.getElementById('aquila-unlink-mapping-btn');
        if (unlinkBtn) {
            unlinkBtn.addEventListener('click', async () => {
                try {
                    const candParam = (candidateIds && candidateIds.length > 0) ? `&candidateIds=${encodeURIComponent(candidateIds.join(','))}` : '';
                    const proxyUrl = getProxyUrl(`Aquila/Api/Mapping?userId=${encodeURIComponent(userId || '')}&itemId=${encodeURIComponent(targetId)}${candParam}`);
                    await fetch(proxyUrl, { method: 'DELETE' });
                    renderSearchView(userId, targetId, mediaType, titleText, candidateIds);
                } catch (e) {
                    console.error('[Aquila Plugin] Error unlinking mapping:', e);
                }
            });
        }

        // Delete Dialog
        const deleteBtn = document.getElementById('aquila-delete-entry-btn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => {
                document.getElementById('aquila-confirm-dialog').classList.remove('hidden');
                document.getElementById('aquila-confirm-dialog').classList.add('flex');
            });
        }
        document.getElementById('aquila-confirm-cancel').addEventListener('click', () => {
            document.getElementById('aquila-confirm-dialog').classList.add('hidden');
            document.getElementById('aquila-confirm-dialog').classList.remove('flex');
        });
        document.getElementById('aquila-confirm-delete').addEventListener('click', async () => {
            try {
                const res = await fetch(getProxyUrl(`Aquila/Api/Entry?mediaType=${encodeURIComponent(mediaType)}&id=${aquilaId}`), {
                    method: 'DELETE'
                });
                if (res.ok) {
                    closeModal();
                } else {
                    alert('Failed to remove entry.');
                }
            } catch (e) {
                alert('Error deleting entry.');
            }
        });

        // Save Entry
        document.getElementById('aquila-save-btn').addEventListener('click', async () => {
            const saveBtn = document.getElementById('aquila-save-btn');
            saveBtn.disabled = true;
            saveBtn.innerText = 'Saving...';

            const scoreVal = document.getElementById('aquila-score-input').value;
            const rewatchesVal = document.getElementById('aquila-rewatches-input').value;
            const progInput = document.getElementById('aquila-progress-input');
            const notesVal = document.getElementById('aquila-notes-input').value;
            const startVal = document.getElementById('aquila-start-date').value;
            const finishVal = document.getElementById('aquila-finish-date').value;

            const dto = {
                status: listStatus,
                score: scoreVal ? parseFloat(scoreVal) : undefined,
                notes: notesVal || undefined,
                startDate: startVal ? Math.floor(new Date(startVal).getTime() / 1000) : null,
                endDate: finishVal ? Math.floor(new Date(finishVal).getTime() / 1000) : null,
                updateConnection: updateConnection,
                connections: connections
            };

            if (mediaType === 'anime') {
                dto.animeId = aquilaId;
                dto.progress = progInput?.value ? parseInt(progInput.value, 10) : undefined;
                dto.rewatched = rewatchesVal ? parseInt(rewatchesVal, 10) : undefined;
            } else if (mediaType === 'movie') {
                dto.movieId = aquilaId;
                dto.rewatched = rewatchesVal ? parseInt(rewatchesVal, 10) : undefined;
            } else if (mediaType === 'tv') {
                dto.tvId = aquilaId;
                dto.rewatched = rewatchesVal ? parseInt(rewatchesVal, 10) : undefined;
                dto.episodes = watchedEpisodes;
            }

            try {
                const res = await fetch(getProxyUrl(`Aquila/Api/Save?mediaType=${encodeURIComponent(mediaType)}`), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(dto)
                });

                if (res.ok) {
                    closeModal();
                } else {
                    alert('Failed to save list entry to Aquila.');
                    saveBtn.disabled = false;
                    saveBtn.innerText = 'Save';
                }
            } catch (err) {
                console.error('[Aquila Plugin] Save exception:', err);
                alert('Error saving entry to Aquila server.');
                saveBtn.disabled = false;
                saveBtn.innerText = 'Save';
            }
        });
    }

    function getStatusOptions(mediaType) {
        if (mediaType === "movie") {
            return [
                { value: "COMPLETED", label: "Completed" },
                { value: "DROPPED", label: "Dropped" },
                { value: "PLANNING", label: "Planning" }
            ];
        }
        return [
            { value: "WATCHING", label: "Watching" },
            { value: "ON_HOLD", label: "On Hold" },
            { value: "COMPLETED", label: "Completed" },
            { value: "DROPPED", label: "Dropped" },
            { value: "PLANNING", label: "Planning" }
        ];
    }

    function createAquilaButton() {
        const btn = document.createElement('button');
        btn.setAttribute('is', 'emby-button');
        btn.setAttribute('type', 'button');
        btn.className = 'button-flat btnAquilaEditModal detailButton emby-button';
        btn.title = 'Manage Aquila Media';
        btn.innerHTML = `
            <div class="detailButton-content">
                <span class="detailButton-icon" style="display:inline-flex; align-items:center; justify-content:center; width:24px; height:24px;">
                    ${ICONS.aquila}
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

            console.log(`[Aquila WebClient] Aquila button clicked: Resolved itemId=${itemId} (isVideoOSD=${isVideoOSD})`);
            if (itemId) handleAquilaButtonClick(itemId);
        });

        return btn;
    }

    function injectInlineButtons() {
        // 1. Target all favorite/rating buttons outside of cards (including video OSD heart button)
        const favButtons = document.querySelectorAll('.btnUserRating, button[is="emby-ratingbutton"], .btnFavorite, .btnDetailFavorite, button[data-action="favorite"], button[data-action="like"], .btnOsdUserData');
        favButtons.forEach(favBtn => {
            if (favBtn.closest('.card, .cardOverlay, .cardOverlayButton, .cardFooter, .cardOverlayContainer, .innerCardFooter, .itemCard')) {
                return;
            }

            const parent = favBtn.parentNode;
            if (parent && !parent.querySelector('.btnAquilaEditModal')) {
                const btn = createAquilaButton();
                parent.insertBefore(btn, favBtn.nextSibling);
            }
        });

        // 2. Also check player OSD and detail containers if favBtn wasn't present
        const containers = document.querySelectorAll('.mainDetailButtons, .detailButtons, .osdRightControls, .osdControls-right, .osdBottomControls, .videoOsd, .osd-buttons, .videoOsdBottom');
        containers.forEach(container => {
            if (container.closest('.card, .cardOverlay, .cardOverlayButton, .cardFooter, .cardOverlayContainer, .innerCardFooter, .itemCard')) {
                return;
            }

            if (container.querySelector('.btnAquilaEditModal')) return;

            const btn = createAquilaButton();
            container.appendChild(btn);
        });

        // 3. Clean up any Aquila buttons inside card overlays
        document.querySelectorAll('.card .btnAquilaEditModal, .cardOverlay .btnAquilaEditModal, .cardOverlayButtonContainer .btnAquilaEditModal, .innerCardFooter .btnAquilaEditModal, .itemCard .btnAquilaEditModal').forEach(btn => {
            btn.remove();
        });
    }

    function removeFloatingActionButton() {
        const fab = document.getElementById('aquila-fab-btn');
        if (fab) {
            fab.remove();
        }
    }

    function processUiUpdates() {
        try {
            clearLegacyLocalStorageMappings();
            injectStylesAndTailwind();
            injectInlineButtons();
            removeFloatingActionButton();
        } catch (e) {
            console.error('[Aquila Plugin] Exception during UI iteration:', e);
        }
    }

    setInterval(processUiUpdates, 1000);

    const observer = new MutationObserver(() => processUiUpdates());
    if (document.body) {
        observer.observe(document.body, { childList: true, subtree: true });
    }

    document.addEventListener('DOMContentLoaded', () => processUiUpdates());
    processUiUpdates();
})();

