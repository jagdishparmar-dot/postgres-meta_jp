import { PageLoader } from "@/components/studio/page-loader"

/** Content-area loader only — sidebar/topbar stay mounted in database layout. */
export default function DatabasePageLoading() {
  return <PageLoader label="Loading page…" />
}
