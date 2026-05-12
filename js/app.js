/* 뮤엠 그래머 — 메인 앱 로직 (SPA + 라우터 + 퀴즈 엔진 + 진도/오답 영구 저장) */

// ===== 단원 메타데이터 =====
const UNITS = {
  relative: {
    title: '관계대명사',
    lesson: '3단원',
    tagline: '두 문장을 잇는 연결 마법 (거시기 마법)',
    storyTotal: 7,
    magicCard: [
      '두 문장에 같은 단어 → 거시기로 묶기',
      '사람 = who / 사물 = which / 둘 다 = that',
      '거시기 앞에 있는 단어 = 선행사',
      '주격은 못 빼 / 목적격은 빼도 OK'
    ]
  },
  passive: {
    title: '수동태',
    lesson: '4단원',
    tagline: '주인공이 바뀌는 변신 마법',
    storyTotal: 7,
    magicCard: [
      '누구를 주인공으로? = 수동태 결정',
      '공식: be + p.p.',
      '시제는 be에서 표시',
      '행위자 = by + 사람 (안 중요하면 생략)',
      '타동사만 가능',
      '감정 = in/at/with, 재료 = of/from'
    ]
  }
};

// ===== 콘텐츠 로더 (캐시) =====
const _cache = {};
async function loadContent(unit, section) {
  const data = window.CONTENT && window.CONTENT[`${unit}-${section}`];
  if (!data) throw new Error(`콘텐츠 없음: ${unit}-${section}`);
  return data;
}

function splitChapters(md) {
  const parts = md.split(/(?=^## Ch\d+\.)/m);
  const chapters = [];
  for (const part of parts) {
    const m = part.match(/^## (Ch\d+)\.\s*(.+?)$/m);
    if (m) {
      chapters.push({
        num: parseInt(m[1].replace('Ch', '')),
        title: m[2].trim(),
        body: part.trim()
      });
    }
  }
  return chapters.sort((a, b) => a.num - b.num);
}

// ===== Storage 레이어 (localStorage 영구) =====
const STORAGE_KEY = 'muem-grammar-v1';
const Storage = {
  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return (parsed && typeof parsed === 'object') ? parsed : null;
    } catch (e) { return null; }
  },
  save(state) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
    catch (e) { /* quota 등 무시 */ }
  },
  reset() {
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
  }
};

// ===== 진도 데이터 (localStorage 영구) =====
let _progress = Storage.load() || {};
function _saveProgress() { Storage.save(_progress); }

// 결과화면용 일회성 플래그 (신기록 표시)
let _lastResultNewRecord = false;

function markChapterRead(unit, n) {
  if (!_progress[unit]) _progress[unit] = {};
  if (!Array.isArray(_progress[unit].story)) _progress[unit].story = [];
  if (!_progress[unit].story.includes(n)) _progress[unit].story.push(n);
  _saveProgress();
}
function isChapterRead(unit, n) {
  const story = _progress[unit]?.story;
  return Array.isArray(story) && story.includes(n);
}
function saveQuizScore(unit, section, correct, total) {
  if (!_progress[unit]) _progress[unit] = {};
  const prev = _progress[unit][section];
  // 신기록 여부 (이전 기록 없거나, 이전보다 정답 많을 때)
  _lastResultNewRecord = !prev || correct > prev.correct;
  if (_lastResultNewRecord) {
    _progress[unit][section] = { correct, total };
  }
  _saveProgress();
}
function getQuizScore(unit, section) {
  return _progress[unit]?.[section] || null;
}
function computeUnitProgress(unit) {
  const u = UNITS[unit];
  let pct = 0;
  const storyDone = _progress[unit]?.story?.length || 0;
  pct += (storyDone / u.storyTotal) * 33;
  if (_progress[unit]?.quiz) pct += 33;
  if (_progress[unit]?.apply) pct += 34;
  return Math.round(Math.min(100, pct));
}

