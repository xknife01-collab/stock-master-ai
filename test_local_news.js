import axios from 'axios';

async function checkLocalApi() {
    try {
        const response = await axios.get('http://localhost:5000/api/news');
        console.log('Success! News received:', response.data.length);
        console.log(response.data.slice(0, 2));
    } catch (e) {
        console.error('Error:', e.message);
    }
}

checkLocalApi();
