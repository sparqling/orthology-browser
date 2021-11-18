let haystack = [];
let currentTaxonName = null;
let scientificNameMap = {}; // Display name => Scientific name
let displayNameMap = {}; // Scientific name => Display name

const endpoint = 'https://orth.dbcls.jp/sparql-proxy';


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

let chart = null;

let taxa = [];
let tooltips = {};
let series = null;

queryBySpang("sparql/matrix.rq", {}, (result) => {
  let baseTaxon = '9606';
  taxa = [baseTaxon, '9595', '9598'];
  let baseProteins = ['P78563', 'Q6UY14'];
  let taxonProtMap = {};
  for(let taxon of taxa)
    taxonProtMap[taxon] = {};
  for(let prot of baseProteins) 
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
      data: baseProteins.map((baseProt, j) => {
        if(!tooltips[i])
          tooltips[i] = {};
        tooltips[i][j] = protMap[baseProt] ?? '';
        return {
        x: baseProt,
        y: protMap[baseProt]?.length
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

series = taxa.map((taxon) => {
  return {
    name: taxon,
    data: generateData(18, {
      min: 0,
      max: 90
    })
  };
});

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