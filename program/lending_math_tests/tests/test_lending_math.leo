// Mirrors weighted collateral + borrow health checks from xyra_lending_v8 (Leo 4).

fn mirror_weighted_collateral_usd(real_sup: u64, price: u64, ltv: u64) -> u64 {
    let scale: u64 = 10_000u64;
    let price_scale: u64 = 1_000_000u64;
    let rp: u128 = (real_sup as u128) * (price as u128);
    let l: u128 = (ltv as u128);
    let den: u128 = (price_scale as u128) * (scale as u128);
    let max_u128: u128 = 340282366920938463463374607431768211455u128;
    let rp_times_l_ok: bool = (l == 0u128) || (rp <= (max_u128 / l));
    return rp_times_l_ok ? (((rp * l) / den) as u64) : ((((rp / (price_scale as u128)) * l / (scale as u128)) as u64));
}

fn debt_usd_micro(real_bor: u64, price: u64) -> u64 {
    let price_scale: u64 = 1_000_000u64;
    return (((real_bor as u128) * (price as u128) / (price_scale as u128)) as u64);
}

fn new_borrow_usd_micro(amount: u64, borrow_price: u64) -> u64 {
    let price_scale: u64 = 1_000_000u64;
    return (((amount as u128) * (borrow_price as u128) / (price_scale as u128)) as u64);
}

/// Same floor ladder as `xyra_lending_*` `withdraw` → `rem_after_usad` (WDR-09). Used by `leo test` offline.
fn mirror_withdraw_rem_after_usad(
    real_sup_aleo: u64,
    real_sup_usdcx: u64,
    real_sup_usad: u64,
    price_aleo: u64,
    price_usdcx: u64,
    price_usad: u64,
    amount: u64,
    price_out: u64,
) -> u64 {
    let price_scale: u64 = 1_000_000u64;
    let sup_aleo_usd: u64 = (((real_sup_aleo as u128) * (price_aleo as u128) / (price_scale as u128)) as u64);
    let sup_usdcx_usd: u64 = (((real_sup_usdcx as u128) * (price_usdcx as u128) / (price_scale as u128)) as u64);
    let sup_usad_usd: u64 = (((real_sup_usad as u128) * (price_usad as u128) / (price_scale as u128)) as u64);
    let total_supply_usd_before_u128: u128 = (sup_aleo_usd as u128) + (sup_usdcx_usd as u128) + (sup_usad_usd as u128);
    let withdraw_usd: u64 = (((amount as u128) * (price_out as u128) / (price_scale as u128)) as u64);
    assert(withdraw_usd > 0u64);
    assert((withdraw_usd as u128) <= total_supply_usd_before_u128);
    let target_aleo_usd: u64 = withdraw_usd > sup_aleo_usd ? sup_aleo_usd : withdraw_usd;
    let burn_aleo_amt_raw: u64 = (((target_aleo_usd as u128) * (price_scale as u128) / (price_aleo as u128)) as u64);
    let burn_aleo_amt: u64 = burn_aleo_amt_raw > real_sup_aleo ? real_sup_aleo : burn_aleo_amt_raw;
    let burn_aleo_usd: u64 = (((burn_aleo_amt as u128) * (price_aleo as u128) / (price_scale as u128)) as u64);
    let rem_after_aleo: u64 = withdraw_usd > burn_aleo_usd ? withdraw_usd - burn_aleo_usd : 0u64;
    let target_usdcx_usd: u64 = rem_after_aleo > sup_usdcx_usd ? sup_usdcx_usd : rem_after_aleo;
    let burn_usdcx_amt_raw: u64 = (((target_usdcx_usd as u128) * (price_scale as u128) / (price_usdcx as u128)) as u64);
    let burn_usdcx_amt: u64 = burn_usdcx_amt_raw > real_sup_usdcx ? real_sup_usdcx : burn_usdcx_amt_raw;
    let burn_usdcx_usd: u64 = (((burn_usdcx_amt as u128) * (price_usdcx as u128) / (price_scale as u128)) as u64);
    let rem_after_usdcx: u64 = rem_after_aleo > burn_usdcx_usd ? rem_after_aleo - burn_usdcx_usd : 0u64;
    let target_usad_usd: u64 = rem_after_usdcx > sup_usad_usd ? sup_usad_usd : rem_after_usdcx;
    let burn_usad_amt_raw: u64 = (((target_usad_usd as u128) * (price_scale as u128) / (price_usad as u128)) as u64);
    let burn_usad_amt: u64 = burn_usad_amt_raw > real_sup_usad ? real_sup_usad : burn_usad_amt_raw;
    let burn_usad_usd: u64 = (((burn_usad_amt as u128) * (price_usad as u128) / (price_scale as u128)) as u64);
    let rem_after_usad: u64 = rem_after_usdcx > burn_usad_usd ? rem_after_usdcx - burn_usad_usd : 0u64;
    return rem_after_usad;
}

program test_lending_math.aleo {
    const PRICE_SCALE: u64 = 1_000_000u64;

    @test
    fn test_weighted_known() {
        let w: u64 = mirror_weighted_collateral_usd(10_000_000u64, PRICE_SCALE, 7_500u64);
        assert(w == 7_500_000u64);
    }

    @test
    fn test_health_cross_ok() {
        let wa: u64 = mirror_weighted_collateral_usd(20_000_000u64, PRICE_SCALE, 7_500u64);
        let wu: u64 = mirror_weighted_collateral_usd(10_000_000u64, PRICE_SCALE, 8_500u64);
        let wd: u64 = mirror_weighted_collateral_usd(0u64, PRICE_SCALE, 8_500u64);
        let total_collateral: u128 = (wa as u128) + (wu as u128) + (wd as u128);

        let debt_aleo: u64 = debt_usd_micro(0u64, PRICE_SCALE);
        let debt_usdcx: u64 = debt_usd_micro(0u64, PRICE_SCALE);
        let debt_usad: u64 = debt_usd_micro(0u64, PRICE_SCALE);
        let total_debt: u128 = (debt_aleo as u128) + (debt_usdcx as u128) + (debt_usad as u128);

        let borrow_amount: u64 = 10_000_000u64;
        let new_borrow_usd: u64 = new_borrow_usd_micro(borrow_amount, PRICE_SCALE);
        assert(total_debt + (new_borrow_usd as u128) <= total_collateral);
    }

    @test
    fn test_health_over_fail() {
        let weighted: u64 = mirror_weighted_collateral_usd(1_000_000u64, PRICE_SCALE, 7_500u64);
        let total_collateral: u128 = (weighted as u128);
        let total_debt: u128 = 0u128;
        let greedy_borrow_usd: u64 = 1_000_000u64;
        assert(!(total_debt + (greedy_borrow_usd as u128) <= total_collateral));
    }

    /// ALEO-only supply, USDCx payout — same shape as dashboard logs (`scaled` real sup ≈ 1e6 micro, prices ~42596 / 1e6).
    @test
    fn test_wd_xa_rem_log() {
        let rem: u64 = mirror_withdraw_rem_after_usad(
            1_000_000u64,
            0u64,
            0u64,
            42_596u64,
            PRICE_SCALE,
            PRICE_SCALE,
            40_000u64,
            PRICE_SCALE,
        );
        assert(rem == 1u64);
        assert(rem <= 3u64);
    }

    @noupgrade
    constructor() {}
}
