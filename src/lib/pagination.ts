/** Read every page, including when the server caps responses below our page size. */
export async function fetchAllRows<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const rows: T[] = []
  for (;;) {
    const { data, error } = await page(rows.length, rows.length + 499)
    if (error) throw error
    if (!data?.length) return rows
    rows.push(...data)
  }
}
