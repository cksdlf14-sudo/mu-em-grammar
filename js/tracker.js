/* 뮤엠 그래머 — 학습 이벤트 트래커 (Google Sheets Apps Script webhook) */
// 형님이 Apps Script 배포 후 받은 URL을 아래에 박으세요. /exec 까지 포함된 URL.
const TRACKER_URL = 'https://script.google.com/macros/s/AKfycbzDcgf7Chtf55rB_X2_9rNFE8J1qlV7OYcn2tx2MKo1oBVOX89Kn9QrpkcSDRhubiJ_gg/exec';

const TRACKER_QUEUE_KEY = 'mu_em_tracker_queue';
const TRACKER_FLUSH_MS = 30000;
const STUDENT_KEY_TRACKER = 'muem-grammar-student';

function _trGenId() {
  return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 11);
}

function _trGetStudent() {
  try {
    const raw = localStorage.getItem(STUDENT_KEY_TRACKER);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}

function _trGetQueue() {
  try { return JSON.parse(localStorage.getItem(TRACKER_QUEUE_KEY) || '[]'); }
  catch (e) { return []; }
}

function _trSetQueue(q) {
  try { localStorage.setItem(TRACKER_QUEUE_KEY, JSON.stringify(q)); }
  catch (e) { /* quota 등 무시 */ }
}

async function _trFlush() {
  // URL 미설정 상태면 아무것도 안 함 (개발 중)
  if (!TRACKER_URL || TRACKER_URL.indexOf('PASTE_YOUR') === 0) return;

  const queue = _trGetQueue();
  if (queue.length === 0) return;

  const remaining = [];
  for (const event of queue) {
    try {
      // Apps Script는 text/plain 또는 application/json 둘 다 받음
      // CORS preflight 회피 위해 헤더 최소화 (Content-Type 명시 안 함 = simple request)
      const res = await fetch(TRACKER_URL, {
        method: 'POST',
        body: JSON.stringify(event),
        redirect: 'follow'
      });
      const result = await res.json().catch(() => ({}));
      if (result.status !== 'ok' && result.status !== 'duplicate') {
        remaining.push(event);
      }
    } catch (e) {
      // 네트워크 실패 → 큐에 보존
      remaining.push(event);
    }
  }
  _trSetQueue(remaining);
}

/**
 * 학습 이벤트 로깅 (외부 진입점)
 * @param {string} eventType - 'login' | 'class_select' | 'chapter_read' | 'answer' | 'hint_used' | 'session_end' | 'wrong_recorded' | 'wrong_cleared' | 'review_start'
 * @param {object} data - 추가 데이터 ({ questionId, answer, correct, timeTaken, hintUsed, extra })
 */
window.logEvent = function(eventType, data) {
  data = data || {};
  const student = _trGetStudent();
  const event = {
    eventId: _trGenId(),
    timestamp: Date.now(),
    studentName: (student && student.name) || 'anonymous',
    studentClass: (student && student.classKey) || 'unknown',
    eventType: eventType,
    questionId: data.questionId || '',
    answer: data.answer || '',
    correct: data.correct === undefined ? '' : data.correct,
    timeTaken: data.timeTaken || '',
    hintUsed: data.hintUsed || '',
    extra: data.extra || {}
  };

  // 1) 큐에 즉시 저장 (오프라인이어도 안 잃어버림)
  const queue = _trGetQueue();
  queue.push(event);
  // 큐 너무 크면 오래된 거 잘라냄 (안전장치, 1000개 넘으면 앞쪽 삭제)
  if (queue.length > 1000) queue.splice(0, queue.length - 1000);
  _trSetQueue(queue);

  // 2) 즉시 전송 시도 (실패해도 큐에 남음)
  _trFlush();
};

// 주기적 재시도 + 온라인 복귀 시 재시도 + 페이지 로드 시 재시도
setInterval(_trFlush, TRACKER_FLUSH_MS);
window.addEventListener('online', _trFlush);
window.addEventListener('load', _trFlush);
// 페이지 떠나기 전 마지막 시도 (queued events flush)
window.addEventListener('pagehide', _trFlush);

/**
 * 학생 회원가입 (Apps Script register endpoint 호출)
 * @returns Promise<{status, ...}>
 */
window.registerStudent = async function(studentData) {
  if (!TRACKER_URL || TRACKER_URL.indexOf('PASTE_YOUR') === 0) {
    return { status: 'no_backend' };
  }
  const payload = {
    action: 'register',
    studentName: studentData.name,
    studentClass: studentData.classKey,
    parentName: studentData.parentName || '',
    phone: studentData.phone || '',
    address: studentData.address || ''
  };
  try {
    const res = await fetch(TRACKER_URL, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    return await res.json();
  } catch (e) {
    return { status: 'network_error', message: e.toString() };
  }
};

/**
 * 학생 승인 상태 조회 (Apps Script check_status endpoint 호출)
 * @returns Promise<{status, approval?, ...}>
 */
window.checkApprovalStatus = async function(studentName) {
  if (!TRACKER_URL || TRACKER_URL.indexOf('PASTE_YOUR') === 0) {
    return { status: 'no_backend' };
  }
  try {
    const url = TRACKER_URL + '?action=check_status&student=' + encodeURIComponent(studentName);
    const res = await fetch(url);
    return await res.json();
  } catch (e) {
    return { status: 'network_error', message: e.toString() };
  }
};
