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

function generateData(count, yrange) {
  var i = 0;
  var series = [];
  var labels = ['Q92887', 'P10323', 'P15234', 'Q9UK85', 'Q99645'];
  while (i < 5) {
    var x = labels[i];
    var y = Math.floor(Math.random() * (yrange.max - yrange.min + 1)) + yrange.min;
    series.push({
      x: x,
      y: y
    });
    i++;
  }
  return series;
}

let chart = null;


let taxa = [];
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
  series = taxa.map((taxon) => {
    let protMap = taxonProtMap[taxon];
    return {
      name: taxon,
      data: baseProteins.map((baseProt) => { return {
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
    }
  };

  chart = new ApexCharts(document.querySelector("#chart"), options);
  chart.render();
}