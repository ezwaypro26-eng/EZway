import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { bind } from './db.mjs';
import { requireOwner } from './middleware.mjs';
import { presignUpload, presignRead, resolveMediaObjectKey } from './storage.mjs';

test('Postgres bindings preserve casts and keep values out of SQL',()=>{
 const value="x'); DROP TABLE tracks; --";
 assert.deepEqual(bind('SELECT :name, :name, COUNT(*)::int',[{name:'name',value}]),{text:'SELECT $1, $2, COUNT(*)::int',values:[value,value]});
 assert.throws(()=>bind('SELECT :missing'),/Missing SQL parameter/);
});
test('auth fails closed, validates owner, and storage keeps uploads private', async()=>{
 const calls=[];
 const server=http.createServer((req,res)=>{
  calls.push({url:req.url,authorization:req.headers.authorization});
  res.setHeader('content-type','application/json');
  if(req.url==='/auth/v1/user') {
   if(req.headers.authorization==='Bearer valid-owner') return res.end(JSON.stringify({id:'owner-uuid',aud:'authenticated',role:'authenticated',email:'owner@example.com'}));
   if(req.headers.authorization==='Bearer valid-other') return res.end(JSON.stringify({id:'other-uuid',aud:'authenticated',role:'authenticated'}));
   res.statusCode=401; return res.end(JSON.stringify({message:'invalid token'}));
  }
  if(req.url.startsWith('/storage/v1/object/upload/sign/')) return res.end(JSON.stringify({url:req.url.replace('/storage/v1','')+'?token=upload-token'}));
  if(req.url.startsWith('/storage/v1/object/sign/')) return res.end(JSON.stringify({signedURL:req.url.replace('/storage/v1','')+'?token=read-token'}));
  res.statusCode=404; res.end('{}');
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 process.env.SUPABASE_URL=`http://127.0.0.1:${server.address().port}`;
 process.env.SUPABASE_SERVICE_ROLE_KEY='test-server-key';
 const check=async(token)=>{
  let status=200, passed=false;
  const res={status(n){status=n;return this;},json(){return this;}};
  await requireOwner({headers:{authorization:token ? `Bearer ${token}`:''}},res,()=>{passed=true;});
  return {status,passed};
 };
 try {
  delete process.env.OWNER_USER_IDS;
  assert.deepEqual(await check('valid-owner'),{status:503,passed:false});
  process.env.OWNER_USER_IDS='owner-uuid';
  assert.equal((await check()).status,401);
  assert.equal((await check('invalid')).status,401);
  assert.equal((await check('valid-other')).status,403);
  assert.equal((await check('valid-owner')).passed,true);
  const upload=await presignUpload({category:'tracks',relatedId:'track-1',filename:'song.mp3',contentType:'audio/mpeg',size:100});
  assert.match(upload.upload_url,/object\/upload\/sign\/ezway-media\/tracks\/audio\/track-1\/.+token=upload-token/);
  assert.equal(upload.read_url,''); // Read URL is requested only AFTER upload completes.
  assert.equal(calls.some(c=>c.url.startsWith('/storage/v1/object/sign/')),false);
  const read=await presignRead(upload.object_key);
  assert.match(read,/token=read-token/);
  assert.equal(resolveMediaObjectKey({url:read}),upload.object_key);
  assert.throws(()=>resolveMediaObjectKey({objectKey:'../secret'}),/invalid/);
  assert.throws(()=>resolveMediaObjectKey({url:'https://other.example/storage/v1/object/sign/ezway-media/tracks/audio/secret'}),/invalid/);
 } finally {await new Promise(resolve=>server.close(resolve));}
});
