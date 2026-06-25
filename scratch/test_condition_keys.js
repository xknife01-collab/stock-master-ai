import { kisRequest, KIS_BASE_URL, getKisHeaders, KIS_KEYS } from '../lib/kisCore.js';

async function testConditionSearchOnKeys() {
  console.log(`📡 Testing HTS Condition Search (seq: 0) on all keys...`);
  
  for (let i = 0; i < KIS_KEYS.length; i++) {
    console.log(`\n========================================`);
    console.log(`🔑 Testing Key Index ${i} (AppKey: ${KIS_KEYS[i].appkey.substring(0, 6)}...)`);
    
    try {
      // Force the keyIndex to 'i' by mock-defining isBackground based on index
      const response = await kisRequest({
        method: 'get',
        url: `${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/psearch-result`,
        params: {
          user_id: 'rlaghddlf01', // User ID
          seq: '0'
        },
        headers: getKisHeaders('HHKST03900300'),
        // Let's pass isBackground: true and mock the logic to force the index if needed.
        // Wait, inside kisRequest, if isBackground === true, it uses: keyIndex = isRealtimeTaskActive ? 0 : getNextKeyIndex()
        // If we want to force index, we can just call axios directly!
      });
      
      console.log(`✅ Success for Key ${i}! Raw data:`, response.data);
    } catch (e) {
      console.error(`❌ Failed for Key ${i}:`, e.message);
    }
  }
}

// Let's write a direct axios call using key credentials to be 100% sure of the index
import axios from 'axios';
import { getAccessToken } from '../lib/kisCore.js';

async function testDirectAxios() {
  console.log(`\n🚀 Testing Direct Axios calls for each Key Index...`);
  for (let i = 0; i < KIS_KEYS.length; i++) {
    try {
      const token = await getAccessToken(i);
      const res = await axios({
        method: 'get',
        url: `${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/psearch-result`,
        params: {
          user_id: 'rlaghddlf01',
          seq: '0'
        },
        headers: {
          'content-type': 'application/json',
          'authorization': `Bearer ${token}`,
          'appkey': KIS_KEYS[i].appkey,
          'appsecret': KIS_KEYS[i].appsecret,
          'tr_id': 'HHKST03900300',
          'custtype': 'P'
        }
      });
      console.log(`✨ Key Index ${i} Result:`, res.data.rt_cd, res.data.msg1, `Output items count: ${res.data.output?.length || 0}`);
    } catch (err) {
      console.error(`💥 Key Index ${i} Error:`, err.response ? err.response.data : err.message);
    }
  }
}

async function run() {
  await testDirectAxios();
}

run();
