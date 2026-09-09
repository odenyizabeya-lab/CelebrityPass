/** Recursively makes every property optional. */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends string ? T[P] : T[P] extends readonly (infer U)[]
    ? readonly DeepPartial<U>[]
    : T[P] extends object
      ? DeepPartial<T[P]>
      : T[P];
};