/*
   Licensed to the Apache Software Foundation (ASF) under one or more
   contributor license agreements.  See the NOTICE file distributed with
   this work for additional information regarding copyright ownership.
   The ASF licenses this file to You under the Apache License, Version 2.0
   (the "License"); you may not use this file except in compliance with
   the License.  You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
*/
var showControllersOnly = false;
var seriesFilter = "";
var filtersOnlySampleSeries = true;

/*
 * Add header in statistics table to group metrics by category
 * format
 *
 */
function summaryTableHeader(header) {
    var newRow = header.insertRow(-1);
    newRow.className = "tablesorter-no-sort";
    var cell = document.createElement('th');
    cell.setAttribute("data-sorter", false);
    cell.colSpan = 1;
    cell.innerHTML = "Requests";
    newRow.appendChild(cell);

    cell = document.createElement('th');
    cell.setAttribute("data-sorter", false);
    cell.colSpan = 3;
    cell.innerHTML = "Executions";
    newRow.appendChild(cell);

    cell = document.createElement('th');
    cell.setAttribute("data-sorter", false);
    cell.colSpan = 7;
    cell.innerHTML = "Response Times (ms)";
    newRow.appendChild(cell);

    cell = document.createElement('th');
    cell.setAttribute("data-sorter", false);
    cell.colSpan = 1;
    cell.innerHTML = "Throughput";
    newRow.appendChild(cell);

    cell = document.createElement('th');
    cell.setAttribute("data-sorter", false);
    cell.colSpan = 2;
    cell.innerHTML = "Network (KB/sec)";
    newRow.appendChild(cell);
}

/*
 * Populates the table identified by id parameter with the specified data and
 * format
 *
 */
function createTable(table, info, formatter, defaultSorts, seriesIndex, headerCreator) {
    var tableRef = table[0];

    // Create header and populate it with data.titles array
    var header = tableRef.createTHead();

    // Call callback is available
    if(headerCreator) {
        headerCreator(header);
    }

    var newRow = header.insertRow(-1);
    for (var index = 0; index < info.titles.length; index++) {
        var cell = document.createElement('th');
        cell.innerHTML = info.titles[index];
        newRow.appendChild(cell);
    }

    var tBody;

    // Create overall body if defined
    if(info.overall){
        tBody = document.createElement('tbody');
        tBody.className = "tablesorter-no-sort";
        tableRef.appendChild(tBody);
        var newRow = tBody.insertRow(-1);
        var data = info.overall.data;
        for(var index=0;index < data.length; index++){
            var cell = newRow.insertCell(-1);
            cell.innerHTML = formatter ? formatter(index, data[index]): data[index];
        }
    }

    // Create regular body
    tBody = document.createElement('tbody');
    tableRef.appendChild(tBody);

    var regexp;
    if(seriesFilter) {
        regexp = new RegExp(seriesFilter, 'i');
    }
    // Populate body with data.items array
    for(var index=0; index < info.items.length; index++){
        var item = info.items[index];
        if((!regexp || filtersOnlySampleSeries && !info.supportsControllersDiscrimination || regexp.test(item.data[seriesIndex]))
                &&
                (!showControllersOnly || !info.supportsControllersDiscrimination || item.isController)){
            if(item.data.length > 0) {
                var newRow = tBody.insertRow(-1);
                for(var col=0; col < item.data.length; col++){
                    var cell = newRow.insertCell(-1);
                    cell.innerHTML = formatter ? formatter(col, item.data[col]) : item.data[col];
                }
            }
        }
    }

    // Add support of columns sort
    table.tablesorter({sortList : defaultSorts});
}

