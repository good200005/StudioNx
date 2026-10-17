// API 호출 공통 모듈 (뼈대 — 구현은 직접, P1-02)
// 모든 페이지는 fetch 를 직접 쓰지 않고 여기의 api.get / api.post ... 를 씀.
//
// 토큰 방식 (PRD 01 FR-105·109)
// - Access Token(30분): 메모리(이 모듈의 변수)에만 둠 — localStorage 에 두지 않음(XSS 대비)
// - Refresh Token: 서버가 HttpOnly 쿠키로 설정 → JS에서는 보이지 않고, /auth/refresh 요청에 자동으로 실림
// - 페이지를 옮기면 메모리가 비므로, 첫 요청 전에 refreshAccessToken() 으로 다시 받음
//
// 서버 오류 응답 모양 (P1-03 schemas/common.py)
//   { "error": { "code": "EMAIL_TAKEN", "message": "...", "details": { ... } | null } }

export const API_BASE = '/api/v1';

/** 서버가 돌려준 오류. 화면 코드는 err.code 로 분기하고 err.message 를 보여 줌 */
export class ApiError extends Error {
  /**
   * @param {number} status   HTTP 상태 (네트워크 오류는 0)
   * @param {string} code     서버 ErrorCode (예: 'UNAUTHORIZED') — 네트워크 오류는 'NETWORK_ERROR'
   * @param {string} message
   * @param {object|null} [details]
   */
  constructor(status, code, message, details = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

let accessToken = null;
let refreshing = null; // 진행 중인 재발급 Promise (동시에 여러 요청이 401을 받아도 재발급은 한 번만)

export function getAccessToken() {
  return accessToken;
}

/** 로그인·재발급 성공 시 저장 */
export function setAccessToken(token) {
  accessToken = token;
}

/** 로그아웃·재발급 실패 시 */
export function clearAccessToken() {
  accessToken = null;
}

/**
 * 리프레시 쿠키로 Access Token 재발급 (구현: AI — 2026-10-06, 함수 하나씩 검토)
 * @returns {Promise<boolean>} 성공하면 true
 * - 이미 진행 중이면 그 Promise 를 그대로 돌려줌 (refreshing) → 동시에 여러 요청이 401 이어도 /auth/refresh 는 한 번
 * - POST /auth/refresh — 리프레시 토큰은 HttpOnly 쿠키라 JS 가 넣지 않아도 credentials 로 자동으로 실림
 * - 성공(200 + access_token): setAccessToken, true
 * - 실패(401 · 네트워크 오류 · 응답에 토큰 없음): clearAccessToken, false — 던지지 않음 (호출한 쪽은 true/false 로만 판단)
 * - 끝나면 성공·실패와 상관없이 refreshing = null
 */
export async function refreshAccessToken() {
  if (refreshing) return refreshing;
  refreshing = (async () => {
    try {
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
      });
      const data = res.ok ? await res.json().catch(() => null) : null;
      if (!(data && data.access_token)) {
        clearAccessToken();
        return false;
      }
      setAccessToken(data.access_token);
      return true;
    } catch {
      // 네트워크 오류 — 로그인 안 된 것으로 봄 (화면은 requireLogin 흐름으로)
      clearAccessToken();
      return false;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

/**
 * 공통 요청 함수
 * @param {string} path            '/users/me' 처럼 API_BASE 뒤의 경로
 * @param {object} [options]
 * @param {string} [options.method='GET']
 * @param {object|FormData} [options.body]   객체면 JSON, FormData 면 그대로 (프로필 이미지 업로드)
 * @param {boolean} [options.auth=true]      false 면 토큰을 붙이지 않음 (회원가입·로그인)
 * @returns {Promise<any>}  성공 응답 JSON (204 면 null)
 * @throws {ApiError}
 * 구현 메모:
 * 1. 헤더: Accept: application/json, body 가 객체면 Content-Type: application/json + JSON.stringify
 * 2. auth 이고 accessToken 이 없으면 먼저 refreshAccessToken()
 * 3. auth 이고 토큰이 있으면 Authorization: Bearer <accessToken>
 * 4. fetch(API_BASE + path, { method, headers, body, credentials: 'same-origin' })
 *    - 네트워크 실패: throw new ApiError(0, 'NETWORK_ERROR', 'Network error. Please try again.')
 * 5. 401 이고 code === 'UNAUTHORIZED' 이고 아직 재시도 안 했으면
 *    → refreshAccessToken() 성공 시 같은 요청을 한 번만 다시 보냄
 *    → 실패 시 throw (화면 쪽에서 requireLogin 흐름으로)
 * 6. 그 외 실패: 응답 JSON 의 error.{code, message, details} 로 throw new ApiError(...)
 *    (JSON 이 아니면 code 'INTERNAL_ERROR')
 * 7. 성공: 204 면 null, 아니면 res.json()
 * (구현: AI — 2026-10-06, 함수 하나씩 검토)
 */
export async function apiFetch(path, options = {}) {
  const { method = 'GET', body, auth = true } = options;

  // 1. 본문 — FormData 는 그대로(브라우저가 boundary 를 포함한 Content-Type 을 붙임), 객체는 JSON
  const headers = { Accept: 'application/json' };
  let payload;
  if (body instanceof FormData) {
    payload = body;
  } else if (body !== undefined && body !== null) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  // 2. 토큰이 아직 없으면(페이지를 막 열었을 때) 먼저 재발급
  if (auth && !accessToken) await refreshAccessToken();

  // 3·4. 보내기 — 재시도 때 새 토큰을 쓰도록 매번 헤더를 새로 만듦
  const send = async () => {
    const h = auth && accessToken ? { ...headers, Authorization: `Bearer ${accessToken}` } : headers;
    try {
      return await fetch(API_BASE + path, { method, headers: h, body: payload, credentials: 'same-origin' });
    } catch {
      throw new ApiError(0, 'NETWORK_ERROR', 'Network error. Please try again.');
    }
  };

  let res = await send();

  // 5. 토큰 만료(401 UNAUTHORIZED) → 재발급 성공하면 같은 요청을 한 번만 다시
  if (res.status === 401 && auth) {
    const err = await toApiError(res);
    if (err.code !== 'UNAUTHORIZED' || !(await refreshAccessToken())) throw err;
    res = await send();
  }

  // 6. 그 밖의 실패
  if (!res.ok) throw await toApiError(res);

  // 7. 성공 — 204 · 빈 본문이면 null
  if (res.status === 204) return null;
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

/** 실패 응답 → ApiError (서버 형식 { error: { code, message, details } }, 아니면 INTERNAL_ERROR) */
async function toApiError(res) {
  const data = await res.json().catch(() => null);
  const e = data && data.error;
  if (e && e.code) {
    const message = e.message == null ? '' : e.message;
    const details = e.details == null ? null : e.details;
    return new ApiError(res.status, e.code, message, details);
  }
  return new ApiError(res.status, 'INTERNAL_ERROR', 'Something went wrong. Please try again.');
}

/** 짧게 쓰는 함수들 — 예: const me = await api.get('/users/me') */
export const api = {
  get: (path, options) => apiFetch(path, { ...options, method: 'GET' }),
  post: (path, body, options) => apiFetch(path, { ...options, method: 'POST', body }),
  put: (path, body, options) => apiFetch(path, { ...options, method: 'PUT', body }),
  patch: (path, body, options) => apiFetch(path, { ...options, method: 'PATCH', body }),
  delete: (path, options) => apiFetch(path, { ...options, method: 'DELETE' }),
};

/* ───────── 샘플 라이브러리 (S1-07, FR-221~227) ─────────
   시퀀서 왼쪽 라이브러리 패널이 부르는 함수들. 서버 경로·응답 모양은
   backend/app/api/v1/samples.py · tags.py · schemas/sample.py · schemas/tag.py 와 같습니다.
   대부분은 api.get/post... 를 그대로 감싸고, 업로드(진행률)와 파일(미리듣기)만 따로 처리합니다. */

/**
 * 내 라이브러리 목록 (FR-224) — GET /samples?query=&tag=&page=&size=
 * @param {object} [params]
 * @param {string} [params.query]  이름에 이 글자가 든 것만 (빈 값이면 전부)
 * @param {number} [params.tag]    이 태그 번호가 붙은 것만
 * @param {number} [params.page]   1부터
 * @param {number} [params.size]   한 쪽에 받을 개수 (기본 10, 최대 50)
 * @returns {Promise<{ items: object[], total: number, page: number, size: number }>}
 * (구현: AI — 2026-10-17, S1-07, 함수 하나씩 검토)
 */
export async function fetchSampleList(params = {}) {
  const qs = new URLSearchParams();
  if (params.query) qs.set('query', params.query);
  if (params.tag != null) qs.set('tag', String(params.tag));
  if (params.page != null) qs.set('page', String(params.page));
  if (params.size != null) qs.set('size', String(params.size));
  const tail = qs.toString();
  return api.get('/samples' + (tail ? '?' + tail : ''));
}

/**
 * 샘플 하나의 파형 데이터 (FR-223) — GET /samples/{id}/waveform
 * @param {number|string} sampleId
 * @returns {Promise<{ peaks: number[][] }>}  peaks = [최솟값, 최댓값] 쌍의 배열
 * (구현: AI — 2026-10-17, S1-07, 함수 하나씩 검토)
 */
export async function fetchSampleWaveform(sampleId) {
  return api.get('/samples/' + encodeURIComponent(sampleId) + '/waveform');
}

/**
 * 샘플 이름 바꾸기 (FR-225) — PATCH /samples/{id} { name }
 * @param {number|string} sampleId
 * @param {string} name
 * @returns {Promise<object>}  바뀐 샘플 한 줄 (붙어 있는 태그 포함)
 * (구현: AI — 2026-10-17, S1-07, 함수 하나씩 검토)
 */
export async function renameSample(sampleId, name) {
  return api.patch('/samples/' + encodeURIComponent(sampleId), { name: name });
}

/**
 * 샘플 태그 설정 (FR-225) — PUT /samples/{id}/tags { tag_ids }
 * @param {number|string} sampleId
 * @param {number[]} tagIds  이 목록이 태그의 전부가 됨 (빈 목록이면 모두 뗌)
 * @returns {Promise<object>}  바뀐 샘플 한 줄 (새로 붙은 태그 포함)
 * (구현: AI — 2026-10-17, S1-07, 함수 하나씩 검토)
 */
export async function setSampleTags(sampleId, tagIds) {
  return api.put('/samples/' + encodeURIComponent(sampleId) + '/tags', { tag_ids: tagIds });
}

/**
 * 샘플 소프트 삭제 (FR-225) — DELETE /samples/{id}
 * @param {number|string} sampleId
 * @returns {Promise<null>}  성공하면 204 라 null
 * (구현: AI — 2026-10-17, S1-07, 함수 하나씩 검토)
 */
export async function deleteSample(sampleId) {
  return api.delete('/samples/' + encodeURIComponent(sampleId));
}

/**
 * 태그 목록 (FR-224) — GET /tags
 * @returns {Promise<{ items: { tag_id: number, name: string, category: string }[] }>}
 * (구현: AI — 2026-10-17, S1-07, 함수 하나씩 검토)
 */
export async function fetchTags() {
  return api.get('/tags');
}

// 미리듣기 주소는 한 번 만들면 창을 닫을 때까지 씀 — 샘플 번호 → objectURL
const sampleFileUrls = new Map();

/**
 * 샘플 오디오 미리듣기 주소 (FR-224) — GET /samples/{id}/file 을 blob 으로 받아 objectURL 로 돌려줌
 * @param {number|string} sampleId
 * @returns {Promise<string>}  <audio src> 에 넣을 수 있는 주소
 *
 * - Access Token 은 메모리에만 있어서 <audio src="/samples/…/file"> 처럼 바로 걸 수 없습니다.
 *   그래서 토큰을 붙여 받은 뒤 blob → objectURL 로 바꿔 줍니다. 같은 번호는 다시 받지 않습니다.
 * - 401 이면 재발급 후 한 번만 다시 받습니다.
 * (구현: AI — 2026-10-17, S1-07, 함수 하나씩 검토)
 */
export async function fetchSampleFileUrl(sampleId) {
  const key = String(sampleId);
  const hit = sampleFileUrls.get(key);
  if (hit) return hit;

  if (!accessToken) await refreshAccessToken();

  const send = () => {
    const headers = { Accept: '*/*' };
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
    return fetch(`${API_BASE}/samples/${encodeURIComponent(key)}/file`, {
      headers: headers,
      credentials: 'same-origin',
    });
  };

  let res = await send();
  if (res.status === 401 && (await refreshAccessToken())) res = await send();
  if (!res.ok) throw await toApiError(res);

  const url = URL.createObjectURL(await res.blob());
  sampleFileUrls.set(key, url);
  return url;
}

/** 업로드 실패 응답(XHR) → ApiError. fetch 용 toApiError 와 같은 모양을 씀 */
function xhrError(xhr) {
  let data = null;
  try {
    data = xhr.responseText ? JSON.parse(xhr.responseText) : null;
  } catch {
    data = null;
  }
  const e = data && data.error;
  if (e && e.code) {
    return new ApiError(xhr.status, e.code, e.message == null ? '' : e.message, e.details == null ? null : e.details);
  }
  return new ApiError(xhr.status, 'INTERNAL_ERROR', 'Something went wrong. Please try again.');
}

/**
 * 샘플 업로드 (FR-221·226) — POST /samples (multipart, file)
 * @param {File} file
 * @param {object} [options]
 * @param {(loaded: number, total: number) => void} [options.onProgress]  진행률 (FR-226)
 * @param {AbortSignal} [options.signal]  취소용 — 취소하면 code 'ABORTED' 로 실패
 * @returns {Promise<object>}  올린 샘플 한 줄 (SampleResponse)
 *
 * - 진행률을 받으려고 fetch 대신 XMLHttpRequest 를 씁니다(fetch 는 업로드 진행률을 주지 않음).
 * - 401 이면 재발급 후 한 번만 다시 보냅니다. 실패 응답 모양은 apiFetch 와 같습니다.
 * (구현: AI — 2026-10-17, S1-07, 함수 하나씩 검토)
 */
export function uploadSample(file, options = {}) {
  const signal = options.signal;
  const onProgress = options.onProgress;
  return new Promise((resolve, reject) => {
    if (signal && signal.aborted) {
      reject(new ApiError(0, 'ABORTED', 'Upload cancelled.'));
      return;
    }
    if (!accessToken) refreshAccessToken().then(() => send(false));

    function send(retried) {
      const form = new FormData();
      form.append('file', file, file.name);
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${API_BASE}/samples`);
      xhr.withCredentials = true;
      if (accessToken) xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`);
      xhr.setRequestHeader('Accept', 'application/json');
      if (xhr.upload && onProgress) {
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) onProgress(e.loaded, e.total);
        });
      }
      xhr.addEventListener('load', () => {
        if (xhr.status === 401 && !retried) {
          refreshAccessToken().then((ok) => (ok ? send(true) : reject(xhrError(xhr))));
          return;
        }
        if (xhr.status >= 200 && xhr.status < 300) {
          let data = null;
          try {
            data = xhr.responseText ? JSON.parse(xhr.responseText) : null;
          } catch {
            data = null;
          }
          resolve(data);
        } else {
          reject(xhrError(xhr));
        }
      });
      xhr.addEventListener('error', () => reject(new ApiError(0, 'NETWORK_ERROR', 'Network error. Please try again.')));
      xhr.addEventListener('abort', () => reject(new ApiError(0, 'ABORTED', 'Upload cancelled.')));
      if (signal) signal.addEventListener('abort', () => xhr.abort());
      xhr.send(form);
    }

    if (accessToken) send(false);
  });
}
