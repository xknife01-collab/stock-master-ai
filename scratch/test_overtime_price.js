import dotenv from 'dotenv';
dotenv.config();

import { KIS_BASE_URL, getAccessToken, getKisHeaders, kisRequest } from '../lib/kisCore.js';

(async () => {
    try {
        const token = await getAccessToken();
        const symbol = '000270'; // Kia
        
        // Endpoint 1: inquire-overtime-price (시간외 단일가 시세)
        console.log("--- Testing inquire-overtime-price ---");
        try {
            const res = await kisRequest({
                method: 'get',
                url: `${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/inquire-overtime-price`,
                params: { FID_COND_MRKT_DIV_CODE: 'J', FID_INPUT_ISCD: symbol },
                headers: {
                    ...getKisHeaders('FHPST02300000'),
                    'authorization': `Bearer ${token}`
                }
            });
            console.log("inquire-overtime-price keys:", Object.keys(res.data));
            if (res.data.output) {
                console.log("inquire-overtime-price output keys:", Object.keys(res.data.output));
                console.log("Sample values:");
                console.log("ovtm_untp_prpr:", res.data.output.ovtm_untp_prpr); // 시간외 단일가 현재가
                console.log("ovtm_untp_prdy_vrss:", res.data.output.ovtm_untp_prdy_vrss); // 시간외 단일가 전일대비
                console.log("ovtm_untp_prdy_ctrt:", res.data.output.ovtm_untp_prdy_ctrt); // 시간외 단일가 전일대비율
                console.log("ovtm_untp_vol:", res.data.output.ovtm_untp_vol); // 시간외 단일가 거래량
                console.log("ovtm_untp_tr_pbmn:", res.data.output.ovtm_untp_tr_pbmn); // 시간외 단일가 거래대금
            }
        } catch (e1) {
            console.error("inquire-overtime-price error:", e1.message);
        }

        // Endpoint 2: inquire-time-itemconclusion (시간외 단일가 체결)
        console.log("\n--- Testing inquire-time-itemconclusion ---");
        try {
            const res = await kisRequest({
                method: 'get',
                url: `${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/inquire-time-itemconclusion`,
                params: { FID_COND_MRKT_DIV_CODE: 'J', FID_INPUT_ISCD: symbol, FID_ETC_CLS_CODE: '0' },
                headers: {
                    ...getKisHeaders('FHPST02301000'),
                    'authorization': `Bearer ${token}`
                }
            });
            console.log("inquire-time-itemconclusion keys:", Object.keys(res.data));
            if (res.data.output && res.data.output.length > 0) {
                console.log("Output item count:", res.data.output.length);
                console.log("First item keys:", Object.keys(res.data.output[0]));
                console.log("First item sample values:");
                console.log("stck_cntg_hour:", res.data.output[0].stck_cntg_hour); // 체결 시간
                console.log("ovtm_untp_prpr:", res.data.output[0].ovtm_untp_prpr); // 시간외 단일가 체결가
                console.log("ovtm_untp_prdy_vrss:", res.data.output[0].ovtm_untp_prdy_vrss); // 시간외 단일가 전일대비
                console.log("ovtm_untp_prdy_ctrt:", res.data.output[0].ovtm_untp_prdy_ctrt); // 시간외 단일가 전일대비율
                console.log("ovtm_untp_cntg_vol:", res.data.output[0].ovtm_untp_cntg_vol); // 시간외 단일가 체결량
                console.log("cntg_vol_power:", res.data.output[0].cntg_vol_power); // 체결강도
            }
        } catch (e2) {
            console.error("inquire-time-itemconclusion error:", e2.message);
        }

    } catch (e) {
        console.error(e);
    }
})();
