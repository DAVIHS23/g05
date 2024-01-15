document.addEventListener("DOMContentLoaded", function () {
  const mapContainer = d3.select("#map-container");
  const graphsContainer = d3.select("#graphs-container");

  const swissFormat = {
    decimal: ".",
    thousands: "'",
    grouping: [3],
    currency: ["", " CHF"],
  };

  const locale = d3.formatLocale(swissFormat);
  const format = locale.format(",");

  let rotationTimer;
  let selectedCountry = null;
  let lastSelectedPath = null;

  let countriesLineChart = [];

  // Get the dimensions of the map container
  const mapWidth = mapContainer.node().getBoundingClientRect().width;
  const mapHeight = mapContainer.node().getBoundingClientRect().height;

  // Create an SVG container within the map-container div
  const svg = d3
    .select("#map-container")
    .append("svg")
    .attr("width", mapWidth)
    .attr("height", mapHeight)
    .on("click", handleClickOnContainer);

  function handleClickOnContainer() {
    const clickedPath = d3.event.target;
    const isCountryClick = clickedPath.tagName === "path";

    if (isCountryClick) {
      const countryName = d3.select(clickedPath).datum().properties.name;

      if (countryName === selectedCountry) {
        // Deselect the country and close the graphs container
        selectedCountry = null;
        mapContainer.transition().duration(50).style("margin-left", "0");
        graphsContainer.transition().duration(500).style("width", "0");
        d3.select(clickedPath).classed("selected-country", false);
        lastSelectedPath = null;
        countriesLineChart = [];
        resetDropDown();
      } else {
        // Deselect the last selected path if exists
        if (lastSelectedPath) {
          d3.select(lastSelectedPath).classed("selected-country", false);
        }

        // Select the new country and open the graphs container
        selectedCountry = countryName;
        mapContainer.transition().duration(50).style("margin-left", "0");
        graphsContainer.transition().duration(500).style("width", "100%");
        lastSelectedPath = clickedPath;
      }
    } else {
      // Clicked outside the world map, deselect the country and close the graphs container
      selectedCountry = null;
      countriesLineChart = [];
      resetDropDown();
      mapContainer.transition().duration(50).style("margin-left", "0");
      graphsContainer.transition().duration(500).style("width", "0");
      // Deselect the last selected path if exists
      if (lastSelectedPath) {
        d3.select(lastSelectedPath).classed("selected-country", false);
        lastSelectedPath = null;
      }
    }
  }

  Promise.all([
    d3.json("Data/countries-110m.json"),
    d3.json("Data/data.json"),
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
    createGenderPieChart(athletData);
    createTop10MedalsBarPlot(athletData);

    const map_country_rank = calcRanks(map_country_medals);

    const colorScale = d3
      .scaleLog()
      .domain([0.01, max_medals_weighted])
      .range(["#f7f7f7", "#ffd700"]);

    // Convert TopoJSON to GeoJSON
    const countries = topojson.feature(
      countriesData,
      countriesData.objects.countries
    );

    // Create a projection for the map
    const projection = d3
      .geoOrthographic()
      .fitSize([mapWidth, mapHeight], countries);

    // Create a path generator
    const path = d3.geoPath().projection(projection);

    svg
      .append("g")
      .attr("class", "legendLog")
      .attr("transform", `translate(0,${mapHeight * 0.93})`);

    let titleText = "Anzahl Medaillen";
    let subTitleText = "(gewichtet: 🥇=3, 🥈=2, 🥉=1)";
    //let subTitleText = "(gewichtet: Gold=3, Silver=2, Bronze=1)";

    svg
      .select(".legendLog")
      .append("text")
      .attr("x", 0)
      .attr("y", -30)
      .style("font-weight", "bold")
      .text(titleText);

    svg
      .select(".legendLog")
      .append("text")
      .attr("x", 0)
      .attr("y", -10)
      .text(subTitleText);

    let log_legend = d3
      .legendColor()
      .shapeHeight(20)
      .shapeWidth(50)
      .orient("horizontal")
      .cells([0.1, 10, 100, 1000, 10000])
      .labelFormat(locale.format(",.0f"))
      .scale(colorScale);

    svg
      .select(".legendLog")
      .attr("id", "legendLog")
      .style("fill", updateColors())
      .call(log_legend);

    // Draw the map
    const countriesPaths = svg
      .selectAll("path")
      .data(countries.features)
      .enter()
      .append("path")
      .attr("d", path)
      .attr("stroke", "#fff")
      .attr("fill", (d) => {
        let countryName = d.properties.name;
        let medals = map_country_medals.get(countryName) || [0.01, 0.01, 0.01]; // Prevent a country from having no or zero values
        return colorScale(weight_medals(medals));
      })
      .attr("countryName", (d) => {
        return d.properties.name;
      })
      .on("mouseover", handleMouseOver)
      .on("mouseout", handleMouseOut)
      .on("click", handleClick);

    // Function to handle mouseover events
    function handleMouseOver() {
      let tempColor = this.getAttribute("fill");
      d3.select(this).attr("fill", "#87ceeb");
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
      if (selectedCountry !== d.properties.name) {
        // Move the map to the left when clicked
        mapContainer.transition().duration(50).style("margin-left", "0");
        // Expand the graphs container
        graphsContainer.transition().duration(500).style("width", "100%");

        clearInterval(rotationTimer);

        // Remove the "selected" class from previously selected countries
        countriesPaths.classed("selected-country", false);

        let countryName = d.properties.name;

        d3.select(this).classed("selected-country", true);
        d3.select("#graphs-container")
          .selectAll("h4.country-specifics, .parting-line, #selectionButton")
          .style("display", "block");

        barChart = d3.select("#country-overview");
        barChart.selectAll("*").remove();

        barChart
          .append("h5")
          .html("Land: " + countryName)
          .append("h5")
          .html(`Rang: #${map_country_rank.get(countryName)}`);

        countryMedals = map_country_medals.get(countryName) || [0, 0, 0]; // Prevent a country from having no data

        // Calculate the maximum medals across all medaltypes for the selceted country
        const maxMedals = d3.max(countryMedals);

        // No medals won, return
        if (maxMedals < 1) {
          d3.select("#country-overview").selectAll("*").remove();
          d3.select("#athlete-bar-plot").selectAll("*").remove();
          d3.select("#country-line-plot").selectAll("*").remove();
          resetDropDown();

          d3.select("#country-overview").html(
            `<span>Für das Land ${countryName} sind keine Medaillen vorhanden.</span>`
          );
          d3.select("#graphs-container")
            .selectAll(".country-specifics, .parting-line, #selectionButton")
            .style("display", "none");

          countriesLineChart = [];

          return;
        }

        countriesLineChart[0] = countryName;

        countryNamesFiltered = Array.from(map_country_medals.keys())
          .filter((country) => country != countryName)
          .sort();

        d3.selectAll(".selectionButton").each(function (d, i) {
          let dropdown = d3.select(this);

          dropdown.on("change", function () {
            createLineChart(athletData, countriesLineChart);
          });

          if (dropdown.selectAll("option").size() < 1) {
            dropdown.append("option").text(`Vergleichsland`).attr("value", "");

            dropdown
              .selectAll(null)
              .data(countryNamesFiltered)
              .enter()
              .append("option")
              .text((d) => d)
              .attr("value", (d) => d);
          }
        });

        d3.selectAll(".selectionButton").style("visibility", "visible");

        var margin = { top: 10, right: 50, bottom: 60, left: 30 },
          width = 760 - margin.left - margin.right,
          height = 320 - margin.top - margin.bottom;

        // Define a scale based on the maximum gold medals
        const yScale = d3
          .scaleLinear()
          .domain([0, maxMedals > 0 ? Math.ceil(maxMedals / 10) * 10 : 5])
          .range([height, 0]);

        // Create a bar chart
        const barWidth = (width - 3 * 10) / 3;
        const barSpacing = 10;

        barChart = d3
          .select("#country-overview")
          .append("svg")
          .attr("width", width + margin.left + margin.right)
          .attr("height", height + margin.top + margin.bottom)
          .append("g")
          .attr(
            "transform",
            "translate(" + margin.left + "," + margin.top + ")"
          );

        // Add y-axis
        const yAxis = d3.axisLeft(yScale).tickFormat(format);
        barChart
          .append("g")
          .attr("class", "y-axis")
          .attr("transform", "translate(" + margin.left + ",0)")
          .call(yAxis);

        // Add bars for gold, silver, and bronze
        const medalColors = ["#ffd700", "#c0c0c0", "#cd7f32"];

        // Append bars with initial height
        barChart
          .selectAll(".country-overview-plot")
          .data(countryMedals)
          .enter()
          .append("rect")
          .attr("class", "country-overview-plot")
          .attr("x", (d, i) => margin.left + i * (barWidth + barSpacing))
          .attr("y", (d) => yScale(0))
          .attr("width", barWidth)
          .attr("height", 0)
          .attr("fill", (d, i) => medalColors[i])
          .transition()
          .duration(800)
          .attr("y", (d) => yScale(d))
          .attr("height", (d) => height - yScale(d))
          .delay((d, i) => i * 100);

        barChart
          .selectAll("rect")
          .on("mouseover", function (d, i) {
            let text = "";
            if (i == 0) {
              text = `${d} 🥇`;
            } else if (i == 1) {
              text = `${d} 🥈`;
            } else {
              text = `${d} 🥉`;
            }
            tooltip.html(`<div>${text}</div>`).style("visibility", "visible");
          })
          .on("mousemove", function () {
            tooltip
              .style("top", d3.event.pageY - 10 + "px")
              .style("left", d3.event.pageX + 10 + "px");
          })
          .on("mouseout", function () {
            tooltip.html("").style("visibility", "hidden");
          });

        let tooltip = d3
          .select("body")
          .append("div")
          .attr("class", "d3-tooltip")
          .style("position", "absolute")
          .style("z-index", "10")
          .style("visibility", "hidden")
          .style("padding", "10px")
          .style("background", "rgba(0,0,0,0.6)")
          .style("border-radius", "4px")
          .style("color", "#fff");

        barChart
          .append("text")
          .attr("transform", "rotate(-90)")
          .attr("y", -margin.left + 25)
          .attr("x", (-margin.top - height) / 2)
          .style("text-anchor", "middle")
          .attr("class", "axis-label")
          .style("fill", updateColors())
          .text("Anzahl");

        barChart
          .append("text")
          .attr("x", (width + margin.left) / 2)
          .attr("y", height + margin.top + 40)
          .style("text-anchor", "middle")
          .attr("class", "axis-label")
          .style("fill", updateColors())
          .text("Medaillentyp");

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
        var margin = { top: 10, right: 30, bottom: 60, left: 60 },
          width = 760 - margin.left - margin.right,
          height = 320 - margin.top - margin.bottom;

        // Set up the SVG container for the bar plot
        const svg = barPlotContainer
          .append("svg")
          .attr("width", width + margin.left + margin.right)
          .attr("height", height + margin.top + margin.bottom)
          .append("g")
          .attr(
            "transform",
            "translate(" + margin.left + "," + margin.top + ")"
          );
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
          .attr("fill", "#556b2f")
          .on("mouseover", function (d, i) {
            const athleteData = top10MedalData[i];
            const medalText =
              athleteData.count === 1 ? "Medaille" : "Medaillen";
            const text = `${athleteData.count} ${medalText}`;
            tooltip.html(`<div>${text}</div>`).style("visibility", "visible");
          })
          .transition()
          .duration(800)
          .attr("width", (d) => x(d.count))
          .delay((d, i) => i * 100);

        svg

          .on("mousemove", function () {
            tooltip
              .style("top", d3.event.pageY - 10 + "px")
              .style("left", d3.event.pageX + 10 + "px");
          })
          .on("mouseout", function () {
            tooltip.html("").style("visibility", "hidden");
          });

        // Add labels for athlete names
        svg
          .selectAll(".athlete-label")
          .data(top10MedalData)
          .enter()
          .append("text")
          .attr("class", "athlete-label")
          .attr("x", 5)
          .attr("y", (d) => y(d.name) + y.bandwidth() / 2)
          .text((d) => `${d.name}`)
          .attr("alignment-baseline", "middle")
          .attr("fill", "#ccc");

        svg
          .append("text")
          .attr("text-anchor", "middle")
          .attr("x", (width + margin.left) / 2)
          .attr("y", height + margin.top + 40)
          .attr("class", "axis-label")
          .style("fill", updateColors())
          .text("Anzahl");

        svg
          .append("text")
          .attr("text-anchor", "middle")
          .attr("transform", "rotate(-90)")
          .attr("y", -margin.left + 25)
          .attr("x", (-margin.top - height) / 2)
          .attr("class", "axis-label")
          .style("fill", updateColors())
          .text("Athlet");

        createLineChart(athletData, countriesLineChart);

        clearInterval(rotationTimer);
      }
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
      rotate[0] += 0.1;
      projection.rotate(rotate);
      countriesPaths.attr("d", path);
    }, 30);
  });
});

