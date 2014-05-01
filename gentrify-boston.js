var margin = {
    top: 50,
    right: 50,
    bottom: 50,
    left: 50
};

var width = parseInt(d3.select("#vis").style("width")) - margin.left - margin.right;
var height = parseInt(d3.select("#vis").style("height")) - margin.bottom - margin.top;

var overlayCanvas = d3.select("#overlay").append("svg").attr({
    width: width + margin.left + margin.right,
    height: height + margin.top + margin.bottom
    })
    .attr("id", "ocanvas"); 
    
var canvas = d3.select("#vis").append("svg").attr("viewBox", "0 0 " + (width + margin.left + margin.right) + " " + (height + margin.top + margin.bottom))
    .attr("preserveAspectRatio", "xMidYMid meet")
    .attr("id", "canvas");

var svg = canvas.append("g").attr({
        transform: "translate(" + margin.left + "," + margin.top + ")"
    });
    
var oSvg = overlayCanvas.append("g").attr({
        transform: "translate(" + margin.left + "," + margin.top + ")"
    });
    
var bg = svg.append("rect").attr({
    id: "bg",
    x: -margin.left,
    y: -margin.top,
    width: width + margin.left + margin.right,
    height: height +margin.top + margin.bottom,
    fill: "#7f7f7f"
})
    
queue()
    .defer(d3.json, "data/townships.json")
    .defer(d3.json, "data/neighborhoods.json")
    .defer(d3.json, "data/precincts.blank.json")
    .defer(d3.csv, "data/precincts.avg.csv")
    .await(ready);

