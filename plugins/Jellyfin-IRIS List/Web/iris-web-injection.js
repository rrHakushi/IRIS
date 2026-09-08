(function () {
    'use strict';

    const PLUGIN_ID = "f9a4c810-7213-4d43-9821-2e65d8a9b12d";
    let pluginConfig = null;

    console.log('%c[Iris Plugin] CLIENT SCRIPT LOADED - MODERN SHADCN 1:1 MODAL ACTIVE', 'background: #f43f5e; color: #ffffff; font-size: 14px; font-weight: bold; padding: 6px 12px; border-radius: 4px;');

    // Inject CSS & Tailwind CDN
    function injectStylesAndTailwind() {
        if (!document.getElementById('iris-modal-css')) {
            const cssUrl = typeof ApiClient !== 'undefined' && ApiClient.getUrl ? ApiClient.getUrl('Iris/Modal.css') : '/Iris/Modal.css';
            const link = document.createElement('link');
            link.id = 'iris-modal-css';
            link.rel = 'stylesheet';
            link.href = cssUrl;
            document.head.appendChild(link);
        }

        if (!document.getElementById('iris-tailwind-cdn')) {
            const script = document.createElement('script');
            script.id = 'iris-tailwind-cdn';
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

    function getIconUrl() {
        return typeof ApiClient !== 'undefined' && ApiClient.getUrl ? ApiClient.getUrl('Iris/Icon.png') : '/Iris/Icon.png';
    }

    const ICONS = {
        get iris() {
            return `<img src="${getIconUrl()}" style="width:24px; height:24px; object-fit:contain; display:inline-block; vertical-align:middle;" alt="Iris" />`;
        },
        sparkles: `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3l1.912 5.813a2 2 0 001.275 1.275L21 12l-5.813 1.912a2 2 0 00-1.275 1.275L12 21l-1.912-5.813a2 2 0 00-1.275-1.275L3 12l5.813-1.912a2 2 0 001.275-1.275L12 3z"/></svg>`,
        heart: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l8.78-8.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>`,
        heartFilled: `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l8.78-8.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>`,
        star: `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
        rotateCcw: `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 102.13-9.36L1 10"/></svg>`,
        calendar: `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
        note: `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`,
        link: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>`,
        check: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>`,
        chevronDown: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>`,
        chevronUp: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="18 15 12 9 6 15"/></svg>`,
        deviceTv: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="15" rx="2" ry="2"/><polyline points="17 2 12 7 7 2"/></svg>`
    };

    async function loadConfig() {
        try {
            const config = await ApiClient.getPluginConfiguration(PLUGIN_ID);
            const currentUserId = ApiClient.getCurrentUserId();
            const userConfig = (config.UserConfigs || []).find(u => u.JellyfinUserId === currentUserId) || {};
            pluginConfig = {
                baseUrl: userConfig.IrisServerUrl || userConfig.AquilaServerUrl || "",
                apiKey: userConfig.ApiKey || "",
                mappings: config.LibraryMappings || []
            };
        } catch (e) {
            console.error('[Iris Plugin] Failed to load configuration:', e);
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

    function createModalContainer() {
        let backdrop = document.getElementById('iris-modal-backdrop') || document.getElementById('aquila-modal-backdrop');
        if (backdrop) {
            backdrop.id = 'iris-modal-backdrop';
            return backdrop;
        }

        backdrop = document.createElement('div');
        backdrop.id = 'iris-modal-backdrop';
        backdrop.className = 'dark';

        backdrop.innerHTML = `
            <div class="relative flex flex-col gap-0 max-h-[92vh] w-[94vw] max-w-[720px] p-0 overflow-hidden bg-[#121113] border border-[#2b282f] text-foreground shadow-2xl rounded-3xl" id="iris-modal-card">
                <div id="iris-modal-content" class="flex flex-col h-full overflow-hidden"></div>
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
        setTimeout(() => backdrop.classList.add('iris-show', 'aquila-show'), 10);
    }

    function closeModal() {
        const backdrop = document.getElementById('iris-modal-backdrop') || document.getElementById('aquila-modal-backdrop');
        if (backdrop) {
            backdrop.classList.remove('iris-show', 'aquila-show');
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

    async function saveServerMapping(userId, targetId, irisId, mediaType) {
        try {
            console.log(`[Iris Plugin] Persisting mapping to server: targetId=${targetId} -> irisId=${irisId} (${mediaType})`);
            const proxyUrl = getProxyUrl(`Iris/Api/Mapping?userId=${encodeURIComponent(userId || '')}&itemId=${encodeURIComponent(targetId)}&irisMediaId=${irisId}&mediaType=${encodeURIComponent(mediaType)}`);
            await fetch(proxyUrl, { method: 'POST' });
        } catch (e) {
            console.error('[Iris Plugin] Failed to persist mapping to server:', e);
        }
    }

    async function handleIrisButtonClick(itemId) {
        openModal();
        const content = document.getElementById('iris-modal-content');
        content.innerHTML = '<div class="text-center p-12 text-muted-foreground font-semibold">Loading Iris Media Data...</div>';

        if (!pluginConfig) await loadConfig();

        try {
            const currentUserId = ApiClient.getCurrentUserId();
            const item = await ApiClient.getItem(currentUserId, itemId);
            const { mediaType: defaultMediaType, title, targetId, candidateIds, isMovie } = getItemDetails(item);

            let savedIrisId = null;
            let activeMediaType = defaultMediaType;

            try {
                const candParam = (candidateIds && candidateIds.length > 0) ? `&candidateIds=${encodeURIComponent(candidateIds.join(','))}` : '';
                const mapRes = await fetch(getProxyUrl(`Iris/Api/Mapping?userId=${encodeURIComponent(currentUserId || '')}&itemId=${encodeURIComponent(targetId)}${candParam}`));
                if (mapRes.ok) {
                    const mapData = await mapRes.json();
                    if (mapData && (mapData.irisMediaId || mapData.aquilaMediaId)) {
                        savedIrisId = (mapData.irisMediaId || mapData.aquilaMediaId).toString();
                        if (mapData.mediaType) {
                            activeMediaType = mapData.mediaType;
                        }
                    }
                }
            } catch (e) {
                console.warn('[Iris Plugin] Error fetching server mapping:', e);
            }

            if (savedIrisId) {
                renderFullEditDialog(currentUserId, targetId, activeMediaType, parseInt(savedIrisId, 10), title, candidateIds, isMovie, item);
            } else {
                renderSearchView(currentUserId, targetId, activeMediaType, title, candidateIds, isMovie, item);
            }
        } catch (err) {
            console.error('[Iris Plugin] Item fetch error:', err);
            content.innerHTML = `<div class="text-center p-8 text-destructive">Failed to load item details from Jellyfin server.</div>`;
        }
    }

    // Search View to Link Iris Title
    async function renderSearchView(userId, targetId, initialMediaType, defaultTitle, candidateIds = [], isMovie = false, jellyfinItem = null, returnToParent = null) {
        let currentSearchType = (initialMediaType && initialMediaType !== 'manga') ? initialMediaType : (isMovie ? "movie" : "tv");
        const content = document.getElementById('iris-modal-content');

        content.innerHTML = `
            <div class="p-6 flex flex-col gap-4">
                <div class="flex justify-between items-center">
                    <h3 class="m-0 text-lg font-bold text-foreground">Link Media to Iris</h3>
                    <button class="text-muted-foreground hover:text-foreground text-xl font-bold bg-transparent border-0 cursor-pointer" id="iris-modal-close-btn">&times;</button>
                </div>

                <!-- Media Type Tabs -->
                <div class="flex items-center gap-2" id="iris-search-type-pills">
                    <button class="px-3.5 py-1.5 text-xs font-semibold rounded-xl cursor-pointer transition-all ${currentSearchType === 'anime' ? 'bg-primary text-primary-foreground shadow-xs' : 'bg-[#222025] text-muted-foreground hover:text-foreground'}" data-type="anime">Anime</button>
                    <button class="px-3.5 py-1.5 text-xs font-semibold rounded-xl cursor-pointer transition-all ${currentSearchType === 'tv' ? 'bg-primary text-primary-foreground shadow-xs' : 'bg-[#222025] text-muted-foreground hover:text-foreground'}" data-type="tv">TV Shows</button>
                    <button class="px-3.5 py-1.5 text-xs font-semibold rounded-xl cursor-pointer transition-all ${currentSearchType === 'movie' ? 'bg-primary text-primary-foreground shadow-xs' : 'bg-[#222025] text-muted-foreground hover:text-foreground'}" data-type="movie">Movies</button>
                </div>

                <div class="flex gap-2.5">
                    <input type="text" id="iris-search-input" class="w-full px-3.5 py-2 bg-[#18171a] border border-[#2b282f] text-foreground rounded-xl text-xs font-semibold placeholder:text-muted-foreground" value="${(defaultTitle || '').replace(/"/g, '&quot;')}" placeholder="Search title (min 3 characters)..." />
                    <button class="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-5 rounded-xl text-xs cursor-pointer shadow-md shadow-primary/20" id="iris-search-btn">Search</button>
                </div>
                <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 max-h-[420px] overflow-y-auto pr-1 iris-custom-scrollbar" id="iris-search-results">
                    <div class="col-span-full text-center p-8 text-muted-foreground text-xs">Searching Iris API...</div>
                </div>
            </div>
        `;

        document.getElementById('iris-modal-close-btn').addEventListener('click', () => {
            if (returnToParent) {
                returnToParent();
            } else {
                closeModal();
            }
        });
        const searchInput = document.getElementById('iris-search-input');
        const searchBtn = document.getElementById('iris-search-btn');

        // Type pills listener
        document.querySelectorAll('#iris-search-type-pills button').forEach(pill => {
            pill.addEventListener('click', () => {
                currentSearchType = pill.getAttribute('data-type');
                document.querySelectorAll('#iris-search-type-pills button').forEach(p => {
                    if (p.getAttribute('data-type') === currentSearchType) {
                        p.className = 'px-3.5 py-1.5 text-xs font-semibold rounded-xl cursor-pointer transition-all bg-primary text-primary-foreground shadow-xs';
                    } else {
                        p.className = 'px-3.5 py-1.5 text-xs font-semibold rounded-xl cursor-pointer transition-all bg-[#222025] text-muted-foreground hover:text-foreground';
                    }
                });
                doSearch();
            });
        });

        const doSearch = async () => {
            const rawQuery = searchInput.value.trim();
            if (!rawQuery || rawQuery.length < 3) {
                const resultsContainer = document.getElementById('iris-search-results');
                if (resultsContainer) {
                    resultsContainer.innerHTML = '<div class="col-span-full text-center p-8 text-muted-foreground text-xs">Please enter at least 3 characters to search.</div>';
                }
                return;
            }

            const resultsContainer = document.getElementById('iris-search-results');
            resultsContainer.innerHTML = '<div class="col-span-full text-center p-8 text-muted-foreground text-xs">Searching Iris API...</div>';

            const cleanQuery = rawQuery
                .replace(/\s*\([^)]*\)/g, '')
                .replace(/\s*\[[^\]]*\]/g, '')
                .replace(/\s+-\s+\d+.*$/, '')
                .trim();

            try {
                const proxyUrl = getProxyUrl(`Iris/Api/Search?mediaType=${encodeURIComponent(currentSearchType)}&query=${encodeURIComponent(cleanQuery || rawQuery)}&userId=${encodeURIComponent(userId || '')}`);
                const res = await fetchWithTimeout(proxyUrl, {}, 8000);
                if (!res.ok) {
                    const errText = await res.json().catch(() => ({ message: `HTTP ${res.status}` }));
                    throw new Error(errText.message || `HTTP ${res.status}`);
                }
                const items = await res.json();

                if (!Array.isArray(items) || items.length === 0) {
                    resultsContainer.innerHTML = '<div class="col-span-full text-center p-8 text-muted-foreground text-xs">No matching titles found in Iris.</div>';
                    return;
                }

                resultsContainer.innerHTML = items.map(item => {
                    const titleText = item.titlePrimary || item.title || 'Untitled';
                    const subText = item.titleSecondary || item.titleNative || '';
                    const yearText = item.releaseDateYear || item.seasonYear || item.firstAiredYear || '';
                    const cover = item.coverImage || 'https://via.placeholder.com/150x220?text=No+Cover';

                    return `
                        <div class="bg-[#18171a] border border-[#2b282f] hover:border-primary/60 rounded-2xl overflow-hidden cursor-pointer transition-all p-2 flex flex-col gap-2 iris-search-card group" data-id="${item.id}" data-type="${currentSearchType}">
                            <div class="aspect-[2/3] w-full rounded-xl overflow-hidden bg-muted relative">
                                <img src="${cover}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                                ${yearText ? `<span class="absolute top-1.5 right-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-black/70 text-white backdrop-blur-xs">${yearText}</span>` : ''}
                            </div>
                            <div class="flex flex-col min-w-0 px-0.5">
                                <span class="text-xs font-bold text-foreground truncate group-hover:text-primary transition-colors">${titleText}</span>
                                ${subText ? `<span class="text-[10px] text-muted-foreground truncate">${subText}</span>` : ''}
                            </div>
                        </div>
                    `;
                }).join('');

                resultsContainer.querySelectorAll('.iris-search-card').forEach(card => {
                    card.addEventListener('click', async () => {
                        const irisId = parseInt(card.getAttribute('data-id'), 10);
                        const itemType = card.getAttribute('data-type') || currentSearchType;
                        await saveServerMapping(userId, targetId, irisId, itemType);
                        if (returnToParent) {
                            returnToParent();
                        } else {
                            renderFullEditDialog(userId, targetId, itemType, irisId, defaultTitle, candidateIds, isMovie, jellyfinItem);
                        }
                    });
                });
            } catch (e) {
                resultsContainer.innerHTML = `<div class="col-span-full text-center p-8 text-destructive text-xs">Search error: ${e.message}</div>`;
            }
        };

        searchBtn.addEventListener('click', doSearch);
        searchInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') doSearch(); });
        doSearch();
    }

    // Modern 1:1 Modal Dialog Implementation (General, Episodes, Jellyfin)
    async function renderFullEditDialog(userId, targetId, mediaType, irisId, fallbackTitle, candidateIds = [], isMovie = false, jellyfinItem = null) {
        console.group('[Iris Plugin] [RENDER FULL EDIT DIALOG]');
        console.log('[Iris Plugin] Params:', { userId, targetId, mediaType, irisId, fallbackTitle, candidateIds, isMovie });

        const content = document.getElementById('iris-modal-content');
        content.innerHTML = '<div class="text-center p-16 text-muted-foreground font-semibold">Loading Iris media details...</div>';

        let mediaDetails = null;
        let isFavorited = false;
        let listEntry = null;

        const effectiveIsMovie = isMovie || mediaType === "movie";
        const uParam = `&userId=${encodeURIComponent(userId || '')}`;

        try {
            const [detRes, favRes, entryRes] = await Promise.all([
                fetchWithTimeout(getProxyUrl(`Iris/Api/Details?mediaType=${encodeURIComponent(mediaType)}&id=${irisId}${uParam}`), {}, 8000).catch(e => { console.error('[Iris Plugin] Details error:', e); return null; }),
                fetchWithTimeout(getProxyUrl(`Iris/Api/FavoriteStatus?mediaType=${encodeURIComponent(mediaType)}&id=${irisId}${uParam}`), {}, 8000).catch(e => { console.error('[Iris Plugin] FavoriteStatus error:', e); return null; }),
                fetchWithTimeout(getProxyUrl(`Iris/Api/Entry?mediaType=${encodeURIComponent(mediaType)}&id=${irisId}${uParam}`), {}, 8000).catch(e => { console.error('[Iris Plugin] Entry error:', e); return null; })
            ]);

            if (detRes && detRes.ok) mediaDetails = await detRes.json();
            if (favRes && favRes.ok) {
                const favData = await favRes.json();
                isFavorited = Boolean(favData.isFavorited || favData.favorited);
            }
            if (entryRes && entryRes.ok) listEntry = await entryRes.json();
        } catch (e) {
            console.warn('[Iris Plugin] Parallel fetch exception:', e);
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
                            const mRes = await fetch(getProxyUrl(`Iris/Api/Mapping?userId=${encodeURIComponent(userId || '')}&itemId=${encodeURIComponent(s.Id)}`));
                            if (mRes.ok) {
                                const mData = await mRes.json();
                                const sIrisId = mData?.irisMediaId || mData?.aquilaMediaId;
                                if (sIrisId) {
                                    mData.resolvedTitle = mData.displayTitle || `Iris #${sIrisId}`;
                                    seasonMappings[s.Id] = mData;
                                }
                            }
                        } catch {}
                    }));
                }
            } catch (e) {
                console.warn('[Iris Plugin] Failed to fetch Jellyfin seasons:', e);
            }
        }

        const rawMedia = mediaDetails || { id: irisId, type: mediaType, titlePrimary: fallbackTitle };
        const titleText = rawMedia.titlePrimary || rawMedia.title || fallbackTitle;
        const coverImageLarge = rawMedia.coverImage || '';
        const bannerImage = rawMedia.bannerImage || '';

        let hasListEntry = Boolean(listEntry);
        let listStatus = listEntry?.status || "PLANNING";
        let score = listEntry?.score ? listEntry.score.toString() : "";
        let progress = listEntry?.progress !== undefined ? listEntry.progress : 0;
        let rewatches = listEntry?.rewatched !== undefined ? listEntry.rewatched.toString() : "0";
        let notes = listEntry?.notes || "";
        let isPrivate = Boolean(listEntry?.private);
        let startDateStr = formatDateInput(listEntry?.startedAt || listEntry?.startDate);
        let finishDateStr = formatDateInput(listEntry?.completedAt || listEntry?.endDate);
        let watchedEpisodes = listEntry?.watchedEpisodes || [];
        let tvSeasonsProgress = listEntry?.seasons || [];

        const totalEpisodes = rawMedia.episodeCount || (Array.isArray(rawMedia.episodes) ? rawMedia.episodes.length : null);
        const hasEpisodesTab = (mediaType === "tv" || mediaType === "anime") && !effectiveIsMovie;

        // Effective TV seasons & episodes from Iris
        let irisTvSeasons = rawMedia.seasons || [];
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
            irisTvSeasons = Object.values(seasonsMap).sort((a, b) => a.seasonNumber - b.seasonNumber);
        } else if (mediaType === "tv" && irisTvSeasons.length === 0 && totalEpisodes) {
            irisTvSeasons = [{
                seasonNumber: 1,
                title: "Season 1",
                episodeCount: totalEpisodes,
                episodes: Array.from({ length: totalEpisodes }, (_, idx) => ({ episodeNumber: idx + 1, titlePrimary: `Episode ${idx + 1}` }))
            }];
        }

        // Active tab state
        let activeTab = "general";

        console.log('[Iris Plugin] Ready to render modal. MediaType:', mediaType, 'EffectiveIsMovie:', effectiveIsMovie);
        console.groupEnd();

        content.innerHTML = `
            <!-- Top Banner Header with Backdrop Image and Overlay Vignette -->
            <div class="relative h-44 sm:h-52 w-full overflow-hidden bg-[#18171a] shrink-0">
                ${bannerImage ? `<img src="${bannerImage}" class="w-full h-full object-cover brightness-60" />` : `<div class="w-full h-full bg-[#18171a]"></div>`}
                <div class="absolute inset-0 bg-gradient-to-t from-[#121113] via-[#121113]/60 to-transparent"></div>

                <!-- Circular Close Button -->
                <button type="button" id="iris-modal-close" class="absolute top-3.5 right-3.5 z-30 flex size-8 cursor-pointer items-center justify-center rounded-full border border-border/40 bg-background/60 text-foreground backdrop-blur-md transition-colors hover:bg-background/90" aria-label="Close">
                    &times;
                </button>

                <!-- Header Bottom: Poster + Title + Category + Favorite + Save -->
                <div class="absolute inset-x-0 bottom-0 z-20 flex items-end justify-between p-4 sm:p-5">
                    <div class="flex min-w-0 items-end gap-3 sm:gap-4">
                        <div class="relative aspect-[2/3] w-20 shrink-0 overflow-hidden rounded-2xl border-2 border-border bg-muted shadow-2xl sm:w-24">
                            ${coverImageLarge ? `<img src="${coverImageLarge}" class="size-full object-cover" />` : `<div class="flex size-full items-center justify-center text-xs text-muted-foreground">No Image</div>`}
                        </div>
                        <div class="flex min-w-0 flex-col pb-1">
                            <span class="inline-flex w-fit items-center gap-1 uppercase text-[9px] font-extrabold tracking-wider bg-primary/10 text-primary border border-primary/25 rounded-full px-2.5 py-0.5 mb-1 shadow-xs">
                                ${ICONS.sparkles} ${mediaType}
                            </span>
                            <h2 class="line-clamp-2 font-heading text-lg sm:text-xl font-bold tracking-tight text-foreground drop-shadow-md">
                                ${titleText}
                            </h2>
                        </div>
                    </div>

                    <div class="flex shrink-0 items-center gap-2 pb-1">
                        <button type="button" id="iris-fav-btn" class="flex size-9 cursor-pointer items-center justify-center rounded-2xl border backdrop-blur-md transition-all ${isFavorited ? 'border-primary/60 bg-primary/20 text-primary' : 'border-border/40 bg-background/60 text-foreground/80 hover:border-border hover:text-foreground'}" title="Toggle Favorite">
                            ${isFavorited ? ICONS.heartFilled : ICONS.heart}
                        </button>
                        <button type="button" id="iris-save-btn" class="h-9 cursor-pointer rounded-2xl bg-primary px-5 text-xs font-semibold text-primary-foreground shadow-lg transition-all hover:bg-primary/90">
                            Save
                        </button>
                    </div>
                </div>
            </div>

            <!-- Body Area -->
            <div class="flex flex-col gap-4 p-4 sm:p-5 overflow-y-auto iris-custom-scrollbar flex-1" id="iris-modal-body">
                <!-- Pill Navigation Tabs Bar -->
                <div class="inline-flex w-fit items-center gap-1 rounded-full border border-border bg-[#18171a]/80 p-1 backdrop-blur-md">
                    <button type="button" id="tab-btn-general" class="cursor-pointer rounded-full px-4 py-1.5 text-xs font-semibold transition-all bg-background text-foreground shadow-xs">
                        General
                    </button>
                    ${hasEpisodesTab ? `
                        <button type="button" id="tab-btn-episodes" class="cursor-pointer rounded-full px-4 py-1.5 text-xs font-semibold transition-all text-muted-foreground hover:text-foreground">
                            Episodes (<span id="episodes-badge-count">${mediaType === 'tv' ? watchedEpisodes.length : progress}</span>/${totalEpisodes ?? '?'})
                        </button>
                    ` : ''}
                    <button type="button" id="tab-btn-jellyfin" class="cursor-pointer rounded-full px-4 py-1.5 text-xs font-semibold transition-all text-muted-foreground hover:text-foreground">
                        Jellyfin
                    </button>
                </div>

                ${!mediaDetails ? `
                    <div class="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
                        <div class="flex flex-col gap-0.5">
                            <span class="font-bold">Iris #${irisId} not found or server unreachable</span>
                            <span class="text-[11px] text-amber-300/80">Check that your Iris Server URL points to your dev PC's IP address (not localhost) in Jellyfin Settings, or relink this title in the Jellyfin tab.</span>
                        </div>
                        <button type="button" onclick="document.getElementById('tab-btn-jellyfin')?.click()" class="bg-amber-500/25 hover:bg-amber-500/40 text-amber-100 text-xs font-bold px-3 py-1.5 rounded-xl shrink-0 cursor-pointer transition-all">
                            Jellyfin Tab &rarr;
                        </button>
                    </div>
                ` : ''}

                <!-- 1. GENERAL TAB PANE -->
                <div id="tab-pane-general" class="flex flex-col gap-3.5">
                    <!-- Status, Score, Rewatches, Dates Card -->
                    <div class="space-y-4 rounded-2xl border border-border bg-card p-4 shadow-xs">
                        <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
                            <!-- Status -->
                            <div class="space-y-1.5">
                                <label class="flex items-center gap-1.5 text-[10px] font-bold tracking-wider text-muted-foreground uppercase">Status</label>
                                <select id="iris-status-select" class="w-full bg-[#18171a] border border-[#2b282f] text-foreground h-9 px-3 text-xs font-semibold rounded-xl cursor-pointer">
                                    ${getStatusOptions(mediaType).map(opt => `<option value="${opt.value}" ${listStatus === opt.value ? 'selected' : ''}>${opt.label}</option>`).join('')}
                                </select>
                            </div>

                            <!-- Score -->
                            <div class="space-y-1.5">
                                <label class="flex items-center gap-1.5 text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                                    ${ICONS.star} Score (0 - 10)
                                </label>
                                <input type="number" id="iris-score-input" min="0" max="10" step="0.5" value="${score}" placeholder="0 - 10" class="w-full bg-[#18171a] border border-[#2b282f] text-foreground h-9 px-3 text-xs font-semibold rounded-xl" />
                            </div>

                            <!-- Rewatches -->
                            <div class="space-y-1.5">
                                <label class="flex items-center gap-1.5 text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                                    ${ICONS.rotateCcw} Total Rewatches
                                </label>
                                <input type="number" id="iris-rewatches-input" min="0" value="${rewatches}" class="w-full bg-[#18171a] border border-[#2b282f] text-foreground h-9 px-3 text-xs font-semibold rounded-xl" />
                            </div>

                            <!-- Anime Progress Input -->
                            ${mediaType === 'anime' ? `
                                <div class="space-y-1.5 sm:col-span-3">
                                    <label class="flex items-center gap-1.5 text-[10px] font-bold tracking-wider text-muted-foreground uppercase">Episode Progress</label>
                                    <input type="number" id="iris-anime-progress-input" min="0" max="${totalEpisodes || ''}" value="${progress}" placeholder="0 / ${totalEpisodes || '?'}" class="w-full bg-[#18171a] border border-[#2b282f] text-foreground h-9 px-3 text-xs font-semibold rounded-xl" />
                                </div>
                            ` : ''}
                        </div>

                        <!-- Dates Row -->
                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-border/40 pt-3">
                            <div class="space-y-1.5">
                                <label class="flex items-center gap-1.5 text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                                    ${ICONS.calendar} Start Date
                                </label>
                                <input type="date" id="iris-start-date" value="${startDateStr}" class="w-full bg-[#18171a] border border-[#2b282f] text-foreground h-9 px-3 text-xs font-medium rounded-xl" />
                            </div>
                            <div class="space-y-1.5">
                                <label class="flex items-center gap-1.5 text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                                    ${ICONS.calendar} Finish Date
                                </label>
                                <input type="date" id="iris-finish-date" value="${finishDateStr}" class="w-full bg-[#18171a] border border-[#2b282f] text-foreground h-9 px-3 text-xs font-medium rounded-xl" />
                            </div>
                        </div>
                    </div>

                    <!-- Personal Notes Card -->
                    <div class="space-y-2 rounded-2xl border border-border bg-card p-4 shadow-xs">
                        <label class="flex items-center gap-1.5 text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                            ${ICONS.note} Personal Notes
                        </label>
                        <textarea id="iris-notes-input" placeholder="Add personal notes..." class="w-full bg-[#18171a] border border-[#2b282f] text-foreground min-h-20 resize-y rounded-xl p-3 text-xs font-medium">${notes}</textarea>
                    </div>

                    <!-- Private Entry & Danger Actions -->
                    <div class="flex items-center justify-between gap-3 pt-1 flex-wrap">
                        <label class="flex items-center gap-2 cursor-pointer select-none text-xs text-muted-foreground hover:text-foreground">
                            <input type="checkbox" id="iris-private-checkbox" ${isPrivate ? 'checked' : ''} class="rounded border-[#2b282f] accent-primary" />
                            Private List Entry
                        </label>

                        <div class="flex items-center gap-2">
                            ${hasListEntry ? `
                                <button type="button" id="iris-delete-entry-btn" class="px-3.5 py-1.5 text-xs font-semibold rounded-xl text-destructive hover:bg-destructive/10 border border-destructive/30 transition-colors cursor-pointer">
                                    Remove From List
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
                            <div class="flex flex-col gap-2.5 max-h-[380px] overflow-y-auto iris-custom-scrollbar pr-1" id="iris-tv-seasons-container">
                                ${irisTvSeasons.map(s => {
                                    const sNum = s.seasonNumber;
                                    const eps = s.episodes || [];
                                    const epCount = s.episodeCount || eps.length;
                                    const watchedInSeason = eps.filter(ep => watchedEpisodes.some(w => (w.seasonNumber === sNum || w.seasonNum === sNum) && (w.episodeNumber === (ep.episodeNumber || ep.number) || w.episodeNum === (ep.episodeNumber || ep.number)))).length;
                                    const isComplete = epCount > 0 && watchedInSeason >= epCount;
                                    const percent = epCount > 0 ? Math.round((watchedInSeason / epCount) * 100) : 0;

                                    return `
                                        <div class="border border-border/60 rounded-2xl bg-card overflow-hidden shadow-xs" id="season-card-${sNum}">
                                            <div class="flex items-center justify-between p-3.5 bg-background/50 cursor-pointer select-none hover:bg-muted/40 transition-colors" onclick="window.irisToggleSeasonAccordion(${sNum})">
                                                <div class="flex items-center gap-3">
                                                    <input type="checkbox" id="season-chk-${sNum}" ${isComplete ? 'checked' : ''} onclick="event.stopPropagation(); window.irisToggleSeasonComplete(${sNum}, this.checked);" class="accent-primary cursor-pointer" />
                                                    <span class="font-bold text-xs sm:text-sm text-foreground">${s.title || `Season ${sNum}`}</span>
                                                </div>
                                                <div class="flex items-center gap-2.5">
                                                    <span id="season-badge-${sNum}" class="text-[10px] font-bold px-2.5 py-0.5 rounded-full ${isComplete ? 'bg-primary/15 text-primary border border-primary/25' : 'bg-muted text-muted-foreground border border-border/60'}">
                                                        ${watchedInSeason} / ${epCount || '?'} Ep (${percent}%)
                                                    </span>
                                                    <span id="chevron-season-${sNum}">${ICONS.chevronDown}</span>
                                                </div>
                                            </div>
                                            <div class="p-3 max-h-52 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-2 border-t border-border/50 bg-[#121113]/40 hidden iris-custom-scrollbar" id="season-eps-${sNum}">
                                                ${eps.map(ep => {
                                                    const epNum = ep.episodeNumber || ep.number;
                                                    const epTitle = ep.titlePrimary || ep.title || ep.name || `Episode ${epNum}`;
                                                    const isWatched = watchedEpisodes.some(w => (w.seasonNumber === sNum || w.seasonNum === sNum) && (w.episodeNumber === epNum || w.episodeNum === epNum));

                                                    return `
                                                        <button type="button" id="tv-ep-btn-${sNum}-${epNum}" class="flex items-center justify-between p-2.5 rounded-xl border text-left transition-all text-xs font-semibold cursor-pointer ${isWatched ? 'bg-primary/15 border-primary/40 text-primary shadow-xs' : 'bg-[#18171a] border-border/60 hover:bg-muted text-foreground'}" onclick="window.irisToggleTvEpisode(${sNum}, ${epNum})">
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
                            <div class="space-y-3 rounded-2xl border border-border bg-card p-4 shadow-xs">
                                <div class="flex items-center justify-between">
                                    <span id="iris-anime-episodes-header" class="text-xs font-bold text-foreground">Episodes (${progress} / ${totalEpisodes || '?'})</span>
                                    <div class="flex items-center gap-2">
                                        <button type="button" onclick="window.irisSetAnimeProgress(${totalEpisodes || 0})" class="text-[11px] font-semibold text-primary hover:underline cursor-pointer">Mark all as watched</button>
                                        <span class="text-muted-foreground/40">|</span>
                                        <button type="button" onclick="window.irisSetAnimeProgress(0)" class="text-[11px] font-semibold text-muted-foreground hover:text-foreground cursor-pointer">Clear</button>
                                    </div>
                                </div>
                                <div id="iris-anime-grid-container" class="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2 max-h-[300px] overflow-y-auto iris-custom-scrollbar pr-1">
                                    ${Array.from({ length: totalEpisodes || progress || 12 }, (_, i) => i + 1).map(num => {
                                        const isWatched = num <= progress;
                                        return `
                                            <button type="button" data-ep-num="${num}" onclick="window.irisSetAnimeProgress(${isWatched && num === progress ? num - 1 : num})" class="h-9 rounded-xl border text-xs font-bold transition-all cursor-pointer flex items-center justify-center ${isWatched ? 'bg-primary text-primary-foreground border-primary shadow-sm' : 'bg-[#18171a] border-[#2b282f] text-muted-foreground hover:text-foreground hover:border-border'}">
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
                    <div class="space-y-3 rounded-2xl border border-border bg-card p-4 shadow-xs">
                        <div class="flex items-center justify-between">
                            <label class="flex items-center gap-1.5 text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                                ${ICONS.deviceTv} Jellyfin Item Link
                            </label>
                            <span class="text-[10px] font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded-lg">${targetId}</span>
                        </div>

                        <div class="flex items-center justify-between bg-[#121113] border border-border/60 rounded-xl p-3 text-xs">
                            <div class="flex flex-col min-w-0">
                                <span class="font-bold text-foreground truncate">${jellyfinItem?.Name || fallbackTitle}</span>
                                <span class="text-[11px] text-primary font-semibold">Linked to Iris #${irisId} (${mediaType})</span>
                            </div>
                            <div class="flex items-center gap-2 shrink-0">
                                <button type="button" id="iris-change-link-btn" class="bg-primary/10 hover:bg-primary/20 text-primary border border-primary/25 text-xs font-semibold px-3 py-1.5 rounded-xl cursor-pointer transition-all">
                                    Change Link
                                </button>
                                <button type="button" id="iris-unlink-mapping-btn" class="bg-transparent hover:bg-destructive/15 text-destructive border border-destructive/30 text-xs font-semibold px-3 py-1.5 rounded-xl cursor-pointer transition-all">
                                    Unlink
                                </button>
                            </div>
                        </div>
                    </div>

                    <!-- Jellyfin Seasons Linking Section (Only for TV / Anime, NEVER for movies) -->
                    ${(!effectiveIsMovie && jellyfinSeasons.length > 0) ? `
                        <div class="space-y-3 rounded-2xl border border-border bg-card p-4 shadow-xs">
                            <div class="flex items-center justify-between">
                                <label class="flex items-center gap-1.5 text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                                    ${ICONS.link} Seasons & Linked Iris Media
                                </label>
                                <span class="text-[10px] text-muted-foreground font-semibold bg-muted px-2 py-0.5 rounded-lg">${jellyfinSeasons.length} Seasons</span>
                            </div>

                            <div class="flex flex-col gap-2 max-h-[260px] overflow-y-auto pr-1 iris-custom-scrollbar">
                                ${jellyfinSeasons.map(s => {
                                    const sMap = seasonMappings[s.Id];
                                    const isMapped = Boolean(sMap && (sMap.irisMediaId || sMap.aquilaMediaId));
                                    const sIrisId = sMap?.irisMediaId || sMap?.aquilaMediaId;
                                    const sTitle = sMap?.resolvedTitle || (isMapped ? `Iris #${sIrisId}` : 'Unlinked (not mapped)');
                                    const safeName = (s.Name || 'Season').replace(/'/g, "\\'");

                                    return `
                                        <div class="flex items-center justify-between bg-[#121113] border border-border/60 rounded-xl p-2.5 px-3 text-xs shrink-0">
                                            <div class="flex items-center gap-2 min-w-0">
                                                <span class="font-extrabold text-[10px] text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-lg shrink-0">${s.Name}</span>
                                                ${isMapped ? `
                                                    <span class="font-bold text-foreground truncate max-w-[160px] sm:max-w-[260px]">${sTitle}</span>
                                                    <span class="font-mono text-[10px] text-muted-foreground font-semibold shrink-0">#${sIrisId}</span>
                                                ` : `
                                                    <span class="text-muted-foreground/70 italic text-[11px]">Unlinked (not mapped)</span>
                                                `}
                                            </div>
                                            <div class="flex items-center gap-1 shrink-0">
                                                ${isMapped ? `
                                                    <button type="button" class="p-1.5 text-primary hover:bg-primary/15 rounded-lg cursor-pointer text-xs font-bold" onclick="window.irisEditSeasonMedia('${s.Id}', '${mediaType}', ${sIrisId}, '${safeName}')">✏️ Edit</button>
                                                    <button type="button" class="p-1 text-destructive hover:bg-destructive/15 rounded-lg cursor-pointer text-xs font-semibold" onclick="window.irisUnlinkSeasonMedia('${s.Id}')">Unlink</button>
                                                ` : `
                                                    <button type="button" class="bg-primary/10 hover:bg-primary/20 text-primary border border-primary/25 text-[11px] font-bold px-2.5 py-1 rounded-xl cursor-pointer transition-all" onclick="window.irisLinkSeasonMedia('${s.Id}', '${safeName}')">+ Link Media</button>
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

        document.getElementById('iris-modal-close').addEventListener('click', closeModal);

        // Tab Switching Logic
        const tabGenBtn = document.getElementById('tab-btn-general');
        const tabEpsBtn = document.getElementById('tab-btn-episodes');
        const tabJellyfinBtn = document.getElementById('tab-btn-jellyfin');
        const paneGen = document.getElementById('tab-pane-general');
        const paneEps = document.getElementById('tab-pane-episodes');
        const paneJellyfin = document.getElementById('tab-pane-jellyfin');

        const setActiveTab = (tab) => {
            activeTab = tab;
            [tabGenBtn, tabEpsBtn, tabJellyfinBtn].forEach(btn => {
                if (btn) btn.className = "cursor-pointer rounded-full px-4 py-1.5 text-xs font-semibold transition-all text-muted-foreground hover:text-foreground";
            });
            [paneGen, paneEps, paneJellyfin].forEach(pane => {
                if (pane) {
                    pane.classList.add('hidden');
                    pane.classList.remove('flex');
                }
            });

            if (tab === "general" && tabGenBtn && paneGen) {
                tabGenBtn.className = "cursor-pointer rounded-full px-4 py-1.5 text-xs font-semibold transition-all bg-background text-foreground shadow-xs";
                paneGen.classList.remove('hidden');
                paneGen.classList.add('flex');
            } else if (tab === "episodes" && tabEpsBtn && paneEps) {
                tabEpsBtn.className = "cursor-pointer rounded-full px-4 py-1.5 text-xs font-semibold transition-all bg-background text-foreground shadow-xs";
                paneEps.classList.remove('hidden');
                paneEps.classList.add('flex');
            } else if (tab === "jellyfin" && tabJellyfinBtn && paneJellyfin) {
                tabJellyfinBtn.className = "cursor-pointer rounded-full px-4 py-1.5 text-xs font-semibold transition-all bg-background text-foreground shadow-xs";
                paneJellyfin.classList.remove('hidden');
                paneJellyfin.classList.add('flex');
            }
        };

        tabGenBtn?.addEventListener('click', () => setActiveTab("general"));
        tabEpsBtn?.addEventListener('click', () => setActiveTab("episodes"));
        tabJellyfinBtn?.addEventListener('click', () => setActiveTab("jellyfin"));

        // Global functions for episode and season interactions
        window.irisToggleSeasonAccordion = (sNum) => {
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
            const season = irisTvSeasons.find(s => s.seasonNumber === sNum);
            const eps = season?.episodes || [];
            const epCount = season?.episodeCount || eps.length;
            const watchedInSeason = eps.filter(ep => watchedEpisodes.some(w => (w.seasonNumber === sNum || w.seasonNum === sNum) && (w.episodeNumber === (ep.episodeNumber || ep.number) || w.episodeNum === (ep.episodeNumber || ep.number)))).length;
            const isComplete = epCount > 0 && watchedInSeason >= epCount;
            const percent = epCount > 0 ? Math.round((watchedInSeason / epCount) * 100) : 0;

            const chk = document.getElementById(`season-chk-${sNum}`);
            if (chk) chk.checked = isComplete;

            const badgeSpan = document.getElementById(`season-badge-${sNum}`);
            if (badgeSpan) {
                badgeSpan.className = `text-[10px] font-bold px-2.5 py-0.5 rounded-full ${isComplete ? 'bg-primary/15 text-primary border border-primary/25' : 'bg-muted text-muted-foreground border border-border/60'}`;
                badgeSpan.innerText = `${watchedInSeason} / ${epCount || '?'} Ep (${percent}%)`;
            }
        }

        window.irisToggleTvEpisode = (sNum, epNum) => {
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
                    epBtn.className = 'flex items-center justify-between p-2.5 rounded-xl border text-left transition-all text-xs font-semibold cursor-pointer bg-primary/15 border-primary/40 text-primary shadow-xs';
                    const iconSpan = epBtn.querySelector('.tv-ep-check');
                    if (iconSpan) iconSpan.innerHTML = ICONS.check;
                } else {
                    epBtn.className = 'flex items-center justify-between p-2.5 rounded-xl border text-left transition-all text-xs font-semibold cursor-pointer bg-[#18171a] border-border/60 hover:bg-muted text-foreground';
                    const iconSpan = epBtn.querySelector('.tv-ep-check');
                    if (iconSpan) iconSpan.innerHTML = '';
                }
            }

            updateSeasonBadgeAndCheckbox(sNum);
            const badge = document.getElementById('episodes-badge-count');
            if (badge) badge.innerText = watchedEpisodes.length;
        };

        window.irisToggleSeasonComplete = (sNum, isChecked) => {
            const season = irisTvSeasons.find(s => s.seasonNumber === sNum);
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
                        epBtn.className = 'flex items-center justify-between p-2.5 rounded-xl border text-left transition-all text-xs font-semibold cursor-pointer bg-primary/15 border-primary/40 text-primary shadow-xs';
                        const iconSpan = epBtn.querySelector('.tv-ep-check');
                        if (iconSpan) iconSpan.innerHTML = ICONS.check;
                    } else {
                        epBtn.className = 'flex items-center justify-between p-2.5 rounded-xl border text-left transition-all text-xs font-semibold cursor-pointer bg-[#18171a] border-border/60 hover:bg-muted text-foreground';
                        const iconSpan = epBtn.querySelector('.tv-ep-check');
                        if (iconSpan) iconSpan.innerHTML = '';
                    }
                }
            });

            updateSeasonBadgeAndCheckbox(sNum);
            const badge = document.getElementById('episodes-badge-count');
            if (badge) badge.innerText = watchedEpisodes.length;
        };

        window.irisSetAnimeProgress = (newProg) => {
            progress = Math.max(0, newProg);
            const progInput = document.getElementById('iris-anime-progress-input');
            if (progInput) progInput.value = progress;
            const badge = document.getElementById('episodes-badge-count');
            if (badge) badge.innerText = progress;

            const headerEl = document.getElementById('iris-anime-episodes-header');
            if (headerEl) headerEl.innerText = `Episodes (${progress} / ${totalEpisodes || '?'})`;

            const grid = document.getElementById('iris-anime-grid-container');
            if (grid) {
                grid.querySelectorAll('button[data-ep-num]').forEach(btn => {
                    const num = parseInt(btn.getAttribute('data-ep-num'), 10);
                    const isWatched = num <= progress;
                    if (isWatched) {
                        btn.className = 'h-9 rounded-xl border text-xs font-bold transition-all cursor-pointer flex items-center justify-center bg-primary text-primary-foreground border-primary shadow-sm';
                    } else {
                        btn.className = 'h-9 rounded-xl border text-xs font-bold transition-all cursor-pointer flex items-center justify-center bg-[#18171a] border-[#2b282f] text-muted-foreground hover:text-foreground hover:border-border';
                    }
                    btn.setAttribute('onclick', `window.irisSetAnimeProgress(${isWatched && num === progress ? num - 1 : num})`);
                });
            }
        };

        // Jellyfin season mapping actions
        window.irisLinkSeasonMedia = (seasonId, seasonName) => {
            renderSearchView(userId, seasonId, mediaType, `${titleText} ${seasonName}`, candidateIds, false, jellyfinItem, () => {
                renderFullEditDialog(userId, targetId, mediaType, irisId, fallbackTitle, candidateIds, isMovie, jellyfinItem).then(() => {
                    setActiveTab("jellyfin");
                });
            });
        };

        window.irisEditSeasonMedia = (seasonId, sType, sIrisId, seasonName) => {
            renderFullEditDialog(userId, seasonId, sType, sIrisId, `${titleText} ${seasonName}`, candidateIds, false, jellyfinItem);
        };

        window.irisUnlinkSeasonMedia = async (seasonId) => {
            try {
                await fetch(getProxyUrl(`Iris/Api/Mapping?userId=${encodeURIComponent(userId || '')}&itemId=${encodeURIComponent(seasonId)}`), { method: 'DELETE' });
                renderFullEditDialog(userId, targetId, mediaType, irisId, fallbackTitle, candidateIds, isMovie, jellyfinItem).then(() => {
                    setActiveTab("jellyfin");
                });
            } catch (e) {
                console.error('[Iris Plugin] Failed to unlink season:', e);
            }
        };

        // Favorite Toggle
        const favBtn = document.getElementById('iris-fav-btn');
        favBtn.addEventListener('click', async () => {
            const nextState = !isFavorited;
            isFavorited = nextState;
            favBtn.className = `flex size-9 cursor-pointer items-center justify-center rounded-2xl border backdrop-blur-md transition-all ${isFavorited ? 'border-primary/60 bg-primary/20 text-primary' : 'border-border/40 bg-background/60 text-foreground/80 hover:border-border hover:text-foreground'}`;
            favBtn.innerHTML = isFavorited ? ICONS.heartFilled : ICONS.heart;

            try {
                if (nextState) {
                    await fetch(getProxyUrl(`Iris/Api/Favorite?mediaType=${encodeURIComponent(mediaType)}&id=${irisId}&title=${encodeURIComponent(titleText)}`), { method: 'POST' });
                } else {
                    await fetch(getProxyUrl(`Iris/Api/Favorite?mediaType=${encodeURIComponent(mediaType)}&id=${irisId}`), { method: 'DELETE' });
                }
            } catch (e) {
                console.error('[Iris Plugin] Failed to toggle favorite:', e);
            }
        });

        // Change Link button (on Jellyfin tab)
        document.getElementById('iris-change-link-btn')?.addEventListener('click', () => {
            renderSearchView(userId, targetId, mediaType, titleText, candidateIds, isMovie, jellyfinItem);
        });

        // Unlink button (on Jellyfin tab)
        document.getElementById('iris-unlink-mapping-btn')?.addEventListener('click', async () => {
            try {
                const candParam = (candidateIds && candidateIds.length > 0) ? `&candidateIds=${encodeURIComponent(candidateIds.join(','))}` : '';
                await fetch(getProxyUrl(`Iris/Api/Mapping?userId=${encodeURIComponent(userId || '')}&itemId=${encodeURIComponent(targetId)}${candParam}`), { method: 'DELETE' });
                renderSearchView(userId, targetId, mediaType, titleText, candidateIds, isMovie, jellyfinItem);
            } catch (e) {
                console.error('[Iris Plugin] Error unlinking mapping:', e);
            }
        });

        // Delete entry button (on General tab)
        document.getElementById('iris-delete-entry-btn')?.addEventListener('click', async () => {
            if (!confirm(`Are you sure you want to remove this ${mediaType} from your Iris list?`)) return;
            try {
                const res = await fetch(getProxyUrl(`Iris/Api/Entry?mediaType=${encodeURIComponent(mediaType)}&id=${irisId}`), { method: 'DELETE' });
                if (res.ok) closeModal();
                else alert('Failed to delete entry from Iris.');
            } catch (e) {
                alert('Error deleting entry from Iris.');
            }
        });

        // Save Entry Button
        document.getElementById('iris-save-btn').addEventListener('click', async () => {
            const saveBtn = document.getElementById('iris-save-btn');
            saveBtn.disabled = true;
            saveBtn.innerText = 'Saving...';

            const statusSelect = document.getElementById('iris-status-select');
            const currentStatus = statusSelect ? statusSelect.value : listStatus;
            const scoreVal = document.getElementById('iris-score-input')?.value;
            const rewatchesVal = document.getElementById('iris-rewatches-input')?.value;
            const progInput = document.getElementById('iris-anime-progress-input');
            const notesVal = document.getElementById('iris-notes-input')?.value;
            const startVal = document.getElementById('iris-start-date')?.value;
            const finishVal = document.getElementById('iris-finish-date')?.value;
            const privChecked = document.getElementById('iris-private-checkbox')?.checked;

            const finalProg = mediaType === 'anime' && progInput ? parseInt(progInput.value, 10) : (mediaType === 'tv' ? watchedEpisodes.length : 0);

            const dto = {
                status: currentStatus,
                score: scoreVal ? parseFloat(scoreVal) : null,
                notes: notesVal ? notesVal.trim() : null,
                rewatched: rewatchesVal ? parseInt(rewatchesVal, 10) : 0,
                private: privChecked ?? false,
                startedAt: startVal ? new Date(startVal).toISOString() : null,
                completedAt: finishVal ? new Date(finishVal).toISOString() : null,
                progress: finalProg
            };

            if (mediaType === 'tv') {
                dto.watchedEpisodes = watchedEpisodes;
                dto.seasons = irisTvSeasons.map(s => {
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
                const res = await fetch(getProxyUrl(`Iris/Api/Save?mediaType=${encodeURIComponent(mediaType)}&id=${irisId}`), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(dto)
                });

                if (res.ok) {
                    closeModal();
                } else {
                    alert('Failed to save list entry to Iris.');
                    saveBtn.disabled = false;
                    saveBtn.innerText = 'Save';
                }
            } catch (err) {
                console.error('[Iris Plugin] Save exception:', err);
                alert('Error saving entry to Iris server.');
                saveBtn.disabled = false;
                saveBtn.innerText = 'Save';
            }
        });
    }

    function getStatusOptions(mediaType) {
        if (mediaType === "movie") {
            return [
                { value: "PLANNING", label: "Planning" },
                { value: "COMPLETED", label: "Completed" },
                { value: "DROPPED", label: "Dropped" }
            ];
        }
        return [
            { value: "PLANNING", label: "Planning" },
            { value: "WATCHING", label: "Watching" },
            { value: "COMPLETED", label: "Completed" },
            { value: "ON_HOLD", label: "On Hold" },
            { value: "DROPPED", label: "Dropped" }
        ];
    }

    function createIrisButton() {
        const btn = document.createElement('button');
        btn.setAttribute('is', 'emby-button');
        btn.setAttribute('type', 'button');
        btn.className = 'button-flat btnIrisEditModal detailButton emby-button';
        btn.title = 'Manage in Iris';
        btn.innerHTML = `
            <div class="detailButton-content">
                <span class="detailButton-icon" style="display:inline-flex; align-items:center; justify-content:center; width:24px; height:24px;">
                    ${ICONS.iris}
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

            console.log(`[Iris WebClient] Iris button clicked: Resolved itemId=${itemId} (isVideoOSD=${isVideoOSD})`);
            if (itemId) handleIrisButtonClick(itemId);
        });

        return btn;
    }

    function injectInlineButtons() {
        const favButtons = document.querySelectorAll('.btnUserRating, button[is="emby-ratingbutton"], .btnFavorite, .btnDetailFavorite, button[data-action="favorite"], button[data-action="like"], .btnOsdUserData');
        favButtons.forEach(favBtn => {
            if (favBtn.closest('.card, .cardOverlay, .cardOverlayButton, .cardFooter, .cardOverlayContainer, .innerCardFooter, .itemCard')) {
                return;
            }

            const parent = favBtn.parentNode;
            if (parent && !parent.querySelector('.btnIrisEditModal')) {
                const btn = createIrisButton();
                parent.insertBefore(btn, favBtn.nextSibling);
            }
        });

        const containers = document.querySelectorAll('.mainDetailButtons, .detailButtons, .osdRightControls, .osdControls-right, .osdBottomControls, .videoOsd, .osd-buttons, .videoOsdBottom');
        containers.forEach(container => {
            if (container.closest('.card, .cardOverlay, .cardOverlayButton, .cardFooter, .cardOverlayContainer, .innerCardFooter, .itemCard')) {
                return;
            }

            if (container.querySelector('.btnIrisEditModal')) return;

            const btn = createIrisButton();
            container.appendChild(btn);
        });

        document.querySelectorAll('.card .btnIrisEditModal, .cardOverlay .btnIrisEditModal, .cardOverlayButtonContainer .btnIrisEditModal, .innerCardFooter .btnIrisEditModal, .itemCard .btnIrisEditModal').forEach(btn => {
            btn.remove();
        });
    }

    function processUiUpdates() {
        try {
            injectStylesAndTailwind();
            injectInlineButtons();
        } catch (e) {
            console.error('[Iris Plugin] Exception during UI iteration:', e);
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
