export type PaletteId = 'default' | 'deuteranopia' | 'tritanopia';
export interface AppearanceSettings { palette:PaletteId; patterns:boolean; outlines:boolean }
export type OwnershipRelation = 'own' | 'ally' | 'enemy';
export const APPEARANCE_STORAGE_KEY = 'ovf.appearance.v1';
export const DEFAULT_APPEARANCE:Readonly<AppearanceSettings> = Object.freeze({palette:'default',patterns:true,outlines:true});
export const PALETTES:Record<PaletteId,readonly number[]> = {
  default:[0xb9e493,0xf08572,0x76c9ef,0xeacb66,0xc69ee8,0x67d5ca,0xf3aad1,0xd1d4d9],
  deuteranopia:[0x56b4e9,0xe69f00,0xf0e442,0x0072b2,0xcc79a7,0x009e73,0xd55e00,0xdddddd],
  tritanopia:[0x2ccdb4,0xf06e86,0xb8e986,0xb688df,0xf1b577,0x75bada,0xf2d1df,0xd9d9d9],
};
type PreferenceStorage = Pick<Storage,'getItem'|'setItem'>;
function browserStorage():PreferenceStorage|null {try{return typeof localStorage==='undefined'?null:localStorage;}catch{return null;}}
function validPalette(value:unknown):value is PaletteId {return value==='default'||value==='deuteranopia'||value==='tritanopia';}

/** Presentation preferences never enter GameState, saves, replays or state hashes. */
export class AppearancePreferences {
  private settings:AppearanceSettings={...DEFAULT_APPEARANCE};
  private listeners=new Set<(settings:AppearanceSettings)=>void>();
  constructor(private storage:PreferenceStorage|null=browserStorage()) {
    try {
      const saved=JSON.parse(storage?.getItem(APPEARANCE_STORAGE_KEY)??'null');
      if(saved&&saved.version===1&&validPalette(saved.palette)&&typeof saved.patterns==='boolean'&&typeof saved.outlines==='boolean')this.settings={palette:saved.palette,patterns:saved.patterns,outlines:saved.outlines};
    }catch{/* A denied or corrupt preference does not prevent a match from loading. */}
  }
  get value():AppearanceSettings {return {...this.settings};}
  set(patch:Partial<AppearanceSettings>):void {
    if(patch.palette!==undefined&&!validPalette(patch.palette))throw new Error('Unknown faction palette.');
    for(const key of ['patterns','outlines'] as const)if(patch[key]!==undefined&&typeof patch[key]!=='boolean')throw new Error(`${key} must be a boolean.`);
    const next={palette:patch.palette??this.settings.palette,patterns:patch.patterns??this.settings.patterns,outlines:patch.outlines??this.settings.outlines};
    if(next.palette===this.settings.palette&&next.patterns===this.settings.patterns&&next.outlines===this.settings.outlines)return;
    this.settings=next;
    try{this.storage?.setItem(APPEARANCE_STORAGE_KEY,JSON.stringify({version:1,...next}));}catch{/* Continue with preferences for this session. */}
    for(const listener of this.listeners)listener(this.value);
  }
  reset(){this.set({...DEFAULT_APPEARANCE});}
  subscribe(listener:(settings:AppearanceSettings)=>void){this.listeners.add(listener);return ()=>{this.listeners.delete(listener);};}
}
export const appearancePreferences=new AppearancePreferences();

export function ownershipRelation(side:number,viewer:number,teams?:readonly number[]):OwnershipRelation {
  if(side===viewer)return 'own';
  return teams?.[side]!==undefined&&teams[side]===teams[viewer]?'ally':'enemy';
}
export function ownershipStyle(side:number,viewer:number,settings:AppearanceSettings,teams?:readonly number[]) {
  const shape=((Math.trunc(side)%8)+8)%8,color=PALETTES[settings.palette][shape],relation=ownershipRelation(side,viewer,teams);
  const outline=relation==='own'?0xffffff:relation==='ally'?0x78dfff:0xffc15b;
  return {color,css:`#${color.toString(16).padStart(6,'0')}`,outline,outlineCss:`#${outline.toString(16).padStart(6,'0')}`,relation,shape};
}
const SHAPES:ReadonlyArray<ReadonlyArray<readonly [number,number]>> = [
  [[0,-1],[1,0],[0,1],[-1,0]],
  [[-1,-1],[1,-1],[1,1],[-1,1]],
  [[0,-1],[1,.8],[-1,.8]],
  [[-.5,-1],[.5,-1],[1,0],[.5,1],[-.5,1],[-1,0]],
  [[0,-1],[.95,-.3],[.6,1],[-.6,1],[-.95,-.3]],
  [[-1,-.8],[1,-.8],[0,1]],
  [[-.35,-1],[.35,-1],[.35,-.35],[1,-.35],[1,.35],[.35,.35],[.35,1],[-.35,1],[-.35,.35],[-1,.35],[-1,-.35],[-.35,-.35]],
  [[0,-1],[.3,-.3],[1,0],[.3,.3],[0,1],[-.3,.3],[-1,0],[-.3,-.3]],
];
export function markerPolygon(side:number,x:number,y:number,size:number):Array<{x:number;y:number}> {
  return SHAPES[((Math.trunc(side)%8)+8)%8].map(([dx,dy])=>({x:x+dx*size,y:y+dy*size}));
}
