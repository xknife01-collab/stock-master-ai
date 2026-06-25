import axios from 'axios';

console.log("⚡ Calling /api/ai/pulse...");
axios.get('http://localhost:5000/api/ai/pulse')
    .then(res => {
        console.log("✅ Success! Status:", res.status);
        const data = res.data?.data || res.data?.aiSignal?.data || res.data?.aiSignal || res.data;
        console.log("Response fields:", Object.keys(data || {}));
        if (data.candidates) {
            console.log("Candidates array length:", data.candidates.length);
            console.log("First candidate:", JSON.stringify(data.candidates[0], null, 2));
            console.log("VETOed candidates:", data.candidates.filter(c => c.isVetoed).map(c => `${c.name} (${c.vetoReason})`));
            console.log("Supply Golden Cross candidates:", data.candidates.filter(c => c.isSupplyGoldenCross).map(c => c.name));
        } else {
            console.log("⚠️ No candidates array found in the response!");
        }
    })
    .catch(err => {
        console.error("❌ Failed:", err.message);
    });
