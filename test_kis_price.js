import axios from 'axios';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Mock kisCore logic
const KIS_BASE_URL = "https://openapi.koreainvestment.com:9443";
const TOKEN_FILE = path.join(__dirname, 'kis_token.json');

async function getAccessToken() {
    if (fs.existsSync(TOKEN_FILE)) {
        const tokenData = JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8'));
        return tokenData.accessToken;
    }
    return null;
}

const getKisHeaders = (trId) => ({
    'content-type': 'application/json',
    'appkey': process.env.VITE_KIS_APP_KEY,
    'appsecret': process.env.VITE_KIS_APP_SECRET,
    'tr_id': trId,
    'custtype': 'P'
});

async function testPrice(symbol) {
    try {
        const token = await getAccessToken();
        const response = await axios.get(`${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/inquire-price`, {
            params: { FID_COND_MRKT_DIV_CODE: 'J', FID_INPUT_ISCD: symbol },
            headers: {
                ...getKisHeaders('FHKST01010100'),
                'authorization': `Bearer ${token}`
            }
        });
        console.log(`--- Result for ${symbol} ---`);
        console.log("Status:", response.status);
        if (response.data && response.data.output) {
            console.log("Output:", JSON.stringify(response.data.output, null, 2));
        } else {
            console.log("Response Body:", JSON.stringify(response.data, null, 2));
        }
    } catch (e) {
        console.error("Fetch failed:", e.message);
    }
}

async function runTests() {
    await testPrice("005930"); // Samsung Electronics
    await testPrice("005380"); // Hyundai Motor
    await testPrice("000660"); // SK Hynix
}

runTests();
