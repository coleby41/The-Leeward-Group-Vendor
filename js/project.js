/* One project folder: the scopes awarded on it, this project's COI PDF and
   contract. Locked (checklist only) until the contract is signed, a W-9 is
   on file and the COI is uploaded. The contract is signed right here
   (sign_contract): typed name + drawn signature + "I agree". */
(async function () {
    "use strict";
    const $ = id => document.getElementById(id);
    const { t, esc } = VP;
    const id = new URLSearchParams(location.search).get("id") || "";

    // Remembered copy shows instantly; the server's answer (asked for right
    // away, in parallel with requireMe) replaces it when it arrives.
    const first = VP.swr("project", { id });
    let prefetch = first.cached ? Promise.resolve(first.cached) : first.fresh;
    const me = await VP.requireMe();
    if (me.error) return pageError(me.error);
    // The shell (top + side nav) is added after the project loads, and only
    // if it isn't locked: the locked view is a page of its own, no nav.

    let state = null;     // { project, company_coi }
    let flash = null;
    let busy = false;

    function pageError(code) {
        $("pageError").textContent = VP.errText(code);
        $("pageError").classList.remove("hidden");
    }

    async function load() {
        const res = prefetch ? await prefetch : await VP.api("vendor-api", "project", { id });
        prefetch = null;
        if (!res.ok) { pageError(res.error); return false; }
        state = res;
        return true;
    }

    function renderHead() {
        const p = state.project;
        $("projName").textContent = p.name;
        $("projSub").textContent = p.location || "";
    }

    const check = ok => ok
        ? `<span class="chip chip--success">${esc(t("lock.done"))}</span>`
        : `<span class="chip chip--warning">${esc(t("lock.todo"))}</span>`;

    function contractActions(k) {
        if (k.status === "to_sign" && k.file) return `
            <button type="button" class="workbook-btn" style="flex:0 0 auto" data-view="${esc(k.file.id)}">${esc(t("contract.read"))}</button>
            <button type="button" class="auth-button auth-button--sm" style="flex:0 0 auto;margin:0" data-sign="1">${esc(t("lock.signBtn"))}</button>`;
        const f = k.signed_file || k.file;
        if (k.status === "signed" && f) return `
            <button type="button" class="workbook-btn" style="flex:0 0 auto" data-view="${esc(f.id)}">${esc(t("btn.view"))}</button>
            <button type="button" class="workbook-btn workbook-btn--download" style="flex:0 0 auto" data-file="${esc(f.id)}">${esc(t("btn.download"))}</button>`;
        return "";
    }

    function contractLine(k) {
        if (k.status === "signed") return k.signed_in_portal && k.signer_name
            ? t("contract.signedBy", { name: k.signer_name, date: VP.fmtDay(k.signed_at) })
            : t("contract.signed", { date: VP.fmtDay(k.signed_at) });
        if (k.status === "to_sign") return t("contract.toSign");
        if (k.status === "not_needed") return t("contract.notNeeded");
        return t("lock.contractWaiting");
    }

    function renderChecklist() {
        const p = state.project;
        const c = p.checklist;
        $("checklistBody").innerHTML = `
            <p class="auth-inline-copy" style="margin:0 0 12px">${esc(t("lock.body"))}</p>
            <div class="vendor-profile-section vp-check-row">
                <div class="vp-check-head"><span class="company-card-label">${esc(t("lock.contract"))}</span>${check(c.contract)}</div>
                <p class="auth-inline-copy" style="margin:4px 0 8px">${esc(contractLine(p.contract))}</p>
                <div class="bid-row-actions">${contractActions(p.contract)}</div>
            </div>
            <div class="vendor-profile-section vp-check-row">
                <div class="vp-check-head"><span class="company-card-label">${esc(t("lock.w9"))}</span>${check(c.w9)}</div>
                ${c.w9 ? "" : `<p class="auth-inline-copy" style="margin:4px 0 0"><a class="auth-link" href="profile.html">${esc(t("lock.w9Go"))}</a></p>`}
            </div>
            <div class="vendor-profile-section vp-check-row">
                <div class="vp-check-head"><span class="company-card-label">${esc(t("lock.coi"))}</span>${check(c.coi)}</div>
                ${c.coi ? "" : `<p class="auth-inline-copy" style="margin:4px 0 0">${esc(t("lock.coiGo"))}</p>`}
            </div>`;
    }

    /* ---------- Locked view (2026-11-10 redesign) ----------
       Inside the normal portal (top bar + tabs). Navy header with a
       progress ring, then one step per requirement: green check = done,
       the first open one is highlighted with what to do (sign, go to the
       profile for a W-9, or drop the COI PDF right here). Then what opens
       once everything is in. */
    const ICON_OK = `<svg class="vp-step__icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="11" fill="#2E9E6B"/><path d="M7 12.4l3.3 3.3L17.2 8.8" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    const ICON_LOCK = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"></rect><path d="M8 11V7a4 4 0 0 1 8 0v4"></path></svg>`;
    const ICON_DOC = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path><path d="M14 3v6h6"></path></svg>`;
    const ICON_WAIT = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle><path d="M12 7v5l3 2"></path></svg>`;

    // The project's COI template (posted by Leeward staff on the project's Bid Invites page).
    // With a template: a row with View + Download. Without one: a clear notice, and the
    // COI upload stays closed until staff post it (vendor-api enforces this too).
    function templateBox(tpl) {
        if (!tpl) return `
            <div class="vp-tpl vp-tpl--missing" role="status">
                <span class="vp-tpl__icon">${ICON_WAIT}</span>
                <div class="vp-tpl__text">
                    <strong>${esc(t("lock.noTplTitle"))}</strong>
                    <span>${esc(t("lock.noTplBody"))}</span>
                </div>
            </div>`;
        return `
            <div class="vp-tpl">
                <span class="vp-tpl__icon">${ICON_DOC}</span>
                <div class="vp-tpl__text">
                    <strong>${esc(t("project.templateTitle"))} · ${esc(tpl.name)}</strong>
                    <span>${esc(t("project.templateBody"))}</span>
                </div>
                <div class="vp-tpl__actions">
                    <button type="button" class="workbook-btn" data-view="${esc(tpl.id)}">${esc(t("btn.view"))}</button>
                    <button type="button" class="workbook-btn workbook-btn--download" data-file="${esc(tpl.id)}">${esc(t("btn.download"))}</button>
                </div>
            </div>`;
    }

    const ICON_UP = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 16V4"></path><path d="M7 9l5-5 5 5"></path><path d="M4 20h16"></path></svg>`;

    function step(done, current, num, title, help, actions, extra) {
        return `<li class="vp-step ${current ? "is-current" : ""}">
            <div class="vp-step__row">
                ${done ? ICON_OK : `<span class="vp-step__num" aria-hidden="true">${num}</span>`}
                <div class="vp-step__text">
                    <h2 class="vp-step__title">${esc(title)}<span class="hidden"> — ${esc(t(done ? "lock.ready" : "lock.notReady"))}</span></h2>
                    ${help ? `<p class="vp-step__help">${esc(help)}</p>` : ""}
                </div>
                <div class="vp-step__actions">${actions || ""}</div>
            </div>
            ${extra || ""}
        </li>`;
    }

    function renderLock(f) {
        const p = state.project;
        const c = p.checklist;
        const k = p.contract;
        const coi = p.coi;
        const tpl = p.coi_template;
        const exempt = state.company_coi.exempt && !coi.needed;
        const done = [c.contract, c.w9, c.coi];
        const doneCount = done.filter(Boolean).length;
        const left = 3 - doneCount;
        // Highlight the first step the vendor can act on (none when waiting on Leeward).
        const todo = VP.projectTodo(p);
        const waiting = VP.waitingOnLeeward(p);
        const current = [todo.sign, todo.w9, todo.coi].indexOf(true);

        // 1. Contract
        const contractHelp = c.contract ? contractLine(k) : (k.status === "to_sign" ? t("lock.fixContract") : t("lock.contractWaiting"));
        const s1 = step(c.contract, current === 0, 1, t("lock.contract"), contractHelp, contractActions(k));

        // 2. W-9
        const s2 = step(c.w9, current === 1, 2, t("lock.w9"), t(c.w9 ? "lock.w9Done" : "lock.fixW9"),
            c.w9 ? "" : `<a class="auth-button auth-button--sm" href="profile.html">${esc(t("lock.w9Btn"))}</a>`);

        // 3. COI for this project
        let s3;
        if (c.coi) {
            const help = coi.file ? t("project.coiUploaded", { date: VP.fmtDay(coi.file.uploaded_at) }) : (exempt ? t("project.coiExempt") : "");
            const actions = coi.file ? `
                <button type="button" class="workbook-btn" data-view="${esc(coi.file.id)}">${esc(t("btn.view"))}</button>
                <button type="button" class="workbook-btn workbook-btn--download" data-file="${esc(coi.file.id)}">${esc(t("btn.download"))}</button>` : "";
            s3 = step(true, false, 3, t("lock.coi"), help, actions);
        } else {
            // No template yet → no upload form, just the notice.
            const upload = templateBox(tpl) + (tpl ? `
                <form id="coiForm" novalidate>
                    <label class="vp-drop" id="coiDrop">
                        <span class="vp-drop__icon">${ICON_UP}</span>
                        <span class="vp-drop__title">${VP.tHtml("lock.dropHtml")}</span>
                        <span class="vp-drop__hint">${esc(t("lock.dropHint"))}</span>
                        <span class="vp-drop__file hidden" id="coiFileName"></span>
                        <input type="file" name="file" accept="application/pdf,.pdf" aria-label="${esc(t("coi.file"))}">
                    </label>
                    <p class="auth-message hidden" id="coiMessage" role="alert"></p>
                    <button type="submit" class="auth-button" id="coiUploadBtn">${esc(t("project.coiUpload"))}</button>
                </form>` : "");
            s3 = step(false, current === 2, 3, t("lock.coi"), t(tpl ? "lock.fixCoi" : "lock.fixCoiNoTpl"), "", upload);
        }

        $("lockView").innerHTML = `
            <div class="vp-lockv">
                <a class="vp-back" href="projects.html">← ${esc(t("project.back"))}</a>
                <section class="vp-lockhead">
                    <div class="vp-ring" role="img" aria-label="${esc(t("lock.progress", { n: doneCount, total: 3 }))}" style="background: conic-gradient(#3FB37F 0 ${doneCount / 3 * 100}%, rgba(255,255,255,.18) ${doneCount / 3 * 100}% 100%)">
                        <span><strong>${doneCount}/3</strong><small>${esc(t("lock.readyWord"))}</small></span>
                    </div>
                    <div class="vp-lockhead__text">
                        <p class="vp-lockhead__eyebrow">${esc(p.name || "")}</p>
                        <h1>${esc(waiting ? t("lock.headWaiting") : t(left === 1 ? "lock.headOne" : "lock.headMany", { n: left }))}</h1>
                        <p>${esc(t(waiting ? "lock.bodyWaiting" : "lock.body"))}</p>
                    </div>
                </section>
                ${f ? `<p class="auth-message ${f.type}" role="status">${esc(f.text)}</p>` : ""}
                <ol class="vp-steps">${s1}${s2}${s3}</ol>
                <section class="vp-unlocks" aria-labelledby="unlocksTitle">
                    <h2 id="unlocksTitle">${esc(t("lock.unlocks"))}</h2>
                    <ul><li>${ICON_LOCK}${esc(t("lock.unlockScope"))}</li><li>${ICON_LOCK}${esc(t("lock.unlockDocs"))}</li><li>${ICON_LOCK}${esc(t("lock.unlockContacts"))}</li></ul>
                </section>
            </div>`;
        wireDrop();
    }

    // The COI drop area: click to choose, or drag a PDF onto it.
    function wireDrop() {
        const form = $("coiForm");
        if (!form) return;
        form.addEventListener("submit", upload);
        const drop = $("coiDrop");
        const input = form.elements.file;
        const show = () => {
            const name = input.files[0]?.name || "";
            $("coiFileName").textContent = name;
            $("coiFileName").classList.toggle("hidden", !name);
        };
        input.addEventListener("change", show);
        ["dragenter", "dragover"].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add("is-over"); }));
        ["dragleave", "drop"].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove("is-over"); }));
        drop.addEventListener("drop", e => {
            if (e.dataTransfer?.files?.length) { input.files = e.dataTransfer.files; show(); }
        });
    }

    // Open project header: status badge, awarded date and contract value.
    function renderHeadExtras() {
        const p = state.project;
        const badge = $("projBadge");
        if (p.coi.needed) { badge.className = "vp-hero-badge vp-hero-badge--warn"; badge.textContent = t("status.coi_needed"); }
        else { badge.className = "vp-hero-badge"; badge.textContent = t("project.approvedBadge"); }
        const awarded = p.scopes.map(sc => sc.awarded_at).filter(Boolean).sort()[0];
        const amounts = p.scopes.map(sc => sc.amount).filter(a => a != null && a !== "");
        const total = amounts.reduce((sum, a) => sum + Number(a), 0);
        $("projGlass").innerHTML = `
            ${awarded ? `<div class="vp-glass"><p class="vp-glass__label">${esc(t("project.awarded"))}</p><p class="vp-glass__value">${esc(VP.fmtDay(awarded))}</p></div>` : ""}
            ${amounts.length ? `<div class="vp-glass"><p class="vp-glass__label">${esc(t("project.contractValue"))}</p><p class="vp-glass__value">${esc(VP.fmtMoney(total))}</p></div>` : ""}`;
        const c = p.checklist;
        $("projStrip").innerHTML = `<h2>${esc(t("project.compliance"))}</h2><ul>
            ${[["contract", "lock.contract"], ["w9", "lock.w9"], ["coi", "col.coi"]].map(([key, label]) => c[key] ? `<li>✓ ${esc(t(label))}</li>` : "").join("")}
        </ul>`;
    }

    function renderContract() {
        const k = state.project.contract;
        const chips = { signed: "chip--success", to_sign: "chip--warning", not_needed: "chip--muted", waiting: "chip--muted" };
        $("contractChip").innerHTML = `<span class="chip ${chips[k.status] || "chip--muted"}">${esc(t(`contract.status.${k.status}`))}</span>`;
        $("contractBody").innerHTML = `
            <div class="vendor-profile-section">
                <p class="auth-inline-copy" style="margin:0 0 8px">${esc(contractLine(k))}</p>
                ${(k.signed_file || k.file) ? `<div class="bid-file-row"><span class="bid-file-row-name">${esc((k.signed_file || k.file).name)}</span>${contractActions(k)}</div>` : ""}
            </div>`;
    }

    function renderScopes() {
        const p = state.project;
        $("scopesBody").innerHTML = `
            <div class="table-wrap">
              <table class="dash-queue-table bid-tracker-table vp-folder-table">
                <thead><tr><th>${esc(t("col.package"))}</th><th>${esc(t("project.amount"))}</th><th>${esc(t("project.awarded"))}</th><th></th></tr></thead>
                <tbody>${p.scopes.map(sc => `<tr>
                    <td><strong>${esc(sc.name || t("project.addedScope"))}</strong>${sc.contact_name ? `<span class="bid-cell-sub">${esc(t("project.contact"))}: ${esc(sc.contact_name)}${sc.contact_email ? ` · <a class="auth-link" href="mailto:${esc(sc.contact_email)}">${esc(sc.contact_email)}</a>` : ""}</span>` : ""}</td>
                    <td>${esc(VP.fmtMoney(sc.amount))}</td>
                    <td>${esc(VP.fmtDay(sc.awarded_at))}</td>
                    <td><div class="bid-row-actions">${sc.proposal ? `<button type="button" class="workbook-btn" data-file="${esc(sc.proposal.id)}">${esc(t("project.proposal"))}</button>` : ""}</div></td>
                </tr>`).join("")}</tbody>
              </table>
            </div>`;
    }

    // A project's COI is either on file or not.
    function chip() {
        const c = state.project.coi;
        if (c.file) return `<span class="chip chip--success">${esc(t("coiStatus.onFile"))}</span>`;
        if (state.company_coi.exempt) return `<span class="chip chip--muted">${esc(t("coiStatus.exempt"))}</span>`;
        return `<span class="chip chip--warning">${esc(t("coiStatus.notOnFile"))}</span>`;
    }

    function renderDocs() {
        const c = state.project.coi;
        const tpl = state.project.coi_template;
        const exempt = state.company_coi.exempt && !c.needed;
        const company = state.company_coi.expires_on
            ? t("project.companyDate", { date: VP.fmtDay(state.company_coi.expires_on) })
            : t("project.companyNoDate");
        $("coiChip").innerHTML = chip();
        $("docsBody").innerHTML = `
            ${exempt ? "" : `<div class="vendor-profile-section">${templateBox(tpl)}</div>`}
            <div class="vendor-profile-section">
                <span class="company-card-label">${esc(t("project.coiTitle"))}</span>
                <p class="auth-inline-copy" style="margin:4px 0 8px">${esc(exempt ? t("project.coiExempt") : c.file ? "" : t("project.coiNeeded"))}</p>
                ${c.file ? `
                <div class="bid-file-row">
                    <span class="bid-file-row-name">${esc(c.file.name)}<span class="bid-cell-sub">${esc(t("project.coiUploaded", { date: VP.fmtDay(c.file.uploaded_at) }))}</span></span>
                    <button type="button" class="workbook-btn" style="flex:0 0 auto" data-view="${esc(c.file.id)}">${esc(t("btn.view"))}</button>
                    <button type="button" class="workbook-btn workbook-btn--download" style="flex:0 0 auto" data-file="${esc(c.file.id)}">${esc(t("btn.download"))}</button>
                </div>` : ""}
                ${exempt || !tpl ? "" : `
                <form class="auth-form vp-doc-form" id="coiForm" novalidate>
                    <label class="auth-field">${esc(t("coi.file"))}<input type="file" name="file" accept="application/pdf,.pdf"></label>
                    <p class="auth-message hidden" id="coiMessage" role="alert"></p>
                    <button type="submit" class="auth-button" id="coiUploadBtn">${esc(t(c.file ? "project.coiReplace" : "project.coiUpload"))}</button>
                </form>`}
                ${flash ? `<p class="auth-message ${flash.type}" role="status">${esc(flash.text)}</p>` : ""}
            </div>
            <div class="vendor-profile-section">
                <p class="auth-inline-copy" style="margin:0">${esc(company)}</p>
            </div>`;
        flash = null;
        $("coiForm")?.addEventListener("submit", upload);
    }

    async function upload(e) {
        e.preventDefault();
        if (busy) return;
        const form = e.target;
        const msg = $("coiMessage");
        const file = form.elements.file.files[0];
        if (!file) { VP.markFields(form, ["file"]); VP.setMessage(msg, VP.errText("missing_file"), "error"); return; }
        if (!/\.pdf$/i.test(file.name)) { VP.markFields(form, ["file"]); VP.setMessage(msg, VP.errText("pdf_only"), "error"); return; }
        VP.markFields(form, []);
        VP.setMessage(msg, "");
        // Ask about the expiration date first (same as on file, or a new one).
        const answer = await askExpiration();
        if (!answer) return;

        busy = true;
        const btn = $("coiUploadBtn");
        btn.disabled = true; btn.textContent = t("docs.uploading");
        try {
            const slot = await VP.api("vendor-api", "project_coi_upload_url", { project_id: id, file_name: file.name });
            if (!slot.ok) { VP.setMessage(msg, VP.errText(slot.error), "error"); return; }
            if (!(await VP.uploadToSlot(slot, file))) { VP.setMessage(msg, VP.errText("upload"), "error"); return; }
            const res = await VP.api("vendor-api", "save_project_coi", { project_id: id, path: slot.path, file_name: file.name });
            if (!res.ok) { VP.setMessage(msg, VP.errText(res.error), "error"); return; }
            let dateChanged = false;
            if (answer.date && answer.date !== state.company_coi.expires_on) {
                const d = await VP.api("vendor-api", "set_coi_date", { expires_on: answer.date });
                if (!d.ok) { VP.setMessage(msg, VP.errText(d.error), "error"); return; }
                dateChanged = true;
            }
            await load();
            flash = { text: t(dateChanged ? "coiPop.dateSaved" : "project.coiDone"), type: "success" };
            if (state.project.locked || startedLocked) renderAll(); else renderDocs();
            VP.refreshInviteBadge();
        } finally {
            busy = false;
            if (document.body.contains(btn)) { btn.disabled = false; btn.textContent = t(state.project.coi.file ? "project.coiReplace" : "project.coiUpload"); }
        }
    }

    // Popup: is this COI's expiration date the same as the one on file? The
    // date can be changed right here. Resolves { date } or null (cancelled).
    function askExpiration() {
        return new Promise(resolve => {
            const onFile = state.company_coi.expires_on || "";
            let choice = onFile ? "same" : "different";
            const overlay = document.createElement("div");
            overlay.className = "popup-overlay";
            overlay.id = "coiDateOverlay";
            overlay.innerHTML = `
                <div class="popup workbook-popup" role="dialog" aria-modal="true" aria-labelledby="coiDateTitle">
                    <h2 id="coiDateTitle">${esc(t("coiPop.title"))}</h2>
                    <form class="auth-form" id="coiDateForm" novalidate>
                        ${onFile ? `
                        <p class="auth-inline-copy" style="margin:0">${esc(t("coiPop.ask"))}</p>
                        <p style="margin:0;font-weight:700">${esc(t("coiPop.onFile", { date: VP.fmtDay(onFile) }))}</p>
                        <div class="bid-choice-group" role="radiogroup" aria-label="${esc(t("coiPop.ask"))}">
                            <button type="button" role="radio" class="bid-choice-btn" data-pick="same">${esc(t("coiPop.same"))}</button>
                            <button type="button" role="radio" class="bid-choice-btn" data-pick="different">${esc(t("coiPop.different"))}</button>
                        </div>` : `<p class="auth-inline-copy" style="margin:0">${esc(t("coiPop.noDate"))}</p>`}
                        <label class="auth-field" id="coiDateField">${esc(t("coiPop.date"))}
                            <input type="date" name="expires_on" value="${esc(onFile)}">
                        </label>
                        <p class="auth-message hidden" id="coiDateMessage" role="alert"></p>
                        <div class="popup-buttons">
                            <button type="button" class="auth-button auth-button--secondary" data-pop="cancel">${esc(t("cancel"))}</button>
                            <button type="submit" class="auth-button">${esc(t("coiPop.confirm"))}</button>
                        </div>
                    </form>
                </div>`;
            document.body.appendChild(overlay);
            document.body.classList.add("popup-active");
            const form = overlay.querySelector("#coiDateForm");
            const input = form.elements.expires_on;
            const sync = () => {
                overlay.querySelectorAll("[data-pick]").forEach(b => {
                    const on = b.dataset.pick === choice;
                    b.classList.toggle("is-selected", on);
                    b.setAttribute("aria-checked", String(on));
                });
                overlay.querySelector("#coiDateField").classList.toggle("hidden", choice === "same");
            };
            const close = result => {
                overlay.remove();
                if (!document.querySelector(".popup-overlay:not(.hidden)")) document.body.classList.remove("popup-active");
                document.removeEventListener("keydown", onKey);
                resolve(result);
            };
            const onKey = ev => { if (ev.key === "Escape") close(null); };
            input.addEventListener("input", () => { VP.markFields(form, []); VP.setMessage(overlay.querySelector("#coiDateMessage"), ""); });
            document.addEventListener("keydown", onKey);
            overlay.addEventListener("click", ev => {
                if (ev.target === overlay || ev.target.closest('[data-pop="cancel"]')) { close(null); return; }
                const pick = ev.target.closest("[data-pick]");
                if (pick) {
                    choice = pick.dataset.pick;
                    if (choice === "different") { if (input.value === onFile) input.value = ""; sync(); input.focus(); }
                    else { input.value = onFile; sync(); }
                }
            });
            form.addEventListener("submit", ev => {
                ev.preventDefault();
                if (choice === "same") { close({ date: onFile }); return; }
                const v = input.value;
                if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) {
                    VP.markFields(form, ["expires_on"]);
                    VP.setMessage(overlay.querySelector("#coiDateMessage"), VP.errText("missing_fields"), "error");
                    return;
                }
                close({ date: v });
            });
            sync();
            (choice === "same" ? overlay.querySelector('[data-pick="same"]') : input).focus();
        });
    }

    // Sign the contract: typed name, optional title, drawn signature, "I agree".
    function openSign() {
        const k = state.project.contract;
        if (k.status !== "to_sign" || busy) return;
        const overlay = document.createElement("div");
        overlay.className = "popup-overlay popup-overlay--blur";
        overlay.id = "signOverlay";
        overlay.innerHTML = `
            <div class="popup workbook-popup vp-sign-popup" role="dialog" aria-modal="true" aria-labelledby="signTitle">
                <h2 id="signTitle">${esc(t("sign.title"))}</h2>
                <p class="auth-inline-copy" style="margin:0 0 12px">${esc(t("sign.intro", { name: k.file?.name || "" }))}</p>
                <form class="auth-form" id="signForm" novalidate>
                    <label class="auth-field">${esc(t("sign.name"))}<input type="text" name="name" autocomplete="name" value="${esc(me.user?.name || "")}"></label>
                    <label class="auth-field">${esc(t("sign.titleField"))}<input type="text" name="title" autocomplete="organization-title" value="${esc(me.user?.title || "")}"></label>
                    <div class="auth-field" data-field="signature">
                        <span>${esc(t("sign.pad"))}</span>
                        <canvas class="vp-sign-pad" id="signPad" aria-label="${esc(t("sign.pad"))}"></canvas>
                        <button type="button" class="auth-link vp-sign-clear" id="signClear">${esc(t("sign.clear"))}</button>
                    </div>
                    <label class="vp-sign-agree" data-field="agree"><input type="checkbox" name="agree"> <span>${esc(t("sign.agree"))}</span></label>
                    <p class="auth-message hidden" id="signMessage" role="alert"></p>
                    <div class="popup-buttons">
                        <button type="button" class="auth-button auth-button--secondary" data-pop="cancel">${esc(t("cancel"))}</button>
                        <button type="submit" class="auth-button" id="signSubmit">${esc(t("sign.submit"))}</button>
                    </div>
                </form>
            </div>`;
        document.body.appendChild(overlay);
        document.body.classList.add("popup-active");

        // Signature pad (mouse, pen or finger).
        const canvas = overlay.querySelector("#signPad");
        const ctx2d = canvas.getContext("2d");
        let drawn = false, drawing = false, last = null;
        const size = () => {
            const r = canvas.getBoundingClientRect();
            const ratio = window.devicePixelRatio || 1;
            canvas.width = Math.round(r.width * ratio);
            canvas.height = Math.round(r.height * ratio);
            ctx2d.setTransform(ratio, 0, 0, ratio, 0, 0);
            ctx2d.lineWidth = 2.2; ctx2d.lineCap = "round"; ctx2d.lineJoin = "round"; ctx2d.strokeStyle = "#14263a";
            drawn = false;
        };
        const pos = e => { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
        canvas.addEventListener("pointerdown", e => { drawing = true; last = pos(e); canvas.setPointerCapture(e.pointerId); e.preventDefault(); });
        canvas.addEventListener("pointermove", e => {
            if (!drawing) return;
            const p2 = pos(e);
            ctx2d.beginPath(); ctx2d.moveTo(last.x, last.y); ctx2d.lineTo(p2.x, p2.y); ctx2d.stroke();
            last = p2; drawn = true;
        });
        const stop = () => { drawing = false; };
        canvas.addEventListener("pointerup", stop);
        canvas.addEventListener("pointercancel", stop);
        overlay.querySelector("#signClear").addEventListener("click", () => { ctx2d.clearRect(0, 0, canvas.width, canvas.height); drawn = false; });
        requestAnimationFrame(size);

        const form = overlay.querySelector("#signForm");
        const msg = overlay.querySelector("#signMessage");
        const close = () => {
            overlay.remove();
            if (!document.querySelector(".popup-overlay:not(.hidden)")) document.body.classList.remove("popup-active");
            document.removeEventListener("keydown", onKey);
        };
        const onKey = ev => { if (ev.key === "Escape" && !busy) close(); };
        document.addEventListener("keydown", onKey);
        overlay.addEventListener("click", ev => {
            if (busy) return;
            if (ev.target === overlay || ev.target.closest('[data-pop="cancel"]')) close();
        });
        form.addEventListener("submit", async ev => {
            ev.preventDefault();
            if (busy) return;
            const name = form.elements.name.value.trim();
            const missing = [!name ? "name" : null, !drawn ? "signature" : null, !form.elements.agree.checked ? "agree" : null].filter(Boolean);
            if (missing.length) { VP.markFields(form, missing); VP.setMessage(msg, t(!drawn && name ? "sign.needSignature" : "err.missing_fields"), "error"); return; }
            VP.markFields(form, []); VP.setMessage(msg, "");
            busy = true;
            const btn = overlay.querySelector("#signSubmit");
            btn.disabled = true; btn.textContent = t("sign.signing");
            try {
                const res = await VP.api("vendor-api", "sign_contract", {
                    project_id: id, name, title: form.elements.title.value.trim(), agree: true,
                    signature_png: canvas.toDataURL("image/png"),
                });
                if (!res.ok) { VP.setMessage(msg, VP.errText(res.error), "error"); return; }
                busy = false;
                close();
                await load();
                flash = { text: t("sign.done"), type: "success" };
                renderAll();
            } finally {
                busy = false;
                if (document.body.contains(btn)) { btn.disabled = false; btn.textContent = t("sign.submit"); }
            }
        });
        form.elements.name.focus();
    }

    // View opens in the portal's preview; Download saves it. Never a new tab.
    function openFile(fileId, download) {
        const p = state.project;
        const files = [p.coi.file, p.coi_template, p.contract?.file, p.contract?.signed_file, ...p.scopes.map(sc => sc.proposal)].filter(Boolean);
        const f = files.find(x => String(x.id) === String(fileId));
        const name = f ? f.name : "";
        const sign = async dl => {
            const res = await VP.api("vendor-api", "project_file_url", { project_id: id, file_id: fileId, download: dl });
            if (!res.ok || !res.url) throw new Error(res.error || "generic");
            return res.url;
        };
        if (!download) { VP.preview({ name, getUrl: () => sign(false), getDownloadUrl: () => sign(true) }); return; }
        sign(true).then(url => VP.downloadUrl(url, name)).catch(err => pageError(err.message));
    }
    document.addEventListener("click", e => {
        if (e.target.closest("[data-sign]")) { openSign(); return; }
        const dl = e.target.closest("[data-file]");
        if (dl) { openFile(dl.dataset.file, true); return; }
        const view = e.target.closest("[data-view]");
        if (view) openFile(view.dataset.view, false);
    });

    if (!(await load())) { VP.renderShell("projects"); return; }
    const startedLocked = Boolean(state.project.locked);
    VP.renderShell("projects");

    function renderAll() {
        const p = state.project;
        const f = flash; flash = null;   // shown once, in the card that changed
        $("lockView").classList.toggle("hidden", !p.locked);
        $("projHero").classList.toggle("hidden", Boolean(p.locked));
        $("projStrip").classList.toggle("hidden", Boolean(p.locked));
        if (p.locked) {
            $("projectGrid").classList.add("hidden");
            renderLock(f);
            return;
        }
        renderHead();
        renderHeadExtras();
        $("checklistCard").classList.toggle("hidden", !p.locked);
        $("scopesCard").classList.toggle("hidden", p.locked);
        $("contractCard").classList.toggle("hidden", p.locked || p.contract.status === "waiting" || p.contract.status === "not_needed");
        if (p.locked) {
            renderChecklist();
            if (f) $("checklistBody").insertAdjacentHTML("afterbegin", `<p class="auth-message ${f.type}" role="status">${esc(f.text)}</p>`);
        } else {
            renderScopes();
            renderContract();
            if (f) $("contractBody").insertAdjacentHTML("afterbegin", `<p class="auth-message ${f.type}" role="status">${esc(f.text)}</p>`);
        }
        renderDocs();
        $("projectGrid").classList.remove("hidden");
    }
    renderAll();
    document.addEventListener("vp:lang", renderAll);

    // Showed the remembered copy: swap in the fresh one if anything changed.
    if (first.cached) first.fresh.then(res => {
        if (!res || !res.ok || VP.same(res, first.cached)) return;
        state = res;
        renderAll();
    });
})();
