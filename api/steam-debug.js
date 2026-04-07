export default async function handler(req, res) {
  try {
    const apiKey = process.env.STEAM_API_KEY;
    const steamId = process.env.STEAM_ID64;

    if (!apiKey || !steamId) {
      return res.status(200).json({
        error: "Missing env vars",
        hasSteamApiKey: Boolean(apiKey),
        hasSteamId64: Boolean(steamId),
      });
    }

    const recentUrl =
      `https://api.steampowered.com/IPlayerService/GetRecentlyPlayedGames/v1/` +
      `?key=${apiKey}` +
      `&steamid=${steamId}` +
      `&count=4` +
      `&format=json`;

    const ownedUrl =
      `https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/` +
      `?key=${apiKey}` +
      `&steamid=${steamId}` +
      `&include_appinfo=1` +
      `&include_played_free_games=1` +
      `&format=json`;

    const recentResponse = await fetch(recentUrl);
    const ownedResponse = await fetch(ownedUrl);

    const recentText = await recentResponse.text();
    const ownedText = await ownedResponse.text();

    return res.status(200).json({
      recentStatus: recentResponse.status,
      ownedStatus: ownedResponse.status,
      recentOk: recentResponse.ok,
      ownedOk: ownedResponse.ok,
      recentPreview: recentText.slice(0, 500),
      ownedPreview: ownedText.slice(0, 500),
    });
  } catch (error) {
    return res.status(200).json({
      error: "Debug route failed",
      message: String(error),
    });
  }
}