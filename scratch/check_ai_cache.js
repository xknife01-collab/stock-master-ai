import fs from 'fs';

if (fs.existsSync('ai_cache.json')) {
  const content = JSON.parse(fs.readFileSync('ai_cache.json', 'utf8'));
  console.log('ai_cache.json pulse signal:', JSON.stringify(content.pulse?.prediction || content.pulse?.signal || content.pulse, null, 2));
} else {
  console.log('ai_cache.json does not exist');
}
