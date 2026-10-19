// S1-11a 믹서 · 클립 재생 순수 함수 시험 (dB 변환, 뮤트/솔로 규칙, 클립 위치 계산)
// 실행: node docs/handoff/s1-11a_tests/mixer_playback_unit.mjs
import { dbToGain, audibleTrackIds } from '../../../studionx/frontend/static/js/audio/mixer.js';
import { clipsStartingIn, clipsCovering, planClipPlayback } from '../../../studionx/frontend/static/js/audio/playback.js';
let ok=0,bad=0; const t=(n,c)=>{ if(c){ok++}else{bad++;console.log('FAIL',n)} };
t('0dB',dbToGain(0)===1); t('-6dB',Math.abs(dbToGain(-6.0206)-0.5)<1e-3); t('-60',dbToGain(-60)===0); t('nan',dbToGain('x')===0);
const T=[{track_id:1,is_solo:false},{track_id:2,is_muted:true},{track_id:3,is_solo:true},{track_id:9,track_type:'MASTER'}];
t('solo',JSON.stringify(audibleTrackIds(T))==='[3]');
t('nosolo',JSON.stringify(audibleTrackIds([{track_id:1},{track_id:2,is_muted:true}]))==='[1]');
t('solo+mute',JSON.stringify(audibleTrackIds([{track_id:1,is_solo:true,is_muted:true}]))==='[]');
const C=[{start_tick:0,length_tick:960},{start_tick:960,length_tick:960},{start_tick:2000,length_tick:100}];
t('starting',clipsStartingIn(C,0,960).length===1 && clipsStartingIn(C,960,2000).length===1);
t('covering',clipsCovering(C,500).length===1 && clipsCovering(C,960).length===0 && clipsCovering(C,2050).length===1);
const p=planClipPlayback({start_tick:960,length_tick:960,offset_tick:0},960,10,120,[]); // 120BPM: 960tick=0.5s
t('plan-normal',Math.abs(p.when-10)<1e-9&&p.offsetSec===0&&Math.abs(p.durationSec-0.5)<1e-9);
const q=planClipPlayback({start_tick:0,length_tick:1920,offset_tick:480},960,10,120,[]); // 중간부터: 0.5s 건너뜀 +offset .25
t('plan-mid',Math.abs(q.when-10)<1e-9&&Math.abs(q.offsetSec-0.75)<1e-9&&Math.abs(q.durationSec-0.5)<1e-9);
const r=planClipPlayback({start_tick:1920,length_tick:960},960,10,120,[]);
t('plan-future',Math.abs(r.when-10.5)<1e-9&&r.offsetSec===0);
console.log(ok+' passed, '+bad+' failed');
