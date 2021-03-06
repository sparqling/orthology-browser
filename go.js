let candidates = [];
let currentName = null;
let scientificNameMap = {}; // Display name => Scientific name
let displayNameMap = {}; // Scientific name => Display name

let currentProteinMap = {};

let sparqlDir = 'sparql/go';
let commonSparqlDir = 'sparql/';

Storage.prototype.setObject = function(key, value) {
  this.setItem(key, JSON.stringify(value));
}

Storage.prototype.getObject = function(key) {
  return JSON.parse(this.getItem(key));
}


function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}

function init() {
  candidates = [];
  $.ajaxSetup({async: false});

  queryBySpang(`${sparqlDir}/get_term_as_candidates.rq`, null, {}, (data) => {
    scientificNameMap = {};
    for (let binding of data.results.bindings) {
      let entry = binding.name.value;
      // if (binding.commonName?.value) {
      //   entry += ` (${binding.commonName.value})`;
      //   scientificNameMap[entry] = binding.name.value;
      //   displayNameMap[binding.name.value] = entry;
      // }
      candidates.push(entry);
    }
  });

  $('#tags').focus();
}


$(function () {
  $('#tags').autocomplete({
    source: (request, response) => {
      // Forward match
      const maxLength = 100;
      let match = $.grep(candidates, (value) => {
        let regexp = new RegExp('^' + escapeRegExp(request.term), 'i');
        return value.match(regexp);
      }).slice(0, maxLength)

      if(match.length < maxLength) {
        // Match from the space
        match = match.concat($.grep(candidates, (value) => {
          let regexp = new RegExp('\\b' + escapeRegExp(request.term), 'i');
          return value.match(regexp);
        }).slice(0, maxLength));
        match = Array.from(new Set(match)); // Remove duplicate entries
      }
      response(match);
    },
    autoFocus: true,
    delay: 100,
    minLength: 1,
    select: (e, ui) => {
      if (ui.item) {
        show_contents(ui.item['label']);
      }
    }
  });

  // Type slash to focus on the text box
  $(document).keyup((e) => {
    if ($(':focus').attr('id') !== 'tags' && e.keyCode === 191) {
      $('#tags').focus().seletc();
    }
  });

  $(document).keyup((e) => {
    if ($(':focus').attr('id') === 'tags' && e.keyCode === 13) {
      let taxon_name = $('#tags').val();
      if (taxon_name) {
        show_contents(taxon_name);
      }
    }
  });

  // Select a taxon name
  $('#go_div').on('mouseover', '.taxon_clickable', function (e) {
    $(this).css('background-color', '#e3e3e3');
    // $(this).siblings().css('background-color','#f5f5f5');
    $(this).siblings().css('background-color', '#f0f0f0');
  }).on('mouseout', '.taxon_clickable', function (e) {
    $(this).css('background-color', '#fff');
    $(this).siblings().css('background-color', '#fff');
  }).on('click', '.taxon_clickable', function (e) {
    let taxon_name = $(this).text().trim();
    if (taxon_name.startsWith('-') || taxon_name.startsWith('+')) {
      taxon_name = taxon_name.substring(1).trim();
    }
    if (taxon_name) {
      $('#tags').val(displayNameMap[taxon_name] || taxon_name);
      show_contents(taxon_name);
      $('#tags').focus();
    }
  });

  // Select a taxonomic rank
  $('#go_div').on('mouseover', '.rank_clickable', function (e) {
    // $(this).parent().find('td').css('background-color','#f5f5f5');
    $(this).parent().find('td').css('background-color', '#f0f0f0');
    $(this).parent().find('td:nth-child(2)').css('background-color', '#e3e3e3');
  }).on('mouseout', '.rank_clickable', function (e) {
    $(this).parent().find('td').css('background-color', '#fff');
  }).on('click', '.rank_clickable', function (e) {
    let taxon_name = $(this).parent().find('td:nth-child(2)').text();
    if (taxon_name) {
      $('#tags').val(displayNameMap[taxon_name] || taxon_name);
      show_contents(taxon_name);
      $('#tags').focus();
    }
  });

  $(document).on('mouseover', '#details .genome_name', function (e) {
    $(this).parent().find('td').css('background-color', '#f0f0f0');
    $(this).css('background-color', '#e3e3e3');
  });
  $(document).on('mouseout', '#details .genome_name', function (e) {
    $(this).parent().find('td').css('background-color', '#fff');
  });

  // Manipulate the genome "cart"
  $(document).on('click', '.add_protein', function () {
    let this_row = $(this).closest('tr');
    // Selected item
    let selected = $(this).prop("checked");
    let protein_id = this_row.find('td.protein-id-td').text();
    // let orgname = this_row.find('td:nth-child(7)').text();

    if(selected) {
      // Add the item
      selectedProteins[protein_id] = currentProteinMap[protein_id];
    }
    else {
      // Delete the item
      delete selectedProteins[protein_id];
    }
    localStorage.setObject('selectedProteins', selectedProteins);

    updateSelected();
  });

  $(document).on('click', '.add_protein_all', function () {
    // Swith the icon
    let selected = $(this).prop("checked");
    let table = $(this).closest('table');
    $('.add_protein', table).each((i, each_checkbox) => {
      let each_row = $(each_checkbox).closest('tr');
      // Eech item
      let protein_id = each_row.find('td.protein-id-td').text();
      // let orgname = each_row.find('td:nth-child(7)').text();
      if (selected) {
        // Add the item
        selectedProteins[protein_id] = currentProteinMap[protein_id];
        $(each_checkbox).prop("checked", true);
      } else {
        // Delete the item
        delete selectedProteins[protein_id];
        $(each_checkbox).prop("checked", false);
      }
    });
    localStorage.setObject('selectedProteins', selectedProteins);
    updateSelected();
  });
});

