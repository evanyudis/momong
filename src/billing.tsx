export type BillingPlan = "monthly" | "plus_lifetime";
export const selectedPlan = (): BillingPlan => sessionStorage.getItem("bb_plus_plan") === "monthly" ? "monthly" : "plus_lifetime";
export function PlanPicker({ value, onChange, sheet = false }: { value: BillingPlan; onChange: (value: BillingPlan) => void; sheet?: boolean }) {
  return <fieldset className={sheet ? "plus-plans plus-plans-sheet" : "plus-plans"} onPointerDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
    <legend>Pilih paket Plus</legend>
    {([["plus_lifetime", "Selamanya", "Rp199.000", "Sekali bayar"], ["monthly", "Bulanan", "Rp39.000", "Per bulan · tanpa trial"]] as const).map(([id, title, price, note]) =>
      <label key={id} className="plus-plan" data-selected={value === id}>
        <input type="radio" name="plus-plan" value={id} checked={value === id} onChange={() => { sessionStorage.setItem("bb_plus_plan", id); onChange(id); }} />
        <span><strong>{title}</strong><small>{sheet ? id === "plus_lifetime" ? "Sekali bayar · multi bayi" : "Multi bayi selama aktif" : note}</small></span>
        {sheet ? <span className="plus-plan-price">
          {id === "plus_lifetime" && <span className="plus-plan-tag">Paling hemat</span>}
          <strong className="num">{price}</strong><small>{id === "plus_lifetime" ? "sekali" : "per bulan"}</small>
        </span> : <strong className="num">{price}</strong>}
      </label>)}
  </fieldset>;
}
