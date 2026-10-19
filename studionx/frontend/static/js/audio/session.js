// 재생 세션 (S1-11a, PRD 02 FR-201 · FR-205)
// AudioEngine(시계 · 스케줄러) + MixerGraph(트랙 믹서) + ClipPlayer(오디오 클립)를 묶어,
// "재생 · 일시정지 · 정지"를 실제 소리로 바꿔 주는 층입니다.
// 페이지의 값(트랙 · 클립 · BPM · 루프)은 deps 로 주입받아, DOM 없이도 시험할 수 있습니다.

import { AudioEngine } from './engine.js';
import { MixerGraph } from './mixer.js';
import { ClipPlayer, clipsStartingIn, clipsCovering } from './playback.js';
import { InstrumentRack } from './instruments.js';
import { NotePlayer, expandNotes, notesStartingIn } from './notes.js';
import { EffectRack } from './effect_rack.js';

export class PlaybackSession {
  /**
   * @param {object} deps
   * @param {function():Array} deps.getTracks     트랙 목록 (volume_db, pan, is_muted, is_solo, track_type)
   * @param {function():Array} deps.getClips      오디오 클립 목록 (track_id, sample_id, start_tick, length_tick, offset_tick, gain_db, is_looped, pitch_semitones)
   * @param {function():number} deps.getBpm
   * @param {function():Array} [deps.getTempoChanges]
   * @param {function():({start:number,end:number}|null)} [deps.getLoop]  tick 단위, 없으면 루프 꺼짐
   * @param {function():Array} [deps.getMidiClips]  MIDI 클립 목록 (track_id, start_tick, length_tick, offset_tick, notes)
   * @param {function(number|string):Array} [deps.getEffects]  트랙 번호 → 이펙트 목록 (EffectRack 참고)
   * @param {function(number|string):Array} [deps.getInstruments]  트랙 번호 → 악기 층 목록 (InstrumentRack 참고)
   * @param {function(number|string):Promise<ArrayBuffer>} deps.loadSampleBytes  샘플 번호 → 파일 바이트
   * @param {function():boolean} [deps.getMetronome]
   * @param {BaseAudioContext} [deps.context]  시험용으로 바꿔 끼움 (없으면 AudioContext)
   * @param {AudioNode} [deps.destination]  시험용 출력 노드 (없으면 context.destination)
   */
  constructor(deps) {
    this.deps = deps;
    this.engine = null;
    this.mixer = null;
    this.player = null;
    this.buffers = {};          // sampleId -> AudioBuffer
    this.loading = {};          // sampleId -> Promise
    this.lastTick = null;       // 직전 단계의 tick (루프 되감기 감지)
    this.clips = [];            // 이번 재생이 쓰는 클립 (재생 시작 시점의 스냅샷)
    this.noteEvents = [];       // 이번 재생이 쓰는 MIDI 노트 (타임라인 절대 tick 으로 펼침)
    this.rack = null;
    this.effects = null;
    this.notePlayer = null;
    this.playing = false;
  }

  /** 엔진 · 믹서 · 재생기를 처음 한 번만 만듦 (사용자 조작 안에서 불러야 소리가 남) */
  _ensure() {
    if (this.engine) return;
    const self = this;
    const deps = this.deps;
    this.engine = new AudioEngine({
      context: deps.context,
      destination: deps.destination,
      baseBpm: deps.getBpm(),
      changes: deps.getTempoChanges ? deps.getTempoChanges() : [],
      metronomeEnabled: deps.getMetronome ? deps.getMetronome() : false,
      onStep: function (tick, time) { self._onStep(tick, time); },
    });
    this.mixer = new MixerGraph(this.engine.context, this.engine.destination);
    this.player = new ClipPlayer(
      this.engine.context,
      function (trackId) { return self.mixer.trackInput(trackId); },
      function (sampleId) { return self.buffers[String(sampleId)] || null; },
    );
    this.effects = new EffectRack(
      this.engine.context,
      this.mixer,
      deps.getEffects ? deps.getEffects : function () { return []; },
      function () { return deps.getBpm(); },
    );
    this.rack = new InstrumentRack(
      this.engine.context,
      function (trackId) { return self.mixer.trackInput(trackId); },
      deps.getInstruments ? deps.getInstruments : function () { return []; },
    );
    this.notePlayer = new NotePlayer(this.engine.context, function (trackId, pitch, velocity, when, dur) {
      return self.rack.playNote(trackId, pitch, velocity, when, dur);
    });
  }

