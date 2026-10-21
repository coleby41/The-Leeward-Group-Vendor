/* My Projects — one folder per project The Leeward Group awarded this vendor. */
(async function () {
    "use strict";
    const $ = id => document.getElementById(id);
    const { t, esc } = VP;

    const firstLoad = VP.approvedCached() ? VP.api("vendor-api", "projects") : null; // in parallel with requireMe
    const data = await VP.requireMe();
    if (data.error) { $("projectsBody").innerHTML = `<p class="auth-message error">${esc(VP.errText(data.error))}</p>`; return; }
    VP.renderShell("projects");

    let projects = null;
    let exempt = false;

    function coiChip(p) {
        if (p.coi.file && !p.coi.needed) return `<span class="chip chip--success">${esc(t("coiStatus.received"))}</span>`;
        if (p.coi.needed) return `<span class="chip chip--warning">${esc(t("coiStatus.needed"))}</span>`;
        if (exempt) return `<span class="chip chip--muted">${esc(t("coiStatus.exempt"))}</span>`;
        return `<span class="chip chip--muted">${esc(t("coiStatus.notRequested"))}</span>`;
    }

    function render() {
        $("heroCompany").textContent = data.company.friendly_name || data.company.name;
        if (!projects) return;
        const count = $("projectCount");
        count.textContent = String(projects.length);
        count.style.display = projects.length ? "" : "none";
        $("projectsBody").innerHTML = projects.length ? `
            <div class="table-wrap">
              <table class="dash-queue-table bid-tracker-table vp-folder-table">
                <thead><tr><th>${esc(t("col.project"))}</th><th>${esc(t("col.scopes"))}</th><th>${esc(t("col.coi"))}</th><th></th></tr></thead>
                <tbody>${projects.map(p => {
                    const first = p.scopes[0] || {};
                    const more = p.scopes.length > 1 ? ` <span class="bid-cell-sub" style="display:inline">${esc(t("projects.moreScopes", { n: p.scopes.length - 1 }))}</span>` : "";
                    const href = `project.html?id=${encodeURIComponent(p.id)}`;
                    return `<tr>
                        <td><a class="vp-folder" href="${href}">
                                <span class="vp-folder__icon" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path></svg></span>
                                <span class="vp-folder__text"><strong>${esc(p.name)}</strong>${p.location ? `<span class="bid-cell-sub">${esc(p.location)}</span>` : ""}</span>
                            </a></td>
                        <td>${esc(first.name || "")}${more}</td>
                        <td>${coiChip(p)}</td>
                        <td><div class="bid-row-actions">${p.coi.needed
                            ? `<a href="${href}" class="auth-button auth-button--sm" style="text-decoration:none;color:#fff">${esc(t("project.coiUpload"))}</a>`
                            : `<a href="${href}" class="workbook-btn" style="text-decoration:none">${esc(t("btn.openFolder"))}</a>`}</div></td>
                    </tr>`;
                }).join("")}</tbody>
              </table>
            </div>` : `<p class="auth-inline-copy">${esc(t("projects.empty"))}</p>`;
    }

    const res = await (firstLoad || VP.api("vendor-api", "projects"));
    if (!res.ok) { $("projectsBody").innerHTML = `<p class="auth-message error">${esc(VP.errText(res.error))}</p>`; return; }
    projects = res.projects;
    exempt = res.coi_exempt;
    render();
    document.addEventListener("vp:lang", render);
})();