// ===== 오답 노트 =====
function recordWrongAnswer(unit, section, q, userAnswer) {
  if (!_progress[unit]) _progress[unit] = {};
  if (!Array.isArray(_progress[unit].wrong)) _progress[unit].wrong = [];
  const entry = {
    section,
    qid: q.id,
    prompt: q.prompt,
    choices: q.choices || null,
    answer: q.answer,
    alternatives: q.alternatives || null,
    explanation: q.explanation,
    type: q.type,
    level: q.level || 'medium',
    userAnswer,
    ts: Date.now()
  };
  const idx = _progress[unit].wrong.findIndex(w => w.qid === q.id && w.section === section);
  if (idx >= 0) _progress[unit].wrong[idx] = entry;
  else _progress[unit].wrong.push(entry);
  _saveProgress();
}
function clearWrongAnswer(unit, qid, section) {
  if (!_progress[unit]?.wrong) return;
  _progress[unit].wrong = _progress[unit].wrong.filter(w => !(w.qid === qid && w.section === section));
  _saveProgress();
}
function getWrongList(unit) {
  return _progress[unit]?.wrong || [];
}
function getTotalWrong() {
  return ['relative', 'passive'].reduce((sum, u) => sum + getWrongList(u).length, 0);
}

// ===== 이어서 풀기 (lastVisit) =====
function setLastVisit(visit) {
  _progress.lastVisit = visit;
  _saveProgress();
}
function getLastVisit() {
  return _progress.lastVisit || null;
}
function clearLastVisit() {
  delete _progress.lastVisit;
  _saveProgress();
}
function resumeUrl(lv) {
  if (!lv || !UNITS[lv.unit]) return null;
  if (lv.section === 'story') return `/unit/${lv.unit}/story/${lv.ch || 1}`;
  if (lv.section === 'quiz' || lv.section === 'apply') return `/unit/${lv.unit}/${lv.section}`;
  if (lv.section === 'review') return `/unit/${lv.unit}/review`;
  return `/unit/${lv.unit}`;
}

// ===== 라우터 =====
function navigate(path) { window.location.hash = path; }

const routes = [
  { p: /^\/?$/, fn: () => renderHome() },
  { p: /^\/unit\/([^\/]+)$/, fn: (m) => renderUnit({ unit: m[1] }) },
  { p: /^\/unit\/([^\/]+)\/story$/, fn: (m) => renderStoryList({ unit: m[1] }) },
  { p: /^\/unit\/([^\/]+)\/story\/(\d+)$/, fn: (m) => renderStoryChapter({ unit: m[1], ch: parseInt(m[2]) }) },
  { p: /^\/unit\/([^\/]+)\/quiz$/, fn: (m) => renderQuiz({ unit: m[1], section: 'quiz' }) },
  { p: /^\/unit\/([^\/]+)\/apply$/, fn: (m) => renderQuiz({ unit: m[1], section: 'apply' }) },
  { p: /^\/unit\/([^\/]+)\/review$/, fn: (m) => renderReview({ unit: m[1] }) },
  { p: /^\/unit\/([^\/]+)\/result\/([^\/]+)$/, fn: (m) => renderResult({ unit: m[1], section: m[2] }) }
];

function router() {
  const path = (window.location.hash || '#/').slice(1);
  const backBtn = document.getElementById('backBtn');
  backBtn.style.display = path === '/' || path === '' ? 'none' : 'flex';
  backBtn.onclick = () => history.length > 1 ? history.back() : navigate('/');
  for (const r of routes) {
    const m = path.match(r.p);
    if (m) { r.fn(m); window.scrollTo(0, 0); return; }
  }
  renderHome();
}
window.addEventListener('hashchange', router);
window.addEventListener('load', router);

// ===== 헬퍼 =====
function $app() { return document.getElementById('app'); }
function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function charImg(name, alt) {
  return `<img class="hero-char" src="assets/character/${name}.png" alt="${esc(alt)}"
    onerror="this.outerHTML='<div class=&quot;char-placeholder&quot;>그램 일러스트<small>(폴더 동기화 대기)</small></div>'">`;
}

