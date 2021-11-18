const endpoint = 'https://orth.dbcls.jp/sparql-proxy';

const taxonPrefix = "taxonomy-browser-proteome-";
const proteinPrefix = 'go-browser-protein-';


let chart = null;

let baseTaxon = '9606';
let comparedTaxa = [];
let proteins = [];
let tooltips = {};
let series = null;


Storage.prototype.getObject = function(key) {
  let val = this.getItem(key);
  return val && JSON.parse(val) || {};
}


for (let i = 0; i < localStorage.length; i++) {
  let key = localStorage.key(i);
  if (key.startsWith(taxonPrefix)) {
    let taxonId = localStorage.getObject(key)?.genome_taxid;
    if(taxonId)
      comparedTaxa.push(taxonId);
  } else if(key.startsWith(proteinPrefix)) {
    let uniprotId = localStorage.getObject(key)?.up_id;
    if(uniprotId)
      proteins.push(uniprotId);
  }
}

function queryBySpang(queryUrl, param, callback, target_end = null) {
  $.get(queryUrl, (query) => {
    spang.query(query, target_end ? target_end : endpoint, {param: param, format: 'json'}, (error, status, result) => {
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

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}


$('#database-select').on('change', () => {
  renderChart();
});

queryBySpang("sparql/matrix.rq", { taxa: comparedTaxa.map((taxon) => 'upTax:' + taxon).join(' '),
                                                  proteins: proteins.map((protein) => 'uniprot:' + protein).join(' ')
                                                }, (result) => {
  let taxa = [baseTaxon].concat(comparedTaxa);
  let taxonProtMap = {};
  for(let taxon of taxa)
    taxonProtMap[taxon] = {};
  for(let prot of proteins) 
    taxonProtMap[baseTaxon][prot] = [prot];
  for(let binding of result.results.bindings) {
    let taxon = binding.taxid.value.replace(/.*\//, '');
    let baseProt = binding.uniprot_human.value.replace(/.*\//, '');;
    let taxProt = binding.uniprot.value.replace(/.*\//, '');
    if(!taxonProtMap[taxon][baseProt])
      taxonProtMap[taxon][baseProt] = [taxProt];
    else
      taxonProtMap[taxon][baseProt].push(taxProt);
  }
  
  tooltips = {};
  series = taxa.map((taxon, i) => {
    let protMap = taxonProtMap[taxon];
    return {
      name: taxon,
      data: proteins.map((protein, j) => {
        if(!tooltips[i])
          tooltips[i] = {};
        tooltips[i][j] = protMap[protein] ?? '';
        return {
        x: protein,
        y: protMap[protein]?.length || 0
      };
      })
    }
  });
  renderChart();
}, "https://orth.dbcls.jp/sparql-proxy-oma");

for (var i=0; i<localStorage.length; i++) {
  var key = localStorage.key(i);
  if (key.startsWith('UP0')) {
    taxa.push(key);
  }
}

function renderChart() {
  if(chart)
    chart.destroy();
  let options = {
    series,
    chart: {
      height: 350,
      type: 'heatmap',
    },
    dataLabels: {
      enabled: false
    },
    colors: ["#008FFB"],
    title: {
      text: `Orthology Map from ${$('#database-select').val()}`
    },
    legend: {
      inverseOrder: true
    },
    xaxis: {
      position: 'top'
    },
    yaxis: {
      reversed: true
    },
    tooltip: {
      custom: function({series, seriesIndex, dataPointIndex, w}) {
        return '<div class="arrow_box">' +
          '<span>' + tooltips[seriesIndex][dataPointIndex].join(', ') + '</span>' +
          '</div>'
      }
    }
  };

  chart = new ApexCharts(document.querySelector("#chart"), options);
  chart.render();
}