import type { ClientImprovement } from '../host';
import workers from './workers';
import income from './income';
export default [workers,income] satisfies ClientImprovement[];
