export const HOME_SANCTUARY = "sanctuary";
export const ADULT_AGE = 16;
export const DEFAULT_MINOR_AGE = 15;

export function isMinor(age: number) {
  return Number(age) < ADULT_AGE;
}

/** 未分化初始年龄强制 <16；未传则给默认 15 */
export function resolveInitialAge(inputAge?: number, isUndifferentiated?: boolean) {
  const n = Number(inputAge);
  if (isUndifferentiated) {
    if (!Number.isFinite(n)) return DEFAULT_MINOR_AGE;
    return Math.min(n, ADULT_AGE - 1); // 最大 15
  }
  // 非未分化：如果没传，按你现有默认（例如 16）
  if (!Number.isFinite(n)) return ADULT_AGE;
  return n;
}

/** 你已有的家园规则：未满16必圣所 */
export function resolveInitialHome(age: number, gold: number) {
  if (isMinor(age)) return HOME_SANCTUARY;
  return Number(gold) >= 9999 ? "east_market" : "west_market";
}
