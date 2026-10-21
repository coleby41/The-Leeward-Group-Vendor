/* My Invites — open invites first, then past ones. */
(async function () {
    "use strict";
    const $ = id => document.getElementById(id);
    const { t, esc } = VP;

    const firstLoad = VP.approvedCached() ? VP.api("vendor-api", "invites") : null; // in parallel with requireMe
    const data = await VP.requireMe();
    if (data.error) { $("openBody").innerHTML = `<p class="auth-message error">${esc(VP.errText(data.error))}</p>`; return; }
    VP.renderShell("invites");

    let invites = null;

    function responseChip(inv) {
        switch (inv.status) {
            case "sent":
            case "viewed": return inv.open ? `<span class="chip chip--warning">${esc(t("status.needs"))}</span>` : `<span class="chip chip--muted">${esc(t("status.no_response"))}</span>`;
            case "bidding": return `<span class="chip chip--info">${esc(t("status.bidding"))}</span>`;
            case "not_bidding": return `<span class="chip chip--muted">${esc(t("status.not_bidding"))}</span>`;
            case "bid_received": return `<span class="chip chip--success">${esc(t("status.bid_received", { amount: VP.fmtMoney(inv.bid_amount) }))}</span>`;
            case "awarded": return inv.coi_needed
                ? `<span class="chip chip--warning">${esc(t("status.coi_needed"))}</span>`
                : `<span class="chip chip--success">${esc(t("status.awarded"))}</span>`;
            case "not_selected": return `<span class="chip chip--muted">${esc(t("status.not_selected"))}</span>`;
            default: return `<span class="chip chip--muted">${esc(t("status.closed"))}</span>`;
        }
    }

    const isOpen = inv => inv.open && inv.status !== "awarded" && inv.status !== "not_selected";
    const link = inv => `invite.html?id=${encodeURIComponent(inv.id)}`;

    function render() {
        $("heroCompany").textContent = data.company.friendly_name || data.company.name;
        if (!invites) return;
        const open = invites.filter(isOpen).sort((a, b) => new Date(a.due_at) - new Date(b.due_at));
        const past = invites.filter(i => !isOpen(i)).sort((a, b) => (b.coi_needed - a.coi_needed) || (new Date(b.due_at) - new Date(a.due_at)));

        $("openBody").innerHTML = open.length ? `
            <div class="table-wrap">
              <table class="dash-queue-table bid-tracker-table vp-invites-table">
                <thead><tr><th>${esc(t("col.package"))}</th><th>${esc(t("col.project"))}</th><th>${esc(t("col.due"))}</th><th>${esc(t("col.response"))}</th><th></th></tr></thead>
                <tbody>${open.map(inv => {
                    const days = VP.daysLeft(inv.due_at);
                    const needs = inv.status === "sent" || inv.status === "viewed";
                    return `<tr>
                        <td><strong>${esc(inv.package_name)}</strong>
                            <span class="bid-cell-sub vp-project-sub">${esc(inv.project_name)}</span>
                            ${inv.walkthrough_at ? `<span class="bid-cell-sub">${esc(t("invites.walk", { when: VP.fmtDateTime(inv.walkthrough_at) }))}</span>` : ""}</td>
                        <td>${esc(inv.project_name)}</td>
                        <td>${esc(VP.fmtDateTime(inv.due_at))}<span class="bid-cell-sub ${days != null && days <= 3 ? "vp-days-urgent" : ""}">${esc(VP.daysLeftText(inv.due_at))}</span></td>
                        <td>${responseChip(inv)}</td>
                        <td><div class="bid-row-actions">${needs
                            ? `<a href="${link(inv)}" class="auth-button auth-button--sm" style="text-decoration:none;color:#fff">${esc(t("btn.open"))}</a>`
                            : `<a href="${link(inv)}" class="workbook-btn" style="text-decoration:none">${esc(t("btn.viewUpdate"))}</a>`}</div></td>
                    </tr>`;
                }).join("")}</tbody>
              </table>
            </div>` : `<p class="auth-inline-copy">${esc(t("invites.emptyOpen"))}</p>`;

        $("pastBody").innerHTML = past.length ? `
            <div class="table-wrap">
              <table class="dash-queue-table bid-tracker-table vp-invites-table">
                <thead><tr><th>${esc(t("col.package"))}</th><th>${esc(t("col.project"))}</th><th>${esc(t("col.closed"))}</th><th>${esc(t("col.result"))}</th><th></th></tr></thead>
                <tbody>${past.map(inv => `<tr>
                    <td><strong>${esc(inv.package_name)}</strong><span class="bid-cell-sub vp-project-sub">${esc(inv.project_name)}</span></td>
                    <td>${esc(inv.project_name)}</td>
                    <td>${esc(VP.fmtDay(inv.due_at, false))}</td>
                    <td>${responseChip(inv)}</td>
                    <td><div class="bid-row-actions">${inv.coi_needed
                        ? `<a href="project.html?id=${encodeURIComponent(inv.project_id)}" class="auth-button auth-button--sm" style="text-decoration:none;color:#fff">${esc(t("coi.upload"))}</a>`
                        : `<a href="${link(inv)}" class="workbook-btn" style="text-decoration:none">${esc(t("btn.view"))}</a>`}</div></td>
                </tr>`).join("")}</tbody>
              </table>
            </div>` : `<p class="auth-inline-copy">${esc(t("invites.emptyPast"))}</p>`;
    }

    const res = await (firstLoad || VP.api("vendor-api", "invites"));
    if (!res.ok) {
        $("openBody").innerHTML = `<p class="auth-message error">${esc(VP.errText(res.error))}</p>`;
        $("pastBody").innerHTML = "";
        return;
    }
    invites = res.invites;
    VP.refreshInviteBadge(invites);
    render();
    document.addEventListener("vp:lang", render);
})();
