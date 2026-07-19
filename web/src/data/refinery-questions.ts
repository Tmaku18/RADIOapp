/**
 * Refinery question definitions (shared by web frontend and backend validation).
 *
 * Edit with care: changing keys is a breaking change for stored
 * `refinery_reviews.survey_responses` JSONB and existing analytics. Add new keys
 * rather than renaming existing ones.
 */

export type RatingKey =
  | 'overall_rating'
  | 'beat_rating'
  | 'lyrics_rating'
  | 'chorus_rating'
  | 'opening_ending_rating';

export interface RatingQuestion {
  key: RatingKey;
  question: string;
}

export const REFINERY_RATING_QUESTIONS: ReadonlyArray<RatingQuestion> = [
  { key: 'overall_rating', question: 'Overall, how would you rate this song?' },
  { key: 'beat_rating', question: 'How would you rate just the beat / instrumental?' },
  { key: 'lyrics_rating', question: 'How would you rate just the lyrics?' },
  { key: 'chorus_rating', question: 'How would you rate the chorus / hook?' },
  { key: 'opening_ending_rating', question: 'How was the opening and ending?' },
] as const;

export interface SurveyQuestion {
  key: string;
  question: string;
  options: ReadonlyArray<string>;
}

export const REFINERY_SURVEY_QUESTIONS: ReadonlyArray<SurveyQuestion> = [
  {
    key: 'vocals_clear',
    question: "Was the artist's voice clear and audible?",
    options: ['Yes', 'Somewhat', 'No'],
  },
  {
    key: 'flow_quality',
    question: 'How was the flow and delivery?',
    options: ['Smooth', 'Average', 'Choppy'],
  },
  {
    key: 'intro_hook',
    question: 'Did the intro hook you in?',
    options: ['Yes', 'No'],
  },
  {
    key: 'listen_again',
    question: 'Would you listen to this song again?',
    options: ['Yes', 'Maybe', 'No'],
  },
  {
    key: 'add_to_playlist',
    question: 'Would you add this to a playlist?',
    options: ['Yes', 'Maybe', 'No'],
  },
  {
    key: 'memorable_hook',
    question: 'Did the song have a memorable hook or chorus?',
    options: ['Yes', 'Somewhat', 'No'],
  },
  {
    key: 'audio_quality',
    question: 'Was the mixing and audio quality good?',
    options: ['Yes', 'Needs Work', 'No'],
  },
  {
    key: 'recommend_friend',
    question: 'Would you recommend this song to a friend?',
    options: ['Yes', 'Maybe', 'No'],
  },
] as const;

/** Pricing + program economics constants for The Refinery (kept centralized to avoid drift). */
export const REFINERY_SUBMISSION_PRICE_CENTS = 499;
export const REFINERY_SUBMISSION_PRICE_USD = '4.99';
// Regular price, shown struck-through next to the current discount price.
export const REFINERY_SUBMISSION_ORIGINAL_PRICE_USD = '9.99';
export const REFINERY_DEFAULT_MIN_REVIEWS = 100;
export const REFINERY_REVIEW_REWARD_CENTS = 10;
export const REFINERY_MAX_CUSTOM_QUESTIONS = 10;
