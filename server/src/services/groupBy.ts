export const groupBy = <T, K extends string | number>(
  values: T[],
  keyFn: (value: T) => K,
) =>
  values.reduce<Record<K, T[]>>((accumulator, value) => {
    const key = keyFn(value);
    accumulator[key] ??= [];
    accumulator[key].push(value);
    return accumulator;
  }, {} as Record<K, T[]>);
