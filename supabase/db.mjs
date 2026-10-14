import pg from 'pg';
let pool;
function getPool() {
 if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.');
 const connection = new URL(process.env.DATABASE_URL);
 for (const key of ['sslmode','sslcert','sslkey','sslrootcert']) connection.searchParams.delete(key);
 return pool ||= new pg.Pool({connectionString: connection.toString(), max:5, connectionTimeoutMillis:10000,
 ssl:{rejectUnauthorized:true, ...(process.env.DATABASE_CA_CERT ? {ca:process.env.DATABASE_CA_CERT.replace(/\\n/g,'\n')} : {})}});
}
export function bind(sql, params=[]) {
 const values=[]; const named=new Map(params.map(p=>[p.name,p.value]));
 const text=sql.replace(/(?<!:):([A-Za-z_][A-Za-z0-9_]*)/g, (_,name)=>{
  if (!named.has(name)) throw new Error('Missing SQL parameter: '+name);
  values.push(named.get(name)); return '$'+values.length;
 });
 return {text,values};
}
export async function execute(sql,params=[]) {
 const {text,values}=bind(sql,params);
 const result=await getPool().query(text,values);
 return JSON.parse(JSON.stringify(result.rows));
}
export async function executeTransaction(statements) {
 const client=await getPool().connect();
 try { await client.query('BEGIN');
  for(const stmt of statements) {const q=bind(stmt.sql,stmt.params); await client.query(q.text,q.values);}
  await client.query('COMMIT');
 } catch(error) {await client.query('ROLLBACK'); throw error;} finally {client.release();}
}
