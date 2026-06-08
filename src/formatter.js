/**
 * Post Formatter
 * Converts raw content data into beautiful Telegram HTML formatted posts
 */

const CHANNEL_NAME = 'IELTS Maslahatlar';

// Decorative separators
const SEPARATOR = '━━━━━━━━━━━━━━━━━━━━';
const MINI_SEP = '• • •';

/**
 * Format a vocabulary post
 */
export function formatVocabulary(item) {
  const lines = [
    `📚 <b>IELTS Vocabulary of the Day</b>`,
    SEPARATOR,
    ``,
    `🔤 <b>${item.word}</b>  ${item.transcription || ''}`,
    `<i>${item.part_of_speech}</i>`,
    ``,
    `📖 <b>Definition:</b> ${item.definition}`,
    `🇺🇿 <b>Ma'nosi:</b> ${item.meaning_uz}`,
    ``,
    `💬 <b>Example:</b>`,
    `<i>"${item.example}"</i>`,
    ``,
    MINI_SEP,
    ``,
    `✅ <b>Synonym:</b> ${item.synonym || '—'}`,
    `❌ <b>Antonym:</b> ${item.antonym || '—'}`,
    ``,
    `💡 <b>IELTS Tip:</b> ${item.ielts_tip_uz}`,
    ``,
    SEPARATOR,
    `#IELTS #Vocabulary #BandScore7 #WordOfTheDay`,
  ];

  return lines.join('\n');
}

/**
 * Format a writing tips post
 */
export function formatWritingTip(item) {
  const lines = [
    `✍️ <b>IELTS Writing ${item.task} Tip</b>`,
    SEPARATOR,
    ``,
    `📌 <b>${item.title_uz}</b>`,
    `<i>${item.title_en}</i>`,
    ``,
    `📝 ${item.tip_uz}`,
    ``,
    `💬 <b>Misol:</b>`,
    `<i>${item.example}</i>`,
    ``,
    `⚠️ <b>Ko'p uchraydigan xato:</b>`,
    `${item.common_mistake_uz}`,
    ``,
    `🎯 <b>Maqsad:</b> Band ${item.band_target}`,
    ``,
    SEPARATOR,
    `#IELTS #Writing #${item.task.replace(' ', '')} #Tips`,
  ];

  return lines.join('\n');
}

/**
 * Format a speaking tips post
 */
export function formatSpeakingTip(item) {
  const phrases = item.useful_phrases
    ? item.useful_phrases.map((p) => `  🔹 <i>${p}</i>`).join('\n')
    : '';

  const lines = [
    `🗣 <b>IELTS Speaking ${item.part} Tip</b>`,
    SEPARATOR,
    ``,
    `📌 <b>${item.topic_uz}</b>`,
    `❓ <i>${item.topic_en}</i>`,
    ``,
    `💡 <b>Strategiya:</b>`,
    `${item.tip_uz}`,
    ``,
    `💬 <b>Sample Answer (Band 7+):</b>`,
    `<i>"${item.sample_answer}"</i>`,
    ``,
    `🔑 <b>Foydali iboralar:</b>`,
    phrases,
    ``,
    `🎯 <b>Maqsad:</b> Band ${item.band_target}`,
    ``,
    SEPARATOR,
    `#IELTS #Speaking #${item.part.replace(' ', '')} #Tips`,
  ];

  return lines.join('\n');
}

/**
 * Format a reading/listening strategy post
 */
export function formatReadingListening(item) {
  const questionTypes = item.question_types
    ? item.question_types.map((t) => `  📎 ${t}`).join('\n')
    : '';

  const lines = [
    `${item.skill === 'Reading' ? '📖' : '🎧'} <b>IELTS ${item.skill} Strategy</b>`,
    SEPARATOR,
    ``,
    `📌 <b>${item.strategy_uz}</b>`,
    `<i>${item.strategy_en}</i>`,
    ``,
    `📝 <b>Qanday ishlaydi:</b>`,
    `${item.description_uz}`,
    ``,
    `💬 <b>Misol:</b>`,
    `${item.example_uz}`,
    ``,
    `📋 <b>Qaysi savol turlari uchun:</b>`,
    questionTypes,
    ``,
    `⚠️ <b>Ko'p uchraydigan xato:</b>`,
    `${item.common_mistake_uz}`,
    ``,
    SEPARATOR,
    `#IELTS #${item.skill} #Strategy #Tips`,
  ];

  return lines.join('\n');
}

/**
 * Format a band score tip post
 */
export function formatBandScoreTip(item) {
  const lines = [
    `🎯 <b>Band Score Oshirish</b>`,
    SEPARATOR,
    ``,
    `📊 <b>Maqsad: Band ${item.target_band} (${item.skill_area})</b>`,
    ``,
    `📌 <b>${item.title_uz}</b>`,
    ``,
    `📝 ${item.tip_uz}`,
    ``,
    `❌ <b>Before (past band):</b>`,
    `<i>"${item.before_example}"</i>`,
    ``,
    `✅ <b>After (Band ${item.target_band}):</b>`,
    `<i>"${item.after_example}"</i>`,
    ``,
    `💡 <b>Kalit nuqta:</b>`,
    `${item.key_point_uz}`,
    ``,
    SEPARATOR,
    `#IELTS #BandScore #${item.skill_area} #Improvement`,
  ];

  return lines.join('\n');
}

/**
 * Format a motivational post
 */
export function formatMotivation(item) {
  const lines = [
    `💪 <b>IELTS Motivatsiya</b>`,
    SEPARATOR,
    ``,
    `📌 <b>${item.title_uz}</b>`,
    ``,
    `📖 ${item.story_uz}`,
    ``,
    MINI_SEP,
    ``,
    `💎 <i>"${item.quote}"</i>`,
    `— <b>${item.quote_author}</b>`,
    ``,
    `📝 <b>Saboq:</b> ${item.lesson_uz}`,
    ``,
    `🚀 <b>Bugungi qadam:</b>`,
    `${item.action_step_uz}`,
    ``,
    SEPARATOR,
    `#IELTS #Motivation #Success #NeverGiveUp`,
  ];

  return lines.join('\n');
}

/**
 * Format a reading test post (Document)
 */
export function formatReadingTest(item) {
  const lines = [
    `📱 <b>Mini IELTS Reading Test</b>`,
    SEPARATOR,
    ``,
    `Bugun interaktiv test ishlab, o'zimizni sinab ko'ramiz!`,
    ``,
    `📌 <b>Mavzu:</b> <i>${item.title}</i>`,
    `📋 <b>Test turi:</b> ${item.type}`,
    ``,
    `👇 Pastdagi biriktirilgan HTML faylni oching va testni taymer bilan yechib ko'ring!`,
    ``,
    SEPARATOR,
    `#IELTS #ReadingTest #MiniApp`,
  ];

  return lines.join('\n');
}

/**
 * Format content based on type
 * @param {string} contentType - Type of content
 * @param {object} item - Content data
 * @returns {string} Formatted HTML text
 */
export function formatContent(contentType, item) {
  // If the item is already a pre-formatted string (from our new fallback system)
  if (item.text) {
    return item.text;
  }

  const formatters = {
    vocabulary: formatVocabulary,
    writing: formatWritingTip,
    speaking: formatSpeakingTip,
    'reading-listening': formatReadingListening,
    'band-score': formatBandScoreTip,
    motivation: formatMotivation,
    'reading-test': formatReadingTest,
  };

  const formatter = formatters[contentType];
  if (!formatter) {
    console.error(`⚠️ No formatter found for content type: ${contentType}`);
    return null;
  }

  return formatter(item);
}
