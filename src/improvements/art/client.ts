import type { ClientImprovement } from '../host';
import occlusion from './occlusion';
import silhouettes from './silhouettes';
export default [occlusion,silhouettes] satisfies ClientImprovement[];
