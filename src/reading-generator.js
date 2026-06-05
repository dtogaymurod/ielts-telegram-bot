/**
 * Reading Test Generator
 * Orchestrates AI generation and HTML templating
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { generateReadingTest } from './gemini.js';
import { getContentFromDatabase } from './content-selector.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATE_PATH = join(__dirname, '..', 'templates', 'multiple_choice_template.html');
const OUTPUT_FILENAME = 'daily_reading_test.html';
const OUTPUT_PATH = join(__dirname, '..', 'public', OUTPUT_FILENAME);

const LETTERS = ['A', 'B', 'C', 'D'];

/**
 * Generates an HTML reading test
 * @returns {Promise<object|null>} The generated test data (title, filename, etc)
 */
export async function generateDailyReadingTest() {
  console.log('🤖 Requesting AI for new reading test...');
  let aiTest = await generateReadingTest();

  if (!aiTest) {
    console.log('⚠️ AI test generation failed. Falling back to database...');
    const dbTest = getContentFromDatabase('reading-tests');
    if (dbTest) return dbTest; // returns object with { title, filename, type }
    return null;
  }

  console.log('✅ AI generated reading test content successfully. Building HTML...');
  
  try {
    // 1. Format Passage HTML
    const passageHtml = aiTest.paragraphs
      .map((p, index) => `<p><span class="plabel">${LETTERS[index] || ''}</span>${p}</p>`)
      .join('\n            ');

    // 2. Format Questions HTML and Answers JSON
    const answersObj = {};
    const questionsHtml = aiTest.questions
      .map((qObj, index) => {
        const qNum = index + 1;
        // Map correct index (0-3) to letter (A-D)
        answersObj[`q${qNum}`] = LETTERS[qObj.correct_index];

        const optionsHtml = qObj.options
          .map((optText, optIdx) => {
            const letter = LETTERS[optIdx];
            return `<label class="rlabel"><input type="radio" name="q${qNum}" value="${letter}"> ${letter}) ${optText}</label>`;
          })
          .join('');

        return `<div class="qblock"><div class="qtext">${qObj.question}</div><div class="opts">${optionsHtml}</div><div class="fb" id="f${qNum}"></div></div>`;
      })
      .join('\n            ');

    const answersJson = JSON.stringify(answersObj);

    // 3. Read template
    let htmlContent = readFileSync(TEMPLATE_PATH, 'utf-8');

    // 4. Replace placeholders
    htmlContent = htmlContent
      .replace('{{TITLE}}', aiTest.title)
      .replace('{{PASSAGE_HTML}}', passageHtml)
      .replace('{{QUESTIONS_HTML}}', questionsHtml)
      .replace('{{ANSWERS_JSON}}', answersJson);

    // 5. Save file
    writeFileSync(OUTPUT_PATH, htmlContent, 'utf-8');
    console.log(`✅ Saved daily reading test to ${OUTPUT_PATH}`);

    return {
      title: aiTest.title,
      type: 'Multiple Choice (AI Generated)',
      filename: OUTPUT_FILENAME
    };
  } catch (error) {
    console.error('❌ Error building reading test HTML:', error);
    return null;
  }
}
