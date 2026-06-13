import test from 'node:test';
import assert from 'node:assert';
import dotenv from 'dotenv';
dotenv.config();

import { fetchStockFullDetailFromKIS } from '../lib/kisCore.js';

test('Data Integrity Shield - Samsung Electronics (005930) Sanity Check', async (t) => {
    console.log("Running integrity tests against real KIS endpoints...");
    
    const result = await fetchStockFullDetailFromKIS('005930');
    
    assert.ok(result, "Result object should be returned");
    assert.ok(result.fundamental, "Fundamental data should exist");
    assert.ok(result.advanced, "Advanced metrics should exist");
    
    const adv = result.advanced;
    console.log("Samsung test result metrics:", adv);
    
    // 1. Volume Strength (체결강도)
    assert.ok(adv.strength, "Strength field must exist");
    assert.ok(!isNaN(parseFloat(adv.strength)), `Strength must be numeric, got: ${adv.strength}`);
    
    // 2. Disparity (이격도)
    assert.ok(adv.disparity5, "Disparity 5D must exist");
    assert.ok(adv.disparity20, "Disparity 20D must exist");
    assert.ok(!isNaN(parseFloat(adv.disparity5)), `Disparity 5D must be numeric, got: ${adv.disparity5}`);
    assert.ok(!isNaN(parseFloat(adv.disparity20)), `Disparity 20D must be numeric, got: ${adv.disparity20}`);
    
    // 3. Short Ratio (공매도 비중)
    assert.ok(adv.shortRatio, "Short ratio must exist");
    assert.ok(!isNaN(parseFloat(adv.shortRatio)), `Short ratio must be numeric, got: ${adv.shortRatio}`);
    
    // 4. Credit Balance (신용융자 잔고율)
    assert.ok(adv.creditBalance, "Credit balance must exist");
    assert.ok(!isNaN(parseFloat(adv.creditBalance)), `Credit balance must be numeric, got: ${adv.creditBalance}`);
    
    // 5. Investor Stats (수급)
    assert.ok(adv.investor, "Investor stats must exist");
    assert.strictEqual(typeof adv.investor.foreign1D, 'number', "Foreign 1D flow must be a number");
    assert.strictEqual(typeof adv.investor.organ1D, 'number', "Organ 1D flow must be a number");
});
