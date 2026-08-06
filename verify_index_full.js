import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const KIS_BASE_URL = 'https://openapi.koreainvestment.com:9443';

async function verifyAllIndices() {
    try {
        const tokenRes = await axios.post(`${KIS_BASE_URL}/oauth2/tokenP`, {
            grant_type: 'client_credentials',
            appkey: process.env.VITE_KIS_APP_KEY,
            appsecret: process.env.VITE_KIS_APP_SECRET
        });
        const token = tokenRes.data.access_token;
        console.log('Token fetched.');

        const codes = ['0001', '1001', '2001', '001', '101', '201'];
        const results = [];

        for (const code of codes) {
            console.log(`\nTesting Code ${code}...`);
            // Current Price
            try {
                const res = await axios.get(`${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/inquire-index-price`, {
                    params: { fid_cond_mrkt_div_code: 'U', fid_input_iscd: code },
                    headers: {
                        'authorization': `Bearer ${token}`,
                        'appkey': process.env.VITE_KIS_APP_KEY,
                        'appsecret': process.env.VITE_KIS_APP_SECRET,
                        'tr_id': 'FHPST01300000'
                    }
                });
                if (res.data.output) {
                    console.log(`[Current] ${code}: ${res.data.output.bstp_nm} -> Price: ${res.data.output.bstp_nm_prpr}`);
                } else {
                    console.log(`[Current] ${code}: FAILED (${res.data.msg1})`);
                }
            } catch (e) {
                console.log(`[Current] ${code}: ERROR ${e.message}`);
            }

            // Time Chart (Intraday)
            try {
                const res = await axios.get(`${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/inquire-time-indexchartprice`, {
                    params: {
                        FID_COND_MRKT_DIV_CODE: 'U',
                        FID_INPUT_ISCD: code,
                        FID_INPUT_HOUR_1: '153000',
                        FID_PW_DATA_INCU_YN: 'Y'
                    },
                    headers: {
                        'authorization': `Bearer ${token}`,
                        'appkey': process.env.VITE_KIS_APP_KEY,
                        'appsecret': process.env.VITE_KIS_APP_SECRET,
                        'tr_id': 'FHKUP03500100'
                    }
                });
                if (res.data.output1) {
                    console.log(`[Chart] ${code}: ${res.data.output1.bstp_nm} -> OK`);
                } else {
                    console.log(`[Chart] ${code}: FAILED (${res.data.msg1})`);
                }
            } catch (e) {
                console.log(`[Chart] ${code}: ERROR ${e.message}`);
            }
        }
    } catch (e) {
        console.error('Master fetch failed:', e.message);
    }
}

verifyAllIndices();
