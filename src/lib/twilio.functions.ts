// All Twilio operations are executed with the credentials the current user
// stored in `user_twilio_credentials` — the platform never uses a shared
// Twilio account. RLS scopes both credentials and purchased numbers to
// `auth.uid()`.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const TWILIO_API = "https://api.twilio.com/2010-04-01";
const TWILIO_NUMBERING = "https://numbers.twilio.com";

type Creds = { accountSid: string; authToken: string };

function basicAuth(c: Creds) {
  return `Basic ${btoa(`${c.accountSid}:${c.authToken}`)}`;
}

type SupabaseCtx = { supabase: { from: (t: string) => any } };

async function loadCreds(context: SupabaseCtx & { userId: string }): Promise<Creds | null> {
  const { data, error } = await context.supabase
    .from("user_twilio_credentials")
    .select("account_sid, auth_token")
    .eq("user_id", context.userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return { accountSid: data.account_sid as string, authToken: data.auth_token as string };
}

async function twilioAccountGet(
  creds: Creds,
  path: string,
  query?: Record<string, string>,
) {
  const url = new URL(`${TWILIO_API}/Accounts/${creds.accountSid}${path}`);
  if (query) for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  const res = await fetch(url.toString(), { headers: { Authorization: basicAuth(creds) } });
  const text = await res.text();
  if (!res.ok) throw new Error(`Twilio ${res.status}: ${text}`);
  return text ? JSON.parse(text) : {};
}

async function twilioAccountPost(
  creds: Creds,
  path: string,
  form: Record<string, string>,
) {
  const res = await fetch(`${TWILIO_API}/Accounts/${creds.accountSid}${path}`, {
    method: "POST",
    headers: {
      Authorization: basicAuth(creds),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(form).toString(),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Twilio ${res.status}: ${text}`);
  return text ? JSON.parse(text) : {};
}

async function twilioAccountDelete(creds: Creds, path: string) {
  const res = await fetch(`${TWILIO_API}/Accounts/${creds.accountSid}${path}`, {
    method: "DELETE",
    headers: { Authorization: basicAuth(creds) },
  });
  if (!res.ok && res.status !== 404) {
    const text = await res.text();
    throw new Error(`Twilio ${res.status}: ${text}`);
  }
}

// ---------- credentials ----------

export const saveTwilioCredentials = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        accountSid: z
          .string()
          .trim()
          .regex(/^AC[a-zA-Z0-9]{10,}$/, "Account SID inválido"),
        authToken: z.string().trim().min(8, "Auth Token inválido"),
        friendlyLabel: z.string().trim().max(80).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const creds: Creds = { accountSid: data.accountSid, authToken: data.authToken };
    // Validate by fetching the account itself.
    try {
      await twilioAccountGet(creds, ".json");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(
        msg.includes("401")
          ? "Credenciais Twilio inválidas (401). Confira Account SID e Auth Token."
          : msg,
      );
    }

    const { error } = await context.supabase.from("user_twilio_credentials").upsert(
      {
        user_id: context.userId,
        account_sid: data.accountSid,
        auth_token: data.authToken,
        friendly_label: data.friendlyLabel ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
    if (error) throw new Error(`DB upsert failed: ${error.message}`);
    return { ok: true, accountSid: data.accountSid };
  });

export const getTwilioConnection = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("user_twilio_credentials")
      .select("account_sid, friendly_label, updated_at")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return { connected: false as const };
    return {
      connected: true as const,
      accountSid: data.account_sid as string,
      friendlyLabel: (data.friendly_label as string | null) ?? null,
      updatedAt: data.updated_at as string,
    };
  });

export const disconnectTwilio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { error } = await context.supabase
      .from("user_twilio_credentials")
      .delete()
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

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
  .handler(async ({ data, context }) => {
    const creds = await loadCreds(context);
    if (!creds) return { ok: false as const, reason: "no_credentials" as const };

    const query: Record<string, string> = { PageSize: "10" };
    const digits = (data.areaCode ?? "").replace(/\D/g, "");
    if (digits) {
      const country = data.country.toUpperCase();
      if ((country === "US" || country === "CA") && digits.length <= 3) {
        query.AreaCode = digits;
      } else {
        query.Contains = digits;
      }
    }
    const json = await twilioAccountGet(
      creds,
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
    return {
      ok: true as const,
      results: rows.map((r) => ({
        id: r.phone_number,
        phoneNumber: r.phone_number,
        friendlyName: r.friendly_name,
        region:
          [r.locality, r.region].filter(Boolean).join(" / ") || r.iso_country || "",
        countryIso: r.iso_country ?? data.country,
        voice: !!r.capabilities?.voice,
        sms: !!r.capabilities?.SMS,
        mms: !!r.capabilities?.MMS,
      })),
    };
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
        bundleSid: z.string().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const creds = await loadCreds(context);
    if (!creds) return { ok: false as const, reason: "no_credentials" as const };

    const form: Record<string, string> = { PhoneNumber: data.phoneNumber };
    if (data.friendlyName) form.FriendlyName = data.friendlyName;
    if (data.bundleSid?.trim()) form.BundleSid = data.bundleSid.trim();

    const iso = (data.countryIso || "").toUpperCase();

    type PurchaseResult = {
      sid: string;
      phone_number: string;
      friendly_name?: string;
      capabilities?: { voice?: boolean; SMS?: boolean; MMS?: boolean };
    };
    const attempt = (f: Record<string, string>) =>
      twilioAccountPost(creds, "/IncomingPhoneNumbers.json", f) as Promise<PurchaseResult>;

    const bundleRequiredMessage = form.BundleSid
      ? `O Regulatory Bundle informado não foi aceito pela Twilio para ${iso} (LOCAL). Confirme se o Bundle SID está aprovado ("twilio-approved") e é compatível com ${iso}/LOCAL.`
      : `Este país (${iso}) exige um Regulatory Bundle aprovado pela Twilio vinculado ao número. Informe um Bundle SID aprovado ou crie um em https://console.twilio.com/us1/develop/phone-numbers/regulatory-compliance/bundles.`;
    const addressRequiredMessage = `Este país (${iso}) exige um Endereço regulatório vinculado ao número, e nenhum Address foi encontrado na sua conta Twilio para ${iso}.`;

    const attachAddress = async () => {
      const addr = (await twilioAccountGet(creds, "/Addresses.json", { PageSize: "50" })) as {
        addresses?: Array<{ sid: string; iso_country: string }>;
      };
      const match = (addr.addresses ?? []).find(
        (a) => a.iso_country?.toUpperCase() === iso,
      );
      if (match) form.AddressSid = match.sid;
      return !!match;
    };

    const attachBundle = async () => {
      const res = await fetch(
        `${TWILIO_NUMBERING}/v2/RegulatoryCompliance/Bundles?Status=twilio-approved&IsoCountry=${iso}&NumberType=local&PageSize=50`,
        { headers: { Authorization: basicAuth(creds) } },
      );
      if (!res.ok) return false;
      const body = (await res.json()) as { results?: Array<{ sid: string }> };
      const bundle = body.results?.[0];
      if (bundle) form.BundleSid = bundle.sid;
      return !!bundle;
    };

    let json: PurchaseResult;
    try {
      json = await attempt(form);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const needsAddress = msg.includes('"code":21631') || msg.includes("AddressSid");
      const needsBundle = msg.includes('"code":21649') || msg.includes("Bundle required");
      if (!needsAddress && !needsBundle) throw err;

      const gotAddress = needsAddress ? await attachAddress() : true;
      const gotBundle = needsBundle
        ? form.BundleSid
          ? true
          : await attachBundle()
        : true;
      if (needsBundle && !form.AddressSid) await attachAddress();

      if (needsAddress && !gotAddress)
        return { ok: false as const, reason: "address_required" as const, message: addressRequiredMessage };
      if (needsBundle && !gotBundle)
        return { ok: false as const, reason: "bundle_required" as const, message: bundleRequiredMessage };

      try {
        json = await attempt(form);
      } catch (retryErr) {
        const retryMsg = retryErr instanceof Error ? retryErr.message : String(retryErr);
        if (retryMsg.includes('"code":21649') || retryMsg.includes("Bundle required"))
          return { ok: false as const, reason: "bundle_required" as const, message: bundleRequiredMessage };
        if (retryMsg.includes('"code":21631') || retryMsg.includes("AddressSid"))
          return { ok: false as const, reason: "address_required" as const, message: addressRequiredMessage };
        throw retryErr;
      }
    }

    const { error } = await context.supabase.from("user_phone_numbers").insert({
      user_id: context.userId,
      twilio_sid: json.sid,
      phone_number: json.phone_number,
      friendly_name: json.friendly_name ?? null,
      region: data.region ?? null,
      country_iso: data.countryIso ?? null,
      capabilities: json.capabilities ?? {},
      monthly_cost: "$1.00/mês",
      provider: "Twilio (Sua conta)",
    });

    if (error) {
      try {
        await twilioAccountDelete(creds, `/IncomingPhoneNumbers/${json.sid}.json`);
      } catch {
        /* best-effort */
      }
      throw new Error(`DB insert failed: ${error.message}`);
    }

    return { ok: true as const, sid: json.sid, phoneNumber: json.phone_number };
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

// ---------- list from Twilio (live) ----------

export const listTwilioNumbers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const creds = await loadCreds(context);
    if (!creds) return { ok: false as const, reason: "no_credentials" as const };
    const json = (await twilioAccountGet(creds, "/IncomingPhoneNumbers.json", {
      PageSize: "200",
    })) as {
      incoming_phone_numbers?: Array<{
        sid: string;
        phone_number: string;
        friendly_name?: string;
        trunk_sid?: string | null;
        capabilities?: { voice?: boolean; SMS?: boolean; MMS?: boolean };
        origin?: string;
        status?: string;
      }>;
    };
    const rows = json.incoming_phone_numbers ?? [];
    return {
      ok: true as const,
      numbers: rows.map((r) => ({
        sid: r.sid,
        phoneNumber: r.phone_number,
        friendlyName: r.friendly_name ?? null,
        trunkSid: r.trunk_sid ?? null,
        voice: !!r.capabilities?.voice,
        sms: !!r.capabilities?.SMS,
        mms: !!r.capabilities?.MMS,
        status: r.status ?? null,
      })),
    };
  });

export const listTwilioTrunks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const creds = await loadCreds(context);
    if (!creds) return { ok: false as const, reason: "no_credentials" as const };
    const res = await fetch("https://trunking.twilio.com/v1/Trunks?PageSize=50", {
      headers: { Authorization: basicAuth(creds) },
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`Twilio ${res.status}: ${text}`);
    const body = (text ? JSON.parse(text) : {}) as {
      trunks?: Array<{
        sid: string;
        friendly_name: string;
        domain_name?: string;
        disaster_recovery_url?: string | null;
        secure?: boolean;
      }>;
    };
    const trunks = body.trunks ?? [];
    const counts: Record<string, number> = {};
    try {
      const nums = (await twilioAccountGet(creds, "/IncomingPhoneNumbers.json", {
        PageSize: "200",
      })) as {
        incoming_phone_numbers?: Array<{ trunk_sid?: string | null }>;
      };
      for (const n of nums.incoming_phone_numbers ?? []) {
        if (n.trunk_sid) counts[n.trunk_sid] = (counts[n.trunk_sid] ?? 0) + 1;
      }
    } catch {
      /* best-effort */
    }
    return {
      ok: true as const,
      trunks: trunks.map((t) => ({
        sid: t.sid,
        friendlyName: t.friendly_name,
        domainName: t.domain_name ?? null,
        numbersCount: counts[t.sid] ?? 0,
        status: "Ativo" as const,
      })),
    };
  });

// ---------- release ----------

export const releaseNumber = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: row, error: fetchErr } = await context.supabase
      .from("user_phone_numbers")
      .select("id, twilio_sid")
      .eq("id", data.id)
      .maybeSingle();

    if (fetchErr) throw new Error(fetchErr.message);
    if (!row) throw new Error("Número não encontrado.");

    const sid = row.twilio_sid as string;
    if (!sid.startsWith("byoc_")) {
      const creds = await loadCreds(context);
      if (creds) {
        try {
          await twilioAccountDelete(creds, `/IncomingPhoneNumbers/${sid}.json`);
        } catch (err) {
          // If credentials no longer match this SID (e.g. user rotated Twilio
          // account), still allow deleting the local row so it doesn't get stuck.
          const msg = err instanceof Error ? err.message : String(err);
          if (!msg.includes("404")) throw err;
        }
      }
    }

    const { error: delErr } = await context.supabase
      .from("user_phone_numbers")
      .delete()
      .eq("id", row.id);
    if (delErr) throw new Error(delErr.message);

    return { ok: true };
  });

