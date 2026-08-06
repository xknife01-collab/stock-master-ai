import axios from 'axios';

const testStockDetail = async () => {
    const symbol = '000660'; // SK하이닉스
    
    console.log(`⚡ Testing /api/stock/${symbol} (current price)...`);
    let start = Date.now();
    try {
        const res = await axios.get(`http://localhost:5000/api/stock/${symbol}`);
        console.log(`✅ Price success! Time taken: ${((Date.now() - start)/1000).toFixed(2)}s. Price:`, res.data.price);
    } catch (e) {
        console.error('❌ Price request failed:', e.message);
    }

    console.log(`⚡ Testing /api/stock/history/${symbol}?range=1D (history chart)...`);
    start = Date.now();
    try {
        const res = await axios.get(`http://localhost:5000/api/stock/history/${symbol}?range=1D`);
        console.log(`✅ History success! Time taken: ${((Date.now() - start)/1000).toFixed(2)}s. Data length:`, res.data.length);
    } catch (e) {
        console.error('❌ History request failed:', e.message);
    }

    console.log(`⚡ Testing /api/stock-detail/detail/${symbol}?force=true (detail info with force)...`);
    start = Date.now();
    try {
        const res = await axios.get(`http://localhost:5000/api/stock-detail/detail/${symbol}?force=true`);
        console.log(`✅ Detail success! Time taken: ${((Date.now() - start)/1000).toFixed(2)}s. Fundamental data keys:`, Object.keys(res.data.fundamental || {}));
    } catch (e) {
        console.error('❌ Detail request failed:', e.message);
    }

    console.log(`⚡ Testing /api/condition-list (condition list)...`);
    start = Date.now();
    try {
        const res = await axios.get(`http://localhost:5000/api/condition-list`);
        console.log(`✅ Condition list success! Time taken: ${((Date.now() - start)/1000).toFixed(2)}s. Items count:`, res.data.length);
    } catch (e) {
        console.error('❌ Condition list request failed:', e.message);
    }

    console.log(`⚡ Testing /api/condition-search/0 (condition search)...`);
    start = Date.now();
    try {
        const res = await axios.get(`http://localhost:5000/api/condition-search/0`);
        console.log(`✅ Condition search success! Time taken: ${((Date.now() - start)/1000).toFixed(2)}s. Stocks:`, res.data);
    } catch (e) {
        console.error('❌ Condition search request failed:', e.message);
    }
};

testStockDetail();
