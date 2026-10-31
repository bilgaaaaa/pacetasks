import { createClient } from "@supabase/supabase-js";
import type { ProEntitlement } from "../../domain/pro.ts";

// Where the server keeps each user's Pro subscription (public.pro_entitlements).
export interface ProEntitlementStore {
  read(userId: string): Promise<ProEntitlement | null>;
  save(userId: string, entitlement: ProEntitlement | null): Promise<void>; // null removes it
}

interface ProEntitlementRow {
  product_id: string;
  period_type: ProEntitlement["periodType"];
  expires_at: string | null;
  will_renew: boolean;
}

// Service-role store: only Edge Functions write entitlements, so users can't grant themselves Pro.
export function createSupabaseProEntitlementStore(options: { supabaseUrl: string; serviceRoleKey: string }): ProEntitlementStore {
  const supabase = createClient(options.supabaseUrl, options.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return {
    async read(userId) {
      const { data, error } = await supabase
        .from("pro_entitlements")
        .select("product_id, period_type, expires_at, will_renew")
        .eq("user_id", userId)
        .maybeSingle<ProEntitlementRow>();
      if (error) throw error;
      if (!data) return null;
      return {
        productId: data.product_id,
        periodType: data.period_type,
        expiresAt: data.expires_at,
        willRenew: data.will_renew,
      };
    },

    async save(userId, entitlement) {
      if (!entitlement) {
        const { error } = await supabase.from("pro_entitlements").delete().eq("user_id", userId);
        if (error) throw error;
        return;
      }
      const { error } = await supabase.from("pro_entitlements").upsert({
        user_id: userId,
        product_id: entitlement.productId,
        period_type: entitlement.periodType,
        expires_at: entitlement.expiresAt,
        will_renew: entitlement.willRenew,
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;
    },
  };
}
