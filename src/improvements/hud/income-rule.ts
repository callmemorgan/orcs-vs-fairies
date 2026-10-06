import { registerGameImprovement } from '../../core/improvements';
import type { JsonValue, ResourceKind } from '../../core/types';

const INCOME_WINDOW=60;
interface Deposit {time:number;kind:ResourceKind;amount:number}
interface IncomeState {deposits:[Deposit[],Deposit[]]}
export type IncomeObservation={windowSeconds:number;income:Record<ResourceKind,number>};
const data=(state:JsonValue)=>state as unknown as IncomeState;
registerGameImprovement({
  id:'feature-022',
  initialState:()=>({deposits:[[],[]]}),
  step(game,_dt,state){
    const deposits=data(state).deposits;
    for(const side of [0,1] as const)deposits[side]=deposits[side].filter(entry=>entry.time>game.time-INCOME_WINDOW);
    for(const {type,side,resource,amount=0} of game.events)if(type==='gather'&&resource&&amount>0&&Number.isFinite(amount))deposits[side].push({time:game.time,kind:resource,amount});
  },
  observe(game,side,state){
    const income={wood:0,ore:0,crystal:0};
    for(const deposit of data(state).deposits[side])if(deposit.time>game.time-INCOME_WINDOW)income[deposit.kind]+=deposit.amount;
    return {windowSeconds:INCOME_WINDOW,income} satisfies IncomeObservation;
  }
});
