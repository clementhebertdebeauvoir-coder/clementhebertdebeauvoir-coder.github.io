/* Page parcours : un auteur, ses 10 séances, lecteur + fiches dépliables. */
(function () {
  "use strict";
  var P = window.Podcasts;

  function getAuteurId() {
    var p = new URLSearchParams(window.location.search).get("auteur");
    return p || "kant";
  }

  function badgeFor(a, s) {
    var prog = P.getProgress(a.id, s.n);
    if (prog.done) return '<span class="badge ok">✓ écoutée</span>';
    if (prog.pos > 5) return '<span class="badge encours">en cours · ' + P.fmt(prog.pos) + "</span>";
    return '<span class="badge">à écouter</span>';
  }

  function ligneSeance(a, s) {
    var li = document.createElement("li");
    li.className = "seance";
    li.id = "seance-" + s.n;
    li.innerHTML =
      '<div class="seance-top">' +
      '  <span class="seance-num" aria-hidden="true">' + s.n + "</span>" +
      '  <div class="seance-body">' +
      "    <h2>" + P.esc(s.titre) + "</h2>" +
      '    <p class="resume">' + P.esc(s.resume) + "</p>" +
      '    <div class="seance-actions">' +
      '      <button class="btn-play" data-play="' + s.n + '">▶ Écouter</button>' +
      '      <span class="duree">25 min</span>' +
      "      <span class=\"badge-slot\">" + badgeFor(a, s) + "</span>" +
      "    </div>" +
      '    <details class="fiche-details">' +
      '      <summary>Lire la fiche de la séance</summary>' +
      '      <div class="fiche-contenu">Chargement…</div>' +
      "    </details>" +
      "  </div>" +
      "</div>";

    li.querySelector("[data-play]").addEventListener("click", function () {
      P.play(a, s);
    });

    var det = li.querySelector(".fiche-details");
    det.addEventListener("toggle", function () {
      if (!det.open) return;
      var box = det.querySelector(".fiche-contenu");
      if (box.dataset.loaded) return;
      P.loadFiche(a.id, s.n).then(function (md) {
        box.innerHTML = P.renderMarkdown(md);
        box.dataset.loaded = "1";
      }).catch(function () {
        box.textContent = "Fiche pas encore générée — lancer tools/generate_fiches.py (voir README).";
        box.dataset.loaded = "1";
      });
    });
    return li;
  }

  function refreshBadges(a) {
    a.seances.forEach(function (s) {
      var li = document.getElementById("seance-" + s.n);
      if (!li) return;
      li.querySelector(".badge-slot").innerHTML = badgeFor(a, s);
      var playing = P.state.auteur && P.state.seance &&
        P.state.auteur.id === a.id && P.state.seance.n === s.n &&
        P.state.audio && !P.state.audio.paused;
      li.classList.toggle("en-cours", !!playing);
      var btn = li.querySelector("[data-play]");
      btn.textContent = playing ? "❚❚ En lecture" : (P.getProgress(a.id, s.n).pos > 5 && !P.getProgress(a.id, s.n).done ? "▶ Reprendre" : "▶ Écouter");
    });
  }

  P.loadData().then(function (data) {
    var a = P.findAuteur(getAuteurId());
    if (!a) {
      document.querySelector("main").innerHTML =
        '<p class="erreur">Auteur inconnu. <a href="index.html">Retour à la liste des auteurs</a>.</p>';
      return;
    }
    document.title = a.nom + " — " + data.site.titre;

    var head = document.getElementById("parcours-head");
    var done = P.countDone(a.id, a.seances);
    head.innerHTML =
      '<a class="back" href="index.html">← Tous les auteurs</a>' +
      "<h1>" + P.esc(a.nom) + "</h1>" +
      '<p class="dates">' + P.esc(a.dates) + " · " + P.esc(a.epoque) + "</p>" +
      '<p class="accroche">' + P.esc(a.accroche) + "</p>" +
      '<p class="hero-meta">' + done + "/10 séances écoutées · 10 × 25 min</p>";

    var ul = document.getElementById("liste-seances");
    a.seances.forEach(function (s) { ul.appendChild(ligneSeance(a, s)); });

    document.addEventListener("podcast:play", function () { refreshBadges(a); });
    setInterval(function () { refreshBadges(a); }, 3000);
  }).catch(function (err) {
    document.querySelector("main").innerHTML =
      '<p class="erreur">Impossible de charger les données : ' + P.esc(err.message) + "</p>";
  });
})();
