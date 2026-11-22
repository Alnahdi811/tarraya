import { pool, type WhatsappJob } from "@workspace/db";
import { createHmac } from "node:crypto";
import type { Language } from "./whatsapp-message";

export type JobPayload = {
  url: string; message: string; language: Language; from: string; to: string;
};
export interface WhatsappStore {
  accept(sid: string, payload: JobPayload | null): Promise<"accepted" | "duplicate" | "limited">;
}

export function createWhatsappStore(
  quotaKey = () => process.env.TWILIO_AUTH_TOKEN,
  connect = () => pool.connect(),
): WhatsappStore {
  return {
  async accept(sid, payload) {
    const quotaSecret = quotaKey();
    if (payload && !quotaSecret) throw new Error("WhatsApp quota key unavailable");
    const senderKey = payload ? createHmac("sha256", quotaSecret!).update(payload.from).digest("hex") : null;
    const client = await connect();
    try {
      await client.query("BEGIN");
      await client.query("SET LOCAL statement_timeout = '1500ms'");
      // Serialize this sender's quota check without blocking other senders.
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [senderKey ?? sid]);
      const duplicate = await client.query("SELECT sid FROM whatsapp_jobs WHERE sid=$1", [sid]);
      if (duplicate.rowCount) {
        await client.query("COMMIT");
        return "duplicate";
      }
      let limited = false;
      if (payload) {
        const recent = await client.query(`SELECT count(*)::int AS count FROM whatsapp_jobs
          WHERE sender_key=$1 AND created_at > now() - interval '1 minute'`, [senderKey]);
        limited = recent.rows[0].count >= 5;
      }
      const inserted = await client.query(`INSERT INTO whatsapp_jobs (sid, state, payload, sender_key)
        VALUES ($1,$2,$3,$4) ON CONFLICT (sid) DO NOTHING RETURNING sid`,
        [sid, payload && !limited ? "queued" : "sent", payload && !limited ? JSON.stringify(payload) : null, senderKey]);
      await client.query("COMMIT");
      return !inserted.rowCount ? "duplicate" : limited ? "limited" : "accepted";
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },
  };
}

export const whatsappStore = createWhatsappStore();

export async function claimAnalysis(): Promise<Pick<WhatsappJob, "sid" | "payload"> | undefined> {
  const result = await pool.query(`UPDATE whatsapp_jobs SET state='analyzing', updated_at=now()
    WHERE sid=(SELECT sid FROM whatsapp_jobs WHERE state='queued'
      ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1)
    RETURNING sid, payload`);
  return result.rows[0];
}

export async function saveReply(sid: string, reply: string): Promise<void> {
  // Remove message text and submitted URL as soon as analysis is complete.
  await pool.query(`UPDATE whatsapp_jobs SET state='ready', reply=$2,
    payload=payload - 'message' - 'url', updated_at=now() WHERE sid=$1 AND state='analyzing'`,
    [sid, reply]);
}

export async function claimDelivery(): Promise<{sid: string; reply: string; payload: JobPayload} | undefined> {
  const result = await pool.query(`UPDATE whatsapp_jobs SET state='sending', updated_at=now()
    WHERE sid=(SELECT sid FROM whatsapp_jobs WHERE state='ready'
      ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING sid, reply, payload`);
  return result.rows[0];
}

export async function finishDelivery(sid: string, state: "sent" | "delivery_unknown"): Promise<void> {
  await pool.query(`UPDATE whatsapp_jobs SET state=$2, payload=NULL, reply=NULL,
    updated_at=now() WHERE sid=$1`, [sid, state]);
}

export async function recoverJobs(): Promise<void> {
  await pool.query(`UPDATE whatsapp_jobs SET state='queued', updated_at=now()
    WHERE state='analyzing' AND updated_at < now() - interval '2 minutes'`);
  // A crash after Twilio accepted a send is ambiguous. Do not blindly send again.
  await pool.query(`UPDATE whatsapp_jobs SET state='delivery_unknown', payload=NULL, reply=NULL, updated_at=now()
    WHERE state='sending' AND updated_at < now() - interval '2 minutes'`);
  await pool.query(`UPDATE whatsapp_jobs SET state='failed', payload=NULL, reply=NULL
    WHERE created_at < now() - interval '24 hours' AND (payload IS NOT NULL OR reply IS NOT NULL)`);
  await pool.query(`UPDATE whatsapp_jobs SET sender_key=NULL
    WHERE sender_key IS NOT NULL AND created_at < now() - interval '1 minute'`);
}
