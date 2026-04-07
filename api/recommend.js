const Anthropic = require("@anthropic-ai/sdk");

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You are a personal game recommendation assistant for Feelo, a PC gamer with specific preferences.

FEELO'S PREFERENCES (always factor these in):
- Solo / offline only — no multiplayer or live service games
- No first-person POV — third-person or isometric strongly preferred
- Low to moderate management complexity — satisfying depth but not overwhelming
- East Asian settings are a strong positive
- Prefers playing as a woman or with character customization
- Dislikes overly competitive or punishing games

Given her Steam library and current mood/energy/genre, return 3–5 game picks ranked best to worst.

Respond ONLY with valid JSON, no markdown, no extra text:
{
  "picks": [
    {
      "name": "Game Name",
      "rank": 1,
      "match_score": 92,
      "why": "One or two sentences explaining why this fits her current mood and preferences.",
      "vibe_tags": ["cozy", "story-rich"],
      "appid": 12345
    }
  ],
  "mood_note": "A short 1-sentence note about today's picks."
}`;

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { mood, energy, genre, games } = req.body;
  if (!games?.length) return res.status(400).json({ error: "No games provided" });

  const gameList = games
    .slice(0, 300)
    .map((g) => `- ${g.name} (appid: ${g.appid}, played: ${g.playtime_forever} mins)`)
    .join("\n");

  const userMessage = `
Current mood: ${mood}
Energy level: ${energy}
Genre preference: ${genre || "no preference"}

My Steam library (${games.length} games):
${gameList}

Please recommend 3–5 games for right now.`;

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    });

    const text = response.content[0]?.text || "";
    const clean = text.replace(/```json|```/g, "").trim();
    const result = JSON.parse(clean);
    res.status(200).json(result);
  } catch (err) {
    console.error("recommend error:", err);
    res.status(500).json({ error: "Failed to generate recommendations" });
  }
};
