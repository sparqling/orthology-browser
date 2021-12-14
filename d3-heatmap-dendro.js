/*
 * Mayya Sedova <msedova.dev@gmail.com>
 */

(function () {

  d3.heatmapDendro = function (data, parent) {

    if (!data || !data.matrix)
      return;
    ;

    let svg = d3.select(parent)
      .append("svg")
      .attr("width", "100%")
      .attr("height", "150px");

    let margin = {top: 10, right: 0, bottom: 10, left: 0};

    let labelsFromTree = function (nodes, cluster) {
      let labels = [];

      for (let n in nodes) {
        if (!nodes[n].children || nodes[n].children.length === 0) {
          labels.push(nodes[n].name);
        }
      }
      return labels;
    };

    let clusterSpace = 150, // size of the cluster tree
      cellSize = 20,
      colNumber = data.matrix[0].length,
      rowNumber = data.matrix.length,
      width = cellSize * colNumber + clusterSpace, // - margin.left - margin.right,
      height = cellSize * rowNumber + clusterSpace, // - margin.top - margin.bottom,
      rowCluster = d3.layout.cluster()
        .size([height - clusterSpace, clusterSpace]),
      colCluster = d3.layout.cluster()
        .size([width - clusterSpace, clusterSpace]),
      rowNodes = rowCluster.nodes(data.rowJSON),
      colNodes = colCluster.nodes(data.colJSON),
      rowLabel = labelsFromTree(rowNodes, rowCluster),
      colLabel = labelsFromTree(colNodes, colCluster);
    
    
    let matrix = [], max = 0;
    for (let r = 0; r < rowNumber; r++) {
      for (let c = 0; c < colNumber; c++) {
        matrix.push({row: r + 1, col: c + 1, value: data.matrix[r][c]});
        max = Math.max(max, data.matrix[r][c]);
      }
    }

    svg.selectAll("*").remove();

    svg.attr("width", width + margin.left + margin.right + clusterSpace)
      .attr("height", height + margin.top + margin.bottom + clusterSpace);

    let rowLabels = svg.append("g")
      .selectAll(".rowLabelg")
      .data(rowLabel)
      .enter()
      .append("text")
      .text(function (d) {
        return d;
      })
      .attr("x", 0)
      .attr("y", function (d, i) {
        return (i + 1) * cellSize + clusterSpace;
      })
      .style("text-anchor", "start")
      .attr("transform", "translate(" + (width + cellSize) + "," + cellSize / 1.5 + ")")
      .attr("class", function (d, i) {
        return "rowLabel mono r" + i;
      });

    let colLabels = svg.append("g")
      .selectAll(".colLabelg")
      .data(colLabel)
      .enter()
      .append("text")
      .text(function (d) {
        return d;
      })
      .attr("x", 0)
      .attr("y", function (d, i) {
        return (i + 1) * cellSize;
      })
      .style("text-anchor", "end")
      .attr("transform", "translate(" + cellSize / 2 + ",-6) rotate (-90)  translate( -" + (height + cellSize * 2) + "," + clusterSpace + ")")
      .attr("class", function (d, i) {
        return "colLabel mono c" + i;
      });

    let heatMap = svg.append("g").attr("class", "g3")
      .selectAll(".cellg")
      .data(matrix, function (d) {
        return d.row + ":" + d.col;
      })
      .enter()
      .append("rect")
      .attr("x", function (d) {
        return d.col * cellSize + clusterSpace;
      })
      .attr("y", function (d) {
        return d.row * cellSize + clusterSpace;
      })
      .attr("class", function (d) {
        return "cell cell-border cr" + (d.row - 1) + " cc" + (d.col - 1);
      })
      .attr("width", cellSize)
      .attr("height", cellSize)
      .style("fill", function (d) {
        let intensity = 0.3 + 0.7 * d.value / max;
        let red = 255 * (1 - intensity);
        let green = 255 * (1 - intensity) + 140 * intensity;
        let blue = 255 * (1 - intensity) + 251 * intensity;
        return d.value ? `rgb(${red}, ${green}, ${blue})` : "white";
      })
      .on("mouseover", function (d) {
        d3.select(this).classed("cell-hover", true);
        //Update the tooltip position and value
        d3.select("#d3tooltip")
          .style("left", (d3.event.pageX + 10) + "px")
          .style("top", (d3.event.pageY - 10) + "px")
          .select("#value")
          .html(
            "Cell type: " + colLabel[d.col] + "<br>Sample name: " + rowLabel[d.row]
            + "<br>Value: " + d.value
          );
        //Show the tooltip
        d3.select("#d3tooltip").transition()
          .duration(200)
          .style("opacity", .9);
      })
      .on("mouseout", function () {
        d3.select(this).classed("cell-hover", false);
        d3.selectAll(".rowLabel").classed("text-highlight", false);
        d3.selectAll(".colLabel").classed("text-highlight", false);
        d3.select("#d3tooltip").transition()
          .duration(200)
          .style("opacity", 0);
      })
    ;

//tree for rows
    let rTree = svg.append("g").attr("class", "rtree").attr("transform", "translate (10, " + (clusterSpace + cellSize) + ")");
    let rlink = rTree.selectAll(".rlink")
      .data(rowCluster.links(rowNodes))
      .enter().append("path")
      .attr("class", "rlink")
      .attr("d", elbow);

    let rnode = rTree.selectAll(".rnode")
      .data(rowNodes)
      .enter().append("g")
      .attr("class", "rnode")
      .attr("transform", function (d) {
        return "translate(" + d.y + "," + d.x + ")";
      });

//tree for cols
    let cTree = svg.append("g").attr("class", "ctree").attr("transform", "rotate (90), translate (10, -" + (clusterSpace + cellSize) + ") scale(1,-1)");
    let clink = cTree.selectAll(".clink")
      .data(rowCluster.links(colNodes))
      .enter().append("path")
      .attr("class", "clink")
      .attr("d", elbow);

    let cnode = cTree.selectAll(".cnode")
      .data(rowNodes)
      .enter().append("g")
      .attr("class", "cnode")
      .attr("transform", function (d) {
        return "translate(" + d.y + "," + d.x + ")";
      });

    function elbow(d, i) {
      return "M" + d.source.y + "," + d.source.x
        + "V" + d.target.x + "H" + d.target.y;
    }
  }
  
})();