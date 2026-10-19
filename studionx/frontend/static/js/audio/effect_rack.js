// 이펙트 체인 관리 (S1-11a, PRD 02 FR-243 · FR-263)
// 트랙에 붙은 이펙트 목록(슬롯 순서, 바이패스, 파라미터)을 읽어 실제 이펙트 노드를 만들고,
// 목록이 바뀌면 체인을 다시 잇고, 노브 값이 바뀌면 소리에 반영합니다.
// 화면은 목록만 주고(getEffects), 소리 쪽 변경은 모두 여기서 일어납니다.

import { createEffect, EFFECT_CODES } from './effects.js';
import { resolveParams } from './synth.js';

export class EffectRack {
  /**
   * @param {BaseAudioContext} context
   * @param {MixerGraph} mixer
   * @param {function(number|string):Array<object>} getEffects  트랙 번호 → 이펙트 목록
   *   항목: { id, plugin_code, schema, params, is_bypassed, slot_index }
   * @param {function():number} getBpm
   */
  constructor(context, mixer, getEffects, getBpm) {
    this.context = context;
    this.mixer = mixer;
    this.getEffects = getEffects;
    this.getBpm = getBpm;
    this.live = {};       // 이펙트 번호 → { fx, code, sig }
    this.chains = {};     // 트랙 키 → 이어 둔 이펙트 번호 목록의 문자열 (바뀌었는지 비교용)
  }

  /**
   * 한 트랙의 체인을 목록에 맞춤
   * @param {string} key  mixer 의 트랙 키 ('master' 이면 마스터 체인)
   * @param {number|string} trackId
   */
  _syncTrack(key, trackId) {
    const items = (this.getEffects(trackId) || [])
      .filter(function (e) { return !e.is_bypassed && EFFECT_CODES.indexOf(e.plugin_code) >= 0; })
      .sort(function (a, b) { return a.slot_index - b.slot_index; });

    const self = this;
    const chain = [];
    items.forEach(function (e) {
      const params = resolveParams(e.schema, e.params);
      const sig = JSON.stringify(params);
      let entry = self.live[e.id];
      if (entry && entry.code !== e.plugin_code) { entry.fx.dispose(); entry = null; delete self.live[e.id]; }
      if (!entry) {
        entry = { fx: createEffect(self.context, e.plugin_code, params, self.getBpm), code: e.plugin_code, sig: sig, track: key };
        self.live[e.id] = entry;
      } else if (entry.sig !== sig) {
        entry.fx.update(params);
        entry.sig = sig;
      } else if (e.plugin_code === 'delay') {
        entry.fx.update(params);    // 템포 동기 딜레이는 BPM 이 바뀌면 값이 달라져서 매번 다시 계산함
      }
      chain.push({ id: e.id, fx: entry.fx });
    });

    const signature = chain.map(function (c) { return c.id; }).join(',');
    if (this.chains[key] !== signature) {
      const list = chain.map(function (c) { return c.fx; });
      if (key === 'master') this.mixer.setMasterEffects(list);
      else this.mixer.setTrackEffects(trackId, list);
      this.chains[key] = signature;
    }

    // 목록에서 사라진 이펙트(삭제 · 종류 바뀜)는 정리
    const keep = {};
    chain.forEach(function (c) { keep[c.id] = true; });
    Object.keys(this.live).forEach(function (id) {
      if (self.live[id].track === key && !keep[id]) { self.live[id].fx.dispose(); delete self.live[id]; }
    });
  }

  /**
   * 모든 트랙의 체인을 지금 값에 맞춤 (재생 시작 때와 재생 중 주기적으로 부름)
   * @param {Array<{track_id:number, track_type?:string}>} tracks
   */
  sync(tracks) {
    const self = this;
    (tracks || []).forEach(function (t) {
      self._syncTrack(t.track_type === 'MASTER' ? 'master' : String(t.track_id), t.track_id);
    });
  }

  /**
   * 이펙트를 모두 새로 만들게 비움 (정지할 때) — 딜레이 · 리버브의 남은 꼬리가 다음 재생에 섞이지 않게 함
   */
  flush() {
    const self = this;
    Object.keys(this.chains).forEach(function (key) {
      if (key === 'master') self.mixer.setMasterEffects([]);
      else self.mixer.setTrackEffects(key, []);
    });
    Object.keys(this.live).forEach(function (id) { self.live[id].fx.dispose(); });
    this.live = {};
    this.chains = {};
  }
}
