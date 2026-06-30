import { GoogleAuth } from 'google-auth-library';
import axios from 'axios';

async function main() {
    try {
        const auth = new GoogleAuth({
            keyFile: './stock-ai-22968-fb038f8d1e7f.json',
            scopes: ['https://www.googleapis.com/auth/cloud-platform']
        });
        const client = await auth.getClient();
        const tokenResponse = await client.getAccessToken();
        const accessToken = tokenResponse.token;
        
        console.log('Fetching Cloud Run services in us-central1...');
        const url = 'https://us-central1-run.googleapis.com/apis/serving.knative.dev/v1/namespaces/stock-ai-22968/services';
        const res = await axios.get(url, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Accept': 'application/json'
            }
        });
        const services = res.data.items || [];
        if (services.length === 0) {
            console.log('No Cloud Run services found.');
        }
        services.forEach(svc => {
            console.log(`Service: ${svc.metadata.name}`);
            console.log(`URL: ${svc.status.url}`);
        });
    } catch (err) {
        console.error('Error fetching services:', err.response ? JSON.stringify(err.response.data, null, 2) : err.message);
    }
}
main();
