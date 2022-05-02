const dbpedia_endpoint = 'https://dbpedia.org/sparql';
const endpoint = 'https://orth.dbcls.jp/sparql-dev';

Storage.prototype.setObject = function(key, value) {
  this.setItem(key, JSON.stringify(value));
}

Storage.prototype.getObject = function(key) {
  return JSON.parse(this.getItem(key));
}

let selectedTaxa = localStorage.getObject('selectedTaxa') || {};
let selectedProteins = localStorage.getObject('selectedProteins') || {};

function queryBySpang(queryUrl, target_end, param, callback) {
  spang.proxy = 'https://spang.dbcls.jp/sparql-proxy';
  $.get(queryUrl, (query) => {
    spang.query(query, target_end ? target_end : endpoint, { param: param, format: 'json'}, (error, status, result) => {
      let data;
      try {
        data = JSON.parse(result);
      } catch (e) {
        console.log(e);
        data = {
          results: { bindings: {} }
        };
      }
      callback(data);
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
    let cache = mapTaxIdToThumbnail[taxon.genome_taxid];
    if(cache !== undefined) {
      $(`.row-image-${taxon.up_id}`).each(function() { this.setAttribute('href', cache) });
      $(`.image-${taxon.up_id}`).prop('src', cache);
    } else {
      queryBySpang(`sparql/dbpedia_thumbnails.rq`, dbpedia_endpoint, { taxon: dbpedia_uri(taxon.organism_name) }, (res) => {
        let thumbnailUri = res.results.bindings[0]?.image.value;
        if(thumbnailUri) {
          $(`.row-image-${taxon.up_id}`).each(function() { this.setAttribute('href', thumbnailUri) });
          $(`.image-${taxon.up_id}`).prop('src', thumbnailUri);
        }
        mapTaxIdToThumbnail[taxon.genome_taxid] = thumbnailUri ?? '';
      });
    }
  });
}

$(document).on('mouseover', '.table-image', (e) => {
  let rect = e.target.getBoundingClientRect();
  showTooltipImage(window.scrollX + rect.right, window.scrollY + rect.bottom, $(e.target).data('title'), e.target.getAttribute('src'))
});

$(document).on('mouseout', '.table-image', (e) => {
  hideTooltip(e.target);
});

$(document).on('click', '#clear-btn', (e) => {
  if(confirm("Really clear all your selections?")) {
    localStorage.removeItem('selectedTaxa');
    localStorage.removeItem('selectedProteins');

    sessionStorage.removeItem('srcDB')
    localStorage.removeItem('srcDB');
    localStorage.removeItem('showCellNumber');
    localStorage.removeItem('horizontalOrder');
    localStorage.removeItem('verticalOrder');
    window.location.reload();
  }
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
    y = window.innerHeight + window.scrollY - height - 50;
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

$.tablesorter.addParser({
  id: "fancyNumber",
  is: function(s) {
    return /^[0-9]?[0-9,\.]*$/.test(s);
  },
  format: function(s) {
    return $.tablesorter.formatFloat(s.replace(/,/g, ''));
  },
  type: "numeric"
});
