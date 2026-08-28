/**
 * Single-Part Speaking Masterclass PDF Generator
 * Generates standalone, branded PDFs for Part 1, Part 2, or Part 3 rotating daily.
 */

import fs from 'fs';
import path from 'path';
import QRCode from 'qrcode';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Generate PDF for a Specific Speaking Part (1, 2, or 3)
 * @param {1 | 2 | 3} partNumber - Speaking Part Number
 * @param {object} data - Structured data for this topic
 * @param {string} outputPdfPath - Destination path for PDF
 * @returns {Promise<string>} Output PDF path
 */
export async function generateSpeakingPartPDF(partNumber, data, outputPdfPath) {
  const qrDataUrl = await QRCode.toDataURL('https://t.me/dilshod_english', {
    margin: 1,
    width: 60,
    color: { dark: '#0f172a', light: '#ffffff' }
  });

  const partTitles = {
    1: { badge: 'PART 1: INTERVIEW & FOCUS TOPIC', title: 'PART 1 STUDY & PRACTICE GUIDE' },
    2: { badge: 'PART 2: INDIVIDUAL LONG TURN (CUE CARD)', title: 'PART 2 CUE CARD MASTER GUIDE' },
    3: { badge: 'PART 3: TWO-WAY IN-DEPTH DISCUSSION', title: 'PART 3 AREA DISCUSSION GUIDE' }
  };

  const partInfo = partTitles[partNumber] || partTitles[1];

  let mainContentHtml = '';

  if (partNumber === 1) {
    // PART 1 TEMPLATE
    mainContentHtml = `
      <!-- PAGE 1: STRATEGY & VOCABULARY -->
      <div class="page">
        <div class="page-content">
          ${renderHeader()}
          ${renderBanner(data.topicTitle, partInfo.badge, data.subTheme || 'May-Dec 2026 Latest Question Pool')}

          <div class="section-header">
            <div class="section-bar"></div>
            <div class="section-title">1. Part 1 Strategy & Golden Rules</div>
          </div>
          <div class="strategy-box">
            • <strong>Extend naturally:</strong> Har bir savolga shunchaki "Ha" yoki "Yo'q" deb to'xtab qolmasdan, 2-3 ta gap bilan sabab (Reason) yoki shaxsiy misol (Detail) qo'shing.<br>
            • <strong>Avoid over-formality:</strong> Part 1 bu norasmiy, tabiiy suhbat. Juda og'ir akademik jumlalardan ko'ra tabiiy leksika va bog'lovchilarni qo'llang.
          </div>

          <div class="section-header">
            <div class="section-bar"></div>
            <div class="section-title">2. Band 7.5 - 9.0 Lexical Resource (Topic-Specific Vocabulary)</div>
          </div>
          <table class="vocab-table">
            <thead>
              <tr>
                <th style="width: 24px;">#</th>
                <th style="width: 140px;">Word / Collocation</th>
                <th style="width: 150px;">Meaning (Uzbek)</th>
                <th>IELTS Context Example</th>
              </tr>
            </thead>
            <tbody>
              ${(data.vocabularies || []).map((v, i) => `
              <tr>
                <td><strong>${i + 1}</strong></td>
                <td class="vocab-word">${v.word}</td>
                <td class="vocab-meaning">${v.meaning}</td>
                <td class="vocab-example">${v.example}</td>
              </tr>
              `).join('')}
            </tbody>
          </table>

          <div class="section-header">
            <div class="section-bar"></div>
            <div class="section-title">3. Target Grammar Formulas for High Fluency</div>
          </div>
          ${(data.grammarFormulas || []).map(g => `
          <div class="grammar-block">
            <div class="grammar-title">${g.title}</div>
            <div class="grammar-box">
              <div class="grammar-box-head">${g.subtitle}</div>
              <div>${g.content}</div>
            </div>
          </div>
          `).join('')}
        </div>
        ${renderFooter(1, 2, qrDataUrl)}
      </div>

      <!-- PAGE 2: QUESTIONS & MODEL ANSWERS -->
      <div class="page">
        <div class="page-content">
          ${renderHeader()}
          <div class="section-header">
            <div class="section-bar"></div>
            <div class="section-title">4. Part 1 Questions & Band 8.5+ Model Answers</div>
          </div>
          <div class="section-desc">Quyidagi har bir savolni o'zingiz mustaqil ovoz chiqarib mashq qiling, so'ngra namunaviy javobdagi kuchli so'zlarni tahlil qiling:</div>

          ${(data.questions || []).map((q, i) => `
          <div class="qa-box">
            <div class="qa-q">Q${i + 1}: ${q.question}</div>
            <div class="qa-a"><strong>Band 8.5+ Answer:</strong> <em>"${q.answer}"</em></div>
            ${q.keyPoint ? `<div class="qa-tip">💡 <strong>Key takeaway:</strong> ${q.keyPoint}</div>` : ''}
          </div>
          `).join('')}
        </div>
        ${renderFooter(2, 2, qrDataUrl)}
      </div>
    `;
  } else if (partNumber === 2) {
    // PART 2 TEMPLATE
    mainContentHtml = `
      <!-- PAGE 1: CUE CARD & 1-MINUTE NOTE PLAN -->
      <div class="page">
        <div class="page-content">
          ${renderHeader()}
          ${renderBanner(data.topicTitle, partInfo.badge, 'May-Dec 2026 Latest Cue Card Pool')}

          <div class="section-header">
            <div class="section-bar"></div>
            <div class="section-title">1. Official Cue Card Prompt</div>
          </div>

          <div class="cue-card-box">
            <div class="cue-card-title">📌 ${data.cueCardTitle || data.topicTitle}</div>
            <div class="cue-card-prompt">${data.prompt}</div>
            ${(data.bullets || []).map(b => `<div class="cue-card-bullet">• ${b}</div>`).join('')}
          </div>

          <div class="section-header">
            <div class="section-bar"></div>
            <div class="section-title">2. 1-Minute Brainstorming & Note-Taking Strategy</div>
          </div>
          <div class="strategy-box">
            ${data.noteStrategy || `
            • <strong>Who / What:</strong> Bitta aniq shaxs yoki obyektni tanlang (ortiqcha o'ylanib vaqt yo'qotmang).<br>
            • <strong>Past Habitual ('used to' / 'would'):</strong> Tarixi va dastlabki xotiralar.<br>
            • <strong>Specific Anecdote (Misol):</strong> 1 ta esda qolarli voqeani batafsil hikoya qilish.<br>
            • <strong>Reflection / Emotions:</strong> Oxirida shaxsiy xulosa va tuyg'ular.
            `}
          </div>

          <div class="section-header">
            <div class="section-bar"></div>
            <div class="section-title">3. Band 7.5 - 9.0 Lexical Resource (Storytelling Vocabulary)</div>
          </div>
          <table class="vocab-table">
            <thead>
              <tr>
                <th style="width: 24px;">#</th>
                <th style="width: 140px;">Word / Idiom</th>
                <th style="width: 150px;">Meaning (Uzbek)</th>
                <th>Context Usage in Story</th>
              </tr>
            </thead>
            <tbody>
              ${(data.vocabularies || []).map((v, i) => `
              <tr>
                <td><strong>${i + 1}</strong></td>
                <td class="vocab-word">${v.word}</td>
                <td class="vocab-meaning">${v.meaning}</td>
                <td class="vocab-example">${v.example}</td>
              </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        ${renderFooter(1, 2, qrDataUrl)}
      </div>

      <!-- PAGE 2: FULL 2-MINUTE MONOLOGUE & ANALYSIS -->
      <div class="page">
        <div class="page-content">
          ${renderHeader()}
          <div class="section-header">
            <div class="section-bar"></div>
            <div class="section-title">4. Full 2-Minute Model Monologue (Band 8.5+)</div>
          </div>
          <div class="monologue-box">
            <div class="monologue-head">🎯 Complete Sample Speech (approx. 220 words / 2 minutes):</div>
            <div class="monologue-text">${data.monologue}</div>
          </div>

          <div class="section-header" style="margin-top: 14px;">
            <div class="section-bar"></div>
            <div class="section-title">5. Examiner Follow-up Questions (Rounding-off)</div>
          </div>
          ${(data.followUps || []).map((f, i) => `
          <div class="qa-box">
            <div class="qa-q">Follow-up ${i + 1}: ${f.question}</div>
            <div class="qa-a"><strong>Band 8.5+ Quick Response:</strong> <em>"${f.answer}"</em></div>
          </div>
          `).join('')}
        </div>
        ${renderFooter(2, 2, qrDataUrl)}
      </div>
    `;
  } else {
    // PART 3 TEMPLATE
    mainContentHtml = `
      <!-- PAGE 1: AREA METHOD & ACADEMIC VOCABULARY -->
      <div class="page">
        <div class="page-content">
          ${renderHeader()}
          ${renderBanner(data.topicTitle, partInfo.badge, 'May-Dec 2026 Discussion Pool')}

          <div class="section-header">
            <div class="section-bar"></div>
            <div class="section-title">1. The AREA Method for Band 8.0+ Discussion</div>
          </div>
          <div class="strategy-box">
            • <strong>A (Answer):</strong> Savolga to'g'ridan-to'g'ri, lo'nda va akademik javob bering.<br>
            • <strong>R (Reason):</strong> Fikringizni 1-2 ta jiddiy sabab bilan asoslang.<br>
            • <strong>E (Example):</strong> Jamiyatdagi real hayotiy yoki statistik misol keltiring.<br>
            • <strong>A (Alternative / Contrast):</strong> Qarama-qarshi tomonni yoki istisno holatni ko'rsatib, fikrni chuqurlashtiring.
          </div>

          <div class="section-header">
            <div class="section-bar"></div>
            <div class="section-title">2. Abstract & Analytical Lexical Resource</div>
          </div>
          <table class="vocab-table">
            <thead>
              <tr>
                <th style="width: 24px;">#</th>
                <th style="width: 140px;">Academic Phrase</th>
                <th style="width: 150px;">Meaning (Uzbek)</th>
                <th>Part 3 Discussion Example</th>
              </tr>
            </thead>
            <tbody>
              ${(data.vocabularies || []).map((v, i) => `
              <tr>
                <td><strong>${i + 1}</strong></td>
                <td class="vocab-word">${v.word}</td>
                <td class="vocab-meaning">${v.meaning}</td>
                <td class="vocab-example">${v.example}</td>
              </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        ${renderFooter(1, 2, qrDataUrl)}
      </div>

      <!-- PAGE 2: IN-DEPTH AREA BREAKDOWNS -->
      <div class="page">
        <div class="page-content">
          ${renderHeader()}
          <div class="section-header">
            <div class="section-bar"></div>
            <div class="section-title">3. Comprehensive Questions with AREA Breakdowns</div>
          </div>

          ${(data.questions || []).map((q, i) => `
          <div class="area-box">
            <div class="area-q">Q${i + 1}: ${q.question}</div>
            <div class="area-line"><strong>A (Answer):</strong> ${q.a}</div>
            <div class="area-line"><strong>R (Reason):</strong> ${q.r}</div>
            <div class="area-line"><strong>E (Example):</strong> ${q.e}</div>
            <div class="area-line"><strong>A (Alternative):</strong> ${q.alt}</div>
          </div>
          `).join('')}
        </div>
        ${renderFooter(2, 2, qrDataUrl)}
      </div>
    `;
  }

  const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>${data.topicTitle}</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Lora:ital,wght@0,400;0,600;1,400&display=swap');

        @page {
            size: A4;
            margin: 12mm 15mm 12mm 15mm;
        }

        * {
            box-sizing: border-box;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
        }

        body {
            font-family: 'Plus Jakarta Sans', Arial, sans-serif;
            color: #1e293b;
            background-color: #ffffff;
            margin: 0;
            padding: 0;
            font-size: 11.5px;
            line-height: 1.5;
        }

        .page {
            page-break-after: always;
            height: 98vh;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
        }

        .page:last-child {
            page-break-after: avoid;
        }

        .page-content {
            flex: 1;
        }

        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding-bottom: 6px;
            border-bottom: 2px solid #e05326;
            margin-bottom: 10px;
            font-size: 11px;
            font-weight: 700;
            color: #334155;
        }

        .header .brand {
            font-weight: 800;
            color: #0f172a;
        }

        .header .brand span {
            color: #e05326;
            font-weight: 600;
        }

        .header .channel-link {
            color: #475569;
            text-decoration: none;
        }

        .title-banner {
            background-color: #e05326;
            border-radius: 4px;
            padding: 10px 16px;
            margin-bottom: 10px;
            color: #ffffff;
        }

        .title-banner h1 {
            margin: 0 0 3px 0;
            font-size: 15px;
            font-weight: 800;
            letter-spacing: -0.2px;
            text-transform: uppercase;
        }

        .title-banner .theme-line {
            font-size: 11.5px;
            font-weight: 600;
            color: #ffe4d6;
            margin-bottom: 4px;
        }

        .title-banner .period-badge {
            display: inline-block;
            background-color: #0f172a;
            color: #ffffff;
            font-size: 9px;
            font-weight: 800;
            padding: 2px 7px;
            border-radius: 3px;
            letter-spacing: 0.5px;
            text-transform: uppercase;
        }

        .section-header {
            display: flex;
            align-items: center;
            gap: 6px;
            margin: 10px 0 6px 0;
        }

        .section-bar {
            width: 3.5px;
            height: 16px;
            background-color: #e05326;
            border-radius: 2px;
        }

        .section-title {
            font-size: 12.5px;
            font-weight: 800;
            color: #0f172a;
            letter-spacing: -0.2px;
        }

        .section-desc {
            font-size: 10.5px;
            color: #475569;
            margin-bottom: 8px;
        }

        .strategy-box {
            background-color: #fffaf8;
            border: 1px dashed #fed7aa;
            border-radius: 4px;
            padding: 8px 12px;
            font-size: 10.5px;
            line-height: 1.45;
            color: #334155;
            margin-bottom: 8px;
        }

        .vocab-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 8px;
            font-size: 10.5px;
        }

        .vocab-table th {
            background-color: #e05326;
            color: #ffffff;
            font-weight: 700;
            text-align: left;
            padding: 5px 7px;
            border: 1px solid #d9481b;
        }

        .vocab-table td {
            padding: 4px 7px;
            border: 1px solid #e2e8f0;
            vertical-align: top;
        }

        .vocab-table tr:nth-child(even) {
            background-color: #fafaf9;
        }

        .vocab-word { font-weight: 700; color: #0f172a; }
        .vocab-meaning { color: #475569; font-weight: 500; }
        .vocab-example { color: #334155; font-style: italic; }

        .grammar-block { margin-bottom: 6px; }
        .grammar-title { font-size: 11px; font-weight: 700; color: #c0392b; margin-bottom: 2px; }
        .grammar-box {
            background-color: #fff8f6;
            border: 1px solid #fecaca;
            border-radius: 4px;
            padding: 6px 10px;
            font-size: 10.5px;
        }
        .grammar-box-head { font-weight: 700; color: #991b1b; margin-bottom: 2px; }

        .qa-box {
            background-color: #ffffff;
            border: 1px solid #fee2e2;
            border-left: 3.5px solid #e05326;
            border-radius: 4px;
            padding: 7px 10px;
            margin-bottom: 7px;
        }
        .qa-q { font-weight: 700; color: #991b1b; font-size: 11px; margin-bottom: 3px; }
        .qa-a { color: #1e293b; font-size: 11px; line-height: 1.45; }
        .qa-tip { font-size: 10px; color: #475569; margin-top: 3px; }

        .cue-card-box {
            background-color: #ffffff;
            border: 1.5px solid #fca5a5;
            border-radius: 4px;
            padding: 8px 12px;
            margin-bottom: 8px;
        }
        .cue-card-title { font-weight: 800; color: #b91c1c; font-size: 11.5px; margin-bottom: 3px; }
        .cue-card-prompt { font-weight: 700; color: #1e293b; font-size: 11px; margin-bottom: 4px; }
        .cue-card-bullet { font-size: 10.5px; color: #475569; margin-left: 8px; }

        .monologue-box {
            background-color: #fffaf8;
            border: 1px solid #fed7aa;
            border-radius: 4px;
            padding: 10px 14px;
            font-size: 11px;
            line-height: 1.55;
            color: #1e293b;
            margin-bottom: 10px;
        }
        .monologue-head { font-weight: 700; color: #c2410c; margin-bottom: 6px; }
        .monologue-text { font-style: italic; }

        .area-box {
            background-color: #ffffff;
            border: 1px solid #e2e8f0;
            border-radius: 4px;
            padding: 7px 10px;
            margin-bottom: 6px;
            font-size: 10.5px;
        }
        .area-q { font-weight: 700; color: #991b1b; margin-bottom: 3px; }
        .area-line { margin-bottom: 2px; color: #334155; }
        .area-line strong { color: #0f172a; }

        .footer {
            border-top: 1px solid #e2e8f0;
            padding-top: 5px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 9.5px;
            color: #64748b;
            font-weight: 600;
        }
        .footer-left { font-weight: 700; color: #0f172a; }
        .footer-center { color: #94a3b8; }
        .footer-right { display: flex; align-items: center; gap: 6px; color: #0f172a; }
        .footer-qr { width: 22px; height: 22px; }
    </style>
</head>
<body>
    ${mainContentHtml}
</body>
</html>`;

  const tempHtmlPath = path.join(__dirname, '..', `temp_speaking_part_${partNumber}.html`);
  fs.writeFileSync(tempHtmlPath, fullHtml, 'utf-8');

function getChromePath() {
  if (process.platform === 'darwin') {
    const macPath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
    if (fs.existsSync(macPath)) return `"${macPath}"`;
  }
  const linuxCandidates = ['google-chrome', 'google-chrome-stable', 'chromium-browser', 'chromium'];
  for (const cmd of linuxCandidates) {
    try {
      execSync(`which ${cmd}`, { stdio: 'ignore' });
      return cmd;
    } catch (_) {}
  }
  return 'google-chrome';
}

  const tempDir = execSync('mktemp -d').toString().trim();
  try {
    const chrome = getChromePath();
    const chromeCmd = `${chrome} --headless --disable-gpu --no-sandbox --no-pdf-header-footer --user-data-dir="${tempDir}" --print-to-pdf="${outputPdfPath}" "file://${tempHtmlPath}" 2>/dev/null`;
    execSync(chromeCmd);
  } finally {
    try {
      execSync(`rm -rf "${tempDir}" "${tempHtmlPath}"`);
    } catch (_) {}
  }

  return outputPdfPath;
}

function renderHeader() {
  return `
    <div class="header">
        <div class="brand">DILSHOD USTOZ <span>| IELTS Speaking Masterclass</span></div>
        <a href="https://t.me/dilshod_english" class="channel-link">t.me/dilshod_english</a>
    </div>
  `;
}

function renderBanner(title, badge, subTheme) {
  return `
    <div class="title-banner">
        <h1>${title}</h1>
        <div class="theme-line">${subTheme}</div>
        <span class="period-badge">${badge}</span>
    </div>
  `;
}

function renderFooter(page, total, qrDataUrl) {
  return `
    <div class="footer">
        <div class="footer-left">DILSHOD USTOZ <span>| IELTS Speaking 2026</span></div>
        <div class="footer-center">Page ${page} of ${total}</div>
        <div class="footer-right">
            <span>Telegram kanal: <strong>@dilshod_english</strong></span>
            <img src="${qrDataUrl}" class="footer-qr" alt="QR">
        </div>
    </div>
  `;
}
