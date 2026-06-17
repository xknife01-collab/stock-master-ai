import { syncSingleStock } from '../lib/stockSync.js';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
    console.log("----------------------------------------");
    console.log("Syncing SK Hynix (000660)...");
    const sk = await syncSingleStock('000660');
    console.log("SK Hynix Sync Result:");
    console.log(JSON.stringify({
        name: sk?.fundamental?.name || "SK Hynix",
        price: sk?.fundamental?.price,
        strength: sk?.advanced?.strength,
        transactionValue: sk?.advanced?.transactionValue,
        prevTransactionValue: sk?.advanced?.prevTransactionValue,
        shortRatio: sk?.advanced?.shortRatio
    }, null, 2));
    
    console.log("----------------------------------------");
    console.log("Syncing Isu Petasys (007660)...");
    const isu = await syncSingleStock('007660');
    console.log("Isu Petasys Sync Result:");
    console.log(JSON.stringify({
        name: isu?.fundamental?.name || "Isu Petasys",
        price: isu?.fundamental?.price,
        strength: isu?.advanced?.strength,
        transactionValue: isu?.advanced?.transactionValue,
        prevTransactionValue: isu?.advanced?.prevTransactionValue,
        shortRatio: isu?.advanced?.shortRatio
    }, null, 2));
    console.log("----------------------------------------");
}

run();
