const swissFormat = {
  decimal: ".",
  thousands: "'",
  grouping: [3],
  currency: ["", " CHF"],
};

const locale = d3.formatLocale(swissFormat);
const format = locale.format(",");

// set the dimensions and margins of the graph
const margin = { top: 30, right: 30, bottom: 70, left: 120 },
  width = 650 - margin.right,
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
let map_country_medals;

// Function to process the data and aggregate medal counts by country
function processMedalData(athletData) {
  const map_country_medals = new Map();

  athletData.forEach((athlete) => {
    const country = athlete.Country;
    const medal = athlete.Medal;

    // Initialize medal counts for the country if not present
    if (!map_country_medals.has(country)) {
      map_country_medals.set(country, { Gold: 0, Silver: 0, Bronze: 0 });
    }

    // Update the corresponding medal count
    map_country_medals.get(country)[medal]++;
  });

  return map_country_medals;
}

// Function to get the top countries
function getTopCountries(map_country_medals, sortingCriteria) {
  const sortingFunction = (a, b) => {
    const medalsA = map_country_medals.get(a);
    const medalsB = map_country_medals.get(b);

    switch (sortingCriteria) {
      case "total":
        return (
          medalsB.Gold +
          medalsB.Silver +
          medalsB.Bronze -
          (medalsA.Gold + medalsA.Silver + medalsA.Bronze)
        );
      case "gold":
        return medalsB.Gold - medalsA.Gold;
      case "silver":
        return medalsB.Silver - medalsA.Silver;
      case "bronze":
        return medalsB.Bronze - medalsA.Bronze;
      default:
        return (
          medalsB.Gold +
          medalsB.Silver +
          medalsB.Bronze -
          (medalsA.Gold + medalsA.Silver + medalsA.Bronze)
        );
    }
  };

  return Array.from(map_country_medals.keys())
    .sort(sortingFunction)
    .slice(0, 10);
}

// Function to update the chart based on the selected option
function updateChart() {
  // Check if the map_country_medals variable is defined and contains data
  if (!map_country_medals) {
    console.error("Data not loaded or processed correctly.");
    return;
  }

  // Get the selected option from the dropdown
  const selectedOption = document.getElementById("dropdown-menu").value;
  console.log("selectedOption:", selectedOption);

  // Get the top countries based on the selected sorting criteria
  const countries = getTopCountries(map_country_medals, selectedOption);

  // Sort the countries array based on the selected sorting criteria
  countries.sort((a, b) => {
    const medalsA = map_country_medals.get(a);
    const medalsB = map_country_medals.get(b);

    switch (selectedOption) {
      case "total":
        return getTotalMedals(medalsB) - getTotalMedals(medalsA);
      case "gold":
        return medalsB.Gold - medalsA.Gold;
      case "silver":
        return medalsB.Silver - medalsA.Silver;
      case "bronze":
        return medalsB.Bronze - medalsA.Bronze;
      default:
        return getTotalMedals(medalsB) - getTotalMedals(medalsA);
    }
  });
  // Check if the countries array is being populated correctly
  console.log("Top countries:", countries);

  // Update the y-axis scale
  const y = d3.scaleBand().domain(countries).range([0, height]).padding(0.2);
  svg.selectAll(".y-axis").remove();
  svg.append("g").attr("class", "y-axis").call(d3.axisLeft(y));

  svg
    .append("text")
    .attr("text-anchor", "middle")
    .attr("transform", "rotate(-90)")
    .attr("y", -margin.left + 10)
    .attr("x", -height / 2)
    .attr("class", "axis-label")
    .style("fill", updateColors())
    .text("Land");

  svg
    .append("text")
    .attr("text-anchor", "middle")
    .attr("x", width / 2)
    .attr("y", height + margin.bottom - 10)
    .attr("class", "axis-label")
    .style("fill", updateColors())
    .text("Anzahl");

  // Define the x-axis scale (only once)
  const x = d3
    .scaleLinear()
    .domain([
      0,
      d3.max(countries, (country) =>
        getTotalMedals(map_country_medals.get(country))
      ),
    ])
    .range([0, width]);

  // Update the x-axis scale domain based on the new data
  x.domain([
    0,
    d3.max(countries, (country) =>
      getTotalMedals(map_country_medals.get(country))
    ) + 500,
  ]);

  svg.selectAll(".x-axis").remove();
  svg
    .append("g")
    .attr("class", "x-axis")
    .attr("transform", `translate(0, ${height})`)
    .call(d3.axisBottom(x).tickFormat(format));

  svg.selectAll("rect").remove();

  // Bars
  svg
    .selectAll("rect")
    .data(countries)
    .join(
      (enter) =>
        enter
          .append("rect")
          .attr("x", 0)
          .attr("y", (country) => y(country))
          .attr("width", 0)
          .attr("height", y.bandwidth())
          .attr("fill", (country) => getMedalColor(country)),
      (update) => update,
      (exit) => exit.transition().duration(500).attr("width", 0).remove()
    )

    .transition()
    .duration(500)
    .attr("x", 0)
    .attr("y", (country) => y(country))
    .attr("width", (country) =>
      x(getTotalMedals(map_country_medals.get(country)))
    )
    .attr("height", y.bandwidth());

  // Function to get the color based on the medal type
  function getMedalColor(country) {
    const medals = map_country_medals.get(country);
    const totalMedals = getTotalMedals(medals);

    // Use color scale based on total medals
    const colorScale = d3
      .scaleLinear()
      .domain([
        0,
        d3.max(countries, (country) =>
          getTotalMedals(map_country_medals.get(country))
        ),
      ])
      .range(["#b3e2cd", "#006d2c"]);

    return colorScale(totalMedals);
  }
}

// Function to get the total medals for a country
function getTotalMedals(medals) {
  return medals.Gold + medals.Silver + medals.Bronze;
}

// Dropdown menu
const dropdown = d3.select("#dropdown-menu").on("input", function () {
  console.log("Dropdown value changed:", this.value);
  updateChart();
});

dropdown
  .selectAll("option")
  .data(["total", "gold", "silver", "bronze"])
  .enter()
  .append("option")
  .text((d) => d)
  .attr("value", (d) => d);

// Load data and process it
d3.json("Data/data.json").then(function (athletData) {
  map_country_medals = processMedalData(athletData);

  // Initialize the chart with the top countries
  updateChart();
});
