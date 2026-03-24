import { CONNECTOR } from './config';
interface WhopValidation { valid: boolean; userId?: string; tier?: string; error?: string; }
export async function validateWhopEntitlement(whopToken: string): Promise<WhopValidation> {
  const apiKey = process.env.WHOP_API_KEY;
  if (!apiKey) return { valid: false, error: 'WHOP_API_KEY not configured' };
  try {
    const res = await fetch('https://api.whop.com/api/v5/me', { headers: { Authorization: `Bearer ${whopToken}` } });
    if (!res.ok) return { valid: false, error: 'Invalid Whop token' };
    const user = await res.json() as any; const userId = user.id;
    const membershipRes = await fetch('https://api.whop.com/api/v5/me/memberships', { headers: { Authorization: `Bearer ${whopToken}` } });
    if (!membershipRes.ok) return { valid: false, error: 'Could not check memberships' };
    const memberships = await membershipRes.json() as any;
    const active = memberships.data?.find((m: any) => m.status === 'active' && (m.plan_id === CONNECTOR.whopPlanId || m.plan_id === 'plan_bundle'));
    if (!active) return { valid: false, error: 'No active subscription for this connector' };
    const tier = active.plan_id === 'plan_bundle' ? 'unlimited' : 'pro';
    return { valid: true, userId, tier };
  } catch (err: any) { return { valid: false, error: err.message || 'Whop validation failed' }; }
}
