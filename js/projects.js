/* My Projects — one folder per project The Leeward Group awarded this vendor. */
(async function () {
    "use strict";
    const $ = id => document.getElementById(id);
    const { t, esc } = VP;

    const first = VP.swr("projects"); // remembered copy now, fresh one in parallel with requireMe
    const data = await VP.requireMe();
    if (data.error) { $("projectsBody").innerHTML = `<p class="auth-message error">${esc(VP.errText(data.error))}</p>`; return; }
    VP.renderShell("projects");

    let projects = null;
    let exempt = false;

    const STEPS = ["contract", "w9", "coi"];

    // What's left on a locked project, in plain words.
    // The vendor's own steps come first; otherwise say what Leeward still owes.
    function nextStep(p) {
        const c = p.checklist || {};
        const d = VP.projectTodo(p);
        if (d.sign) return t("projects.nextSign");
        if (d.w9) return t("projects.nextW9");
        if (d.coi) return t("projects.nextCoi");
        if (!c.contract) return t("projects.nextWaiting");
        if (!c.coi) return t("projects.nextWaitingTpl");
        return "";
    }

    function card(p) {
        const href = `project.html?id=${encodeURIComponent(p.id)}`;
        const c = p.checklist || {};
        const done = STEPS.filter(k => c[k]).length;
        const scope = p.scopes[0] || {};
        const more = p.scopes.length > 1 ? ` ${t("projects.moreScopes", { n: p.scopes.length - 1 })}` : "";
        let status, btn;
        if (p.locked && VP.waitingOnLeeward(p)) {
            // Nothing for the vendor to do — don't say "Action required".
            status = `<span class="vp-badge vp-badge--info">${esc(t("projects.waiting"))}</span>`;
            btn = `<a class="vp-btn-ghost" href="${href}">${esc(t("projects.viewStatus"))}</a>`;
        } else if (p.locked) {
            const d = VP.projectTodo(p);
            status = `<span class="vp-badge vp-badge--warn">${esc(t("projects.actionRequired"))}</span>`;
            btn = `<a class="auth-button" href="${href}">${esc(t(d.sign ? "home.signBtn" : d.coi && !d.w9 ? "project.coiUpload" : "projects.complete"))}</a>`;
        } else {
            status = p.coi.needed
                ? `<span class="vp-badge vp-badge--warn">${esc(t("status.coi_needed"))}</span>`
                : `<span class="vp-badge vp-badge--ok">${esc(t("projects.approved"))}</span>`;
            btn = `<a class="vp-btn-ghost" href="${href}">${esc(t("btn.openFolder"))}</a>`;
        }
        const mark = ok => (ok ? "✓" : "—");
        return `<article class="vp-proj-card">
            <div class="vp-proj-card__band ${p.locked ? "" : "is-open"}">${status}</div>
            <div class="vp-proj-card__body">
                <div>
                    <h2><a href="${href}">${esc(p.name)}</a></h2>
                    <p class="vp-proj-card__sub">${p.locked ? esc(p.location || "") : esc((scope.name || t("project.addedScope")) + more)}</p>
                </div>
                ${p.locked ? `<div class="vp-progress">
                    <div class="vp-progress__head"><strong>${esc(t("lock.progress", { n: done, total: 3 }))}</strong><span>${esc(nextStep(p))}</span></div>
                    <div class="vp-progress__bar" aria-hidden="true">${STEPS.map(k => `<span class="${c[k] ? "is-done" : ""}"></span>`).join("")}</div>
                    <ul class="vp-mini">
                        <li>${esc(t("lock.contract"))} ${mark(c.contract)}</li><li>${esc(t("lock.w9"))} ${mark(c.w9)}</li><li>${esc(t("col.coi"))} ${mark(c.coi)}</li>
                    </ul>
                </div>` : `<p class="vp-proj-card__sub">${esc(p.location || "")}</p>`}
                ${btn}
            </div>
        </article>`;
    }

    function render() {
        if (!projects) return;
        $("projectsBody").innerHTML = projects.length
            ? `<div class="vp-proj-grid">${projects.map(card).join("")}</div>`
            : `<div class="vp-empty"><svg viewBox="0 0 220 40" aria-hidden="true"><path d="M0 18 C 40 4, 75 32, 115 16 S 185 2, 220 12" fill="none" stroke="#29A9E1" stroke-width="2" opacity="0.8"></path><path d="M0 28 C 45 15, 85 40, 130 26 S 195 12, 220 22" fill="none" stroke="#1F74BC" stroke-width="2"></path></svg><strong>${esc(t("projects.emptyTitle"))}</strong><span>${esc(t("projects.empty"))}</span></div>`;
    }

    // Save every project from this list as its own page's answer (same shape
    // as vendor-api "project"), so clicking a folder opens it instantly; the
    // project page still checks the server in the background.
    function seedProjects(res) {
        if (!res || !res.ok || !res.company_coi) return; // older vendor-api: skip
        res.projects.forEach(p => VP.seed("project", { id: p.id }, { ok: true, project: p, company_coi: res.company_coi }));
    }

    document.addEventListener("vp:lang", render);
    if (first.cached) { projects = first.cached.projects; exempt = first.cached.coi_exempt; render(); seedProjects(first.cached); }
    const res = await first.fresh;
    seedProjects(res);
    if (!res.ok) { if (!first.cached) $("projectsBody").innerHTML = `<p class="auth-message error">${esc(VP.errText(res.error))}</p>`; return; }
    if (first.cached && VP.same(res, first.cached)) return;
    projects = res.projects;
    exempt = res.coi_exempt;
    render();
})();
