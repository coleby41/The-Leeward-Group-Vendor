/* One project folder: the scopes awarded on it, this project's COI PDF and
   contract. Locked (checklist only) until the contract is signed, a W-9 is
   on file and the COI is uploaded. The contract is signed right here
   (sign_contract): typed name + drawn signature + "I agree". */
(async function () {
    "use strict";
    const $ = id => document.getElementById(id);
    const { t, esc } = VP;
    const id = new URLSearchParams(location.search).get("id") || "";

    let prefetch = VP.approvedCached() ? VP.api("vendor-api", "project", { id }) : null; // in parallel with requireMe
    const me = await VP.requireMe();
    if (me.error) return pageError(me.error);
    VP.renderShell("projects");

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
            ${exempt ? "" : `<div class="vendor-profile-section">
                <span class="company-card-label">${esc(t("project.templateTitle"))}</span>
                ${tpl ? `<p class="auth-inline-copy" style="margin:4px 0 8px">${esc(t("project.templateBody"))}</p>
                <div class="bid-file-row">
                    <span class="bid-file-row-name">${esc(tpl.name)}</span>
                    <button type="button" class="workbook-btn workbook-btn--download" style="flex:0 0 auto" data-file="${esc(tpl.id)}">${esc(t("project.templateDownload"))}</button>
                </div>` : `<p class="auth-inline-copy" style="margin:4px 0 0">${esc(t("project.noTemplate"))}</p>`}
            </div>`}
            <div class="vendor-profile-section">
                <span class="company-card-label">${esc(t("project.coiTitle"))}</span>
                <p class="auth-inline-copy" style="margin:4px 0 8px">${esc(exempt ? t("project.coiExempt") : c.file ? "" : t("project.coiNeeded"))}</p>
                ${c.file ? `
                <div class="bid-file-row">
                    <span class="bid-file-row-name">${esc(c.file.name)}<span class="bid-cell-sub">${esc(t("project.coiUploaded", { date: VP.fmtDay(c.file.uploaded_at) }))}</span></span>
                    <button type="button" class="workbook-btn" style="flex:0 0 auto" data-view="${esc(c.file.id)}">${esc(t("btn.view"))}</button>
                    <button type="button" class="workbook-btn workbook-btn--download" style="flex:0 0 auto" data-file="${esc(c.file.id)}">${esc(t("btn.download"))}</button>
                </div>` : ""}
                ${exempt ? "" : `
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
            renderDocs();
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

    if (!(await load())) return;
    const renderAll = () => {
        const p = state.project;
        const f = flash; flash = null;   // shown once, in the card that changed
        renderHead();
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
    };
    renderAll();
    $("projectGrid").classList.remove("hidden");
    document.addEventListener("vp:lang", renderAll);
})();
