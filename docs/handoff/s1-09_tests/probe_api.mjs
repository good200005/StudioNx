import { launch } from '../p1-28_tests/lib.mjs';

const b = await launch(9541, 1600, 1000);
await b.goto('http://localhost:8001/home.html');
const s = await b.ev(`(async()=>{const r=await fetch('/api/v1/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'s109-tester@example.com',password:'Test1234!',remember:false}),credentials:'same-origin'});return r.status})()`);
console.log('login', s);
await b.sleep(400);
for (const path of ['/tracks/4639/plugins', '/tracks/4639/instruments', '/tracks/4639', '/plugins?active_only=true']) {
  const out = await b.ev(`(async()=>{const m=await import('/static/js/core/api.js'); try{const r=await m.api.get('${path}'); return JSON.stringify(r).slice(0,200)}catch(e){return 'ERR '+e.message}})()`);
  console.log(path, '=>', out);
}
await b.close();
process.exit(0);
