import { KIS_BASE_URL, getAccessToken, getKisHeaders, kisRequest } from '../lib/kisCore.js';

(async () => {
    try {
        const token = await getAccessToken();
        console.log("Calling foreign-institution-total with FID_INPUT_ISCD = 000270...");
        const res = await kisRequest({
            method: 'get',
            url: `${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/foreign-institution-total`,
            params: {
                FID_COND_MRKT_DIV_CODE: 'V',
                FID_COND_SCR_DIV_CODE: '16449',
                FID_INPUT_ISCD: '000270', // Kia code
                FID_DIV_CLS_CODE: '0',
                FID_RANK_SORT_CLS_CODE: '0',
                FID_ETC_CLS_CODE: '0'
            },
            headers: { ...getKisHeaders('FHPTJ04400000'), 'authorization': `Bearer ${token}` }
        });
        
        console.log("Response rt_cd:", res.data?.rt_cd);
        console.log("Response msg1:", res.data?.msg1);
        console.log("Response output length:", res.data?.output?.length);
        if (res.data?.output && res.data.output.length > 0) {
            console.log("First item:", JSON.stringify(res.data.output[0], null, 2));
        }
    } catch (e) {
        console.error(e);
    }
})();
