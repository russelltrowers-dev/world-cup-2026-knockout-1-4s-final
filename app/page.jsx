"use client";

import { useEffect, useMemo, useState } from "react";

const API_BASE_URL =
  "https://script.google.com/macros/s/AKfycbzeUH1HCRwfcHbjRcxAXtXBCNrOq4ncjBeOEQ_qlwcyGhFe_0qI6_2Qg1vpC0Sx-JfR/exec";

const PREDICTION_DEADLINE = new Date("2026-07-04T17:00:00+01:00");

const KNOCKOUT_MATCH_IDS = new Set([
  "89", "90", "91", "92", "93", "94", "95", "96",
  "97", "98", "99", "100", "101", "102", "104",
]);

const FALLBACK_FIXTURES = [
  { id: "90", round: "Last 16", date: "04/07/2026", kickoff: "18:00", team1: "Canada", team2: "Netherlands or Morocco", venue: "Houston, USA", result: "", status: "OPEN" },
  { id: "89", round: "Last 16", date: "04/07/2026", kickoff: "22:00", team1: "Germany or Paraguay", team2: "France or Sweden", venue: "Philadelphia, USA", result: "", status: "OPEN" },
  { id: "91", round: "Last 16", date: "05/07/2026", kickoff: "21:00", team1: "Brazil or Japan", team2: "Ivory Coast or Norway", venue: "New Jersey, USA", result: "", status: "OPEN" },
  { id: "92", round: "Last 16", date: "06/07/2026", kickoff: "01:00", team1: "Mexico or Ecuador", team2: "England or DR Congo", venue: "Mexico City, Mexico", result: "", status: "OPEN" },
  { id: "93", round: "Last 16", date: "06/07/2026", kickoff: "20:00", team1: "Portugal or Croatia", team2: "Spain or Austria", venue: "Arlington, USA", result: "", status: "OPEN" },
  { id: "94", round: "Last 16", date: "07/07/2026", kickoff: "01:00", team1: "USA or Bosnia", team2: "Belgium or Senegal", venue: "Seattle, USA", result: "", status: "OPEN" },
  { id: "95", round: "Last 16", date: "07/07/2026", kickoff: "17:00", team1: "Argentina or Cape Verde", team2: "Australia or Egypt", venue: "Atlanta, USA", result: "", status: "OPEN" },
  { id: "96", round: "Last 16", date: "07/07/2026", kickoff: "21:00", team1: "Switzerland or Algeria", team2: "Colombia or Ghana", venue: "Vancouver, Canada", result: "", status: "OPEN" },
  { id: "97", round: "Quarter-final", date: "09/07/2026", kickoff: "21:00", team1: "Germany/Paraguay/France/Sweden", team2: "South Africa/Canada/Netherlands/Morocco", venue: "Foxborough, USA", result: "", status: "OPEN" },
  { id: "98", round: "Quarter-final", date: "10/07/2026", kickoff: "20:00", team1: "Portugal/Croatia/Spain/Austria", team2: "USA/Bosnia/Belgium/Senegal", venue: "Los Angeles, USA", result: "", status: "OPEN" },
  { id: "99", round: "Quarter-final", date: "11/07/2026", kickoff: "22:00", team1: "Brazil/Japan/Ivory Coast/Norway", team2: "Mexico/Ecuador/England/DR Congo", venue: "Miami, USA", result: "", status: "OPEN" },
  { id: "100", round: "Quarter-final", date: "12/07/2026", kickoff: "02:00", team1: "Argentina/Cape Verde/Australia/Egypt", team2: "Switzerland/Algeria/Colombia/Ghana", venue: "Kansas City, USA", result: "", status: "OPEN" },
  { id: "101", round: "Semi-final", date: "14/07/2026", kickoff: "20:00", team1: "Match 97 winners", team2: "Match 98 winners", venue: "Arlington, USA", result: "", status: "OPEN" },
  { id: "102", round: "Semi-final", date: "15/07/2026", kickoff: "20:00", team1: "Match 99 winners", team2: "Match 100 winners", venue: "Atlanta, USA", result: "", status: "OPEN" },
  { id: "104", round: "Final", date: "19/07/2026", kickoff: "20:00", team1: "Match 101 winners", team2: "Match 102 winners", venue: "New Jersey, USA", result: "", status: "OPEN" },
];


