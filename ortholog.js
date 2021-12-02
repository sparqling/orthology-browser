const endpoint = 'https://orth.dbcls.jp/sparql-proxy';

const taxonPrefix = "taxonomy-browser-proteome-";
const proteinPrefix = 'go-browser-protein-';


let chart = null;

let baseTaxon =  {
  genome_taxid:"9606",
  up_id_url:"http://purl.uniprot.org/proteomes/UP000005640",
  up_id:"UP000005640",
  types:"http://purl.uniprot.org/core/Proteome, http://purl.uniprot.org/core/Reference_Proteome, http://purl.uniprot.org/core/Representative_Proteome",
  organism_name:"Homo sapiens (Human)",
  displayedName:"Human",
  n_genes:20596,
  n_isoforms:76225,
  cpd_label:"Outlier",
  busco_complete:"6163",
  busco_single:"2364",
  busco_multi:"3799",
  busco_fragmented:"12",
  busco_missing:"17",
  assembly:"GCA_000001405.27"
};
let comparedTaxa = [];
let proteins = [];
let tooltips = {};
let series = null;

let maxParalogNum = 0;
let mapNameToTaxa = {}, mapTaxIdToTaxa = {},
  mapMnemonicToProteins = {};
  mapDisplayedNameToProtein = {};

mapNameToTaxa[baseTaxon.displayedName] = baseTaxon;
mapTaxIdToTaxa[baseTaxon.genome_taxid] = baseTaxon;

Storage.prototype.getObject = function(key) {
  let val = this.getItem(key);
  return val && JSON.parse(val) || {};
}

for (let i = 0; i < localStorage.length; i++) {
  let key = localStorage.key(i);
  if (key.startsWith(taxonPrefix)) {
    let taxonId = localStorage.getObject(key)?.genome_taxid;
    if(taxonId && taxonId !== baseTaxon.genome_taxid) {
      let entry = localStorage.getObject(key);
      entry.displayedName = entry.organism_name.replaceAll(/^.*\((.*)\)/g, '$1');
      comparedTaxa.push(entry);
      mapNameToTaxa[entry.displayedName] = entry;
      mapTaxIdToTaxa[taxonId] = entry;
    }
  } else if(key.startsWith(proteinPrefix)) {
    let entry = localStorage.getObject(key);
    proteins.push(entry);
    if(!mapMnemonicToProteins[entry.mnemonic])
      mapMnemonicToProteins[entry.mnemonic] = [];
    mapMnemonicToProteins[entry.mnemonic].push(entry);
  }
}

// Assign unique displayed name to avoid conflict
for(let [mnemonic, proteins] of Object.entries(mapMnemonicToProteins)) {
  if(proteins.length === 1) {
    proteins[0].displayedName = mnemonic;
    mapDisplayedNameToProtein[mnemonic] = proteins[0];
  } else {
    for(let protein of proteins) {
      protein.displayedName = `${mnemonic} (${protein.up_id})`;
      mapDisplayedNameToProtein[protein.displayedName] = protein;
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

queryBySpang("sparql/matrix.rq", { taxa: comparedTaxa.map((taxon) => 'upTax:' + taxon.genome_taxid).join(' '),
                                                  proteins: proteins.map((protein) => 'uniprot:' + protein.up_id).join(' ')
                                                }, (result) => {
  maxParalogNum = 0;
  let taxIdList = [baseTaxon.genome_taxid].concat(comparedTaxa.map((taxon) => taxon.genome_taxid));
  let taxonProtMap = {};
  for(let taxon of taxIdList)
    taxonProtMap[taxon] = {};
  for(let prot of proteins.map((prot) => prot.up_id)) 
    taxonProtMap[baseTaxon.genome_taxid][prot] = [prot];
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
  series = taxIdList.map((taxId, i) => {
    let protMap = taxonProtMap[taxId];
    return {
      name: mapTaxIdToTaxa[taxId].displayedName,
      data: proteins.map((protein, j) => {
        let up_id = protein.up_id;
        let paralogNum = protMap[up_id]?.length || 0;
        if(!tooltips[i])
          tooltips[i] = {};
        tooltips[i][j] = protMap[up_id] ?? '';
        return {
          x: protein.displayedName,
          y: paralogNum 
        };
     })
    }
  });
  renderChart();
}, "https://orth.dbcls.jp/sparql-proxy-oma");

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
      let displayedName = elem.getElementsByTagName('title')?.[0].innerHTML;
      let data = mapDisplayedNameToProtein[displayedName];
      let tip = "<ui>";
      for(let [key, val] of Object.entries(data)) {
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
      if(!data)
        return '';
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