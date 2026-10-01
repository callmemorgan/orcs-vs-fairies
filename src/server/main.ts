import { resolve } from 'node:path';
import { readFile } from 'node:fs/promises';
import { createRtsServer } from './server';

const server=await createRtsServer({
  host:process.env.RTS_HOST??'127.0.0.1',
  port:Number(process.env.RTS_PORT??8787),
  dataDir:resolve(process.env.RTS_DATA_DIR??'work/server'),
  staticDir:resolve(process.env.RTS_STATIC_DIR??'dist'),
  origin:process.env.RTS_ORIGIN,
  secureCookie:process.env.RTS_SECURE_COOKIE==='1',
  trustProxy:process.env.RTS_TRUST_PROXY==='1',
  spectatorDelaySeconds:Number(process.env.RTS_SPECTATOR_DELAY_SECONDS??30),
  tournaments:{cwd:process.cwd(),configs:[JSON.parse(await readFile(resolve('scripts/tournaments/smoke.json'),'utf8'))]}
});
console.log(`Orcs vs Fairies authoritative server: ${server.url}`);
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>{void server.close().then(()=>process.exit(0));});
