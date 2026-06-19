import fs from 'fs';
import path from 'path';
import { 
  generateVocabulary, 
  generateWritingTip, 
  generateSpeakingTip, 
  generateReadingListeningStrategy, 
  generateBandScoreTip, 
  generateMotivation 
} from '../src/gemini.js';

// Using native Node.js --env-file flag instead of dotenv
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const contentTypes = [
  { name: 'vocabulary', generator: generateVocabulary },
  { name: 'writing-tips', generator: generateWritingTip },
  { name: 'speaking-tips', generator: generateSpeakingTip },
  { name: 'reading-listening', generator: generateReadingListeningStrategy },
  { name: 'band-score-tips', generator: generateBandScoreTip },
  { name: 'motivation', generator: generateMotivation }
];

async function main() {
  console.log('🔄 Boshlandi: Barcha bazalarni tabiiy matnlar bilan tozalab yangilaymiz...');
  
  for (const type of contentTypes) {
    console.log(`\n📦 Baza yangilanmoqda: ${type.name}.json`);
    const items = [];
    
    // Generate 3 natural fallbacks for each category
    for (let i = 1; i <= 3; i++) {
      console.log(`  ⏳ Generatsiya ${i}/3...`);
      // Add delay to prevent rate limit (15 requests per minute limit)
      await new Promise(r => setTimeout(r, 6000));
      
      let text = await type.generator();
      
      // If generation fails, try one more time
      if (!text) {
        text = await type.generator();
      }
      
      if (text) {
        items.push({
          id: `${type.name}_${Date.now()}_${i}`,
          text: text,
          used: false
        });
      }
    }
    
    const dbPath = path.join(__dirname, `../content/${type.name}.json`);
    fs.writeFileSync(dbPath, JSON.stringify(items, null, 2));
    console.log(`✅ ${type.name}.json saqlandi! (${items.length} ta post)`);
  }
  
  console.log('\n🎉 Barcha bazalar muvaffaqiyatli yangilandi!');
}

main().catch(console.error);
