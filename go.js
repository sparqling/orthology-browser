function get_go_table_row(protein_record) {
  let checkedAttr = localStorage.getItem(proteinPrefix + protein_record.up_id) ? "checked" : "";
  let list_html = '<tr>';/**/
  list_html += `<td align="center"><input type="checkbox" class="add_protein" ${checkedAttr} title="Select"></td>`;
  list_html += `<td class="protein-id-td"><a href="${protein_record.up_id_url}" target="_blank">${protein_record.up_id}</a></td>`;

  for(let c of  ['mnemonic', 'full_name', 'map']) {
    list_html += '<td>' + protein_record[c] + '</td>';
  }

  list_html += '</tr>';
  return list_html;
}

let initialProteinMap = {};

$(show_selected_proteins);

Storage.prototype.setObject = function(key, value) {
  this.setItem(key, JSON.stringify(value));
}

$(function() {
  $(document).on('click', '.add_protein', function() {
    let this_row = $(this).closest('tr');
    // Selected item
    let codename = this_row.find('td:nth-child(2)').text();

    if (localStorage.getItem(proteinPrefix + codename)) {
      // Delete the item
      localStorage.removeItem(proteinPrefix + codename);
    } else {
      // Add the item
      localStorage.setObject(proteinPrefix + codename, initialProteinMap[codename]);
    }

    show_selected_proteins();
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
      console.log(codename);

      if (selected) {
        // Add the item
        if (!localStorage.getItem(proteinPrefix + codename)) {
          localStorage.setObject(proteinPrefix + codename, initialProteinMap[codename]);
        }
      } else {
        // Delete the item
        if (localStorage.getItem(proteinPrefix + codename)) {
          localStorage.removeItem(proteinPrefix + codename);
        }
      }
    }

    show_selected_proteins();
    UpdateChart();

  });
});

function show_selected_proteins() {

  let total = 0;
  let html = '<thead><tr>' +
    '<th style="width: 1.5em;"align="center"><input type="checkbox" checked class="add_protein_all" title="Select all"></th>' +
    '<th style="width: 7em;">Uniprot ID</th>' +
    '<th style="width: 9em;">Mnemonic</th>' +
    '<th>Full name</th>' +
    '<th style="width: 9em;">Map</th>' +
    '</tr></thead>';

  for (let i=0; i<localStorage.length; i++) {
    let key = localStorage.key(i);
    if (key.startsWith(proteinPrefix)) {
      try {
        let val = JSON.parse(localStorage.getItem(key));
        initialProteinMap[key.slice(proteinPrefix.length)] = val;
        html += '<tr>' + get_go_table_row(val) + '</tr>';
        total++;
      } catch(e) {
        console.log(e);
        localStorage.removeItem(key);
      }
    }
  }
  html += '';

  $('#selected-proteins').html(html)
  $("#protein-counter").html('<font size="2"><br>You selected <b>' + total + '</b> proteins (from <a target="_blank" href="https://sparqling.github.io/go-browser/">GO browser</a>)<br><br></font>');

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
