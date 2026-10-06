import type { ClientImprovement } from '../host';
import military from './militaryClient';
import branches from './branchesClient';
export default [military,branches] satisfies ClientImprovement[];
