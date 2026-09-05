export type GameCue = 'selection' | 'order' | 'attack' | 'build' | 'train' | 'victory' | 'defeat';
type Note = readonly [frequency:number, offset:number, duration:number, volume:number];
const PREFERENCE = 'orcs-vs-fairies.audio-muted';
const CUES:Record<GameCue,readonly Note[]> = {
  selection:[[520,0,.055,.14]],
  order:[[350,0,.065,.14],[465,.055,.07,.11]],
  attack:[[145,0,.07,.18],[92,.025,.065,.12]],
  build:[[392,0,.13,.15],[494,.08,.13,.13],[587,.16,.16,.12]],
  train:[[523,0,.10,.14],[698,.09,.17,.13]],
  victory:[[392,0,.20,.14],[494,.12,.20,.13],[587,.24,.30,.13]],
  defeat:[[330,0,.20,.14],[294,.14,.20,.13],[220,.28,.28,.13]],
};

/** Quiet procedural cues. A trusted input gesture must create/resume the graph. */
export default class GameAudio {
  private context?:AudioContext;
  private master?:GainNode;
  private analyser?:AnalyserNode;
  private waveform = new Float32Array(256);
  private voices = new Set<OscillatorNode>();
  private lastCue = new Map<GameCue,number>();
  private scheduledCues:Partial<Record<GameCue,number>> = {};
  private unavailable = false;
  private disposed = false;
  private animationFrame:number|undefined;
  private currentPeak = 0;
  private currentRms = 0;
  private lastSignalPeak = 0;
  private lastSignalRms = 0;
  private lastSignalAt:number|null = null;
  private _muted = false;
  private readonly gesture = (event:Event) => { if(event.isTrusted)this.unlock(); };

  constructor(){
    try{this._muted=localStorage.getItem(PREFERENCE)==='true';}catch{/* Storage may be disabled. */}
    if(typeof document!=='undefined'){
      document.addEventListener('pointerdown',this.gesture,true);
      document.addEventListener('keydown',this.gesture,true);
    }
  }

  get muted(){return this._muted;}
  toggleMuted(){
    this._muted=!this._muted;
    try{localStorage.setItem(PREFERENCE,String(this._muted));}catch{/* Keep the session preference. */}
    const context=this.context;
    if(context&&this.master){
      this.master.gain.cancelScheduledValues(context.currentTime);
      this.master.gain.setTargetAtTime(this._muted?0:.12,context.currentTime,.005);
      if(this._muted)for(const voice of this.voices){try{voice.stop(context.currentTime+.006);}catch{/* Already stopped. */}}
    }
    return this._muted;
  }

  private unlock(){
    if(this.disposed||this.unavailable)return;
    try{
      if(!this.context){
        const AudioConstructor=window.AudioContext??(window as Window&{webkitAudioContext?:typeof AudioContext}).webkitAudioContext;
        if(!AudioConstructor){this.unavailable=true;return;}
        this.context=new AudioConstructor();
        this.master=this.context.createGain();this.master.gain.value=this._muted?0:.12;
        this.analyser=this.context.createAnalyser();this.analyser.fftSize=256;
        this.master.connect(this.analyser);this.analyser.connect(this.context.destination);
      }
      if(this.context.state==='suspended')void this.context.resume().catch(()=>{/* A later gesture can retry. */});
    }catch{this.unavailable=true;}
  }

  play(cue:GameCue){
    const context=this.context;
    if(this.disposed||this._muted||!context||context.state!=='running'||!this.master)return;
    const now=context.currentTime;
    const interval=cue==='attack'?.18:cue==='selection'?.075:cue==='order'?.10:.3;
    if(now-(this.lastCue.get(cue)??-Infinity)<interval)return;
    this.lastCue.set(cue,now);
    try{
      for(const [frequency,offset,duration,volume] of CUES[cue]){
        const oscillator=context.createOscillator(),gain=context.createGain();
        oscillator.type=cue==='attack'?'triangle':'sine';
        oscillator.frequency.setValueAtTime(frequency,now+offset);
        if(cue==='attack')oscillator.frequency.exponentialRampToValueAtTime(frequency*.65,now+offset+duration);
        gain.gain.setValueAtTime(0,now+offset);
        gain.gain.linearRampToValueAtTime(volume,now+offset+.008);
        gain.gain.exponentialRampToValueAtTime(.0001,now+offset+duration);
        oscillator.connect(gain);gain.connect(this.master);this.voices.add(oscillator);
        oscillator.onended=()=>{this.voices.delete(oscillator);oscillator.disconnect();gain.disconnect();};
        oscillator.start(now+offset);oscillator.stop(now+offset+duration+.015);
      }
      this.scheduledCues[cue]=(this.scheduledCues[cue]??0)+1;
      this.monitor();
    }catch{/* Audio failure must not interrupt the game. */}
  }

  /** Keep restart from overlapping the previous match's result chord. */
  reset(){
    for(const voice of this.voices){try{voice.stop();}catch{/* Already ended. */}}
    this.lastCue.clear();
  }

  private measure(){
    if(!this.analyser)return;
    this.analyser.getFloatTimeDomainData(this.waveform);
    let peak=0,squares=0;
    for(const value of this.waveform){peak=Math.max(peak,Math.abs(value));squares+=value*value;}
    this.currentPeak=peak;this.currentRms=Math.sqrt(squares/this.waveform.length);
    if(peak>.00001){this.lastSignalPeak=peak;this.lastSignalRms=this.currentRms;this.lastSignalAt=Date.now();}
  }
  private monitor(){
    if(this.animationFrame!==undefined||this.disposed)return;
    this.animationFrame=requestAnimationFrame(()=>{
      this.animationFrame=undefined;this.measure();
      if(this.voices.size)this.monitor();
    });
  }
  get status(){
    this.measure();
    return {
      state:this.context?.state??(this.unavailable?'unavailable':this.disposed?'closed':'locked'),
      muted:this._muted,scheduledCues:{...this.scheduledCues},activeVoices:this.voices.size,
      currentPeak:this.currentPeak,currentRms:this.currentRms,
      lastSignalPeak:this.lastSignalPeak,lastSignalRms:this.lastSignalRms,lastSignalAt:this.lastSignalAt,
    };
  }
  dispose(){
    if(this.disposed)return;this.disposed=true;
    document.removeEventListener('pointerdown',this.gesture,true);document.removeEventListener('keydown',this.gesture,true);
    if(this.animationFrame!==undefined)cancelAnimationFrame(this.animationFrame);
    this.reset();this.master?.disconnect();this.analyser?.disconnect();
    if(this.context&&this.context.state!=='closed')void this.context.close().catch(()=>{});
  }
}
