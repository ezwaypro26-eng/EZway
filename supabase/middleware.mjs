import { supabase } from './client.mjs';
import { handler } from './handler.mjs';
export async function requireOwner(req,res,next) {
 try {
  const allowed=String(process.env.OWNER_USER_IDS||'').split(',').map(x=>x.trim()).filter(Boolean);
  if(!allowed.length) return res.status(503).json({error:'Configure OWNER_USER_IDS in Render.'});
  const token=String(req.headers.authorization||'').replace(/^Bearer /i,'');
  if(!token) return res.status(401).json({error:'Sign in required.'});
  const {data,error}=await supabase().auth.getUser(token);
  if(error || !data.user) return res.status(401).json({error:'Session expired. Sign in again.'});
  if(!allowed.includes(data.user.id)) return res.status(403).json({error:'Owner access required.'});
  next();
 } catch {res.status(503).json({error:'Authentication service unavailable.'});}
}
export async function dataApi(req,res) {
 const result=await handler({rawPath:req.path,headers:req.headers,requestContext:{http:{method:req.method}},body:req.body ? JSON.stringify(req.body):''});
 res.status(result.statusCode).type('json').send(result.body);
}
export function mountDataApi(app) {
 app.use('/api/data', (req,res,next)=>{
  if(req.path==='/health' || /^\/public\/share\/[^/]+(?:\/|$)/.test(req.path)) return next();
  return requireOwner(req,res,next);
 }, dataApi);
 // Protect the existing provider endpoints too; public share traffic uses /api/data only.
 app.use('/api', (req,res,next)=>req.path==='/health' ? next() : requireOwner(req,res,next));
}
