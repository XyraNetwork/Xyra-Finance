program test_usdcx_bridge.aleo;

record UsdcRecord:
    owner as address.private;
    amount as u64.private;

function transfer_private:
    input r0 as UsdcRecord.record;
    input r1 as u64.public;
    input r2 as address.public;
    gte r0.amount r1 into r3;
    assert.eq r3 true;
    sub r0.amount r1 into r4;
    cast r0.owner r4 into r5 as UsdcRecord.record;
    cast r2 r1 into r6 as UsdcRecord.record;
    output r5 as UsdcRecord.record;
    output r6 as UsdcRecord.record;

function dummy:
    output 0u8 as u8.private;
