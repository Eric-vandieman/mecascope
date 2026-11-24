import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/session.mjs';
for(const [name,method,origin,expected] of [
 ['lecture interdite','GET','https://exemple.test',405],
 ['origine étrangère','POST','https://autre.test',403],
 ['configuration absente','POST','https://exemple.test',503]
]){
 test(name,async()=>{
   delete process.env.SUPABASE_URL;
   const res={setHeader(){},status(code){this.code=code;return this},end(){},json(){}};
   await handler({method,headers:{origin,host:'exemple.test'}},res);
   assert.equal(res.code,expected);
 });
}