// ===== 화면: 홈 =====
function renderHome() {
  const lv = getLastVisit();
  const totalWrong = getTotalWrong();
  let resumeCard = '';
  if (lv && UNITS[lv.unit]) {
    const u = UNITS[lv.unit];
    const sectionLabel = { story: '이야기', quiz: '퀴즈', apply: '응용', review: '오답 복습' }[lv.section] || lv.section;
    const detail = lv.section === 'story' ? `${lv.ch || 1}챕터부터` : `${(lv.idx || 0) + 1}번째 문제부터`;
    const url = resumeUrl(lv);
    resumeCard = `
      <a class="resume-card" href="#${url}">
        <div class="resume-card__chip">이어서 풀기</div>
        <div class="resume-card__info">
          <h3>${esc(u.title)} · ${sectionLabel}</h3>
          <p>${esc(detail)}</p>
        </div>
        <span class="resume-card__arrow">→</span>
      </a>`;
  }
  let reviewBanner = '';
  if (totalWrong > 0) {
    reviewBanner = `
      <div class="review-banner">
        <span class="review-banner__icon">📒</span>
        <div class="review-banner__text">
          <strong>오답 ${totalWrong}문제 모았어!</strong>
          <span>각 단원에서 다시 풀어보자</span>
        </div>
      </div>`;
  }
  $app().innerHTML = `
    <section class="hero">
      ${charImg('mascot-hero', '그램 — 어린 마법사')}
      <h1 class="hero-title">안녕! 나는 <span class="accent">그램</span>이야</h1>
      <p class="hero-sub">문법은 외우는 게 아니야.<br>마법처럼 이해하는 거야.</p>
    </section>
    ${resumeCard}
    ${reviewBanner}
    <section class="unit-list">
      <h2 class="section-title">오늘 어떤 마법을 배울까?</h2>
      ${unitCard('relative')}
      ${unitCard('passive')}
      <div class="unit-card unit-card--locked">
        <div class="unit-card__chip">곧 추가</div>
        <h3 class="unit-card__title">to부정사 · 동명사 외</h3>
        <p class="unit-card__sub">관계대명사·수동태 완성 후 공개</p>
      </div>
    </section>
    <footer class="app-foot"><p>뮤엠영어 학원</p></footer>
  `;
}
function unitCard(id) {
  const u = UNITS[id];
  const pct = computeUnitProgress(id);
  return `
    <a class="unit-card" href="#/unit/${id}">
      <div class="unit-card__chip">중2 · ${u.lesson}</div>
      <h3 class="unit-card__title">${u.title}</h3>
      <p class="unit-card__sub">${u.tagline}</p>
      <div class="unit-card__progress">
        <span class="progress-bar"><span style="width:${pct}%"></span></span>
        <span class="progress-text">${pct}%</span>
      </div>
    </a>`;
}

