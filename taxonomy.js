
Storage.prototype.setObject = function(key, value) {
  this.setItem(key, JSON.stringify(value));
}

$(function() {
  $(document).on('click', '.add_genome', function() {
    let codename = $(this).data('codename');
    delete selectedTaxa[codename];
    localStorage.setObject('selectedTaxa', selectedTaxa);
    UpdateChart();
  });

  $(document).on('click', '.add_genome_all', function() {
    // Swith the icon
    let selected = $(this).prop('checked');
    for (let i=0; i<$('.add_genome').length; i++) {
      let codename = $('.add_genome').eq(i).data('codename');
      delete selectedTaxa[codename];
    }
    localStorage.setObject('selectedTaxa', selectedTaxa);
    UpdateChart();
  });
});

function get_taxon_table_row(genome_record) {
  let assembly_url = '';
  if (genome_record.assembly) {
    assembly_url = 'https://ncbi.nlm.nih.gov/assembly/' + genome_record.assembly;
  }
  let scientific_name = genome_record.organism_name;
  let common_name = '';
  if (scientific_name.match(/(.*)?(\(.*)/)) {
    scientific_name = RegExp.$1;
    common_name = RegExp.$2;
  }
  let name = `<i>${scientific_name}</i> ${common_name}`;

  let list_html = '<tr>';
  list_html += `<td align="center"><input type="checkbox" class="add_genome" data-codename="${genome_record.up_id}" checked title="Select"></td>`;
  if (genome_record.types.match(/Reference_Proteome/)) {
    list_html += '<td align="center"> &#9675 </td>';
  } else {
    list_html += '<td> </td>';
  }
  // if (types.match(/Representative_Proteome/)) {
  //   list_html += '<td align="center"> &#9675 </td>';
  // } else {
  //   list_html += '<td> </td>';
  // }
  list_html += `<td style="text-align: center;"><img class="table-image" style="height: 25px;" id="image-${genome_record.displayedName}" data-title="${genome_record.displayedName}"></td>`;
  list_html += `<td class="proteome-id-td"><a href="${genome_record.up_id_url}" target="_blank">${genome_record.up_id}</a></td>`;
  list_html += `<td><a href="${assembly_url}" target="_blank">${genome_record.assembly}</a></td>`;
  list_html += '<td>' + genome_record.genome_taxid + '</td>';
  list_html += '<td class="genome_name">' + name + '</td>';
  list_html += '<td align="right">' + genome_record.n_genes.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',') + '</td>';
  list_html += '<td align="right">' + genome_record.n_isoforms.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',') + '</td>';
  list_html += '<td align="right">' + genome_record.cpd_label + '</td>';
  list_html += '<td align="right">' + genome_record.busco_complete + '</td>';
  list_html += '<td align="right">' + genome_record.busco_single + '</td>';
  list_html += '<td align="right">' + genome_record.busco_multi + '</td>';
  list_html += '<td align="right">' + genome_record.busco_fragmented + '</td>';
  list_html += '<td align="right">' + genome_record.busco_missing + '</td>';
  list_html += '</tr>';

  return list_html;
}


function show_genomes() {
  let genomes = [baseTaxon].concat(comparedTaxa);
  let total = 0;
  let html = '<thead><tr>' +
    '<th align="center"><input type="checkbox" class="add_genome_all" checked title="Select all"></th>' +
    '<th>Ref</th>' +
    '<th>Image</th>' +
    // '<th>Rep</th>' +
    '<th>Proteome ID</th>' +
    '<th>Genome ID</th>' +
    '<th>Tax ID</th>' +
    '<th>Species Name</th>' +
    '<th>Genes</th>' +
    '<th>Isoforms</th>' +
    '<th>CPD <a href="https://uniprot.org/help/assessing_proteomes" target="_blank">*</a></th>' +
    '<th>BUSCO</th>' +
    '<th class="thin">single</th>' +
    '<th class="thin">dupli.</th>' +
    '<th class="thin">frag.</th>' +
    '<th class="thin">miss.</th>' +
    '</tr></thead>';

  
  for(let genome of genomes) {
    html += '<tr>' + get_taxon_table_row(genome) + '</tr>';
  }
  html += '';

  $('#selected-proteomes').html(html)
  $("#proteome-counter").html('<font size="2"><br>You selected <b>' + genomes.length + '</b> proteomes (from <a target="_blank" href="/taxonomy-browser/">Taxonomy Browser</a>)<br><br></font>');
  $("#selected-proteome-label").html(`<b>${genomes.length}</b> proteomes`);

  for (let i = 0; i < $('.add_genome').length; i++) {
    let each_checkbox = $('.add_genome').eq(i);
    each_checkbox.prop("checked", true);
  }

  $(function() {
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
    $('#selected-proteomes').tablesorter(
      {
        headers: {
          0: {sorter:false},
          7: {sorter:'fancyNumber'},
          8: {sorter:'fancyNumber'},
        }
      }
    );
  });
}
