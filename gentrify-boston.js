var margin = {
    top: 50,
    right: 50,
    bottom: 50,
    left: 50
};

var width = 900 - margin.left - margin.right;
var height = 600 - margin.bottom - margin.top;

var canvas = d3.select("#vis").append("svg").attr({
    width: width + margin.left + margin.right,
    height: height + margin.top + margin.bottom
    });

var svg = canvas.append("g").attr({
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
        .attr("class", "nlabel")
        .attr("transform", function(d) { return "translate(" + path.centroid(d) +")" })
        .attr("dy", ".35em")
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
        .range(['rgb(158,1,66)','rgb(213,62,79)','rgb(244,109,67)','rgb(253,174,97)','rgb(254,224,139)','rgb(255,255,191)','rgb(230,245,152)','rgb(171,221,164)','rgb(102,194,165)','rgb(50,136,189)','rgb(94,79,162)']);
        
    var brush = d3.svg.brush()
        .x(x)
        .extent([0, 0])
        .on("brush", brushed)
        .clamp(true);
        
    var slider = svg.append("g")
        .attr("class", "slider")
        .call(brush);
    
    slider.selectAll(".extent,.resize")
        .remove();
    
    var handle = slider.append("circle")
        .attr("class", "handle")
        .attr("transform", "translate(0," + (height - 25) + ")")
        .attr("r", 9);
        
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
        
    curYear = '1985';
    redraw();
}

