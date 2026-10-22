import { api } from "@/api/client"
import { errorFromBody } from "@/lib/http"

/** Streams the export zip through the API (cookie + step-up) and saves it via an object URL. */
export async function downloadExport(exportId: string): Promise<void> {
  const { data, error, response } = await api.GET("/v1/account/export/{exportId}/download", {
    params: { path: { exportId } },
    parseAs: "blob",
  })
  if (!response.ok || !(data instanceof Blob)) throw errorFromBody(error, response)
  const disposition = response.headers.get("content-disposition") ?? ""
  const name = /filename="?([^";]+)"?/.exec(disposition)?.[1] ?? `gezcez-export-${exportId}.zip`
  const url = URL.createObjectURL(data)
  const a = document.createElement("a")
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