  /** 샘플 하나를 디코딩해 담아 둠 (같은 번호는 한 번만) */
  _loadSample(sampleId) {
    const key = String(sampleId);
    if (this.buffers[key]) return Promise.resolve(this.buffers[key]);
    if (this.loading[key]) return this.loading[key];
    const self = this;
    const ctx = this.engine.context;
    this.loading[key] = this.deps.loadSampleBytes(sampleId).then(function (bytes) {
      return ctx.decodeAudioData(bytes);
    }).then(function (buffer) {
      self.buffers[key] = buffer;
      return buffer;
    }).catch(function (err) {
      delete self.loading[key];
      if (typeof console !== 'undefined') console.warn('[audio] 샘플 ' + key + ' 을(를) 불러오지 못했습니다', err);
      return null;
    });
    return this.loading[key];
  }

  /**
   * 재생 시작 (fromTick 부터)
   * - 이번에 쓸 클립의 샘플을 먼저 모두 불러온 뒤에 시작합니다 (소리가 비는 일을 막으려고)
   * @param {number} fromTick
   * @returns {Promise<void>}
   */
  async start(fromTick) {
    this._ensure();
    const self = this;
    const deps = this.deps;
    this.clips = deps.getClips();
    this.noteEvents = expandNotes(deps.getMidiClips ? deps.getMidiClips() : []);
    await Promise.all(this.clips.filter(function (c) { return c.sample_id != null; })
      .map(function (c) { return self._loadSample(c.sample_id); }));

    this.mixer.applyTracks(deps.getTracks());
    this.effects.sync(deps.getTracks());
    this.engine.setTempo(deps.getBpm(), deps.getTempoChanges ? deps.getTempoChanges() : []);
    if (deps.getMetronome) this.engine.setMetronome(deps.getMetronome());
    const loop = deps.getLoop ? deps.getLoop() : null;
    this.engine.setLoop(loop ? loop.start : 0, loop ? loop.end : 0, !!loop);

    this.player.stopAll();
    this.notePlayer.stopAll();
    this.lastTick = null;
    this.engine.start({ fromTick: fromTick });
    this.playing = true;
    // 시작 위치에 걸쳐 있는 클립은 중간부터 바로 울림
    const t = this.engine.transport;
    clipsCovering(this.clips, t.originTick).forEach(function (c) {
      self.player.schedule(c, t.originTick, t.originTime, self.engine.transport.baseBpm, self.engine.transport.changes);
    });
  }

  /** 스케줄러가 한 단계마다 부름 — 이 단계 안에서 시작하는 클립을 예약 */
  _onStep(tick, time) {
    const t = this.engine.transport;
    if (this.lastTick != null && tick < this.lastTick) {
      // 루프로 되감김: 이전 구간 소리는 이 시각에 끊고, 되감긴 위치에 걸친 클립을 다시 시작
      this.player.stopAll(time);
      this.notePlayer.stopAll(time);
      const self = this;
      clipsCovering(this.clips, tick).forEach(function (c) {
        self.player.schedule(c, tick, time, t.baseBpm, t.changes);
      });
    }
    this.lastTick = tick;
    const self2 = this;
    clipsStartingIn(this.clips, tick, tick + t.stepTicks).forEach(function (c) {
      self2.player.schedule(c, tick, time, t.baseBpm, t.changes);
    });
    notesStartingIn(this.noteEvents, tick, tick + t.stepTicks).forEach(function (ev) {
      self2.notePlayer.schedule(ev, tick, time, t.baseBpm, t.changes);
    });
  }

  /** 믹서 값(볼륨 · 팬 · 뮤트 · 솔로)과 이펙트(추가 · 삭제 · 순서 · 바이패스 · 노브)를 다시 반영 — 재생 중 조작에 쓰임 */
  refreshMixer() {
    if (!this.mixer) return;
    this.mixer.applyTracks(this.deps.getTracks());
    this.effects.sync(this.deps.getTracks());
  }

  /**
   * 트랙의 지금 소리 크기 → [왼쪽%, 오른쪽%] (미터용). 아직 재생을 시작한 적이 없으면 null
   * @param {number|string} trackId
   */
  meterLevels(trackId) {
    if (!this.mixer) return null;
    const tracks = this.deps.getTracks();
    const track = tracks.filter(function (t) { return String(t.track_id) === String(trackId); })[0];
    return this.mixer.meterFor(track && track.track_type === 'MASTER' ? 'master' : trackId).read();
  }

  /** 일시정지 (소리를 끊고 위치는 유지) */
  pause() {
    if (!this.engine) return;
    this.engine.pause();
    this.player.stopAll();
    this.notePlayer.stopAll();
    this.playing = false;
  }

  /** 정지 */
  stop() {
    if (!this.engine) return;
    this.engine.stop();
    this.player.stopAll();
    this.notePlayer.stopAll();
    this.effects.flush();
    this.playing = false;
  }

  /** 지금 재생 위치(tick) */
  positionTick() {
    return this.engine ? this.engine.positionTick() : 0;
  }
}
