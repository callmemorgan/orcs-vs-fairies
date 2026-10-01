// @vitest-environment happy-dom
import {afterEach,describe,expect,it,vi} from 'vitest';
import {mountOnlineLobby} from '../src/ui/OnlineLobby';
import {OnlineApi,OnlineRequestError} from '../src/online/client';
import type {LobbyObservation} from '../src/online/protocol';

const mounted:Array<ReturnType<typeof mountOnlineLobby>>=[];
afterEach(()=>{for(const view of mounted.splice(0))view.dispose();document.body.replaceChildren();vi.useRealTimers();});
const account={id:'a1',username:'Morgan'};
const lobby=():LobbyObservation=>({id:'lobby-1',hostId:'a1',revision:3,settings:{mapSize:'medium',factions:['orcs','fairies']},seats:[{side:0,account,ready:false},{side:1,account:{id:'a2',username:'Other'},ready:true}],matchId:null});
function setup(signedIn=true) {
  const api=new OnlineApi(),current=lobby();
  vi.spyOn(api,'session').mockResolvedValue(signedIn?account:null);vi.spyOn(api,'guest').mockResolvedValue({id:'guest1',username:'Guest-server-issued'});
  vi.spyOn(api,'logout').mockResolvedValue();vi.spyOn(api,'lobbies').mockImplementation(async()=>[structuredClone(current)]);
  vi.spyOn(api,'createLobby').mockImplementation(async settings=>{current.settings=settings;return structuredClone(current);});
  vi.spyOn(api,'lobby').mockImplementation(async()=>structuredClone(current));
  vi.spyOn(api,'changeLobby').mockImplementation(async(_lobby,action,value)=>{
    current.revision++;if(action==='ready')current.seats[0].ready=value?.ready as boolean;
    if(action==='settings'){current.settings=value!.settings as typeof current.settings;current.seats.forEach(seat=>{seat.ready=false;});}
    if(action==='start')current.matchId='match-1';
    return structuredClone(current);
  });
  const root=document.createElement('div');document.body.append(root);const onJoinMatch=vi.fn(),onVisibility=vi.fn();
  const view=mountOnlineLobby(root,{api,onJoinMatch,onVisibility,pollIntervalMs:50});mounted.push(view);
  return {root,api,current,view,onJoinMatch,onVisibility};
}
function button(root:ParentNode,label:string|RegExp){const found=Array.from(root.querySelectorAll<HTMLButtonElement>('button')).find(node=>typeof label==='string'?node.textContent===label:label.test(node.getAttribute('aria-label')??node.textContent??''));expect(found).toBeDefined();return found!;}
function submit(root:ParentNode,selector:string){root.querySelector(selector)!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));}

