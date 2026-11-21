/* Page d'accueil : liste des 20 auteurs, filtre, progression. */
(function () {
  "use strict";
  var P = window.Podcasts;

  function carteAuteur(a) {
    var done = P.countDone(a.id, a.seances);
    var pct = Math.round((done / a.seances.length) * 100);
    var li = document.createElement("li");
    li.innerHTML =
      '<a class="author-card" href="parcours.html?auteur=' + encodeURIComponent(a.id) + '">' +
      '  <div class="who">' +
      '    <span class="letter" aria-hidden="true">' + P.esc(a.nom.charAt(0)) + "</span>" +
      "    <div>" +
      "      <h2>" + P.esc(a.nom) + "</h2>" +
      '      <p class="dates">' + P.esc(a.dates) + " · " + P.esc(a.epoque) + "</p>" +
      "    </div>" +
      "  </div>" +
      '  <p class="accroche">' + P.esc(a.accroche) + "</p>" +
      '  <div class="progress-line">' +
      '    <div class="progress-track"><div class="progress-fill" style="width:' + pct + '%"></div></div>' +
      "    <span>" + done + "/" + a.seances.length + " écoutées</span>" +
      "  </div>" +
      "</a>";
    li.dataset.nom = (a.nom + " " + a.epoque + " " + a.accroche).toLowerCase();
    return li;
  }

  P.loadData().then(function (data) {
    document.title = data.site.titre + " — 20 auteurs, 200 séances";
    var h = document.querySelector(".hero h1");
    if (h) h.textContent = data.site.titre;
    var t = document.querySelector(".tagline");
    if (t) t.textContent = data.site.sous_titre;
    var total = data.auteurs.reduce(function (acc, a) { return acc + a.seances.length; }, 0);
    var meta = document.querySelector(".hero-meta");
    if (meta) {
      meta.textContent = data.auteurs.length + " auteurs · " + total + " séances · 25 min par séance";
    }

    var ul = document.getElementById("liste-auteurs");
    data.auteurs.forEach(function (a) { ul.appendChild(carteAuteur(a)); });

    var filtre = document.getElementById("filtre");
    var vide = document.getElementById("vide");
    filtre.addEventListener("input", function () {
      var q = filtre.value.trim().toLowerCase();
      var n = 0;
      Array.prototype.forEach.call(ul.children, function (li) {
        var show = !q || li.dataset.nom.indexOf(q) !== -1;
        li.style.display = show ? "" : "none";
        if (show) n++;
      });
      vide.hidden = n !== 0;
    });
  }).catch(function (err) {
    var main = document.querySelector("main");
    var div = document.createElement("p");
    div.className = "erreur";
    div.textContent = "Impossible de charger les données : " + err.message;
    main.appendChild(div);
  });
})();
