/* Terms of Use popup (2026-11-11) — a Windows-style agreement window.
   VP.termsDialog() → Promise<boolean>: true only when the vendor scrolled to
   the end, ticked "I Agree to the Terms of Use" and pressed Accept & Submit.
   VP.printTerms() prints the Terms (also used on terms.html).
   Text and version: js/terms.js (window.VP_TERMS). */
(function () {
    "use strict";
    const t = (k, v) => window.VP.t(k, v);
    const esc = s => window.VP.esc(s);

    function printTerms() {
        const T = window.VP_TERMS;
        const frame = document.createElement("iframe");
        frame.setAttribute("aria-hidden", "true");
        frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
        document.body.appendChild(frame);
        const doc = frame.contentWindow.document;
        doc.open();
        doc.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(T.TITLE)} – The Leeward Group</title>
            <style>
              body { font: 11pt/1.5 Georgia, "Times New Roman", serif; color: #000; margin: 0.75in; }
              h1 { font-size: 16pt; text-align: center; margin: 0 0 6pt; }
              h2 { font-size: 12pt; margin: 16pt 0 4pt; } h3 { font-size: 11pt; margin: 10pt 0 4pt; }
              p { margin: 0 0 6pt; } ul, ol { margin: 0 0 6pt 18pt; padding: 0; }
              .vp-terms-meta { text-align: center; margin: 0; } .vp-terms-contact { margin: 0; } .vp-terms-end { text-align: center; font-weight: bold; margin-top: 18pt; }
              .printed { font-size: 9pt; color: #555; margin-top: 24pt; border-top: 1px solid #999; padding-top: 6pt; }
            </style></head><body>${T.HTML}
            <p class="printed">Version ${esc(T.VERSION)} · Printed ${esc(new Date().toLocaleString())}</p></body></html>`);
        doc.close();
        const go = () => {
            frame.contentWindow.focus();
            frame.contentWindow.print();
            setTimeout(() => frame.remove(), 1000);
        };
        if (doc.readyState === "complete") setTimeout(go, 50); else frame.onload = go;
    }

    function termsDialog() {
        const T = window.VP_TERMS;
        return new Promise(resolve => {
            const overlay = document.createElement("div");
            overlay.className = "vp-eula-overlay";
            overlay.innerHTML = `
                <div class="vp-eula" role="dialog" aria-modal="true" aria-labelledby="eulaTitle" aria-describedby="eulaIntro">
                    <div class="vp-eula__titlebar">
                        <img src="assets/leeward-mark.png" alt="" width="20" height="18">
                        <span id="eulaTitle">${esc(t("terms.windowTitle"))}</span>
                        <button type="button" class="vp-eula__x" data-eula="decline" aria-label="${esc(t("terms.decline"))}">✕</button>
                    </div>
                    <div class="vp-eula__body">
                        <p class="vp-eula__intro" id="eulaIntro">${esc(t("terms.intro"))}</p>
                        ${window.VP.lang === "es" ? `<p class="vp-eula__lang">${esc(t("terms.englishNote"))}</p>` : ""}
                        <div class="vp-eula__doc vp-terms" tabindex="0" lang="en">${T.HTML}</div>
                        <div class="vp-eula__progress" aria-hidden="true"><span></span></div>
                        <p class="vp-eula__hint" id="eulaHint" aria-live="polite">${esc(t("terms.scrollMore"))}</p>
                        <label class="vp-eula__agree is-disabled">
                            <input type="checkbox" id="eulaAgree" disabled>
                            <span>${esc(t("terms.agree"))}</span>
                        </label>
                    </div>
                    <div class="vp-eula__buttons">
                        <button type="button" class="vp-eula__btn" data-eula="print">🖨 ${esc(t("terms.print"))}</button>
                        <span class="vp-eula__spacer"></span>
                        <button type="button" class="vp-eula__btn" data-eula="decline">${esc(t("terms.decline"))}</button>
                        <button type="button" class="vp-eula__btn vp-eula__btn--primary" data-eula="accept" disabled>${esc(t("terms.accept"))}</button>
                    </div>
                </div>`;
            document.body.appendChild(overlay);
            document.body.classList.add("popup-active");

            const docEl = overlay.querySelector(".vp-eula__doc");
            const bar = overlay.querySelector(".vp-eula__progress span");
            const agree = overlay.querySelector("#eulaAgree");
            const accept = overlay.querySelector('[data-eula="accept"]');
            let reached = false;

            function check() {
                const max = docEl.scrollHeight - docEl.clientHeight;
                const pct = max <= 0 ? 1 : Math.min(1, docEl.scrollTop / max);
                bar.style.width = `${Math.round(pct * 100)}%`;
                if (!reached && (max <= 0 || docEl.scrollTop >= max - 8)) {
                    reached = true;
                    agree.disabled = false;
                    agree.closest("label").classList.remove("is-disabled");
                    overlay.querySelector("#eulaHint").textContent = t("terms.reachedEnd");
                    overlay.querySelector("#eulaHint").classList.add("is-done");
                }
            }
            docEl.addEventListener("scroll", check, { passive: true });
            agree.addEventListener("change", () => { accept.disabled = !(reached && agree.checked); });

            function finish(ok) {
                document.removeEventListener("keydown", onKey);
                overlay.remove();
                if (!document.querySelector(".popup-overlay:not(.hidden), .vp-eula-overlay")) document.body.classList.remove("popup-active");
                resolve(ok);
            }
            function onKey(e) { if (e.key === "Escape") finish(false); }
            document.addEventListener("keydown", onKey);
            overlay.addEventListener("click", e => {
                const b = e.target.closest("[data-eula]");
                if (!b) return;
                if (b.dataset.eula === "print") printTerms();
                else if (b.dataset.eula === "decline") finish(false);
                else if (b.dataset.eula === "accept" && reached && agree.checked) finish(true);
            });
            requestAnimationFrame(() => { check(); docEl.focus(); });
        });
    }

    window.VP.termsDialog = termsDialog;
    window.VP.printTerms = printTerms;
})();
