/** Change when deterministic rules change, even if the save schema stays the same. */
export const SIMULATION_REVISION = '3.0.0';

/** Replays written before rules revisions were recorded retain their original identity. */
export const LEGACY_SIMULATION_REVISIONS:Readonly<Record<number,string>> = {
  1:'1.0.0',2:'2.0.0',3:'3.0.0'
};
