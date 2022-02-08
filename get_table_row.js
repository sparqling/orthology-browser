
function get_taxon_table_row(genome_record) {
  let assembly_url = '';

  let checkedAttr = selectedTaxa[genome_record.up_id] !== undefined ? "checked" : "";
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
  list_html += `<td align="center"><input type="checkbox" class="add_genome" data-codename="${genome_record.up_id}" ${checkedAttr} title="Select"></td>`;
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
  list_html += `<td style="text-align: center;"><img class="table-image image-${genome_record.up_id}" style="height: 25px;" data-title="${genome_record.up_id}"></td>`;
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

function get_go_table_row(protein_record) {
  let checkedAttr = selectedProteins[protein_record.up_id] !== undefined ? "checked" : "";
  let list_html = '<tr>';/**/
  list_html += `<td align="center"><input type="checkbox" class="add_protein" ${checkedAttr} title="Select"></td>`;
  list_html += `<td class="protein-id-td"><a href="${protein_record.up_id_url}" target="_blank">${protein_record.up_id}</a></td>`;

  for(let c of  ['mnemonic', 'full_name', 'map']) {
    list_html += '<td>' + protein_record[c] + '</td>';
  }

  list_html += '</tr>';
  return list_html;
}


function show_genomes(genomes, cssSelector = '#selected-proteomes', extraOptions = {}) {
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

  $(cssSelector).html(html)
  
  let options = {
    headers: {
      0: {sorter:false},
      7: {sorter:'fancyNumber'},
      8: {sorter:'fancyNumber'},
    },
  };
  options = Object.assign(options, extraOptions);
  
  $(function() {
    $(cssSelector).tablesorter(
      options
    );
  });
}

function show_proteins(proteins, cssSelector = '#selected-proteins', paginate = false, extraOptions = {}) {
  let list_html = '<thead><tr>' +
    '<th style="width: 1.5em;"align="center"><input type="checkbox" class="add_protein_all" title="Select all"></th>' +
    '<th style="width: 7em;">Uniprot ID</th>' +
    '<th style="width: 9em;">Mnemonic</th>' +
    '<th>Full name</th>' +
    '<th style="width: 9em;">Map</th>' +
    '</tr></thead>';
  for (let protein of proteins) {
    list_html += get_go_table_row(protein);
  }

  $(cssSelector).html(list_html);
  
  let options = {
    headers: {
      headers: {
        0: {sorter: false},
      },
    },
  };
  options = Object.assign(options, extraOptions);

  $(function() {
    let sorter = $(cssSelector).tablesorter(
      options
    );
    if(paginate)
      sorter.tablesorterPager({container: '#pager', size: "30"});
  });
}