/**
 * Quiz Generator
 * Handles quiz content from database and Gemini AI
 */

import { getContentFromDatabase } from './content-selector.js';
import { generateQuiz as generateQuizAI } from './gemini.js';

/**
 * Get a quiz question from database or generate with AI
 * @returns {object} Quiz object with question, options, correct_index, explanation
 */
export async function getQuiz() {
  // Try AI-generated quiz first
  console.log('🤖 Trying AI quiz generation...');
  const aiQuiz = await generateQuizAI();

  if (aiQuiz) {
    console.log('✅ AI quiz generated successfully');
    return shuffleQuizOptions({
      question: aiQuiz.question,
      options: aiQuiz.options,
      correctIndex: aiQuiz.correct_index,
      explanation: aiQuiz.explanation_uz || '',
    });
  }

  // Fallback to database
  console.log('📦 Falling back to quiz database...');
  const dbQuiz = getContentFromDatabase('quizzes');

  if (dbQuiz) {
    console.log('✅ Quiz loaded from database');
    return shuffleQuizOptions({
      question: dbQuiz.question,
      options: dbQuiz.options,
      correctIndex: dbQuiz.correct_index,
      explanation: dbQuiz.explanation_uz || '',
    });
  }

  // Last resort: hardcoded quiz
  console.log('⚠️ Using fallback quiz');
  return shuffleQuizOptions({
    question: '📝 Choose the correct word:\n"The weather had a significant ___ on the event."',
    options: ['affect', 'effect', 'affection', 'effective'],
    correctIndex: 1,
    explanation: "'Effect' (noun) = natija/ta'sir. 'Affect' (verb) = ta'sir qilmoq.",
  });
}

/**
 * Shuffle quiz options and update correct index
 */
function shuffleQuizOptions(quiz) {
  const options = quiz.options;
  const correctOption = options[quiz.correctIndex];
  
  // Fisher-Yates shuffle
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [options[i], options[j]] = [options[j], options[i]];
  }
  
  // Find new correct index
  quiz.correctIndex = options.indexOf(correctOption);
  
  return quiz;
}

/**
 * Validate quiz data before sending
 */
export function validateQuiz(quiz) {
  if (!quiz.question || quiz.question.length > 300) {
    return { valid: false, reason: 'Question missing or too long (max 300 chars)' };
  }

  if (!Array.isArray(quiz.options) || quiz.options.length < 2 || quiz.options.length > 10) {
    return { valid: false, reason: 'Options must be an array of 2-10 items' };
  }

  for (const option of quiz.options) {
    if (option.length > 100) {
      return { valid: false, reason: `Option too long (max 100 chars): "${option}"` };
    }
  }

  if (typeof quiz.correctIndex !== 'number' || quiz.correctIndex < 0 || quiz.correctIndex >= quiz.options.length) {
    return { valid: false, reason: 'Invalid correct_index' };
  }

  if (quiz.explanation && quiz.explanation.length > 200) {
    // Truncate explanation instead of failing
    quiz.explanation = quiz.explanation.substring(0, 197) + '...';
  }

  return { valid: true };
}
