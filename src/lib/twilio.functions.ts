// Server functions for Twilio number search/purchase/release, backed by the
// Lovable connector gateway. All routes require an authenticated user; each
// purchased number is persisted with the buyer's user_id so RLS scopes the
// list to that user only.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GATEWAY = "https://connector-gateway.lovable.dev/twilio";

function twilioHeaders() {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const twilioKey = process.env.TWILIO_API_KEY;
  if (!lovableKey) throw new Error("LOVABLE_API_KEY not configured");
  if (!twilioKey)
    throw new Error(
      "TWILIO_API_KEY not configured — link the Twilio connector to this project",
    );
  return {
    Authorization: `Bearer ${lovableKey}`,
    "X-Connection-Api-Key": twilioKey,
  };
}

async function twilioGet(path: string, query?: Record<string, string>) {
  const url = new URL(`${GATEWAY}${path}`);
  if (query) {
    for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  }
  const res = await fetch(url.toString(), { headers: twilioHeaders() });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Twilio ${res.status}: ${text}`);
  }
  return text ? JSON.parse(text) : {};
}

async function twilioPost(path: string, form: Record<string, string>) {
  const res = await fetch(`${GATEWAY}${path}`, {
    method: "POST",
    headers: {
      ...twilioHeaders(),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(form).toString(),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Twilio ${res.status}: ${text}`);
  return text ? JSON.parse(text) : {};
}

async function twilioDelete(path: string) {
  const res = await fetch(`${GATEWAY}${path}`, {
    method: "DELETE",
    headers: twilioHeaders(),
  });
  if (!res.ok && res.status !== 404) {
    const text = await res.text();
    throw new Error(`Twilio ${res.status}: ${text}`);
  }
}

// ---------- search ----------

export const searchAvailableNumbers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        country: z.string().min(2).max(2),
        areaCode: z.string().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const query: Record<string, string> = { PageSize: "10" };
    if (data.areaCode) query.AreaCode = data.areaCode;
    const json = await twilioGet(
      `/AvailablePhoneNumbers/${data.country}/Local.json`,
      query,
    );
    const rows = (json.available_phone_numbers ?? []) as Array<{
      phone_number: string;
      friendly_name: string;
      locality?: string;
      region?: string;
      iso_country?: string;
      capabilities?: { voice?: boolean; SMS?: boolean; MMS?: boolean };
    }>;
    return rows.map((r) => ({
      id: r.phone_number,
      phoneNumber: r.phone_number,
      friendlyName: r.friendly_name,
      region: [r.locality, r.region].filter(Boolean).join(" / ") || r.iso_country || "",
      countryIso: r.iso_country ?? data.country,
      voice: !!r.capabilities?.voice,
      sms: !!r.capabilities?.SMS,
      mms: !!r.capabilities?.MMS,
    }));
  });

// ---------- purchase ----------

export const purchaseNumber = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        phoneNumber: z.string().min(4),
        friendlyName: z.string().optional(),
        countryIso: z.string().optional(),
        region: z.string().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const form: Record<string, string> = { PhoneNumber: data.phoneNumber };
    if (data.friendlyName) form.FriendlyName = data.friendlyName;

    const json = (await twilioPost("/IncomingPhoneNumbers.json", form)) as {
      sid: string;
      phone_number: string;
      friendly_name?: string;
      capabilities?: { voice?: boolean; SMS?: boolean; MMS?: boolean };
    };

    const { error } = await context.supabase
      .from("user_phone_numbers")
      .insert({
        user_id: context.userId,
        twilio_sid: json.sid,
        phone_number: json.phone_number,
        friendly_name: json.friendly_name ?? null,
        region: data.region ?? null,
        country_iso: data.countryIso ?? null,
        capabilities: json.capabilities ?? {},
        monthly_cost: "$1.00/mês",
        provider: "twilio",
      });

    if (error) {
      // Compensating rollback: release the Twilio number so we don't leave
      // an orphan the user is billed for but doesn't own in our DB.
      try {
        await twilioDelete(`/IncomingPhoneNumbers/${json.sid}.json`);
      } catch {
        /* best-effort */
      }
      throw new Error(`DB insert failed: ${error.message}`);
    }

    return { sid: json.sid, phoneNumber: json.phone_number };
  });

// ---------- list ----------

export const listMyNumbers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("user_phone_numbers")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

// ---------- release ----------

export const releaseNumber = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    // Fetch the row (RLS scopes to this user).
    const { data: row, error: fetchErr } = await context.supabase
      .from("user_phone_numbers")
      .select("id, twilio_sid")
      .eq("id", data.id)
      .maybeSingle();

    if (fetchErr) throw new Error(fetchErr.message);
    if (!row) throw new Error("Número não encontrado.");

    await twilioDelete(`/IncomingPhoneNumbers/${row.twilio_sid}.json`);

    const { error: delErr } = await context.supabase
      .from("user_phone_numbers")
      .delete()
      .eq("id", row.id);
    if (delErr) throw new Error(delErr.message);

    return { ok: true };
  });
