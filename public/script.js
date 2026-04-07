async function loadSteamGames() {
  const recentGrid = document.querySelector("#steam-recent-games");
  const topGrid = document.querySelector("#steam-top-games");

  if (!recentGrid || !topGrid) return;

  try {
    const response = await fetch("/api/steam-recent");
    const data = await response.json();

    const recentGames = data.recentGames || [];
    const topGames = data.topGames || [];

    if (recentGames.length === 0) {
      recentGrid.innerHTML = `
        <article class="game-card">
          <p class="game-status status-wishlist">no recent games</p>
          <h3 class="game-title">Nothing recent to show</h3>
          <p class="game-desc">
            Steam did not return any recently played games right now.
          </p>
        </article>
      `;
    } else {
      recentGrid.innerHTML = recentGames
        .map((game, index) => {
          const statusClass =
            index === 0 ? "status-playing" : "status-rotation";

          const hours2Weeks = (game.playtime2Weeks / 60).toFixed(1);

          return `
            <article class="game-card">
              <p class="game-status ${statusClass}">${game.status}</p>
              <h3 class="game-title">${game.name}</h3>
              <p class="game-desc">${hours2Weeks} hrs last 2 weeks</p>
            </article>
          `;
        })
        .join("");
    }

    if (topGames.length === 0) {
      topGrid.innerHTML = `
        <article class="game-card">
          <p class="game-status status-wishlist">no games found</p>
          <h3 class="game-title">Nothing to show yet</h3>
          <p class="game-desc">
            Steam returned an empty library for this account.
          </p>
        </article>
      `;
    } else {
      topGrid.innerHTML = topGames
        .map((game, index) => {
          const statusClass =
            index === 0 ? "status-playing" : "status-rotation";

          const hoursForever = (game.playtimeForever / 60).toFixed(1);

          return `
            <article class="game-card">
              <p class="game-status ${statusClass}">${game.status}</p>
              <h3 class="game-title">${game.name}</h3>
              <p class="game-desc">${hoursForever} hrs total</p>
            </article>
          `;
        })
        .join("");
    }
  } catch (error) {
    console.error("Steam fetch error:", error);

    recentGrid.innerHTML = `
      <article class="game-card">
        <p class="game-status status-wishlist">error</p>
        <h3 class="game-title">Recent section unavailable</h3>
        <p class="game-desc">Could not load your recent Steam activity.</p>
      </article>
    `;

    topGrid.innerHTML = `
      <article class="game-card">
        <p class="game-status status-wishlist">error</p>
        <h3 class="game-title">Top played section unavailable</h3>
        <p class="game-desc">Could not load your Steam library right now.</p>
      </article>
    `;
  }
}

document.addEventListener("DOMContentLoaded", loadSteamGames);