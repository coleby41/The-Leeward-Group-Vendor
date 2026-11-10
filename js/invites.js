/* Home / My Invites (2026-11-10 redesign).
   Greeting, "Action items" (bids to answer, contracts to sign, COIs and
   W-9 to upload), open invites as cards with a countdown, past invites,
   and the company compliance panel. Data: vendor-api invites, projects
   and profile, all asked for at once; each shows its remembered copy
   first and swaps in the fresh one when it arrives. */
(async function () {
    "use strict";
    const $ = id => document.getElementById(id);
    const { t, esc } = VP;
    const TZ = "America/New_York";

    // Ask for everything right away, in parallel with requireMe.
    const reqs = { invites: VP.swr("invites"), projects: VP.swr("projects"), profile: VP.swr("profile") };
    const data = await VP.requireMe();
    if (data.error) { $("openBody").innerHTML = `<p class="auth-message error">${esc(VP.errText(data.error))}</p>`; return; }
    VP.renderShell("invites");

    const state = { invites: null, projects: null, profile: null };

    /* ---------- small pieces ---------- */
    const ICON_INVITE = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 4h16v16H4z"></path><path d="M4 9h16"></path><path d="M9 13h6"></path></svg>';
    const ICON_SHIELD = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z"></path><path d="M12 8v5"></path><path d="M12 16h.01"></path></svg>';
    const ICON_PEN = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16z"></path><path d="M13 7l4 4"></path></svg>';
    const ICON_DOC = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 3h9l4 4v14H6z"></path><path d="M9 13h6M9 17h4"></path></svg>';
    const CHEVRON = '<svg class="vp-chevron" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"></path></svg>';
    const DOT_OK = '<svg class="vp-dot" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="11" fill="#3FB37F"></circle><path d="M7 12.4l3.3 3.3L17.2 8.8" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"></path></svg>';
    const DOT_NO = '<svg class="vp-dot" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="11" fill="#F59E0B"></circle><path d="M12 7v6" stroke="#0B2545" stroke-width="2.4" stroke-linecap="round"></path><circle cx="12" cy="16.8" r="1.4" fill="#0B2545"></circle></svg>';
    const DOT_INFO = '<svg class="vp-dot" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="11" fill="#29A9E1"></circle><circle cx="12" cy="9" r="3" fill="#0B2545"></circle><path d="M6.5 18c1-3 3-4 5.5-4s4.5 1 5.5 4" fill="#0B2545"></path></svg>';
    const WAVES = `<svg viewBox="0 0 220 40" aria-hidden="true">
        <path d="M0 18 C 40 4, 75 32, 115 16 S 185 2, 220 12" fill="none" stroke="#29A9E1" stroke-width="2" opacity="0.8"></path>
        <path d="M0 28 C 45 15, 85 40, 130 26 S 195 12, 220 22" fill="none" stroke="#1F74BC" stroke-width="2"></path></svg>`;

    const needsAnswer = inv => inv.open && (inv.status === "sent" || inv.status === "viewed");
    const isOpen = inv => inv.open && inv.status !== "awarded" && inv.status !== "not_selected";
    const link = inv => `invite.html?id=${encodeURIComponent(inv.id)}`;
    const projectLink = id => `project.html?id=${encodeURIComponent(id)}`;
    const locale = () => (VP.lang === "es" ? "es-US" : "en-US");

    function badge(inv) {
        switch (inv.status) {
            case "sent":
            case "viewed": return inv.open ? `<span class="vp-badge vp-badge--warn">${esc(t("status.needs"))}</span>` : `<span class="vp-badge vp-badge--muted">${esc(t("status.no_response"))}</span>`;
            case "bidding": return `<span class="vp-badge vp-badge--info">${esc(t("status.bidding"))}</span>`;
            case "not_bidding": return `<span class="vp-badge vp-badge--muted">${esc(t("status.not_bidding"))}</span>`;
            case "bid_received": return `<span class="vp-badge vp-badge--ok">${esc(t("status.bid_received", { amount: VP.fmtMoney(inv.bid_amount) }))}</span>`;
            case "awarded": return inv.coi_needed
                ? `<span class="vp-badge vp-badge--warn">${esc(t("status.coi_needed"))}</span>`
                : `<span class="vp-badge vp-badge--ok">${esc(t("status.awarded"))}</span>`;
            case "not_selected": return `<span class="vp-badge vp-badge--muted">${esc(t("status.not_selected"))}</span>`;
            default: return `<span class="vp-badge vp-badge--muted">${esc(t("status.closed"))}</span>`;
        }
    }

    function action(kind, icon, warn, title, sub, href, btn) {
        return `<article class="vp-action ${warn ? "vp-action--warn" : ""}">
            <div class="vp-action__kind"><span class="vp-action__icon">${icon}</span>${esc(kind)}</div>
            <div><h3>${esc(title)}</h3><p>${esc(sub)}</p></div>
            <a class="auth-button" href="${href}">${esc(btn)}</a>
        </article>`;
    }

    // Everything the vendor needs to do, most urgent first.
    function actions() {
        const list = [];
        (state.invites || []).filter(needsAnswer).sort((a, b) => new Date(a.due_at) - new Date(b.due_at)).forEach(inv => {
            list.push(action(t("home.kindBid"), ICON_INVITE, false, t("home.respondTo", { name: inv.package_name }),
                t("home.bidsDue", { project: inv.project_name, when: VP.fmtDateTime(inv.due_at) }), link(inv), t("home.openInvite")));
        });
        if (state.projects) {
            let w9Needed = false;
            state.projects.forEach(p => {
                if (!p.locked) return;
                if (p.contract?.status === "to_sign") list.push(action(t("home.kindContract"), ICON_PEN, true, t("home.signContract"), p.name, projectLink(p.id), t("home.signBtn")));
                if (!p.checklist?.coi) list.push(action(t("home.kindInsurance"), ICON_SHIELD, true, t("home.coiNeeded"), t("home.coiFor", { project: p.name }), projectLink(p.id), t("project.coiUpload")));
                if (!p.checklist?.w9) w9Needed = true;
            });
            if (w9Needed) list.push(action(t("home.kindCompany"), ICON_DOC, true, t("home.w9Needed"), t("home.w9Body"), "profile.html", t("lock.w9Btn")));
        } else {
            // Projects didn't load: fall back to the COI flags on the invites.
            const seen = new Set();
            (state.invites || []).filter(i => i.coi_needed && !seen.has(i.project_id) && seen.add(i.project_id)).forEach(inv => {
                list.push(action(t("home.kindInsurance"), ICON_SHIELD, true, t("home.coiNeeded"), t("home.coiFor", { project: inv.project_name }), projectLink(inv.project_id), t("project.coiUpload")));
            });
        }
        return list;
    }

    function renderGreeting(count) {
        const first = String(data.user?.name || "").trim().split(/\s+/)[0] || "";
        $("greetDate").textContent = new Date().toLocaleDateString(locale(), { timeZone: TZ, weekday: "long", month: "long", day: "numeric" });
        $("greetTitle").textContent = first ? t("home.welcome", { name: first }) : t("home.welcomeNoName");
        $("greetSub").innerHTML = count == null ? "&nbsp;"
            : count === 0 ? esc(t("home.allClear"))
            : VP.tHtml(count === 1 ? "home.itemsOneHtml" : "home.itemsHtml", { n: count });
    }

    function renderCompliance() {
        const p = state.profile;
        if (!p) return;
        const c = p.company;
        const w9 = c.w9.on_file || c.w9.exempt;
        const today = new Date().toISOString().slice(0, 10);
        const coiOk = c.coi.exempt || (c.coi.expires_on && c.coi.expires_on >= today);
        const team = (p.team || []).length;
        $("complianceList").innerHTML = `
            <li>${w9 ? DOT_OK : DOT_NO}<span>${esc(t(w9 ? "home.w9On" : "home.w9Off"))}</span></li>
            <li>${coiOk ? DOT_OK : DOT_NO}<span>${esc(t(c.coi.exempt ? "coiStatus.exempt" : coiOk ? "home.coiOk" : "home.coiOff"))}${c.coi.expires_on && !c.coi.exempt ? `<small>${esc(t("home.through", { date: VP.fmtDay(c.coi.expires_on) }))}</small>` : ""}</span></li>
            <li>${DOT_INFO}<span>${esc(t(team === 1 ? "home.teamOne" : "home.team", { n: team }))}</span></li>`;
        $("compliance").classList.remove("hidden");
    }

    function render() {
        if (!state.invites) return;
        const list = actions();
        renderGreeting(list.length);
        $("actionSection").classList.toggle("hidden", list.length === 0);
        $("actionsBody").innerHTML = list.join("");

        const open = state.invites.filter(isOpen).sort((a, b) => new Date(a.due_at) - new Date(b.due_at));
        const past = state.invites.filter(i => !isOpen(i)).sort((a, b) => (b.coi_needed - a.coi_needed) || (new Date(b.due_at) - new Date(a.due_at)));

        $("openCount").textContent = t("home.openCount", { n: open.length });
        $("openBody").innerHTML = open.length ? open.map(inv => {
            const days = VP.daysLeft(inv.due_at);
            return `<a class="vp-invite-card" href="${link(inv)}">
                <span class="vp-countdown ${days != null && days <= 3 ? "is-urgent" : ""}"><strong>${days == null ? "—" : esc(String(days))}</strong><span>${esc(t(days === 1 ? "home.dayLeft" : "home.daysLeft"))}</span></span>
                <span class="vp-invite-card__text">
                    <span class="vp-invite-card__title">${esc(inv.package_name)}</span>
                    <span class="vp-invite-card__sub">${esc(inv.project_name)}</span>
                    <span class="vp-invite-card__meta">${esc(t("home.due", { when: VP.fmtDateTime(inv.due_at) }))}${inv.walkthrough_at ? ` · ${esc(t("home.walk", { when: VP.fmtDateTime(inv.walkthrough_at) }))}` : ""}</span>
                </span>
                ${badge(inv)}
                ${CHEVRON}
            </a>`;
        }).join("") : `<div class="vp-empty">${WAVES}<strong>${esc(t("home.emptyTitle"))}</strong><span>${esc(t("home.emptyBody"))}</span></div>`;

        $("pastBody").innerHTML = past.length ? `
            <div class="vp-table-card"><div class="table-wrap">
              <table class="vp-invites-table">
                <thead><tr><th scope="col">${esc(t("col.package"))}</th><th scope="col">${esc(t("col.project"))}</th><th scope="col">${esc(t("col.closed"))}</th><th scope="col">${esc(t("col.result"))}</th><th scope="col"><span class="hidden">${esc(t("col.action"))}</span></th></tr></thead>
                <tbody>${past.map(inv => `<tr>
                    <td><strong>${esc(inv.package_name)}</strong><span class="bid-cell-sub vp-project-sub">${esc(inv.project_name)}</span></td>
                    <td>${esc(inv.project_name)}</td>
                    <td>${esc(VP.fmtDay(inv.due_at, false))}</td>
                    <td>${badge(inv)}</td>
                    <td><div class="bid-row-actions">${inv.status === "awarded"
                        ? `<a href="${projectLink(inv.project_id)}" class="auth-link" style="font-weight:700">${esc(t("home.openProject"))}</a>`
                        : `<a href="${link(inv)}" class="auth-link" style="font-weight:700">${esc(t("btn.view"))}</a>`}</div></td>
                </tr>`).join("")}</tbody>
              </table>
            </div></div>` : `<p class="auth-inline-copy">${esc(t("invites.emptyPast"))}</p>`;

        renderCompliance();
    }

    document.addEventListener("vp:lang", render);

    // Remembered copies first (instant), then the fresh answers.
    Object.entries(reqs).forEach(([k, r]) => { if (r.cached) state[k] = k === "invites" ? r.cached.invites : k === "projects" ? r.cached.projects : r.cached; });
    if (state.invites) { VP.refreshInviteBadge(state.invites); render(); }

    const [inv, proj, prof] = await Promise.all([reqs.invites.fresh, reqs.projects.fresh, reqs.profile.fresh]);
    if (!inv.ok && !state.invites) {
        $("openBody").innerHTML = `<p class="auth-message error">${esc(VP.errText(inv.error))}</p>`;
        $("pastBody").innerHTML = "";
        return;
    }
    if (inv.ok) state.invites = inv.invites;
    if (proj.ok) state.projects = proj.projects;
    if (prof.ok) state.profile = prof;
    VP.refreshInviteBadge(state.invites);
    render();
})();
