/* stats.js — 학습 통계 및 세션 로그 */
const Stats = (() => {
  const MODE_LABEL = { full: "회차 전체", each: "즉시채점", random: "랜덤 모의", review: "오답 복습" };

  function render() {
    const sessions = Store.getSessions();
    if (sessions.length === 0) {
      App.el.innerHTML = `
        <h1 class="page-title">학습 통계</h1>
        <div class="empty">아직 완료한 풀이가 없습니다.<br>문제를 풀면 점수 추이와 기록이 여기에 쌓입니다.</div>`;
      return;
    }

    const totalAnswered = sessions.reduce((s, x) => s + x.answered, 0);
    const totalCorrect = sessions.reduce((s, x) => s + x.correct, 0);
    const totalTime = sessions.reduce((s, x) => s + x.elapsed, 0);
    const accuracy = totalAnswered ? Math.round((totalCorrect / totalAnswered) * 100) : 0;
    const graded = sessions.filter((s) => s.total > 0);
    const avgScore = graded.length
      ? Math.round(graded.reduce((s, x) => s + (x.earned / x.total) * 100, 0) / graded.length)
      : 0;
    const hrs = Math.floor(totalTime / 3600);
    const mins = Math.round((totalTime % 3600) / 60);

    App.el.innerHTML = `
      <h1 class="page-title">학습 통계</h1>
      <p class="page-sub">지금까지 완료한 ${sessions.length}회의 풀이 기록입니다.</p>
      <div class="stat-cards">
        <div class="card stat-box"><div class="sv">${sessions.length}</div><div class="sl">완료한 풀이</div></div>
        <div class="card stat-box"><div class="sv">${accuracy}<small>%</small></div><div class="sl">전체 정답률</div></div>
        <div class="card stat-box"><div class="sv">${avgScore}<small>점</small></div><div class="sl">평균 점수(100점 환산)</div></div>
        <div class="card stat-box"><div class="sv">${hrs ? hrs + "시간 " : ""}${mins}분</div><div class="sl">총 학습 시간</div></div>
      </div>
      <div class="card chart-box">
        <div class="side-title" style="padding:0 0 10px">점수 추이 (최근 ${Math.min(sessions.length, 20)}회, 100점 환산)</div>
        <canvas id="score-chart" width="900" height="240"></canvas>
      </div>
      <div class="section-h">풀이 기록</div>
      <div class="card">
        ${sessions.slice().reverse().map(sessionRow).join("")}
      </div>
    `;
    drawChart(graded);
  }

  function sessionRow(s) {
    const d = new Date(s.at);
    const date = `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    const scoreTxt = s.total > 0 ? `${s.earned}/${s.total}점` : `${s.correct}/${s.count}`;
    const mm = String(Math.floor(s.elapsed / 60)).padStart(2, "0");
    const ss = String(s.elapsed % 60).padStart(2, "0");
    return `
      <div class="session-row">
        <span><strong>${s.title}</strong> <span class="inline-note">· ${MODE_LABEL[s.mode] || s.mode}</span></span>
        <span class="note-meta">${scoreTxt} · ${s.correct}/${s.count}정답 · ${mm}:${ss} · ${date}</span>
      </div>`;
  }

  function drawChart(graded) {
    const canvas = document.getElementById("score-chart");
    if (!canvas || graded.length === 0) return;
    const ctx = canvas.getContext("2d");
    const W = canvas.width, H = canvas.height;
    const pad = { l: 34, r: 12, t: 14, b: 26 };
    const data = graded.slice(-20).map((s) => Math.round((s.earned / s.total) * 100));
    ctx.clearRect(0, 0, W, H);

    const plotW = W - pad.l - pad.r, plotH = H - pad.t - pad.b;
    // grid + y labels (0,50,100)
    ctx.strokeStyle = "#e3e6ea"; ctx.fillStyle = "#6b7684"; ctx.font = "12px sans-serif"; ctx.textAlign = "right";
    [0, 50, 100].forEach((v) => {
      const y = pad.t + plotH * (1 - v / 100);
      ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(W - pad.r, y); ctx.stroke();
      ctx.fillText(String(v), pad.l - 6, y + 4);
    });

    const x = (i) => data.length === 1 ? pad.l + plotW / 2 : pad.l + (plotW * i) / (data.length - 1);
    const y = (v) => pad.t + plotH * (1 - v / 100);

    // line
    ctx.strokeStyle = "#2f6bd8"; ctx.lineWidth = 2; ctx.beginPath();
    data.forEach((v, i) => { const px = x(i), py = y(v); i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); });
    ctx.stroke();
    // points
    ctx.fillStyle = "#2f6bd8";
    data.forEach((v, i) => { ctx.beginPath(); ctx.arc(x(i), y(v), 3.5, 0, Math.PI * 2); ctx.fill(); });
  }

  return { render };
})();
