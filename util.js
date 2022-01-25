const dbpedia_endpoint = 'https://dbpedia.org/sparql';
const endpoint = 'https://orth.dbcls.jp/sparql-proxy';


Storage.prototype.setObject = function(key, value) {
  this.setItem(key, JSON.stringify(value));
}

Storage.prototype.getObject = function(key) {
  return JSON.parse(this.getItem(key));
}

let selectedTaxa = localStorage.getObject('selectedTaxa') || {};
let selectedProteins = localStorage.getObject('selectedProteins') || {};

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

let mapTaxIdToThumbnail = {};

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
    if(mapTaxIdToThumbnail[taxon.genome_taxid] !== undefined) {
      document.getElementById(`row-image-${taxon.up_id}`)?.setAttribute('href', mapTaxIdToThumbnail[taxon.genome_taxid]);
      document.getElementById(`image-${taxon.up_id}`)?.setAttribute('src', mapTaxIdToThumbnail[taxon.genome_taxid]);
    } else {
      queryBySpang(`sparql/dbpedia_thumbnails.rq`, {
          taxon: dbpedia_uri(taxon.organism_name),
        }, (res) => {
          let thumbnailUri = res.results.bindings[0]?.image.value;
          if(thumbnailUri) {
            document.getElementById(`row-image-${taxon.up_id}`)?.setAttribute('href', thumbnailUri);
            document.getElementById(`image-${taxon.up_id}`)?.setAttribute('src', thumbnailUri);
          }
          mapTaxIdToThumbnail[taxon.genome_taxid] = thumbnailUri ?? '';
        }, dbpedia_endpoint
      )
    }
  })
}

$(document).on('mouseover', '.table-image', (e) => {
  let rect = e.target.getBoundingClientRect();
  console.log(rect);
  showTooltipImage(window.scrollX + rect.right, window.scrollY + rect.bottom, $(e.target).data('title'), e.target.getAttribute('src'))
});

$(document).on('mouseout', '.table-image', (e) => {
  hideTooltip(e.target);
});


function hideTooltip(target) {
  d3.select(target).classed("cell-hover", false);
  d3.selectAll(".rowLabel").classed("text-highlight", false);
  d3.selectAll(".colLabel").classed("text-highlight", false);
  d3.select("#d3tooltip").transition()
    .duration(200)
    .style("opacity", 0);
}

function showTooltipImage(x, y, label, src) {
  let height = 300;
  if(y + height > window.innerHeight + window.scrollY) {
    y = window.innerHeight + window.scrollY - height;
  }
  d3.select("#d3tooltip")
    .style("left", (x + 10) + "px")
    .style("top", (y - 10) + "px")
    .select("#value")
    .html(`${label}<br><img height="${height}" width="auto" src="${src}">`);
  // //Show the tooltip
  d3.select("#d3tooltip").transition()
    .duration(200)
    .style("opacity", .9);
}

function updateSelectedCount() {
  $("#selected-proteome-label").html(`<b>${Object.keys(selectedTaxa).length}</b> proteomes`);
  $("#selected-protein-label").html(`<b>${Object.keys(selectedProteins).length}</b> proteins`);
}