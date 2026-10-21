/* Company Profile — company info, team logins, my info, W-9 / COI. */
(async function () {
    "use strict";
    const $ = id => document.getElementById(id);
    const { t, esc } = VP;

    let prefetch = VP.approvedCached() ? VP.api("vendor-api", "profile") : null; // in parallel with requireMe
    const me = await VP.requireMe();
    if (me.error) return pageError(me.error);
    VP.renderShell("profile");

    let prof = null;            // profile response
    let addingTeammate = false;
    let confirmRemove = null;   // vendor_users.id waiting for a second click
    let openDoc = null;         // 'w9' | 'coi' upload form showing
    const flashes = {};         // per-card one-time messages

    function pageError(code) {
        $("pageError").textContent = VP.errText(code);
        $("pageError").classList.remove("hidden");
    }

    async function load() {
        const res = prefetch ? await prefetch : await VP.api("vendor-api", "profile");
        prefetch = null;
        if (!res.ok) { pageError(res.error); return false; }
        prof = res;
        return true;
    }

    const holderName = () => (prof.team.find(m => m.role === "holder") || {}).name || "";
    const flashHtml = key => {
        const f = flashes[key];
        delete flashes[key];
        return f ? `<p class="auth-message ${f.type}" role="status">${esc(f.text)}</p>` : "";
    };

    /* ---------- company ---------- */
    function renderCompany(keep) {
        const c = prof.company;
        const can = prof.is_holder;
        const ro = can ? "" : "disabled";
        const tags = c.tags || [];
        $("companyForm").innerHTML = `
            <label class="auth-field">${esc(t("profile.legal"))}<input type="text" value="${esc(c.legal_name)}" disabled class="vp-readonly"></label>
            <label class="auth-field">${esc(t("profile.friendly"))}<input type="text" name="friendly_name" maxlength="200" value="${esc(c.friendly_name || "")}" ${ro}></label>
            <label class="auth-field">${esc(t("apply.street"))}<input type="text" name="street" maxlength="200" value="${esc(c.street || "")}" ${ro}></label>
            <div class="company-form-row">
                <label class="auth-field">${esc(t("apply.city"))}<input type="text" name="city" maxlength="100" value="${esc(c.city || "")}" ${ro}></label>
                <label class="auth-field">${esc(t("apply.state"))}<input type="text" name="state" maxlength="2" value="${esc(c.state || "")}" ${ro}></label>
                <label class="auth-field">${esc(t("apply.zip"))}<input type="text" name="zip" maxlength="10" value="${esc(c.zip || "")}" ${ro}></label>
            </div>
            <label class="auth-field">${esc(t("profile.tax"))}<input type="text" value="${esc(c.tax_id || "—")}" disabled class="vp-readonly"></label>
            <div class="auth-field">${esc(t("profile.trades"))}
                <div class="company-card-tags">${tags.length ? tags.map(tag => `<span class="chip chip--tag">${esc(tag.name)}</span>`).join("") : `<span class="auth-inline-copy">${esc(t("profile.noTrades"))}</span>`}</div>
            </div>
            <p class="auth-message hidden" id="companyMessage" role="alert"></p>
            ${flashHtml("company")}
            ${can ? `<div class="popup-buttons"><button type="submit" class="auth-button" id="companySaveBtn">${esc(t("save"))}</button></div>` : ""}
            <p class="auth-inline-copy">${esc(t("profile.legalNote"))}</p>
            ${can ? "" : `<p class="auth-inline-copy">${esc(t("profile.holderOnly", { name: holderName() }))}</p>`}`;
        restore($("companyForm"), keep);
    }

    $("companyForm").addEventListener("submit", async e => {
        e.preventDefault();
        if (!prof.is_holder) return;
        const f = e.target;
        const body = {};
        ["friendly_name", "street", "city", "state", "zip"].forEach(n => { body[n] = f.elements[n].value.trim(); });
        const missing = Object.keys(body).filter(k => !body[k]);
        if (missing.length) { VP.markFields(f, missing); VP.setMessage($("companyMessage"), VP.errText("missing_fields"), "error"); return; }
        const btn = $("companySaveBtn");
        btn.disabled = true; btn.textContent = t("saving");
        const res = await VP.api("vendor-api", "update_company", body);
        btn.disabled = false; btn.textContent = t("save");
        if (!res.ok) {
            const map = { FriendlyName: "friendly_name", Street: "street", City: "city", State: "state", Zip: "zip" };
            VP.markFields(f, (res.fields || []).map(x => map[x] || x));
            VP.setMessage($("companyMessage"), VP.errText(res.error), "error");
            return;
        }
        await load();
        flashes.company = { text: t("saved"), type: "success" };
        renderCompany();
    });

    /* ---------- team ---------- */
    function lastSignIn(iso) {
        if (!iso) return t("team.never");
        const d = new Date(iso);
        if (d.toDateString() === new Date().toDateString()) return t("team.today");
        return VP.fmtDay(iso, d.getFullYear() !== new Date().getFullYear());
    }

    function renderTeam(keep) {
        const can = prof.is_holder;
        $("teamBody").innerHTML = `
            <div class="table-wrap">
              <table class="dash-queue-table bid-tracker-table vp-team-table">
                <thead><tr><th>${esc(t("team.name"))}</th><th>${esc(t("team.email"))}</th><th>${esc(t("team.last"))}</th><th></th></tr></thead>
                <tbody>${prof.team.map(m => `<tr>
                    <td><strong>${esc(m.name || m.email)}</strong>${m.role === "holder" ? `<span class="vp-team-pill">${esc(t("team.holder"))}</span>` : ""}
                        <span class="bid-cell-sub">${esc([m.title, m.is_me ? t("team.you") : ""].filter(Boolean).join(" · "))}</span></td>
                    <td style="word-break: break-all">${esc(m.email)}</td>
                    <td>${esc(lastSignIn(m.last_sign_in_at))}</td>
                    <td><div class="bid-row-actions">${can && !m.is_me && m.role !== "holder"
                        ? `<button type="button" class="workbook-btn ${confirmRemove === m.id ? "workbook-btn--danger" : ""}" data-remove="${esc(m.id)}">${esc(t(confirmRemove === m.id ? "team.confirm" : "team.remove"))}</button>` : ""}</div></td>
                </tr>`).join("")}</tbody>
              </table>
            </div>
            <p class="auth-message hidden" id="teamMessage" role="alert"></p>
            ${flashHtml("team")}
            ${can ? (addingTeammate ? `
            <form class="auth-form vp-doc-form" id="teamForm" novalidate>
                <p class="company-form-section-title">${esc(t("team.addTitle"))}</p>
                <div class="wizard-field-grid">
                    <label class="auth-field">${esc(t("apply.name"))}<input type="text" name="name" maxlength="120" autocomplete="off"></label>
                    <label class="auth-field">${esc(t("apply.jobTitle"))}<input type="text" name="title" maxlength="120" placeholder="${esc(t("apply.jobTitlePh"))}" autocomplete="off"></label>
                </div>
                <div class="wizard-field-grid">
                    <label class="auth-field">${esc(t("apply.email"))}<input type="email" name="email" maxlength="200" autocomplete="off"></label>
                    <label class="auth-field">${esc(t("apply.phone"))}<input type="tel" name="phone" maxlength="40" autocomplete="off"></label>
                </div>
                <div class="popup-buttons">
                    <button type="button" class="auth-button auth-button--secondary" id="teamCancelBtn">${esc(t("cancel"))}</button>
                    <button type="submit" class="auth-button" id="teamSendBtn">${esc(t("team.send"))}</button>
                </div>
            </form>` : `<div class="popup-buttons"><button type="button" class="auth-button auth-button--secondary" id="teamAddBtn">${esc(t("team.add"))}</button></div>`) : ""}
            <p class="auth-inline-copy">${esc(t(can ? "team.note" : "profile.holderOnly", { name: holderName() }))}</p>`;
        restore($("teamForm"), keep);
    }

    $("teamBody").addEventListener("click", async e => {
        if (e.target.id === "teamAddBtn") { addingTeammate = true; renderTeam(); $("teamForm").elements.name.focus(); return; }
        if (e.target.id === "teamCancelBtn") { addingTeammate = false; renderTeam(); return; }
        const rm = e.target.closest("[data-remove]");
        if (!rm) return;
        const memberId = rm.dataset.remove;
        if (confirmRemove !== memberId) { confirmRemove = memberId; renderTeam(); return; }
        rm.disabled = true;
        const member = prof.team.find(m => m.id === memberId);
        const res = await VP.api("vendor-api", "team_remove", { id: memberId });
        confirmRemove = null;
        if (!res.ok) { renderTeam(); VP.setMessage($("teamMessage"), VP.errText(res.error), "error"); return; }
        await load();
        flashes.team = { text: t("team.removed", { name: member?.name || member?.email || "" }), type: "success" };
        renderTeam();
    });

    $("teamBody").addEventListener("submit", async e => {
        if (e.target.id !== "teamForm") return;
        e.preventDefault();
        const f = e.target;
        const body = { name: f.elements.name.value.trim(), title: f.elements.title.value.trim(), email: f.elements.email.value.trim(), phone: f.elements.phone.value.trim() };
        const missing = ["name", "email"].filter(k => !body[k]);
        if (missing.length) { VP.markFields(f, missing); VP.setMessage($("teamMessage"), VP.errText("missing_fields"), "error"); return; }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) { VP.markFields(f, ["email"]); VP.setMessage($("teamMessage"), VP.errText("bad_email"), "error"); return; }
        const btn = $("teamSendBtn");
        btn.disabled = true; btn.textContent = t("team.sending");
        const res = await VP.api("vendor-api", "team_add", body);
        btn.disabled = false; btn.textContent = t("team.send");
        if (!res.ok) { VP.markFields(f, res.fields || []); VP.setMessage($("teamMessage"), VP.errText(res.error), "error"); return; }
        addingTeammate = false;
        await load();
        flashes.team = { text: t(res.emailed ? "team.added" : "team.addedNoEmail", { name: body.name }), type: "success" };
        renderTeam();
    });

    /* ---------- my info ---------- */
    function renderMe(keep) {
        const u = VP.me.user;
        $("meForm").innerHTML = `
            <div class="wizard-field-grid">
                <label class="auth-field">${esc(t("apply.name"))}<input type="text" name="name" maxlength="120" value="${esc(u.name || "")}"></label>
                <label class="auth-field">${esc(t("apply.jobTitle"))}<input type="text" name="title" maxlength="120" value="${esc(u.title || "")}"></label>
            </div>
            <div class="wizard-field-grid">
                <label class="auth-field">${esc(t("profile.myEmail"))}<input type="email" value="${esc(u.email)}" disabled class="vp-readonly"></label>
                <label class="auth-field">${esc(t("apply.phone"))}<input type="tel" name="phone" maxlength="40" value="${esc(u.phone || "")}"></label>
            </div>
            <p class="auth-message hidden" id="meMessage" role="alert"></p>
            ${flashHtml("me")}
            <div class="popup-buttons"><button type="submit" class="auth-button" id="meSaveBtn">${esc(t("save"))}</button></div>`;
        restore($("meForm"), keep);
    }

    $("meForm").addEventListener("submit", async e => {
        e.preventDefault();
        const f = e.target;
        const body = { name: f.elements.name.value.trim(), title: f.elements.title.value.trim(), phone: f.elements.phone.value.trim() };
        if (!body.name) { VP.markFields(f, ["name"]); VP.setMessage($("meMessage"), VP.errText("missing_fields"), "error"); return; }
        const btn = $("meSaveBtn");
        btn.disabled = true; btn.textContent = t("saving");
        const res = await VP.api("vendor-api", "update_me", body);
        btn.disabled = false; btn.textContent = t("save");
        if (!res.ok) { VP.setMessage($("meMessage"), VP.errText(res.error), "error"); return; }
        Object.assign(VP.me.user, body);
        await load();
        flashes.me = { text: t("saved"), type: "success" };
        renderMe(); renderTeam();
        const pill = document.querySelector(".header-user-pill span");
        if (pill) pill.textContent = [body.name, me.company.friendly_name || me.company.name].filter(Boolean).join(" · ");
    });

    /* ---------- documents ---------- */
    // The COI date is what counts; the PDF is only asked for when awarded.
    function coiChip(coi) {
        if (coi.exempt && !coi.expires_on) return `<span class="chip chip--muted">${esc(t("docs.exempt"))}</span>`;
        if (!coi.expires_on) return `<span class="chip chip--danger">${esc(t("docs.noDate"))}</span>`;
        const exp = new Date(`${coi.expires_on}T23:59:59`);
        const days = (exp.getTime() - Date.now()) / 86400000;
        if (days < 0) return `<span class="chip chip--danger">${esc(t("docs.expired", { date: VP.fmtDay(coi.expires_on) }))}</span>`;
        return `<span class="chip ${days <= 30 ? "chip--warning" : "chip--success"}">${esc(t("docs.expires", { date: VP.fmtDay(coi.expires_on) }))}</span>`;
    }

    function docForm(kind) {
        return `
            <form class="auth-form vp-doc-form" id="docForm" data-kind="${kind}" novalidate>
                ${kind === "coi" ? "" : `<label class="auth-field">${esc(t("docs.file"))}<input type="file" name="file" accept="application/pdf,.pdf"></label>`}
                ${kind === "coi"
                    ? `<label class="auth-field">${esc(t("docs.newExp"))}<input type="date" name="expires_on" value="${esc(prof.company.coi.expires_on || "")}"></label>`
                    : `<label class="auth-field">${esc(t("docs.newTax"))}<input type="text" name="ssn_fid" maxlength="20" inputmode="numeric" autocomplete="off" placeholder="XX-XXXXXXX"></label>`}
                <div class="popup-buttons">
                    <button type="button" class="auth-button auth-button--secondary" data-doc-cancel>${esc(t("cancel"))}</button>
                    <button type="submit" class="auth-button" id="docUploadBtn">${esc(t(kind === "coi" ? "save" : "docs.upload"))}</button>
                </div>
            </form>`;
    }

    function renderDocs(keep) {
        const { w9, coi } = prof.company;
        $("docsBody").innerHTML = `
            <div class="vendor-profile-section">
                <span class="company-card-label">${esc(t("docs.w9"))}</span>
                <div class="vp-doc-row">
                    ${w9.on_file ? `<span class="chip chip--success">${esc(t("docs.onFile"))}</span>` : `<span class="chip chip--danger">${esc(t("docs.missing"))}</span>`}
                    ${w9.updated_at ? `<span class="auth-inline-copy">${esc(t("docs.updated", { date: VP.fmtDay(w9.updated_at) }))}</span>` : ""}
                    ${w9.on_file ? `<button type="button" class="workbook-btn" data-doc-view="w9" style="margin-left:auto">${esc(t("docs.view"))}</button>` : ""}
                </div>
                ${openDoc === "w9" ? docForm("w9") : `<div class="bid-file-add-row"><button type="button" class="bid-file-add-btn" data-doc-open="w9">${esc(t("docs.uploadW9"))}</button></div>`}
                ${flashHtml("w9")}
            </div>
            <div class="vendor-profile-section">
                <span class="company-card-label">${esc(t("docs.coiDateTitle"))}</span>
                <div class="vp-doc-row">
                    ${coiChip(coi)}
                </div>
            </div>
            <p class="auth-message hidden" id="docMessage" role="alert"></p>`;
        restore($("docForm"), keep);
    }

    $("docsBody").addEventListener("click", async e => {
        const openBtn = e.target.closest("[data-doc-open]");
        if (openBtn) { openDoc = openBtn.dataset.docOpen; renderDocs(); return; }
        if (e.target.closest("[data-doc-cancel]")) { openDoc = null; renderDocs(); return; }
        const view = e.target.closest("[data-doc-view]");
        if (view) {
            // In the portal's preview, never a new tab.
            const kind = view.dataset.docView;
            const sign = async dl => {
                const res = await VP.api("vendor-api", "doc_url", { kind, download: dl });
                if (!res.ok || !res.url) throw new Error(res.error || "generic");
                return res.url;
            };
            VP.preview({ name: `${prof.company.legal_name} - ${kind === "coi" ? "COI" : "W-9"}.pdf`, kind: "pdf", getUrl: () => sign(false), getDownloadUrl: () => sign(true) });
        }
    });

    $("docsBody").addEventListener("submit", async e => {
        if (e.target.id !== "docForm") return;
        e.preventDefault();
        const f = e.target;
        const kind = f.dataset.kind;
        const file = f.elements.file ? f.elements.file.files[0] : null;
        const missing = [];
        if (!file && kind !== "coi") missing.push("file");
        if (kind === "coi" && !f.elements.expires_on.value) missing.push("expires_on");
        if (missing.length) { VP.markFields(f, missing); VP.setMessage($("docMessage"), VP.errText(missing[0] === "file" ? "missing_file" : "missing_fields"), "error"); return; }
        if (file && !/\.pdf$/i.test(file.name)) { VP.markFields(f, ["file"]); VP.setMessage($("docMessage"), VP.errText("pdf_only"), "error"); return; }
        const taxId = kind === "w9" ? f.elements.ssn_fid.value.trim() : "";
        if (taxId && taxId.replace(/[^0-9]/g, "").length !== 9) { VP.markFields(f, ["ssn_fid"]); VP.setMessage($("docMessage"), VP.errText("bad_tax_id"), "error"); return; }
        VP.markFields(f, []);
        VP.setMessage($("docMessage"), "");

        const btn = $("docUploadBtn");
        btn.disabled = true; btn.textContent = t(kind === "coi" ? "saving" : "docs.uploading");
        try {
            if (kind === "coi" && !file) {
                // Date only — that's all approval needs.
                const res = await VP.api("vendor-api", "set_coi_date", { expires_on: f.elements.expires_on.value });
                if (!res.ok) { VP.markFields(f, res.fields || []); VP.setMessage($("docMessage"), VP.errText(res.error), "error"); return; }
                openDoc = null;
                await load();
                flashes.coi = { text: t("docs.dateSaved"), type: "success" };
                renderDocs();
                return;
            }
            const slot = await VP.api("vendor-api", "doc_upload_url", { kind, file_name: file.name });
            if (!slot.ok) { VP.setMessage($("docMessage"), VP.errText(slot.error), "error"); return; }
            if (!(await VP.uploadToSlot(slot, file))) { VP.setMessage($("docMessage"), VP.errText("upload"), "error"); return; }
            const body = { kind, path: slot.path };
            if (kind === "coi") body.expires_on = f.elements.expires_on.value;
            if (taxId) body.ssn_fid = taxId;
            const res = await VP.api("vendor-api", "save_doc", body);
            if (!res.ok) { VP.markFields(f, res.fields || []); VP.setMessage($("docMessage"), VP.errText(res.error), "error"); return; }
            openDoc = null;
            await load();
            flashes[kind] = { text: t("docs.uploaded"), type: "success" };
            renderDocs();
            renderCompany();
        } finally {
            if (document.body.contains(btn)) { btn.disabled = false; btn.textContent = t(kind === "coi" ? "save" : "docs.upload"); }
        }
    });

    /* ---------- helpers ---------- */
    function snapshot(form) {
        const out = {};
        if (form) Array.from(form.elements).forEach(el => { if (el.name && el.type !== "file" && !el.disabled) out[el.name] = el.value; });
        return out;
    }
    function restore(form, keep) {
        if (!form || !keep) return;
        Object.entries(keep).forEach(([k, v]) => { if (form.elements[k] && form.elements[k].type !== "file") form.elements[k].value = v; });
    }

    function renderAll(keepAll = {}) {
        renderCompany(keepAll.company);
        renderTeam(keepAll.team);
        renderMe(keepAll.me);
        renderDocs(keepAll.docs);
    }

    if (!(await load())) return;
    renderAll();
    $("profileGrid").classList.remove("hidden");

    document.addEventListener("vp:lang", () => {
        renderAll({ company: snapshot($("companyForm")), team: snapshot($("teamForm")), me: snapshot($("meForm")), docs: snapshot($("docForm")) });
    });
})();
