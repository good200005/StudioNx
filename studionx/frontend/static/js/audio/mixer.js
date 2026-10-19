// 트랙 믹서 (S1-11a, PRD 02 FR-251 · FR-252)
// 트랙마다 "볼륨 → 팬" 노드를 만들고, 모두 마스터 게인으로 모아 목적지로 보냅니다.
// 뮤트 · 솔로 규칙과 dB 변환은 소리를 쓰지 않는 순수 함수로 따로 두어 Node 에서도 시험합니다.
// 같은 코드를 AudioContext(실시간)와 OfflineAudioContext(WAV 출력, S1-11b)가 함께 씁니다.

import { LevelTap } from './meter.js';

/**
 * dB → 선형 게인 (0 dB = 1)
 * - 위험 값(숫자가 아니거나 -60 dB 이하)은 무음 0 으로 처리합니다 (DB 범위가 -60~24)
 * @param {number|string} db
 * @returns {number}
 */
export function dbToGain(db) {
  const v = Number(db);
  if (!isFinite(v) || v <= -60) return 0;
  return Math.pow(10, v / 20);
}

/**
 * 항상 스테레오로 받는 게인 노드를 만듦
 * - 모노 소리가 StereoPannerNode 를 거치면 가운데에서도 -3dB 가 되는데(등출력 팬 법칙),
 *   미리 스테레오로 늘려(L = R = 원래 소리) 두면 가운데에서는 크기가 그대로이고 한쪽으로 보낼 때만 반대쪽이 줄어듭니다
 * @param {BaseAudioContext} context
 * @returns {GainNode}
 */
export function createStereoGain(context) {
  const g = context.createGain();
  g.channelCount = 2;
  g.channelCountMode = 'explicit';
  g.channelInterpretation = 'speakers';
  return g;
}

/**
 * 지금 소리가 나야 하는 트랙 번호 목록 (뮤트 · 솔로 규칙)
 * - 뮤트된 트랙은 늘 조용합니다
 * - 솔로가 한 트랙이라도 켜져 있으면, 솔로 트랙만 들립니다
 * - MASTER 는 이 규칙의 대상이 아닙니다 (마스터는 늘 들립니다)
 * @param {Array<{track_id:number, track_type?:string, is_muted?:boolean, is_solo?:boolean}>} tracks
 * @returns {number[]}
 */
export function audibleTrackIds(tracks) {
  const list = (tracks || []).filter(function (t) { return t.track_type !== 'MASTER'; });
  const anySolo = list.some(function (t) { return !!t.is_solo; });
  return list.filter(function (t) {
    if (t.is_muted) return false;
    return anySolo ? !!t.is_solo : true;
  }).map(function (t) { return t.track_id; });
}

/**
 * 믹서 그래프 — 트랙별 볼륨 · 팬 노드와 마스터를 다룸
 * - context 는 AudioContext 또는 OfflineAudioContext 어느 쪽이든 됩니다
 */
export class MixerGraph {
  /**
   * @param {BaseAudioContext} context
   * @param {AudioNode} [destination]  없으면 context.destination
   */
  constructor(context, destination) {
    this.context = context;
    this.master = context.createGain();          // 마스터 볼륨
    this.out = context.createGain();             // 마지막 출력 (마스터 이펙트 뒤) — 소리를 재거나 녹음할 때 여기에 붙임
    this.out.connect(destination != null ? destination : context.destination);
    this.master.connect(this.out);
    this.masterChain = [];                       // 마스터 이펙트 (master → 체인 → out)
    this.strips = {};   // trackId -> { source, input(볼륨), pan, chain }
    this.taps = {};     // 트랙 키 → LevelTap (미터)
  }

