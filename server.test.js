import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createApp} from './server.js';
import {once} from 'node:events';
test('persists reports and separates email distributions; reports partial failures', async () => {
 const delivered=[];let fail=false;
 const server=createApp({dbPath:':memory:',transport:{async sendMail(m){if(fail && m.cc)throw Error('offline');delivered.push(m);return {rejected:[]};}}});
 server.listen(0,'127.0.0.1');await once(server,'listening');
 const base=`http://127.0.0.1:${server.address().port}`;
 const post=(path,data)=>fetch(base+path,{method:'POST',body:JSON.stringify(data)});
 try {
  assert.equal((await fetch(base)).status,200);
  const state={productions:[{id:'p',name:'Test',managers:'manager@example.org',people:[{role:'Cast',email:'ACTOR@example.org'},{role:'Director',email:'actor@example.org'},{role:'Designer',email:'designer@example.org'}]}],reports:[{id:'r',production:'p',type:'Show',date:'2026-11-13',fields:{Props:'Repair chair'}}]};
  assert.equal((await post('/api/state',state)).status,200);
  assert.deepEqual(await (await fetch(base+'/api/state')).json(),state);
  assert.equal((await post('/api/send',{id:'r'})).status,200);
  assert.equal(delivered.length,2);
  assert.deepEqual(delivered[0].to,['manager@example.org']);
  assert.equal(delivered[0].bcc,undefined);
  assert.deepEqual(delivered[0].envelope.to,['manager@example.org','actor@example.org']);
  assert.deepEqual(delivered[1].cc,['designer@example.org']);
  assert(!delivered[1].envelope.to.includes('actor@example.org'));
  assert.match(delivered[1].text,/Repair chair/);
  fail=true;const result=await post('/api/send',{id:'r'});assert.equal(result.status,502);assert.match((await result.json()).error,/Accepted copies: Cast/);
 } finally {server.close();await once(server,'close');}
});
