import {createScenario,subscribeScenarioCommands} from './src/core/scenarios';
import {MatchRecorder} from './src/core/replays';
import {issueCommand} from './src/core/simulation';
const definition={schemaVersion:1,id:'observer-proof',title:'Observer proof',briefing:'Hold the supplied position.',successText:'Position held.',failureText:'Position lost.',faction:'fairies',opponent:'orcs',seed:22,map:{size:'small',width:36,height:36,terrain:Array(36*36).fill('grass'),starts:[{x:4,y:4},{x:31,y:31}],resources:[]},army:[{label:'troop',side:0,kind:'unit',role:'melee',x:8,y:8,order:{type:'hold'}},{label:'enemy',side:1,kind:'unit',role:'melee',x:28,y:28,order:{type:'hold'}}],objectives:[{id:'hold',text:'Hold until the signal.',success:{type:'time',seconds:35}}],events:[],rules:{fixedArmy:true,reinforcementBudget:0,resources:{wood:0,ore:0,crystal:0},timeLimit:120}};
const session=createScenario(definition), recorder=new MatchRecorder(session.state), troop=session.state.entities.find(e=>e.id===session.runtime.labels.troop)!;
const unsubscribe=subscribeScenarioCommands(session,()=>{throw Error('observer failed');});
let error='';try{issueCommand(session.state,0,{type:'move',ids:[troop.id],x:12,y:8});}catch(e){error=String(e);}
unsubscribe();
console.log(JSON.stringify({error,order:troop.order,count:session.runtime.commandCounts.move,recorded:recorder.export().actions}));
recorder.dispose();