describe('server-backed online lobby UI',()=>{
  it('obtains a guest account from the server and never invents browser identity',async()=>{
    const {view,root,api,onVisibility}=setup(false);await view.show();expect(root.querySelector('.online-auth')!.hasAttribute('hidden')).toBe(false);
    button(root,'Play as guest').click();await vi.waitFor(()=>expect(view.account?.username).toBe('Guest-server-issued'));
    expect(api.guest).toHaveBeenCalledTimes(1);expect(root.textContent).toContain('Guest-server-issued');expect(onVisibility).toHaveBeenCalledWith(true);
    button(root,'Close').click();expect(view.visible).toBe(false);expect(onVisibility).toHaveBeenLastCalledWith(false);
  });
  it('creates, configures, readies and starts with current server revisions',async()=>{
    const {view,root,api,onJoinMatch}=setup();await view.show();submit(root,'.online-create');
    await vi.waitFor(()=>expect(view.currentLobby?.revision).toBe(3));
    expect(api.createLobby).toHaveBeenCalledWith({mapSize:'medium',factions:['orcs','fairies'],players:[{factionId:'orcs',teamId:0,controller:'human'},{factionId:'fairies',teamId:1,controller:'human'}],sharedVision:true,startingAge:1});
    const size=root.querySelector<HTMLSelectElement>('[aria-label="Current lobby map size"]')!;size.value='large';size.dispatchEvent(new Event('change',{bubbles:true}));submit(root,'.online-configure');
    await vi.waitFor(()=>expect(view.currentLobby?.revision).toBe(4));expect(api.changeLobby).toHaveBeenCalledWith(expect.objectContaining({revision:3}),'settings',{settings:expect.objectContaining({mapSize:'large',factions:['orcs','fairies'],sharedVision:true,startingAge:1})});
    button(root,'Ready').click();await vi.waitFor(()=>expect(view.currentLobby?.revision).toBe(5));expect(api.changeLobby).toHaveBeenCalledWith(expect.objectContaining({revision:4}),'ready',{ready:true});
    expect(button(root,'Start match').disabled).toBe(true); // Other player was un-readied by settings.
    const current=view.currentLobby!;current.seats[1].ready=true;
    // A refresh reports the other player's server-issued readiness.
    vi.mocked(api.lobbies).mockResolvedValue([current]);await view.refresh();expect(button(root,'Start match').disabled).toBe(false);
    button(root,'Start match').click();await vi.waitFor(()=>expect(onJoinMatch).toHaveBeenCalledWith({matchId:'match-1',role:'player'}));expect(view.visible).toBe(false);
  });
  it('keeps a rejected revision visible and refreshes rather than replaying the action',async()=>{
    const {view,root,api}=setup();await view.show();button(root,/View lobby lobby-1/).click();await vi.waitFor(()=>expect(view.currentLobby).not.toBeNull());
    vi.mocked(api.changeLobby).mockRejectedValueOnce(new OnlineRequestError(409,'Lobby changed. Refresh its current revision.'));
    button(root,'Ready').click();await vi.waitFor(()=>expect(root.querySelector('[role="status"]')!.textContent).toContain('Lobby changed'));
    expect(api.changeLobby).toHaveBeenCalledTimes(1);expect(view.currentLobby?.revision).toBe(3);expect(view.visible).toBe(true);
  });
  it('passes the requested spectator perspective and preserves a failed join in the open modal',async()=>{
    const {view,root,onJoinMatch}=setup();await view.show();
    root.querySelector<HTMLInputElement>('[aria-label="Spectator match ID"]')!.value='m-actual';root.querySelector<HTMLSelectElement>('[aria-label="Spectator perspective"]')!.value='1';
    onJoinMatch.mockRejectedValueOnce(new Error('Match not found.'));submit(root,'.online-spectate');
    await vi.waitFor(()=>expect(root.querySelector('[role="status"]')!.textContent).toContain('Match not found.'));
    expect(onJoinMatch).toHaveBeenCalledWith({matchId:'m-actual',role:'spectator',perspective:1,view:'player'});expect(view.visible).toBe(true);
  });
  it('ignores a stale poll after sign out and stops unauthorized polling',async()=>{
    const {view,root,api}=setup();await view.show();
    let resolve:(value:LobbyObservation[])=>void=()=>{};vi.mocked(api.lobbies).mockImplementationOnce(()=>new Promise(done=>{resolve=done;}));
    const pending=view.refresh();button(root,'Sign out').click();await vi.waitFor(()=>expect(view.account).toBeNull());resolve([lobby()]);await pending;
    expect(view.currentLobby).toBeNull();expect(root.querySelector('.online-browser')!.hasAttribute('hidden')).toBe(true);
  });
  it('allows battlefield key propagation after closing the modal',async()=>{
    const {view,root}=setup();await view.show();view.hide();const listener=vi.fn();window.addEventListener('keydown',listener);
    button(root,'Online').dispatchEvent(new KeyboardEvent('keydown',{key:'R',bubbles:true}));expect(listener).toHaveBeenCalledTimes(1);window.removeEventListener('keydown',listener);
  });
  it('submits multiple teams, AI slots and handicaps from the visible settings',async()=>{
    const {view,root,api}=setup();await view.show();const count=root.querySelector<HTMLSelectElement>('[aria-label="Lobby player count"]')!;count.value='4';count.dispatchEvent(new Event('change',{bubbles:true}));
    expect(root.querySelectorAll('.online-create [data-player]')).toHaveLength(4);
    root.querySelector<HTMLSelectElement>('[aria-label="Lobby player 3 team"]')!.value='0';root.querySelector<HTMLSelectElement>('[aria-label="Lobby player 4 team"]')!.value='1';
    root.querySelector<HTMLSelectElement>('[aria-label="Lobby player 3 controller"]')!.value='ai';root.querySelector<HTMLSelectElement>('[aria-label="Lobby player 4 controller"]')!.value='ai';
    root.querySelector<HTMLInputElement>('[aria-label="Lobby player 1 income multiplier"]')!.value='1.5';root.querySelector<HTMLInputElement>('[aria-label="Lobby player 1 population limit"]')!.value='180';
    root.querySelector<HTMLInputElement>('[aria-label="Lobby shared vision"]')!.checked=false;submit(root,'.online-create');
    await vi.waitFor(()=>expect(api.createLobby).toHaveBeenCalledTimes(1));expect(api.createLobby).toHaveBeenCalledWith(expect.objectContaining({sharedVision:false,players:[{factionId:'orcs',teamId:0,controller:'human',handicap:{incomeFactor:1.5,populationCap:180}},{factionId:'fairies',teamId:1,controller:'human'},{factionId:'orcs',teamId:0,controller:'ai'},{factionId:'fairies',teamId:1,controller:'ai'}]}));
  });
});
