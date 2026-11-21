/* Philosopher en podcasts — module partagé : données, progression, lecteur.
   Aucune dépendance externe. */
(function () {
  "use strict";

  var DATA_URL = "data/auteurs.json";
  var MANIFEST_URL = "data/audio.json";
  var LS_KEY = "philo-progress-v1";
  var manifest = null;

  var state = {
    data: null,
    auteur: null,
    seance: null,
    audio: null,
    bar: null,
    lastSave: 0
  };

  function pad2(n) { return String(n).padStart(2, "0"); }
  function audioUrl(id, n) { return "audio/" + id + "/" + pad2(n) + ".mp3"; }
  function ficheUrl(id, n) { return "fiches/" + id + "/" + pad2(n) + ".md"; }
  function skey(id, n) { return id + "/" + pad2(n); }

  function fmt(t) {
    t = Math.max(0, Math.floor(t || 0));
    var m = Math.floor(t / 60), s = t % 60;
    return m + ":" + String(s).padStart(2, "0");
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function loadProgress() {
    try { return JSON.parse(localStorage.getItem(LS_KEY) || "{}"); } catch (e) { return {}; }
  }
  function saveProgress(p) {
    try { localStorage.setItem(LS_KEY, JSON.stringify(p)); } catch (e) { /* stockage indisponible */ }
  }
  function getProgress(id, n) {
    var p = loadProgress()[skey(id, n)];
    return p || { pos: 0, done: false };
  }
  function setProgress(id, n, upd) {
    var all = loadProgress();
    all[skey(id, n)] = Object.assign({}, all[skey(id, n)] || { pos: 0, done: false }, upd);
    saveProgress(all);
  }
  function countDone(auteurId, seances) {
    var all = loadProgress(), c = 0;
    seances.forEach(function (s) { if (all[skey(auteurId, s.n)] && all[skey(auteurId, s.n)].done) c++; });
    return c;
  }

  function loadData() {
    if (state.data) return Promise.resolve(state.data);
    return fetch(DATA_URL).then(function (r) {
      if (!r.ok) throw new Error("Impossible de charger " + DATA_URL);
      return r.json();
    }).then(function (d) { state.data = d; return d; });
  }

  function findAuteur(id) {
    return (state.data.auteurs || []).find(function (a) { return a.id === id; }) || null;
  }

  function loadManifest() {
    if (manifest) return Promise.resolve(manifest);
    return fetch(MANIFEST_URL)
      .then(function (r) { return r.ok ? r.json() : { episodes: [] }; })
      .catch(function () { return { episodes: [] }; })
      .then(function (m) { manifest = m; return m; });
  }

  function hasAudio(id, n) {
    if (!manifest) return true;
    return (manifest.episodes || []).indexOf(id + "/" + pad2(n)) !== -1;
  }

  /* ---------- Lecteur fixe ---------- */

  function buildBar(root) {
    var bar = document.createElement("div");
    bar.className = "player-bar";
    bar.id = "player-bar";
    bar.innerHTML =
      '<div class="player-inner">' +
      '  <div class="player-row">' +
      '    <button class="player-btn ghost" id="pb-prev" title="Séance précédente">&#9198;</button>' +
      '    <button class="player-btn" id="pb-play" title="Lecture / pause">&#9654;</button>' +
      '    <button class="player-btn ghost" id="pb-next" title="Séance suivante">&#9197;</button>' +
      '    <div class="player-title"><div class="t" id="pb-titre"></div><div class="s" id="pb-sous"></div></div>' +
      '    <span class="player-time" id="pb-time">0:00 / 0:00</span>' +
      '  </div>' +
      '  <input type="range" class="player-seek" id="pb-seek" min="0" max="1000" value="0" aria-label="Progression">' +
      '  <div class="player-row player-controls">' +
      '    <label style="font-size:0.78rem;opacity:0.8">Vitesse ' +
      '      <select id="pb-speed">' +
      '        <option value="0.75">0,75×</option>' +
      '        <option value="1" selected>1×</option>' +
      '        <option value="1.25">1,25×</option>' +
      '        <option value="1.5">1,5×</option>' +
      '        <option value="1.75">1,75×</option>' +
      '        <option value="2">2×</option>' +
      '      </select>' +
      '    </label>' +
      '    <label style="font-size:0.78rem;opacity:0.8">Volume <input type="range" id="pb-vol" min="0" max="1" step="0.05" value="1" aria-label="Volume"></label>' +
      '    <span style="flex:1"></span>' +
      '    <span class="player-notice" id="pb-notice" hidden></span>' +
      '  </div>' +
      "</div>";
    root.appendChild(bar);
    state.bar = bar;
    state.audio = new Audio();
    state.audio.preload = "metadata";

    bar.querySelector("#pb-play").addEventListener("click", togglePlay);
    bar.querySelector("#pb-prev").addEventListener("click", function () { step(-1); });
    bar.querySelector("#pb-next").addEventListener("click", function () { step(1); });
    bar.querySelector("#pb-speed").addEventListener("change", function (e) {
      state.audio.playbackRate = parseFloat(e.target.value);
    });
    bar.querySelector("#pb-vol").addEventListener("input", function (e) {
      state.audio.volume = parseFloat(e.target.value);
    });
    var seek = bar.querySelector("#pb-seek");
    seek.addEventListener("input", function () {
      if (state.audio.duration) {
        state.audio.currentTime = (seek.value / 1000) * state.audio.duration;
      }
    });

    state.audio.addEventListener("timeupdate", onTime);
    state.audio.addEventListener("loadedmetadata", onMeta);
    state.audio.addEventListener("ended", onEnded);
    state.audio.addEventListener("error", onError);
    state.audio.addEventListener("play", function () { setPlayIcon(true); });
    state.audio.addEventListener("pause", function () { setPlayIcon(false); });

    document.body.classList.add("has-player");
    return bar;
  }

  function setPlayIcon(playing) {
    var b = state.bar.querySelector("#pb-play");
    if (b) b.innerHTML = playing ? "&#10074;&#10074;" : "&#9654;";
  }

  function notice(msg) {
    var n = state.bar.querySelector("#pb-notice");
    if (!n) return;
    if (msg) { n.textContent = msg; n.hidden = false; }
    else { n.hidden = true; }
  }

  function togglePlay() {
    if (!state.seance) return;
    if (state.audio.paused) { state.audio.play().catch(function () {}); }
    else { state.audio.pause(); }
  }

  function onMeta() {
    var d = state.audio.duration || 0;
    var s = state.seance ? state.seance.duree_sec : 0;
    state.bar.querySelector("#pb-time").textContent = fmt(state.audio.currentTime) + " / " + fmt(d || s);
  }

  function onTime() {
    var d = state.audio.duration || (state.seance ? state.seance.duree_sec : 0);
    var seek = state.bar.querySelector("#pb-seek");
    seek.value = d ? Math.round((state.audio.currentTime / d) * 1000) : 0;
    state.bar.querySelector("#pb-time").textContent = fmt(state.audio.currentTime) + " / " + fmt(d);
    var now = Date.now();
    if (state.auteur && state.seance && now - state.lastSave > 5000) {
      state.lastSave = now;
      setProgress(state.auteur.id, state.seance.n, { pos: state.audio.currentTime });
    }
  }

  function onEnded() {
    if (state.auteur && state.seance) {
      setProgress(state.auteur.id, state.seance.n, { pos: 0, done: true });
    }
    step(1, true);
  }

  function onError() {
    if (!state.auteur || !state.seance) return;
    notice("Audio pas encore généré — voir podcasts/README.md (tools/generate_audio.py)");
  }

  function step(delta, auto) {
    if (!state.auteur || !state.seance) return;
    var list = state.auteur.seances;
    var i = list.findIndex(function (s) { return s.n === state.seance.n; });
    var j = i + delta;
    if (j < 0 || j >= list.length) {
      if (auto) notice("Fin du parcours de " + state.auteur.nom + ".");
      return;
    }
    play(state.auteur, list[j], { autoplay: true });
  }

  function play(auteur, seance, opts) {
    opts = opts || {};
    state.auteur = auteur;
    state.seance = seance;
    if (!state.bar) buildBar(document.body);
    state.bar.classList.add("visible");
    notice(null);
    state.bar.querySelector("#pb-titre").textContent =
      "Séance " + seance.n + " — " + seance.titre;
    state.bar.querySelector("#pb-sous").textContent = auteur.nom + " · " + auteur.dates;
    if (!hasAudio(auteur.id, seance.n)) {
      notice("Pas d'épisode audio pour cette séance — générez-le avec tools/generate_audio.py "
        + "(clé MISTRAL_API_KEY requise, voir podcasts/README.md)");
      return;
    }
    var prog = getProgress(auteur.id, seance.n);
    state.audio.src = audioUrl(auteur.id, seance.n);
    state.audio.playbackRate = parseFloat(state.bar.querySelector("#pb-speed").value) || 1;
    if (!prog.done && prog.pos > 5) {
      state.audio.addEventListener("loadedmetadata", function once() {
        state.audio.removeEventListener("loadedmetadata", once);
        state.audio.currentTime = Math.min(prog.pos, state.audio.duration || prog.pos);
      });
    }
    if (opts.autoplay !== false) {
      state.audio.play().catch(function () { /* lecture bloquée par le navigateur */ });
    }
    document.dispatchEvent(new CustomEvent("podcast:play", {
      detail: { auteur: auteur, seance: seance }
    }));
  }

  function pause() {
    if (state.audio) state.audio.pause();
  }

  /* ---------- Mini rendu Markdown (fiches) ---------- */

  function renderMarkdown(md) {
    var lines = md.split(/\r?\n/);
    var html = "", inP = false;
    function closeP() { if (inP) { html += "</p>"; inP = false; } }
    function inline(t) {
      return esc(t)
        .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
        .replace(/\*([^*]+)\*/g, "<em>$1</em>");
    }
    lines.forEach(function (line) {
      var m;
      if ((m = line.match(/^(#{1,3})\s+(.*)$/))) {
        closeP();
        var lvl = m[1].length + 1 > 3 ? 3 : m[1].length + 1;
        html += "<h" + lvl + ">" + inline(m[2]) + "</h" + lvl + ">";
      } else if (/^\s*$/.test(line)) {
        closeP();
      } else {
        if (!inP) { html += "<p>"; inP = true; }
        else { html += "<br>"; }
        html += inline(line.trim());
      }
    });
    closeP();
    return html;
  }

  function loadFiche(auteurId, n) {
    return fetch(ficheUrl(auteurId, n)).then(function (r) {
      if (!r.ok) throw new Error("fiche introuvable");
      return r.text();
    });
  }

  window.Podcasts = {
    loadData: loadData,
    loadManifest: loadManifest,
    hasAudio: hasAudio,
    findAuteur: findAuteur,
    audioUrl: audioUrl,
    ficheUrl: ficheUrl,
    pad2: pad2,
    fmt: fmt,
    esc: esc,
    getProgress: getProgress,
    setProgress: setProgress,
    countDone: countDone,
    buildBar: buildBar,
    play: play,
    pause: pause,
    renderMarkdown: renderMarkdown,
    loadFiche: loadFiche,
    state: state
  };
})();
