import { fetchStockInvestorTrend, fetchStockIntradayInvestorEstimate } from '../lib/kisCore.js';

(async () => {
    try {
        const symbol = "005930";
        console.log(`Testing detail API merge logic for ${symbol}...`);
        
        const investorRes = await fetchStockInvestorTrend(symbol);
        const intradayRes = await fetchStockIntradayInvestorEstimate(symbol);
        
        console.log("investorRes stats:", investorRes?.stats);
        console.log("intradayRes:", intradayRes);
        
        let investorStats = investorRes?.stats || null;
        if (investorStats) {
            console.log("Initially investorStats has: foreign1D =", investorStats.foreign1D, ", organ1D =", investorStats.organ1D);
            if (investorStats.foreign1D === 0 && investorStats.organ1D === 0 && intradayRes) {
                console.log("Merging intradayRes into investorStats...");
                investorStats.foreign1D = intradayRes.foreign;
                investorStats.organ1D = intradayRes.organ;
                investorStats.personal1D = intradayRes.personal;
            } else {
                console.log("Merge condition not met. Why? foreign1D =", investorStats.foreign1D, ", organ1D =", investorStats.organ1D, ", intradayRes =", !!intradayRes);
            }
        } else {
            console.log("investorStats is null.");
        }
        
        console.log("Final investorStats:", investorStats);
    } catch (e) {
        console.error(e);
    }
})();
