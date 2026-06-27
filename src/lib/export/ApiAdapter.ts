import type { ExportAdapter } from "@/lib/export/ExportAdapter";
import type { AttemptResult } from "@/types/result";

/**
 * NOT ACTIVE. Stub for when cross-app integration (subdomain + shared auth,
 * or API-based result reporting) is decided. Swapping this in means changing
 * one export in src/lib/export/index.ts — nothing else in the codebase
 * needs to know the integration story changed.
 */
export class ApiAdapter implements ExportAdapter {
  constructor(private apiUrl: string, private apiKey: string) {}

  async reportAttempt(result: AttemptResult): Promise<void> {
    const response = await fetch(`${this.apiUrl}/attempts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`
      },
      body: JSON.stringify(result)
    });
    if (!response.ok) {
      throw new Error(`ApiAdapter.reportAttempt failed: ${response.status} ${response.statusText}`);
    }
  }
}