// ===== 화면: 단원 상세 =====
function renderUnit({ unit }) {
  const u = UNITS[unit];
  if (!u) { renderHome(); return; }
  const storyDone = _progress[unit]?.story?.length || 0;
  const q = getQuizScore(unit, 'quiz');
  const a = getQuizScore(unit, 'apply');
  const wrongCount = getWrongList(unit).length;
  const reviewCard = wrongCount > 0 ? `
      <a class="section-card section-card--review" href="#/unit/${unit}/review">
        <div class="section-icon">📒</div>
        <div class="section-info">
          <h3>오답 복습</h3>
          <p>${wrongCount}문제 다시 풀기</p>
        </div>
        <span class="section-arrow">→</span>
      </a>` : '';
  $app().innerHTML = `
    <header class="unit-hero">
      <div class="unit-chip">중2 · ${u.lesson}</div>
      <h1>${u.title}</h1>
      <p class="unit-tagline">${u.tagline}</p>
    </header>
    <section class="sections-list">
      <a class="section-card" href="#/unit/${unit}/story">
        <div class="section-icon">📖</div>
        <div class="section-info">
          <h3>이야기로 이해하기</h3>
          <p>${storyDone}/${u.storyTotal} 챕터 완료</p>
        </div>
        <span class="section-arrow">→</span>
      </a>
      <a class="section-card" href="#/unit/${unit}/quiz">
        <div class="section-icon">⚡</div>
        <div class="section-info">
          <h3>퀴즈로 익히기</h3>
          <p>${q ? `최고기록 ${q.correct}/${q.total} 정답` : '아직 안 풀었어요'}</p>
        </div>
        <span class="section-arrow">→</span>
      </a>
      <a class="section-card" href="#/unit/${unit}/apply">
        <div class="section-icon">🪄</div>
        <div class="section-info">
          <h3>응용으로 마스터하기</h3>
          <p>${a ? `최고기록 ${a.correct}/${a.total} 정답` : '아직 안 풀었어요'}</p>
        </div>
        <span class="section-arrow">→</span>
      </a>
      ${reviewCard}
    </section>`;
}

// ===== 화면: 챕터 목록 =====
async function renderStoryList({ unit }) {
  $app().innerHTML = '<div class="loading">불러오는 중...</div>';
  try {
    const md = await loadContent(unit, 'story');
    const chapters = splitChapters(md);
    $app().innerHTML = `
      <header class="unit-hero">
        <div class="unit-chip">${UNITS[unit].title} — 이야기</div>
        <h1>챕터를 골라봐</h1>
      </header>
      <section class="chapter-list">
        ${chapters.map(c => `
          <a class="chapter-item" href="#/unit/${unit}/story/${c.num}">
            <span class="chapter-num ${isChapterRead(unit, c.num) ? 'done' : ''}">${c.num}</span>
            <span class="chapter-title">${esc(c.title)}</span>
            <span class="section-arrow">→</span>
          </a>`).join('')}
      </section>`;
  } catch (e) {
    $app().innerHTML = `<p class="loading">로딩 실패: ${e.message}</p>`;
  }
}