// ---------- regulatory address ----------

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
  .handler(async ({ data, context }) => {
    const creds = await loadCreds(context);
    if (!creds) return { ok: false as const, reason: "no_credentials" as const };

    const form: Record<string, string> = {
      CustomerName: data.customerName,
      Street: data.street,
      City: data.city,
      Region: data.region,
      PostalCode: data.postalCode,
      IsoCountry: data.isoCountry.toUpperCase(),
    };
    if (data.friendlyName) form.FriendlyName = data.friendlyName;
    const json = (await twilioAccountPost(creds, "/Addresses.json", form)) as {
      sid: string;
      iso_country: string;
    };
    return { ok: true as const, sid: json.sid, isoCountry: json.iso_country };
  });

// ---------- SIP Trunk (external) ----------

export const connectExternalNumber = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        routeName: z.string().trim().min(2).max(80),
        sipUri: z.string().trim().min(4),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const syntheticSid = `byoc_${crypto.randomUUID()}`;
    const row = {
      user_id: context.userId,
      twilio_sid: syntheticSid,
      phone_number: data.sipUri,
      friendly_name: data.routeName,
      region: null,
      country_iso: null,
      capabilities: { byoc: true, sip_uri: data.sipUri, route: data.routeName },
      monthly_cost: null,
      provider: "SIP (Externo)",
    };
    const { error } = await context.supabase.from("user_phone_numbers").insert(row);
    if (error) throw new Error(`DB insert failed: ${error.message}`);
    return { ok: true };
  });
