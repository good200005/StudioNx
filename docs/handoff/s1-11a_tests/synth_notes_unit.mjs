// S1-11a Synth · MIDI 노트 순수 함수 시험 (주파수, 파라미터 병합, 엔벨로프, 노트 펼치기, 타이밍)
// 실행: node docs/handoff/s1-11a_tests/synth_notes_unit.mjs
import { noteToFreq, resolveParams, oscType, envelopeLevel } from '../../../studionx/frontend/static/js/audio/synth.js';
import { expandNotes, notesStartingIn, planNote } from '../../../studionx/frontend/static/js/audio/notes.js';
let ok=0,bad=0; const t=(n,c)=>{ if(c){ok++}else{bad++;console.log('FAIL',n)} };
t('A4',noteToFreq(69)===440); t('C4',Math.abs(noteToFreq(60)-261.6256)<1e-3); t('A5',Math.abs(noteToFreq(81)-880)<1e-9);
const S=[{key:'cutoff',min:20,max:20000,default:1200},{key:'osc1_wave',type:'select',default:'saw'},{key:'env_sustain',min:0,max:1,default:0.7}];
const r=resolveParams(S,{cutoff:99999,osc1_wave:'square',junk:1});
t('clamp',r.cutoff===20000); t('override',r.osc1_wave==='square'); t('default',r.env_sustain===0.7); t('drop-unknown',r.junk===undefined);
t('null-params',resolveParams(S,null).cutoff===1200);
t('saw',oscType('saw')==='sawtooth'&&oscType('sine')==='sine'&&oscType('zzz')==='sawtooth');
t('env-a',Math.abs(envelopeLevel(0.05,0.1,0.2,0.5,1)-0.5)<1e-9);
t('env-d',Math.abs(envelopeLevel(0.2,0.1,0.2,0.5,1)-0.75)<1e-9);
t('env-s',envelopeLevel(5,0.1,0.2,0.5,1)===0.5); t('env-0',envelopeLevel(0,0.1,0.2,0.5,1)===0);
const clips=[{track_id:1,start_tick:3840,length_tick:3840,offset_tick:0,notes:[{pitch:60,start_tick:0,length_tick:960},{pitch:62,start_tick:960,length_tick:99999,velocity:50},{pitch:64,start_tick:3840,length_tick:960},{pitch:65,start_tick:480,length_tick:480,is_muted:true}]}];
const ev=expandNotes(clips);
t('expand-count',ev.length===2); t('expand-abs',ev[0].abs_start===3840&&ev[1].abs_start===4800);
t('expand-clip-end',ev[1].length_tick===3840-960); t('expand-vel',ev[0].velocity===100&&ev[1].velocity===50);
const off=expandNotes([{track_id:1,start_tick:0,length_tick:1920,offset_tick:960,notes:[{pitch:60,start_tick:0,length_tick:100},{pitch:61,start_tick:960,length_tick:100},{pitch:62,start_tick:1920,length_tick:100}]}]);
t('offset-trim',off.length===2&&off[0].abs_start===0&&off[0].pitch===61&&off[1].abs_start===960);
t('starting-in',notesStartingIn(ev,3840,4080).length===1&&notesStartingIn(ev,4080,5000).length===1&&notesStartingIn(ev,0,3840).length===0);
const p=planNote({abs_start:1200,length_tick:960},960,10,120,[]); // 120BPM: 960tick=.5s
t('plan-note',Math.abs(p.when-10.125)<1e-9&&Math.abs(p.durationSec-0.5)<1e-9);
console.log(ok+' passed, '+bad+' failed');
