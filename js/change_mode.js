function toggleDarkMode() {
  const body = document.body;
  const toggleSwitch = document.getElementById("toggle");

  // Check the current state of the switch
  const isLightMode = !body.classList.contains("dark-mode");

  // If dark mode is active, set legend color to white, otherwise to black
  const legendColor = isLightMode ? "white" : "black";

  // Log the legendColor for debugging
  console.log("Legend Color:", legendColor);

  // Update the color of the legend
  d3.select("#legendLog").style("fill", legendColor);

  // Update the color of the legend
  d3.selectAll(".axis-label").style("fill", legendColor);

  // Toggle the dark mode class
  body.classList.toggle("dark-mode");

  // Store the state in localStorage
  localStorage.setItem("darkMode", toggleSwitch.checked);
}

document.addEventListener("DOMContentLoaded", function () {
  const body = document.body;
  const toggleSwitch = document.getElementById("toggle");

  // Check if there's a stored state in localStorage
  const storedDarkMode = localStorage.getItem("darkMode");

  if (storedDarkMode !== null) {
    // If there's a stored state, use it to set the dark mode
    body.classList.toggle("dark-mode", storedDarkMode === "true");
    // Update the switch state
    toggleSwitch.checked = storedDarkMode === "true";
  } else {
    // If no stored state, use the prefers-color-scheme as a default
    const isDarkMode =
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches;
    body.classList.toggle("dark-mode", isDarkMode);
    // Update the switch state
    toggleSwitch.checked = isDarkMode;
  }
});
