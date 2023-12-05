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
    d3.json("Data/countries-110m.json"),
    d3.json("Data/data.json")
  ]).then(([countriesData, athletData]) => {
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
    const countries = topojson.feature(countriesData, countriesData.objects.countries);

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
        let countryName = d.properties.name
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

      let countryName = d.properties.name;

      d3.select(this).classed("selected-country", true);

      let country_information = d3
        .select("#country-overview")
        .html("Land: " + countryName);
      country_information.selectAll("*").remove();

      countryMedals = map_country_medals.get(countryName) || [0, 0, 0]; // Prevent a country from having no data

      // Calculate the maximum gold medals across all countries
      const maxGoldMedals = d3.max(
        Array.from(map_country_medals.values()).map(
          (countryMedals) => countryMedals[0]
        )
      );

      // Calculate the maximum medals across all medaltypes for the selceted country
      const maxMedals = d3.max(countryMedals);

      // Define a scale based on the maximum gold medals
      const yScale = d3
        .scaleLinear()
        .domain([0, maxMedals > 0 ? maxMedals : 5])
        .range([200, 20]);

      // Create a bar chart
      const barWidth = 690 / 3; // needs adjustments!
      const barSpacing = 10;

      const barChart = d3
        .select("#country-overview")
        .append("svg")
        .attr("width", "100%")
        .attr("height", 250); 

      // Add y-axis
      const yAxis = d3.axisLeft(yScale);
      barChart
        .append("g")
        .attr("class", "y-axis") 
        .attr("transform", "translate(40,0)") 
        .call(yAxis);

      // Add bars for gold, silver, and bronze
      const medalColors = ["#ffd700", "#c0c0c0", "#cd7f32"];

      // Check if countryMedals array is not empty
      if (maxMedals > 0) {
        // Append bars with initial height
        barChart
          .selectAll("rect")
          .data(countryMedals)
          .enter()
          .append("rect")
          .attr("x", (d, i) => i * (barWidth + barSpacing) + 40)
          .attr("y", (d) => yScale(0))
          .attr("width", barWidth)
          .attr("height", 0)
          .attr("fill", (d, i) => medalColors[i])
          .transition()
          .duration(800)
          .attr("y", (d) => yScale(d))
          .attr("height", (d) => 200 - yScale(d))
          .delay((d, i) => i * 100);

        barChart
          .selectAll("text")
          .data(countryMedals)
          .text((d, i) => {
            if (i === 0) return `🥇: ${d}`;
            else if (i === 1) return `🥈: ${d}`;
            else if (i === 2) return `🥉: ${d}`;
          })
          .attr("x", (d, i) => i * (barWidth + barSpacing) + mapWidth / 4)

          .attr("y", (d) => yScale(d) - 190);
      }

      // Get athletes data for the clicked country
      const countryAthletes = athletData.filter(
        (athlete) => athlete.Country === countryName
      );

      // Count the number of medals for each athlete
      const medalCountByAthlete = {};
      countryAthletes.forEach((athlete) => {
        const count = medalCountByAthlete[athlete.Name] || 0;
        medalCountByAthlete[athlete.Name] = count + 1;
      });

      // Convert the data into an array of objects
      const medalData = Object.keys(medalCountByAthlete).map((athlete) => ({
        name: athlete,
        count: medalCountByAthlete[athlete],
      }));

      // Sort the data by medal count
      medalData.sort((a, b) => b.count - a.count);

      // Take only the top 10 athletes
      const top10MedalData = medalData.slice(0, 10);

      // Display horizontal bar plot
      const barPlotContainer = d3.select("#athlete-bar-plot");

      // Remove existing plot content
      barPlotContainer.selectAll("*").remove();

      // set the dimensions and margins of the graph
      var margin = { top: 10, right: 30, bottom: 20, left: 60 },
        width = 460 - margin.left - margin.right,
        height = 400 - margin.top - margin.bottom;

      // Set up the SVG container for the bar plot
      const svg = barPlotContainer
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")");
      // Add Y axis scale
      var y = d3
        .scaleBand()
        .range([0, height])
        .domain(top10MedalData.map((d) => d.name))
        .padding(0.1);

      // Add X axis
      var x = d3
        .scaleLinear()
        .domain([0, d3.max(top10MedalData, (d) => d.count)])
        .range([0, width]);
      svg
        .append("g")
        .attr("transform", "translate(0," + height + ")")
        .call(d3.axisBottom(x))
        .selectAll("text")
        .attr("transform", "translate(-10,0)rotate(-45)")
        .style("text-anchor", "end");

      // Create horizontal bars
      svg
        .selectAll(".athlete-bar")
        .data(top10MedalData)
        .enter()
        .append("rect")
        .attr("class", "athlete-bar")
        .attr("x", 0)
        .attr("y", (d) => y(d.name))
        .attr("width", 0) 
        .attr("height", y.bandwidth())
        .attr("fill", "#3498db")
        .transition()
        .duration(800)
        .attr("width", (d) => x(d.count))
        .delay((d, i) => i * 100);

      // Add labels for athlete names
      svg
        .selectAll(".athlete-label")
        .data(top10MedalData)
        .enter()
        .append("text")
        .attr("class", "athlete-label")
        .attr("x", 5)
        .attr("y", (d) => y(d.name) + y.bandwidth() / 2)
        .text((d) => `${d.name} - ${d.count} medals`)
        .attr("alignment-baseline", "middle")
        .attr("fill", "#fff");

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