export default function Home() {
  const [fixtures, setFixtures] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [status, setStatus] = useState("Connecting to spreadsheet...");
  const [predictions, setPredictions] = useState({});
  const [saving, setSaving] = useState({});
  const [savedStatus, setSavedStatus] = useState({});
  const [editMode, setEditMode] = useState({});
  const [saveMessage, setSaveMessage] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [loginCode, setLoginCode] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loadingPredictions, setLoadingPredictions] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [now, setNow] = useState(new Date());

  const [paymentInfo, setPaymentInfo] = useState({
    paidCount: 0,
    totalPlayers: 0,
    entryFee: 10,
    prizePot: 0,
    currentPlayer: null,
  });

  const predictionsLocked = now >= PREDICTION_DEADLINE;

  useEffect(() => {
    const savedName = localStorage.getItem("rtPlayerName");
    const savedCode = localStorage.getItem("rtLoginCode");

    if (savedName && savedCode) {
      setPlayerName(savedName);
      setLoginCode(savedCode);
      setIsLoggedIn(true);
      loadSavedPredictions(savedName);
      loadPlayers(savedName);
    } else {
      loadPlayers("");
    }

    loadFixtures();
    loadLeaderboard();

    const leaderboardInterval = setInterval(loadLeaderboard, 30000);
    const fixturesInterval = setInterval(loadFixtures, 60000);
    const playersInterval = setInterval(() => {
      loadPlayers(localStorage.getItem("rtPlayerName") || "");
    }, 60000);
    const clockInterval = setInterval(() => setNow(new Date()), 1000);

    return () => {
      clearInterval(leaderboardInterval);
      clearInterval(fixturesInterval);
      clearInterval(playersInterval);
      clearInterval(clockInterval);
    };
  }, []);

  async function loadFixtures() {
    try {
      const response = await fetch(`${API_BASE_URL}?action=fixtures`);
      const data = await response.json();

      if (data.success && Array.isArray(data.fixtures)) {
        const mappedFixtures = data.fixtures
          .map((fixture) => ({
            id: String(fixture.matchId || fixture.id || "").trim(),
            round: normalizeRound(fixture.round || fixture.stage || fixture.group || ""),
            date: fixture.date || "",
            kickoff: fixture.kickoff || "",
            team1: String(fixture.team1 || fixture.homeTeam || fixture.home || "").trim(),
            team2: String(fixture.team2 || fixture.awayTeam || fixture.away || "").trim(),
            venue: String(fixture.venue || "").trim(),
            result: String(fixture.actualScore || fixture.result || "").trim(),
            status: fixture.status || "OPEN",
          }))
          .filter(
            (fixture) =>
              KNOCKOUT_MATCH_IDS.has(fixture.id) &&
              fixture.team1 &&
              fixture.team2 &&
              fixture.team1.toLowerCase() !== "team 1" &&
              fixture.team2.toLowerCase() !== "team 2"
          )
          .sort(sortFixtures);

        const fixturesToUse = mappedFixtures.length > 0 ? mappedFixtures : FALLBACK_FIXTURES;

        setFixtures(fixturesToUse);
        setStatus(`Knockout app connected — ${fixturesToUse.length} fixtures loaded`);
      } else {
        setFixtures(FALLBACK_FIXTURES);
        setStatus("Using built-in Sky Sports knockout fixtures");
      }
    } catch {
      setFixtures(FALLBACK_FIXTURES);
      setStatus("Using built-in Sky Sports knockout fixtures");
    }
  }

  async function loadLeaderboard() {
    try {
      const response = await fetch(`${API_BASE_URL}?action=leaderboard`);
      const data = await response.json();

      if (data.success && Array.isArray(data.leaderboard)) {
        setLeaderboard((previousLeaderboard) => {
          const previousRanks = {};
          previousLeaderboard.forEach((row) => {
            previousRanks[String(row.name || "").toLowerCase()] = Number(row.rank);
          });

          return data.leaderboard.map((row) => {
            const nameKey = String(row.name || "").toLowerCase();
            const previousRank = previousRanks[nameKey];
            const currentRank = Number(row.rank);

            let movement = "same";
            let movementAmount = 0;

            if (previousRank && currentRank) {
              if (currentRank < previousRank) {
                movement = "up";
                movementAmount = previousRank - currentRank;
              } else if (currentRank > previousRank) {
                movement = "down";
                movementAmount = currentRank - previousRank;
              }
            }

            return { ...row, movement, movementAmount };
          });
        });
      }
    } catch {
      setLeaderboard([]);
    }
  }

  async function loadPlayers(name) {
    try {
      const cleanName = String(name || "").trim();
      const response = await fetch(
        `${API_BASE_URL}?action=players&user=${encodeURIComponent(cleanName)}`
      );
      const data = await response.json();

      if (data.success) {
        setPaymentInfo({
          paidCount: Number(data.paidCount) || 0,
          totalPlayers: Number(data.totalPlayers) || 0,
          entryFee: Number(data.entryFee) || 10,
          prizePot: Number(data.prizePot) || 0,
          currentPlayer: data.currentPlayer || null,
        });
      }
    } catch {
      setPaymentInfo((current) => current);
    }
  }

  async function loginPlayer() {
    const cleanName = String(playerName || "").trim();
    const cleanCode = String(loginCode || "").trim();

    if (!cleanName || !cleanCode) {
      setSaveMessage("Please enter your name and login code.");
      return;
    }

    setLoginLoading(true);

    try {
      const response = await fetch(
        `${API_BASE_URL}?action=login&user=${encodeURIComponent(cleanName)}&code=${encodeURIComponent(cleanCode)}`
      );

      const data = await response.json();

      if (data.success && data.player) {
        const officialName = String(data.player.name || cleanName).trim();

        localStorage.setItem("rtPlayerName", officialName);
        localStorage.setItem("rtLoginCode", cleanCode);

        setPlayerName(officialName);
        setIsLoggedIn(true);
        setSaveMessage(`✅ Logged in as ${officialName}`);

        await loadSavedPredictions(officialName);
        await loadPlayers(officialName);
      } else {
        setIsLoggedIn(false);
        setSaveMessage("Invalid name or login code.");
      }
    } catch {
      setIsLoggedIn(false);
      setSaveMessage("Could not log in. Please try again.");
    } finally {
      setLoginLoading(false);
    }
  }

  async function loadSavedPredictions(name) {
    const cleanName = String(name || "").trim();
    if (!cleanName) return;

    setLoadingPredictions(true);

    try {
      const response = await fetch(
        `${API_BASE_URL}?action=predictions&user=${encodeURIComponent(cleanName)}`
      );

      const data = await response.json();

      if (data.success && data.predictions) {
        const cleanPredictions = {};

        Object.entries(data.predictions).forEach(([matchId, prediction]) => {
          cleanPredictions[String(matchId).trim()] = String(prediction || "").trim();
        });

        setPredictions(cleanPredictions);
        setEditMode({});
        setSaveMessage(`📥 Loaded saved predictions for ${cleanName}`);
      } else {
        setSaveMessage(`No saved predictions found for ${cleanName}`);
      }
    } catch {
      setSaveMessage("Could not load saved predictions.");
    } finally {
      setLoadingPredictions(false);
    }
  }

  const roundFixtures = useMemo(() => fixtures, [fixtures]);

  const completedPredictions = Object.values(predictions).filter(Boolean).length;
  const prizePot = paymentInfo.prizePot;
  const countdown = getCountdown(now, PREDICTION_DEADLINE);

  const leader =
    leaderboard.length > 0
      ? leaderboard.reduce((best, current) =>
          Number(current.points || 0) > Number(best.points || 0) ? current : best
        )
      : null;

  const podium = leaderboard.slice(0, 3);

  const myPosition =
    playerName && leaderboard.length > 0
      ? leaderboard.find(
          (row) =>
            String(row.name || "").trim().toLowerCase() ===
            String(playerName || "").trim().toLowerCase()
        )
      : null;

  function movementLabel(row) {
    if (!row || !row.movement || row.movement === "same") return "—";
    if (row.movement === "up") return `↑${row.movementAmount}`;
    if (row.movement === "down") return `↓${row.movementAmount}`;
    return "—";
  }

  function movementClass(row) {
    if (!row || row.movement === "same") return "bg-white/10 text-slate-300";
    if (row.movement === "up") return "bg-emerald-400/10 text-emerald-200";
    return "bg-red-400/10 text-red-200";
  }

  function getFixtureDisplayStatus(fixture) {
    if (fixture.result) return { label: "✅ FT", className: "bg-blue-400/10 text-blue-200" };

    const kickoffDate = getKickoffDate(fixture);

    if (kickoffDate && now >= kickoffDate) {
      return { label: "🔴 LIVE", className: "bg-red-400/10 text-red-200" };
    }

    return { label: "🟢 OPEN", className: "bg-emerald-400/10 text-emerald-200" };
  }

  async function savePrediction(fixture) {
    if (!isLoggedIn) {
      setSaveMessage("Please log in before saving predictions.");
      return;
    }

    if (predictionsLocked) {
      setSaveMessage("Predictions are locked. The deadline has passed.");
      return;
    }

    const fixtureId = String(fixture.id);
    const prediction = String(predictions[fixtureId] || "").trim();
    const cleanName = String(playerName || "").trim();

    if (!prediction) {
      setSaveMessage("Please enter a prediction before saving.");
      return;
    }

    if (!isValidScore(prediction)) {
      setSaveMessage("Please enter a valid score, for example 2-1.");
      return;
    }

    setSaving((current) => ({ ...current, [fixtureId]: true }));
    setSavedStatus((current) => ({ ...current, [fixtureId]: "" }));

    try {
      const response = await fetch(API_BASE_URL, {
        method: "POST",
        body: JSON.stringify({
          action: "savePrediction",
          user: cleanName,
          matchId: fixtureId,
          prediction,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setSavedStatus((current) => ({
          ...current,
          [fixtureId]: `✅ Saved ${prediction}`,
        }));

        setEditMode((current) => ({
          ...current,
          [fixtureId]: false,
        }));

        setSaveMessage(`✅ Saved ${prediction} for ${cleanName}`);
        await loadSavedPredictions(cleanName);

        setTimeout(() => {
          setSavedStatus((current) => ({ ...current, [fixtureId]: "" }));
        }, 4000);
      } else {
        setSavedStatus((current) => ({ ...current, [fixtureId]: "Could not save" }));
        setSaveMessage(data.error || "Could not save prediction. Please try again.");
      }
    } catch {
      setSavedStatus((current) => ({ ...current, [fixtureId]: "Could not save" }));
      setSaveMessage("Could not save prediction. Please try again.");
    } finally {
      setSaving((current) => ({ ...current, [fixtureId]: false }));
    }
  }

  return (
    <main className="min-h-screen bg-[#06111f] text-white">
      <div className="mx-auto max-w-6xl px-3 py-4 sm:px-4 sm:py-6">
        <section className="rounded-[28px] border border-white/10 bg-gradient-to-br from-slate-950 via-slate-900 to-amber-900/30 p-5 shadow-2xl sm:rounded-3xl sm:p-6">
          <div className="mb-3 inline-flex rounded-full bg-amber-300/10 px-3 py-1 text-[11px] font-semibold text-amber-200 sm:text-xs">
            🏆 FIFA feel · Friendly league · {status}
          </div>

          <div className="grid gap-5 md:grid-cols-[1.5fr_0.8fr] md:gap-6">
            <div>
              <div className="mb-6">
                <img
                  src="/logo.jpg"
                  alt="World Cup 2026 Knockout Predictions"
                  className="w-full max-w-[900px] rounded-2xl border border-yellow-500/30 shadow-2xl"
                />
              </div>

              <p className="mt-2 text-base font-bold text-amber-200 sm:text-lg">
                powered by RT
              </p>

              <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
                Predict every Last 16, Quarter-final, Semi-final and Final score. Use your Joker wisely and climb the RT league table.
              </p>
            </div>

            <div className="rounded-[24px] border border-amber-200/20 bg-white/10 p-4 sm:rounded-3xl sm:p-5">
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-300 text-xl sm:h-12 sm:w-12 sm:text-2xl">
                🏆
              </div>

              <p className="text-[11px] uppercase tracking-widest text-amber-100/70 sm:text-xs">
                RT World Cup League
              </p>

              <div className="mt-4 grid grid-cols-2 gap-2 text-sm sm:gap-3">
                <div className="rounded-2xl bg-slate-950/60 p-3">
                  <p className="text-slate-400">Fixtures</p>
                  <p className="text-2xl font-black">{fixtures.length || "—"}</p>
                </div>

                <div className="rounded-2xl bg-slate-950/60 p-3">
                  <p className="text-slate-400">Prize Pot</p>
                  <p className="text-2xl font-black">£{prizePot}</p>
                </div>

                <div className="rounded-2xl bg-slate-950/60 p-3">
                  <p className="text-slate-400">Paid</p>
                  <p className="text-2xl font-black">
                    {paymentInfo.paidCount}/{paymentInfo.totalPlayers}
                  </p>
                </div>

                <div className="rounded-2xl bg-slate-950/60 p-3">
                  <p className="text-slate-400">Code</p>
                  <p className="text-sm font-black">RTWORLD26</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {leader && (
          <section className="mt-5 overflow-hidden rounded-[28px] border border-amber-300/20 bg-gradient-to-br from-[#1b2230] via-[#111827] to-[#1b2230] shadow-2xl sm:mt-6 sm:rounded-[32px]">
            <div className="relative p-5 sm:p-6 md:p-7">
              <div className="absolute right-0 top-0 h-36 w-36 rounded-full bg-amber-300/10 blur-3xl sm:h-40 sm:w-40" />

              <div className="relative flex items-center gap-3 sm:gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-300 to-yellow-500 text-xl shadow-lg sm:h-12 sm:w-12 sm:text-2xl">
                  🏆
                </div>

                <div className="min-w-0 flex-1">
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-amber-200/70 sm:text-xs">
                    Current League Leader
                  </p>

                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="truncate text-2xl font-black text-white md:text-3xl">
                      {leader.name}
                    </h2>

                    <span className="rounded-full bg-amber-300/15 px-3 py-1 text-sm font-bold text-amber-200">
                      {leader.points} pts
                    </span>

                    <span className={`rounded-full px-3 py-1 text-sm font-bold ${movementClass(leader)}`}>
                      {movementLabel(leader)}
                    </span>
                  </div>

                  <p className="mt-2 text-sm text-slate-300">
                    Exact scores:{" "}
                    <span className="font-bold text-white">{leader.exactScores || 0}</span>{" "}
                    · Correct results:{" "}
                    <span className="font-bold text-white">{leader.correctResults || 0}</span>
                  </p>
                </div>
              </div>
            </div>
          </section>
        )}

        {myPosition && (
          <section className="mt-5 rounded-[28px] border border-sky-300/20 bg-gradient-to-br from-sky-500/10 via-white/[0.04] to-slate-900 p-5 shadow-xl sm:mt-6 sm:rounded-[32px] sm:p-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-sky-300 text-2xl text-slate-950 shadow-lg">
                👤
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-sky-200/70 sm:text-xs">
                  My Position
                </p>

                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <h2 className="truncate text-2xl font-black text-white">
                    {myPosition.name}
                  </h2>

                  <span className="rounded-full bg-sky-300/15 px-3 py-1 text-sm font-bold text-sky-200">
                    #{myPosition.rank} in League
                  </span>

                  <span className="rounded-full bg-amber-300/15 px-3 py-1 text-sm font-bold text-amber-200">
                    {myPosition.points || 0} pts
                  </span>

                  <span className={`rounded-full px-3 py-1 text-sm font-bold ${movementClass(myPosition)}`}>
                    {movementLabel(myPosition)}
                  </span>
                </div>

                <p className="mt-2 text-sm text-slate-300">
                  Exact: <span className="font-bold text-white">{myPosition.exactScores || 0}</span>{" "}
                  · Correct: <span className="font-bold text-white">{myPosition.correctResults || 0}</span>
                </p>
              </div>
            </div>
          </section>
        )}

        {podium.length > 0 && (
          <section className="mt-7 rounded-[28px] border border-white/10 bg-white/[0.06] p-4 shadow-xl sm:mt-8 sm:rounded-3xl sm:p-5">
            <div className="mb-4">
              <h2 className="text-2xl font-black sm:text-3xl">Podium</h2>
              <p className="text-sm text-slate-400">Top 3 players in the RT league.</p>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              {podium.map((player, index) => {
                const isFirst = index === 0;
                const medal = index === 0 ? "🥇" : index === 1 ? "🥈" : "🥉";
                const label =
                  index === 0 ? "Champion pace" : index === 1 ? "Chasing" : "Podium place";

                return (
                  <div
                    key={`${player.name}-${index}`}
                    className={`rounded-[24px] border p-4 shadow-lg ${
                      isFirst
                        ? "border-amber-300/30 bg-gradient-to-br from-amber-300/20 to-yellow-600/10 md:-mt-3"
                        : index === 1
                        ? "border-slate-300/20 bg-white/[0.07]"
                        : "border-orange-300/20 bg-orange-500/10"
                    }`}
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-3xl">{medal}</span>
                      <div className="flex gap-2">
                        <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-slate-200">
                          #{player.rank}
                        </span>
                        <span className={`rounded-full px-3 py-1 text-xs font-bold ${movementClass(player)}`}>
                          {movementLabel(player)}
                        </span>
                      </div>
                    </div>

                    <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                      {label}
                    </p>

                    <h3 className="mt-1 truncate text-2xl font-black text-white">
                      {player.name}
                    </h3>

                    <p className="mt-2 text-4xl font-black text-amber-200">
                      {player.points || 0}
                      <span className="ml-1 text-sm text-slate-400">pts</span>
                    </p>

                    <p className="mt-3 text-sm text-slate-300">
                      Exact: <span className="font-bold text-white">{player.exactScores || 0}</span>{" "}
                      · Correct: <span className="font-bold text-white">{player.correctResults || 0}</span>
                    </p>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        <section
          className={`mt-5 rounded-[24px] border p-4 sm:mt-6 sm:rounded-3xl sm:p-5 ${
            predictionsLocked
              ? "border-red-300/20 bg-red-400/10"
              : "border-emerald-300/20 bg-emerald-400/10"
          }`}
        >
          <h2 className="text-xl font-black sm:text-2xl">
            {predictionsLocked ? "🔒 Predictions Locked" : "🟢 Predictions Open"}
          </h2>

          <p className="mt-1 text-sm text-slate-300 sm:text-base">
            Deadline: Saturday 4 July 2026 at 17:00 BST
          </p>

          <div className="mt-4 grid grid-cols-4 gap-2">
            {[
              ["Days", countdown.days],
              ["Hours", countdown.hours],
              ["Mins", countdown.minutes],
              ["Secs", countdown.seconds],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl bg-slate-950/50 p-3 text-center">
                <p className="text-2xl font-black text-white">{value}</p>
                <p className="text-[10px] uppercase tracking-widest text-slate-400">{label}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-5 rounded-[24px] border border-white/10 bg-white/[0.06] p-4 sm:mt-6 sm:rounded-3xl sm:p-5">
          <h2 className="text-xl font-black sm:text-2xl">
            {isLoggedIn ? "Profile Locked" : "Player Login"}
          </h2>

          <p className="mt-1 text-sm text-slate-400 sm:text-base">
            Enter your real name and private login code to load your predictions.
          </p>

          <div className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_auto_auto]">
            <input
              value={playerName}
              disabled={isLoggedIn}
              onChange={(event) => setPlayerName(event.target.value)}
              placeholder="Your real name"
              className="min-h-12 rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none disabled:cursor-not-allowed disabled:opacity-60"
            />

            <input
              value={loginCode}
              disabled={isLoggedIn}
              onChange={(event) => setLoginCode(event.target.value)}
              placeholder="Login code"
              className="min-h-12 rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none disabled:cursor-not-allowed disabled:opacity-60"
            />

            <button
              onClick={loginPlayer}
              disabled={isLoggedIn || loginLoading}
              className="min-h-12 rounded-xl bg-amber-300 px-5 py-3 font-black text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoggedIn ? "Logged In" : loginLoading ? "Checking..." : "Login"}
            </button>

            <button
              onClick={() => loadSavedPredictions(playerName)}
              disabled={!isLoggedIn || loadingPredictions}
              className="min-h-12 rounded-xl border border-white/20 bg-white/5 px-5 py-3 font-black text-white disabled:opacity-50"
            >
              {loadingPredictions ? "Loading..." : "Load Predictions"}
            </button>
          </div>

          {isLoggedIn && (
            <div className="mt-4 rounded-2xl border border-emerald-300/20 bg-emerald-400/10 px-4 py-3">
              <p className="text-sm font-semibold text-emerald-200">
                🔒 Logged in as <span className="font-black text-white">{playerName}</span>
              </p>
            </div>
          )}
        </section>

        {playerName && (
          <section className="mt-5 rounded-[24px] border border-white/10 bg-white/[0.06] p-4 sm:rounded-3xl sm:p-5">
            <h2 className="text-xl font-black sm:text-2xl">Payment Status</h2>

            <div className="mt-3 flex flex-wrap items-center gap-3">
              <span
                className={`rounded-full px-4 py-2 font-black ${
                  paymentInfo.currentPlayer?.paid
                    ? "bg-emerald-400/10 text-emerald-200"
                    : "bg-red-400/10 text-red-200"
                }`}
              >
                {paymentInfo.currentPlayer?.paid ? "✅ Paid" : "❌ Not Paid"}
              </span>

              <span className="rounded-full bg-white/10 px-4 py-2 text-sm font-bold text-slate-200">
                Paid players: {paymentInfo.paidCount}/{paymentInfo.totalPlayers}
              </span>

              <span className="rounded-full bg-amber-300/15 px-4 py-2 text-sm font-bold text-amber-200">
                Prize pot: £{paymentInfo.prizePot}
              </span>
            </div>

            {!paymentInfo.currentPlayer && (
              <p className="mt-3 text-sm text-slate-400">
                Your name is not yet listed in the Players sheet.
              </p>
            )}
          </section>
        )}

        {saveMessage && (
          <div className="mt-5 rounded-2xl border border-emerald-300/20 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-200 sm:text-base">
            {saveMessage}
          </div>
        )}

        <section className="mt-5 grid gap-3 sm:mt-6 sm:grid-cols-3 sm:gap-4">
          <div className="rounded-[24px] border border-white/10 bg-white/[0.06] p-4 sm:rounded-3xl sm:p-5">
            <p className="text-sm text-slate-400">Predictions Complete</p>
            <p className="mt-2 text-3xl font-black sm:text-4xl">
              {completedPredictions}/{fixtures.length || 15}
            </p>
          </div>

          <div className="rounded-[24px] border border-white/10 bg-white/[0.06] p-4 sm:rounded-3xl sm:p-5">
            <p className="text-sm text-slate-400">Entry Fee</p>
            <p className="mt-2 text-3xl font-black">£{paymentInfo.entryFee}</p>
          </div>

          <div className="rounded-[24px] border border-amber-200/20 bg-amber-300 p-4 text-slate-950 sm:rounded-3xl sm:p-5">
            <p className="font-bold">Scoring</p>
            <p className="mt-2 text-2xl font-black sm:text-3xl">4 exact · 2 result</p>
            <p className="mt-2 text-sm font-bold">Joker match = double points</p>
          </div>
        </section>

        <section className="mt-7 rounded-[24px] border border-white/10 bg-white/[0.06] p-4 sm:mt-8 sm:rounded-3xl sm:p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-2xl font-black sm:text-3xl">Live Leaderboard</h2>
              <p className="text-sm text-slate-400 sm:text-base">
                Pulled from your Google Sheet.
              </p>
            </div>

            <button
              onClick={loadLeaderboard}
              className="rounded-xl bg-amber-300 px-4 py-2 text-sm font-black text-slate-950 sm:text-base"
            >
              Refresh
            </button>
          </div>

          <div className="grid gap-3">
            {leaderboard.map((row, index) => (
              <div
                key={`${row.name}-${index}`}
                className="grid grid-cols-[48px_1fr_70px_52px] items-center gap-2 rounded-2xl bg-slate-950/60 p-3 sm:grid-cols-[60px_1fr_90px_64px] sm:gap-3 sm:p-4"
              >
                <div className="text-xl font-black sm:text-2xl">
                  {row.rank === 1 || row.rank === "1"
                    ? "🥇"
                    : row.rank === 2 || row.rank === "2"
                    ? "🥈"
                    : row.rank === 3 || row.rank === "3"
                    ? "🥉"
                    : row.rank}
                </div>

                <div className="min-w-0">
                  <p className="truncate font-black">{row.name || "Player"}</p>
                  <p className="text-xs text-slate-400 sm:text-sm">
                    Exact: {row.exactScores || 0} · Correct: {row.correctResults || 0}
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-xl font-black text-amber-200 sm:text-2xl">
                    {row.points || 0}
                  </p>
                  <p className="text-[10px] text-slate-400 sm:text-xs">pts</p>
                </div>

                <div className="text-right">
                  <span className={`inline-flex rounded-full px-2 py-1 text-xs font-bold ${movementClass(row)}`}>
                    {movementLabel(row)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-7 sm:mt-8">
          <h2 className="text-2xl font-black sm:text-3xl">Knockout Fixtures</h2>
          <p className="text-sm text-slate-400 sm:text-base">
            Last 16, Quarter-finals, Semi-finals and Final fixtures using the Sky Sports UK schedule.
          </p>

          <div className="grid gap-4">
            {roundFixtures.length === 0 ? (
              <div className="rounded-[24px] border border-white/10 bg-white/[0.06] p-5 text-slate-300 sm:rounded-3xl sm:p-6">
                No knockout fixtures found. Check the Fixtures tab in your Google Sheet.
              </div>
            ) : (
              roundFixtures.map((fixture) => {
                const fixtureId = String(fixture.id);
                const predictionValue = String(predictions[fixtureId] || "");
                const fixtureStatus = getFixtureDisplayStatus(fixture);
                const hasPrediction = Boolean(predictionValue);
                const isEditing = Boolean(editMode[fixtureId]);
                const predictionInputLocked =
                  !isLoggedIn || predictionsLocked || (hasPrediction && !isEditing);

                return (
                  <div
                    key={fixtureId}
                    className="rounded-[24px] border border-white/10 bg-white/[0.06] p-4 shadow-xl sm:rounded-3xl sm:p-5"
                  >
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400 sm:text-sm">
                      <span className="rounded-full bg-amber-300/10 px-3 py-1 text-amber-200">
                        {fixture.round || "Knockout"}
                      </span>

                      <span>
                        {formatDate(fixture.date)} · {fixture.kickoff}
                      </span>
                    </div>

                    <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-center">
                      <div>
                        <p className="text-[11px] uppercase tracking-widest text-slate-500 sm:text-xs">
                          {fixture.venue || "Venue TBC"}
                        </p>

                        <h3 className="mt-2 text-xl font-black sm:text-2xl">
                          {fixture.team1}
                        </h3>
                        <p className="my-1 text-sm text-slate-400">vs</p>
                        <h3 className="text-xl font-black sm:text-2xl">
                          {fixture.team2}
                        </h3>

                        <div className="mt-3 flex flex-wrap gap-2 text-sm">
                          <span className={`rounded-full px-3 py-1 ${fixtureStatus.className}`}>
                            {fixtureStatus.label}
                          </span>

                          {fixture.result && (
                            <span className="rounded-full bg-white/10 px-3 py-1">
                              Result: {fixture.result}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="rounded-2xl bg-slate-950/70 p-4 text-center md:min-w-[180px]">
                        {hasPrediction && !predictionsLocked && !isEditing && isLoggedIn && (
                          <button
                            onClick={() =>
                              setEditMode((current) => ({
                                ...current,
                                [fixtureId]: true,
                              }))
                            }
                            className="mb-2 rounded-lg bg-amber-300 px-4 py-1 text-xs font-black uppercase tracking-widest text-slate-950"
                          >
                            Edit
                          </button>
                        )}

                        <p className="mb-2 text-xs uppercase tracking-widest text-slate-400">
                          Your prediction
                        </p>

                        <input
                          value={predictionValue}
                          disabled={predictionInputLocked}
                          onChange={(event) => {
                            const formatted = formatScoreInput(event.target.value);

                            setPredictions((prev) => ({
                              ...prev,
                              [fixtureId]: formatted,
                            }));
                          }}
                          placeholder={isLoggedIn ? "2-1" : "Login"}
                          inputMode="numeric"
                          maxLength={5}
                          className="min-h-12 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-center text-2xl font-black outline-none disabled:cursor-not-allowed disabled:opacity-60 md:w-32"
                        />

                        <button
                          onClick={() => savePrediction(fixture)}
                          disabled={
                            !isLoggedIn ||
                            predictionsLocked ||
                            saving[fixtureId] ||
                            (hasPrediction && !isEditing)
                          }
                          className="mt-3 min-h-12 w-full rounded-xl bg-amber-300 px-4 py-3 font-black text-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {!isLoggedIn
                            ? "Login"
                            : predictionsLocked
                            ? "Locked"
                            : saving[fixtureId]
                            ? "Saving..."
                            : hasPrediction && !isEditing
                            ? "Saved"
                            : hasPrediction && isEditing
                            ? "Update"
                            : "Save"}
                        </button>

                        {savedStatus[fixtureId] && (
                          <p className="mt-3 rounded-xl bg-emerald-500/10 px-3 py-2 text-sm font-bold text-emerald-200">
                            {savedStatus[fixtureId]}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function normalizeRound(value) {
  const text = String(value || "").toLowerCase();

  if (text.includes("final") && !text.includes("quarter") && !text.includes("semi")) return "Final";
  if (text.includes("semi")) return "Semi-final";
  if (text.includes("quarter")) return "Quarter-final";
  if (text.includes("16") || text.includes("last")) return "Last 16";

  return "Knockout";
}

function sortFixtures(a, b) {
  const aDate = getKickoffDate(a);
  const bDate = getKickoffDate(b);

  if (aDate && bDate) return aDate.getTime() - bDate.getTime();
  return Number(a.id || 0) - Number(b.id || 0);
}

function formatScoreInput(value) {
  const digitsOnly = String(value || "")
    .replace(/[^\d]/g, "")
    .slice(0, 4);

  if (digitsOnly.length === 0) return "";
  if (digitsOnly.length === 1) return digitsOnly;
  if (digitsOnly.length === 2) return `${digitsOnly[0]}-${digitsOnly[1]}`;
  if (digitsOnly.length === 3) return `${digitsOnly.slice(0, 2)}-${digitsOnly[2]}`;

  return `${digitsOnly.slice(0, 2)}-${digitsOnly.slice(2)}`;
}

function isValidScore(value) {
  return /^\d{1,2}-\d{1,2}$/.test(String(value || "").trim());
}

function getCountdown(now, deadline) {
  const difference = deadline.getTime() - now.getTime();

  if (difference <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0 };

  const totalSeconds = Math.floor(difference / 1000);
  const days = Math.floor(totalSeconds / (60 * 60 * 24));
  const hours = Math.floor((totalSeconds / (60 * 60)) % 24);
  const minutes = Math.floor((totalSeconds / 60) % 60);
  const seconds = totalSeconds % 60;

  return { days, hours, minutes, seconds };
}

function getKickoffDate(fixture) {
  if (!fixture || !fixture.date || !fixture.kickoff) return null;

  try {
    const cleanDate = String(fixture.date).trim();
    const cleanKickoff = String(fixture.kickoff).trim();

    let day;
    let month;
    let year;

    if (cleanDate.includes("/")) {
      const parts = cleanDate.split("/");
      if (parts.length !== 3) return null;

      day = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10) - 1;
      year = parseInt(parts[2], 10);
    } else {
      const parsed = new Date(cleanDate);
      if (Number.isNaN(parsed.getTime())) return null;

      day = parsed.getDate();
      month = parsed.getMonth();
      year = parsed.getFullYear();
    }

    const [hours, minutes] = cleanKickoff.split(":").map(Number);
    if (Number.isNaN(hours)) return null;

    return new Date(year, month, day, hours || 0, minutes || 0, 0, 0);
  } catch {
    return null;
  }
}

function formatDate(value) {
  if (!value) return "TBC";

  try {
    const cleanValue = String(value).trim();

    if (cleanValue.includes("/")) {
      const parts = cleanValue.split("/");

      if (parts.length === 3) {
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const year = parseInt(parts[2], 10);

        const ukDate = new Date(year, month, day);

        return ukDate.toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        });
      }
    }

    const date = new Date(cleanValue);

    if (Number.isNaN(date.getTime())) return cleanValue;

    return date.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return String(value);
  }
}
