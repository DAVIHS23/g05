// set the dimensions and margins of the graph
const margin = { top: 30, right: 30, bottom: 70, left: 60 },
  width = 460 - margin.right,
  height = 400 - margin.top - margin.bottom;

// append the svg object to the body of the page
const svg = d3
  .select("#total-medals-bar-plot")
  .append("svg")
  .attr("width", width + margin.left + margin.right)
  .attr("height", height + margin.top + margin.bottom)
  .append("g")
  .attr("transform", `translate(${margin.left},${margin.top})`);

// Variables to hold data and flag
let isTopCountries = true;
let map_country_medals;

// Function to get the top countries
function getTopCountries(map_country_medals) {
  const sortedCountries = Array.from(map_country_medals.keys()).sort(
    (a, b) =>
      getTotalMedals(map_country_medals.get(b)) -
      getTotalMedals(map_country_medals.get(a))
  );
  return sortedCountries.slice(0, 10);
}

// Function to get the bottom countries
function getBottomCountries(map_country_medals) {
  const sortedCountries = Array.from(map_country_medals.keys()).sort(
    (a, b) =>
      getTotalMedals(map_country_medals.get(a)) -
      getTotalMedals(map_country_medals.get(b))
  );
  return sortedCountries.slice(0, 10);
}

// Function to update the chart based on the selected option
function updateChart() {
  const selectedOption = document.getElementById("dropdown-menu").value;
  const countries =
    selectedOption === "Top"
      ? getTopCountries(map_country_medals)
      : getBottomCountries(map_country_medals);

  const y = d3.scaleBand().domain(countries).range([0, height]).padding(0.2);
  svg.selectAll(".y-axis").remove();
  svg.append("g").attr("class", "y-axis").call(d3.axisLeft(y));

  const x = d3.scaleLinear().domain([0, 6000]).range([0, width]);
  svg.selectAll(".x-axis").remove();
  svg
    .append("g")
    .attr("class", "x-axis")
    .attr("transform", `translate(0, ${height})`)
    .call(d3.axisBottom(x));

  svg.selectAll("rect").remove();

  // Bars
  svg
    .selectAll("rect")
    .data(countries)
    .join(
      (enter) =>
        enter
          .append("rect")
          .attr("y", (country) => y(country))
          .attr("x", 0)
          .attr("width", 0)
          .attr("height", y.bandwidth())
          .attr("fill", "#69b3a2"),
      (update) => update,
      (exit) => exit.transition().duration(500).attr("width", 0).remove()
    )
    .transition()
    .duration(500)
    .attr("y", (country) => y(country))
    .attr("x", 0)
    .attr("width", (country) =>
      x(getTotalMedals(map_country_medals.get(country)))
    )
    .attr("height", y.bandwidth());
}
// Function to get the total medals for a country
function getTotalMedals(medals) {
  return medals.reduce((acc, val) => acc + val, 0);
}

// Dropdown menu
const dropdown = d3
  .select("#dropdown")
  .append("select")
  .attr("id", "dropdown-menu")
  .on("change", function () {
    isTopCountries = this.value === "Top"; // Update the flag based on the selected option
    updateChart(); // Update the chart accordingly
  });

dropdown
  .selectAll("option")
  .data(["Top 10 Countries", "Bottom 10 Countries"])
  .enter()
  .append("option")
  .text((d) => d)
  .attr("value", (d) => (d.includes("Top") ? "Top" : "Bottom"));

d3.json("Data/data.json").then(function (athletData) {
  map_country_medals = new Map();
  athletData.forEach((athlet) => {
    let country = athlet.Country;
    let medal = athlet.Medal;
    let count_medals = map_country_medals.get(country) || [0, 0, 0];
    if (medal == "Gold") {
      count_medals[0] += 1;
    } else if (medal == "Silver") {
      count_medals[1] += 1;
    } else if (medal == "Bronze") {
      count_medals[2] += 1;
    }
    map_country_medals.set(country, count_medals);
  });

  // Initialize the chart with the top countries
  updateChart();
});
