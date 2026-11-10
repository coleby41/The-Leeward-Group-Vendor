/* ===========================================================
   VENDOR PORTAL — shared code for every page
   - Talks only to the vendor Edge Functions (vendor-auth, vendor-api,
     vendor-apply). Vendors never get a Supabase login, so none of the
     staff tables are reachable from here.
   - Keeps the portal session token in localStorage ("vp-session").
   - English / Spanish (js/i18n.js) with the language circle.
   - Draws the top bar, footer and phone tab bar on signed-in pages.
=========================================================== */
(function () {
    "use strict";

    const CFG = window.VENDOR_PORTAL_CONFIG || {};
    const STR = window.VP_STRINGS || { en: {}, es: {} };
    const TZ = "America/New_York";

    /* ---------- storage (never throws) ---------- */
    const store = {
        get(k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } },
        set(k, v) { try { if (v == null) window.localStorage.removeItem(k); else window.localStorage.setItem(k, v); } catch (e) { /* private mode */ } },
    };

    /* ---------- language ---------- */
    let lang = store.get("vp-lang");
    if (lang !== "en" && lang !== "es") lang = /^es\b/i.test(navigator.language || "") ? "es" : "en";

    function esc(value) {
        return String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    }

    // Plain text. Use tHtml() for the keys ending in "Html".
    function t(key, vars) {
        let s = (STR[lang] && STR[lang][key]) ?? (STR.en && STR.en[key]) ?? key;
        if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] ?? ""));
        return s;
    }
    function tHtml(key, vars) {
        let s = (STR[lang] && STR[lang][key]) ?? (STR.en && STR.en[key]) ?? esc(key);
        if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => esc(vars[k] ?? ""));
        return s;
    }

    function applyI18n(root) {
        const scope = root || document;
        scope.querySelectorAll("[data-i18n]").forEach(el => { el.textContent = t(el.dataset.i18n); });
        scope.querySelectorAll("[data-i18n-html]").forEach(el => { el.innerHTML = tHtml(el.dataset.i18nHtml); });
        scope.querySelectorAll("[data-i18n-ph]").forEach(el => { el.setAttribute("placeholder", t(el.dataset.i18nPh)); });
        scope.querySelectorAll("[data-i18n-aria]").forEach(el => { el.setAttribute("aria-label", t(el.dataset.i18nAria)); });
        document.documentElement.lang = lang;
        const titleKey = document.documentElement.dataset.title;
        if (titleKey) document.title = t(titleKey);
    }

    function setLang(next, { save = true } = {}) {
        if (next !== "en" && next !== "es") return;
        const changed = next !== lang;
        lang = next;
        store.set("vp-lang", lang);
        applyI18n(document);
        document.querySelectorAll('.lang-fab input[name="vendor-lang"]').forEach(i => { i.checked = i.value === lang; });
        document.querySelectorAll("[data-set-lang]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.setLang === lang)));
        if (changed) document.dispatchEvent(new CustomEvent("vp:lang", { detail: { lang } }));
        // Their emails follow this too.
        if (save && changed && getSession()) api("vendor-api", "set_language", { language: lang });
    }

    function mountLangFab() {
        if (document.querySelector(".lang-fab")) return;
        const fab = document.createElement("details");
        fab.className = "lang-fab";
        fab.innerHTML = `
            <summary aria-label="Language / Idioma">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M3 12h18"></path><path d="M12 3a14 14 0 0 1 0 18a14 14 0 0 1 0-18z"></path></svg>
                <span class="lang-fab__code"></span>
                <span class="lang-fab__hint">Change language · Cambiar idioma</span>
            </summary>
            <div class="lang-fab__menu" role="radiogroup" aria-label="Language">
                <p class="lang-fab__title">Language · Idioma</p>
                <label class="lang-fab__opt"><input type="radio" name="vendor-lang" value="en"><span>English</span><small>EN</small></label>
                <label class="lang-fab__opt"><input type="radio" name="vendor-lang" value="es"><span>Español</span><small>ES</small></label>
            </div>`;
        document.body.appendChild(fab);
        if (store.get("vp-lang-picked")) fab.classList.add("is-picked");
        fab.querySelectorAll("input").forEach(i => {
            i.checked = i.value === lang;
            i.addEventListener("change", () => {
                setLang(i.value);
                fab.open = false;
                store.set("vp-lang-picked", "1");
                fab.classList.add("is-picked");
            });
        });
        document.addEventListener("click", e => { if (fab.open && !fab.contains(e.target)) fab.open = false; });
        document.addEventListener("keydown", e => { if (e.key === "Escape") fab.open = false; });
    }

    /* ---------- formatting ---------- */
    const locale = () => (lang === "es" ? "es-US" : "en-US");

    function fmtDateTime(iso) {
        if (!iso) return "";
        const d = new Date(iso);
        if (Number.isNaN(d.getTime())) return "";
        return d.toLocaleString(locale(), { timeZone: TZ, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
    }
    function fmtShort(iso) {
        if (!iso) return "";
        const d = new Date(iso);
        if (Number.isNaN(d.getTime())) return "";
        return d.toLocaleString(locale(), { timeZone: TZ, month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
    }
    // A date-only value like "2026-11-15".
    function fmtDay(value, withYear = true) {
        if (!value) return "";
        const d = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00`) : new Date(value);
        if (Number.isNaN(d.getTime())) return "";
        const opts = { month: "short", day: "numeric", ...(withYear ? { year: "numeric" } : {}) };
        if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) opts.timeZone = TZ;
        return d.toLocaleDateString(locale(), opts);
    }
    function fmtMoney(n) {
        if (n == null || n === "") return "";
        return Number(n).toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 2 });
    }
    function daysLeft(iso) {
        const ms = new Date(iso).getTime() - Date.now();
        if (!(ms > 0)) return null;
        return Math.ceil(ms / 86400000);
    }
    function daysLeftText(iso) {
        const ms = new Date(iso).getTime() - Date.now();
        if (!(ms > 0)) return "";
        if (ms < 86400000 && new Date(iso).toDateString() === new Date().toDateString()) return t("days.today");
        const n = Math.ceil(ms / 86400000);
        return n === 1 ? t("days.one") : t("days.left", { n });
    }

    /* ---------- session ---------- */
    const getSession = () => store.get("vp-session");
    const setSession = token => store.set("vp-session", token || null);

    /* ---------- page data cache (instant pages) ----------
       Every page used to wait on the server before showing anything. Now
       each read (me, invites, invite, projects, project, profile) is
       remembered for this browser session; a page shows the remembered
       copy instantly and swaps in the fresh one when it arrives (usually
       identical, so nothing visibly changes). Same idea as the Staff
       Portal. Cleared on sign out; tied to the session token. */
    const READ_ACTIONS = new Set(["me", "invites", "invite", "projects", "project", "profile"]);
    // Bump CACHE_VERSION whenever vendor-api's answers change shape (new or
    // renamed fields). Copies saved by an older version are thrown away, so
    // a page never flashes a stale copy that's missing the new fields.
    const CACHE_VERSION = "2";
    const CACHE_PREFIX = `vp-c:v${CACHE_VERSION}:`;
    const ME_KEY = `vp-me:v${CACHE_VERSION}`;
    // Drop copies left by older versions (they never match again anyway).
    try {
        Object.keys(window.sessionStorage)
            .filter(k => (k.startsWith("vp-c:") && !k.startsWith(CACHE_PREFIX)) || (k.startsWith("vp-me") && k !== ME_KEY))
            .forEach(k => window.sessionStorage.removeItem(k));
    } catch (e) { /* private mode */ }
    function cacheKey(fn, action, body) {
        const b = { ...body }; delete b.session;
        return `${CACHE_PREFIX}${fn}:${action}:${JSON.stringify(b)}`;
    }
    function peek(fn, action, body = {}) {
        try {
            const c = JSON.parse(window.sessionStorage.getItem(cacheKey(fn, action, body)) || "null");
            return c && c.s === getSession() && c.d && c.d.ok ? c.d : null;
        } catch (e) { return null; }
    }
    function remember(fn, action, body, data) {
        if (!data || !data.ok || !READ_ACTIONS.has(action)) return;
        try { window.sessionStorage.setItem(cacheKey(fn, action, body), JSON.stringify({ s: getSession(), d: data })); } catch (e) { /* full / private mode */ }
    }
    function clearCache() {
        try {
            Object.keys(window.sessionStorage).filter(k => k.startsWith("vp-c:")).forEach(k => window.sessionStorage.removeItem(k));
        } catch (e) { /* ignore */ }
    }
    // { cached, fresh }: cached = last copy (or null), fresh = promise of the server's answer.
    function swr(action, body = {}) {
        return { cached: peek("vendor-api", action, body), fresh: api("vendor-api", action, body) };
    }
    const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
    // Save an answer we already have (e.g. each project from the My Projects
    // list) as if the server had sent it, so that page opens instantly.
    function seed(action, body, data) { remember("vendor-api", action, body, data); }

    /* ---------- API ---------- */
    async function api(fn, action, body = {}) {
        if (!CFG.supabaseUrl) return { ok: false, error: "network" };
        const payload = { action, ...body };
        if (fn === "vendor-api") payload.session = getSession();
        let res;
        try {
            res = await fetch(`${CFG.supabaseUrl.replace(/\/$/, "")}/functions/v1/${fn}`, {
                method: "POST",
                headers: { "Content-Type": "application/json", apikey: CFG.anonKey, Authorization: `Bearer ${CFG.anonKey}` },
                body: JSON.stringify(payload),
            });
        } catch (e) {
            return { ok: false, error: "network" };
        }
        let data = null;
        try { data = await res.json(); } catch (e) { /* not JSON */ }
        if (!data) return { ok: false, error: res.ok ? "generic" : "network" };
        if (data.ok === false && data.error === "signed_out" && fn === "vendor-api") {
            setSession(null);
            const next = encodeURIComponent(location.pathname.split("/").pop() + location.search);
            location.replace(`index.html?next=${next}`);
            return new Promise(() => {}); // page is leaving
        }
        remember(fn, action, body, data);
        return data;
    }

    function errText(code) {
        const key = `err.${code}`;
        const s = t(key);
        return s === key ? t("err.generic") : s;
    }

    /* ---------- uploads (straight to Storage with a one-time slot) ---------- */
    let storageClient = null;
    async function uploadToSlot(slot, file) {
        try {
            if (!storageClient) {
                if (!window.supabase || !window.supabase.createClient) throw new Error("supabase-js missing");
                storageClient = window.supabase.createClient(CFG.supabaseUrl, CFG.anonKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
            }
            const { error } = await storageClient.storage.from(slot.bucket).uploadToSignedUrl(slot.path, slot.token, file, { contentType: "application/pdf" });
            return !error;
        } catch (e) {
            console.error("Upload failed:", e);
            return false;
        }
    }

    /* ---------- file preview (in the portal — never a new tab) ---------- */
    let previewEl = null;
    let previewReq = null;

    function previewKind(name) {
        const n = String(name || "").toLowerCase();
        if (/\.pdf$/.test(n)) return "pdf";
        if (/\.(png|jpe?g|gif|webp|bmp|svg|heic|heif)$/.test(n)) return "image";
        return "other";
    }

    function closePreview() {
        if (!previewEl) return;
        previewEl.classList.add("hidden");
        previewEl.querySelector(".file-preview-body").innerHTML = "";
        if (!document.querySelector(".popup-overlay:not(.hidden)")) document.body.classList.remove("popup-active");
        previewReq = null;
    }

    // preview({ name, getUrl, getDownloadUrl }) — both getters resolve to a URL.
    async function preview(req) {
        if (!previewEl) {
            previewEl = document.createElement("div");
            previewEl.className = "popup-overlay hidden";
            previewEl.id = "vpPreviewOverlay";
            previewEl.innerHTML = `
                <div class="popup popup--preview" role="dialog" aria-modal="true" aria-labelledby="vpPreviewTitle">
                    <div class="file-preview-header">
                        <h2 id="vpPreviewTitle"></h2>
                        <div style="display:flex;align-items:center;gap:8px;flex:0 0 auto">
                            <button type="button" class="workbook-btn workbook-btn--download" data-preview="download"></button>
                            <button type="button" class="file-preview-close-btn" data-preview="close">✕</button>
                        </div>
                    </div>
                    <div class="file-preview-body"></div>
                </div>`;
            document.body.appendChild(previewEl);
            previewEl.addEventListener("click", async e => {
                if (e.target === previewEl || e.target.closest('[data-preview="close"]')) { closePreview(); return; }
                if (e.target.closest('[data-preview="download"]') && previewReq) {
                    const r = previewReq;
                    const url = await r.getDownloadUrl().catch(() => null);
                    if (url) downloadUrl(url, r.name);
                }
            });
            document.addEventListener("keydown", e => { if (e.key === "Escape" && previewEl && !previewEl.classList.contains("hidden")) closePreview(); });
        }
        previewReq = req;
        const body = previewEl.querySelector(".file-preview-body");
        previewEl.querySelector("#vpPreviewTitle").textContent = req.name || "";
        previewEl.querySelector('[data-preview="download"]').textContent = t("btn.download");
        previewEl.querySelector('[data-preview="download"]').classList.toggle("hidden", !req.getDownloadUrl);
        previewEl.querySelector('[data-preview="close"]').setAttribute("aria-label", t("preview.close"));
        body.innerHTML = `<div class="file-preview-loading">${esc(t("preview.loading"))}</div>`;
        previewEl.classList.remove("hidden");
        document.body.classList.add("popup-active");
        const url = await req.getUrl().catch(() => null);
        if (previewReq !== req) return;
        if (!url) { body.innerHTML = `<div class="file-preview-error">${esc(t("preview.error"))}</div>`; return; }
        const kind = req.kind || previewKind(req.name);
        if (kind === "image") {
            body.innerHTML = `<img class="file-preview-image" alt="${esc(req.name || "")}">`;
            body.querySelector("img").src = url;
        } else if (kind === "pdf") {
            body.innerHTML = `<iframe class="file-preview-frame" title="${esc(req.name || "")}"></iframe>`;
            body.querySelector("iframe").src = url;
        } else {
            body.innerHTML = `<div class="file-preview-unsupported"><p>${esc(t("preview.unsupported"))}</p></div>`;
        }
    }

    // Saves a file without leaving the page (the URL is a signed "download" link).
    function downloadUrl(url, name) {
        const a = document.createElement("a");
        a.href = url;
        if (name) a.download = name;
        a.rel = "noopener";
        document.body.appendChild(a);
        a.click();
        a.remove();
    }

    /* ---------- messages ---------- */
    function setMessage(el, text, type) {
        if (!el) return;
        el.textContent = text || "";
        el.className = `auth-message ${type || ""}`.trim();
        el.classList.toggle("hidden", !text);
    }

    function markFields(form, fields) {
        form.querySelectorAll(".is-invalid").forEach(el => el.classList.remove("is-invalid"));
        (fields || []).forEach(name => {
            const input = form.querySelector(`[name="${name}"]`);
            if (input) input.classList.add("is-invalid");
        });
        const first = form.querySelector(".is-invalid");
        if (first) first.focus();
    }

    /* ---------- signed-in shell ---------- */
    let me = null;

    // Who's signed in. The answer is cached for this browser tab session so
    // the header/sidebar draw instantly on every page; it's refreshed in the
    // background (and a signed-out session still sends them to sign in).
    function readMeCache() {
        try {
            const c = JSON.parse(window.sessionStorage.getItem(ME_KEY) || "null");
            return c && c.session === getSession() && c.data && c.data.ok ? c.data : null;
        } catch (e) { return null; }
    }
    function writeMeCache(data) {
        try { window.sessionStorage.setItem(ME_KEY, JSON.stringify({ session: getSession(), data })); } catch (e) { /* ignore */ }
    }

    async function requireMe({ allowPending = false } = {}) {
        if (!getSession()) {
            const next = encodeURIComponent(location.pathname.split("/").pop() + location.search);
            location.replace(`index.html?next=${next}`);
            return new Promise(() => {});
        }
        const cached = readMeCache();
        const fresh = api("vendor-api", "me").then(d => { if (d && d.ok) writeMeCache(d); return d; });
        // Waiting-for-approval vendors always re-check, so approval shows up right away.
        const data = cached && cached.company ? cached : await fresh;
        if (!data.ok) return { error: data.error };
        me = data;
        if (!data.company && !allowPending) {
            location.replace("pending.html");
            return new Promise(() => {});
        }
        return data;
    }

    async function signOut() {
        const token = getSession();
        setSession(null);
        try { window.sessionStorage.removeItem(ME_KEY); } catch (e) { /* ignore */ }
        clearCache();
        if (token) await api("vendor-auth", "sign_out", { session: token });
        location.replace("index.html");
    }

    /* ---------- Signed-in shell (2026-11-10 redesign) ----------
       Light top bar with the Leeward mark, tabs (Invites, Projects,
       Company, Help), EN/ES switch and the account menu, the two brand
       waves as its bottom edge, a navy footer, and on phones a bottom tab
       bar. Replaces the staff-style dark sidebar. Styles: css/theme.css. */
    const ICONS = {
        invites: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 4h16v16H4z"></path><path d="M4 9h16"></path><path d="M9 13h6"></path></svg>',
        projects: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path></svg>',
        profile: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 21V5a2 2 0 0 1 2-2h8l6 6v12z"></path><path d="M14 3v6h6"></path></svg>',
        faq: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14"></path><path d="M12 17h.01"></path></svg>',
    };
    const NAV = [
        { key: "invites", href: "invites.html", label: "tab.invites", badge: "invites" },
        { key: "projects", href: "projects.html", label: "tab.projects", badge: "projects" },
        { key: "profile", href: "profile.html", label: "tab.profile" },
        { key: "faq", href: "faq.html", label: "tab.faq" },
    ];
    const WAVES_STRIP = `<svg class="vp-top__waves" aria-hidden="true" viewBox="0 0 1440 14" preserveAspectRatio="none">
            <path d="M0 6 C 240 1, 480 12, 720 6 S 1200 1, 1440 6" fill="none" stroke="#29A9E1" stroke-width="1.5" opacity="0.7" vector-effect="non-scaling-stroke"></path>
            <path d="M0 10 C 260 5, 520 14, 780 9 S 1220 4, 1440 9" fill="none" stroke="#1F74BC" stroke-width="1.5" opacity="0.8" vector-effect="non-scaling-stroke"></path>
        </svg>`;
    const LOGO = "assets/leeward-mark.png";

    function langSwitch() {
        return `<div class="vp-lang" role="group" aria-label="Language / Idioma">
            <button type="button" data-set-lang="en" aria-pressed="${lang === "en"}">EN</button>
            <button type="button" data-set-lang="es" aria-pressed="${lang === "es"}">ES</button>
        </div>`;
    }

    function renderShell(active) {
        const company = me?.company ? (me.company.friendly_name || me.company.name) : "";
        const user = me?.user?.name || me?.user?.email || "";
        const initial = (user.trim()[0] || "?").toUpperCase();
        document.body.classList.add("vp-shell");

        const header = document.createElement("header");
        header.className = "vp-top";
        header.innerHTML = `
            <div class="vp-top__inner">
                <a class="vp-brand" href="invites.html">
                    <img src="${LOGO}" alt="" width="40" height="35">
                    <span class="vp-brand__text"><span class="vp-brand__name">The Leeward Group</span><span class="vp-brand__sub" data-i18n="brand.sub"></span></span>
                </a>
                <nav class="vp-tabs" aria-label="Main">
                    ${NAV.map(n => `<a class="vp-tab ${active === n.key ? "is-active" : ""}" href="${n.href}" ${active === n.key ? 'aria-current="page"' : ""}><span data-i18n="${n.label}"></span>${n.badge ? `<span class="vp-count ${n.badge === "projects" ? "vp-count--warn" : ""} hidden" data-badge="${n.badge}"></span>` : ""}</a>`).join("")}
                </nav>
                <div class="vp-top__right">
                    ${langSwitch()}
                    <details class="vp-account">
                        <summary aria-label="${esc(user || "Account")}">
                            <span class="vp-avatar" aria-hidden="true">${esc(initial)}</span>
                            <span class="vp-account__who"><span class="vp-account__name">${esc(user)}</span><span class="vp-account__co">${esc(company)}</span></span>
                        </summary>
                        <div class="vp-account__menu">
                            <div class="vp-account__menu-lang">${langSwitch()}</div>
                            <a href="profile.html" data-i18n="nav.profile"></a>
                            <button type="button" class="vp-signout" data-i18n="nav.signout"></button>
                        </div>
                    </details>
                </div>
            </div>
            ${WAVES_STRIP}`;

        const footer = document.createElement("footer");
        footer.className = "vp-footer";
        footer.innerHTML = `
            <div class="vp-footer__inner">
                <div class="vp-footer__brand"><img src="${LOGO}" alt="" width="32" height="28"><span>The Leeward Group</span></div>
                <nav aria-label="Footer"><a href="faq.html" data-i18n="nav.faq"></a><a href="profile.html" data-i18n="nav.profile"></a></nav>
                <span class="vp-footer__copy">© ${new Date().getFullYear()} The Leeward Group · Wilmington, NC</span>
            </div>`;

        const tabbar = document.createElement("nav");
        tabbar.className = "vp-tabbar";
        tabbar.setAttribute("aria-label", "Main");
        tabbar.innerHTML = NAV.map(n => `<a href="${n.href}" class="${active === n.key ? "is-active" : ""}" ${active === n.key ? 'aria-current="page"' : ""}><span>${ICONS[n.key]}</span><span data-i18n="${n.label}"></span>${n.badge ? `<span class="vp-count ${n.badge === "projects" ? "vp-count--warn" : ""} hidden" data-badge="${n.badge}"></span>` : ""}</a>`).join("");

        document.body.prepend(header);
        document.body.appendChild(footer);
        document.body.appendChild(tabbar);

        header.querySelector(".vp-signout").addEventListener("click", e => { e.preventDefault(); signOut(); });
        const acct = header.querySelector(".vp-account");
        document.addEventListener("click", e => { if (acct.open && !acct.contains(e.target)) acct.open = false; });
        document.addEventListener("keydown", e => { if (e.key === "Escape") acct.open = false; });
        header.addEventListener("click", e => {
            const b = e.target.closest("[data-set-lang]");
            if (!b) return;
            setLang(b.dataset.setLang);
            store.set("vp-lang-picked", "1");
        });
        [header, footer, tabbar].forEach(el => applyI18n(el));
        if (active !== "invites") refreshInviteBadge(); // the invites page passes its own list
    }

    async function refreshInviteBadge(list) {
        if (!document.querySelector("[data-badge]")) return;
        let invites = list;
        if (!invites) {
            const cached = peek("vendor-api", "invites");
            if (cached) { refreshInviteBadge(cached.invites); }
            const data = await api("vendor-api", "invites");
            if (!data.ok) return;
            invites = data.invites;
        }
        const n = invites.filter(i => i.open && (i.status === "sent" || i.status === "viewed")).length;
        // Projects waiting on a COI PDF.
        const p = new Set(invites.filter(i => i.coi_needed).map(i => i.project_id)).size;
        document.querySelectorAll('[data-badge="invites"]').forEach(b => { b.textContent = String(n); b.classList.toggle("hidden", n === 0); });
        document.querySelectorAll('[data-badge="projects"]').forEach(b => { b.textContent = String(p); b.classList.toggle("hidden", p === 0); });
    }

    /* ---------- project paperwork: whose turn is it? (2026-11-10) ---------- */
    // What the vendor can do right now on a locked project. A contract Leeward
    // hasn't sent yet, or a COI with no template posted, isn't the vendor's move.
    function projectTodo(p) {
        const c = (p && p.checklist) || {};
        return {
            sign: !c.contract && p?.contract?.status === "to_sign",
            w9: !c.w9,
            coi: !c.coi && Boolean(p?.coi_template),
        };
    }
    // Locked, but nothing left for the vendor to do: waiting on The Leeward Group.
    function waitingOnLeeward(p) {
        if (!p || !p.locked) return false;
        const d = projectTodo(p);
        return !d.sign && !d.w9 && !d.coi;
    }

    /* ---------- boot ---------- */
    function boot() {
        applyI18n(document);
        mountLangFab();
        document.querySelectorAll(".lang-fab input").forEach(i => { i.checked = i.value === lang; });
    }
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
    else boot();

    window.VP = {
        t, tHtml, esc, applyI18n, setLang, get lang() { return lang; },
        api, errText, uploadToSlot, setMessage, markFields, preview, closePreview, downloadUrl,
        getSession, setSession, requireMe,
        // True when this tab already knows the vendor is approved, so a page can
        // fetch its data in parallel with requireMe() instead of after it.
        approvedCached: () => Boolean(readMeCache()?.company), renderShell, refreshInviteBadge, signOut,
        peek, swr, same, seed,
        get me() { return me; },
        fmtDateTime, fmtShort, fmtDay, fmtMoney, daysLeft, daysLeftText,
        store, projectTodo, waitingOnLeeward,
    };
})();
