/* One bid invite: scope, plans, and the Bidding / Not Bidding response. */
(async function () {
    "use strict";
    const $ = id => document.getElementById(id);
    const { t, esc } = VP;
    const id = new URLSearchParams(location.search).get("id") || "";

    let prefetch = VP.approvedCached() ? VP.api("vendor-api", "invite", { id }) : null; // in parallel with requireMe
    const me = await VP.requireMe();
    if (me.error) return showError(me.error);
    VP.renderShell("invites");

    let state = null;        // { invite, package, project, files }
    let choice = null;       // which form is showing: 'bidding' | 'not_bidding' | null
    let flash = null;        // { text, type } shown under the forms once
    let busy = false;

    function showError(code) {
        const el = $("pageError");
        el.textContent = VP.errText(code);
        el.classList.remove("hidden");
    }

    async function load() {
        const res = prefetch ? await prefetch : await VP.api("vendor-api", "invite", { id });
        prefetch = null;
        if (!res.ok) { showError(res.error); return false; }
        state = res;
        const s = res.invite.status;
        if (choice == null) choice = s === "bidding" || s === "bid_received" ? "bidding" : s === "not_bidding" ? "not_bidding" : null;
        return true;
    }

    /* ---------- left column ---------- */
    function renderInfo() {
        const { package: pkg, project, files } = state;
        $("pkgName").textContent = pkg.name;
        $("pkgSub").textContent = [project.name, project.code ? t("invite.projectCode", { code: project.code }) : "", pkg.location].filter(Boolean).join(" · ");
        $("statDue").textContent = VP.fmtShort(pkg.due_at);
        $("statWalk").textContent = pkg.walkthrough_at ? VP.fmtShort(pkg.walkthrough_at) : "—";
        const days = VP.daysLeft(pkg.due_at);
        $("statDays").textContent = days == null ? "—" : String(days);
        $("scope").textContent = pkg.scope || t("invite.noScope");
        $("files").innerHTML = files.length ? files.map(f => `
            <div class="bid-file-row">
                <span class="bid-file-row-name">${esc(f.name)}</span>
                <button type="button" class="workbook-btn workbook-btn--download" style="flex: 0 0 auto" data-file="${esc(f.id)}">${esc(t("btn.download"))}</button>
            </div>`).join("") : `<p class="auth-inline-copy">${esc(t("invite.noFiles"))}</p>`;

        const rows = [];
        if (pkg.location) rows.push([t("invite.location"), esc(pkg.location)]);
        if (pkg.walkthrough_at) rows.push([t("stat.walk"), esc(VP.fmtDateTime(pkg.walkthrough_at))]);
        if (pkg.walkthrough_location) rows.push([t("invite.walkLocation"), esc(pkg.walkthrough_location)]);
        if (pkg.questions_due_at) rows.push([t("invite.questions"), esc(VP.fmtDateTime(pkg.questions_due_at))]);
        rows.push([t("stat.due"), esc(VP.fmtDateTime(pkg.due_at))]);
        if (pkg.contact_name || pkg.contact_email || pkg.contact_phone) {
            const bits = [esc(pkg.contact_name || "")];
            if (pkg.contact_email) bits.push(`<a class="auth-link" href="mailto:${esc(pkg.contact_email)}">${esc(pkg.contact_email)}</a>`);
            if (pkg.contact_phone) bits.push(`<a class="auth-link" href="tel:${esc(pkg.contact_phone.replace(/[^0-9+]/g, ""))}">${esc(pkg.contact_phone)}</a>`);
            rows.push([t("invite.contact"), bits.filter(Boolean).join("<br>")]);
        }
        $("details").innerHTML = rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${v}</dd>`).join("");
    }

    /* ---------- response card ---------- */
    function statusChip(inv) {
        const map = {
            sent: ["warning", t("status.needs")], viewed: ["warning", t("status.needs")],
            bidding: ["info", t("status.bidding")], not_bidding: ["muted", t("status.not_bidding")],
            bid_received: ["success", t("status.bid_received", { amount: VP.fmtMoney(inv.bid_amount) })],
            awarded: ["success", t("status.awarded")], not_selected: ["muted", t("status.not_selected")],
        };
        let [kind, label] = map[inv.status] || ["muted", t("status.closed")];
        if (inv.status === "awarded" && inv.coi && !inv.coi.received_at) [kind, label] = ["warning", t("status.coi_needed")];
        if (!state.package.can_bid && (inv.status === "sent" || inv.status === "viewed")) [kind, label] = ["muted", t("status.no_response")];
        return `<span class="chip chip--${kind}">${esc(label)}</span>`;
    }

    function currentBidHtml(inv) {
        if (inv.status !== "bid_received" && inv.status !== "awarded" && !(inv.status === "not_selected" && inv.bid_amount != null)) return "";
        if (inv.bid_amount == null) return "";
        return `
            <div class="vp-current-bid">
                <span class="company-card-label">${esc(t("bid.current"))}</span>
                <div><strong>${esc(VP.fmtMoney(inv.bid_amount))}</strong></div>
                ${inv.responded_at ? `<div class="auth-inline-copy">${esc(t("bid.submittedOn", { when: VP.fmtDateTime(inv.responded_at) }))}</div>` : ""}
                ${inv.bid_source === "staff" ? `<div class="auth-inline-copy">${esc(t("bid.byStaff"))}</div>` : ""}
                ${inv.proposal ? `<div class="bid-file-row" style="margin-top:8px"><span class="bid-file-row-name">${esc(inv.proposal.file_name)}</span><button type="button" class="workbook-btn" style="flex:0 0 auto" data-view="${esc(inv.proposal.id)}">${esc(t("btn.view"))}</button></div>` : ""}
                ${inv.bid_notes ? `<p class="auth-inline-copy" style="margin-top:8px;white-space:pre-wrap">${esc(inv.bid_notes)}</p>` : ""}
            </div>`;
    }

    // Awarded: the COI PDF goes in the project's folder (My Projects).
    function coiHtml(inv) {
        if (inv.status !== "awarded" || !inv.coi) return "";
        const href = `project.html?id=${encodeURIComponent(state.project.id)}`;
        if (inv.coi.received_at) {
            return `<div class="vp-current-bid" style="margin-top:14px"><span class="company-card-label">${esc(t("project.coiTitle"))}</span>
                <p class="auth-inline-copy" style="margin:4px 0 0">${esc(t("coi.received", { date: VP.fmtDay(inv.coi.received_at) }))} <a class="auth-link" href="${href}">${esc(t("btn.openFolder"))} ›</a></p></div>`;
        }
        return `
            <div class="vp-doc-form" style="margin-top: 16px">
                <p class="company-form-section-title" style="margin:0 0 6px">${esc(t("coi.title"))}</p>
                <p class="auth-inline-copy" style="margin:0 0 12px">${esc(t("coi.folderBody"))}</p>
                <a href="${href}" class="auth-button" style="display:block;text-align:center;text-decoration:none;color:#fff">${esc(t("coi.goFolder"))}</a>
            </div>`;
    }

    function renderResponse(keep) {
        const { invite: inv, package: pkg } = state;
        $("statusChip").innerHTML = statusChip(inv);
        const flashHtml = flash ? `<p class="auth-message ${flash.type}" role="status" style="margin-top:12px">${esc(flash.text)}</p>` : "";

        if (!pkg.can_bid) {
            const msg = inv.status === "awarded" ? t("closed.awarded") : inv.status === "not_selected" ? t("closed.not_selected") : t("closed.past");
            $("responseBody").innerHTML = `${currentBidHtml(inv)}<p class="auth-inline-copy vp-closed-note">${esc(msg)}</p>${coiHtml(inv)}${flashHtml}`;
            return;
        }

        const isBid = choice === "bidding";
        const isNot = choice === "not_bidding";
        const hasBid = inv.status === "bid_received";
        const reasons = ["schedule_full", "outside_scope", "too_far", "other"];
        $("responseBody").innerHTML = `
            <div class="bid-choice-group" role="radiogroup" aria-label="${esc(t("choice.label"))}">
                <button type="button" role="radio" aria-checked="${isBid}" class="bid-choice-btn ${isBid ? "is-selected" : ""}" data-choice="bidding">${esc(t("choice.bidding"))}</button>
                <button type="button" role="radio" aria-checked="${isNot}" class="bid-choice-btn ${isNot ? "is-selected" : ""}" data-choice="not_bidding">${esc(t("choice.not"))}</button>
            </div>
            ${isBid ? `
            ${currentBidHtml(inv)}
            ${hasBid ? `<p class="auth-inline-copy" style="margin-top:10px">${esc(t("bid.updateHint"))}</p>` : ""}
            <form class="auth-form" id="bidForm" style="margin-top: 16px" novalidate>
                <label class="auth-field">${esc(t("bid.amount"))}
                    <span class="bid-money-input"><span>$</span><input type="text" name="amount" inputmode="decimal" placeholder="0.00" autocomplete="off"></span>
                </label>
                <label class="auth-field">${esc(t("bid.pdf"))}
                    <input type="file" name="file" accept="application/pdf,.pdf">
                </label>
                <label class="auth-field">${esc(t("bid.notes"))}
                    <textarea name="notes" rows="3" maxlength="2000"></textarea>
                </label>
                <button type="submit" class="auth-button" id="bidSubmitBtn">${esc(t(hasBid ? "bid.update" : "bid.submit"))}</button>
                <p class="auth-inline-copy">${esc(t("bid.until", { when: VP.fmtDateTime(pkg.due_at) }))}</p>
            </form>` : ""}
            ${isNot ? `
            ${inv.status === "not_bidding" && inv.decline_reason ? `<p class="auth-inline-copy" style="margin-top:12px">${esc(t("decline.current", { reason: t(`decline.${inv.decline_reason}`) }))}</p>` : ""}
            <form class="auth-form" id="declineForm" style="margin-top: 16px" novalidate>
                <label class="auth-field">${esc(t("decline.reason"))}
                    <select name="reason">${reasons.map(r => `<option value="${r}" ${inv.decline_reason === r ? "selected" : ""}>${esc(t(`decline.${r}`))}</option>`).join("")}</select>
                </label>
                <label class="auth-field">${esc(t("decline.note"))}
                    <textarea name="note" rows="3" maxlength="1000">${esc(inv.status === "not_bidding" ? inv.decline_note || "" : "")}</textarea>
                </label>
                ${hasBid ? `<p class="auth-message error">${esc(t("decline.withdraw"))}</p>` : ""}
                <button type="submit" class="auth-button auth-button--red" id="declineBtn">${esc(t("decline.send"))}</button>
                <p class="auth-inline-copy">${esc(t("decline.hint"))}</p>
            </form>` : ""}
            ${!isBid && !isNot ? `<p class="auth-inline-copy" style="margin-top:12px">${esc(t("bid.until", { when: VP.fmtDateTime(pkg.due_at) }))}</p>` : ""}
            <p class="auth-message hidden" id="responseMessage" role="alert"></p>
            ${flashHtml}`;

        // Put back anything typed before a language switch.
        if (keep) {
            const f = $("bidForm") || $("declineForm");
            if (f) Object.entries(keep).forEach(([k, v]) => { if (f.elements[k] && f.elements[k].type !== "file") f.elements[k].value = v; });
        }
        wireResponse();
    }

    function wireResponse() {
        $("responseBody").querySelectorAll(".bid-choice-btn").forEach(btn => btn.addEventListener("click", () => pick(btn.dataset.choice)));
        $("bidForm")?.addEventListener("submit", submitBid);
        $("declineForm")?.addEventListener("submit", sendDecline);
    }

    function message(text, type) { VP.setMessage($("responseMessage"), text, type); }

    async function pick(next) {
        if (busy || next === choice) return;
        flash = null;
        choice = next;
        renderResponse();
        // Saying "Bidding" lets Leeward see you plan to bid.
        if (next === "bidding" && ["sent", "viewed", "not_bidding"].includes(state.invite.status)) {
            const res = await VP.api("vendor-api", "respond", { id, choice: "bidding" });
            if (!res.ok) { message(VP.errText(res.error), "error"); return; }
            await load();
            flash = { text: t("bid.biddingSaved"), type: "success" };
            renderResponse();
            flash = null;
        }
    }

    async function submitBid(e) {
        e.preventDefault();
        if (busy) return;
        const form = e.target;
        const amountText = form.elements.amount.value.trim();
        const amount = Number(amountText.replace(/[$,\s]/g, ""));
        const file = form.elements.file.files[0];
        const missing = [];
        if (!(amount > 0)) missing.push("amount");
        if (!file) missing.push("file");
        if (missing.length) { VP.markFields(form, missing); message(VP.errText(missing[0] === "amount" ? "bad_amount" : "missing_file"), "error"); return; }
        if (!/\.pdf$/i.test(file.name)) { VP.markFields(form, ["file"]); message(VP.errText("pdf_only"), "error"); return; }
        VP.markFields(form, []);

        busy = true;
        const btn = $("bidSubmitBtn");
        btn.disabled = true;
        btn.textContent = t("bid.uploading");
        message("");
        try {
            const slot = await VP.api("vendor-api", "bid_upload_url", { id, file_name: file.name });
            if (!slot.ok) { message(VP.errText(slot.error), "error"); return; }
            if (!(await VP.uploadToSlot(slot, file))) { message(VP.errText("upload"), "error"); return; }
            btn.textContent = t("bid.sending");
            const res = await VP.api("vendor-api", "submit_bid", { id, amount, notes: form.elements.notes.value.trim(), path: slot.path, file_name: file.name });
            if (!res.ok) { VP.markFields(form, res.fields || []); message(VP.errText(res.error), "error"); return; }
            await load();
            flash = { text: t("bid.done"), type: "success" };
            renderResponse();
            flash = null;
            VP.refreshInviteBadge();
        } finally {
            busy = false;
            if (document.body.contains(btn)) { btn.disabled = false; btn.textContent = t(state.invite.status === "bid_received" ? "bid.update" : "bid.submit"); }
        }
    }

    async function sendDecline(e) {
        e.preventDefault();
        if (busy) return;
        const form = e.target;
        busy = true;
        const btn = $("declineBtn");
        btn.disabled = true;
        btn.textContent = t("decline.sending");
        message("");
        try {
            const res = await VP.api("vendor-api", "respond", { id, choice: "not_bidding", reason: form.elements.reason.value, note: form.elements.note.value.trim() });
            if (!res.ok) { message(VP.errText(res.error), "error"); return; }
            await load();
            flash = { text: t("decline.done"), type: "success" };
            renderResponse();
            flash = null;
            VP.refreshInviteBadge();
        } finally {
            busy = false;
            if (document.body.contains(btn)) { btn.disabled = false; btn.textContent = t("decline.send"); }
        }
    }

    /* ---------- files ---------- */
    // View opens in the portal's preview; Download saves it. Never a new tab.
    function openFile(fileId, download) {
        const f = (state.files || []).find(x => String(x.id) === String(fileId));
        const name = f ? f.name : state.invite.proposal && String(state.invite.proposal.id) === String(fileId) ? state.invite.proposal.file_name : "";
        const sign = async dl => {
            const res = await VP.api("vendor-api", "file_url", { invite_id: id, file_id: fileId, download: dl });
            if (!res.ok || !res.url) throw new Error(res.error || "generic");
            return res.url;
        };
        if (!download) { VP.preview({ name, getUrl: () => sign(false), getDownloadUrl: () => sign(true) }); return; }
        sign(true).then(url => VP.downloadUrl(url, name)).catch(err => message(VP.errText(err.message), "error"));
    }
    document.addEventListener("click", e => {
        const dl = e.target.closest("[data-file]");
        if (dl) { openFile(dl.dataset.file, true); return; }
        const view = e.target.closest("[data-view]");
        if (view) openFile(view.dataset.view, false);
    });

    /* ---------- go ---------- */
    if (!(await load())) return;
    renderInfo();
    renderResponse();
    $("inviteGrid").classList.remove("hidden");

    document.addEventListener("vp:lang", () => {
        const f = $("bidForm") || $("declineForm");
        const keep = {};
        if (f) Array.from(f.elements).forEach(el => { if (el.name && el.type !== "file") keep[el.name] = el.value; });
        renderInfo();
        renderResponse(keep);
    });
})();
