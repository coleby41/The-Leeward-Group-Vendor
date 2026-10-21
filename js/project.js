/* One project folder: the scopes awarded on it and this project's COI PDF. */
(async function () {
    "use strict";
    const $ = id => document.getElementById(id);
    const { t, esc } = VP;
    const id = new URLSearchParams(location.search).get("id") || "";

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
        const res = await VP.api("vendor-api", "project", { id });
        if (!res.ok) { pageError(res.error); return false; }
        state = res;
        return true;
    }

    function renderHead() {
        const p = state.project;
        $("projName").textContent = p.name;
        $("projSub").textContent = p.location || "";
    }

    function renderScopes() {
        const p = state.project;
        $("scopesBody").innerHTML = `
            <div class="table-wrap">
              <table class="dash-queue-table bid-tracker-table vp-folder-table">
                <thead><tr><th>${esc(t("col.package"))}</th><th>${esc(t("project.amount"))}</th><th>${esc(t("project.awarded"))}</th><th></th></tr></thead>
                <tbody>${p.scopes.map(sc => `<tr>
                    <td><strong>${esc(sc.name)}</strong>${sc.contact_name ? `<span class="bid-cell-sub">${esc(t("project.contact"))}: ${esc(sc.contact_name)}${sc.contact_email ? ` · <a class="auth-link" href="mailto:${esc(sc.contact_email)}">${esc(sc.contact_email)}</a>` : ""}</span>` : ""}</td>
                    <td>${esc(VP.fmtMoney(sc.amount))}</td>
                    <td>${esc(VP.fmtDay(sc.awarded_at))}</td>
                    <td><div class="bid-row-actions">${sc.proposal ? `<button type="button" class="workbook-btn" data-file="${esc(sc.proposal.id)}">${esc(t("project.proposal"))}</button>` : ""}</div></td>
                </tr>`).join("")}</tbody>
              </table>
            </div>`;
    }

    function chip() {
        const c = state.project.coi;
        if (c.file && !c.needed) return `<span class="chip chip--success">${esc(t("coiStatus.received"))}</span>`;
        if (c.needed) return `<span class="chip chip--warning">${esc(t("coiStatus.needed"))}</span>`;
        if (state.company_coi.exempt) return `<span class="chip chip--muted">${esc(t("coiStatus.exempt"))}</span>`;
        return `<span class="chip chip--muted">${esc(t("coiStatus.notRequested"))}</span>`;
    }

    function renderDocs() {
        const c = state.project.coi;
        const exempt = state.company_coi.exempt && !c.needed;
        const company = state.company_coi.expires_on
            ? t("project.companyDate", { date: VP.fmtDay(state.company_coi.expires_on) })
            : t("project.companyNoDate");
        $("coiChip").innerHTML = chip();
        $("docsBody").innerHTML = `
            <div class="vendor-profile-section">
                <span class="company-card-label">${esc(t("project.coiTitle"))}</span>
                <p class="auth-inline-copy" style="margin:4px 0 8px">${esc(exempt ? t("project.coiExempt") : c.needed ? t("project.coiNeeded") : c.file ? "" : t("project.coiNotRequested"))}</p>
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
                <p class="auth-inline-copy" style="margin:0">${esc(company)} <a class="auth-link" href="profile.html">${esc(t("project.goProfile"))}</a></p>
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
        busy = true;
        const btn = $("coiUploadBtn");
        btn.disabled = true; btn.textContent = t("docs.uploading");
        try {
            const slot = await VP.api("vendor-api", "project_coi_upload_url", { project_id: id, file_name: file.name });
            if (!slot.ok) { VP.setMessage(msg, VP.errText(slot.error), "error"); return; }
            if (!(await VP.uploadToSlot(slot, file))) { VP.setMessage(msg, VP.errText("upload"), "error"); return; }
            const res = await VP.api("vendor-api", "save_project_coi", { project_id: id, path: slot.path, file_name: file.name });
            if (!res.ok) { VP.setMessage(msg, VP.errText(res.error), "error"); return; }
            await load();
            flash = { text: t("project.coiDone"), type: "success" };
            renderDocs();
            VP.refreshInviteBadge();
        } finally {
            busy = false;
            if (document.body.contains(btn)) { btn.disabled = false; btn.textContent = t(state.project.coi.file ? "project.coiReplace" : "project.coiUpload"); }
        }
    }

    async function openFile(fileId, download) {
        const win = download ? null : window.open("", "_blank");
        const res = await VP.api("vendor-api", "project_file_url", { project_id: id, file_id: fileId, download });
        if (!res.ok || !res.url) { if (win) win.close(); pageError(res.error || "generic"); return; }
        if (win) { win.opener = null; win.location.href = res.url; return; }
        const a = document.createElement("a");
        a.href = res.url; a.rel = "noopener"; a.target = "_blank"; a.download = res.name || "";
        document.body.appendChild(a); a.click(); a.remove();
    }
    document.addEventListener("click", e => {
        const dl = e.target.closest("[data-file]");
        if (dl) { openFile(dl.dataset.file, true); return; }
        const view = e.target.closest("[data-view]");
        if (view) openFile(view.dataset.view, false);
    });

    if (!(await load())) return;
    const renderAll = () => { renderHead(); renderScopes(); renderDocs(); };
    renderAll();
    $("projectGrid").classList.remove("hidden");
    document.addEventListener("vp:lang", renderAll);
})();