// ===== 화면: 챕터 본문 =====
async function renderStoryChapter({ unit, ch }) {
  $app().innerHTML = '<div class="loading">불러오는 중...</div>';
  try {
    const md = await loadContent(unit, 'story');
    const chapters = splitChapters(md);
    const chapter = chapters.find(c => c.num === ch);
    if (!chapter) { renderHome(); return; }
    markChapterRead(unit, ch);
    setLastVisit({ unit, section: 'story', ch });
    const body = chapter.body.replace(/^## Ch\d+\..+$/m, '');
    const html = parseMd(body);
    const prev = chapters.find(c => c.num === ch - 1);
    const next = chapters.find(c => c.num === ch + 1);
    $app().innerHTML = `
      <article class="chapter-view">
        <h2>${esc(chapter.title)}</h2>
        ${html}
      </article>
      <nav class="chapter-nav">
        <button class="prev" ${prev ? '' : 'disabled'} onclick="${prev ? `navigate('/unit/${unit}/story/${prev.num}')` : 'return false'}">← 이전</button>
        <button class="next" onclick="navigate('${next ? `/unit/${unit}/story/${next.num}` : `/unit/${unit}/quiz`}')">${next ? '다음 →' : '퀴즈 시작 →'}</button>
      </nav>`;
  } catch (e) {
    $app().innerHTML = `<p class="loading">로딩 실패: ${e.message}</p>`;
  }
}

// ===== 화면: 퀴즈/응용 =====
let _qs = null;
async function renderQuiz({ unit, section }) {
  $app().innerHTML = '<div class="loading">불러오는 중...</div>';
  try {
    const data = await loadContent(unit, section);
    _qs = {
      unit, section,
      mode: 'normal',
      questions: data.questions,
      idx: 0, correct: 0,
      answered: false, userAnswer: null
    };
    showQuestion();
  } catch (e) {
    $app().innerHTML = `<p class="loading">로딩 실패: ${e.message}</p>`;
  }
}

// ===== 화면: 오답 복습 =====
function renderReview({ unit }) {
  const u = UNITS[unit];
  if (!u) { renderHome(); return; }
  const wrong = getWrongList(unit);
  if (wrong.length === 0) {
    $app().innerHTML = `
      <div class="result-view">
        <div class="result-emoji">🎉</div>
        <div class="result-title">오답이 없어!</div>
        <p class="result-message">${esc(u.title)} 전부 마스터한 거야. 다른 단원도 도전해볼까?</p>
        <div class="result-actions">
          <button class="btn-primary" onclick="navigate('/unit/${unit}')">${esc(u.title)}으로 돌아가기</button>
          <button class="btn-secondary" onclick="navigate('/')">홈으로</button>
        </div>
      </div>`;
    return;
  }
  // 오답 항목을 퀴즈 형식의 questions 배열로 변환
  const questions = wrong.map(w => ({
    id: w.qid,
    type: w.type,
    level: w.level,
    prompt: w.prompt,
    choices: w.choices || undefined,
    answer: w.answer,
    alternatives: w.alternatives || undefined,
    explanation: w.explanation,
    _reviewSection: w.section
  }));
  _qs = {
    unit, section: 'review',
    mode: 'review',
    questions,
    idx: 0, correct: 0,
    answered: false, userAnswer: null
  };
  showQuestion();
}

function showQuestion() {
  const s = _qs;
  const q = s.questions[s.idx];
  if (!q) {
    if (s.mode === 'review') {
      // 복습 모드 결과: 별도 라우트 없이 인라인 결과
      const total = s.questions.length;
      const mastered = s.correct;
      const remaining = getWrongList(s.unit).length;
      $app().innerHTML = `
        <div class="result-view">
          <div class="result-emoji">${mastered === total ? '🏆' : mastered > 0 ? '✨' : '🌱'}</div>
          <div class="result-title">${mastered === total ? '오답 다 마스터!' : '복습 완료'}</div>
          <div class="result-score">${mastered} <small>/ ${total} 마스터</small></div>
          <p class="result-message">${remaining === 0 ? '오답 노트가 비었어. 멋지다!' : `아직 ${remaining}문제가 남았어. 계속 도전!`}</p>
          <div class="result-actions">
            ${remaining > 0 ? `<button class="btn-primary" onclick="navigate('/unit/${s.unit}/review')">남은 오답 더 풀기 →</button>` : ''}
            <button class="btn-secondary" onclick="navigate('/unit/${s.unit}')">단원으로</button>
            <button class="btn-secondary" onclick="navigate('/')">홈으로</button>
          </div>
        </div>`;
      return;
    }
    saveQuizScore(s.unit, s.section, s.correct, s.questions.length);
    clearLastVisit();
    navigate(`/unit/${s.unit}/result/${s.section}`);
    return;
  }
  s.answered = false;
  s.userAnswer = null;
  // lastVisit 저장 (normal 모드만)
  if (s.mode === 'normal') {
    setLastVisit({ unit: s.unit, section: s.section, idx: s.idx });
  }
  const pct = Math.round((s.idx / s.questions.length) * 100);
  let inputHtml = '';
  if (q.type === 'choice' || q.type === 'antecedent') {
    inputHtml = `<div class="quiz-choices">${q.choices.map(c =>
      `<button class="quiz-choice" data-c="${esc(c)}" onclick="selectChoice(this)">${esc(c)}</button>`
    ).join('')}</div>`;
  } else {
    inputHtml = `<textarea class="quiz-input" id="quizInput" placeholder="여기에 답을 입력해..."></textarea>`;
  }
  const levelLabel = { easy: '쉬움', medium: '보통', hard: '어려움' }[q.level] || q.level;
  const reviewBadge = s.mode === 'review' ? `<span class="quiz-mode-chip">📒 복습 모드</span>` : '';
  const hintHtml = q.hint ? `
      <button class="hint-btn" id="hintBtn" onclick="showHint()">💡 힌트 보기</button>
      <div class="hint-box" id="hintBox" hidden></div>` : '';
  $app().innerHTML = `
    <div class="quiz-header">
      <div class="quiz-progress"><span style="width:${pct}%"></span></div>
      <span class="quiz-count">${s.idx + 1} / ${s.questions.length}</span>
    </div>
    <div class="quiz-question">
      ${reviewBadge}
      <span class="quiz-level-chip ${q.level}">${levelLabel}</span>
      <div class="quiz-prompt">${esc(q.prompt).replace(/\n/g, '<br>')}</div>
      ${inputHtml}
      ${hintHtml}
      <div id="quizFeedback"></div>
    </div>
    <div class="quiz-actions">
      <button class="btn-primary" id="submitBtn" onclick="submitAnswer()">정답 확인</button>
    </div>`;
}
function showHint() {
  const q = _qs && _qs.questions[_qs.idx];
  if (!q || !q.hint) return;
  const box = document.getElementById('hintBox');
  const btn = document.getElementById('hintBtn');
  if (box && btn) {
    box.innerHTML = `<span class="hint-icon">💡</span><span class="hint-text">${esc(q.hint)}</span>`;
    box.hidden = false;
    btn.style.display = 'none';
  }
}
function selectChoice(btn) {
  document.querySelectorAll('.quiz-choice').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  _qs.userAnswer = btn.dataset.c;
}
function submitAnswer() {
  const s = _qs;
  const q = s.questions[s.idx];
  if (s.answered) { s.idx++; showQuestion(); return; }
  let userAns = s.userAnswer;
  if (q.type !== 'choice' && q.type !== 'antecedent') {
    userAns = document.getElementById('quizInput').value.trim();
  }
  if (!userAns) { alert('답을 먼저 선택하거나 입력해주세요.'); return; }
  const isCorrect = checkAnswer(q, userAns);
  if (isCorrect) s.correct++;

  // 일반 모드: 틀리면 오답 노트에 추가 / 복습 모드: 맞으면 노트에서 제거
  if (s.mode === 'normal') {
    if (!isCorrect) recordWrongAnswer(s.unit, s.section, q, userAns);
  } else if (s.mode === 'review') {
    if (isCorrect) clearWrongAnswer(s.unit, q.id, q._reviewSection);
  }

  s.answered = true;
  if (q.type === 'choice' || q.type === 'antecedent') {
    document.querySelectorAll('.quiz-choice').forEach(btn => {
      const c = btn.dataset.c;
      if (c === q.answer) btn.classList.add('correct');
      else if (c === userAns && !isCorrect) btn.classList.add('incorrect');
      btn.disabled = true;
    });
  } else {
    document.getElementById('quizInput').disabled = true;
  }
  const fb = document.getElementById('quizFeedback');
  fb.className = `quiz-feedback ${isCorrect ? 'correct' : 'incorrect'}`;
  fb.innerHTML = `
    <div class="answer-row">${isCorrect ? '✓ 정답!' : '✗ 아쉬워!'}${!isCorrect ? ` 정답: <em>${esc(q.answer)}</em>` : ''}</div>
    <div>${esc(q.explanation)}</div>`;
  const isLast = s.idx + 1 >= s.questions.length;
  document.getElementById('submitBtn').textContent = isLast ? '결과 보기 →' : '다음 문제 →';
}
function checkAnswer(q, userAns) {
  const correct = q.answer.trim().toLowerCase();
  const user = userAns.trim().toLowerCase();
  if (user === correct) return true;
  if (q.alternatives) {
    for (const alt of q.alternatives) {
      if (user === alt.trim().toLowerCase()) return true;
    }
  }
  if (q.type === 'combine' || q.type === 'translate') {
    const cw = correct.replace(/[.,!?]/g, '').split(/\s+/).filter(Boolean);
    const uw = user.replace(/[.,!?]/g, '').split(/\s+/).filter(Boolean);
    const matches = cw.filter(w => uw.includes(w)).length;
    if (cw.length > 0 && matches / cw.length >= 0.7) return true;
  }
  if (q.type === 'error') {
    const correctTokens = correct.split(/[→\s]+/).filter(Boolean);
    const userTokens = user.split(/[→\s]+/).filter(Boolean);
    const m = correctTokens.filter(t => userTokens.includes(t)).length;
    if (correctTokens.length > 0 && m / correctTokens.length >= 0.6) return true;
  }
  return false;
}

// ===== 화면: 결과 (마법 카드) =====
function renderResult({ unit, section }) {
  const score = getQuizScore(unit, section);
  if (!score) { renderHome(); return; }
  const u = UNITS[unit];
  const pct = Math.round((score.correct / score.total) * 100);
  const wrongCount = getWrongList(unit).length;
  const isNewRecord = _lastResultNewRecord;
  _lastResultNewRecord = false;

  let stars, charMood, title, msg;
  if (pct >= 90) { stars = 3; charMood = 'cheer'; title = '마법사 마스터!'; msg = '거의 완벽해. 그램이 인정한다.'; }
  else if (pct >= 70) { stars = 2; charMood = 'cheer'; title = '마법 습득!'; msg = '잘했어! 응용에서 한 번 더 확인해보자.'; }
  else if (pct >= 50) { stars = 1; charMood = 'pointing'; title = '거의 다 왔어!'; msg = '이야기 한번 더 읽고 도전해보자.'; }
  else { stars = 0; charMood = 'oops'; title = '시작이 반!'; msg = '괜찮아. 그램도 처음엔 그랬어. 이야기부터 다시 보자.'; }
  const moodEmoji = { cheer: '🎉', pointing: '✨', oops: '🌱' }[charMood] || '✨';

  let starsHtml = '';
  for (let i = 0; i < 3; i++) {
    const filled = i < stars;
    starsHtml += `<span class="result-star ${filled ? 'filled' : 'empty'}" style="animation-delay:${i * 0.15}s">${filled ? '★' : '☆'}</span>`;
  }

  const newRecordBadge = isNewRecord ? `<div class="result-newrecord">🎉 신기록!</div>` : '';
  const reviewBtn = wrongCount > 0 ? `<button class="btn-primary" onclick="navigate('/unit/${unit}/review')">오답 ${wrongCount}개 복습하기 →</button>` : '';

  $app().innerHTML = `
    <div class="result-view">
      ${newRecordBadge}
      <div class="result-character">
        <img class="result-char-img" src="assets/character/mascot-${charMood}.png" alt="그램"
          onerror="this.outerHTML='<div class=&quot;result-char-emoji&quot;>${moodEmoji}</div>'">
      </div>
      <div class="result-stars" aria-label="${stars}개 별 획득">
        ${starsHtml}
      </div>
      <div class="result-title">${title}</div>
      <div class="result-percent" id="resultPercent">0<small>%</small></div>
      <div class="result-score-sub">${score.correct} / ${score.total} 정답</div>
      <p class="result-message">${msg}</p>
      <div class="magic-card">
        <h3>${u.title} 마법 카드</h3>
        <ul>${u.magicCard.map(c => `<li>${esc(c)}</li>`).join('')}</ul>
      </div>
      <div class="result-actions">
        ${reviewBtn}
        ${section === 'quiz' ? `<button class="btn-secondary" onclick="navigate('/unit/${unit}/apply')">응용 도전 →</button>` : ''}
        ${section === 'apply' ? `<button class="btn-secondary" onclick="navigate('/unit/${unit}/quiz')">퀴즈 다시 →</button>` : ''}
        <button class="btn-secondary" onclick="navigate('/unit/${unit}')">단원으로 돌아가기</button>
        <button class="btn-secondary" onclick="navigate('/')">홈으로</button>
      </div>
    </div>`;

  const el = document.getElementById('resultPercent');
  if (el) {
    const duration = 700;
    const start = performance.now();
    function tick(now) {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const v = Math.round(pct * eased);
      el.innerHTML = `${v}<small>%</small>`;
      if (t < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }
}


// ===== 자체 마크다운 파서 (외부 라이브러리 없이) =====
function parseMd(md) {
  const lines = md.split('\n');
  const out = [];
  let inCode = false, codeBuf = [];
  let inList = false, listType = null;
  let inTable = false;
  let inQuote = false, quoteBuf = [];
  function fL() { if (inList) { out.push('</' + listType + '>'); inList = false; listType = null; } }
  function fQ() { if (inQuote) { out.push('<blockquote>' + quoteBuf.join('<br>') + '</blockquote>'); quoteBuf = []; inQuote = false; } }
  function fT() { if (inTable) { out.push('</tbody></table>'); inTable = false; } }
  for (let line of lines) {
    if (line.startsWith('```')) {
      if (inCode) { out.push('<pre><code>' + esc(codeBuf.join('\n')) + '</code></pre>'); codeBuf = []; inCode = false; }
      else { fL(); fQ(); fT(); inCode = true; }
      continue;
    }
    if (inCode) { codeBuf.push(line); continue; }
    if (/^\|.*\|\s*$/.test(line)) {
      fL(); fQ();
      if (/^\|[\s\-:|]+\|\s*$/.test(line)) continue;
      const cells = line.split('|').slice(1, -1).map(c => c.trim());
      if (!inTable) {
        out.push('<table><thead><tr>' + cells.map(c => '<th>' + inl(c) + '</th>').join('') + '</tr></thead><tbody>');
        inTable = true;
      } else {
        out.push('<tr>' + cells.map(c => '<td>' + inl(c) + '</td>').join('') + '</tr>');
      }
      continue;
    } else if (inTable) fT();
    if (/^---+\s*$/.test(line)) { fL(); fQ(); out.push('<hr>'); continue; }
    if (line.startsWith('### ')) { fL(); fQ(); out.push('<h3>' + inl(line.slice(4)) + '</h3>'); continue; }
    if (line.startsWith('## ')) { fL(); fQ(); out.push('<h2>' + inl(line.slice(3)) + '</h2>'); continue; }
    if (line.startsWith('# ')) { fL(); fQ(); out.push('<h1>' + inl(line.slice(2)) + '</h1>'); continue; }
    if (line.startsWith('> ')) { fL(); inQuote = true; quoteBuf.push(inl(line.slice(2))); continue; }
    if (inQuote && line.trim() === '') { fQ(); continue; }
    if (inQuote && !line.startsWith('> ')) fQ();
    if (/^- /.test(line)) {
      if (!inList || listType !== 'ul') { fL(); fQ(); out.push('<ul>'); inList = true; listType = 'ul'; }
      out.push('<li>' + inl(line.slice(2)) + '</li>');
      continue;
    }
    if (/^\d+\. /.test(line)) {
      if (!inList || listType !== 'ol') { fL(); fQ(); out.push('<ol>'); inList = true; listType = 'ol'; }
      out.push('<li>' + inl(line.replace(/^\d+\. /, '')) + '</li>');
      continue;
    }
    if (line.trim() === '') { fL(); fQ(); continue; }
    fL(); fQ();
    out.push('<p>' + inl(line) + '</p>');
  }
  fL(); fQ(); fT();
  if (inCode) out.push('<pre><code>' + esc(codeBuf.join('\n')) + '</code></pre>');
  let html = out.join('\n');
  html = html.replace(/\[COMIC:([\w-]+)\]/g, (m, k) => (window.COMICS && window.COMICS[k]) || '');
  return html;
}
function inl(t) {
  return esc(t)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/~~([^~]+)~~/g, '<del>$1</del>');
}
