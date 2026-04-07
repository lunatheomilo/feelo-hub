document.addEventListener("DOMContentLoaded", () => {
  const state = { mood: "", energy: "", genre: "any" };

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
      state[group] = value;
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
      // Step 1: fetch full library
      const libraryRes = await fetch("/api/steam-recent");
      const libraryData = await libraryRes.json();
      if (!libraryRes.ok) throw new Error(libraryData.error || "Failed to fetch Steam library.");
      if (!libraryData.games?.length) throw new Error("No games found in your library.");

      // Step 2: send to Claude for recommendations
      const recommendRes = await fetch("/api/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mood: state.mood,
          energy: state.energy,
          genre: state.genre,
          games: libraryData.games,
        }),
      });
      const recommendData = await recommendRes.json();
      if (!recommendRes.ok) throw new Error(recommendData.error || "Failed to get recommendations.");

      renderResults(recommendData);
    } catch (error) {
      console.error(error);
      selectionSummary.textContent = error.message || "Something went wrong. Try again.";
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

  function renderResults(data) {
    resultsSection.classList.remove("hidden");
    resultsCopy.textContent = data.mood_note || `Here's what your library is saying for a ${state.mood} mood.`;

    if (!data.picks?.length) {
      resultsGrid.innerHTML = `
        <article class="result-card">
          <span class="result-rank">No picks</span>
          <h3 class="result-title">Nothing matched</h3>
          <p class="result-reason">Try a different mood or energy level.</p>
        </article>`;
      return;
    }

    resultsGrid.innerHTML = data.picks.map((pick, index) => {
      const steamUrl = `https://store.steampowered.com/app/${pick.appid}`;
      return `
        <article class="result-card">
          ${pick.appid ? `
            <a href="${steamUrl}" target="_blank" rel="noopener noreferrer">
              <img class="result-img"
                src="https://cdn.cloudflare.steamstatic.com/steam/apps/${pick.appid}/header.jpg"
                alt="${escapeHtml(pick.name)}"
                loading="lazy"
                onerror="this.style.display='none'" />
            </a>` : ""}
          <span class="result-rank">Pick ${index + 1} · ${pick.match_score}% match</span>
          <h3 class="result-title">
            ${pick.appid
              ? `<a href="${steamUrl}" target="_blank" rel="noopener noreferrer">${escapeHtml(pick.name)}</a>`
              : escapeHtml(pick.name)}
          </h3>
          <p class="result-reason">${escapeHtml(pick.why)}</p>
          ${pick.vibe_tags?.length ? `
            <div class="result-tags">
              ${pick.vibe_tags.map(t => `<span class="result-tag">${escapeHtml(t)}</span>`).join("")}
            </div>` : ""}
        </article>`;
    }).join("");
  }

  function updateChipStates() {
    chipButtons.forEach((button) => {
      const group = button.dataset.group;
      const value = button.dataset.value;
      button.classList.toggle("is-selected", state[group] === value);
    });
  }

  function updateSummary() {
    selectionSummary.textContent = `Current vibe: ${state.mood || "no mood"}, ${state.energy || "no energy"} energy, ${state.genre} genre.`;
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
