document.addEventListener("DOMContentLoaded", function () {
  const mapContainer = d3.select("#map-container");
  const graphsContainer = d3.select("#graphs-container");

  let rotationTimer;

  mapContainer.on("click", function () {
    // Move the map to the left when clicked
    mapContainer.transition().duration(50).style("margin-left", "0");
    // Expand the graphs container
    graphsContainer.transition().duration(500).style("width", "100%");

    //svg.attr("height", mapContainer.node().getBoundingClientRect().height);

    clearInterval(rotationTimer);
  });

  // Get the dimensions of the map container
  const mapWidth = mapContainer.node().getBoundingClientRect().width;
  const mapHeight = mapContainer.node().getBoundingClientRect().height;

  // Create an SVG container within the map-container div
  const svg = d3
    .select("#map-container")
    .append("svg")
    .attr("width", mapWidth)
    .attr("height", mapHeight);

  Promise.all([
    d3.json("Data/world_atlas_110m.json"),
    d3.json("Data/data.json"),
    d3.json("Data/country_codes.json"),
  ]).then(([worldData, athletData, countryCodes]) => {
    // Create map to handle country ids
    const map_country_id_name = new Map();
    countryCodes.forEach((country) => {
      map_country_id_name.set(country["country-code"], country["name"]);
    });

    // Create map to get amount of medals for each country
    const map_country_medals = new Map();
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

    const max_medals_weighted = Array.from(map_country_medals.values()).reduce(
      function (max, countryMedals) {
        let val = weight_medals(countryMedals);
        return val > max ? val : max;
      },
      0
    );

    const colorScale = d3
      .scaleLog()
      .domain([0.01, max_medals_weighted])
      .range(["#f7f7f7", "#ffd700"]);

    // Convert TopoJSON to GeoJSON
    const countries = topojson.feature(worldData, worldData.objects.countries);

    // Create a projection for the map
    const projection = d3
      .geoOrthographic()
      .fitSize([mapWidth, mapHeight], countries);

    // Create a path generator
    const path = d3.geoPath().projection(projection);

    // Draw the map
    const countriesPaths = svg
      .selectAll("path")
      .data(countries.features)
      .enter()
      .append("path")
      .attr("d", path)
      .attr("stroke", "#fff")
      .attr("fill", (d) => {
        let countryName = map_country_id_name.get(d.id);
        let medals = map_country_medals.get(countryName) || [0.01, 0.01, 0.01]; // Prevent a country from having no or zero values
        return colorScale(weight_medals(medals));
      })
      .on("mouseover", handleMouseOver)
      .on("mouseout", handleMouseOut)
      .on("click", handleClick);

    // Function to handle mouseover events
    function handleMouseOver() {
      let tempColor = this.getAttribute("fill");
      d3.select(this).attr("fill", "#3498db");
      d3.select(this).attr("tempColor", tempColor);
      // Pause the continuous rotation when the mouse enters the globe
      clearInterval(rotationTimer);
    }

    // Function to handle mouseout events
    function handleMouseOut() {
      let color = this.getAttribute("tempColor");
      d3.select(this).attr("fill", color);
      // Resume the continuous rotation when the mouse leaves the globe
      rotationTimer = setInterval(() => {
        const rotate = projection.rotate();
        rotate[0] += 0.1; // Adjust the rotation speed
        projection.rotate(rotate);
        countriesPaths.attr("d", path);
      }, 30); // Adjust the interval
    }

    function handleClick(d) {
      // Remove the "selected" class from previously selected countries
      countriesPaths.classed("selected-country", false);

      let countryName = map_country_id_name.get(d.id);

      d3.select(this).classed("selected-country", true);

      console.log(countryName);

      let country_information = d3
        .select("#country-overview")
        .html("Land: " + countryName);
      country_information.selectAll("*").remove();

      console.log(map_country_medals.get(countryName));
      countryMedals = map_country_medals.get(countryName) || [0, 0, 0]; // Prevent a country from having no data

      let ul = country_information.append("ul");
      ul.selectAll("li")
        .data(countryMedals)
        .enter()
        .append("li")
        .text(function (amount_medal, index) {
          if (index == 0) {
            return `🥇: ${amount_medal}`;
          } else if (index == 1) {
            return `🥈: ${amount_medal}`;
          } else if (index == 2) {
            return `🥉: ${amount_medal}`;
          }
        });

      // Calculate the maximum gold medals across all countries
      const maxGoldMedals = d3.max(
        Array.from(map_country_medals.values()).map(
          (countryMedals) => countryMedals[0]
        )
      );

      // Define a scale based on the maximum gold medals
      const yScale = d3
        .scaleLinear()
        .domain([0, maxGoldMedals])
        .range([200, 0]);

      // Create a bar chart
      const barWidth = 500 / 3; // Divide by the number of medal types
      const barSpacing = 10;

      const barChart = d3
        .select("#country-overview")
        .append("svg")
        .attr("width", "100%")
        .attr("height", 250); // Increased height to accommodate axes

      // Add y-axis
      const yAxis = d3.axisLeft(yScale);
      barChart
        .append("g")
        .attr("class", "y-axis") // Added class for styling
        .attr("transform", "translate(40,0)") // Adjust the position as needed
        .call(yAxis);

      // Add bars for gold, silver, and bronze
      const medalColors = ["#ffd700", "#c0c0c0", "#cd7f32"];
      const medalLabels = ["Gold", "Silver", "Bronze"];

      // Append bars with initial height
      barChart
        .selectAll("rect")
        .data(countryMedals)
        .enter()
        .append("rect")
        .attr("x", (d, i) => i * (barWidth + barSpacing) + 40) // Adjust the position to align with the y-axis
        .attr("y", 200) // Start the bars at the bottom
        .attr("width", barWidth)
        .attr("height", 0) // Start the bars with height 0
        .attr("fill", (d, i) => medalColors[i])
        .transition()
        .duration(800)
        .attr("y", (d) => yScale(d))
        .attr("height", (d) => 200 - yScale(d))
        .delay((d, i) => i * 100);

      // Get athletes data for the clicked country
      const countryAthletes = athletData.filter(
        (athlete) => athlete.Country === countryName
      );

      // Log the names of athletes for the selected country
      countryAthletes.forEach((athlete) => {
        console.log(athlete.Name);
      });

      clearInterval(rotationTimer);
    }

    // Enable dragging on the map
    svg.call(
      d3
        .drag()
        .subject(() => {
          const r = projection.rotate();
          return { x: r[0], y: -r[1] };
        })
        .on("drag", () => {
          const rotate = projection.rotate();
          projection.rotate([d3.event.x, -d3.event.y, rotate[2]]);
          countriesPaths.attr("d", path);
        })
    );

    // Start the continuous rotation
    rotationTimer = setInterval(() => {
      const rotate = projection.rotate();
      rotate[0] += 0.1; // Adjust the rotation speed
      projection.rotate(rotate);
      countriesPaths.attr("d", path);
    }, 30); // Adjust the interval
  });
});

function weight_medals(medals) {
  return medals[0] * 3 + medals[1] * 2 + medals[2] * 1;
}
