function get_go_table_row(protein_record) {
  let list_html = '<tr>';/**/
  list_html += `<td align="center"><input type="checkbox" class="add_protein" checked title="Select"></td>`;
  list_html += `<td class="protein-id-td"><a href="${protein_record.up_id_url}" target="_blank">${protein_record.up_id}</a></td>`;

  for(let c of  ['mnemonic', 'full_name', 'map']) {
    list_html += '<td>' + protein_record[c] + '</td>';
  }

  list_html += '</tr>';
  return list_html;
}

Storage.prototype.setObject = function(key, value) {
  this.setItem(key, JSON.stringify(value));
}

$(function() {
  $(document).on('click', '.add_protein', function() {
    let this_row = $(this).closest('tr');
    // Selected item
    let codename = this_row.find('td:nth-child(2)').text();
    
    delete selectedProteins[codename];
    localStorage.setObject('selectedProteins', selectedProteins);
    UpdateChart();
  });

  $(document).on('click', '.add_protein_all', function() {
    // Swith the icon
    let selected = $(this).prop('checked');
    for (let i=0; i<$('.add_protein').length; i++) {
      let each_icon = $('.add_protein').eq(i);
      let each_row = each_icon.closest('tr');
      // Eech item
      let codename = each_row.find('td:nth-child(2)').text();
      // Delete the item
      delete selectedProteins[codename];
    }
    localStorage.setObject('selectedProteins', selectedProteins);
    UpdateChart();
  });
});

function show_proteins() {
  let total = 0;
  let html = '<thead><tr>' +
    '<th style="width: 1.5em;"align="center"><input type="checkbox" checked class="add_protein_all" title="Select all"></th>' +
    '<th style="width: 7em;">Uniprot ID</th>' +
    '<th style="width: 9em;">Mnemonic</th>' +
    '<th>Full name</th>' +
    '<th style="width: 9em;">Map</th>' +
    '</tr></thead>';

  for(let protein of proteins) {
    html += '<tr>' + get_go_table_row(protein) + '</tr>';
  }
  html += '';

  $('#selected-proteins').html(html)
  $("#protein-counter").html('<font size="2"><br>You selected <b>' + proteins.length + '</b> proteins (from <a target="_blank" href="/go-browser/">GO browser</a>)<br><br></font>');
  $("#selected-protein-label").html(`<b>${proteins.length}</b> proteins`);


  for (let i = 0; i < $('.add_protein').length; i++) {
    let each_checkbox = $('.add_protein').eq(i);
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
    $('#selected-proteins').tablesorter(
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
