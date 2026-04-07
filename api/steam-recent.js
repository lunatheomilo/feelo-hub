export default async function handler(req, res) {
  const apiKey = process.env.STEAM_API_KEY;
  const steamId = process.env.STEAM_ID64;

  if (!apiKey || !steamId) {
    return res.status(500).json({
      error: "Missing STEAM_API_KEY or STEAM_ID64 in environment variables.",
    });
  }

  const recentUrl =
    `https://api.steampowered.com/IPlayerService/GetRecentlyPlayedGames/v1/` +
    `?key=${apiKey}` +
    `&steamid=${steamId}` +
    `&count=4`;

  const ownedUrl =
    `https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/` +
    `?key=${apiKey}` +
    `&steamid=${steamId}` +
    `&include_appinfo=1` +
    `&include_played_free_games=1` +
    `&format=json`;

  try {
    const [recentResponse, ownedResponse] = await Promise.all([
      fetch(recentUrl),
      fetch(ownedUrl),
    ]);

    if (!recentResponse.ok || !ownedResponse.ok) {
      return res.status(500).json({
        error: "Steam API request failed.",
      });
    }

    const recentData = await recentResponse.json();
    const ownedData = await ownedResponse.json();

    const recentGames = (recentData?.response?.games || []).map((game, index) => ({
      appid: game.appid,
      name: game.name,
      playtime2Weeks: game.playtime_2weeks || 0,
      playtimeForever: game.playtime_forever || 0,
      status: index === 0 ? "currently playing" : "recently played",
    }));

    const topGames = (ownedData?.response?.games || [])
      .sort((a, b) => (b.playtime_forever || 0) - (a.playtime_forever || 0))
      .slice(0, 4)
      .map((game, index) => ({
        appid: game.appid,
        name: game.name,
        playtimeForever: game.playtime_forever || 0,
        status: index === 0 ? "most played" : "top played",
      }));

    return res.status(200).json({
      recentGames,
      topGames,
    });
  } catch (error) {
    return res.status(500).json({
      error: "Something went wrong while fetching Steam data.",
    });
  }
}