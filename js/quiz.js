/* quiz.js — 문제 풀이 화면 및 채점 로직 */
const Quiz = (() => {
  const CIRCLED = ["", "①", "②", "③", "④", "⑤"];

  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  // state: 현재 진행 중인 풀이 세션
  let S = null;
  let keyHandler = null;

  /* 풀이 시작. spec:
   * { mode, title, questions:[{round,n,answer,points,img}], gradeEach:bool, id, timed:bool, resume }
   */
  function start(spec) {
    S = {
      mode: spec.mode,
      title: spec.title,
      id: spec.id,
      questions: spec.questions,
      gradeEach: !!spec.gradeEach,
      timed: !!spec.timed,
      answers: spec.resume?.answers || new Array(spec.questions.length).fill(null),
      revealed: spec.resume?.revealed || new Array(spec.questions.length).fill(false),
      cur: spec.resume?.cur || 0,
      startedAt: spec.resume?.startedAt || Date.now(),
      finished: false,
    };
    window.scrollTo(0, 0);
    attachKeyboard();
    render();
  }

  // 숫자키(1~5) = 정답 선택(즉시채점 모드면 정답·해설 공개), 공개된 상태에서
  // 숫자키나 → 를 다시 누르면 다음 문항으로 이동. ← 는 이전 문항.
  function attachKeyboard() {
    detachKeyboard();
    keyHandler = (e) => {
      if (!S || S.finished) return;
      if (e.target.tagName === "TEXTAREA" || e.target.tagName === "INPUT") return;
      const i = S.cur;
      if (e.key >= "1" && e.key <= "5") {
        if (S.gradeEach && S.revealed[i]) go(1);
        else select(Number(e.key));
        e.preventDefault();
      } else if (e.key === "ArrowRight") {
        go(1);
        e.preventDefault();
      } else if (e.key === "ArrowLeft") {
        go(-1);
        e.preventDefault();
      }
    };
    document.addEventListener("keydown", keyHandler);
  }
  function detachKeyboard() {
    if (keyHandler) document.removeEventListener("keydown", keyHandler);
    keyHandler = null;
  }

  function persist() {
    if (!S || S.finished || !S.id) return;
    Store.saveProgress(S.id, {
      mode: S.mode, title: S.title, id: S.id,
      questions: S.questions, gradeEach: S.gradeEach, timed: S.timed,
      answers: S.answers, revealed: S.revealed, cur: S.cur, startedAt: S.startedAt,
    });
  }

  function select(choice) {
    if (S.finished) return;
    const i = S.cur;
    if (S.gradeEach && S.revealed[i]) return; // 즉시채점 모드는 공개 후 변경 불가
    S.answers[i] = choice;
    if (S.gradeEach) {
      S.revealed[i] = true;
      const q = S.questions[i];
      Store.recordAttempt(q.round, q.n, choice, q.answer, { points: q.points, img: q.img, explanation: q.explanation });
      App.refreshBadge();
    }
    persist();
    render();
  }

  function go(delta) {
    const next = S.cur + delta;
    if (next < 0 || next >= S.questions.length) return;
    S.cur = next;
    persist();
    render();
  }
  function jump(i) { S.cur = i; persist(); render(); }

  function answeredCount() { return S.answers.filter((a) => a !== null).length; }

  function finish() {
    S.finished = true;
    const elapsed = Math.round((Date.now() - S.startedAt) / 1000);
    let earned = 0, total = 0, correct = 0;
    const perQ = S.questions.map((q, i) => {
      const my = S.answers[i];
      const ok = my === q.answer;
      total += q.points;
      if (ok) { earned += q.points; correct += 1; }
      // 회차 전체 모드는 여기서 일괄 오답노트 반영 (즉시채점 모드는 이미 반영됨)
      if (!S.gradeEach && my !== null) {
        Store.recordAttempt(q.round, q.n, my, q.answer, { points: q.points, img: q.img, explanation: q.explanation });
      }
      return { round: q.round, n: q.n, my, answer: q.answer, ok, points: q.points, img: q.img, explanation: q.explanation };
    });
    const session = {
      at: Date.now(),
      mode: S.mode,
      title: S.title,
      count: S.questions.length,
      answered: answeredCount(),
      correct,
      earned,
      total,
      elapsed,
    };
    Store.addSession(session);
    if (S.id) Store.clearProgress(S.id);
    App.refreshBadge();
    renderResult(session, perQ);
  }

  /* ---------- 렌더링 ---------- */
  function render() {
    const i = S.cur;
    const q = S.questions[i];
    const total = S.questions.length;
    const revealed = S.revealed[i];
    const my = S.answers[i];

    const choices = [1, 2, 3, 4, 5].map((c) => {
      let cls = "choice-btn";
      if (S.gradeEach && revealed) {
        if (c === q.answer) cls += " correct";
        else if (c === my) cls += " wrong";
      } else if (c === my) cls += " selected";
      return `<button class="${cls}" ${revealed && S.gradeEach ? "disabled" : ""} data-choice="${c}">${CIRCLED[c]}</button>`;
    }).join("");

    let feedback = "";
    if (S.gradeEach && revealed) {
      const feedbackText = my === q.answer
        ? `정답입니다 (${CIRCLED[q.answer]})`
        : `오답 · 정답은 ${CIRCLED[q.answer]} · 오답노트에 담았습니다`;
      const explanationHtml = q.explanation
        ? `<div class="q-explanation"><div class="q-explanation-title">해설</div><p>${escapeHtml(q.explanation).replace(/\n/g, "<br>")}</p></div>`
        : "";
      feedback = `
        <div class="q-feedback-box ${my === q.answer ? "ok" : "bad"}">
          <p class="q-feedback">${feedbackText}</p>
          ${explanationHtml}
        </div>`;
    }

    const timerHtml = S.timed ? `<span class="qh-timer" id="quiz-timer">00:00</span>` : "";

    const jumpGrid = S.questions.map((qq, idx) => {
      let cls = "q-jump";
      if (idx === i) cls += " current";
      if (S.answers[idx] !== null) {
        if (S.gradeEach && S.revealed[idx]) {
          cls += S.answers[idx] === qq.answer ? " correct" : " wrong";
        } else cls += " answered";
      }
      return `<button class="${cls}" data-jump="${idx}">${qq.n}</button>`;
    }).join("");

    const lastQuestion = i === total - 1;
    const finishBtn = `<button class="btn primary" data-act="finish">채점하기 (${answeredCount()}/${total})</button>`;

    App.el.innerHTML = `
      <div class="quiz-head">
        <div class="qh-title">${S.title}</div>
        ${timerHtml}
      </div>
      <div class="q-progress"><span style="width:${((i + 1) / total) * 100}%"></span></div>
      <div class="quiz-wrap">
        <div class="quiz-main">
          <div class="q-meta">
            <strong>${q.n}번</strong>
            <span class="q-points">${q.points}점</span>
            <span>${i + 1} / ${total}</span>
          </div>
          <div class="q-image-box"><img src="${q.img}" alt="${q.round}회 ${q.n}번 문제" loading="lazy" /></div>
          <div class="choices-box">
            <p class="choices-label">답을 선택하세요 (숫자키 1~5로도 선택할 수 있어요)</p>
            <div class="choices">${choices}</div>
          </div>
          ${feedback}
          <div class="quiz-nav">
            <button class="btn" data-act="prev" ${i === 0 ? "disabled" : ""}>← 이전</button>
            ${lastQuestion ? finishBtn : `<button class="btn primary" data-act="next">다음 →</button>`}
          </div>
          <div style="margin-top:14px">${lastQuestion ? "" : finishBtn}</div>
        </div>
        <aside class="quiz-side card">
          <div class="side-title">문항 이동</div>
          <div class="q-jump-grid">${jumpGrid}</div>
        </aside>
      </div>
    `;

    App.el.querySelectorAll("[data-choice]").forEach((b) =>
      b.addEventListener("click", () => select(+b.dataset.choice)));
    App.el.querySelectorAll("[data-jump]").forEach((b) =>
      b.addEventListener("click", () => jump(+b.dataset.jump)));
    App.el.querySelector('[data-act="prev"]')?.addEventListener("click", () => go(-1));
    App.el.querySelector('[data-act="next"]')?.addEventListener("click", () => go(1));
    App.el.querySelectorAll('[data-act="finish"]').forEach((b) =>
      b.addEventListener("click", confirmFinish));

    startTimer();
  }

  function confirmFinish() {
    const unanswered = S.answers.filter((a) => a === null).length;
    if (unanswered > 0 && !confirm(`아직 ${unanswered}문항이 비어 있습니다. 채점할까요?`)) return;
    finish();
  }

  let timerHandle = null;
  function startTimer() {
    if (!S.timed) return;
    if (timerHandle) clearInterval(timerHandle);
    const tick = () => {
      const el = document.getElementById("quiz-timer");
      if (!el || S.finished) { clearInterval(timerHandle); return; }
      const s = Math.round((Date.now() - S.startedAt) / 1000);
      el.textContent = `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
    };
    tick();
    timerHandle = setInterval(tick, 1000);
  }

  function renderResult(session, perQ) {
    if (timerHandle) clearInterval(timerHandle);
    detachKeyboard();
    window.scrollTo(0, 0);
    const pct = session.total ? Math.round((session.earned / session.total) * 100) : 0;
    const mm = String(Math.floor(session.elapsed / 60)).padStart(2, "0");
    const ss = String(session.elapsed % 60).padStart(2, "0");
    const list = perQ.map((r) => {
      const cls = r.my === null ? "" : (r.ok ? "correct" : "wrong");
      return `<button class="q-jump ${cls}" data-res="${r.round}-${r.n}" title="${r.n}번 ${r.ok ? "정답" : "오답"}">${r.n}</button>`;
    }).join("");
    const wrongList = perQ.filter((r) => !r.ok);

    App.el.innerHTML = `
      <div class="card result-hero">
        <div class="result-score">${session.earned}<small> / ${session.total}점</small></div>
        <div class="result-sub">
          ${session.correct} / ${session.count}문항 정답 · 정답률 ${Math.round((session.correct / session.count) * 100)}%
          · 소요 ${mm}:${ss}
        </div>
      </div>
      <div class="section-h">문항별 결과</div>
      <div class="result-list">${list}</div>
      <div class="btn-row" style="margin-top:24px">
        ${wrongList.length ? `<button class="btn primary" data-act="review-wrong">틀린 ${wrongList.length}문항 다시 풀기</button>` : ""}
        <button class="btn" data-act="retry">이 세트 다시 풀기</button>
        <button class="btn ghost" data-act="home">홈으로</button>
      </div>
      <p class="inline-note" style="margin-top:14px">틀린 문항은 자동으로 <a href="#/notes">오답노트</a>에 담겼습니다.</p>
    `;

    App.el.querySelector('[data-act="home"]').addEventListener("click", () => App.navigate("/"));
    App.el.querySelector('[data-act="retry"]').addEventListener("click", () => {
      start({ mode: S.mode, title: S.title, questions: S.questions, gradeEach: S.gradeEach, timed: S.timed, id: S.id });
    });
    App.el.querySelector('[data-act="review-wrong"]')?.addEventListener("click", () => {
      const qs = wrongList.map((r) => ({ round: r.round, n: r.n, answer: r.answer, points: r.points, img: r.img, explanation: r.explanation }));
      start({ mode: "review", title: "틀린 문항 다시 풀기", questions: qs, gradeEach: true, timed: false, id: null });
    });
    App.el.querySelectorAll("[data-res]").forEach((b) =>
      b.addEventListener("click", () => {
        const [round, n] = b.dataset.res.split("-").map(Number);
        Notes.openSingle(round, n);
      }));
  }

  return { start, hasActive: () => S && !S.finished, detachKeyboard };
})();
