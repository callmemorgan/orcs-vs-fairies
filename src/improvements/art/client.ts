import type { ClientImprovement } from '../host';
import occlusion from './occlusion';
import silhouettes from './silhouettes';
import teamMarkings from './teamMarkings';
export default [occlusion,silhouettes,teamMarkings] satisfies ClientImprovement[];
