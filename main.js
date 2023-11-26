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

    const max_medals_weighted = Array.from(map_country_medals.values()).reduce(function(max, countryMedals) {
      let val = weight_medals(countryMedals);
      return val > max ? val : max;
    }, 0);
 
   const colorScale = d3.scaleLog().domain([1, max_medals_weighted]).range(["#f7f7f7", "#ffd700"]);
 
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
      .attr("fill", (d) => {
        let countryName = map_country_id_name.get(d.id);
        let medals = map_country_medals.get(countryName) || [0, 0, 0];
        return colorScale(weight_medals(medals));
      })
      .on("mouseover", handleMouseOver)
      .on("mouseout", handleMouseOut)
      .on("click", handleClick);

    let rotationTimer;

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
      let countryName = map_country_id_name.get(d.id);

      console.log(countryName);

      let country_information = d3.select("#country-overview").html("Land: " + countryName);
      country_information.selectAll("*").remove();

      if(map_country_medals.get(countryName) == undefined) {
        return;
      }

      console.log(map_country_medals.get(countryName));

      let ul = country_information.append("ul");
      ul.selectAll("li").data(map_country_medals.get(countryName)).enter().append("li").text(function(amount_medal, index){
        if (index == 0) {
          return `🥇: ${amount_medal}`;
        }
        else if (index == 1) {
          return `🥈: ${amount_medal}`;
        }
        else if (index == 2) {
          return `🥉: ${amount_medal}`;
        }
    })};

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