/** Split in Phase 2.4 into ./classroom/ modules; this barrel keeps the
 * public import path stable. */
export type { PlanValidationOptions, TeachingContext, TeachingPlan } from './classroom/types';
export { validateTeachingPlan } from './classroom/plan-validate';
export { parseTeachingPlan } from './classroom/plan-build';
export { teachingActionMode, interpreterTeachingContext } from './classroom/context';
