import type { ClientImprovement } from '../host';
export function aiToggle(id:string,label:string):ClientImprovement {
  return {id,mount(context){
    const row=document.createElement('label'),input=document.createElement('input');input.type='checkbox';input.checked=true;
    row.append(input,document.createTextNode(label));context.menu.append(row);
    return {readOptions:()=>input.checked?{}:undefined};
  }};
}
