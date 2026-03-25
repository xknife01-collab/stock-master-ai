import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const KIS_BASE_URL = 'https://openapi.koreainvestment.com:9443';

async function huntForCorrectCodes() {
    try {
        const tokenRes = await axios.post(`${KIS_BASE_URL}/oauth2/tokenP`, {
            grant_type: 'client_credentials',
            appkey: process.env.VITE_KIS_APP_KEY,
            appsecret: process.env.VITE_KIS_APP_SECRET
        });
        const token = tokenRes.data.access_token;
        
        const kospiRes = await axios.get(`${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/inquire-index-price`, {
            params: { fid_cond_mrkt_div_code: 'U', fid_input_iscd: '0001' },
            headers: { 'authorization': `Bearer ${token}`, 'appkey': process.env.VITE_KIS_APP_KEY, 'appsecret': process.env.VITE_KIS_APP_SECRET, 'tr_id': 'FHPST01300000' }
        });
        const kospiPrice = kospiRes.data.output.bstp_nm_prpr;
        console.log(`KOSPI (0001) Price: ${kospiPrice}`);

        const suspects = ['1001', '2001', '0101', '1101', '001', '101', '201', '002', '102'];
        for (const code of suspects) {
            try {
                const res = await axios.get(`${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/inquire-index-price`, {
                    params: { fid_cond_mrkt_div_code: 'U', fid_input_iscd: code },
                    headers: { 'authorization': `Bearer ${token}`, 'appkey': process.env.VITE_KIS_APP_KEY, 'appsecret': process.env.VITE_KIS_APP_SECRET, 'tr_id': 'FHPST01300000' }
                });
                if (res.data.output) {
                    const price = res.data.output.bstp_nm_prpr;
                    const name = res.data.output.bstp_nm;
                    console.log(`Code ${code}: ${name} -> Price: ${price} ${price === kospiPrice ? '(SAME AS KOSPI)' : ''}`);
                }
            } catch (e) {}
        }
    } catch (e) { console.error(e.message); }
}
huntForCorrectCodes();
