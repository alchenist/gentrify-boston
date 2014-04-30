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
    .attr("id", "overlay"); 
    
var canvas = d3.select("#vis").append("svg").attr("viewBox", "0 0 " + (width + margin.left + margin.right) + " " + (height + margin.top + margin.bottom))
    .attr("preserveAspectRatio", "xMidYMid meet")
    .attr("id", "canvas");

var svg = canvas.append("g").attr({
        transform: "translate(" + margin.left + "," + margin.top + ")"
    });
    
var oSvg = overlayCanvas.append("g").attr({
        transform: "translate(" + margin.left + "," + margin.top + ")"
    });


    
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
    var curYear;
    
    // setup
    var p = topojson.feature(blank, blank.objects.precinctsgeo);
    var n = topojson.feature(neigh, neigh.objects.neighborhoods);
    var t = topojson.feature(town, town.objects.towns);
    var projection = d3.geo.mercator()
        .scale(130000)
         .center([-71.06361, 42.31806])
        .translate([width/2, height/2]);
    var path = d3.geo.path()
        .projection(projection);
        
    // draw maps
    var townships = svg.append("g")
        .attr("class", "townships")
      .selectAll(".township")
        .data(t.features)
      .enter().append("path")
        .attr("d", path);
    
    var precincts = svg.append("g")
        .attr("class", "precincts")
      .selectAll(".precinct")
        .data(p.features)
      .enter().append("path")
        .attr("class", function(d) { 
            return "precinct " + d.id 
        })
        .attr("d", path)
        .attr("fill", "#FFFFFF")
        .on("mouseover", function(d) { console.log(d.id) });
        
    var neighborhoods = svg.append("g")
        .attr("class", "neighborhoods")
      .selectAll(".neighborhood")
        .data(n.features)
      .enter().append("path")
        .attr("d", path);
        
    svg.append("g")
        .attr("class", "nlabels")
      .selectAll(".nlabel")
        .data(n.features)
      .enter().append("text")
        .attr("class", function(d) {
            if (d.properties.Name in {"North End": 0, "Downtown": 0, "Leather District": 0, "South Boston Waterfront": 0}) {return "nlabel l"}
            else if (d.properties.Name in {"West End": 0, "Beacon Hill": 0, "Back Bay": 0, "Bay Village": 0, "Longwood Medical Area": 0}) {return "nlabel r"}
            else {return "nlabel"}
        })
        .attr("transform", function(d) { return "translate(" + path.centroid(d) +")" })
        .attr("dy", function(d) {
            if (d.properties.Name == "Bay Village") {return "1em"}
            else if (d.properties.Name == "Leather District" || d.properties.Name == "Back Bay") {return "0em"}
            else {return "0.2em"}
        })
        .text(function(d) {  return d.properties.Name });
    
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
    
    yearlist = Object.keys(years);    
    
    var format = d3.time.format("%Y")
    
    var x = d3.time.scale()
        .domain(d3.extent(yearlist, function(d) { return format.parse(d) }))
        .range([0, width])
        .clamp(true);
        
    var color = d3.scale.quantize()
        .range(['rgb(165,0,38)','rgb(215,48,39)','rgb(244,109,67)','rgb(253,174,97)','rgb(254,224,144)','rgb(255,255,191)','rgb(224,243,248)','rgb(171,217,233)','rgb(116,173,209)','rgb(69,117,180)','rgb(49,54,149)']);
        
    var brush = d3.svg.brush()
        .x(x)
        .extent([0, 0])
        .on("brush", brushed)
        .clamp(true);
        
    var xAxis = d3.svg.axis()
        .scale(x)
        .orient("bottom")
        .outerTickSize(0)
        .ticks(d3.time.years, 2)
    
    var sliderAxis = oSvg.append("g")
        .attr("class", "x axis")
        .attr("transform", "translate(0," + (75) + ")")
        .call(xAxis);
        
        
    var slider = oSvg.append("g")
        .attr("class", "slider")
        .call(brush);
    
    slider.selectAll(".extent,.resize")
        .remove();
    
    var handle = slider.append("circle")
        .attr("class", "handle")
        .attr("transform", "translate(0," + (75) + ")")
        .attr("r", 7);
        
    function brushed() {
        var pos = brush.extent()[1];
        
        if (d3.event.sourceEvent) {
            pos = x.invert(d3.mouse(this)[0]);
            brush.extent([pos, pos]);
        }
        
        curYear = format(pos);
        handle.attr("cx", x(pos));
        redraw();
    }
    
    function redraw() {
        color.domain(databyyear[curYear]);
        precincts
            .attr("fill", function(d) { 
                return (d.id in data) ? color(data[d.id][curYear]) : "none"
            })
    }
    
    function rescale() {
        width = parseInt(d3.select("#vis").style("width")) - margin.left - margin.right;
        height = parseInt(d3.select("#vis").style("height")) - margin.bottom - margin.top;
        overlayCanvas.attr({
            width: width + margin.left + margin.right,
            height: height + margin.top + margin.bottom
            }); 
        x.range([0, width]);
        sliderAxis.call(xAxis);
        /* sliderAxis.attr("transform", "translate(0," + (height - 25) + ")");
        handle.attr("transform", "translate(0," + (height - 25) + ")"); */
    }
    
    window.addEventListener("resize", rescale, false);  
        
    curYear = '1985';
    redraw();
}

