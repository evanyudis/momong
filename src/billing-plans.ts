export type BillingPlans = {
  sandbox?: boolean;
  plans: { id: string; available?: boolean; methods?: { id: string; available?: boolean }[] }[];
};

let cached: { data: BillingPlans; expiresAt: number } | undefined;
let pending: Promise<BillingPlans> | undefined;

/** Share public plan configuration between the sheet and checkout, including in-flight requests. */
export function loadBillingPlans(): Promise<BillingPlans> {
  if (cached && Date.now() < cached.expiresAt) return Promise.resolve(cached.data);
  if (!pending) {
    pending = import("./sync").then(({ api }) => api<BillingPlans>("/billing/plans")).then(({ data }) => {
      cached = { data, expiresAt: Date.now() + 60_000 };
      return data;
    }).finally(() => { pending = undefined; });
  }
  return pending;
}
