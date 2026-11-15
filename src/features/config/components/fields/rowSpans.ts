




export function resolveRowSpans(wide: readonly boolean[]): boolean[] {
  let column = 0;
  return wide.map((isWide, index) => {
    if (isWide) {
      column = 0;
      return true;
    }
    const orphan = column === 0 && (index === wide.length - 1 || wide[index + 1]);
    column = orphan ? 0 : 1 - column;
    return orphan;
  });
}