function weight_medals(medals) {
  return medals[0] * 3 + medals[1] * 2 + medals[2] * 1;
}

function getDataLinechart(athletData, arr) {
  let results = [];
  arr.forEach((country) => {
    const countryAthletes = athletData.filter(
      (athlete) => athlete.Country === country
    );

    const medalCountByYear = {};
    countryAthletes.forEach((athlete) => {
      const year = athlete.Year;
      const count = medalCountByYear[year] || 0;
      medalCountByYear[year] = count + 1;
    });

    const medalDataByYear = Object.keys(medalCountByYear).map((year) => ({
      year: +year,
      count: medalCountByYear[year],
    }));

    medalDataByYear.sort((a, b) => a.year - b.year);
    results.push(medalDataByYear);
  });
  return results;
}

function createLineChart(athletData, countriesLineChart) {
  d3.selectAll(".selectionButton").each(function (d, i) {
    if (d3.select(`#country${i + 1}`).property("value") != "") {
      countriesLineChart[i + 1] = d3
        .select(`#country${i + 1}`)
        .property("value");
    } else {
      countriesLineChart.length = 1;
    }
  });

  let medalDatabyCountryAndYear = getDataLinechart(
    athletData,
    countriesLineChart
  );
  d3.select("#country-line-plot").select("svg").remove();

  const lineChartWidth = 670;
  const lineChartHeight = 320;
  const lineChartMargin = { top: 10, right: 30, bottom: 60, left: 60 };

  const colorScale = d3.scaleOrdinal(d3.schemeCategory10);

  const lineChartSvg = d3
    .select("#country-line-plot")
    .append("svg")
    .attr(
      "width",
      lineChartWidth + lineChartMargin.left + lineChartMargin.right
    )
    .attr(
      "height",
      lineChartHeight + lineChartMargin.top + lineChartMargin.bottom
    )
    .append("g")
    .attr(
      "transform",
      "translate(" + lineChartMargin.left + "," + lineChartMargin.top + ")"
    );

  const line_xScale = d3
    .scaleLinear()
    .domain([
      d3.min(
        medalDatabyCountryAndYear.reduce(
          (acc, countryData) => acc.concat(countryData),
          []
        ),
        (d) => d.year
      ) - 5,
      d3.max(
        medalDatabyCountryAndYear.reduce(
          (acc, countryData) => acc.concat(countryData),
          []
        ),
        (d) => d.year
      ) + 5,
    ])
    .range([0, lineChartWidth]);
  const line_yScale = d3
    .scaleLinear()
    .domain([
      0,
      d3.max(
        medalDatabyCountryAndYear.reduce(
          (acc, countryData) => acc.concat(countryData),
          []
        ),
        (d) => Math.ceil(d.count / 10) * 10
      ),
    ])
    .range([lineChartHeight, 0]);

  const line = d3
    .line()
    .x((d) => line_xScale(d.year))
    .y((d) => line_yScale(d.count));

  const line_xAxis = d3.axisBottom(line_xScale);
  line_xAxis.ticks(
    (d3.extent(
      medalDatabyCountryAndYear.reduce(
        (acc, countryData) => acc.concat(countryData),
        []
      ),
      (d) => d.year
    )[1] -
      d3.extent(
        medalDatabyCountryAndYear.reduce(
          (acc, countryData) => acc.concat(countryData),
          []
        ),
        (d) => d.year
      )[0]) /
      5
  );

  lineChartSvg
    .append("text")
    .attr("text-anchor", "middle")
    .attr("transform", "rotate(-90)")
    .attr("y", -lineChartMargin.left + 20)
    .attr("x", -lineChartHeight / 2)
    .attr("class", "axis-label")
    .style("fill", updateColors())
    .text("Anzahl");

  lineChartSvg
    .append("g")
    .attr("class", "x-axis")
    .attr("transform", "translate(0," + lineChartHeight + ")")
    .call(line_xAxis.tickFormat(d3.format("d")))
    .selectAll("text")
    .style("text-anchor", "end")
    .attr("dx", "-1em")
    .attr("dy", "-0.5em")
    .attr("transform", "rotate(-90)");

  lineChartSvg
    .append("text")
    .attr("text-anchor", "middle")
    .attr("x", (lineChartWidth + lineChartMargin.left) / 2)
    .attr("y", lineChartHeight + lineChartMargin.top + 40)
    .attr("class", "axis-label")
    .style("fill", updateColors())
    .text("Jahr");

  lineChartSvg.append("g").call(d3.axisLeft(line_yScale));

  const circlesGroup = lineChartSvg.append("g");
  for (let i = 0; i < medalDatabyCountryAndYear.length; i++) {
    lineChartSvg
      .selectAll(".line")
      .data(medalDatabyCountryAndYear)
      .enter()
      .append("path")
      .attr("class", "line")
      .attr("fill", "none")
      .attr("stroke", (d, i) => colorScale(i))
      .attr("stroke-width", 2)
      .attr("d", line);

    circlesGroup
      .selectAll(`.circle-${i}`)
      .data(medalDatabyCountryAndYear[i])
      .enter()
      .append("circle")
      .attr("class", `circle-${i}`)
      .attr("cx", (d) => line_xScale(d.year))
      .attr("cy", (d) => line_yScale(d.count))
      .attr("r", 3)
      .attr("fill", colorScale(i))
      .append("title")
      .text(
        (d) => `${countriesLineChart[i]} (${d.year}): ${d.count} Medaillen`
      );
  }

  const legend = lineChartSvg
    .append("g")
    .attr("class", "legend")
    .attr("transform", "translate(500,0)")
    .selectAll("g")
    .data(countriesLineChart)
    .enter()
    .append("g");

  legend
    .append("rect")
    .attr("x", 0)
    .attr("y", (d, i) => i * 20)
    .attr("width", 10)
    .attr("height", 10)
    .attr("fill", (d, i) => colorScale(i));

  legend
    .append("text")
    .attr("x", 15)
    .attr("y", (d, i) => i * 20 + 9)
    .attr("class", "axis-label")
    .style("fill", updateColors())
    .text((d) => d);

  const brushX = d3
    .brushX()
    .extent([
      [0, 0],
      [lineChartWidth, lineChartHeight],
    ])
    .on("end", brushed);

  lineChartSvg.append("g").attr("class", "brushX").call(brushX);

  function brushed() {
    if (!d3.event.sourceEvent) return;

    const selection = d3.event.selection;

    if (selection) {
      line_xScale.domain([
        line_xScale.invert(selection[0]),
        line_xScale.invert(selection[1]),
      ]);

      // Add transition to smoothly zoom in
      lineChartSvg
        .select(".x-axis")
        .transition()
        .call(d3.axisBottom(line_xScale).tickFormat(d3.format("d")));
      setTimeout(() => {
        lineChartSvg.select(".brushX").call(brushX.move, null);
      }, 100); // the zoom animation takes time, hence the delay
    } else {
      line_xScale.domain([
        d3.min(
          medalDatabyCountryAndYear.reduce(
            (acc, countryData) => acc.concat(countryData),
            []
          ),
          (d) => d.year
        ) - 5,
        d3.max(
          medalDatabyCountryAndYear.reduce(
            (acc, countryData) => acc.concat(countryData),
            []
          ),
          (d) => d.year
        ) + 5,
      ]);
    }

    updateLineChart();
  }

  function updateLineChart() {
    const filteredData = medalDatabyCountryAndYear.map((countryData) => {
      return countryData.filter(
        (d) =>
          d.year >= line_xScale.domain()[0] && d.year <= line_xScale.domain()[1]
      );
    });

    lineChartSvg
      .select(".x-axis")
      .transition()
      .duration(1000)
      .ease(d3.easeQuad) // Adjust the easing function as needed

      .call(d3.axisBottom(line_xScale).tickFormat(d3.format("d")));

    // Create the line interpolation function with linear curve
    const lineInterpolator = d3
      .line()
      .x((d) => line_xScale(d.year))
      .y((d) => line_yScale(d.count))
      .curve(d3.curveLinear);

    lineChartSvg
      .selectAll(".line")
      .data(filteredData)
      .transition()
      .duration(1000)
      .attr("d", (d) => lineInterpolator(d));

    circlesGroup.selectAll("circle").remove();

    // Create new circles after the lines have transitioned
    setTimeout(() => {
      for (let i = 0; i < filteredData.length; i++) {
        circlesGroup
          .selectAll(`.circle-${i}`)
          .data(filteredData[i])
          .enter()
          .append("circle")
          .attr("class", `circle-${i}`)
          .attr("cx", (d) => line_xScale(d.year))
          .attr("cy", (d) => line_yScale(d.count))
          .attr("r", 3)
          .attr("fill", colorScale(i))
          .append("title")
          .text(
            (d) => `${countriesLineChart[i]} (${d.year}): ${d.count} Medaillen`
          );
      }
    }, 850); // Delay the circle creation to match the line transition

    lineChartSvg
      .select(".x-axis")
      .selectAll("text")
      .style("text-anchor", "end")
      .attr("dx", "-1em")
      .attr("dy", "-0.5em")
      .attr("transform", "rotate(-90)");
  }
}

