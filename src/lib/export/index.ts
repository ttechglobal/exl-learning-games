import { LocalDbAdapter } from "@/lib/export/LocalDbAdapter";
import { ApiAdapter } from "@/lib/export/ApiAdapter";
import type { ExportAdapter } from "@/lib/export/ExportAdapter";

/**
 * The ONE place that decides which ExportAdapter is active. Everything else
 * in the codebase imports `activeExportAdapter` and never knows which
 * implementation is behind it. To switch to cross-app integration later,
 * change only this file.
 */
const useApiAdapter = Boolean(process.env.MAIN_PLATFORM_API_URL);

export const activeExportAdapter: ExportAdapter = useApiAdapter
  ? new ApiAdapter(process.env.MAIN_PLATFORM_API_URL as string, process.env.MAIN_PLATFORM_API_KEY ?? "")
  : new LocalDbAdapter();
