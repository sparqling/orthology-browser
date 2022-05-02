function getProteomeTableRow(proteome) {
  let assembly_url = '';

  let checkedAttr = selectedTaxa[proteome.up_id] !== undefined ? "checked" : "";
  if (proteome.assembly) {
    assembly_url = 'https://ncbi.nlm.nih.gov/assembly/' + proteome.assembly;
  }
  let scientific_name = proteome.organism_name;
  let common_name = '';
  if (scientific_name.match(/(.*)?(\(.*)/)) {
    scientific_name = RegExp.$1;
    common_name = RegExp.$2;
  }
  let name = `<i>${scientific_name}</i> ${common_name}`;

  let html = `<tr class="table-row-${proteome.up_id}">`;
  html += `<td align="center"><input type="checkbox" class="add_genome" data-codename="${proteome.up_id}" ${checkedAttr} title="Select"></td>`;
  if (proteome.types.match(/Reference_Proteome/)) {
    html += '<td align="center"> &#9675 </td>';
  } else {
    html += '<td> </td>';
  }
  html += `<td style="text-align: center;"><img class="table-image image-${proteome.up_id}" style="height: 25px;" data-title="${proteome.up_id}"></td>`;
  html += `<td class="proteome-id-td"><a href="${proteome.up_id_url}" target="_blank">${proteome.up_id}</a></td>`;
  html += `<td><a href="${assembly_url}" target="_blank">${proteome.assembly}</a></td>`;
  html += '<td>' + proteome.genome_taxid + '</td>';
  html += '<td class="genome_name">' + name + '</td>';
  html += '<td align="right">' + proteome.n_genes.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',') + '</td>';
  html += '<td align="right">' + proteome.n_isoforms.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',') + '</td>';
  html += '<td align="right">' + proteome.cpd_label + '</td>';
  html += '<td align="right">' + proteome.busco_complete + '</td>';
  html += '<td align="right">' + proteome.busco_single + '</td>';
  html += '<td align="right">' + proteome.busco_multi + '</td>';
  html += '<td align="right">' + proteome.busco_fragmented + '</td>';
  html += '<td align="right">' + proteome.busco_missing + '</td>';
  html += '</tr>';

  return html;
}

function get_go_table_row(protein_record) {
  let checkedAttr = selectedProteins[protein_record.up_id] !== undefined ? "checked" : "";
  let html = '<tr>';/**/
  html += `<td align="center" style="text-align: center;"><input type="checkbox" class="add_protein" ${checkedAttr} title="Select"></td>`;
  html += `<td class="protein-id-td"><a href="${protein_record.up_id_url}" target="_blank">${protein_record.up_id}</a></td>`;

  for(let c of  ['mnemonic', 'full_name', 'map']) {
    html += '<td>' + protein_record[c] + '</td>';
  }

  html += '</tr>';
  return html;
}

function showProteomes(proteomes, { allSelected = true,
                                 cssSelector = '#selected-proteomes',
                                 extraOptions = {}
                               } = {}
                     ) {
  let html = '<thead><tr>' +
    `<th align="center" style="text-align: center"><input type="checkbox" class="add_genome_all" ${allSelected ? 'checked' : ''} title="Select all"></th>` +
    '<th>Ref</th>' +
    '<th>Image</th>' +
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

  for (let proteome of proteomes) {
    html += '<tr>' + getProteomeTableRow(proteome) + '</tr>';
  }

  $(cssSelector).html(html)
  
  let sorterOptions = {
    headers: {
      0: { sorter: false },
      7: { sorter: 'fancyNumber' },
      8: { sorter: 'fancyNumber' }
    }
  };
  sorterOptions = Object.assign(sorterOptions, extraOptions);
  
  $(function() {
    $(cssSelector).tablesorter(sorterOptions);
  });
}

function show_proteins(proteins, allSelected = true, cssSelector = '#selected-proteins', paginate = false, extraOptions = {}) {
  let html = '<thead><tr>' +
    `<th style="width: 1.5em;"align="center" style="text-align: center;"><input type="checkbox" class="add_protein_all" ${allSelected ? 'checked' : ''} title="Select all"></th>` +
    '<th style="width: 7em;">Uniprot ID</th>' +
    '<th style="width: 9em;">Mnemonic</th>' +
    '<th>Full name</th>' +
    '<th style="width: 9em;">Map</th>' +
    '</tr></thead>';

  for (let protein of proteins) {
    html += get_go_table_row(protein);
  }

  $(cssSelector).html(html);
  
  let sorterOptions = {
    headers: {
      0: { sorter: false }
    }
  };
  sorterOptions = Object.assign(sorterOptions, extraOptions);

  $(function() {
    let sorter = $(cssSelector).tablesorter(sorterOptions);
    if (paginate) {
      sorter.tablesorterPager({ container: '#pager', size: "30" });
    }
  });
}
