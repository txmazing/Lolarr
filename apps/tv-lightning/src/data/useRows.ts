import { useQuery } from '@tanstack/react-query';
import rows from './rows.json';

export type Item = { id: string; title: string; posterUrl: string; landscapeUrl: string };
export type Row = { id: string; title: string; items: Item[] };

export function useRows() {
  return useQuery({
    queryKey: ['rows'],
    queryFn: async (): Promise<Row[]> => {
      await new Promise((r) => setTimeout(r, 300));
      return rows as Row[];
    },
  });
}
