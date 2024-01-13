// Funktion zum Umschalten zwischen Dunkel- und Hellmodus
function toggleDarkMode() {
  const body = document.body;

  // Überprüfe, ob der Dunkelmodus aktiv ist
  const isLightMode = body.classList.contains("dark-mode");

  // If dark mode is active, set legend color to white, otherwise to black
  const legendColor = isLightMode ? "black" : "white";

  // Update the color of the legend
  d3.select("#legendLog").style("fill", legendColor);

  // Wenn ja, deaktiviere den Dunkelmodus, sonst aktiviere ihn
  if (isLightMode) {
    body.classList.remove("dark-mode");
  } else {
    body.classList.add("dark-mode");
  }
}

// Optional: Überprüfe beim Laden der Seite den Modus und setze ihn entsprechend
document.addEventListener("DOMContentLoaded", function () {
  const body = document.body;
  const isLightMode =
    window.matchMedia &&
    window.matchMedia("(prefers-color-scheme: dark)").matches;

  if (isLightMode) {
    body.classList.add("dark-mode");
  }
});
