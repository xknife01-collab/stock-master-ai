import { fetchStockChartFromKIS, getAccessToken } from '../lib/kisCore.js';
import axios from 'axios';
import { KIS_BASE_URL, getKisHeaders } from '../lib/kisCore.js';

async function testPaging() {
    try {
        await getAccessToken();
        const symbol = '005930'; // Samsung Electronics
        
        console.log('--- Fetching latest 1D chart (no hour param) ---');
        const r1 = await fetchStockChartFromKIS(symbol, '1D');
        console.log('Result count:', r1.length);
        if (r1.length > 0) {
            console.log('Earliest date in r1:', r1[0].date);
            console.log('Latest date in r1:', r1[r1.length - 1].date);
        }

        // Now try calling KIS directly with FID_INPUT_HOUR_1
        const commonHeaders = getKisHeaders('FHKST03010200');
        const token = await getAccessToken();
        
        // Let's page back from the earliest hour in r1 (e.g. if earliest is 09:26, page back using 092500)
        let earliestTime = '092500';
        if (r1.length > 0) {
            const firstHourStr = r1[0].date.replace(':', '') + '00';
            earliestTime = firstHourStr;
        }
        
        console.log(`\n--- Fetching with FID_INPUT_HOUR_1 = ${earliestTime} ---`);
        const response = await axios.get(`${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/inquire-time-itemchartprice`, {
            params: {
                FID_COND_MRKT_DIV_CODE: 'J',
                FID_INPUT_ISCD: symbol,
                FID_INPUT_HOUR_1: earliestTime,
                FID_ETC_CLS_CODE: '', 
                FID_PW_DATA_INCU_YN: 'N'
            },
            headers: {
                ...commonHeaders,
                'authorization': `Bearer ${token}`
            }
        });

        if (response.data.rt_cd === '0') {
            const output2 = response.data.output2 || [];
            console.log('Direct response output2 count:', output2.length);
            const mapped = output2.reverse().map(item => {
                const fullTimeStr = item.stck_cntg_hour || '';
                return {
                    date: `${fullTimeStr.slice(0, 2)}:${fullTimeStr.slice(2, 4)}`,
                    price: parseFloat(item.stck_prpr) || 0
                };
            });
            console.log('Mapped count:', mapped.length);
            if (mapped.length > 0) {
                console.log('Earliest date in mapped:', mapped[0].date);
                console.log('Latest date in mapped:', mapped[mapped.length - 1].date);
            }
        } else {
            console.error('API Error:', response.data.msg1);
        }

    } catch (e) {
        console.error('Test failed:', e);
    }
}

testPaging();
