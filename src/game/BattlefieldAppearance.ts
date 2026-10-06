export interface BattlefieldAppearance {
  teamColors:readonly [number,number];
  highContrast:boolean;
  colorVision:boolean;
}
const defaults:BattlefieldAppearance={teamColors:[0x55dbea,0xff956b],highContrast:false,colorVision:false};
/** Shared renderer palette; accessibility preferences can extend this entry point. */
export function getBattlefieldAppearance():BattlefieldAppearance{return defaults;}
