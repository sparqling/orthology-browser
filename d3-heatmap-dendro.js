/*
 * Mayya Sedova <msedova.dev@gmail.com>
 */


(function () {
  function showToolTip(target, tip) {
    d3.select(target).classed("cell-hover", true);
    //Update the tooltip position and value
    d3.select("#d3tooltip")
      .style("left", (d3.event.pageX + 10) + "px")
      .style("top", (d3.event.pageY - 10) + "px")
      .select("#value")
      .html(tip);
    //Show the tooltip
    d3.select("#d3tooltip").transition()
      .duration(200)
      .style("opacity", .9);
  }

  function truncateString(str, num) {
    if (str.length > num) {
      return str.slice(0, num) + "…";
    } else {
      return str;
    }
  }
  
  d3.heatmapDendro = function (data, parent, showColTree, showRowTree, showCellNumber) {
    if (!data || !data.matrix)
      return;

    d3.select(parent).selectAll("*").remove();
    
    let svg = d3.select(parent)
      .append("svg")
      .attr("width", "100%")
      .attr("height", "100%");

    let labelsFromTree = function (nodes, cluster) {
      let labels = [];

      for (let n in nodes) {
        if (!nodes[n].children || nodes[n].children.length === 0) {
          labels.push(nodes[n].name);
        }
      }
      return labels;
    };
    
    let container = document.querySelector(parent);

    let clusterSpace = 150, // size of the cluster tree
      colNumber = data.matrix[0].length,
      rowNumber = data.matrix.length,
      width =
        container.offsetWidth * 0.8 - clusterSpace,
      height = container.offsetHeight * 0.8 - clusterSpace,
      rowCluster = d3.layout.cluster()
        .size([height, clusterSpace]).separation(() => 1),
      colCluster = d3.layout.cluster()
        .size([width, clusterSpace]).separation(() => 1),
      rowNodes = rowCluster.nodes(data.rowJSON),
      colNodes = colCluster.nodes(data.colJSON),
      rowLabel = labelsFromTree(rowNodes, rowCluster),
      colLabel = labelsFromTree(colNodes, colCluster);
    let cellWidth = width / colNumber;
    let cellHeight = Math.max(height / rowNumber, 20);
    const rowLabelWidth = 150;
    const colLabelHeight = 80;
    
    let matrix = [], max = 0;
    for (let r = 0; r < rowNumber; r++) {
      for (let c = 0; c < colNumber; c++) {
        matrix.push({row: r + 1, col: c + 1, value: data.matrix[r][c]});
        max = Math.max(max, data.matrix[r][c]);
      }
    }

    svg.selectAll("*").remove();

    let rowLabels = svg.append("g")
      .selectAll(".rowLabelg")
      .data(rowLabel)
      .enter()
      .append("text")
      .text(function (d) {
        return truncateString(d, 20);
      })
      .attr("x", clusterSpace + cellHeight)
      .attr("y", function (d, i) {
        return (i + 1) * cellHeight + clusterSpace + colLabelHeight + 6;
      })
      .style("text-anchor", "end")
      .attr("transform", `translate(${clusterSpace + 6}, ${-cellHeight * 0.3})`)
      .on("mouseover", function (d) {
        let data = mapNameToTaxa[d];
        if (!data)
          return '';
        let tip = "<ui>";
        for (let [key, val] of Object.entries(data)) {
          tip += `<li>${key}: ${val}</\li>`;
        }
        tip += "</ui>";
        showToolTip(this, tip);
      })
      .on("mouseout", function(){ hideTooltip(this) })
      .attr("class", function (d, i) {
        return "rowLabel mono r" + i;
      });

    let rowImages = svg.append("g")
      .selectAll(".rowLabelg")
      .data(rowLabel)
      .enter()
      .append("image")
      .attr("x", clusterSpace)
      .attr("y", function (d, i) {
        return i * cellHeight + clusterSpace + colLabelHeight + 6;
      })
      .attr("width", cellHeight)
      .attr("class", "taxon-image")
      .attr('id', (d) => `row-image-${d}`)
      .attr("height", cellHeight)
      .on('mouseover',  function(d, e) {
          if(this.href.animVal !== 'undefined') {
            //Update the tooltip position and value
            showTooltipImage(d3.event.pageX, d3.event.pageY, d, this.href.animVal);
          }
       })
      .on("mouseout", function(){ hideTooltip(this) });


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
        return (i + 1) * cellWidth + cellHeight + clusterSpace + rowLabelWidth + 12;
      })
      .style("text-anchor", "end")
      .attr("transform", `translate(${-cellWidth / 2}, ${clusterSpace + 6}) rotate(-90)`)
      .on("mouseover", function (d) {
        let data = mapDisplayedNameToProtein[d];
        let tip = "<ui>";
        for (let [key, val] of Object.entries(data)) {
          tip += `<li>${key}: ${val}</\li>`;
        }
        tip += "</ui>";
        showToolTip(this, tip);
      })
      .on("mouseout", function(){ hideTooltip(this); })
      .attr("class", function (d, i) {
        return "colLabel mono c" + i;
      });



    let heatMap = svg.append("g").attr("class", "g3")
      .selectAll(".cellg")
      .data(matrix, function (d) {
        return d.row + ":" + d.col;
      })
      .enter()
      .append("g")
      .attr("transform", function (d, i) {
        return `translate(${(d.col - 1) * cellWidth + clusterSpace + rowLabelWidth + 10 + cellHeight},
         ${(d.row - 1) * cellHeight + clusterSpace + colLabelHeight + 10})`;
      })
      
    heatMap.append("rect")
      .attr("class", function (d) {
        return "cell cell-border cr" + (d.row - 1) + " cc" + (d.col - 1);
      })
      .attr("width", cellWidth)
      .attr("height", cellHeight)
      .style("fill", function (d) {
        let intensity = 0.3 + 0.7 * d.value / max;
        let red = 255 * (1 - intensity);
        let green = 255 * (1 - intensity) + 140 * intensity;
        let blue = 255 * (1 - intensity) + 251 * intensity;
        return d.value ? `rgb(${red}, ${green}, ${blue})` : "white";
      })
      .on("mouseover", function (d) {
        let tips = tooltips[d.row - 1][d.col - 1];
        if (!tips)
          return '';
        showToolTip(this, tips);
      })
      .on("mouseout", function(){ hideTooltip(this); })
    
    if(showCellNumber) {
      heatMap
        .append('text')
        .attr("x", cellWidth / 2)
        .attr('y', cellHeight - 5)
        .text((d) => d.value ? d.value : '')
        .attr("class", (d, i) => {
          return "cell-label r";
        });
    }

    if(showRowTree) {
      //tree for rows
      let rTree = svg.append("g").attr("class", "rtree")
        .attr("transform", `translate (0, ${clusterSpace + colLabelHeight + 6})`);
      let rlink = rTree.selectAll(".rlink")
        .data(rowCluster.links(rowNodes))
        .enter().append("path")
        .attr("class", "rlink")
        .on("mouseover", function (d) {
          let tips = d.target.name;
          if (!tips)
            return '';
          // showToolTip(this, tips);
        })
        // .on("mouseout", function(){ hideTooltip(this); })
        .attr("d", elbow);

      let rnode = rTree.selectAll(".rnode")
        .data(rowNodes)
        .enter().append("g")
        .attr("class", "rnode")
        .attr("transform", function (d) {
          return "translate(" + d.y + "," + d.x + ")";
        });
    }

    //tree for cols
    if(showColTree) {
      let cTree = svg.append("g").attr("class", "ctree")
        .attr("transform", `rotate (90), translate (0, ${-(clusterSpace + rowLabelWidth + cellHeight + 10)}) scale(1,-1)`);
      let clink = cTree.selectAll(".clink")
        .data(colCluster.links(colNodes))
        .enter().append("path")
        .attr("class", "clink")
        .attr("d", elbow);

      let cnode = cTree.selectAll(".cnode")
        .data(colNodes)
        .enter().append("g")
        .attr("class", "cnode")
        .attr("transform", function (d) {
          return "translate(" + d.y + "," + d.x + ")";
        });
    }

    function elbow(d, i) {
      return "M" + d.source.y + "," + d.source.x
        + "V" + d.target.x + "H" + d.target.y;
    }
  }
  
})();