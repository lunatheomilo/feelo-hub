export default async function handler(req, res) {
  const STEAM_API_KEY = process.env.STEAM_API_KEY;
  const STEAM_USER_ID = process.env.STEAM_USER_ID;

  if (!STEAM_API_KEY || !STEAM_USER_ID) {
    return res.status(500).json({ error: "Missing Steam credentials in environment variables." });
  }

  try {
    // Fetch full owned library (includes playtime)
    const libraryRes = await fetch(
      `https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?key=${STEAM_API_KEY}&steamid=${STEAM_USER_ID}&include_appinfo=true&include_played_free_games=true&format=json`
    );

    if (!libraryRes.ok) {
      throw new Error(`Steam library fetch failed: ${libraryRes.status}`);
    }

    const libraryData = await libraryRes.json();
    const allGames = libraryData?.response?.games || [];

    if (!allGames.length) {
      return res.status(200).json({ games: [], total: 0 });
    }

    // Sort by total playtime descending
    const sorted = [...allGames].sort(
      (a, b) => (b.playtime_forever || 0) - (a.playtime_forever || 0)
    );

    // Fetch Steam tags for top 60 games (enough for good scoring without hammering the API)
    const TOP_N = 60;
    const topGames = sorted.slice(0, TOP_N);

    const tagResults = await Promise.allSettled(
      topGames.map(async (game) => {
        try {
          const tagRes = await fetch(
            `https://store.steampowered.com/api/appdetails?appids=${game.appid}&filters=genres,categories`
          );
          if (!tagRes.ok) return { appid: game.appid, genres: [], categories: [] };
          const tagData = await tagRes.json();
          const appData = tagData?.[String(game.appid)]?.data;
          return {
            appid: game.appid,
            genres: (appData?.genres || []).map((g) => g.description.toLowerCase()),
            categories: (appData?.categories || []).map((c) => c.description.toLowerCase()),
          };
        } catch {
          return { appid: game.appid, genres: [], categories: [] };
        }
      })
    );

    // Build tag map
    const tagMap = {};
    tagResults.forEach((result) => {
      if (result.status === "fulfilled") {
        tagMap[result.value.appid] = {
          genres: result.value.genres,
          categories: result.value.categories,
        };
      }
    });

    // Shape the response
    const games = sorted.map((game) => ({
      appid: game.appid,
      name: game.name,
      playtime_forever: game.playtime_forever || 0,
      playtime_2weeks: game.playtime_2weeks || 0,
      img_icon_url: game.img_icon_url
        ? `https://media.steampowered.com/steamcommunity/public/images/apps/${game.appid}/${game.img_icon_url}.jpg`
        : null,
      header_image: `https://cdn.cloudflare.steamstatic.com/steam/apps/${game.appid}/header.jpg`,
      genres: tagMap[game.appid]?.genres || [],
      categories: tagMap[game.appid]?.categories || [],
    }));

    return res.status(200).json({ games, total: games.length });
  } catch (err) {
    console.error("steam-recent error:", err);
    return res.status(500).json({ error: "Failed to load Steam library." });
  }
}
