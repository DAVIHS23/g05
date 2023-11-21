document.addEventListener("DOMContentLoaded", function () {
  const mapContainer = d3.select("#map-container");
  const graphsContainer = d3.select("#graphs-container");

  // Set the initial width of graphsContainer to 0
  graphsContainer.style("width", "0");

  mapContainer.on("click", function () {
    graphsContainer.transition().duration(100).style("width", "100%");
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

  // Load the world map data using TopoJSON
  d3.json("https://unpkg.com/world-atlas@1.1.0/world/110m.json").then(
    (worldData) => {
      // Convert TopoJSON to GeoJSON
      const countries = topojson.feature(
        worldData,
        worldData.objects.countries
      );

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
        .attr("fill", "#ccc")
        .on("mouseover", handleMouseOver)
        .on("mouseout", handleMouseOut);

      let rotationTimer;

      // Function to handle mouseover events
      function handleMouseOver() {
        d3.select(this).attr("fill", "#3498db");
        // Pause the continuous rotation when the mouse enters the globe
        clearInterval(rotationTimer);
      }

      // Function to handle mouseout events
      function handleMouseOut() {
        d3.select(this).attr("fill", "#ccc");
        // Resume the continuous rotation when the mouse leaves the globe
        rotationTimer = setInterval(() => {
          const rotate = projection.rotate();
          rotate[0] += 0.1; // Adjust the rotation speed
          projection.rotate(rotate);
          countriesPaths.attr("d", path);
        }, 30); // Adjust the interval
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
    }
  );
});