$(document).ready(function() {

    // Customize table sorter default options
    $.extend( $.tablesorter.defaults, {
        theme: 'blue',
        cssInfoBlock: "tablesorter-no-sort",
        widthFixed: true,
        widgets: ['zebra']
    });

    var data = {"OkPercent": 100.0, "KoPercent": 0.0};
    var dataset = [
        {
            "label" : "FAIL",
            "data" : data.KoPercent,
            "color" : "#FF6347"
        },
        {
            "label" : "PASS",
            "data" : data.OkPercent,
            "color" : "#9ACD32"
        }];
    $.plot($("#flot-requests-summary"), dataset, {
        series : {
            pie : {
                show : true,
                radius : 1,
                label : {
                    show : true,
                    radius : 3 / 4,
                    formatter : function(label, series) {
                        return '<div style="font-size:8pt;text-align:center;padding:2px;color:white;">'
                            + label
                            + '<br/>'
                            + Math.round10(series.percent, -2)
                            + '%</div>';
                    },
                    background : {
                        opacity : 0.5,
                        color : '#000'
                    }
                }
            }
        },
        legend : {
            show : true
        }
    });

    // Creates APDEX table
    createTable($("#apdexTable"), {"supportsControllersDiscrimination": true, "overall": {"data": [0.9999162479061977, 500, 1500, "Total"], "isController": false}, "titles": ["Apdex", "T (Toleration threshold)", "F (Frustration threshold)", "Label"], "items": [{"data": [1.0, 500, 1500, "Frontpage logged-0"], "isController": false}, {"data": [1.0, 500, 1500, "View a forum activity"], "isController": false}, {"data": [1.0, 500, 1500, "View course again"], "isController": false}, {"data": [1.0, 500, 1500, "Frontpage logged-1"], "isController": false}, {"data": [1.0, 500, 1500, "Frontpage logged"], "isController": false}, {"data": [1.0, 500, 1500, "View login page"], "isController": false}, {"data": [1.0, 500, 1500, "Fill a form to reply a forum discussion"], "isController": false}, {"data": [1.0, 500, 1500, "View a forum discussion"], "isController": false}, {"data": [1.0, 500, 1500, "View course participants"], "isController": false}, {"data": [1.0, 500, 1500, "Login"], "isController": false}, {"data": [1.0, 500, 1500, "Login-0"], "isController": false}, {"data": [1.0, 500, 1500, "Login-1"], "isController": false}, {"data": [1.0, 500, 1500, "Logout-1"], "isController": false}, {"data": [1.0, 500, 1500, "Login-2"], "isController": false}, {"data": [1.0, 500, 1500, "Logout-0"], "isController": false}, {"data": [1.0, 500, 1500, "View course once more"], "isController": false}, {"data": [1.0, 500, 1500, "View a page activity"], "isController": false}, {"data": [1.0, 500, 1500, "Frontpage not logged"], "isController": false}, {"data": [1.0, 500, 1500, "Logout"], "isController": false}, {"data": [1.0, 500, 1500, "Send the forum discussion reply"], "isController": false}, {"data": [0.9983660130718954, 500, 1500, "View course"], "isController": false}]}, function(index, item){
        switch(index){
            case 0:
                item = item.toFixed(3);
                break;
            case 1:
            case 2:
                item = formatDuration(item);
                break;
        }
        return item;
    }, [[0, 0]], 3);

    // Create statistics table
    createTable($("#statisticsTable"), {"supportsControllersDiscrimination": true, "overall": {"data": ["Total", 5970, 0, 0.0, 126.12395309882722, 15, 528, 111.0, 251.0, 264.4499999999998, 318.28999999999996, 3.247880173350844, 1159.98809741767, 1.0375266635933305], "isController": false}, "titles": ["Label", "#Samples", "FAIL", "Error %", "Average", "Min", "Max", "Median", "90th pct", "95th pct", "99th pct", "Transactions/s", "Received", "Sent"], "items": [{"data": ["Frontpage logged-0", 317, 0, 0.0, 34.56151419558362, 20, 56, 34.0, 43.0, 46.0, 50.81999999999999, 0.17301585742183448, 0.31866006552498033, 0.03497488524054662], "isController": false}, {"data": ["View a forum activity", 200, 0, 0.0, 249.68999999999988, 213, 373, 247.0, 273.0, 278.9, 299.98, 0.22154650538081075, 356.4153279978704, 0.05041048413450088], "isController": false}, {"data": ["View course again", 200, 0, 0.0, 253.69500000000005, 225, 311, 252.0, 269.0, 281.0, 310.98, 0.22153546228912593, 389.80850228008455, 0.04910991205042147], "isController": false}, {"data": ["Frontpage logged-1", 317, 0, 0.0, 124.63406940063093, 93, 356, 120.0, 135.2, 143.19999999999993, 328.82, 0.17300575394215714, 36.89110265466278, 0.035479695632668944], "isController": false}, {"data": ["Frontpage logged", 317, 0, 0.0, 159.3785488958992, 120, 392, 155.0, 171.2, 183.0, 361.28, 0.17300301581913383, 37.20915520140798, 0.07045142343415899], "isController": false}, {"data": ["View login page", 400, 0, 0.0, 39.75249999999998, 26, 59, 39.0, 49.0, 51.94999999999999, 56.0, 0.21951716102845983, 4.390422538293397, 0.04759063451984188], "isController": false}, {"data": ["Fill a form to reply a forum discussion", 200, 0, 0.0, 202.29999999999998, 125, 342, 207.5, 254.9, 259.95, 278.99, 0.22156540389157475, 69.90936996977294, 0.05106390167813637], "isController": false}, {"data": ["View a forum discussion", 200, 0, 0.0, 187.72, 105, 281, 187.5, 247.9, 255.79999999999995, 265.93000000000006, 0.22151362474927427, 123.768783360298, 0.05061932440559588], "isController": false}, {"data": ["View course participants", 200, 0, 0.0, 127.32500000000003, 94, 209, 127.0, 142.0, 149.95, 162.96000000000004, 0.22156761301886982, 42.0295013035792, 0.04890066459205525], "isController": false}, {"data": ["Login", 353, 0, 0.0, 229.40793201133164, 174, 377, 224.0, 265.6, 276.90000000000003, 301.0, 0.19213320655081703, 41.785608903060904, 0.18149038167152623], "isController": false}, {"data": ["Login-0", 353, 0, 0.0, 72.66855524079321, 51, 99, 72.0, 84.60000000000002, 87.0, 96.37999999999994, 0.1921503584720073, 0.4363511846164858, 0.07615059382897965], "isController": false}, {"data": ["Login-1", 353, 0, 0.0, 20.045325779036823, 15, 29, 20.0, 23.0, 25.0, 27.0, 0.19215726193865448, 0.35504056600384204, 0.06595252385362951], "isController": false}, {"data": ["Logout-1", 300, 0, 0.0, 64.7266666666667, 48, 89, 63.5, 76.0, 80.0, 85.99000000000001, 0.1785822710664576, 4.738010879231954, 0.03610012706128587], "isController": false}, {"data": ["Login-2", 353, 0, 0.0, 136.0538243626062, 98, 263, 132.0, 167.0, 175.3, 194.37999999999994, 0.1921451289032541, 40.996844348803556, 0.03940476276336266], "isController": false}, {"data": ["Logout-0", 300, 0, 0.0, 38.78333333333335, 24, 59, 38.0, 48.0, 51.0, 54.99000000000001, 0.17858333412703706, 0.34269165191369905, 0.06218443766786834], "isController": false}, {"data": ["View course once more", 200, 0, 0.0, 249.00999999999996, 218, 311, 248.0, 266.0, 271.0, 307.98, 0.22155509521330216, 389.842452907426, 0.04911426427091757], "isController": false}, {"data": ["View a page activity", 201, 0, 0.0, 119.07960199004974, 87, 150, 119.0, 134.8, 139.69999999999993, 147.95999999999998, 0.1433529177667755, 18.75407247541961, 0.03247839543153507], "isController": false}, {"data": ["Frontpage not logged", 400, 0, 0.0, 73.72250000000003, 50, 148, 73.0, 86.0, 89.94999999999999, 97.0, 0.22568256280604673, 6.003173802091061, 0.028651106606236397], "isController": false}, {"data": ["Logout", 300, 0, 0.0, 103.69333333333338, 78, 134, 102.0, 118.0, 122.94999999999999, 128.99, 0.1785771685518463, 5.08055532365326, 0.0982813863511089], "isController": false}, {"data": ["Send the forum discussion reply", 200, 0, 0.0, 102.68000000000002, 70, 139, 102.5, 118.0, 122.0, 130.0, 0.22158356913518149, 3.84663449873365, 0.14493924074667014], "isController": false}, {"data": ["View course", 306, 0, 0.0, 275.3790849673206, 223, 528, 261.5, 323.3, 333.65, 370.53000000000014, 0.16773538591746323, 295.1517842080834, 0.03718352793287515], "isController": false}]}, function(index, item){
        switch(index){
            // Errors pct
            case 3:
                item = item.toFixed(2) + '%';
                break;
            // Mean
            case 4:
            // Mean
            case 7:
            // Median
            case 8:
            // Percentile 1
            case 9:
            // Percentile 2
            case 10:
            // Percentile 3
            case 11:
            // Throughput
            case 12:
            // Kbytes/s
            case 13:
            // Sent Kbytes/s
                item = item.toFixed(2);
                break;
        }
        return item;
    }, [[0, 0]], 0, summaryTableHeader);

    // Create error table
    createTable($("#errorsTable"), {"supportsControllersDiscrimination": false, "titles": ["Type of error", "Number of errors", "% in errors", "% in all samples"], "items": []}, function(index, item){
        switch(index){
            case 2:
            case 3:
                item = item.toFixed(2) + '%';
                break;
        }
        return item;
    }, [[1, 1]]);

        // Create top5 errors by sampler
    createTable($("#top5ErrorsBySamplerTable"), {"supportsControllersDiscrimination": false, "overall": {"data": ["Total", 5970, 0, "", "", "", "", "", "", "", "", "", ""], "isController": false}, "titles": ["Sample", "#Samples", "#Errors", "Error", "#Errors", "Error", "#Errors", "Error", "#Errors", "Error", "#Errors", "Error", "#Errors"], "items": [{"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}]}, function(index, item){
        return item;
    }, [[0, 0]], 0);

});
