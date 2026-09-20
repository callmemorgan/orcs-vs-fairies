import Phaser from 'phaser';
import ArtRuntime from '../../src/game/ArtRuntime';
const failures: string[] = [];
let checked = 0;
let loaded = false;
class SceneryReview extends Phaser.Scene {
  art!: ArtRuntime;
  preload() {
    this.art = new ArtRuntime(this);
    this.art.preload([]);
    this.load.on('loaderror', (file: {key: string}) => failures.push(`load: ${file.key}`));
  }
  create() {
    this.art.ready();
    loaded = this.art.loaded;
    this.art.begin();
    const ids = Object.entries(this.art.manifest!.assets).filter(([,a])=>a.kind==='environment').map(([id])=>id);
    for (const [i,id] of ids.entries()) {
      const x=110+i%6*194,y=890+Math.floor(i/6)*240;
      const asset=this.art.manifest!.assets[id];
      if(!this.art.environment(`check:${id}`,id,x,y))failures.push(`placement: ${id}`);
      const source=this.textures.get(`env:${id}`).source[0];
      if(source.width!==asset.width||source.height!==asset.height)failures.push(`dimensions: ${id}`);
      let hit=false;
      for(let yy=0;yy<asset.height&&!hit;yy+=2)for(let xx=0;xx<asset.width;xx+=2) {
        if(this.art.contains(`check:${id}`,x-asset.anchor[0]+xx,y-asset.anchor[1]+yy)){hit=true;break;}
      }
      if(!hit)failures.push(`alpha: ${id}`);
      if(this.art.contains(`check:${id}`,x-asset.anchor[0]-2,y)!==false)failures.push(`bounds: ${id}`);
      this.add.text(x-90,y+52,id,{fontSize:'13px',color:'#e6e3ce'}).setDepth(2000);
      checked++;
    }
    // A small glade uses the same ground projection and depth ordering as gameplay.
    const project=(x:number,y:number)=>({x:590+(x-y)*32,y:245+(x+y)*16});
    for(let y=0;y<13;y++)for(let x=0;x<13;x++) {
      const p=project(x,y),path=Math.abs(y-6)<1.5;
      this.add.image(p.x,p.y,`env:${path?'tile-dirt-'+(x%3):'tile-grass-'+((x+y)%4)}`).setOrigin(.5).setDepth(-1000);
    }
    const props:[string,number,number][]=[['tree-oak',2,3],['tree-pine',4,2],['tree-pine',7,2],['tree-oak',10,3],['tree-pine',11,4],['tree-pine',2,10],['tree-oak',5,10],['tree-pine',9,10],['stump',7,7],['ore',10,7],['crystal',10,9],['flowers',3,7],['ruin-pillar',4,8],['reeds',8,8]];
    for(const [i,[id,x,y]] of props.entries()){const p=project(x,y);this.art.environment(`glade:${i}`,id,p.x,p.y);}
    this.art.end();
    this.add.text(28,20,'Forest clearing • native sprite scale',{fontSize:'20px',color:'#eee8d1'}).setDepth(2000);
    this.add.text(28,674,'All 22 scenery assets • native sprite scale',{fontSize:'20px',color:'#eee8d1'}).setDepth(2000);
    document.querySelector('#status')!.textContent=`${checked} scenery assets checked · ${failures.length} failures`;
  }
}
Object.defineProperty(window,'sceneryReview',{get:()=>({loaded,checked,failures})});
new Phaser.Game({type:Phaser.AUTO,parent:'canvas',width:1200,height:1690,backgroundColor:'#20352d',scene:SceneryReview,audio:{noAudio:true},fps:{forceSetTimeOut:true},render:{antialias:true}});
