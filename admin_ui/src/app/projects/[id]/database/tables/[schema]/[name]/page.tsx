import { TableDataPageClient } from "@/components/studio/pages/table-data-page"

type PageProps = {
  params: Promise<{ schema: string; name: string }>
}

export default async function TableDataPage({ params }: PageProps) {
  const { schema, name } = await params
  return (
    <TableDataPageClient
      schema={decodeURIComponent(schema)}
      name={decodeURIComponent(name)}
    />
  )
}
