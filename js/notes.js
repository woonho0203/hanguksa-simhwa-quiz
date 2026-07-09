/* notes.js — 오답노트 화면 */
const Notes = (() => {
  const CIRCLED = ["", "①", "②", "③", "④", "⑤"];

  function render() {
    const all = Store.getWrong();
    const active = all.filter((w) => !w.graduated);
    const graduated = all.filter((w) => w.graduated);

    if (all.length === 0) {
      App.el.innerHTML = `
        <h1 class="page-title">오답노트</h1>
        <div class="empty">아직 틀린 문항이 없습니다.<br>문제를 풀면 틀린 문항이 자동으로 여기에 모입니다.</div>`;
      return;
    }

    const controls = `
      <div class="btn-row" style="margin-bottom:18px">
        ${active.length ? `<button class="btn primary" data-act="review-all">전체 ${active.length}문항 다시 풀기</button>` : ""}
        <span class="inline-note" style="align-self:center">복습 중 ${active.length}개 · 졸업 ${graduated.length}개</span>
      </div>`;

    const items = active
      .sort((a, b) => b.wrongCount - a.wrongCount || b.lastSeen - a.lastSeen)
      .map(noteCard).join("");

    App.el.innerHTML = `
      <h1 class="page-title">오답노트</h1>
      <p class="page-sub">틀린 문항을 다시 보고 메모를 남기세요. 다시 풀어 맞히면 자동으로 졸업 처리됩니다.</p>
      ${controls}
      ${items || `<div class="empty">복습할 문항이 없습니다. 모두 졸업했어요! 🎉</div>`}
      ${graduated.length ? `<div class="section-h">졸업한 문항 (${graduated.length})</div>${graduated.map(gradCard).join("")}` : ""}
    `;
    bind();
  }

  function noteCard(w) {
    return `
      <div class="card note-item" data-key="${w.round}-${w.n}">
        <div class="note-head">
          <span class="note-tag">${w.round}회 ${w.n}번 <span class="wrong-count">· ${w.wrongCount}회 틀림</span></span>
          <span class="note-meta">${w.points}점</span>
        </div>
        ${w.img ? `<img src="${w.img}" alt="${w.round}회 ${w.n}번" loading="lazy" />` : ""}
        <div class="note-answer-row">
          <span>내가 고른 답: <span class="pill bad">${w.myAnswers.map((a) => CIRCLED[a]).join(" ")}</span></span>
          <span>정답: <span class="pill ok">${CIRCLED[w.answer]}</span></span>
        </div>
        <textarea class="note-memo" placeholder="메모: 왜 틀렸는지, 기억할 개념 등을 적어두세요" data-memo>${w.memo || ""}</textarea>
        <div class="btn-row" style="margin-top:10px">
          <button class="btn primary" data-act="retry-one">다시 풀기</button>
          <button class="btn ghost" data-act="remove">노트에서 삭제</button>
        </div>
      </div>`;
  }

  function gradCard(w) {
    return `
      <div class="card note-item" data-key="${w.round}-${w.n}" style="opacity:.7">
        <div class="note-head">
          <span class="note-tag">${w.round}회 ${w.n}번 <span class="pill ok">졸업</span></span>
          <button class="btn ghost" data-act="reopen">다시 복습</button>
        </div>
      </div>`;
  }

  function bind() {
    App.el.querySelector('[data-act="review-all"]')?.addEventListener("click", () => {
      const qs = Store.activeWrong().map((w) => ({ round: w.round, n: w.n, answer: w.answer, points: w.points, img: w.img }));
      Quiz.start({ mode: "review", title: "오답 전체 복습", questions: qs, gradeEach: true, timed: false, id: null });
    });

    App.el.querySelectorAll(".note-item").forEach((card) => {
      const [round, n] = card.dataset.key.split("-").map(Number);
      card.querySelector("[data-memo]")?.addEventListener("input", (e) => {
        Store.setMemo(round, n, e.target.value);
      });
      card.querySelector('[data-act="retry-one"]')?.addEventListener("click", () => {
        const w = Store.findWrong(round, n);
        Quiz.start({
          mode: "review", title: `${round}회 ${n}번 다시 풀기`,
          questions: [{ round, n, answer: w.answer, points: w.points, img: w.img }],
          gradeEach: true, timed: false, id: null,
        });
      });
      card.querySelector('[data-act="remove"]')?.addEventListener("click", () => {
        if (confirm(`${round}회 ${n}번을 오답노트에서 삭제할까요?`)) { Store.deleteWrong(round, n); App.refreshBadge(); render(); }
      });
      card.querySelector('[data-act="reopen"]')?.addEventListener("click", () => {
        const list = Store.getWrong();
        const w = list.find((x) => x.round === round && x.n === n);
        if (w) { w.graduated = false; localStorage.setItem("hk_wrong", JSON.stringify(list)); App.refreshBadge(); render(); }
      });
    });
  }

  // 결과 화면에서 특정 문항 노트로 점프 (틀린 것만 노트에 존재)
  function openSingle(round, n) {
    App.navigate("/notes");
    setTimeout(() => {
      const card = App.el.querySelector(`.note-item[data-key="${round}-${n}"]`);
      if (card) card.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 50);
  }

  return { render, openSingle };
})();
