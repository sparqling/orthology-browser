const endpoint = 'https://orth.dbcls.jp/sparql-proxy';
const dbpediaEndpoint = 'https://dbpedia.org/sparql';

const taxonPrefix = "taxonomy-browser-proteome-";
const proteinPrefix = 'go-browser-protein-';


let chart = null;

let hOrderedByCellNum = false;
let vOrderedByCellNum = false;

let baseTaxon = {
  genome_taxid: "9606",
  up_id_url: "http://purl.uniprot.org/proteomes/UP000005640",
  up_id: "UP000005640",
  types: "http://purl.uniprot.org/core/Proteome, http://purl.uniprot.org/core/Reference_Proteome, http://purl.uniprot.org/core/Representative_Proteome",
  organism_name: "Homo sapiens (Human)",
  displayedName: "Human",
  n_genes: 20596,
  n_isoforms: 76225,
  cpd_label: "Outlier",
  busco_complete: "6163",
  busco_single: "2364",
  busco_multi: "3799",
  busco_fragmented: "12",
  busco_missing: "17",
  assembly: "GCA_000001405.27"
};
let comparedTaxa = [];
let proteins = [];
let tooltips = {};
let tooltipMap = {};
let series = null;
let taxonTree = null;
let humanNode = null;
let paraNumMap = null;

let maxParalogNum = 0;
let mapNameToTaxa = {}, mapTaxIdToTaxa = {},
  mapMnemonicToProteins = {};
mapDisplayedNameToProtein = {};

mapNameToTaxa[baseTaxon.displayedName] = baseTaxon;
mapTaxIdToTaxa[baseTaxon.genome_taxid] = baseTaxon;
mapTaxIdToThumbnail = {};

Storage.prototype.getObject = function (key) {
  let val = this.getItem(key);
  return val && JSON.parse(val) || {};
}

function mdsClassic(distances, dimensions) {
  dimensions = dimensions || 2;

  // square distances
  let M = numeric.mul(-.5, numeric.pow(distances, 2));

  // double centre the rows/columns
  function mean(A) { return numeric.div(numeric.add.apply(null, A), A.length); }
  let rowMeans = mean(M),
    colMeans = mean(numeric.transpose(M)),
    totalMean = mean(rowMeans);

  for (let i = 0; i < M.length; ++i) {
    for (let j =0; j < M[0].length; ++j) {
      M[i][j] += totalMean - rowMeans[j] - colMeans[i];
    }
  }

  // take the SVD of the double centred matrix, and return the
  // points from it
  let ret = numeric.svd(M),
    eigenValues = numeric.sqrt(ret.S);
  return ret.U.map(function(row) {
    return numeric.mul(row, eigenValues).splice(0, dimensions);
  });
};


function queryBySpang(queryUrl, param, callback, target_end = null) {
  $.get(queryUrl, (query) => {
    spang.query(query, target_end ? target_end : endpoint, {
      param: param,
      format: 'json'
    }, (error, status, result) => {
      let resultJson;
      try {
        resultJson = JSON.parse(result);
      } catch (e) {
        console.log(e);
        resultJson = {
          results:
            {
              bindings: {}
            }
        };
      }
      callback(resultJson);
    });
  });
}

