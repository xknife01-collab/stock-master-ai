import fs from 'fs';

let raw = fs.readFileSync('veto_metrics.json', 'utf8');

const data = JSON.parse(raw);

const order = [
    '196170', // 알테오젠
    '000660', // SK하이닉스
    '105560', // KB금융
    '000990', // DB하이텍
    '055550', // 신한지주
    '058470', // 리노공업
    '042700', // 한미반도체
    '068270', // 셀트리온
    '000270'  // 기아
];

const sorted = order.map(sym => data.find(item => item.symbol === sym)).filter(Boolean);

console.log('| 종목명 (코드) | 현재가 (원) | 체결강도 (%) | 20일이격도 (%) | 5일이격도 (%) | 공매도비중 (%) | 정배열/추세 | ROE (%) | 부채비율 (%) | PBR (배) | 거래대금 (억원) |');
console.log('| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |');

sorted.forEach(row => {
    const name = row.fundamental?.name || row.symbol;
    const sym = row.symbol;
    const price = row.fundamental?.price || '0';
    
    const adv = row.advanced || {};
    const tech = adv.technical || {};
    const fund = row.fundamental || {};
    
    const strength = adv.strength !== undefined ? adv.strength : '-';
    const disp20 = adv.disparity20 !== undefined ? adv.disparity20 : '-';
    const disp5 = adv.disparity5 !== undefined ? adv.disparity5 : '-';
    const short = adv.shortRatio !== undefined ? adv.shortRatio : '-';
    const ma = tech.maAlignment || '혼조세';
    
    const roe = fund.roe || '-';
    const debt = fund.debtRatio || '-';
    const pbr = fund.pbr || '-';
    
    const txVal = adv.transactionValue ? Math.round(adv.transactionValue / 100000000) : 0;
    
    console.log(`| ${name} (${sym}) | ${parseInt(price).toLocaleString()} | ${strength} | ${disp20} | ${disp5} | ${short} | ${ma} | ${roe} | ${debt} | ${pbr} | ${txVal.toLocaleString()} |`);
});
