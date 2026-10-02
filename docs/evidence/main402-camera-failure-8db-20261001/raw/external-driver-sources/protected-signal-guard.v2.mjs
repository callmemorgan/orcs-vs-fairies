import { readFileSync, readdirSync, readlinkSync } from 'node:fs';
import { ChildProcess } from 'node:child_process';
const identity = pid => {
  try { const value = readFileSync(`/proc/${pid}/stat`, 'utf8').split(') ')[1].split(/\s+/);
    return { pid: Number(pid), ppid: Number(value[1]), startTicks: Number(value[19]) }; }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
};
function protect() {
  const protectedProcess = identity(1063);
  if (!protectedProcess || protectedProcess.startTicks !== 874) throw Error('Protected preview PID/start changed before signal');
  const inodes = [];
  for (const table of ['tcp', 'tcp6']) for (const line of readFileSync(`/proc/net/${table}`, 'utf8').trim().split('\n').slice(1)) {
    const value = line.trim().split(/\s+/);
    if (parseInt(value[1].split(':').at(-1), 16) === 4173 && value[3] === '0A') inodes.push(value[9]);
  }
  if (inodes.length !== 1 || inodes[0] !== '3783') throw Error('Known protected4173 listener inode changed before signal');
  const sockets = new Map();
  for (const fd of readdirSync('/proc/1063/fd')) try { sockets.set(fd, readlinkSync(`/proc/1063/fd/${fd}`)); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (sockets.get('22') !== 'socket:[3783]') throw Error('Known protected4173 fd22 ownership changed before signal');
}
const remembered = new Map();
function owned(pid) {
  if (!Number.isInteger(pid) || pid <= 0 || pid === 1063) throw Error('Only one exact owned positive child PID can be signaled');
  const initial = identity(pid); if (!initial) return null;
  let parent = initial; const seen = new Set();
  while (parent && parent.ppid !== process.pid) {
    if (seen.has(parent.pid)) throw Error('Process ancestry cycle'); seen.add(parent.pid); parent = identity(parent.ppid);
  }
  if (!parent) throw Error(`Refusing non-owned signal target ${pid}`);
  const previous = remembered.get(pid);
  if (previous !== undefined && previous !== initial.startTicks) throw Error('Owned signal PID reused');
  remembered.set(pid, initial.startTicks); return initial;
}
function current(bound) {
  const live = identity(bound.pid);
  if (!live || live.startTicks !== bound.startTicks) throw Error('Owned signal target disappeared or was reused');
}
const rawKill = process.kill.bind(process);
process.kill = function (pid, signal) {
  const bound = owned(pid);
  if (!bound) { const error = new Error(`Owned signal target ${pid} no longer exists`); error.code = 'ESRCH'; throw error; }
  protect(); current(bound); return rawKill(pid, signal);
};
const childKill = ChildProcess.prototype.kill;
ChildProcess.prototype.kill = function (signal) {
  if (!this.pid) return false;
  const bound = owned(this.pid); if (!bound) return false;
  protect(); current(bound); return childKill.call(this, signal);
};
protect();
