const endpoint = 'https://orth.dbcls.jp/sparql-proxy';
const dbpediaEndpoint = 'https://dbpedia.org/sparql';

const taxonPrefix = "taxonomy-browser-proteome-";
const proteinPrefix = 'go-browser-protein-';

let comparedTaxa = [];

Storage.prototype.setObject = function(key, value) {
  this.setItem(key, JSON.stringify(value));
}


Storage.prototype.getObject = function(key) {
  return JSON.parse(this.getItem(key));
}

const urlParams = new URLSearchParams(window.location.search);
let taxaUPIds = urlParams.getAll('taxaUPIds');
let proteinUPIds = urlParams.getAll('proteinUPIds');
if(urlParams.has('taxaUPIds') && urlParams.has('proteinUPIds')) {
  taxaUPIds = urlParams.getAll('taxaUPIds');
  proteinUPIds = urlParams.getAll('proteinUPIds');
  localStorage.setObject('taxaUPIds', taxaUPIds);
  localStorage.setObject('proteinUPIds', proteinUPIds);
  window.location.href = window.location.href.split('?')[0]; // Jump to URL without query parameter
}

taxaUPIds = localStorage.getObject('taxaUPIds');
proteinUPIds = localStorage.getObject('proteinUPIds');


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
  tooltips = {};
  series = null;

  maxParalogNum = 0;
  mapDisplayedNameToProtein = {};

  mapNameToTaxa[baseTaxon.displayedName] = baseTaxon;
  mapTaxIdToTaxa[baseTaxon.genome_taxid] = baseTaxon;
  
  $('#heatmap').hide();
  $('#loader-container').show();
  
  proteins.sort((protein1, protein2) => protein1.mnemonic < protein2.mnemonic ? -1 : 1);
  
  if(proteins.length === 0 || comparedTaxa.length === 0) {
    $('#loader-container').hide();
    $('#heatmap').show();
    $('#heatmap')[0].innerText = "No candidates selected";
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
  $('#loader-container').hide();
  $('#heatmap').show();
  
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
  showDbpediaImage([baseTaxon]);
}



$(() => {
  window.addEventListener('resize', (event) => {
    renderChart();
  }, true);

  if(localStorage.getItem('h-order'))
    $('#h-order-select').val(localStorage.getItem('h-order'));
  if(localStorage.getItem('v-order'))
    $('#v-order-select').val(localStorage.getItem('v-order'));
  hOrderedByCellNum = $('#h-order-select').val() === "cell";
  vOrderedByCellNum = $('#v-order-select').val() === "cell";

  $('#h-order-select').change((e) => {
    hOrderedByCellNum = e.target.value === "cell";
    localStorage.setItem('h-order', e.target.value);
    UpdateChart();
  });
  
  $('#v-order-select').change((e) => {
    vOrderedByCellNum = e.target.value === "cell";
    localStorage.setItem('v-order', e.target.value);
    UpdateChart();
  });

  queryBySpang(`sparql/search_genomes_for_values.rq`,
    { values: taxaUPIds.map((id) => `(proteome:${id})`).join(' ') },
    function (data) {
      let data_p = data['results']['bindings'];
      for (let i = 0; i < data_p.length; i++) {
        let row = data_p[i];
        row['taxid']['value'].match(/(\d+)$/);
        const genome_taxid = RegExp.$1;
        const up_id_url = row['proteome']['value'];
        const up_id = row['proteome']['value'].replace(/.*\//, '');
        const types = row['types']['value'];
        const organism_name = row['organism']['value'];
        const n_genes = parseInt(row['proteins']['value']);
        const n_isoforms = parseInt(row['isoforms']['value']);
        const cpd_label = row['cpd_label']['value'];
        const busco_complete = row['busco_complete'] ? row['busco_complete']['value'] : '';
        const busco_single = row['busco_single'] ? row['busco_single']['value'] : '';
        const busco_multi = row['busco_multi'] ? row['busco_multi']['value'] : '';
        const busco_fragmented = row['busco_fragmented'] ? row['busco_fragmented']['value'] : '';
        const busco_missing = row['busco_missing'] ? row['busco_missing']['value'] : '';
        const assembly = row['assembly'] ? row['assembly']['value'] : '';
        let entry = {
          genome_taxid,
          up_id_url,
          up_id,
          types,
          organism_name,
          n_genes,
          n_isoforms,
          cpd_label,
          busco_complete,
          busco_single,
          busco_multi,
          busco_fragmented,
          busco_missing,
          assembly
        };
        if(entry.organism_name.includes("(")) {
          let matched = entry.organism_name.match(/^[^\(]+\(([^\)]+)\)/);
          if(matched)
            entry.displayedName = matched[1];
        }
        entry.displayedName = entry.displayedName || entry.organism_name;
        // comparedTaxa.push(entry);
        mapNameToTaxa[entry.displayedName] = entry;
        mapTaxIdToTaxa[genome_taxid] = entry;
        comparedTaxa.push(entry);
      }

      queryBySpang(`sparql/goid_to_search_proteins.rq`,
        { values: proteinUPIds.map((id) => `(uniprot:${id})`).join(' ') },
        function (data) {
          console.log(data.results.bindings);
          let bindings = data['results']['bindings'];
          for (let i = 0; i < bindings.length; i++) {
            let row = bindings[i];
            row['protein']['value'].match(/(\d+)$/);
            const up_id_url = row['protein']['value'];
            const up_id = row['protein']['value'].replace(/.*\//, '');
            const mnemonic = row['mnemonic']['value'];
            const full_name = row['full_name']['value'];
            const map = row['map']['value'];
            let entry = {
              up_id_url,
              up_id,
              mnemonic,
              full_name,
              map
            };
            proteins.push(entry);
            if (!mapMnemonicToProteins[entry.mnemonic])
              mapMnemonicToProteins[entry.mnemonic] = [];
            mapMnemonicToProteins[entry.mnemonic].push(entry);
          }
          console.log(proteins);
          UpdateChart();
        }
      );
      show_genomes([baseTaxon].concat(comparedTaxa));
    });
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