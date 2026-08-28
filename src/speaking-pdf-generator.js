/**
 * Speaking Masterclass PDF Generator
 * Creates beautifully styled IELTS Speaking study guides matching Dilshod Ustoz's brand
 */

import fs from 'fs';
import path from 'path';
import QRCode from 'qrcode';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Generate PDF from Speaking Guide Data
 * @param {object} guideData - The structured lesson / topic data
 * @param {string} outputPdfPath - Output path for the PDF
 * @returns {Promise<string>} Path to generated PDF
 */
export async function generateSpeakingPDF(guideData, outputPdfPath) {
  // 1. Generate QR Code Data URL
  const qrDataUrl = await QRCode.toDataURL('https://t.me/dilshod_english', {
    margin: 1,
    width: 60,
    color: {
      dark: '#0f172a',
      light: '#ffffff'
    }
  });

  // 2. Build HTML Template with exact styling matching the masterclass guide
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>${guideData.title || 'IELTS Speaking Master Guide'}</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Lora:ital,wght@0,400;0,600;1,400&display=swap');

        @page {
            size: A4;
            margin: 14mm 16mm 14mm 16mm;
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

        /* Page container */
        .page {
            page-break-after: always;
            min-height: 96vh;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            position: relative;
        }

        .page:last-child {
            page-break-after: avoid;
        }

        .page-content {
            flex: 1;
        }

        /* Top Header */
        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding-bottom: 6px;
            border-bottom: 2px solid #e05326;
            margin-bottom: 12px;
            font-size: 11px;
            font-weight: 700;
            color: #334155;
        }

        .header .brand {
            font-weight: 800;
            color: #0f172a;
            letter-spacing: 0.5px;
        }

        .header .brand span {
            color: #e05326;
            font-weight: 600;
        }

        .header .channel-link {
            color: #475569;
            text-decoration: none;
        }

        /* Title Banner */
        .title-banner {
            background-color: #e05326;
            border-radius: 4px;
            padding: 12px 18px;
            margin-bottom: 14px;
            color: #ffffff;
        }

        .title-banner h1 {
            margin: 0 0 4px 0;
            font-size: 17px;
            font-weight: 800;
            letter-spacing: -0.2px;
            text-transform: uppercase;
        }

        .title-banner .theme-line {
            font-size: 12px;
            font-weight: 600;
            color: #ffe4d6;
            margin-bottom: 6px;
        }

        .title-banner .period-badge {
            display: inline-block;
            background-color: #0f172a;
            color: #ffffff;
            font-size: 9.5px;
            font-weight: 800;
            padding: 2px 8px;
            border-radius: 3px;
            letter-spacing: 0.5px;
            text-transform: uppercase;
        }

        /* Section Headings */
        .section-header {
            display: flex;
            align-items: center;
            gap: 8px;
            margin: 14px 0 8px 0;
        }

        .section-bar {
            width: 4px;
            height: 18px;
            background-color: #e05326;
            border-radius: 2px;
        }

        .section-title {
            font-size: 13.5px;
            font-weight: 800;
            color: #0f172a;
            letter-spacing: -0.2px;
        }

        .section-desc {
            font-size: 11px;
            color: #475569;
            margin-bottom: 10px;
            line-height: 1.45;
        }

        /* Vocabulary Table */
        .vocab-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 12px;
            font-size: 10.5px;
        }

        .vocab-table th {
            background-color: #e05326;
            color: #ffffff;
            font-weight: 700;
            text-align: left;
            padding: 6px 8px;
            border: 1px solid #d9481b;
        }

        .vocab-table td {
            padding: 5px 8px;
            border: 1px solid #e2e8f0;
            vertical-align: top;
        }

        .vocab-table tr:nth-child(even) {
            background-color: #fafaf9;
        }

        .vocab-word {
            font-weight: 700;
            color: #0f172a;
        }

        .vocab-meaning {
            color: #475569;
            font-weight: 500;
        }

        .vocab-example {
            color: #334155;
            font-style: italic;
        }

        /* Grammar Boxes */
        .grammar-block {
            margin-bottom: 10px;
        }

        .grammar-title {
            font-size: 11.5px;
            font-weight: 700;
            color: #c0392b;
            margin-bottom: 4px;
        }

        .grammar-box {
            background-color: #fff8f6;
            border: 1px solid #fecaca;
            border-radius: 4px;
            padding: 8px 12px;
            font-size: 11px;
        }

        .grammar-box-head {
            font-weight: 700;
            color: #991b1b;
            margin-bottom: 3px;
        }

        /* Question & Answer Boxes */
        .qa-topic-title {
            font-size: 12.5px;
            font-weight: 800;
            color: #c0392b;
            margin: 10px 0 6px 0;
        }

        .qa-box {
            background-color: #ffffff;
            border: 1px solid #fee2e2;
            border-left: 3.5px solid #e05326;
            border-radius: 4px;
            padding: 7px 10px;
            margin-bottom: 8px;
        }

        .qa-q {
            font-weight: 700;
            color: #991b1b;
            font-size: 11px;
            margin-bottom: 3px;
        }

        .qa-a {
            color: #1e293b;
            font-size: 11px;
            line-height: 1.45;
        }

        .qa-a strong {
            color: #0f172a;
        }

        .qa-a em {
            color: #334155;
        }

        /* Part 2 Cue Cards */
        .cue-card-container {
            margin-bottom: 12px;
        }

        .cue-card-box {
            background-color: #ffffff;
            border: 1.5px solid #fca5a5;
            border-radius: 4px;
            padding: 8px 12px;
            margin-bottom: 6px;
        }

        .cue-card-title {
            font-weight: 800;
            color: #b91c1c;
            font-size: 11.5px;
            margin-bottom: 3px;
        }

        .cue-card-prompt {
            font-weight: 700;
            color: #1e293b;
            font-size: 11px;
            margin-bottom: 4px;
        }

        .cue-card-bullet {
            font-size: 10.5px;
            color: #475569;
            margin-left: 10px;
            margin-bottom: 2px;
        }

        .monologue-box {
            background-color: #fffaf8;
            border: 1px solid #fed7aa;
            border-radius: 4px;
            padding: 8px 12px;
            font-size: 11px;
            line-height: 1.5;
            color: #1e293b;
        }

        .monologue-head {
            font-weight: 700;
            color: #c2410c;
            margin-bottom: 4px;
        }

        /* Part 3 AREA Structure */
        .area-box {
            background-color: #ffffff;
            border: 1px solid #e2e8f0;
            border-radius: 4px;
            padding: 7px 10px;
            margin-bottom: 6px;
            font-size: 11px;
        }

        .area-q {
            font-weight: 700;
            color: #991b1b;
            margin-bottom: 4px;
        }

        .area-line {
            margin-bottom: 2px;
            color: #334155;
        }

        .area-line strong {
            color: #0f172a;
        }

        /* Footer */
        .footer {
            border-top: 1px solid #e2e8f0;
            padding-top: 6px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 9.5px;
            color: #64748b;
            font-weight: 600;
            margin-top: 10px;
        }

        .footer-left {
            font-weight: 700;
            color: #0f172a;
        }

        .footer-center {
            color: #94a3b8;
        }

        .footer-right {
            display: flex;
            align-items: center;
            gap: 6px;
            color: #0f172a;
        }

        .footer-qr {
            width: 22px;
            height: 22px;
        }
    </style>
