const DEFAULT_COLUMN_WIDTH = 100;
export const createColumnWidths = (
  columns: string[],
  configs?: {
    defaultWidth?: number;
  },
): Record<string, number> => {
  const defaultWidth = configs?.defaultWidth ?? DEFAULT_COLUMN_WIDTH;
  return columns.reduce(
    (acc, column) => {
      acc[column] = defaultWidth;
      return acc;
    },
    {} as Record<string, number>,
  );
};