  /**
   * 트랙의 소리 크기를 읽는 도구를 (없으면) 만들고 돌려줌 — 볼륨 · 팬을 거친 뒤의 소리를 읽음
   * @param {number|string} trackId  'master' 이면 마스터 출력
   * @returns {LevelTap}
   */
  meterFor(trackId) {
    const key = String(trackId);
    if (this.taps[key]) return this.taps[key];
    let node;
    if (key === 'master') node = this.out;
    else { const s = this.strip(key); node = s.pan || s.input; }
    this.taps[key] = new LevelTap(this.context, node);
    return this.taps[key];
  }

  /**
   * head → 이펙트들 → tail 로 다시 이음 (이펙트 체인 바꾸기)
   * - 옛 연결은 모두 끊고 새 목록 순서대로 잇습니다. 목록이 비면 head 가 tail 에 바로 이어집니다
   * @param {AudioNode} head
   * @param {AudioNode} tail
   * @param {Array<{input:AudioNode, output:AudioNode}>} oldList
   * @param {Array<{input:AudioNode, output:AudioNode}>} newList
   */
  _rewire(head, tail, oldList, newList) {
    try { head.disconnect(); } catch (e) { /* 연결이 없었음 */ }
    oldList.forEach(function (fx) { try { fx.output.disconnect(); } catch (e) { /* 무시 */ } });
    let prev = head;
    newList.forEach(function (fx) { prev.connect(fx.input); prev = fx.output; });
    prev.connect(tail);
  }

  /** 트랙의 이펙트 체인을 바꿈 (소스 → 이펙트들 → 볼륨 · 팬) */
  setTrackEffects(trackId, list) {
    const s = this.strip(trackId);
    this._rewire(s.source, s.input, s.chain, list);
    s.chain = list.slice();
  }

  /** 마스터 이펙트 체인을 바꿈 (마스터 볼륨 → 이펙트들 → 최종 출력) */
  setMasterEffects(list) {
    this._rewire(this.master, this.out, this.masterChain, list);
    this.masterChain = list.slice();
  }

  /** 트랙 줄을 (없으면) 만들고 돌려줌. input 이 그 트랙의 입력 노드 */
  strip(trackId) {
    const key = String(trackId);
    if (this.strips[key]) return this.strips[key];
    const ctx = this.context;
    const source = createStereoGain(ctx);   // 악기 · 클립이 모이는 곳 (이펙트 체인의 입구, 모노도 스테레오로 늘림)
    const input = ctx.createGain();      // 트랙 볼륨 · 뮤트 · 솔로 (이펙트 체인 뒤)
    const pan = typeof ctx.createStereoPanner === 'function' ? ctx.createStereoPanner() : null;
    source.connect(input);
    if (pan) { input.connect(pan); pan.connect(this.master); }
    else input.connect(this.master);
    this.strips[key] = { source: source, input: input, pan: pan, chain: [] };
    return this.strips[key];
  }

  /** 트랙의 소리가 들어오는 노드 (악기 · 클립이 여기에 연결됨 — 이펙트 체인의 입구) */
  trackInput(trackId) {
    return this.strip(trackId).source;
  }

  /**
   * 트랙 값을 모두 반영 (볼륨 · 팬 · 뮤트 · 솔로)
   * @param {Array<object>} tracks  서버 트랙 (volume_db, pan, is_muted, is_solo, track_type)
   */
  applyTracks(tracks) {
    const audible = {};
    audibleTrackIds(tracks).forEach(function (id) { audible[String(id)] = true; });
    const self = this;
    const now = this.context.currentTime;
    (tracks || []).forEach(function (t) {
      if (t.track_type === 'MASTER') {
        self.master.gain.setTargetAtTime(dbToGain(t.volume_db), now, 0.01);
        return;
      }
      const s = self.strip(t.track_id);
      const gain = audible[String(t.track_id)] ? dbToGain(t.volume_db) : 0;
      s.input.gain.setTargetAtTime(gain, now, 0.01);   // 뚝 끊기는 소리(클릭)를 막으려고 아주 짧게 이어서 바꿈
      if (s.pan) s.pan.pan.setTargetAtTime(Math.max(-1, Math.min(1, Number(t.pan) || 0)), now, 0.01);
    });
  }
}