function UpdateChart() {
  if (chart)
    chart.destroy();

  comparedTaxa = [];
  proteins = [];
  tooltips = {};
  series = null;

  maxParalogNum = 0;
  mapNameToTaxa = {};
  mapTaxIdToTaxa = {};
  mapMnemonicToProteins = {};
  mapDisplayedNameToProtein = {};

  mapNameToTaxa[baseTaxon.displayedName] = baseTaxon;
  mapTaxIdToTaxa[baseTaxon.genome_taxid] = baseTaxon;
  
  $('#loader-container').show();
  $('#chart').hide();
  for (let i = 0; i < localStorage.length; i++) {
    let key = localStorage.key(i);
    if (key.startsWith(taxonPrefix)) {
      let taxonId = localStorage.getObject(key)?.genome_taxid;
      if (taxonId && taxonId !== baseTaxon.genome_taxid) {
        let entry = localStorage.getObject(key);
        if(entry.organism_name.includes("(")) {
          let matched = entry.organism_name.match(/^[^\(]+\(([^\)]+)\)/);
          if(matched)
            entry.displayedName = matched[1];
        }
        entry.displayedName = entry.displayedName || entry.organism_name;
        comparedTaxa.push(entry);
        mapNameToTaxa[entry.displayedName] = entry;
        mapTaxIdToTaxa[taxonId] = entry;
      }
    } else if (key.startsWith(proteinPrefix)) {
      let entry = localStorage.getObject(key);
      proteins.push(entry);
      if (!mapMnemonicToProteins[entry.mnemonic])
        mapMnemonicToProteins[entry.mnemonic] = [];
      mapMnemonicToProteins[entry.mnemonic].push(entry);
    }
  }

  proteins.sort((protein1, protein2) => protein1.mnemonic < protein2.mnemonic ? -1 : 1);
  
  if(proteins.length === 0 || comparedTaxa.length === 0) {
    $('#loader-container').hide();
    $('#chart').show();
    $('#chart')[0].innerText = "No candidates selected";
    return;
  }

  // Assign unique displayed name to avoid conflict
  for (let [mnemonic, proteins] of Object.entries(mapMnemonicToProteins)) {
    if (proteins.length === 1) {
      proteins[0].displayedName = mnemonic;
      mapDisplayedNameToProtein[mnemonic] = proteins[0];
    } else {
      for (let protein of proteins) {
        protein.displayedName = `${mnemonic} (${protein.up_id})`;
        mapDisplayedNameToProtein[protein.displayedName] = protein;
      }
    }
  }


  function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
  }
  
  $('#database-select').on('change', () => {
    renderChart();
  });

  queryBySpang("sparql/matrix.rq", {
    taxa: comparedTaxa.map((taxon) => 'upTax:' + taxon.genome_taxid).join(' '),
    proteins: proteins.map((protein) => 'uniprot:' + protein.up_id).join(' ')
  }, (result) => {
    maxParalogNum = 0;
    let taxIdList = [baseTaxon.genome_taxid].concat(comparedTaxa.map((taxon) => taxon.genome_taxid));
    let taxonProtMap = {};
    for (let taxon of taxIdList)
      taxonProtMap[taxon] = {};
    for (let prot of proteins.map((prot) => prot.up_id))
      taxonProtMap[baseTaxon.genome_taxid][prot] = [prot];
    for (let binding of result.results.bindings) {
      let taxon = binding.taxid.value.replace(/.*\//, '');
      let baseProt = binding.uniprot_human.value.replace(/.*\//, '');
      ;
      let taxProt = binding.uniprot.value.replace(/.*\//, '');
      if (!taxonProtMap[taxon][baseProt])
        taxonProtMap[taxon][baseProt] = [taxProt];
      else
        taxonProtMap[taxon][baseProt].push(taxProt);
      maxParalogNum = Math.max(maxParalogNum, taxonProtMap[taxon][baseProt].length);
    }

    series = taxIdList.map((taxId, i) => {
      let protMap = taxonProtMap[taxId];
      let data = proteins.map((protein, j) => {
        let up_id = protein.up_id;
        let paralogNum = protMap[up_id]?.length || 0;
        return {
          id: up_id,
          x: protein.displayedName,
          y: paralogNum,
          tooltip: `${paralogNum}: ` + (protMap[up_id] ?? '')
        };
      });
      return {
        id: taxId,
        name: mapTaxIdToTaxa[taxId].displayedName,
        data,
        cellNum: data.filter(datum => datum.y > 0).length,
        sum: data.reduce((num, datum) => num + datum.y, 0),
      };
    });

    paraNumMap = {};
    tooltipMap = {};
    for(let tax of series) {
      paraNumMap[tax.id] = {};
      tooltipMap[tax.id] = {};
      for(let prot of tax.data) {
        paraNumMap[tax.id][prot.id] = prot.y;
        tooltipMap[tax.id][prot.id] = prot.tooltip;
      }
    }

    series.sort((row1, row2) => row1.cellNum < row2.cellNum || (row1.cellNum == row2.cellNum) && row1.sum < row2.sum ? 1 : -1);
    let columnVectors = [];
    for(let i = 0; i < series[0].data.length; i++)
      columnVectors.push(series.map(elem => elem.data[i].y));
    // let mdsResult = mdsClassic(columnVectors, 1);
    // series.forEach((elem, i) => {
    //   elem.data.forEach((datum, j) => datum.position = mdsResult[j]);
    //   elem.data.sort((cell1, cell2) => cell2.position - cell1.position);
    //   elem.data.forEach((datum, j) => {
    //   })
    // });

    
    
    queryBySpang("sparql/taxonomy_tree.rq", { taxids: taxIdList.join(" ") },(res) => {
      [taxonTree, humanNode] = constructTree(res.results);
      raiseNode(humanNode);
      // taxonTree = simplifyTree(taxonTree);
      
      renderChart();
    },  endpoint);
  }, "https://orth.dbcls.jp/sparql-proxy-oma");
}

function constructDummyTree(elemList) {
  if(elemList.length === 0)
    return {};
  let rootLeaf = {
    id: elemList[0].id,
    name: elemList[0].name,
    children: [],
  }
  let rootNode = {
    children: [rootLeaf],
  };
  let currentNode = rootNode;
  for(let elem of elemList.slice(1)) {
    let newLeaf = {
      id: elem.id,
      name: elem.name,
      children: [],
    }
    let newNode = {
      children: [newLeaf],
    }
    currentNode.children.push(newNode);
    currentNode = newNode;
  }
  return rootNode;
}

/// Construct tree from result of taxonomy_tree.rq
function constructTree(result) {
  let nodeMap = {};
  let humanNode_ = null;
  for(let row of result.bindings) {
    let childId = row.taxon_int.value;
    let parentId = row.parent_int.value;
    if(!nodeMap[parentId])
      nodeMap[parentId] = {
        id: parentId,
        name: row.parent_label.value,
        children: [],
        parent: null
      };
    
    if(!nodeMap[childId])
      nodeMap[childId] = {
        id: childId,
        name: mapTaxIdToTaxa[childId]?.displayedName,
        children: [],
        parent: null
      };
    
    nodeMap[parentId].children.push(nodeMap[childId]);
    nodeMap[childId].parent = nodeMap[parentId];
    if(childId === '9606'){
      humanNode_ = nodeMap[childId];
    }
  }
  if(nodeMap.length === 0)
    return null;
  let root = nodeMap[Object.keys(nodeMap)[0]];
  while(root.parent) {
     root = root.parent;
  }
  return [root, humanNode_];
}

/// Create simple tree for dendrogram that includes only branches and leaves 
function simplifyTree(node) {
  if(node.children.length === 1)
    return simplifyTree(node.children[0]);
  else {
    let simplifiedChildren = [];
    for(let child of node.children) {
      simplifiedChildren.push(simplifyTree(child));
    }
    node.children = simplifiedChildren;
    return node;
  }
}

// Raise subtree including the specified node to be the first child for each parent node
function raiseNode(node) {
  let parent = node.parent;
  if(parent) {
    if(parent.children.length > 0 && parent.children[0] !== node) {
      let index = parent.children.indexOf(node);
      if(index >= 0) {
        parent.children[index] = parent.children[0];
        parent.children[0] = node;
      }
    }
    raiseNode(parent);
  }
}

function orderedLeaves(tree) {
  if(!tree.children || tree.children.length === 0)
    return [tree];
  else {
    let nodes = [];
    for(let child of tree.children) {
      nodes = nodes.concat(orderedLeaves(child));
    }
    return nodes;
  }
}

function renderChart() {
  let options = {
    series,
    chart: {
      height: 350,
      type: 'heatmap',
    },
    dataLabels: {
      enabled: false
    },
    plotOptions: {
      heatmap: {
        colorScale: {
          ranges: [
            {
              from: 0,
              to: 0,
              name: ' ',
              color: '#FFFFFF'
            },
            {
              from: 1,
              to: maxParalogNum,
              name: ' ',
              color: '#008FFB'
            },
          ]
        },
      }
    },
    title: {
      text: `Orthology Map from ${$('#database-select').val()}`
    },
    legend: {
      show: false,
      inverseOrder: true
    },
    xaxis: {
      position: 'top',
      labels: {
        rotate: -90
      },
    },
    yaxis: {
      reversed: true
    },
    // tooltip: {
    //   custom: function ({series, seriesIndex, dataPointIndex, w}) {
    //     let tips = tooltips[seriesIndex][dataPointIndex];
    //     if (!tips)
    //       return '';
    //     return '<div class="arrow_box">' +
    //       '<span>' + tips.join('<br>') + '</span>' +
    //       '</div>';
    //   },
    // }
  };
  chart = new ApexCharts(document.querySelector("#chart"), options);
  $('#loader-container').hide();
  $('#chart').show();
  chart.render();

  tippy('.apexcharts-xaxis-label', {
    content: (elem) => {
      let displayedName = elem.getElementsByTagName('title')?.[0].innerHTML;
      let data = mapDisplayedNameToProtein[displayedName];
      let tip = "<ui>";
      for (let [key, val] of Object.entries(data)) {
        tip += `<li>${key}: ${val}</\li>`;
      }
      tip += "</ui>";
      return tip;
    },
    allowHTML: true
  });

  tippy('.apexcharts-yaxis-label', {
    content: (elem) => {
      let organismName = elem.getElementsByTagName('title')?.[0].innerHTML;
      let data = mapNameToTaxa[organismName];
      if (!data)
        return '';
      let tip = "<ui>";
      for (let [key, val] of Object.entries(data)) {
        tip += `<li>${key}: ${val}</\li>`;
      }
      tip += "</ui>";
      return tip;
    },
    allowHTML: true
  });
  
  let columnVectors = [];
  for(let i = 0; i < series[0].data.length; i++) {
    let values = series.map(elem => elem.data[i].y);
    columnVectors.push({
      val: values,
      name: series[0].data[i].x,
      id: series[0].data[i].id,
      cellNum: values.filter((y) => y > 0).length,
      sum: values.reduce((a, b) => a + b),
    });
  }
  let dataForD3 = {};
  columnVectors.sort((col1, col2) => col1.cellNum < col2.cellNum || (col1.cellNum == col2.cellNum) && col1.sum < col2.sum ? 1 : -1);

  if(hOrderedByCellNum) {
    dataForD3.colJSON = constructDummyTree(columnVectors);
  } else {
    let cluster = hcluster().distance('euclidean').linkage('avg').posKey('val').data(columnVectors);
    dataForD3.colJSON = cluster.tree();
  }
  let orderedProteins = orderedLeaves(dataForD3.colJSON);

  if(vOrderedByCellNum) {
    dataForD3.rowJSON = constructDummyTree(series);
  } else {
    dataForD3.rowJSON = taxonTree;
  }
  let orderedTaxons = orderedLeaves(dataForD3.rowJSON);
  
  matrix = [];
  
  tooltips = {};
  orderedTaxons.forEach((tax, j) => {
    let row = [];
    tooltips[j] = {};
    orderedProteins.forEach((prot, i) => {
      row.push( paraNumMap[tax.id][prot.id] );
      tooltips[j][i] = tooltipMap[tax.id][prot.id];
    });
    matrix.push(row);
  });
  dataForD3.matrix = matrix;
  
  d3.heatmapDendro(dataForD3, "#heatmap", !hOrderedByCellNum, !vOrderedByCellNum);
  showDbpediaImage(comparedTaxa);
}



$(() => {
  window.addEventListener('resize', (event) => {
    renderChart();
  }, true);

  $('#h-order-select').change((e) => {
    hOrderedByCellNum = e.target.value === "cell";
    UpdateChart();
  });
  
  $('#v-order-select').change((e) => {
    vOrderedByCellNum = e.target.value === "cell";
    UpdateChart();
  });
  UpdateChart();
});


function dbpedia_uri(taxonName) {
  if (taxonName == 'Chania'
    || taxonName == 'Nitrososphaeria'
    || taxonName == 'Candidatus Korarchaeum cryptofilum') {
    return;
  } else if (taxonName == 'Proteus') {
    return {name: 'Proteus_(bacterium)', uri: '<http://dbpedia.org/resource/Proteus_(bacterium)>'};
  } else if (taxonName == 'Pan') {
    return {name: 'Pan_(genus)', uri: '<http://dbpedia.org/resource/Pan_(genus)>'};
  }


  let matched = taxonName.match(/^[^\(]+/);
  if(matched)
    taxonName = matched[0].trim();

  let dbpedia_name = taxonName
    .replace(/\s/g, '_')
    .replace(/^Candidatus_/, '')
    .replace(/\//g, '_')
    .replace(/'/g, '')
    .replace(/\(/g, '_').replace(/\)/g, '_')
    .replace(/\[/g, '').replace(/\]/g, '');

  return 'dbpedia:' + dbpedia_name;
}

function showDbpediaImage(taxa) {
  taxa.forEach((taxon) => {
    if(mapTaxIdToThumbnail[taxon.genome_taxid]) {
      document.getElementById(`row-image-${taxon.displayedName}`).setAttribute('href', mapTaxIdToThumbnail[taxon.genome_taxid]);
    } else {
      queryBySpang(`sparql/dbpedia_thumbnails.rq`, {
          taxon: dbpedia_uri(taxon.organism_name),
        }, (res) => {
          let thumbnailUri = res.results.bindings[0]?.image.value;
          document.getElementById(`row-image-${taxon.displayedName}`).setAttribute('href', thumbnailUri);
          mapTaxIdToThumbnail[taxon.genome_taxid] = thumbnailUri;  
        }, dbpediaEndpoint
      )
    }
  })
}