import {captureScenario,createScenario} from './src/core/scenarios';
import {saveGame} from './src/core/saves';
import {MatchRecorder} from './src/core/replays';
const definition={schemaVersion:1,id:'limits-proof',title:'Limits proof',briefing:'Hold the supplied position.',successText:'Position held.',failureText:'Position lost.',faction:'fairies',opponent:'orcs',seed:22,map:{size:'small',width:36,height:36,terrain:Array(36*36).fill('grass'),starts:[{x:4,y:4},{x:31,y:31}],resources:[]},army:Array.from({length:129},(_,i)=>({label:'troop-'+i,side:0,kind:'unit',role:'melee',x:3+i%13,y:3+Math.floor(i/13),order:{type:'hold'}})),objectives:[{id:'hold',text:'Hold until the signal.',success:{type:'time',seconds:35}}],events:[],rules:{fixedArmy:true,reinforcementBudget:0,resources:{wood:0,ore:0,crystal:0},timeLimit:120}};
const session=createScenario(definition);
let saveError='',recorderError='';try{saveGame(session.state);}catch(e){saveError=String(e);}try{new MatchRecorder(session.state);}catch(e){recorderError=String(e);}
console.log(JSON.stringify({actors:session.state.entities.length,labels:Object.keys(session.runtime.labels).length,checkpoint:captureScenario(session).game.state.entities.length,saveError,recorderError}));
