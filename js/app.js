/* app.js — 라우팅, 홈, 백업, 데이터 로드 */
const App = (() => {
  const el = document.getElementById("app");
  let DATA = null; // exams.json
  let byRound = {};

  async function loadData() {
    if (DATA) return DATA;
    const res = await fetch("data/exams.json");
    DATA = await res.json();
    byRound = {};
    DATA.rounds.forEach((r) => { byRound[r.round] = r; });
    return DATA;
  }

  function refreshBadge() {
    const badge = document.getElementById("wrong-badge");
    const n = Store.activeWrong().length;
    badge.textContent = n;
    badge.classList.toggle("zero", n === 0);
  }

  function setActiveNav(name) {
    document.querySelectorAll(".main-nav a").forEach((a) =>
      a.classList.toggle("active", a.dataset.nav === name));
  }

  function navigate(path) { location.hash = "#" + path; }

  async function route() {
    const hash = location.hash.replace(/^#/, "") || "/";
    await loadData();
    refreshBadge();
    if (!hash.startsWith("/quiz/")) Quiz.detachKeyboard();

    if (hash === "/" || hash === "") { setActiveNav("home"); renderHome(); }
    else if (hash === "/notes") { setActiveNav("notes"); Notes.render(); }
    else if (hash === "/stats") { setActiveNav("stats"); Stats.render(); }
    else if (hash === "/backup") { setActiveNav("backup"); renderBackup(); }
    else if (hash.startsWith("/quiz/")) { setActiveNav("home"); startRoundFlow(hash); }
    else renderHome();
    window.scrollTo(0, 0);
  }

  /* ---------- 홈 ---------- */
  function bestScoreFor(round) {
    const sessions = Store.getSessions().filter((s) => s.title.includes(`${round}회`) && s.total === 100);
    if (!sessions.length) return null;
    return Math.max(...sessions.map((s) => s.earned));
  }

  function renderHome() {
    const progresses = Store.allProgress();
    const resumeCards = Object.values(progresses).map((p) => {
      const answered = p.answers.filter((a) => a !== null).length;
      return `
        <div class="card round-card" data-resume="${p.id}">
          <div class="rc-top"><span class="rc-round">이어풀기</span></div>
          <div class="rc-stat">${p.title}</div>
          <div class="progress-bar"><span style="width:${(answered / p.questions.length) * 100}%"></span></div>
          <div class="rc-stat">${answered} / ${p.questions.length}문항 진행</div>
        </div>`;
    }).join("");

    const cards = DATA.rounds.map((r) => {
      const best = bestScoreFor(r.round);
      const attempts = Store.getSessions().filter((s) => s.title.includes(`${r.round}회`)).length;
      return `
        <div class="card round-card" data-round="${r.round}">
          <div class="rc-top">
            <span class="rc-round">${r.round}회</span>
            <span class="rc-date">${r.date || ""}</span>
          </div>
          <div class="rc-stat">${r.questions.length}문항 · 심화</div>
          <div class="rc-stat">${best !== null ? `<span class="rc-best">최고 ${best}점</span> · ${attempts}회 응시` : (attempts ? `${attempts}회 응시` : "미응시")}</div>
        </div>`;
    }).join("");

    el.innerHTML = `
      <h1 class="page-title">한국사능력검정시험 심화 기출</h1>
      <p class="page-sub">회차를 골라 풀이 방식을 선택하세요. 총 ${DATA.rounds.length}개 회차 · ${DATA.rounds.length * 50}문항.</p>
      ${resumeCards ? `<div class="section-h">이어서 풀기</div><div class="grid" style="margin-bottom:26px">${resumeCards}</div>` : ""}
      <div class="section-h">회차 선택</div>
      <div class="grid">${cards}</div>
      <div class="section-h">전체 회차에서 랜덤 모의고사</div>
      <div class="btn-row">
        <button class="btn" data-random="10">10문항</button>
        <button class="btn" data-random="20">20문항</button>
        <button class="btn primary" data-random="50">50문항 (실전)</button>
      </div>
    `;

    el.querySelectorAll("[data-round]").forEach((c) =>
      c.addEventListener("click", () => renderModePicker(+c.dataset.round)));
    el.querySelectorAll("[data-resume]").forEach((c) =>
      c.addEventListener("click", () => resume(c.dataset.resume)));
    el.querySelectorAll("[data-random]").forEach((b) =>
      b.addEventListener("click", () => startRandom(+b.dataset.random)));
  }

  function renderModePicker(round) {
    window.scrollTo(0, 0);
    const r = byRound[round];
    el.innerHTML = `
      <a href="#/" class="inline-note">← 회차 목록</a>
      <h1 class="page-title" style="margin-top:8px">${round}회 · ${r.date || ""}</h1>
      <p class="page-sub">풀이 방식을 선택하세요.</p>
      <div class="mode-picker">
        <div class="card mode-card" data-mode="full">
          <h3>회차 전체 (시험형)</h3>
          <p>50문항을 모두 풀고 마지막에 한 번에 채점합니다. 타이머 있음.</p>
        </div>
        <div class="card mode-card" data-mode="each">
          <h3>문항별 즉시 채점</h3>
          <p>한 문항씩 답을 고르면 바로 정답을 확인합니다.</p>
        </div>
      </div>
    `;
    el.querySelectorAll("[data-mode]").forEach((c) =>
      c.addEventListener("click", () => startRound(round, c.dataset.mode)));
  }

  function questionsOf(round) {
    return byRound[round].questions.map((q) => ({ round, n: q.n, answer: q.answer, points: q.points, img: q.img, explanation: q.explanation }));
  }

  function startRound(round, mode) {
    const id = `round-${round}-${mode}`;
    const existing = Store.getProgress(id);
    if (existing && confirm("진행 중인 기록이 있습니다. 이어서 풀까요?")) {
      Quiz.start({ ...specFromProgress(existing), resume: existing });
      return;
    }
    Quiz.start({
      mode, id,
      title: `${round}회 ${mode === "full" ? "전체" : "즉시채점"}`,
      questions: questionsOf(round),
      gradeEach: mode === "each",
      timed: mode === "full",
    });
  }

  function specFromProgress(p) {
    return { mode: p.mode, id: p.id, title: p.title, questions: p.questions, gradeEach: p.gradeEach, timed: p.timed };
  }
  function resume(id) {
    const p = Store.getProgress(id);
    if (p) Quiz.start({ ...specFromProgress(p), resume: p });
  }

  function startRandom(count) {
    const pool = [];
    DATA.rounds.forEach((r) => r.questions.forEach((q) =>
      pool.push({ round: r.round, n: q.n, answer: q.answer, points: q.points, img: q.img, explanation: q.explanation })));
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const qs = pool.slice(0, count);
    Quiz.start({
      mode: "random", id: null,
      title: `랜덤 모의 ${count}문항`,
      questions: qs, gradeEach: false, timed: true,
    });
  }

  function startRoundFlow(hash) {
    const parts = hash.split("/"); // /quiz/{round}/{mode}
    const round = +parts[2], mode = parts[3] || "full";
    if (byRound[round]) startRound(round, mode); else renderHome();
  }

  /* ---------- 백업 ---------- */
  function renderBackup() {
    const data = Store.exportAll();
    el.innerHTML = `
      <h1 class="page-title">백업 · 복원</h1>
      <p class="page-sub">학습 기록은 이 브라우저에만 저장됩니다. JSON 파일로 내보내 다른 기기로 옮기거나 보관하세요.</p>
      <div class="card" style="padding:20px">
        <div class="stat-cards" style="margin-bottom:20px">
          <div class="card stat-box"><div class="sv">${data.sessions.length}</div><div class="sl">풀이 세션</div></div>
          <div class="card stat-box"><div class="sv">${data.wrong.length}</div><div class="sl">오답노트 항목</div></div>
          <div class="card stat-box"><div class="sv">${Object.keys(data.progress).length}</div><div class="sl">진행 중 세션</div></div>
        </div>
        <div class="btn-row">
          <button class="btn primary" data-act="export">JSON 내보내기</button>
          <label class="btn">JSON 가져오기<input type="file" accept="application/json" data-import hidden /></label>
          <button class="btn ghost" data-act="wipe">전체 기록 삭제</button>
        </div>
      </div>
    `;
    el.querySelector('[data-act="export"]').addEventListener("click", exportFile);
    el.querySelector("[data-import]").addEventListener("change", importFile);
    el.querySelector('[data-act="wipe"]').addEventListener("click", () => {
      if (confirm("모든 학습 기록(풀이·오답노트·진행상황)을 삭제합니다. 되돌릴 수 없습니다. 계속할까요?")) {
        Store.wipe(); refreshBadge(); renderBackup();
      }
    });
  }

  function exportFile() {
    const blob = new Blob([JSON.stringify(Store.exportAll(), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `한국사심화_학습기록_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function importFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (!confirm("현재 기록을 이 파일 내용으로 덮어씁니다. 계속할까요?")) return;
        Store.importAll(data);
        refreshBadge();
        alert("복원되었습니다.");
        renderBackup();
      } catch (err) {
        alert("가져오기 실패: " + err.message);
      }
    };
    reader.readAsText(file);
  }

  window.addEventListener("hashchange", route);
  window.addEventListener("DOMContentLoaded", route);
  if (document.readyState !== "loading") route();

  return { el, navigate, refreshBadge, get data() { return DATA; } };
})();