function ready(error, town, neigh, blank, avg) {
    var data = {};
    var databyyear = {};
    var years = {};
    var yearlist = [];
    var curYear = '1985';
    var start = false;
    
    // setup
    var p = topojson.feature(blank, blank.objects.precinctsgeo);
    var n = topojson.feature(neigh, neigh.objects.neighborhoods);
    var t = topojson.feature(town, town.objects.towns);
    var projection = d3.geo.mercator()
        .scale(130000)
         .center([-71.06361, 42.31806])
        .translate([(width-300)/2 + 300, height/2]);
    var path = d3.geo.path()
        .projection(projection);
    var zoom = d3.behavior.zoom()
        .scaleExtent([1, 5])
        .on("zoom", zoomed)
        
    // draw map features
    var features = svg.append("g")
        .attr("class", "features");
        
    var townships = features.append("g")
        .attr("class", "townships")
        .attr("stroke-width", "1px")
      .selectAll(".township")
        .data(t.features)
      .enter().append("path")
        .attr("d", path);
    
    var precincts = features.append("g")
        .attr("class", "precincts")
      .selectAll(".precinct")
        .data(p.features)
      .enter().append("path")
        .attr("class", function(d) { return "precinct " + d.id })
        .attr("d", path)
        .attr("fill", "#FFFFFF")
        .on("mouseover", function(d) { console.log(d.id) });
        
    var neighborhoods = features.append("g")
        .attr("class", "neighborhoods")
        .attr("stroke-width", "1px")
      .selectAll(".neighborhood")
        .data(n.features)
      .enter().append("path")
        .attr("class", "neighborhood")
        .attr("d", path)
        .on("mouseover", function(d) { console.log(d.properties.Name) });
        
    svg.append("g")
        .attr("class", "nlabels")
        .attr("font-size", "9px")
      .selectAll(".nlabel")
        .data(n.features)
      .enter().append("text")
        .attr("class", function(d) {
            if (d.properties.Name in {"North End": 0, "Downtown": 0, "Leather District": 0, "South Boston Waterfront": 0}) { return "nlabel l" }
            else if (d.properties.Name in {"West End": 0, "Beacon Hill": 0, "Back Bay": 0, "Bay Village": 0, "Longwood Medical Area": 0}) { return "nlabel r" }
            else { return "nlabel" }
        })
        .attr("transform", function(d) { return "translate(" + path.centroid(d) +")" })
        .attr("dy", function(d) {
            if (d.properties.Name == "Bay Village") {return "1em"}
            else if (d.properties.Name == "Leather District" || d.properties.Name == "Back Bay") {return "0em"}
            else {return "0.2em"}
        })
        .text(function(d) { return d.properties.Name });
        
    svg.call(zoom);
    
    // shunt the csv data into an object for easier lookup
    avg.forEach(function (d) {
        var id = d.ward_preci;
        delete d.ward_preci;
        data[id] = {};
        for (v in d) {
            data[id][v] = +d[v];
            if (!(v in databyyear)) {
                databyyear[v] = []
            };
            if (id != "MAX" && id != "MIN" && id != "MED") {
                databyyear[v].push(+d[v]);
            }
            if (!(v in years)) {
                years[v] = true;
            }
        }
    });
    
    yearlist = Object.keys(years); // keeps track of years
    
    var format = d3.time.format("%Y");
    var tFormat = d3.format(".3s");
    
    // various scales
    var x = d3.time.scale()
        .domain(d3.extent(yearlist, function(d) { return format.parse(d) }))
        .range([0, width])
        .clamp(true);
        
    var color = d3.scale.quantile()
        .range(['rgb(213,62,79)','rgb(244,109,67)','rgb(253,174,97)','rgb(254,224,139)','rgb(255,255,191)','rgb(230,245,152)','rgb(171,221,164)','rgb(102,194,165)','rgb(50,136,189)']);
        
    var key = d3.scale.log()
        .range([height-100, 0]);
        
    // brushes and axes
    var brush = d3.svg.brush()
        .x(x)
        .on("brush", brushed)
        .on("brushend", brushended)
        .extent(x.domain())
        .clamp(true);
        
    var xAxis = d3.svg.axis()
        .scale(x)
        .orient("bottom")
        .tickSize(6)
        .outerTickSize(0)
        .ticks(d3.time.years, 1);
    
    var keyAxis = d3.svg.axis()
        .scale(key)
        .orient("right")
        .tickSize(13)
        .tickFormat(function(d) { return tFormat(d) });
        
    var keyG = oSvg.append("g")
        .attr("class", "key axis")
        .attr("transform", "translate(" + (width - 50) + ",0)");
    
    var sliderAxis = oSvg.append("g")
        .attr("class", "slideraxis")
        .attr("transform", "translate(0," + (height - 25) + ")")
        .call(xAxis);
        
    var slider = oSvg.append("g")
        .attr("class", "slider")
        .attr("transform", "translate(0," + (height-25) + ")")
        .call(brush)
        .call(brush.event)
      .selectAll("rect")
        .attr("y", -4)
        .attr("height", 8);
        
    slider.selectAll(".extent")
        .attr("rx", 5)
        .attr("ry", 5); 
    
    function brushed() {
        var temp = curYear;
        curYear = format(brush.extent()[0]);
        if (curYear != temp) redraw();
    }
    
    function brushended() {
        if (!d3.event.sourceEvent && !start) return;
        start = false;
        var extent = brush.extent();
        d3.select(this).transition()
            .ease("linear")
            .duration(brush.empty() ? 0 : 600 * (extent[1].getFullYear() - extent[0].getFullYear()))
            .call(brush.extent([extent[1], extent[1]]))
            .call(brush.event);
    }
    
    function zoomed() {
        features.attr("transform", "translate(" + d3.event.translate + ")scale(" + d3.event.scale + ")");
        svg.selectAll(".neighborhoods, townships")
            .attr("stroke-width", (1/d3.event.scale) + "px");
        svg.selectAll(".nlabels").attr("transform", "translate(" + d3.event.translate + ")scale(" + d3.event.scale + ")")
            .attr("font-size", (9/d3.event.scale) + "px");
    }
    
    function redraw() {
        var ext = d3.extent(databyyear[curYear]);
        color.domain(databyyear[curYear]);
        key.domain(ext);
        keyAxis.tickValues([ext[0]].concat(color.quantiles()).concat(ext[1]));
        redrawLegend();
        precincts.transition().duration(150)
            .attr("fill", function(d) { 
                return (d.id in data) ? color(data[d.id][curYear]) : "none"
            });
    }
    
    function redrawLegend() {
        key.range([height - 100, 0]);
        keyG.selectAll("rect").data(color.range().map(function(c) {
                var d = color.invertExtent(c);
                if (d[0] == null) d[0] = key.domain()[0];
                if (d[1] == null) d[1] = key.domain()[1];
                return d
            }))
            .attr("y", function(d) { return key(d[1]) })
            .attr("height", function(d) { return key(d[0]) - key(d[1]) })
            .style("fill", function(d) { return color(d[0]) }) 
          .enter().append("rect")
            .attr("width", 8)
            .attr("y", function(d) { return key(d[1]) })
            .attr("height", function(d) { return key(d[0]) - key(d[1]) })
            .style("fill", function(d) { return color(d[0]) });
        keyG.call(keyAxis);
        keyG.attr("transform", "translate(" + (width - 50) + ",0)");
    }
     
    // keep design somewhat responsive
    function rescale() {
        width = parseInt(d3.select("#vis").style("width")) - margin.left - margin.right;
        height = parseInt(d3.select("#vis").style("height")) - margin.bottom - margin.top;
        
        svg.select("#bg").attr({
            width: width + margin.left + margin.right,
            height: height + margin.top + margin.bottom
        });
        overlayCanvas.attr({
            width: width + margin.left + margin.right,
            height: height + margin.top + margin.bottom
        }); 
        x.range([0, width]);
        sliderAxis.call(xAxis);
        sliderAxis.attr("transform", "translate(0," + (height - 25) + ")");
        brush.x(x); // doesn't play nicely when resized in the middle of transition
        svg.select(".slider")
            .attr("transform", "translate(0," + (height -25) + ")")
            .call(brush)
            .call(brush.event);
        redrawLegend();
    }
    
    window.addEventListener("resize", rescale, false);

    redraw();
    start = true;
    oSvg.call(brush.extent(x.domain()))   
        .call(brush.event);
}

