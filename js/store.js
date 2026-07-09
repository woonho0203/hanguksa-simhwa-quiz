/* store.js — localStorage 단일 접근 계층
 * 모든 학습 기록은 여기를 통해서만 읽고 쓴다.
 */
const Store = (() => {
  const KEYS = {
    sessions: "hk_sessions",   // 완료된 풀이 세션 로그
    wrong: "hk_wrong",         // 오답노트 항목
    progress: "hk_progress",   // 진행 중(이어풀기) 세션
    meta: "hk_meta",           // 스키마 버전 등
  };
  const SCHEMA = 1;

  function read(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      console.warn("store read fail", key, e);
      return fallback;
    }
  }
  function write(key, val) {
    localStorage.setItem(key, JSON.stringify(val));
  }

  // --- 세션 로그 ---
  function getSessions() { return read(KEYS.sessions, []); }
  function addSession(session) {
    const list = getSessions();
    list.push(session);
    write(KEYS.sessions, list);
  }

  // --- 오답노트 ---
  function getWrong() { return read(KEYS.wrong, []); }
  function wrongKey(round, n) { return `${round}-${n}`; }
  function findWrong(round, n) {
    return getWrong().find((w) => w.round === round && w.n === n);
  }
  // 채점 결과로 오답노트 갱신: 틀리면 등록/카운트+, 맞히면 졸업 처리
  function recordAttempt(round, n, myAnswer, correctAnswer, meta) {
    const list = getWrong();
    const idx = list.findIndex((w) => w.round === round && w.n === n);
    const correct = myAnswer === correctAnswer;
    if (idx === -1) {
      if (!correct) {
        list.push({
          round, n,
          answer: correctAnswer,
          points: meta?.points || 0,
          img: meta?.img || "",
          myAnswers: [myAnswer],
          wrongCount: 1,
          memo: "",
          graduated: false,
          firstSeen: Date.now(),
          lastSeen: Date.now(),
        });
      }
    } else {
      const w = list[idx];
      w.myAnswers.push(myAnswer);
      w.lastSeen = Date.now();
      if (correct) {
        w.graduated = true;
      } else {
        w.wrongCount += 1;
        w.graduated = false;
      }
    }
    write(KEYS.wrong, list);
  }
  function setMemo(round, n, memo) {
    const list = getWrong();
    const w = list.find((x) => x.round === round && x.n === n);
    if (w) { w.memo = memo; write(KEYS.wrong, list); }
  }
  function deleteWrong(round, n) {
    write(KEYS.wrong, getWrong().filter((w) => !(w.round === round && w.n === n)));
  }
  function activeWrong() {
    return getWrong().filter((w) => !w.graduated);
  }

  // --- 진행 중 세션(이어풀기) ---
  function getProgress(id) {
    const all = read(KEYS.progress, {});
    return all[id];
  }
  function saveProgress(id, data) {
    const all = read(KEYS.progress, {});
    all[id] = data;
    write(KEYS.progress, all);
  }
  function clearProgress(id) {
    const all = read(KEYS.progress, {});
    delete all[id];
    write(KEYS.progress, all);
  }
  function allProgress() { return read(KEYS.progress, {}); }

  // --- 백업 ---
  function exportAll() {
    return {
      schema: SCHEMA,
      exportedAt: new Date().toISOString(),
      sessions: getSessions(),
      wrong: getWrong(),
      progress: read(KEYS.progress, {}),
    };
  }
  function importAll(data) {
    if (!data || typeof data !== "object") throw new Error("잘못된 백업 파일");
    if (Array.isArray(data.sessions)) write(KEYS.sessions, data.sessions);
    if (Array.isArray(data.wrong)) write(KEYS.wrong, data.wrong);
    if (data.progress && typeof data.progress === "object") write(KEYS.progress, data.progress);
  }
  function wipe() {
    Object.values(KEYS).forEach((k) => localStorage.removeItem(k));
  }

  // 스키마 초기화
  (function init() {
    const meta = read(KEYS.meta, null);
    if (!meta) write(KEYS.meta, { schema: SCHEMA });
  })();

  return {
    getSessions, addSession,
    getWrong, findWrong, recordAttempt, setMemo, deleteWrong, activeWrong,
    getProgress, saveProgress, clearProgress, allProgress,
    exportAll, importAll, wipe,
  };
})();
