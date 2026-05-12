/* 뮤엠 그래머 — 메인 앱 로직 (SPA + 라우터 + 퀴즈 엔진) */

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

// ===== 진도 (메모리 기반, 같은 세션 동안만 유지) =====
const _progress = {};
function markChapterRead(unit, n) {
  if (!_progress[unit]) _progress[unit] = {};
  if (!_progress[unit].story) _progress[unit].story = new Set();
  _progress[unit].story.add(n);
}
function isChapterRead(unit, n) {
  return _progress[unit]?.story?.has(n) || false;
}
function saveQuizScore(unit, section, correct, total) {
  if (!_progress[unit]) _progress[unit] = {};
  _progress[unit][section] = { correct, total };
}
function getQuizScore(unit, section) {
  return _progress[unit]?.[section] || null;
}
function computeUnitProgress(unit) {
  const u = UNITS[unit];
  let pct = 0;
  const storyDone = _progress[unit]?.story?.size || 0;
  pct += (storyDone / u.storyTotal) * 33;
  if (_progress[unit]?.quiz) pct += 33;
  if (_progress[unit]?.apply) pct += 34;
  return Math.round(Math.min(100, pct));
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
  $app().innerHTML = `
    <section class="hero">
      ${charImg('mascot-hero', '그램 — 어린 마법사')}
      <h1 class="hero-title">안녕! 나는 <span class="accent">그램</span>이야</h1>
      <p class="hero-sub">문법은 외우는 게 아니야.<br>마법처럼 이해하는 거야.</p>
    </section>
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
  const storyDone = _progress[unit]?.story?.size || 0;
  const q = getQuizScore(unit, 'quiz');
  const a = getQuizScore(unit, 'apply');
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
          <p>${q ? `${q.correct}/${q.total} 정답` : '아직 안 풀었어요'}</p>
        </div>
        <span class="section-arrow">→</span>
      </a>
      <a class="section-card" href="#/unit/${unit}/apply">
        <div class="section-icon">🪄</div>
        <div class="section-info">
          <h3>응용으로 마스터하기</h3>
          <p>${a ? `${a.correct}/${a.total} 정답` : '아직 안 풀었어요'}</p>
        </div>
        <span class="section-arrow">→</span>
      </a>
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
      questions: data.questions,
      idx: 0, correct: 0,
      answered: false, userAnswer: null
    };
    showQuestion();
  } catch (e) {
    $app().innerHTML = `<p class="loading">로딩 실패: ${e.message}</p>`;
  }
}
function showQuestion() {
  const s = _qs;
  const q = s.questions[s.idx];
  if (!q) {
    saveQuizScore(s.unit, s.section, s.correct, s.questions.length);
    navigate(`/unit/${s.unit}/result/${s.section}`);
    return;
  }
  s.answered = false;
  s.userAnswer = null;
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
  $app().innerHTML = `
    <div class="quiz-header">
      <div class="quiz-progress"><span style="width:${pct}%"></span></div>
      <span class="quiz-count">${s.idx + 1} / ${s.questions.length}</span>
    </div>
    <div class="quiz-question">
      <span class="quiz-level-chip ${q.level}">${levelLabel}</span>
      <div class="quiz-prompt">${esc(q.prompt).replace(/\n/g, '<br>')}</div>
      ${inputHtml}
      <div id="quizFeedback"></div>
    </div>
    <div class="quiz-actions">
      <button class="btn-primary" id="submitBtn" onclick="submitAnswer()">정답 확인</button>
    </div>`;
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
  document.getElementById('submitBtn').textContent = s.idx + 1 >= s.questions.length ? '결과 보기 →' : '다음 문제 →';
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
  let emoji, title, msg;
  if (pct >= 90) { emoji = '🏆'; title = '마법사 마스터!'; msg = '거의 완벽해. 그램이 인정한다.'; }
  else if (pct >= 70) { emoji = '✨'; title = '마법 습득!'; msg = '잘했어! 응용에서 한 번 더 확인해보자.'; }
  else if (pct >= 50) { emoji = '⚡'; title = '거의 다 왔어!'; msg = '이야기 한번 더 읽고 도전해보자.'; }
  else { emoji = '🌱'; title = '시작이 반!'; msg = '괜찮아. 그램도 처음엔 그랬어. 이야기부터 다시 보자.'; }
  $app().innerHTML = `
    <div class="result-view">
      <div class="result-emoji">${emoji}</div>
      <div class="result-title">${title}</div>
      <div class="result-score">${score.correct} <small>/ ${score.total}</small></div>
      <p class="result-message">${msg}</p>
      <div class="magic-card">
        <h3>${u.title} 마법 카드</h3>
        <ul>${u.magicCard.map(c => `<li>${esc(c)}</li>`).join('')}</ul>
      </div>
      <div class="result-actions">
        ${section === 'quiz' ? `<button class="btn-primary" onclick="navigate('/unit/${unit}/apply')">응용 도전 →</button>` : ''}
        ${section === 'apply' ? `<button class="btn-primary" onclick="navigate('/unit/${unit}/quiz')">퀴즈 다시 →</button>` : ''}
        <button class="btn-secondary" onclick="navigate('/unit/${unit}')">단원으로 돌아가기</button>
        <button class="btn-secondary" onclick="navigate('/')">홈으로</button>
      </div>
    </div>`;
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
