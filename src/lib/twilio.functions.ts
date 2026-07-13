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
    // Twilio's AreaCode filter is a positive integer and only valid for US/CA.
    // For other countries, use Contains (digit-only substring match) instead.
    const digits = (data.areaCode ?? "").replace(/\D/g, "");
    if (digits) {
      const country = data.country.toUpperCase();
      if ((country === "US" || country === "CA") && digits.length <= 3) {
        query.AreaCode = digits;
      } else {
        query.Contains = digits;
      }
    }
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

    type PurchaseResult = {
      sid: string;
      phone_number: string;
      friendly_name?: string;
      capabilities?: { voice?: boolean; SMS?: boolean; MMS?: boolean };
    };
    const attemptPurchase = (f: Record<string, string>) =>
      twilioPost("/IncomingPhoneNumbers.json", f) as Promise<PurchaseResult>;

    const iso = (data.countryIso || "").toUpperCase();

    const attachAddressForCountry = async () => {
      const addr = (await twilioGet("/Addresses.json", { PageSize: "50" })) as {
        addresses?: Array<{ sid: string; iso_country: string }>;
      };
      const match = (addr.addresses ?? []).find(
        (a) => a.iso_country?.toUpperCase() === iso,
      );
      if (match) form.AddressSid = match.sid;
      return !!match;
    };

    const attachBundleForCountry = async () => {
      // Numbering (regulatory) bundles live on the Numbers API, not the Core API.
      const gw = "https://connector-gateway.lovable.dev/twilio";
      const res = await fetch(
        `${gw}/v2/RegulatoryCompliance/Bundles?Status=twilio-approved&IsoCountry=${iso}&NumberType=local&PageSize=50`,
        {
          headers: {
            Authorization: `Bearer ${process.env.LOVABLE_API_KEY!}`,
            "X-Connection-Api-Key": process.env.TWILIO_API_KEY!,
          },
        },
      );
      if (!res.ok) return false;
      const body = (await res.json()) as { results?: Array<{ sid: string }> };
      const bundle = body.results?.[0];
      if (bundle) form.BundleSid = bundle.sid;
      return !!bundle;
    };

    let json: PurchaseResult;
    try {
      json = await attemptPurchase(form);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const needsAddress = msg.includes('"code":21631') || msg.includes("AddressSid");
      const needsBundle = msg.includes('"code":21649') || msg.includes("Bundle required");

      if (!needsAddress && !needsBundle) throw err;

      const gotAddress = needsAddress ? await attachAddressForCountry() : true;
      const gotBundle = needsBundle ? await attachBundleForCountry() : true;
      // Bundle-required countries usually also need an Address — attach opportunistically.
      if (needsBundle && !form.AddressSid) await attachAddressForCountry();

      if (needsAddress && !gotAddress) {
        throw new Error(
          `Este país (${iso}) exige um Endereço regulatório vinculado ao número, e nenhum Address foi encontrado na sua conta Twilio para ${iso}. Cadastre em https://console.twilio.com/us1/develop/phone-numbers/manage/regulatory-compliance/addresses e tente novamente.`,
        );
      }
      if (needsBundle && !gotBundle) {
        throw new Error(
          `Este país (${iso}) exige um Regulatory Bundle aprovado pela Twilio (status "twilio-approved") vinculado ao número, e nenhum foi encontrado para ${iso} (LOCAL). Crie e envie um Bundle em https://console.twilio.com/us1/develop/phone-numbers/regulatory-compliance/bundles, aguarde a aprovação e tente novamente.`,
        );
      }

      json = await attemptPurchase(form);
    }


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

// ---------- address (regulatory) ----------

export const createTwilioAddress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        customerName: z.string().min(2),
        street: z.string().min(2),
        city: z.string().min(1),
        region: z.string().min(1),
        postalCode: z.string().min(2),
        isoCountry: z.string().length(2),
        friendlyName: z.string().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const form: Record<string, string> = {
      CustomerName: data.customerName,
      Street: data.street,
      City: data.city,
      Region: data.region,
      PostalCode: data.postalCode,
      IsoCountry: data.isoCountry.toUpperCase(),
    };
    if (data.friendlyName) form.FriendlyName = data.friendlyName;
    const json = (await twilioPost("/Addresses.json", form)) as {
      sid: string;
      iso_country: string;
    };
    return { sid: json.sid, isoCountry: json.iso_country };
  });
