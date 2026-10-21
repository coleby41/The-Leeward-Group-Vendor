/* ===========================================================
   VENDOR PORTAL — shared code for every page
   - Talks only to the vendor Edge Functions (vendor-auth, vendor-api,
     vendor-apply). Vendors never get a Supabase login, so none of the
     staff tables are reachable from here.
   - Keeps the portal session token in localStorage ("vp-session").
   - English / Spanish (js/i18n.js) with the language circle.
   - Draws the header + sidebar on signed-in pages.
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

    async function requireMe({ allowPending = false } = {}) {
        if (!getSession()) {
            const next = encodeURIComponent(location.pathname.split("/").pop() + location.search);
            location.replace(`index.html?next=${next}`);
            return new Promise(() => {});
        }
        const data = await api("vendor-api", "me");
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
        if (token) await api("vendor-auth", "sign_out", { session: token });
        location.replace("index.html");
    }

    function renderShell(active) {
        const company = me?.company ? (me.company.friendly_name || me.company.name) : "";
        const user = me?.user?.name || me?.user?.email || "";
        const header = document.createElement("header");
        header.className = "header";
        header.innerHTML = `
            <div class="header-left">
                <a class="brand-mark" href="invites.html" style="text-decoration:none;color:inherit">
                    <div class="brand-mark__icon">LG</div>
                    <div><div class="brand-title">The Leeward Group</div><div class="brand-subtitle" data-i18n="brand.sub"></div></div>
                </a>
                <button type="button" class="menu-btn" id="menuBtn" data-i18n-aria="nav.toggle" aria-expanded="true">☰</button>
            </div>
            <div class="header-right">
                <div class="header-user-area">
                    <div class="header-user-pill"><span>${esc([user, company].filter(Boolean).join(" · "))}</span></div>
                </div>
            </div>`;
        const aside = document.createElement("aside");
        aside.className = "sidebar";
        aside.id = "sidebar";
        aside.innerHTML = `
            <div class="sidebar-header" data-i18n="nav.header"></div>
            <nav class="sidebar-nav">
                <a href="invites.html" class="nav-item ${active === "invites" ? "active" : ""}"><span class="form-logs-nav-icon"></span><span class="nav-text" data-i18n="nav.invites"></span><span class="nav-item-badge hidden" id="navInviteBadge"></span></a>
                <a href="projects.html" class="nav-item ${active === "projects" ? "active" : ""}"><span class="projects-nav-icon"></span><span class="nav-text" data-i18n="nav.projects"></span><span class="nav-item-badge hidden" id="navProjectBadge"></span></a>
                <a href="profile.html" class="nav-item ${active === "profile" ? "active" : ""}"><span class="companies-nav-icon"></span><span class="nav-text" data-i18n="nav.profile"></span></a>
                <a href="faq.html" class="nav-item ${active === "faq" ? "active" : ""}"><span class="docs-nav-icon"></span><span class="nav-text" data-i18n="nav.faq"></span></a>
            </nav>
            <div class="sidebar-footer">
                <div class="footer-pill">${esc(me?.company?.name || "")}</div>
                <div class="sidebar-brand">Leeward Group</div>
                <a href="#" class="version vp-signout" style="color: inherit" data-i18n="nav.signout"></a>
            </div>`;
        document.body.prepend(aside);
        document.body.prepend(header);
        aside.querySelector(".vp-signout").addEventListener("click", e => { e.preventDefault(); signOut(); });
        applyI18n(header); applyI18n(aside);
        wireSidebar();
        if (active !== "invites") refreshInviteBadge(); // the invites page passes its own list
    }

    // Same behaviour as the staff portal: docked on desktop, drawer on mobile.
    function wireSidebar() {
        const MOBILE = 820;
        const btn = document.getElementById("menuBtn");
        const sidebar = document.getElementById("sidebar");
        const main = document.querySelector(".main-content");
        if (!btn || !sidebar || !main) return;
        const backdrop = document.createElement("div");
        backdrop.className = "sidebar-backdrop";
        backdrop.setAttribute("aria-hidden", "true");
        document.body.appendChild(backdrop);
        const isMobile = () => window.innerWidth <= MOBILE;
        const open = () => { sidebar.classList.remove("hidden"); main.classList.remove("expanded"); if (isMobile()) backdrop.classList.add("visible"); btn.setAttribute("aria-expanded", "true"); };
        const close = () => { sidebar.classList.add("hidden"); main.classList.add("expanded"); backdrop.classList.remove("visible"); btn.setAttribute("aria-expanded", "false"); };
        btn.addEventListener("click", () => (sidebar.classList.contains("hidden") ? open() : close()));
        backdrop.addEventListener("click", close);
        document.addEventListener("keydown", e => { if (e.key === "Escape" && isMobile() && !sidebar.classList.contains("hidden")) close(); });
        const fit = () => { if (isMobile()) close(); else open(); };
        let lastMobile = isMobile();
        window.addEventListener("resize", () => { if (isMobile() !== lastMobile) { lastMobile = isMobile(); fit(); } });
        fit();
    }

    async function refreshInviteBadge(list) {
        const badge = document.getElementById("navInviteBadge");
        if (!badge) return;
        let invites = list;
        if (!invites) {
            const data = await api("vendor-api", "invites");
            if (!data.ok) return;
            invites = data.invites;
        }
        const n = invites.filter(i => i.open && (i.status === "sent" || i.status === "viewed")).length;
        badge.textContent = String(n);
        badge.classList.toggle("hidden", n === 0);
        // Projects waiting on a COI PDF.
        const pb = document.getElementById("navProjectBadge");
        if (pb) {
            const p = new Set(invites.filter(i => i.coi_needed).map(i => i.project_id)).size;
            pb.textContent = String(p);
            pb.classList.toggle("hidden", p === 0);
        }
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
        api, errText, uploadToSlot, setMessage, markFields,
        getSession, setSession, requireMe, renderShell, refreshInviteBadge, signOut,
        get me() { return me; },
        fmtDateTime, fmtShort, fmtDay, fmtMoney, daysLeft, daysLeftText,
        store,
    };
})();