function clear_tables() {
  $('#result-area').hide();
}

function show_contents(name, display_name = null, push_state = true) {
  display_name = display_name || name;
  name = scientificNameMap[name] || name;
  if (currentName === name)
    return;
  currentName = name;

  let lang = document.querySelector('#language-selector').value;

  // Get tax ID
  let taxid;
  let rank;

  if (push_state)
    history.pushState({name, display_name}, name, `?name=${name}&display_name=${display_name}`)

  queryBySpang(`${sparqlDir}/name_to_goid.rq`, null, {name}, (data) => {
    data['results']['bindings'][0]['goid']['value'].match(/(\d+)$/);
    goid = RegExp.$1;
    // rank = data['results']['bindings'][0]['rank']['value'].replace(/.*\//, '');

    // Show tables
    show_hierarchy(goid, lang);
    show_dbpedia(name, goid, lang);
    // show_genome_comparison(goid);
    // show_specific_genes(goid);
    show_protein_list(name, goid);
    // Show main taxon name
    let html = `<h3><i>${name}</i> (GO ID: ${goid})</h3>`;
    $('#main_taxon_name_div').html(html);
  });
  
  $('#result-area').show();
}

function capitalizeFirstLetter(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

function dbpedia_name(taxon_name) {
  let dbpedia_name = capitalizeFirstLetter(taxon_name
    .replace(/\s/g, '_')
    .replace(/^Candidatus_/, '')
    .replace(/,/g, '_')
    .replace(/\//g, '_')
    .replace(/'/g, '')
    .replace(/\(/g, '_').replace(/\)/g, '_')
    .replace(/\[/g, '').replace(/\]/g, ''));

  return {name: dbpedia_name, uri: 'dbpedia:' + dbpedia_name};
}



function show_hierarchy(goid, lang) {
  if(!goid.startsWith("GO_"))
    goid = "GO_" + goid;
  let list = '';
  let table_upper = [];
  let table_lower = [];
  let table_sister = [];

  let upper_promise = new Promise((resolve, reject) => {
    queryBySpang(`${sparqlDir}/goid_to_get_upper.rq`, null, {goid}, (data) => {
      let data_p = data['results']['bindings'];
      let added_go = new Set();
      for (let i = 0; i < data_p.length; i++) {
        if(added_go.has(data_p[i]['go']['value']))
          continue;
        added_go.add(data_p[i]['go']['value']);
        table_upper.push(data_p[i]);
        let dbpedia = dbpedia_name(data_p[i]['go_label']['value']);
        if (dbpedia) {
          table_upper[table_upper.length - 1]['dbpedia'] = dbpedia.name;
          list += '( ' + dbpedia.uri + ' )';
        }
      }
      resolve();
    })
  });

  let lower_promise = new Promise((resolve, reject) => {
    queryBySpang(`${sparqlDir}/goid_to_get_lower.rq`, null, {goid}, (data) => {
      let data_p = data['results']['bindings'];
      for (let i = 0; i < data_p.length; i++) {
        table_lower[i] = data_p[i];
        let dbpedia = dbpedia_name(data_p[i]['go_label']['value']);
        if (dbpedia) {
          table_lower[i]['dbpedia'] = dbpedia.name;
          list += '( ' + dbpedia.uri + ' )';
        }
      }
      resolve();
    })
  });

  let sister_promise = new Promise((resolve, reject) => {
    queryBySpang(`${sparqlDir}/goid_to_get_sisters.rq`, null, {goid}, (data) => {
      let data_p = data['results']['bindings'];
      for (let i = 0; i < data_p.length; i++) {
        table_sister[i] = data_p[i];
        let dbpedia = dbpedia_name(data_p[i]['go_label']['value']);
        if (dbpedia) {
          table_sister[i]['dbpedia'] = dbpedia.name;
          list += '( ' + dbpedia.uri + ' )';
        }
      }
      resolve();
    })
  });

  // Use DBpedia to translate
  let dbpedia_labe_en = {};
  let dbpedia_labe_local = {};
  let local_promise = new Promise((resolve, reject) => {
    Promise.all([upper_promise, lower_promise, sister_promise]).then(() => {
      queryBySpang(`${commonSparqlDir}/dbpedia_local_names.rq`, null, {resourceId: list, local_lang: lang}, (data) => {
        let data_p = data['results']['bindings'];
        for (let i = 0; i < data_p.length; i++) {
          let dbpedia_uri = data_p[i]['dbpedia_resource']['value'];
          if (data_p[i]['label_en']) {
            dbpedia_labe_en[dbpedia_uri] = data_p[i]['label_en']['value'];
          }
          if (data_p[i]['label_local'] && lang != 'en') {
            dbpedia_labe_local[dbpedia_uri] = data_p[i]['label_local']['value'];
          }
        }
        resolve();
      });
    });
  });

  let main_count = 0;
  local_promise.then(() => {
    // Show tables
    let html = '<table id="taxonomy" class="hierarchy table">';
    html += '<tr><th colspan="2">GO hierarchy</th>';
    html += '<th align="center"><font size="2"><i>N</i></font></th></tr>';
    for (let i = 0; i < table_upper.length; i++) {
      // let rank = table_upper[i]['rank']['value'].replace(/.*\//, '');
      let label = table_upper[i]['go_label']['value'];
      let wiki = '';
      if (table_upper[i]['dbpedia']) {
        let dbpedia_uri = 'http://dbpedia.org/resource/' + table_upper[i]['dbpedia'];
        if (dbpedia_labe_en[dbpedia_uri]) {
          wiki += '<a target="_blank" href="http://en.wikipedia.org/wiki/' + dbpedia_name(dbpedia_labe_en[dbpedia_uri]).name + '">*</a> ';
        }
        if (dbpedia_labe_local[dbpedia_uri] && lang != 'en') {
          let label_local = dbpedia_labe_local[dbpedia_uri];
          wiki += '<a target="_blank" href="http://' + lang + '.wikipedia.org/wiki/' + label_local + '">' + label_local + '</a>';
        }
      }
      label = '<td class="taxon_clickable" nowrap><i>' + label + '</i></td>';
      html += '<tr>' + label + '<td nowrap><font size="2">' + wiki + '</font></td>' +
        '<td align="right"><font size="2">' + table_upper[i]['count']['value'] + '</font></td></tr>';
    }

    for (let i = 0; i < table_sister.length; i++) {
      // let rank = table_sister[i]['rank']['value'].replace(/.*\//, '');
      let sister_goid = table_sister[i]['go']['value'].replace(/.*\//, '');
      let label = table_sister[i]['go_label']['value'];
      let sister_count = table_sister[i]['count']['value'];
      let wiki = '';
      if (table_sister[i]['dbpedia']) {
        let dbpedia_uri = 'http://dbpedia.org/resource/' + table_sister[i]['dbpedia'];
        if (dbpedia_labe_en[dbpedia_uri]) {
          wiki += '<a target="_blank" href="http://en.wikipedia.org/wiki/' + dbpedia_name(dbpedia_labe_en[dbpedia_uri]).name + '">*</a> ';
        }
        if (dbpedia_labe_local[dbpedia_uri] && lang != 'en') {
          let label_local = dbpedia_labe_local[dbpedia_uri];
          wiki += '<a target="_blank" href="http://' + lang + '.wikipedia.org/wiki/' + label_local + '">' + label_local + '</a>';
        }
      }

      let mark = '';
      if (sister_goid == goid) {
        mark = '&emsp;-&ensp;';
      } else {
        mark = '&emsp;+&ensp;';
      }
      // if (rank_orig == 'Species') {
      //     // mark = '&emsp;&ensp;';
      //     mark = '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;';
      // }

      if (sister_goid === goid) {
        label = '<td nowrap><i><b>' + mark + label + '</b></i></td>';
        html += '<tr bgcolor="#E3E3E3">';
      } else {
        label = '<td class="taxon_clickable" nowrap><i>' + mark + label + '</i></td>';
        html += '<tr>';
      }
      html += label + '<td nowrap><font size="2">' + wiki + '</font></td>' +
        '<td align="right"><font size="2">' + sister_count + '</font></td>' + '</tr>';

      if (sister_goid === goid) {
        main_count = sister_count;
        for (let j = 0; j < table_lower.length; j++) {
          // let rank = table_lower[j]['rank']['value'].replace(/.*\//, '');
          let label = table_lower[j]['go_label']['value'];
          let lower_count = table_lower[j]['count']['value'];
          let wiki = '';
          if (table_lower[j]['dbpedia']) {
            let dbpedia_uri = 'http://dbpedia.org/resource/' + table_lower[j]['dbpedia'];
            if (dbpedia_labe_en[dbpedia_uri]) {
              wiki += '<a target="_blank" href="http://en.wikipedia.org/wiki/' + dbpedia_name(dbpedia_labe_en[dbpedia_uri]).name + '">*</a> ';
            }
            if (dbpedia_labe_local[dbpedia_uri] && lang != 'en') {
              let label_local = dbpedia_labe_local[dbpedia_uri];
              wiki += '<a target="_blank" href="http://' + lang + '.wikipedia.org/wiki/' + label_local + '">' + label_local + '</a>';
            }
          }
          label = '<td class="taxon_clickable" nowrap><i>' + '&emsp;&emsp;&emsp;' + label + '</i></td>';
          html += '<tr>' + label + '<td nowrap><font size="2">' + wiki + '</font></td>' +
            '<td align="right"><font size="2">' + lower_count + '</font></td></tr>';
        }
      }
    }
    html += '</table>';

    $('#go_div').html(html);
  });
}

function show_dbpedia(taxon_name, goid, local_lang) {
  let dbpedia = dbpedia_name(taxon_name);
  if (!dbpedia) {
    return;
  }

  queryBySpang(`${sparqlDir}/dbpedia_entry.rq`, dbpedia_endpoint, {
    entry: dbpedia.uri,
    lang_list: local_lang == 'en' ? '' : `("${local_lang}")`
  }, function (data) {
    let data_p = data['results']['bindings'];
    let img = '';
    let abst = '';
    let abst_local = '';
    let label_local = '';
    let wiki = '';
    for (let i = 0; i < data_p.length; i++) {
      if (!wiki) {
        wiki = data_p[i]['wiki']['value'];
      }
      if (!img && data_p[i]['image']) {
        img = data_p[i]['image']['value'];
      }
      if (!abst && data_p[i]['abst']['xml:lang'] == 'en') {
        abst = data_p[i]['abst']['value'];
        let max_len = 800;
        if (abst.length > max_len) {
          abst = abst.substr(0, max_len).replace(/\S+$/, '') + ' ...';
        }
      }
      if (!abst_local && data_p[i]['abst']['xml:lang'] == local_lang) {
        abst_local = data_p[i]['abst']['value'];
      }
      if (!label_local && data_p[i]['label']['xml:lang'] == local_lang) {
        label_local = data_p[i]['label']['value'];
      }
    }
    let html = '';
    if (wiki) {
      html += '<table id="dbpedia" class="table">';
      html += '<tr><td>';
      if (img) {
        html += '<a target="_blank" href="' + img + '"><img src="' + img + '?height=160" height="160"></a>';
      } else {
        html += '<font size="2">No image</font>';
      }
      html += '</td><td><font size="2">';
      html += abst;
      html += '<br>';
      html += '<a target="_blank" href="' + wiki + '">' + wiki + '</a>';
      if (local_lang != 'en') {
        html += '<br>';
        html += abst_local;
        html += '<br>';
        html += '<a target="_blank" href="http://' + local_lang + '.wikipedia.org/wiki/' + label_local + '">' + label_local + '</a>';
      }
      html += '</font></td>';
      html += '<td>';
      html += '<font size="2">Obtained from <a href="http://dbpedia.org">DBpedia</a></font>';
      html += '<br><br>';
      html += '<a href="http://creativecommons.org/licenses/by-sa/3.0/"><img src="img/cc-by-sa.png" width="62" height="22"></a>';
      html += '</td>';
      html += '</tr>';
      html += '</table>';
      $('#dbpedia_div').html(html);
    } else {
      $('#dbpedia_div').html('Not found in DBpedia');
    }
  });
}


function show_proteins_table(proteins, count_html) {
  show_proteins(proteins, false, "#details", true, {
    widgetOptions : {
      filter_columnFilters: false,
      filter_external: '#detail-filter',
    },
    widgets: ["filter"],
  });
  $('#counter_div').html(count_html);
}


function show_protein_list(go_name, goid) {
  let count = 0;

  queryBySpang(`${sparqlDir}/goid_to_search_proteins.rq`, null, {goid: 'GO_' + goid}, (data) => {
    let data_p = data['results']['bindings'];
    count = data_p.length;
    for (let i = 0; i < count; i++) {
      let row = data_p[i];
      row['protein']['value'].match(/(\d+)$/);
      const up_id_url = row['protein']['value'];
      const up_id = row['protein']['value'].replace(/.*\//, '');
      const mnemonic = row['mnemonic']['value'];
      const full_name = row['full_name']['value'];
      const map = row['map']['value'];
      currentProteinMap[up_id] = {
        up_id_url,
        up_id,
        mnemonic,
        full_name,
        map
      };
    }

    let count_html = `<br><b><i>${go_name}</i>: ${count} ${count >= 2 ? 'proteins' : 'protein' }</b>`;
    count_html +=  '<label style="margin-left: 10px;">Filter by:</label> <input id="detail-filter" data-column="all" type="search" style="margin-right: 30px;">' + 
      '<div id="pager" style="float: right;">' +
      '<button class="d-inline first btn"><<</button>' +
      '<button class="d-inline prev btn"><</button> ' +
      '<span style="display:inline-block; width: 200px; text-align: center" class="pagedisplay" data-pager-output-filtered="{startRow} &ndash; {endRow} / {filteredRows} of {totalRows} rows"></span>' +
      '<button class="d-inline next btn">></button>' +
      '<button class="d-inline last btn"> >> </button>';
    show_proteins_table(Object.values(currentProteinMap), count_html)
  });

  return count;
}

function load_url_state(push_state = true) {
  const urlParams = new URLSearchParams(window.location.search);
  let name = urlParams.get('name')
  if (name) {
    let display_name = urlParams.get('display_name')
    $('#tags').val(display_name || name);
    show_contents(name, display_name, push_state);
    $('#result-area').show();
  } else {
    $('#tags').val('');
    currentName = null;
    clear_tables();
  }
}

function updateSelected() {
  updateSelectedCount();
  let proteinList = Object.values(selectedProteins);
  $('#protein-counter')[0].innerHTML = `You selected <b>${proteinList.length}</b> proteins`;
  show_proteins(proteinList);
}

$(() => {
  $.tablesorter.addParser({
    id: 'fancyNumber',
    is: function (s) {
      return /^[0-9]?[0-9,\.]*$/.test(s);
    },
    format: function (s) {
      return $.tablesorter.formatFloat(s.replace(/,/g, ''));
    },
    type: 'numeric'
  });
});
