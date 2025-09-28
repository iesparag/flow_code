type Primitive = string | number | boolean | null | undefined;

type SimpleCond = { field: string; op: string; value?: any };

type Condition = { all?: Condition[]; any?: Condition[] } | SimpleCond;

function evalSimple(state: Record<string, any>, c: SimpleCond): boolean {
  const left: Primitive = state[c.field];
  const right = c.value;
  switch (c.op) {
    case '=': return left === right;
    case '!=': return left !== right;
    case '>': return (left as any) > right;
    case '>=': return (left as any) >= right;
    case '<': return (left as any) < right;
    case '<=': return (left as any) <= right;
    case 'in': return Array.isArray(right) && right.includes(left);
    case 'notIn': return Array.isArray(right) && !right.includes(left);
    case 'contains': return typeof left === 'string' && typeof right === 'string' && left.includes(right);
    case 'startsWith': return typeof left === 'string' && typeof right === 'string' && left.startsWith(right);
    case 'exists': return left !== undefined && left !== null;
    default: return false;
  }
}

export function evaluateCondition(state: Record<string, any>, condition?: Condition): boolean {
  if (!condition) return true;
  if ('field' in condition) {
    return evalSimple(state, condition as SimpleCond);
  }
  if (condition.all) {
    return condition.all.every((c) => evaluateCondition(state, c));
  }
  if (condition.any) {
    return condition.any.some((c) => evaluateCondition(state, c));
  }
  return true;
}