</head>
<body>

    <!-- PAGE 1: OVERVIEW & TOP VOCABULARY -->
    <div class="page">
        <div class="page-content">
            <div class="header">
                <div class="brand">DILSHOD USTOZ <span>| IELTS Speaking Masterclass</span></div>
                <a href="https://t.me/dilshod_english" class="channel-link">t.me/dilshod_english</a>
            </div>

            <div class="title-banner">
                <h1>${guideData.lessonNumber || 'LESSON 1'}: ${guideData.title || 'PRE-CLASS PREPARATION MASTER GUIDE'}</h1>
                <div class="theme-line">Theme: ${guideData.theme || 'People, Friendship, Family & Inspiration'}</div>
                <span class="period-badge">MAY-DEC 2026 COMPREHENSIVE STUDY GUIDE</span>
            </div>

            <div class="section-header">
                <div class="section-bar"></div>
                <div class="section-title">1. Overview & Pedagogical Scope</div>
            </div>
            <div class="section-desc">
                ${guideData.overview || 'This master study guide provides comprehensive preparation for EVERY SINGLE QUESTION in this topic. It covers Part 1 questions, Part 2 Cue Cards with 2-minute model monologues, and Part 3 questions with complete AREA breakdowns.'}
            </div>

            <div class="section-header">
                <div class="section-bar"></div>
                <div class="section-title">2. Band 7.5 - 9.0 Lexical Resource (Top Vocabulary & Idioms)</div>
            </div>

            <table class="vocab-table">
                <thead>
                    <tr>
                        <th style="width: 24px;">#</th>
                        <th style="width: 140px;">Word / Idiom</th>
                        <th style="width: 150px;">Meaning (Uzbek)</th>
                        <th>IELTS Context Example</th>
                    </tr>
                </thead>
                <tbody>
                    ${guideData.vocabularies.slice(0, 14).map((v, i) => `
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

        <div class="footer">
            <div class="footer-left">DILSHOD USTOZ <span>| IELTS Speaking 2026</span></div>
            <div class="footer-center">Page 1 of 4</div>
            <div class="footer-right">
                <span>Telegram kanal: <strong>@dilshod_english</strong></span>
                <img src="${qrDataUrl}" class="footer-qr" alt="QR">
            </div>
        </div>
    </div>

    <!-- PAGE 2: TARGET GRAMMAR & PART 1 QUESTIONS -->
    <div class="page">
        <div class="page-content">
            <div class="header">
                <div class="brand">DILSHOD USTOZ <span>| IELTS Speaking Masterclass</span></div>
                <a href="https://t.me/dilshod_english" class="channel-link">t.me/dilshod_english</a>
            </div>

            <div class="section-header">
                <div class="section-bar"></div>
                <div class="section-title">3. Target Grammar Formulas for Band 8.0+</div>
            </div>

            ${guideData.grammarFormulas.map(g => `
            <div class="grammar-block">
                <div class="grammar-title">${g.title}</div>
                <div class="grammar-box">
                    <div class="grammar-box-head">${g.subtitle}</div>
                    <div>${g.content}</div>
                </div>
            </div>
            `).join('')}

            <div class="section-header" style="margin-top: 14px;">
                <div class="section-bar"></div>
                <div class="section-title">4. Part 1: Detailed Question Guidance & Model Answers</div>
            </div>

            <div class="qa-topic-title">${guideData.part1TopicTitle || 'Topic: Focus Questions'}</div>

            ${guideData.part1Questions.map((q, i) => `
            <div class="qa-box">
                <div class="qa-q">Q${i + 1}: ${q.question}</div>
                <div class="qa-a"><strong>Band 8.5+ Answer:</strong> <em>"${q.answer}"</em></div>
            </div>
            `).join('')}
        </div>

        <div class="footer">
            <div class="footer-left">DILSHOD USTOZ <span>| IELTS Speaking 2026</span></div>
            <div class="footer-center">Page 2 of 4</div>
            <div class="footer-right">
                <span>Telegram kanal: <strong>@dilshod_english</strong></span>
                <img src="${qrDataUrl}" class="footer-qr" alt="QR">
            </div>
        </div>
    </div>

    <!-- PAGE 3: PART 2 CUE CARDS & MODEL MONOLOGUES -->
    <div class="page">
        <div class="page-content">
            <div class="header">
                <div class="brand">DILSHOD USTOZ <span>| IELTS Speaking Masterclass</span></div>
                <a href="https://t.me/dilshod_english" class="channel-link">t.me/dilshod_english</a>
            </div>

            <div class="section-header">
                <div class="section-bar"></div>
                <div class="section-title">5. Part 2: Cue Cards with Full 2-Minute Monologues</div>
            </div>

            ${guideData.part2CueCards.map((cc, i) => `
            <div class="cue-card-container">
                <div class="cue-card-box">
                    <div class="cue-card-title">📌 Cue Card ${i + 1}: ${cc.topic} (May-Dec 2026)</div>
                    <div class="cue-card-prompt">${cc.prompt}</div>
                    ${cc.bullets.map(b => `<div class="cue-card-bullet">• ${b}</div>`).join('')}
                </div>
                <div class="monologue-box">
                    <div class="monologue-head">🎯 2-Minute Model Monologue (Band 8.5+)</div>
                    <em>${cc.monologue}</em>
                </div>
            </div>
            `).join('')}
        </div>

        <div class="footer">
            <div class="footer-left">DILSHOD USTOZ <span>| IELTS Speaking 2026</span></div>
            <div class="footer-center">Page 3 of 4</div>
            <div class="footer-right">
                <span>Telegram kanal: <strong>@dilshod_english</strong></span>
                <img src="${qrDataUrl}" class="footer-qr" alt="QR">
            </div>
        </div>
    </div>

    <!-- PAGE 4: PART 3 AREA BREAKDOWNS -->
    <div class="page">
        <div class="page-content">
            <div class="header">
                <div class="brand">DILSHOD USTOZ <span>| IELTS Speaking Masterclass</span></div>
                <a href="https://t.me/dilshod_english" class="channel-link">t.me/dilshod_english</a>
            </div>

            <div class="section-header">
                <div class="section-bar"></div>
                <div class="section-title">6. Part 3: AREA Breakdowns for High Fluency</div>
            </div>

            <div class="qa-topic-title">${guideData.part3TopicTitle || 'Topic: Discussion Questions'}</div>

            ${guideData.part3Questions.map((q, i) => `
            <div class="area-box">
                <div class="area-q">Q${i + 1}: ${q.question}</div>
                <div class="area-line"><strong>A (Answer):</strong> ${q.a}</div>
                <div class="area-line"><strong>R (Reason):</strong> ${q.r}</div>
                <div class="area-line"><strong>E (Example):</strong> ${q.e}</div>
                <div class="area-line"><strong>A (Alternative):</strong> ${q.alt}</div>
            </div>
            `).join('')}
        </div>

        <div class="footer">
            <div class="footer-left">DILSHOD USTOZ <span>| IELTS Speaking 2026</span></div>
            <div class="footer-center">Page 4 of 4</div>
            <div class="footer-right">
                <span>Telegram kanal: <strong>@dilshod_english</strong></span>
                <img src="${qrDataUrl}" class="footer-qr" alt="QR">
            </div>
        </div>
    </div>

</body>
</html>`;

  // 3. Write temp HTML file
  const tempHtmlPath = path.join(__dirname, '..', 'temp_speaking_guide.html');
  fs.writeFileSync(tempHtmlPath, html, 'utf-8');

  // 4. Render to PDF using Chrome Headless with unique temp dir
  const tempDir = execSync('mktemp -d').toString().trim();
  try {
    const chromeCmd = `"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless --disable-gpu --user-data-dir="${tempDir}" --no-pdf-header-footer --print-to-pdf="${outputPdfPath}" "file://${tempHtmlPath}"`;
    execSync(chromeCmd);
  } finally {
    execSync(`rm -rf "${tempDir}" "${tempHtmlPath}"`);
  }

  return outputPdfPath;
}
