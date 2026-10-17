/**
 * Spots "finish the game" achievements by their English name or
 * description. Phrases, not loose words: "Finish the level Bridge" or
 * "Complete the Tutorial" aren't endings, "Complete the game under 40
 * deaths" or "Beat the game with the Silent" are. A harder variant (speed,
 * difficulty) still means the game was finished.
 *
 * Tuned on a real library (finale-achievement.fixtures.json). It can't see
 * hidden achievements, which have no description and are often the
 * endings ("The Hollow Knight"): players will mark those by hand.
 */
const RULES: RegExp[] = [
  // Complete / finish / beat / clear the (entire) game, campaign or story.
  // Not "the story's opening sequence", not "a campaign battle".
  /\b(?:complet(?:e|es|ed)|finish(?:es|ed)?|beat(?:en|s)?|clear(?:s|ed)?)\s+(?:the|a|an|your)\s+(?:(?:entire|whole|full|single[- ]player)\s+)?(?:game|campaign|story)\b(?!['’]|\s+(?:battle|level|mission|map|mode)s?\b)/i,
  // The same with no article, as some games write it: "Beat Game Under 10
  // hours". Only "game": without an article, "complete story" is too loose.
  /\b(?:complet(?:e|es|ed)|finish(?:es|ed)?|beat(?:en|s)?|clear(?:s|ed)?)\s+game\b(?!['’]|\s+(?:battle|level|mission|map|mode)s?\b)/i,
  // Win a campaign (strategy games). Only campaigns: "Won a game of
  // Rock/Paper/Scissors" isn't an ending.
  /\b(?:win|won)\s+(?:the|a|an|your)\s+(?:(?:entire|whole|full|single[- ]player)\s+)?campaign\b(?!\s+(?:battle|level|mission|map|mode)s?\b)/i,
  /\b(?:complet(?:e|es|ed)|finish(?:es|ed)?)\s+the\s+main\s+(?:quest|story)\b/i,
  /\b(?:epilogue|credits|true ending|the ending)\b/i,
  /\bfinal\s+(?:boss|enemy|battle|mission|chapter|episode|curse)\b/i,
];

export function isFinaleAchievement(achievement: {
  name: string;
  description: string;
}): boolean {
  return RULES.some(
    (rule) => rule.test(achievement.name) || rule.test(achievement.description),
  );
}
