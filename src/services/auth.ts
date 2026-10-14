import { createClient } from '@supabase/supabase-js';
export interface NewPasswordChallenge {username:string;session:string;requiredAttributes:string[];}
export type SignInResult = {status:'signed_in'} | {status:'new_password_required';challenge:NewPasswordChallenge};
const env = (import.meta as any).env || {};
let client: ReturnType<typeof createClient> | undefined;
let accessToken: string | null = null;
function authClient() {
 if(!env.VITE_SUPABASE_URL || !env.VITE_SUPABASE_ANON_KEY) throw new Error('Supabase sign-in is not configured.');
 if(!client) {
  client=createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
  client.auth.onAuthStateChange((_event,session)=>{accessToken=session?.access_token || null;});
 }
 return client;
}
export function isPublicShareLocation(url:string) {
 const parsed=new URL(url,'https://ezway.local/');
 return Boolean(parsed.searchParams.get('token')?.trim() || parsed.searchParams.get('share')?.trim());
}
export async function signIn(email:string,password:string):Promise<SignInResult> {
 const {data,error}=await authClient().auth.signInWithPassword({email:email.trim(),password});
 if(error) throw error;
 accessToken=data.session?.access_token || null;
 return {status:'signed_in'};
}
export function getIdToken() {return accessToken;}
export async function restoreSession():Promise<boolean> {
 try {
  const {data,error}=await authClient().auth.getSession();
  if(error) return false;
  accessToken=data.session?.access_token || null;
  return Boolean(accessToken);
 } catch {return false;}
}
export function signOut() {accessToken=null; void authClient().auth.signOut({scope:'local'});}
export async function completeNewPassword(_challenge:NewPasswordChallenge,password:string) {
 const {error}=await authClient().auth.updateUser({password}); if(error) throw error;
}
