import { eq } from "drizzle-orm";
import { qrSettings, type QrSettingsRow } from "@shared/schema";
import type { Database } from "../db";

export type QrStyle = Pick<QrSettingsRow, "size" | "darkColor" | "lightColor" | "errorCorrection">;

export function createQrRepository(db: Database) {
  return {
    async get(urlId: string): Promise<QrSettingsRow | undefined> {
      const [row] = await db.select().from(qrSettings).where(eq(qrSettings.urlId, urlId));
      return row;
    },
    async upsert(urlId: string, style: QrStyle): Promise<QrSettingsRow> {
      const [row] = await db
        .insert(qrSettings)
        .values({ urlId, ...style })
        .onConflictDoUpdate({ target: qrSettings.urlId, set: { ...style, updatedAt: new Date() } })
        .returning();
      return row;
    },
    async delete(urlId: string): Promise<void> {
      await db.delete(qrSettings).where(eq(qrSettings.urlId, urlId));
    },
  };
}

export type QrRepository = ReturnType<typeof createQrRepository>;