function resetDropDown() {
  d3.selectAll(".selectionButton").each(function (d, i) {
    let dropdown = d3.select(this);

    dropdown.style("visibility", "hidden");
    dropdown.property("value", "");
    dropdown.property("text", `Vergleichsland`);
  });
}

function calcRanks(map_country_medals) {
  let medalTotals = Array.from(map_country_medals, ([country, medals]) => {
    let total = medals.reduce((sum, current) => sum + current, 0);
    return { country, total };
  });

  medalTotals.sort((a, b) => b.total - a.total);

  let rankMap = new Map();
  let currentRank = 1;
  let previousTotal = null;
  let rankCounter = 1;

  medalTotals.forEach((item) => {
    if (item.total !== previousTotal) {
      currentRank = rankCounter;
      previousTotal = item.total;
    }
    rankMap.set(item.country, currentRank);
    rankCounter++;
  });

  return rankMap;
}
function createGenderPieChart(athleteData) {
  // Calculate gender counts
  let maleCount = 0;
  let femaleCount = 0;

  athleteData.forEach((entry) => {
    if (entry.Sex === "M") {
      maleCount++;
    } else if (entry.Sex === "F") {
      femaleCount++;
    }
  });

  const total = maleCount + femaleCount;

  // Calculate percentage values
  const malePercentage = (maleCount / total) * 100;
  const femalePercentage = (femaleCount / total) * 100;

  // Create data array for pie chart
  const genderData = [
    { gender: "Mann", count: maleCount, percentage: malePercentage },
    { gender: "Frau", count: femaleCount, percentage: femalePercentage },
  ];

  // Set up pie chart dimensions
  const pieWidth = 400;
  const pieHeight = 400;
  const pieRadius = Math.min(pieWidth, pieHeight) / 2;

  // Define color scale
  const colorScale = d3.scaleOrdinal().range(["steelblue", "#ff5252"]);

  // Create pie chart
  const pie = d3.pie().value((d) => d.count);

  // Define arc
  const arc = d3.arc().outerRadius(pieRadius).innerRadius(0);

  // Select the SVG container for the pie chart
  const pieChartSvg = d3
    .select("#gender-distribution")
    .append("svg")
    .attr("width", pieWidth)
    .attr("height", pieHeight)
    .append("g")
    .attr("transform", `translate(${pieWidth / 2},${pieHeight / 2})`);

  // Create arcs
  const arcs = pieChartSvg
    .selectAll(".arc")
    .data(pie(genderData))
    .enter()
    .append("g")
    .attr("class", "arc");

  // Add path elements to represent the arcs
  arcs
    .append("path")
    .attr("d", arc)
    .attr("fill", (d) => colorScale(d.data.gender))
    .attr("stroke", "#fff")
    .attr("stroke-width", 1);

  // Add labels to the arcs
  arcs
    .append("text")
    .attr("transform", (d) => `translate(${arc.centroid(d)})`)
    .attr("dy", "0.35em")
    .text(
      (d) =>
        `${d.data.gender}: ${d.data.count} (${d.data.percentage.toFixed(1)}%)`
    )
    .style("text-anchor", "middle")
    .style("fill", "white");
}
function createTop10MedalsBarPlot(athletData) {
  // Create an array to store the total medals for each country
  const totalMedalsData = [];

  // Calculate the total medals for each country
  athletData.forEach((athlete) => {
    const country = athlete.Country;
    const medal = athlete.Medal;

    // Check if the medal is valid (Gold, Silver, or Bronze)
    if (medal && ["Gold", "Silver", "Bronze"].includes(medal)) {
      const index = totalMedalsData.findIndex(
        (item) => item.country === country
      );

      if (index !== -1) {
        // If the country is already in the array, update the medal count
        totalMedalsData[index][medal.toLowerCase()] += 1;
        totalMedalsData[index].total += 1;
      } else {
        // If the country is not in the array, add a new entry
        const newEntry = {
          country: country,
          gold: medal === "Gold" ? 1 : 0,
          silver: medal === "Silver" ? 1 : 0,
          bronze: medal === "Bronze" ? 1 : 0,
          total: 1,
        };
        totalMedalsData.push(newEntry);
      }
    }
  });

  // Sort the array based on the total number of medals
  totalMedalsData.sort((a, b) => b.total - a.total);

  // Extract top 10 countries and their total medal counts
  const top10Countries = totalMedalsData.slice(0, 10);

  // Use the same margins and dimensions
  const margin = { top: 30, right: 30, bottom: 70, left: 120 };
  const width = 650 - margin.right;
  const height = 450 - margin.top - margin.bottom;

  // Create an SVG container for the bar plot
  const barPlotSvg = d3
    .select("#total-medals-bar-plot")
    .append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  // Update the y-axis scale
  const y = d3
    .scaleBand()
    .domain(top10Countries.map((entry) => entry.country))
    .range([0, height])
    .padding(0.2);
  barPlotSvg.selectAll(".y-axis").remove();
  barPlotSvg.append("g").attr("class", "y-axis").call(d3.axisLeft(y));

  barPlotSvg
    .append("text")
    .attr("text-anchor", "middle")
    .attr("transform", "rotate(-90)")
    .attr("y", -margin.left + 10)
    .attr("x", -height / 2)
    .attr("class", "axis-label")
    .style("fill", updateColors())
    .text("Land");

  barPlotSvg
    .append("text")
    .attr("text-anchor", "middle")
    .attr("x", width / 2)
    .attr("y", height + margin.bottom - 10)
    .attr("class", "axis-label")
    .style("fill", updateColors())
    .text("Anzahl");

  // Create x and y scales
  const xScale = d3
    .scaleLinear()
    .domain([0, d3.max(top10Countries, (entry) => entry.total)])
    .range([0, width]);

  // Create x-axis
  barPlotSvg
    .append("g")
    .attr("class", "x-axis")
    .attr("transform", `translate(0, ${height})`)
    .call(d3.axisBottom(xScale));

  // Create bars for each country
  barPlotSvg
    .selectAll(".bar")
    .data(top10Countries)
    .enter()
    .append("rect")
    .attr("class", "bar")
    .attr("y", (d) => y(d.country))
    .attr("x", 0)
    .attr("height", y.bandwidth())
    .attr("width", (d) => xScale(d.total))
    .style("fill", "#ffd700")
    .on("mouseover", function (d) {
      d3.select(this).style("fill", "#ccae00");

      // Update tooltip content based on medal type
      let medalText = "";
      if (d.gold > 0) medalText += `${d.gold} 🥇 `;
      if (d.silver > 0) medalText += `${d.silver} 🥈 `;
      if (d.bronze > 0) medalText += `${d.bronze} 🥉 `;

      tooltip
        .html(
          `<div>${d.country}: ${d.total} Medals</div><div>${medalText}</div>`
        )
        .style("visibility", "visible");
    })
    .on("mousemove", function (event, d) {
      const [x, y] = d3.mouse(this);

      tooltip.style("top", y - 5 + "px").style("left", x + 160 + "px");
    })

    .on("mouseout", function (d) {
      d3.select(this).style("fill", "gold");
      tooltip.html("").style("visibility", "hidden");
    });

  let tooltip = d3
    .select("#total-medals-bar-plot") // Select the container element

    .append("div")
    .attr("class", "d3-tooltip")
    .style("position", "absolute")
    .style("z-index", "10")
    .style("visibility", "hidden")
    .style("padding", "10px")
    .style("background", "rgba(0,0,0,0.6)")
    .style("border-radius", "4px")
    .style("color", "#fff");
}

function updateColors() {
  const body = document.body;

  // Check the current state of the switch
  const isLightMode = !body.classList.contains("dark-mode");

  // If dark mode is active, set legend color to white, otherwise to black
  const legendColor = !isLightMode ? "white" : "black";

  return legendColor;
}
