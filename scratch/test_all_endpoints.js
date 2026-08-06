import dotenv from 'dotenv';
dotenv.config();
import { KIS_KEYS, KIS_BASE_URL, getAccessToken } from '../lib/kisCore.js';
import axios from 'axios';

const symbol = '090430'; // 아모레퍼시픽

const endpoints = [
    { name: 'price (FHKST01010100)', url: '/uapi/domestic-stock/v1/quotations/inquire-price', method: 'get', params: { FID_COND_MRKT_DIV_CODE: 'J', FID_INPUT_ISCD: symbol }, tr_id: 'FHKST01010100' },
    { name: 'ratio (FHKST66430300)', url: '/uapi/domestic-stock/v1/finance/financial-ratio', method: 'get', params: { FID_COND_MRKT_DIV_CODE: 'J', FID_INPUT_ISCD: symbol, FID_DIV_CLS_CODE: '0' }, tr_id: 'FHKST66430300' },
    { name: 'consensus (HHKST668300C0)', url: '/uapi/domestic-stock/v1/quotations/estimate-perform', method: 'get', params: { FID_COND_MRKT_DIV_CODE: 'J', FID_INPUT_ISCD: symbol, SHT_CD: symbol }, tr_id: 'HHKST668300C0' },
    { name: 'income (FHKST66430200)', url: '/uapi/domestic-stock/v1/finance/income-statement', method: 'get', params: { FID_COND_MRKT_DIV_CODE: 'J', FID_INPUT_ISCD: symbol, FID_DIV_CLS_CODE: '0' }, tr_id: 'FHKST66430200' },
    { name: 'ccnl (FHKST01010300)', url: '/uapi/domestic-stock/v1/quotations/inquire-ccnl', method: 'get', params: { FID_COND_MRKT_DIV_CODE: 'J', FID_INPUT_ISCD: symbol }, tr_id: 'FHKST01010300' },
    { name: 'short (FHPST04830000)', url: '/uapi/domestic-stock/v1/quotations/daily-short-sale', method: 'get', params: { FID_COND_MRKT_DIV_CODE: 'J', FID_INPUT_ISCD: symbol, FID_INPUT_DATE_1: '20260601', FID_INPUT_DATE_2: '20260707' }, tr_id: 'FHPST04830000' },
    { name: 'credit (FHPST04760000)', url: '/uapi/domestic-stock/v1/quotations/daily-credit-balance', method: 'get', params: { FID_COND_MRKT_DIV_CODE: 'J', FID_INPUT_ISCD: symbol, FID_INPUT_DATE_1: '20260601', FID_INPUT_DATE_2: '20260707', FID_COND_SCR_DIV_CODE: '20476' }, tr_id: 'FHPST04760000' },
    { name: 'daily (FHKST03010100)', url: '/uapi/domestic-stock/v1/quotations/inquire-daily-itemchartprice', method: 'get', params: { FID_COND_MRKT_DIV_CODE: 'J', FID_INPUT_ISCD: symbol, FID_INPUT_DATE_1: '20260601', FID_INPUT_DATE_2: '20260707', FID_PERIOD_DIV_CODE: 'D', FID_ORG_ADJ_PRC: '1' }, tr_id: 'FHKST03010100' },
    { name: 'investor (FHKST01010900)', url: '/uapi/domestic-stock/v1/quotations/inquire-investor', method: 'get', params: { FID_COND_MRKT_DIV_CODE: 'J', FID_INPUT_ISCD: symbol }, tr_id: 'FHKST01010900' },
    { name: 'intraday (HHDFS76240000)', url: '/uapi/domestic-stock/v1/quotations/inquire-investor-trend-estimate', method: 'get', params: { FID_COND_MRKT_DIV_CODE: 'J', FID_INPUT_ISCD: symbol }, tr_id: 'HHDFS76240000' },
    { name: 'member trend (FHKST01010600)', url: '/uapi/domestic-stock/v1/quotations/inquire-member', method: 'get', params: { FID_COND_MRKT_DIV_CODE: 'J', FID_INPUT_ISCD: symbol }, tr_id: 'FHKST01010600' }
];

(async () => {
    for (let idx = 0; idx < KIS_KEYS.length; idx++) {
        console.log(`\n========================================`);
        console.log(`🔑 Key Index ${idx} 검증 시작`);
        console.log(`========================================`);
        
        const keyInfo = KIS_KEYS[idx];
        const token = await getAccessToken(idx);
        
        for (const ep of endpoints) {
            try {
                // Rate limit 방지용 딜레이
                await new Promise(r => setTimeout(r, 400));
                
                const res = await axios({
                    method: ep.method,
                    url: `${KIS_BASE_URL}${ep.url}`,
                    params: ep.params,
                    headers: {
                        'authorization': `Bearer ${token}`,
                        'appkey': keyInfo.appkey,
                        'appsecret': keyInfo.appsecret,
                        'tr_id': ep.tr_id
                    },
                    timeout: 5000
                });
                
                const rtCd = res.data?.rt_cd;
                const msg = res.data?.msg1 || '';
                if (rtCd === '0') {
                    console.log(`✅ [${ep.name}] 성공!`);
                } else {
                    console.warn(`⚠️ [${ep.name}] KIS 반환 코드 에러: rt_cd=${rtCd}, msg=${msg}`);
                }
            } catch (err) {
                console.error(`❌ [${ep.name}] HTTP 에러!`);
                console.error(`   - Status: ${err.response?.status}`);
                console.error(`   - Data: ${JSON.stringify(err.response?.data || err.message)}`);
            }
        }
    }
    process.exit(0);
})();
