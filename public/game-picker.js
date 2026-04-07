document.addEventListener("DOMContentLoaded", () => {
  const state = {
    mood: "",
    energy: "",
    genre: "any",
  };

  const selectionSummary = document.getElementById("selection-summary");
  const pickButton = document.getElementById("pick-button");
  const resetButton = document.getElementById("reset-button");
  const loadingPanel = document.getElementById("loading-panel");
  const resultsSection = document.getElementById("results-section");
  const resultsCopy = document.getElementById("results-copy");
  const resultsGrid = document.getElementById("results-grid");
  const chipButtons = document.querySelectorAll(".chip");

  // ── Chip interactions ──────────────────────────────────────────────────────

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

  // ── Pick button ────────────────────────────────────────────────────────────

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

      if (!response.ok) throw new Error(data.error || "Failed to fetch Steam data.");
      if (!data.games?.length) throw new Error("No games found in your library.");

      const picks = scoredPicks(data.games, state);
      renderResults(picks);
    } catch (error) {
      console.error(error);
      selectionSummary.textContent = error.message || "Could not load your Steam data right now.";
    } finally {
      showLoading(false);
    }
  });

  // ── Reset ──────────────────────────────────────────────────────────────────

  resetButton.addEventListener("click", () => {
    state.mood = "";
    state.energy = "";
    state.genre = "any";
    updateChipStates();
    updateSummary();
    hideResults();
    showLoading(false);
  });

  // ── Scoring engine ─────────────────────────────────────────────────────────

  // Steam genre tags that map to each of our genre chips
  const GENRE_TAG_MAP = {
    roguelike: ["roguelike", "rogue-like", "rogue-lite", "roguelite"],
    rpg: ["rpg", "role-playing", "jrpg", "action rpg", "turn-based rpg"],
    simulation: ["simulation", "farming sim", "city builder", "management", "life sim"],
    puzzle: ["puzzle", "logic", "mystery", "hidden object"],
    "story-rich": ["story rich", "narrative", "visual novel", "choose your own adventure", "walking simulator"],
  };

  // Steam genre tags that map to our mood chips
  // More matches = higher score for that mood
  const MOOD_TAG_MAP = {
    cozy: ["cozy", "relaxing", "farming sim", "life sim", "casual", "cute", "wholesome", "exploration", "simulation", "open world"],
    chaotic: ["action", "shooter", "beat 'em up", "hack and slash", "fast-paced", "chaotic", "roguelike", "rogue-lite", "fighting"],
    adventurous: ["adventure", "open world", "exploration", "rpg", "action-adventure", "sandbox", "survival", "metroidvania"],
    melancholy: ["story rich", "atmospheric", "dark", "psychological horror", "mystery", "narrative", "emotional", "walking simulator", "indie"],
    focused: ["strategy", "turn-based", "puzzle", "tactics", "city builder", "management", "tower defense", "rpg"],
    silly: ["comedy", "casual", "party game", "funny", "cute", "cartoony", "satire", "arcade"],
  };

  // Energy affects how we weight playtime and game complexity
  const ENERGY_WEIGHTS = {
    low: {
      preferFamiliar: true,   // lean toward games you've played before
      complexityPenalty: ["strategy", "turn-based tactics", "grand strategy", "4x"],
      bonus: ["casual", "relaxing", "cozy", "simulation"],
    },
    medium: {
      preferFamiliar: false,
      complexityPenalty: ["grand strategy", "4x"],
      bonus: [],
    },
    high: {
      preferFamiliar: false,
      complexityPenalty: ["casual", "walking simulator"],
      bonus: ["action", "rpg", "strategy", "roguelike", "open world"],
    },
  };

  function scoredPicks(games, currentState) {
    const { mood, energy, genre } = currentState;
    const energyConfig = ENERGY_WEIGHTS[energy] || ENERGY_WEIGHTS.medium;
    const moodTags = MOOD_TAG_MAP[mood] || [];
    const genreTags = genre !== "any" ? GENRE_TAG_MAP[genre] || [] : [];

    const scored = games.map((game) => {
      const allTags = [...(game.genres || []), ...(game.categories || [])].map((t) =>
        t.toLowerCase()
      );

      let score = 0;
      const reasons = [];

      // ── Mood match (0–40 pts) ──
      const moodMatches = moodTags.filter((tag) => allTags.some((t) => t.includes(tag)));
      const moodScore = Math.min(moodMatches.length * 10, 40);
      score += moodScore;

      // ── Genre match (0–20 pts) ──
      if (genreTags.length) {
        const genreMatches = genreTags.filter((tag) => allTags.some((t) => t.includes(tag)));
        if (genreMatches.length) {
          score += 20;
          reasons.push(`matches your ${genre} preference`);
        } else {
          score -= 10; // penalise genre mismatch
        }
      }

      // ── Energy bonuses/penalties (±15 pts) ──
      const hasComplexity = energyConfig.complexityPenalty.some((tag) =>
        allTags.some((t) => t.includes(tag))
      );
      const hasEnergyBonus = energyConfig.bonus.some((tag) =>
        allTags.some((t) => t.includes(tag))
      );
      if (hasComplexity) score -= 15;
      if (hasEnergyBonus) score += 15;

      // ── Familiarity (playtime) ──
      const hours = Math.round((game.playtime_forever || 0) / 60);
      const recentHours = Math.round((game.playtime_2weeks || 0) / 60);

      if (energyConfig.preferFamiliar && hours > 0) {
        // Low energy: reward familiar games more
        score += Math.min(hours / 5, 15);
      }

      // Slight bump for recently played (already in flow)
      if (recentHours > 0) score += 8;

      // ── Feelo's baked-in preferences ──
      // Penalise multiplayer-only / online-required games
      const isMultiplayerOnly =
        allTags.includes("massively multiplayer") ||
        (allTags.includes("online pvp") && !allTags.includes("single-player"));
      if (isMultiplayerOnly) score -= 30;

      // Slight bonus for single-player confirmed
      if (allTags.includes("single-player")) score += 5;

      // East Asian setting bonus (best we can do without deeper data)
      const eastAsianHint = ["anime", "jrpg", "manga", "visual novel"].some((t) =>
        allTags.includes(t)
      );
      if (eastAsianHint) score += 5;

      // ── Build reason string ──
      const playtimeNote =
        recentHours > 0
          ? `You played it ${recentHours}h in the last two weeks — already in the flow.`
          : hours > 0
          ? `You have ${hours}h in it, so re-entry is easy.`
          : "Fresh start — no baggage.";

      const moodNote =
        moodMatches.length > 0
          ? `Its tags (${moodMatches.slice(0, 2).join(", ")}) line up with a ${mood} vibe.`
          : `It's worth a shot for a ${mood} session.`;

      const energyNote =
        hasEnergyBonus
          ? `Good match for ${energy} energy.`
          : hasComplexity
          ? `Might be a stretch for ${energy} energy, but doable.`
          : `Fine for ${energy} energy.`;

      return {
        appid: game.appid,
        title: game.name,
        header_image: game.header_image,
        tag: allTags.slice(0, 3).join(" · ") || "no tags",
        reason: `${moodNote} ${playtimeNote} ${energyNote}`,
        score,
        hours,
      };
    });

    // Sort by score, dedupe, take top 5
    return scored
      .filter((g) => g.score > 0)
      .sort((a, b) => b.score - a.score)
      .filter((g, i, arr) => arr.findIndex((x) => x.title === g.title) === i)
      .slice(0, 5);
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  function renderResults(picks) {
    resultsSection.classList.remove("hidden");
    resultsCopy.textContent = `Based on a ${state.mood} mood and ${state.energy} energy — here's what your library is saying.`;

    if (!picks.length) {
      resultsGrid.innerHTML = `
        <article class="result-card">
          <span class="result-rank">No picks</span>
          <h3 class="result-title">Nothing matched well</h3>
          <p class="result-reason">Try a different mood or energy level, or check that your Steam library loaded correctly.</p>
        </article>`;
      return;
    }

    resultsGrid.innerHTML = picks
      .map((game, index) => {
        const hoursNote = game.hours > 0 ? `${game.hours}h played` : "unplayed";
        const steamUrl = `https://store.steampowered.com/app/${game.appid}`;

        return `
          <article class="result-card">
            ${
              game.header_image
                ? `<a href="${steamUrl}" target="_blank" rel="noopener noreferrer">
                    <img class="result-img" src="${escapeHtml(game.header_image)}" alt="${escapeHtml(game.title)}" loading="lazy" onerror="this.style.display='none'" />
                   </a>`
                : ""
            }
            <span class="result-rank">Pick ${index + 1}</span>
            <h3 class="result-title">
              <a href="${steamUrl}" target="_blank" rel="noopener noreferrer">${escapeHtml(game.title)}</a>
            </h3>
            <p class="result-meta">${escapeHtml(game.tag)} · ${hoursNote}</p>
            <p class="result-reason">${escapeHtml(game.reason)}</p>
          </article>`;
      })
      .join("");
  }

  // ── UI helpers ─────────────────────────────────────────────────────────────

  function updateChipStates() {
    chipButtons.forEach((button) => {
      const group = button.dataset.group;
      const value = button.dataset.value;
      button.classList.toggle("is-selected", state[group] === value);
    });
  }

  function updateSummary() {
    const moodText = state.mood || "no mood";
    const energyText = state.energy || "no energy";
    const genreText = state.genre || "any";
    selectionSummary.textContent = `Current vibe: ${moodText}, ${energyText} energy, ${genreText} genre.`;
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