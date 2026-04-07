document.addEventListener("DOMContentLoaded", () => {
  const state = {
    mood: "",
    energy: "",
    genre: "any"
  };

  const selectionSummary = document.getElementById("selection-summary");
  const pickButton = document.getElementById("pick-button");
  const resetButton = document.getElementById("reset-button");
  const loadingPanel = document.getElementById("loading-panel");
  const resultsSection = document.getElementById("results-section");
  const resultsCopy = document.getElementById("results-copy");
  const resultsGrid = document.getElementById("results-grid");

  const chipButtons = document.querySelectorAll(".chip");

  chipButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const group = button.dataset.group;
      const value = button.dataset.value;

      if (!group || !value) return;

      if (group === "genre") {
        state.genre = value;
      } else {
        state[group] = value;
      }

      updateChipStates();
      updateSummary();
    });
  });

  pickButton.addEventListener("click", async () => {
    if (!state.mood || !state.energy) {
      selectionSummary.textContent = "Pick a mood and energy level first.";
      return;
    }

    showLoading(true);
    hideResults();

    try {
      const response = await fetch("/api/steam-recent");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch Steam data.");
      }

      const recommendations = buildSteamRecommendations(data, state);
      renderResults(recommendations);
    } catch (error) {
      console.error(error);
      selectionSummary.textContent = "Could not load your Steam data right now.";
    } finally {
      showLoading(false);
    }
  });

  resetButton.addEventListener("click", () => {
    state.mood = "";
    state.energy = "";
    state.genre = "any";

    updateChipStates();
    updateSummary();
    hideResults();
    showLoading(false);
  });

  function updateChipStates() {
    chipButtons.forEach((button) => {
      const group = button.dataset.group;
      const value = button.dataset.value;

      let isSelected = false;

      if (group === "genre") {
        isSelected = state.genre === value;
      } else {
        isSelected = state[group] === value;
      }

      button.classList.toggle("is-selected", isSelected);
    });
  }

  function updateSummary() {
    const moodText = state.mood || "no mood selected";
    const energyText = state.energy || "no energy selected";
    const genreText = state.genre || "any";

    selectionSummary.textContent =
      `Current vibe: ${moodText}, ${energyText} energy, ${genreText} genre.`;
  }

  function showLoading(isLoading) {
    loadingPanel.classList.toggle("hidden", !isLoading);
    pickButton.disabled = isLoading;
  }

  function hideResults() {
    resultsSection.classList.add("hidden");
    resultsGrid.innerHTML = "";
    resultsCopy.textContent = "";
  }

  function renderResults(recommendations) {
    resultsSection.classList.remove("hidden");

    resultsCopy.textContent =
      `Based on a ${state.mood} mood and ${state.energy} energy level, here are your picks from your Steam activity.`;

    if (!recommendations.length) {
      resultsGrid.innerHTML = `
        <article class="result-card">
          <span class="result-rank">No picks yet</span>
          <h3 class="result-title">Nothing matched</h3>
          <p class="result-reason">Try a different mood or energy level.</p>
        </article>
      `;
      return;
    }

    resultsGrid.innerHTML = recommendations
      .map((game, index) => {
        return `
          <article class="result-card">
            <span class="result-rank">Pick ${index + 1}</span>
            <h3 class="result-title">${escapeHtml(game.title)}</h3>
            <p class="result-meta">${escapeHtml(game.tag)}</p>
            <p class="result-reason">${escapeHtml(game.reason)}</p>
          </article>
        `;
      })
      .join("");
  }

  function buildSteamRecommendations(data, currentState) {
    const recentGames = Array.isArray(data.recentGames) ? data.recentGames : [];
    const topGames = Array.isArray(data.topGames) ? data.topGames : [];

    const picks = [];

    const recentMapped = recentGames.map((game) => ({
      title: game.name,
      tag: game.status || "recently played",
      reason: getReasonFromMood(currentState, game, "recent")
    }));

    const topMapped = topGames.map((game) => ({
      title: game.name,
      tag: game.status || "top played",
      reason: getReasonFromMood(currentState, game, "top")
    }));

    if (currentState.energy === "low") {
      picks.push(...recentMapped.slice(0, 2));
      picks.push(...topMapped.slice(0, 1));
    } else if (currentState.energy === "medium") {
      picks.push(...recentMapped.slice(0, 1));
      picks.push(...topMapped.slice(0, 2));
    } else {
      picks.push(...topMapped.slice(0, 2));
      picks.push(...recentMapped.slice(0, 1));
    }

    return dedupeByTitle(picks).slice(0, 3);
  }

  function getReasonFromMood(currentState, game, sourceType) {
    const mood = currentState.mood;
    const energy = currentState.energy;
    const playtime = game.playtimeForever || game.playtime2Weeks || 0;

    const moodLines = {
      cozy: "This feels like a comfortable pick for a lower-pressure session.",
      chaotic: "This feels like a good pick when you want something with more momentum and unpredictability.",
      adventurous: "This feels like a good match for exploring, experimenting, or diving back in.",
      melancholy: "This feels like the kind of game you can sink into when you want something immersive.",
      focused: "This feels like a strong choice when you want to lock in and stay engaged.",
      silly: "This feels like a fun pick when you want something a little lighter or less serious."
    };

    const sourceLine =
      sourceType === "recent"
        ? "You’ve touched it recently, so it already has some current momentum."
        : "It’s one of your most-played games, so it’s clearly a favorite for a reason.";

    const playtimeLine =
      playtime > 0
        ? `You already have ${formatMinutes(playtime)} in it, which makes it an easy re-entry point.`
        : "It looks like an easy one to jump into again.";

    return `${moodLines[mood] || "This seems like a solid fit."} ${sourceLine} ${playtimeLine} Best for ${energy} energy.`;
  }

  function formatMinutes(minutes) {
    const hours = Math.round(minutes / 60);
    if (hours < 1) return `${minutes} minutes`;
    if (hours === 1) return `about 1 hour`;
    return `about ${hours} hours`;
  }

  function dedupeByTitle(items) {
    const seen = new Set();
    return items.filter((item) => {
      const key = item.title.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  updateChipStates();
  updateSummary();
});