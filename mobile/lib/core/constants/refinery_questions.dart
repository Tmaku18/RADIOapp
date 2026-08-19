/// Refinery questions — keep keys/copy in sync with
/// `web/src/data/refinery-questions.ts` and `backend/src/refinery/refinery-questions.ts`.
class RefineryRatingQuestion {
  const RefineryRatingQuestion({required this.key, required this.question});

  final String key;
  final String question;
}

class RefinerySurveyQuestion {
  const RefinerySurveyQuestion({
    required this.key,
    required this.question,
    required this.options,
  });

  final String key;
  final String question;
  final List<String> options;
}

const kRefineryRatingQuestions = <RefineryRatingQuestion>[
  RefineryRatingQuestion(
    key: 'overall_rating',
    question: 'Overall, how would you rate this song?',
  ),
  RefineryRatingQuestion(
    key: 'beat_rating',
    question: 'How would you rate just the beat / instrumental?',
  ),
  RefineryRatingQuestion(
    key: 'lyrics_rating',
    question: 'How would you rate just the lyrics?',
  ),
  RefineryRatingQuestion(
    key: 'chorus_rating',
    question: 'How would you rate the chorus / hook?',
  ),
  RefineryRatingQuestion(
    key: 'opening_ending_rating',
    question: 'How was the opening and ending?',
  ),
];

const kRefinerySurveyQuestions = <RefinerySurveyQuestion>[
  RefinerySurveyQuestion(
    key: 'vocals_clear',
    question: "Was the artist's voice clear and audible?",
    options: ['Yes', 'Somewhat', 'No'],
  ),
  RefinerySurveyQuestion(
    key: 'flow_quality',
    question: 'How was the flow and delivery?',
    options: ['Smooth', 'Average', 'Choppy'],
  ),
  RefinerySurveyQuestion(
    key: 'intro_hook',
    question: 'Did the intro hook you in?',
    options: ['Yes', 'No'],
  ),
  RefinerySurveyQuestion(
    key: 'listen_again',
    question: 'Would you listen to this song again?',
    options: ['Yes', 'Maybe', 'No'],
  ),
  RefinerySurveyQuestion(
    key: 'add_to_playlist',
    question: 'Would you add this to a playlist?',
    options: ['Yes', 'Maybe', 'No'],
  ),
  RefinerySurveyQuestion(
    key: 'memorable_hook',
    question: 'Did the song have a memorable hook or chorus?',
    options: ['Yes', 'Somewhat', 'No'],
  ),
  RefinerySurveyQuestion(
    key: 'audio_quality',
    question: 'Was the mixing and audio quality good?',
    options: ['Yes', 'Needs Work', 'No'],
  ),
  RefinerySurveyQuestion(
    key: 'recommend_friend',
    question: 'Would you recommend this song to a friend?',
    options: ['Yes', 'Maybe', 'No'],
  ),
];
