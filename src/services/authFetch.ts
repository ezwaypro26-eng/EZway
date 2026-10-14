import { getIdToken, restoreSession } from './auth';
const originalFetch = window.fetch.bind(window);
window.fetch = async (input, init) => {
 const url = new URL(input instanceof Request ? input.url : String(input), window.location.href);
 if (url.origin === window.location.origin && url.pathname.startsWith('/api/') && !url.pathname.startsWith('/api/data/public/')) {
  await restoreSession();
  const headers = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined));
  const token = getIdToken();
  if (token && !headers.has('authorization')) headers.set('authorization', `Bearer ${token}`);
  return originalFetch(input, {...init, headers});
 }
 return originalFetch(input,init);
};
