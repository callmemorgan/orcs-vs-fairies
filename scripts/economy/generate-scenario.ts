import fs from 'node:fs';
import { createMatch, issueCommand, refreshVisibility, stepGame } from '../../src/core/simulation';
import { ensureEconomy } from '../../src/core/economy';
import { createSessionFile } from '../../src/core/session-storage';
import type { Entity, ResourceKind } from '../../src/core/types';
const s=createMatch({map:{seed:4127,size:'small'},players:[{id:0,teamId:0,factionId:'orcs',controller:'external',handicap:{startingResources:{wood:12000,ore:12000,crystal:1000},populationCap:100}},{id:1,teamId:1,factionId:'fairies',controller:'external',handicap:{startingResources:{wood:12000,ore:12000,crystal:1000},populationCap:100}}],rules:{startingAge:3}});
s.terrain.fill('grass');s.resources=[];
const economy=ensureEconomy(s),workers=(side=0)=>s.entities.filter(e=>e.side===side&&e.kind==='unit'&&e.role==='worker'&&!economy.caravans.includes(e.id));
const run=(seconds:number)=>{for(let i=0;i<seconds*20;i++)stepGame(s,.05);};
const accept=(side:0|1,c:Parameters<typeof issueCommand>[2])=>{if(!issueCommand(s,side,c))throw new Error(`Scenario command rejected: ${JSON.stringify(c)}`);};
function building(side:0|1,x:number,y:number,kind:'warehouse'|'hq'):Entity{const w=workers(side)[0];w.x=x-2;w.y=y+3;refreshVisibility(s);if(kind==='hq')accept(side,{type:'build',ids:[w.id],role:'hq',x,y});else accept(side,{type:'buildEconomy',ids:[w.id],kind,x,y});const e=s.entities.at(-1)!;run(65);if(e.progress<1)throw new Error(`${kind} construction incomplete`);return e;}
const warehouse=building(0,13.5,12.5,'warehouse');building(0,9.5,24.5,'hq');
function resource(kind:ResourceKind,x:number,y:number,amount:number,maxAmount=amount){const r={id:s.nextId++,x,y,kind,amount,maxAmount};s.resources.push(r);return r;}
const crystal=resource('crystal',20.5,7.5,800),builder=workers()[0];builder.x=19;builder.y=9;refreshVisibility(s);accept(0,{type:'buildEconomy',ids:[builder.id],kind:'extractor',target:crystal.id});run(60);
const originalHQ=s.entities.find(e=>e.side===0&&e.role==='hq')!;for(let i=0;i<3;i++)accept(0,{type:'trainCaravan',id:originalHQ.id});run(60);
const hostile=building(1,25.5,16.5,'warehouse');
// This authored scenario supplies finite local stock, salvage, ore history and freshly issued contracts.
// Construction and caravan recruitment above went through paid public commands.
economy.structures.find(item=>item.entityId===warehouse.id)!.stock={wood:100,ore:30,crystal:0};
economy.structures.find(item=>item.entityId===hostile.id)!.stock={wood:80,ore:20,crystal:0};
resource('ore',16.5,3.5,0,1600);resource('crystal',19.5,15.5,600);
economy.salvage.push({id:s.nextId++,x:7.5,y:15.5,stock:{wood:30,ore:20,crystal:0},expiresAt:s.time+120,owner:null,kind:'salvage'});
for(const contract of economy.contracts){contract.status='open';contract.side=null;contract.delivered=0;contract.deadline=s.time+180;}
for(const [i,w] of workers().entries()){const positions=[{x:7.5,y:11.5},{x:3.5,y:7.5},{x:16.5,y:5.5},{x:18.5,y:17.5},{x:6.5,y:15.5}];Object.assign(w,positions[i]??positions[0]);w.order={type:'idle'};w.path=[];w.carried=0;}
const soldier=s.entities.find(e=>e.side===0&&e.kind==='unit'&&e.role==='melee')!;soldier.x=21.5;soldier.y=16.5;soldier.order={type:'hold'};
const market=economy.markets[0];workers()[3].x=market.x;workers()[3].y=market.y+1;
for(const caravan of s.entities.filter(e=>economy.caravans.includes(e.id))){caravan.x=originalHQ.x+4;caravan.y=originalHQ.y+2+economy.caravans.indexOf(caravan.id);caravan.order={type:'idle'};}
for(const worker of workers(1)){worker.x=29.5;worker.y=31.5;worker.order={type:'idle'};}
refreshVisibility(s);
const destination=process.argv[2]??'docs/evidence/economy-settlements-20261001/browser-scenario.json';fs.mkdirSync(destination.slice(0,destination.lastIndexOf('/')),{recursive:true});fs.writeFileSync(destination,JSON.stringify(createSessionFile(s),null,2));console.log(JSON.stringify({destination,tick:s.tick,time:s.time,structures:economy.structures.map(e=>e.entityId),caravans:economy.caravans}));
