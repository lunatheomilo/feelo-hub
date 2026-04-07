async function loadSteamGames() {
  const recentGrid = document.querySelector("#steam-recent-games");
  const topGrid = document.querySelector("#steam-top-games");
  if (!recentGrid || !topGrid) return;

  try {
    const response = await fetch("/api/steam-recent");
    const data = await response.json();
    const recentGames = data.recentGames || [];
    const topGames = data.topGames || [];

    // Show only the most recently played game
    if (recentGames.length === 0) {
      recentGrid.innerHTML = `
        <article class="game-card">
          <p class="game-status status-wishlist">nothing recent</p>
          <h3 class="game-title">No recent activity</h3>
          <p class="game-desc">Steam didn't return any recent games right now.</p>
        </article>`;
    } else {
      const game = recentGames[0];
      const hours = (game.playtime2Weeks / 60).toFixed(1);
      recentGrid.innerHTML = `
        <article class="game-card">
          <p class="game-status status-playing">${game.status}</p>
          <h3 class="game-title">${game.name}</h3>
          <p class="game-desc">${hours} hrs last 2 weeks</p>
        </article>`;
    }

    // Show top 4 only
    if (topGames.length === 0) {
      topGrid.innerHTML = `
        <article class="game-card">
          <p class="game-status status-wishlist">nothing yet</p>
          <h3 class="game-title">No top games found</h3>
          <p class="game-desc">Steam returned an empty library.</p>
        </article>`;
    } else {
      topGrid.innerHTML = topGames
        .slice(0, 4)
        .map((game, index) => {
          const hours = (game.playtimeForever / 60).toFixed(1);
          const statusClass = index === 0 ? "status-playing" : "status-rotation";
          return `
            <article class="game-card">
              <p class="game-status ${statusClass}">${game.status}</p>
              <h3 class="game-title">${game.name}</h3>
              <p class="game-desc">${hours} hrs total</p>
            </article>`;
        })
        .join("");
    }
  } catch (error) {
    console.error("Steam fetch error:", error);
    recentGrid.innerHTML = `
      <article class="game-card">
        <p class="game-status status-wishlist">error</p>
        <h3 class="game-title">Couldn't load recent games</h3>
        <p class="game-desc">Something went wrong fetching Steam data.</p>
      </article>`;
    topGrid.innerHTML = `
      <article class="game-card">
        <p class="game-status status-wishlist">error</p>
        <h3 class="game-title">Couldn't load top games</h3>
        <p class="game-desc">Something went wrong fetching Steam data.</p>
      </article>`;
  }
}

document.addEventListener("DOMContentLoaded", loadSteamGames);
