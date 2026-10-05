export type BillingPlan = "monthly" | "plus_lifetime";
export const selectedPlan = (): BillingPlan => sessionStorage.getItem("bb_plus_plan") === "monthly" ? "monthly" : "plus_lifetime";
export function PlanPicker({ value, onChange }: { value: BillingPlan; onChange: (value: BillingPlan) => void }) {
  return <fieldset className="plus-plans" onPointerDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
    <legend>Pilih paket Plus</legend>
    {([["plus_lifetime", "Selamanya", "Rp199.000", "Sekali bayar"], ["monthly", "Bulanan", "Rp39.000", "Per bulan · tanpa trial"]] as const).map(([id, title, price, note]) =>
      <label key={id} className="plus-plan" data-selected={value === id}>
        <input type="radio" name="plus-plan" value={id} checked={value === id} onChange={() => { sessionStorage.setItem("bb_plus_plan", id); onChange(id); }} />
        <span><strong>{title}</strong><small>{note}</small></span><strong className="num">{price}</strong>
      </label>)}
  </fieldset>;
}
