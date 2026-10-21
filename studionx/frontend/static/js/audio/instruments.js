// 트랙의 악기 층 (S1-11a, PRD 02 FR-241 · FR-242 · FR-2181)
// 한 트랙에는 악기가 여러 개(레이어) 붙을 수 있고, 같은 노트를 모두가 함께 연주합니다.
// 층마다 볼륨 · 팬 노드를 두고 트랙의 입력(믹서)으로 모읍니다.
// 소리가 나는 악기는 Subtractive Synth(S1-11a)와 Sampler(S1-11c)입니다.
// Sampler 는 악기에 붙은 sample_id 의 샘플을 노트 음높이에 맞춰 울립니다 (docs/Default_Instruments_Effects.md §5).

import { playSynthNote, resolveParams, layerGain } from './synth.js';
import { playSamplerNote } from './sampler.js';
import { createStereoGain } from './mixer.js';

/** MIDI 노트로 소리를 내는 악기 코드 */
export const PLAYABLE_CODES = ['synth_sub', 'sampler'];

export class InstrumentRack {
  /**
   * @param {BaseAudioContext} context
   * @param {function(number|string):AudioNode} trackInput  트랙 번호 → 입력 노드 (MixerGraph.trackInput)
   * @param {function(number|string):Array<object>} getInstruments  트랙 번호 → 악기 층 목록
   *   층: { id, plugin_code, schema, params, volume_db, pan, is_enabled }
   * @param {function(number|string):(AudioBuffer|null)} [getBuffer]  샘플 번호 → 디코딩된 샘플 (Sampler 가 씀)
   */
  constructor(context, trackInput, getInstruments, getBuffer) {
    this.context = context;
    this.trackInput = trackInput;
    this.getInstruments = getInstruments;
    this.getBuffer = getBuffer ? getBuffer : function () { return null; };
    this.layers = {};   // 층 번호 → { gain, pan }
  }

  /** 층의 출력 노드를 (없으면) 만들고 볼륨 · 팬을 맞춤 */
  _layer(trackId, inst) {
    const key = String(trackId) + ':' + String(inst.id);
    const ctx = this.context;
    let layer = this.layers[key];
    if (!layer) {
      const gain = createStereoGain(ctx);
      const pan = typeof ctx.createStereoPanner === 'function' ? ctx.createStereoPanner() : null;
      if (pan) { gain.connect(pan); pan.connect(this.trackInput(trackId)); }
      else gain.connect(this.trackInput(trackId));
      layer = { gain: gain, pan: pan };
      this.layers[key] = layer;
    }
    layer.gain.gain.value = layerGain(inst.volume_db);
    if (layer.pan) layer.pan.pan.value = Math.max(-1, Math.min(1, Number(inst.pan) || 0));
    return layer;
  }

  /**
   * 노트 하나를 트랙의 모든 악기 층에 울림
   * @returns {Array<{stop:function(number):void}>} 울린 소리 (층마다 하나)
   */
  playNote(trackId, pitch, velocity, when, durationSec) {
    const out = [];
    const self = this;
    (this.getInstruments(trackId) || []).forEach(function (inst) {
      if (inst.is_enabled === false) return;
      if (PLAYABLE_CODES.indexOf(inst.plugin_code) < 0) return;
      const layer = self._layer(trackId, inst);
      const params = resolveParams(inst.schema, inst.params);
      if (inst.plugin_code === 'sampler') {
        const buffer = params.sample_id != null ? self.getBuffer(params.sample_id) : null;
        out.push(playSamplerNote(self.context, layer.gain, params, buffer, pitch, velocity, when, durationSec));
      } else {
        out.push(playSynthNote(self.context, layer.gain, params, pitch, velocity, when, durationSec));
      }
    });
    return out;
  }
}
