import { StudioDatabaseLayout } from "@/components/studio/studio-database-layout"

export default function DatabaseLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <StudioDatabaseLayout>{children}</StudioDatabaseLayout>
}
