// set the dimensions and margins of the graph
const margin = { top: 30, right: 30, bottom: 70, left: 120 },
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
let map_country_medals;

// Function to get the top countries
function getTopCountries(map_country_medals, sortingCriteria) {
  const sortingFunction = (a, b) => {
    const medalsA = map_country_medals.get(a);
    const medalsB = map_country_medals.get(b);

    switch (sortingCriteria) {
      case "total":
        return getTotalMedals(medalsB) - getTotalMedals(medalsA);
      case "gold":
        return medalsB[0] - medalsA[0];
      case "silver":
        return medalsB[1] - medalsA[1];
      case "bronze":
        return medalsB[2] - medalsA[2];
      default:
        return getTotalMedals(medalsB) - getTotalMedals(medalsA);
    }
  };

  return Array.from(map_country_medals.keys())
    .sort(sortingFunction)
    .slice(0, 10);
}

// Function to update the chart based on the selected option
function updateChart() {
  const selectedOption = document.getElementById("dropdown-menu").value;

  const countries = getTopCountries(map_country_medals, selectedOption);

  const y = d3.scaleBand().domain(countries).range([0, height]).padding(0.2);
  svg.selectAll(".y-axis").remove();
  svg.append("g").attr("class", "y-axis").call(d3.axisLeft(y));

  svg.append("text")
   .attr("text-anchor", "end")
   .attr("transform", "rotate(-90)")
   .attr("y", -margin.left + 10)
   .attr("x", -height / 2)
   .style("fill", "white") 
   .text("Land");

  svg.append("text")
   .attr("text-anchor", "end")
   .attr("x", width / 2)
   .attr("y", height + margin.bottom - 10)
   .style("fill", "white") 
   .text("Anzahl");

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
          .attr("x", (country) => 0)
          .attr("y", (country) => y(country))
          .attr("width", 0)
          .attr("height", y.bandwidth())
          .attr("fill", (country) =>
            getMedalColor(getMedalType(map_country_medals.get(country)))
          ),
      (update) => update,
      (exit) => exit.transition().duration(500).attr("width", 0).remove()
    )
    .on("mouseover", function (event, country) {
      const totalMedals = getTotalMedals(map_country_medals.get(country));
      const tooltipText = `${country}: ${totalMedals} medals`;
      tooltip.transition().duration(200).style("opacity", 0.9);
      tooltip
        .html(tooltipText)
        .style("left", event.pageX + "px")
        .style("top", event.pageY - 28 + "px");
    })
    .on("mouseout", function () {
      tooltip.transition().duration(500).style("opacity", 0);
    })
    .transition()
    .duration(500)
    .attr("x", 0)
    .attr("y", (country) => y(country))
    .attr("width", (country) =>
      x(getTotalMedals(map_country_medals.get(country)))
    )
    .attr("height", y.bandwidth());
  // Function to get the type of medal (Gold, Silver, Bronze)
  function getMedalType(medals) {
    if (medals[0] > 0) {
      return "Gold";
    } else if (medals[1] > 0) {
      return "Silver";
    } else if (medals[2] > 0) {
      return "Bronze";
    } else {
      return "None";
    }
  }

  // Function to get the color based on the medal type
  function getMedalColor(medalType) {
    switch (medalType) {
      case "Gold":
        return "gold";
      case "Silver":
        return "silver";
      case "Bronze":
        return "brown"; // Change this to the color you prefer for bronze
      default:
        return "#69b3a2"; // Default color for other cases
    }
  }
}

// Function to get the sorting criteria based on the selected option
function getSortingCriteria(selectedOption) {
  switch (selectedOption) {
    case "Top Total":
      return "total";
    case "Top Gold":
      return "gold";
    case "Top Silver":
      return "silver";
    case "Top Bronze":
      return "bronze";
    default:
      return "total";
  }
}

// Function to get countries sorted by the specified criteria
function getCountriesSortedBy(map_country_medals, sortingCriteria) {
  const sortingFunction = (a, b) => {
    const medalsA = map_country_medals.get(a);
    const medalsB = map_country_medals.get(b);

    switch (sortingCriteria) {
      case "total":
        return getTotalMedals(medalsB) - getTotalMedals(medalsA);
      case "gold":
        return medalsB[0] - medalsA[0];
      case "silver":
        return medalsB[1] - medalsA[1];
      case "bronze":
        return medalsB[2] - medalsA[2];
      default:
        return getTotalMedals(medalsB) - getTotalMedals(medalsA);
    }
  };

  return Array.from(map_country_medals.keys())
    .sort(sortingFunction)
    .slice(0, 10);
}

// Function to get color based on total medals
function getColor(totalMedals) {
  const colorScale = d3
    .scaleLinear()
    .domain([0, 6000])
    .range(["#b3e2cd", "#006d2c"]);
  return colorScale(totalMedals);
}

// Function to get the total medals for a country
function getTotalMedals(medals) {
  // Check if medals is defined
  if (medals) {
    return medals.reduce((acc, val) => acc + val, 0);
  } else {
    return 0; // Return 0 if medals is undefined
  }
}

// Dropdown menu
const dropdown = d3
  .select("#dropdown")
  .append("select")
  .attr("id", "dropdown-menu")
  .on("change", function () {
    updateChart();
  });

dropdown
  .selectAll("option")
  .data(["Top Total", "Top Gold", "Top Silver", "Top Bronze"])
  .enter()
  .append("option")
  .text((d) => d)
  .attr("value", (d) => d);

// Tooltip
const tooltip = d3
  .select("body")
  .append("div")
  .attr("class", "tooltip")
  .style("opacity", 0);

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
