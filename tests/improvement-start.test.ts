// @vitest-environment happy-dom
import { expect, it, vi } from 'vitest';
import type { GameState } from '../src/core/types';
import type { ClientContext } from '../src/improvements/host';

const fixture=vi.hoisted(()=>({
  start:undefined as undefined|((...args:unknown[])=>void),
  scene:undefined as undefined|{ready:boolean;options:{onReady?:()=>void};centerOn:ReturnType<typeof vi.fn>},
  ready:vi.fn(),matchStart:vi.fn()
}));
vi.mock('phaser',()=>({default:{AUTO:0,Scale:{FIT:0},Core:{Events:{DESTROY:'destroy'}},Game:class {
  scale={setGameSize:vi.fn()};events={once:vi.fn()};
}}}));
vi.mock('../src/game/GameScene',()=>({
  project:(x:number,y:number)=>({x,y}),unproject:(x:number,y:number)=>({x,y}),
  default:class {
    state:GameState;selected:number[]=[];paused=false;ready=false;
    centerOn=vi.fn(()=>{if(!this.ready)throw new Error('Camera is not ready');});
    constructor(public options:{state:GameState;onReady?:()=>void}){this.state=options.state;fixture.scene=this;}
  }
}));
vi.mock('../src/ui/Hud',()=>({mountShell:(_root:HTMLElement,start:(...args:unknown[])=>void)=>{
  fixture.start=start;
  return {showGame:vi.fn(),ready:fixture.ready,update:vi.fn(),notice:vi.fn(),setPaused:vi.fn(),battlefieldBounds:()=>({top:0,bottom:600})};
}}));
vi.mock('../src/improvements/learning/client',()=>({default:[{id:'ready-test',mount:(context:ClientContext)=>({matchStart:()=>{context.center(2,3);fixture.matchStart();}})}]}));

it('lets a match-start client center the camera only after the scene becomes ready',async()=>{
  vi.useFakeTimers();
  document.body.innerHTML='<div id="app"><div class="menu-content"></div><div class="war-hud"></div></div>';
  try{
    await import('../src/main');
    fixture.start!('orcs','fairies','medium',4127);
    expect(fixture.matchStart).not.toHaveBeenCalled();expect(fixture.ready).not.toHaveBeenCalled();
    fixture.scene!.ready=true;
    expect(()=>fixture.scene!.options.onReady?.()).not.toThrow();
    expect(fixture.ready).toHaveBeenCalledTimes(1);expect(fixture.matchStart).toHaveBeenCalledTimes(1);
    expect(fixture.scene!.centerOn).toHaveBeenCalledWith(2,3);
  }finally{vi.clearAllTimers();vi.useRealTimers();document.body.replaceChildren();}
});
