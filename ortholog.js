const endpoint = 'https://orth.dbcls.jp/sparql-proxy';

const taxonPrefix = "taxonomy-browser-proteome-";
const proteinPrefix = 'go-browser-protein-';


let chart = null;

let baseTaxon = '9606';
let comparedTaxa = [];
let proteins = [];
let tooltips = {};
let series = null;

let maxParalogNum = 0;
let savedTaxonData = {}, savedProteinData = {};

Storage.prototype.getObject = function(key) {
  let val = this.getItem(key);
  return val && JSON.parse(val) || {};
}


for (let i = 0; i < localStorage.length; i++) {
  let key = localStorage.key(i);
  if (key.startsWith(taxonPrefix)) {
    let taxonId = localStorage.getObject(key)?.genome_taxid;
    if(taxonId) {
      comparedTaxa.push(taxonId);
      savedTaxonData[taxonId] = localStorage.getObject(key);
    }
  } else if(key.startsWith(proteinPrefix)) {
    let uniprotId = localStorage.getObject(key)?.up_id;
    if(uniprotId) {
      proteins.push(uniprotId);
      savedProteinData[uniprotId] = localStorage.getObject(key);
    }
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
  maxParalogNum = 0;
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
    maxParalogNum = Math.max(maxParalogNum, taxonProtMap[taxon][baseProt].length);
  }
  
  tooltips = {};
  series = taxa.map((taxon, i) => {
    let protMap = taxonProtMap[taxon];
    return {
        name: taxon,
        data: proteins.map((protein, j) => {
          let paralogNum = protMap[protein]?.length || 0;
          if(!tooltips[i])
            tooltips[i] = {};
          tooltips[i][j] = protMap[protein] ?? '';
          return {
          x: protein,
          y: paralogNum 
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
  if (chart)
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
            // {
            //   from: max / 3,
            //   to: max * 2 / 3,
            //   name: ' ',
            //   color: '#FF8F00'
            // },
            // {
            //   from: max * 2 / 3,
            //   to: max,
            //   name: ' ',
            //   color: '#FF2200'
            // },
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
      position: 'top'
    },
    yaxis: {
      reversed: true
    },
    tooltip: {
      custom: function ({series, seriesIndex, dataPointIndex, w}) {
        let tips = tooltips[seriesIndex][dataPointIndex];
        if (!tips)
          return '';
        return '<div class="arrow_box">' +
          '<span>' + tips.join('<br>') + '</span>' +
          '</div>';
      },
    }
  };
  chart = new ApexCharts(document.querySelector("#chart"), options);
  chart.render();

  tippy('.apexcharts-xaxis-label', {
    content: (elem) => {
      let protId = elem.getElementsByTagName('title')?.[0].innerHTML;
      let data = savedProteinData[protId];
      let tip = "<ui>";
      for(let [key, val] of Object.entries(data)) {
        tip += `<li>${key}: ${val}</\li>`;
      }
      tip += "</ui>";
      return tip;
    },
    allowHTML: true
  });
}