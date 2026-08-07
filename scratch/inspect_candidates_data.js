import fs from 'fs';
import path from 'path';

const cachePath = path.join(process.cwd(), 'ai_cache.json');
console.log('Checking cache file:', cachePath);

if (!fs.existsSync(cachePath)) {
  console.log('❌ ai_cache.json file does not exist locally.');
  process.exit(1);
}

try {
  const content = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
  console.log('✅ ai_cache.json loaded successfully.');
  console.log('Top-level keys:', Object.keys(content));

  const pulse = content.pulse || content.data?.pulse || content;
  console.log('\n--- AI Pulse Overview ---');
  console.log('Theme:', pulse.theme || pulse.data?.theme);
  console.log('Market State:', pulse.marketState || pulse.data?.marketState);
  console.log('TOP PICK Stock:', pulse.stock || pulse.data?.stock, '(', pulse.symbol || pulse.data?.symbol, ')');

  const candidates = pulse.candidates || pulse.data?.candidates || content.candidates || [];
  console.log('\n--- 25 Candidates Count Check ---');
  console.log(`Total Candidates Count: ${candidates.length}`);

  if (candidates.length === 0) {
    console.log('❌ No candidates found in cache!');
  } else {
    let missingMetricsCount = 0;
    let missingScoresCount = 0;
    let missingVetoReasonCount = 0;

    candidates.forEach((c, idx) => {
      if (!c.metrics) missingMetricsCount++;
      if (!c.scores) missingScoresCount++;
      if (c.isVetoed && !c.vetoReason) missingVetoReasonCount++;
    });

    console.log(`- Missing Metrics: ${missingMetricsCount}`);
    console.log(`- Missing Scores: ${missingScoresCount}`);
    console.log(`- Missing Veto Reason on Vetoed items: ${missingVetoReasonCount}`);

    console.log('\n--- Sample Candidates (Top 5 & Bottom 2) ---');
    const sampleList = [...candidates.slice(0, 5), ...candidates.slice(-2)];
    sampleList.forEach((c, idx) => {
      console.log(`\n[Item ${idx + 1}] Name: ${c.name} (${c.code})`);
      console.log(`  - Total Score: ${c.totalScore}`);
      console.log(`  - Price: ${c.price?.toLocaleString()} KRW (Change: ${c.change}%)`);
      console.log(`  - Is Vetoed: ${c.isVetoed}`);
      console.log(`  - Veto Reason: ${c.vetoReason ? c.vetoReason.substring(0, 80) + '...' : '(Pass)'}`);
      console.log(`  - Raw Metrics: Strength=${c.metrics?.strength}%, ShortRatio=${c.metrics?.shortRatio}%, Disp5=${c.metrics?.disparity5}%, Disp1=${c.metrics?.disparity1}%, Credit=${c.metrics?.creditBalance}%`);
      console.log(`  - Detail Scores: StrengthScore=${c.scores?.strengthScore}, SupplyScore=${c.scores?.supplyScore}, TrendScore=${c.scores?.trendScore}`);
    });
  }
} catch (e) {
  console.error('❌ Error parsing ai_cache.json:', e);
}
