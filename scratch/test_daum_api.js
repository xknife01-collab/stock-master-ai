import axios from 'axios';

(async () => {
    try {
        const response = await axios.get('https://finance.daum.net/api/quotes/A000270', {
            headers: {
                'Referer': 'https://finance.daum.net',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });
        console.log("Daum Response Data:", JSON.stringify(response.data, null, 2));
    } catch (e) {
        console.error("Daum API error:", e.message);
    }
})();
