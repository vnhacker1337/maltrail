/*
* Copyright (c) 2014-2015 Miroslav Stampar (@stamparm)
* See the file 'LICENSE' for copying permission
*/

// globals part

var _THREATS = {};
var _SOURCES = {};
var _TOP_SOURCES = [];
var _SOURCE_EVENTS = {};
var _TRAILS = {};
var _FLOOD_TRAILS = {};
var _HOURS = {};
var _DATASET = [];
var _TRAILS_SORTED = null;
var _DELETE_DELETE_PRESS = false;
var _MAX_EVENTS_PER_HOUR = 0;
var _TOTAL_EVENTS = 0;
var _USER = null;

var IP_COUNTRY = {};
var TRAIL_TYPES = { DNS: "#3366cc", IP: "#dc3912", URL: "#ff9900" };

var SPARKLINE_WIDTH = 130;
var CHART_WIDTH = 900;
var CHART_HEIGHT = 600;
var PIE_FONT_SIZE = 10;
var MAX_SOURCES_ITEMS = 40;
var FLOOD_TRAIL_THRESHOLD = 50;
var OTHER_COLOR = "#999";
var THREAT_INFIX = "~>";
var FLOOD_THREAT_PREFIX = "...";
var DGA_THREAT_SUFFIX = " dga";
var FLOOD_UID_SUFFIX = "F0";
var DGA_UID_SUFFIX = "D0";
var THREAT_PIC_HASH = null; // e.g. https://robohash.org/ or https://flathash.com/
var DEFAULT_STATUS_BORDER = "1px solid #a8a8a8"
var DEFAULT_FONT_FAMILY = "Verdana, Geneva, sans-serif";
var LOG_COLUMNS = { TIME: 0, SENSOR: 1, SRC_IP: 2, SRC_PORT: 3, DST_IP: 4, DST_PORT: 5, PROTO: 6, TYPE: 7, TRAIL: 8, INFO: 9, REFERENCE: 10 }
var DATATABLES_COLUMNS = { THREAT: 0, SENSOR: 1, EVENTS: 2, FIRST_TIME: 3, LAST_TIME: 4, SRC_IP: 5, SRC_PORT: 6, DST_IP: 7, DST_PORT: 8, PROTO: 9, TYPE: 10, TRAIL: 11, INFO: 12, REFERENCE: 13, TAGS: 14 }
var TOP_PORTS = { 19: "CHARGEN", 21: "FTP", 22: "SSH", 23: "Telnet", 25: "SMTP", 53: "DNS", 80: "HTTP", 110: "POP3", 123: "NTP", 143: "IMAP", 161: "SNMP", 389: "LDAP", 443: "HTTPS", 445: "Microsoft-DS", 587: "Submission", 902: "VMware", 990: "FTPS", 993: "IMAPS", 995: "POP3S", 1433: "MsSQL", 1434: "MsSQL", 1723: "PPTP", 1900: "SSDP", 3306: "MySQL", 3389: "RDP", 5060: "SIP", 5900: "VNC", 8080: "HTTP-proxy" }
var SEARCH_TIP_TIMER = 0;
var SEARCH_TIP_URL = "https://duckduckgo.com/?q=${query}";
//var SEARCH_TIP_URL = "https://www.google.com/cse?cx=011750002002865445766%3Ay5klxdomj78&ie=UTF-8&q=${query}";
var DAY_SUFFIXES = { 1: "st", 2: "nd", 3: "rd" };
var DOT_COLUMNS = [ LOG_COLUMNS.SRC_PORT, LOG_COLUMNS.SRC_IP, LOG_COLUMNS.DST_IP, LOG_COLUMNS.DST_PORT, LOG_COLUMNS.TRAIL, LOG_COLUMNS.PROTO ];
var ELLIPSIS = '<img src="images/ellipsis.png">';

// Retrieve (and parse) log data
$(document).ready(function() {
    initCalHeatmap();
    //initStats();
    initDialogs();

    Papa.RemoteChunkSize = 1024 * 1024 * 10; // 10 MB (per one chunk request)

    Chart.defaults.global.tooltipFontFamily = DEFAULT_FONT_FAMILY;
    Chart.defaults.global.tooltipTitleFontFamily = DEFAULT_FONT_FAMILY;
    Chart.defaults.global.scaleLabel = "<%=numberWithCommas(value)%>";
    Chart.defaults.global.scaleFontFamily = DEFAULT_FONT_FAMILY;
    Chart.defaults.global.animationSteps = 10;

    $("#header_container").sticky( { topSpacing: 0 });

    init(location.origin + "/events?date=" + formatDate(new Date()), new Date());
});

function initDialogs() {
    var options = {
        autoOpen: false,
        resizable: false,
        //autoResize: true,
        width: "auto",
        modal: true,
        buttons: {
            Cancel: function() {
                $(this).dialog("close");
            },
            "Log In": function() {
                $.ajax({
                    type: "POST",
                    url: "login",
                    dataType: "text",
                    data: "username=" + $(this).find("#username")[0].value.trim() + "&password=" + $(this).find("#password")[0].value.trim(),
                    cache: false,
                    beforeSend: function() {
                        $("input").prop("disabled", true);
                        $(".ui-dialog-buttonpane button").button("disable");
                    },
                    complete: function(response) {
                        $("input").prop("disabled", false);
                        $(".ui-dialog-buttonpane button").button("enable");
                        if(response.status === 401) {
                            $("#login_dialog input").val("");
                            $("#login_dialog").effect("highlight", { color: 'red' }, 500);
                        } else {
                            window.location.href = "/";
                            $(this).dialog("close");
                        }
                    }
                });
            },
        }
    }

    $('<div id="login_dialog" title="Authentication"><table><tbody><tr><td>Username:</td><td><input id="username" name="username"></td></tr><tr><td>Password:</td><td><input id="password" name="password" type="password" autocomplete="off"></td></tr></tbody></table></div>').appendTo('body').dialog(options);
    $("#login_link").click(function() {
        $("#login_dialog input").val("");
        $("#login_dialog").dialog("open")
        .keyup(function(e) {
            // Reference: http://stackoverflow.com/questions/868889/submit-jquery-ui-dialog-on-enter
            if (e.keyCode === $.ui.keyCode.ENTER) {
                $(this).parent().find('.ui-dialog-buttonpane button:last').click();
                return false;
            }
        });
    });

    $.ajax({
        type: "GET",
        url: "whoami",
        dataType: "text",
        cache: false,
        complete: function(response) {
            if ((typeof response.responseText !== "undefined") && (response.responseText.length > 0)) {
                _USER = response.responseText;
                $("#login_link").html("Log Out (" + _USER + ")");
                $("#login_link").off("click");
                $("#login_link").click(function() {
                    window.location.href = "logout";
                });
            }
            else if (document.location.origin.startsWith('http')) {
                    _USER = "";
                    document.title = "Maltrail (unauthorized)";
                    $("#login_link").click();
            }
        }
    });
}

function toggleHeatmap() {
    if ($("#heatmap_container").is(":visible"))
        $("#heatmap_container").hide();
    else {
        $("#heatmap_container").removeClass("hidden").show();
        scrollTo("#header_container-sticky-wrapper");
    }
}

function initCalHeatmap() {
    var start = new Date();
    //start.setYear(start.getYear() - 1);
    start.setDate(start.getDate() - 90);
    var cal = new CalHeatMap();

    try {
        cal.init({
            domain: "month",
            subdomain: "day",
            itemSelector: "#cal-heatmap",
            range: 4,
            cellSize: 13,
            legendCellSize: 13,
            legendHorizontalPosition: "right",
            legendVerticalPosition: "center",
            legendOrientation: "vertical",
            maxDate: new Date(),
            itemName: ["event", "events"],
            domainLabelFormat: "%Y-%m",
            legend: [ 500, 1000, 5000, 10000 ],  // more than 4 will make it unusable (>last are not colorized)
            legendMargin: [ 0, 0, 0, 20 ],
            label: {
                    position: "bottom"
            },
            data: location.origin + "/heatmap?from={{d:start}}&to={{d:end}}",
            highlight: [ "now" ],
            subDomainTitleFormat: {
                empty: "No records on {date}",
                filled: "~{count} records on {date}"
            },
            start: start,
            onClick: function(date, nb) {
                this.highlight(date);
                query(date);
            }
        });
    }
    catch(err) {
    }
    finally {
        $("#heatmap-previous").on("click", function() {
            cal.previous();
        });

        $("#heatmap-next").on("click", function() {
            cal.next();
        });
    }
}

function showTour() {
    alert("Tour");
}

function charTrim(str, chr) {
    while (str.substr(0, 1) === chr)
        str = str.substr(1);
    while (str.substr(str.length - 1) === chr)
        str = str.substr(0, str.length - 1);
    return str;
}

// Reference: http://stackoverflow.com/questions/2901102/how-to-print-a-number-with-commas-as-thousands-separators-in-javascript
function numberWithCommas(x) {
    return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

// Reference: http://en.wikipedia.org/wiki/Private_network
function isLocalAddress(ip) {
    if (ip.startsWith("10.") || ip.startsWith("192.168.") || ip.startsWith("127."))
        return true;
    else if (ip.startsWith("172.")) {
        var _ = parseInt(ip.split(".")[1]);
        return ((_ >= 16) && (_ <= 31))
    }
    else
        return false;
}

var entityMap = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': '&quot;',
    "'": '&#39;',
    "/": '&#x2F;'
};

// Reference: http://stackoverflow.com/a/12034334
function escapeHtml(string) {
    return String(string).replace(/[&<>"'\/]/g, function (s) {
        return entityMap[s];
    });
}

// Reference: http://24ways.org/2010/calculating-color-contrast/
function getContrast50(hexcolor) {
    return (parseInt(hexcolor, 16) > 0xffffff / 2) ? "black": "white";
}

// Reference: http://stackoverflow.com/questions/340209/generate-colors-between-red-and-green-for-a-power-meter
function getPercentageColor(percentage) {
    var power = percentage / 100.;

    if ((0 <= power) && (power < 0.5)) {
        green = 1.0;
        red = 2 * power;
    }
    if ((0.5 <= power) && (power <= 1)) {
        red = 1.0;
        green = 1.0 - 2 * (power - 0.5);
    }
    red = Math.round(red * 255);
    green = Math.round(green * 255);

    return "#" + pad(red.toString(16), 2) + pad(green.toString(16), 2) + "00";
}

function getContrastYIQ(hexcolor){
    var r = parseInt(hexcolor.substr(0, 2), 16);
    var g = parseInt(hexcolor.substr(2, 2), 16);
    var b = parseInt(hexcolor.substr(4, 2), 16);
    var yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;

    return (yiq >= 128) ? "black" : "white";
}

function getTagHtml(tag) {
    var retval = "";

    if (tag.length > 0) {
        var color = getHashColor(tag);
        retval = String.prototype.concat.apply("", ['<span class="tag ', getContrastYIQ(color), '-label-text" style="background-color: #', color, '">', tag, '</span>']);
    }

    return retval;
}

function getHashColor(value) {
    return pad(value.hashCode().toString(16), 6).substring(0, 6);
}

// Reference: http://stackoverflow.com/a/6969486
function escapeRegExp(str) {
    return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
}

function getThreatUID(threat) {  // e.g. 192.168.0.1~>shv4.no-ip.biz
    if (threat.startsWith(FLOOD_THREAT_PREFIX))
        return pad(threat.hashCode().toString(16), 6).substr(0, 6) + FLOOD_UID_SUFFIX;
    else if (threat.endsWith(DGA_THREAT_SUFFIX))
        return pad(threat.hashCode().toString(16), 6).substr(0, 6) + DGA_UID_SUFFIX;
    else
        return pad(threat.hashCode().toString(16), 8);
}

function init(url, from, to) {
    var csv = "";
    var demo = false;

    document.title = "Maltrail (loading...)";
    $("body").loader("show");
    $("#main_container").toggleClass("hidden", true);

    $(".alertify-log").remove();

    _THREATS = {};
    _SOURCES = {};
    _SOURCE_EVENTS = {};
    _TRAILS = {};
    _FLOOD_TRAILS = {};
    _HOURS = {};

    _DATASET.length = 0;
    _TOTAL_EVENTS = 0;
    _CHUNK_COUNT = 0;

    if (!(document.location.origin.startsWith('http'))) {
        demo = true;

        try {
            // Reference: http://stackoverflow.com/a/7083594
            $.ajaxSetup({ async: false });
            $.getScript("js/demo.js");
            $.ajaxSetup({ async: true });

            csv = getDemoCSV();
        }
        catch(err) {
            alert("please use Firefox to be able to show demo data");
        }

        $("#login_link").toggleClass("hidden", true);
        $("#login_splitter").toggleClass("hidden", true);
    }
    else {
        $("#login_link").toggleClass("hidden", false);
        $("#login_splitter").toggleClass("hidden", false);
    }

    Papa.parse(demo ? csv : url, {
        download: !demo,
        delimiter: ' ',
        //newline: '\n',
        worker: !demo,
        chunk: function(results) {
            var title = document.title.replace(/\s?\.\s?/g, '.');
            var parts = title.split('.');
            var _ = _CHUNK_COUNT % parts.length;
            var trailSources = { };

            if (_ < parts.length - 1)
                parts[_] += " ";
            else
                parts[_] = " " + parts[_];

            document.title = parts.join('.');
            _CHUNK_COUNT += 1;

            for (var i = 0; i < results.data.length; i++) {
                var data = results.data[i]

                if (data.length < 2)
                    continue;

                var _ = data[LOG_COLUMNS.TRAIL].replace(/\([^)]+\)/g, "");

                if (!(_ in trailSources))
                    trailSources[_] = { };

                trailSources[_][data[LOG_COLUMNS.SRC_IP]] = true;

                _ +=  " (" + data[LOG_COLUMNS.TYPE] + ")";
                if (!(_ in _TRAILS))
                    _TRAILS[_] = 1;
                else
                    _TRAILS[_] += 1;
            }

            for (var _ in trailSources) {
                if (Object.size(trailSources[_]) > FLOOD_TRAIL_THRESHOLD)
                    _FLOOD_TRAILS[_] = true;
            }

            for (var i = 0; i < results.data.length; i++) {
                var data = results.data[i], threatText, match, _;

                if (data.length < 2)
                    continue;

                var time = data[LOG_COLUMNS.TIME];
                var info = data[LOG_COLUMNS.INFO];

                _ = data[LOG_COLUMNS.TRAIL];
                _ = _.replace(/\([^)]+\)/g, "");

                var flood = _ in _FLOOD_TRAILS;
                var dga = info.endsWith(DGA_THREAT_SUFFIX);

                if (flood)
                    threatText = FLOOD_THREAT_PREFIX + THREAT_INFIX + _;
                else if (dga) {
                    threatText = data[LOG_COLUMNS.SRC_IP] + THREAT_INFIX + info;
                }
                else
                    threatText = data[LOG_COLUMNS.SRC_IP] + THREAT_INFIX + _;

                _TOTAL_EVENTS += 1;

                if (!(threatText in _THREATS))
                    _THREATS[threatText] = [1, [time], time, time, data];  // count, times, minTime, maxTime, (threat)data
                else {
                    _THREATS[threatText][0] += 1;
                    _THREATS[threatText][1].push(time);

                    if (time < _THREATS[threatText][2])
                        _THREATS[threatText][2] = time;
                    else if (time > _THREATS[threatText][3])
                        _THREATS[threatText][3] = time;

                    _ = _THREATS[threatText][4];

                    for (var j = 0; j < DOT_COLUMNS.length; j++) {
                        var column = DOT_COLUMNS[j];
                        if (data[column] !== _[column])
                            if (typeof _[column] === "string") {
                                var original = _[column];
                                _[column] = { };
                                _[column][original] = true;
                            }
                            _[column][data[column]] = true;
                    }
                }

                _ = data[LOG_COLUMNS.SRC_IP];
                if (!(_ in _SOURCES))
                    _SOURCES[_] = 1;
                else
                    _SOURCES[_] += 1;

                if (!(_ in _SOURCE_EVENTS)) {
                    _SOURCE_EVENTS[_] = {};
                    for (var key in TRAIL_TYPES)
                        _SOURCE_EVENTS[_][key] = 0;
                }
                _SOURCE_EVENTS[_][data[LOG_COLUMNS.TYPE]] += 1;

                match = time.match(/(\d{4})\-(\d{2})\-(\d{2}) (\d{2}):(\d{2}):(\d{2})/);

                if (match !== null) {
                    var date = new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]), parseInt(match[4]), parseInt(match[5]), parseInt(match[6]));
                    var hour = Math.floor(date.getTime() / 60 / 60 / 1000);

                    if (!(hour in _HOURS)) {
                        _HOURS[hour] = {};

                        for (var type in TRAIL_TYPES)
                            _HOURS[hour][type] = 0;
                    }

                    _HOURS[hour][data[LOG_COLUMNS.TYPE]] += 1;
                }
            }
        },
        complete: function() {
            // threat sensor first_time last_time count src_ip src_port dst_ip dst_port proto type trail info reference tags
            for (var threatText in _THREATS) {
                var threatUID = getThreatUID(threatText);
                var item = _THREATS[threatText];
                var count = item[0];
                var times = item[1];
                var minTime = item[2];
                var maxTime = item[3];
                var data = item[4];
                var row = [];

                var storedLocally = $.jStorage.get(threatUID);
                var tagData = "";
            
                if (storedLocally !== null)
                    tagData = storedLocally.tagData;

                for (var i = 0; i < DOT_COLUMNS.length; i++) {
                    var column = DOT_COLUMNS[i];

                    if (typeof data[column] !== "string") {
                        var _ = [];
                        for (var item in data[column])
                            _.push(item);
                        if ((column === LOG_COLUMNS.SRC_PORT) || (column === LOG_COLUMNS.DST_PORT))
                            _.sort(function(a, b) {
                                a = parseInt(a);
                                b = parseInt(b);
                                return a < b ? -1 : (a > b ? 1 : 0);
                            })
                        else if ((column === LOG_COLUMNS.SRC_IP) || (column === LOG_COLUMNS.DST_IP))
                            _.sort(function(a, b) {
                                a = _ipSortingValue(a);
                                b = _ipSortingValue(b);
                                return a < b ? -1 : (a > b ? 1 : 0);
                            })
                        else
                            _.sort();
                        data[column] = _.join(", ");
                    }
                }

                row.push(threatUID);
                row.push(data[LOG_COLUMNS.SENSOR]);
                row.push(times);
                row.push(minTime);
                row.push(maxTime);
                row.push(data[LOG_COLUMNS.SRC_IP]);
                row.push(data[LOG_COLUMNS.SRC_PORT]);
                row.push(data[LOG_COLUMNS.DST_IP]);
                row.push(data[LOG_COLUMNS.DST_PORT]);
                row.push(data[LOG_COLUMNS.PROTO]);
                row.push(data[LOG_COLUMNS.TYPE]);
                row.push(data[LOG_COLUMNS.TRAIL]);
                row.push(data[LOG_COLUMNS.INFO]);
                row.push(data[LOG_COLUMNS.REFERENCE]);
                row.push(tagData);

                _DATASET.push(row);
            }

            if (demo) {
                alertify.log("Showing demo data");

                document.title = "Maltrail (demo)"
                $("#period_label").html("demo");
            }
            else {
                if (_DATASET.length > 0)
                    alertify.success("Processed " + numberWithCommas(_TOTAL_EVENTS) + " events");
                else
                    alertify.log("No events found");

                var period = "";

                if (typeof from !== 'undefined') {
                    period += formatDate(from);
                    if (typeof to !== 'undefined')
                        period += "-" + formatDate(to);
                }

                if (document.title.indexOf("unauthorized") === -1)
                    document.title = "Maltrail (" + period + ")";

                scrollTo("#main_container");

                var _ = moment(dayStart(from)).from(dayStart(new Date()));
                if (_.indexOf("seconds") != -1)
                    _ = "today";

                $("#period_label").html("<b>" + period + "</b> (" + _ + ")");
            }

            $("#heatmap_container").hide();

            try {
                initDetails();
                initVisual();
            }
            catch(err) {
                alert(err);
            }

            $("#main_container").toggleClass("hidden", false);
            $("#main_container").children().toggleClass("hidden", false);  // Reference: http://stackoverflow.com/a/4740050
            $(".dynamicsparkline").parent().children().toggleClass("hidden", false);
            $.sparkline_display_visible();
            $("#chart_area").empty();

            if (jQuery.isEmptyObject(_HOURS))
                $("li.status-button").css("cursor", "default");
            else
                $("li.status-button").css("cursor", "pointer");

            resetStatusButtons();

            $("body").loader("hide");
        },
    });
}

function resetStatusButtons() {
    statusButtons = $("li.status-button");
    for (var i = 0; i < statusButtons.length; i++) {
        var button = statusButtons[i];
        var color = button.style.background.match(/(rgb\([^)]+\)) 100%/)[1];
        var components = color.match(/\d+/g);
        var luminescence = -0.2;
        for (var j = 0; j < components.length; j++) {
            var component = components[j];
            color = color.replace(component, Math.round(Math.min(Math.max(0, parseInt(component) + (parseInt(component) * luminescence)), 255)));
        }
        button.style.border = "1px solid " + color;
        button.style["-webkit-box-shadow"] = "inset 0px -2px " + color;
        button.style.boxShadow = "inset 0px -2px " + color;
        button.style.textShadow = "0 -2px 0 " + color;
    }
}

function scrollTo(id) {
    if ($(id).length > 0)
        $("html, body").animate({
            scrollTop: $(id).offset().top
        }, 300);
}

function addrToInt(value) {
    var _ = value.split('.');
    return (_[0] << 24) + (_[1] << 16) + (_[2] << 8) + (_[3] << 0);
}

function makeMask(bits) {
    return 0xffffffff ^ (1 << 32 - bits) - 1;
}

function netmaskValidate(netmask) {
    var match = netmask.match(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\/\d{1,2}$/);
    return match !== null
}

/*
function filterDataset(netmask) {
    var parts = netmask.split('/');

    if (parts.length === 2) {
        var mask = makeMask(parts[1]);
        var check = mask & addrToInt(parts[0]);

        SHOWN_DATASET = [];
        for (var index = 0; index < ORIGINAL_DATASET.length; index++) {
            row = ORIGINAL_DATASET[index];
            if (((addrToInt(row[DATATABLES_COLUMNS.SRC_IP]) & mask) === check) || ((addrToInt(row[DATATABLES_COLUMNS.DST_IP]) & mask) === check))
                SHOWN_DATASET.push(row);
        }
        initVisual();
        initDetails();
    }
    else if (netmask.length === 0) {
        SHOWN_DATASET = ORIGINAL_DATASET;
        initVisual();
        initDetails();
    }

    $(".alertify-log").remove();

    if (netmask.length > 0)
        alertify.log("Using network filter '" + netmask + "'", "", 0);

    if (SHOWN_DATASET.length > 0)
        alertify.success("Filtered " + SHOWN_DATASET.length + " events" + " (out of " + ORIGINAL_DATASET.length + ")");
    else
        alertify.log("No events found");
}
*/

function searchTipToTab(query) {
    var win = window.open(SEARCH_TIP_URL.replace("${query}", query), '_blank');

    // Reference: http://stackoverflow.com/a/19851803
    if(win) {
        // Browser has allowed it to be opened
        win.focus();
    } else {
        // Broswer has blocked it
        alert('Please allow popups for this site');
    }
}

function tagInputKeyUp(event, forcedelete) {
    var table, position;
    var tagData = null;
    var newTag = event.target.value;

    if (event.target.parentNode === null)
        return;

    if ((typeof forcedelete !== "undefined") || (event.keyCode === 8)) {  // appendFilter or Delete
        if ((typeof newTag === "undefined") || (newTag.length === 0)) {
            if ((event.keyCode === 8) && (_DELETE_DELETE_PRESS != true)) {
                _DELETE_DELETE_PRESS = true;
                return;
            }
            table = $('#details').dataTable();
            position = table.fnGetPosition(event.target.parentNode);
            tagData = table.fnGetData(event.target.parentNode);

            if (tagData.length > 0) {
                if (event.target.classList.contains("tag-input")) {
                    var i = tagData.lastIndexOf('|');
                    if (i > 0)
                        tagData = tagData.substring(0, i);
                    else
                        tagData = "";
                }
                else if (event.target.classList.contains("tag")) {
                    var tag = event.target.innerHTML;
                    var regex = new RegExp("(^|\\|)" + escapeRegExp(tag) + "($|\\|)");
                    tagData = charTrim(tagData.replace(regex, '|'), '|');
                }
            }
        }
    }
    else if ((typeof event.keyCode === "undefined") || (event.keyCode === 13)) {  // blur or Enter
        if (newTag.length > 0) {
            table = $('#details').dataTable();
            newTag = newTag.replace(/[^a-zA-Z0-9_]/g, "");
            position = table.fnGetPosition(event.target.parentNode);
            tagData = table.fnGetData(event.target.parentNode);

            if (!(new RegExp("(^|\\|)" + escapeRegExp(newTag) + "($|\\|)").test(tagData)))
                tagData = tagData + '|' + newTag;
            //$(event.target).before(getTagHtml(newTag));
            //newTag = "";
        }
    }

    _DELETE_DELETE_PRESS = false;

    if (tagData !== null) {
        var api = table.api();
        var threat = table.fnGetData(position[0], DATATABLES_COLUMNS.THREAT);
        var threatText = (table.fnGetData(position[0], DATATABLES_COLUMNS.SRC_IP) + THREAT_INFIX + table.fnGetData(position[0], DATATABLES_COLUMNS.TRAIL));
        var row = api.row(position[0]);
        var data = row.data();

        $.jStorage.set(threat, { threatText: threatText, tagData: tagData });
        
        data[DATATABLES_COLUMNS.TAGS] = tagData;

        row.invalidate();
        api.draw(false);
    }
}

function stopPropagation(event) {
    if (event.stopPropagation) {
        event.stopPropagation();   // W3C model
    } else {
        event.cancelBubble = true; // IE model
    }
}

function _sort(obj) {
    var tuples = [];

    for (var key in obj) {
        if (typeof obj[key] !== "function")
            tuples.push([key, obj[key]]);
    }

    tuples.sort(function(a, b) {
        a = a[1];
        b = b[1];
        return a > b ? -1 : (a < b ? 1 : 0);
    });

    return tuples;
}

function _ipSortingValue(a) {
    var x = "";

    match = a.match(/\d+\.\d+\.\d+\.\d+/);
    if (match !== null) {
        var m = match[0].split(".");

        for (var i = 0; i < m.length; i++) {
            var item = m[i];

            if(item.length === 1) {
                x += "00" + item;
            } else if(item.length === 2) {
                x += "0" + item;
            } else {
                x += item;
            }
        }
    }

    return x;
}

function _ipCompareValues(a, b) {
    // Reference: http://stackoverflow.com/a/949970
    return _ipSortingValue(a) - _ipSortingValue(b);
}

function copyEllipsisToClipboard(event) {
    var target = $(event.target);
    var text = target.parent().title;
    var common = target.parent().parent().html().replace(/<[^>]+>/g, "");
    if (!text) {
        var tooltip = $(".ui-tooltip");
        if (tooltip.length > 0) {
            text = tooltip.html().replace(/<[^>]+>/g, "");

            if (common) {
                var _ = text.split(", ");
                for (var i = 0; i < _.length; i++)
                    _[i] += common;
                text = _.join(", ");
            }
        }
        tooltip.remove();
    }
    window.prompt("Copy to clipboard (Ctrl+C)", text);
}

function appendFilter(filter, event, istag) {
    try {
        var table = $('#details').dataTable();
        var currentFilter = table.api().search();

        // Reference: http://stackoverflow.com/a/3076685
        if (typeof event !== "undefined") {
            stopPropagation(event);

            if (event.button === 0) {  // left mouse button
                if (!(new RegExp("\\b" + escapeRegExp(filter) + "\\b").test(currentFilter))) {
                    currentFilter = currentFilter + " " + filter;
                    table.fnFilter(currentFilter.trim());
                    // table.DataTable().columns(11).search(currentFilter.trim()).draw();
                }
            }
            else if ((istag === true) && (event.button === 1)) {  // middle mouse button
                tagInputKeyUp(event, true);
                event.preventDefault();
            }
        }
        else {
            if (!(new RegExp("\\b" + escapeRegExp(filter) + "\\b").test(currentFilter))) {
                currentFilter = currentFilter + " " + filter;
                table.fnFilter(currentFilter.trim());
            }
        }

        $(".searchtip").remove();
        clearTimeout(SEARCH_TIP_TIMER);
        $(".ui-tooltip").remove();
        $('#details_filter label input').get(0).scrollLeft = $('#details_filter label input').get(0).scrollWidth;
        //$('#details_filter label input').get(0).focus();
    }
    catch(err) {
    }
}

// DataTables part
function initDetails() {
    var details = $('#details').dataTable( {
        bDestroy: true,
        bAutoWidth: false,
        data: _DATASET,
        columns: [
            { title: "threat", type: "threat", class: "center" },
            { title: "sensor", class: "center" },
            { title: "events", type: "events", class: "right" },
            { title: "first_seen", class: "center" },
            { title: "last_seen", class: "center" },
            { title: "src_ip", type: "ip-address", class: "right" },
            { title: "src_port", type: "port", class: "center" },
            { title: "dst_ip", type: "ip-address", class: "right" },
            { title: "dst_port", type: "port", class: "center" },
            { title: "proto", class: "center" },
            { title: "type", class: "center" },
            { title: "trail", class: "trail" },
            { title: "info" },
            { title: "reference" },
            { title: "tags" },
        ],
        search: {
            caseInsensitive: false
        },
        iDisplayLength: 25,
        aLengthMenu: [ [10, 25, 50, 100], [10, 25, 50, 100] ],
        aaSorting: [ [DATATABLES_COLUMNS.LAST_TIME, 'desc'] ],
        bDeferRender: true,
        searchDelay: 500,
        columnDefs: [
            {
                orderSequence: [ "desc", "asc" ], 
                targets: [ DATATABLES_COLUMNS.EVENTS ]
            },
            {
                orderSequence: [ "desc", "asc" ], 
                targets: [ DATATABLES_COLUMNS.LAST_TIME ]
            },            {
                render: function (data, type, row) {
                    if (data.indexOf(',') > -1)
                        data = "<span title='" + data + "' onmouseup='copyEllipsisToClipboard(event)'>" + ELLIPSIS + "</span>";
                    else {
                        var port = parseInt(data);
                        if (port in TOP_PORTS)
                            data = data + " (" + TOP_PORTS[port] + ")";
                    }
                    return data;
                },
                targets: [ DATATABLES_COLUMNS.SRC_PORT, DATATABLES_COLUMNS.DST_PORT ]
            },
            {
                render: function (data, type, row) {
                    if (data.indexOf(',') > -1) {
                        var common = "";
                        if (data.indexOf('(') > -1) {
                            var _ = data.split(',')[0];
                            if (_.indexOf('(') > -1)
                                common = _.replace(/\([^)]+\)/g, "");
                        }
                        data = "<span title='" + data.split(common).join("").replace(/[()]/g, "") + "' onmouseup='copyEllipsisToClipboard(event)'>" + ELLIPSIS + "</span>" + common;
                    }
                    return data;
                },
                targets: [ DATATABLES_COLUMNS.SRC_IP, DATATABLES_COLUMNS.DST_IP, DATATABLES_COLUMNS.TRAIL, DATATABLES_COLUMNS.PROTO ]
            },
            {
                render: function ( data, type, row ) {
                    return data.length + '<span class="hidden">' + data.join(", ") + '</span>';
                },
                targets: DATATABLES_COLUMNS.EVENTS
            },
            {
                render: function ( data, type, row ) {
                    return '<span class="label-type label-' + data.toLowerCase() + '">' + data + '</span>';
                },
                targets: DATATABLES_COLUMNS.TYPE
            },
            {
                render: function (data, type, row) {
                    var parts = data.split(' ');
                    var day = parts[0].split('-')[2];
                    var suffix = DAY_SUFFIXES[parseInt(day)] || "th";
                    return "<div title='" + data + "'><span class='time-day'>" + day + "<sup>th</sup></span> " + parts[1].split('.')[0] + "</div>";
                },
                targets: [ DATATABLES_COLUMNS.FIRST_TIME, DATATABLES_COLUMNS.LAST_TIME ],
            },
            {
                render: function (data, type, row) {
                    return '<div class="label-type ' + getContrastYIQ(data.substring(0, 6)) + '-label-text" style="background-color: #' + data.substring(0, 6) + '">' + data + '</div>';
                },
                targets: DATATABLES_COLUMNS.THREAT
            },
            {
                render: function (data, type, row) {
                    return (data.substr(0, 1) != '(') ? '<i>' + data + '</i>': data;
                },
                targets: DATATABLES_COLUMNS.REFERENCE
            },
            {
                render: function (data, type, row) {
                    var retval = "";
                    var tags = data.split('|');
                    for (var index in tags) {
                        var tag = tags[index];
                        if ((typeof tag !== "function") && (tag.length > 0)) {
                            retval += getTagHtml(tag);
                        }
                    }
                    retval += "<input class='tag-input' type='text' onkeyup='tagInputKeyUp(event)' onblur='tagInputKeyUp(event)'>";
                    return retval;
                },
                targets: DATATABLES_COLUMNS.TAGS
            },
            {
               width: "1%",
               targets: [ DATATABLES_COLUMNS.THREAT, DATATABLES_COLUMNS.SENSOR, DATATABLES_COLUMNS.EVENTS, DATATABLES_COLUMNS.FIRST_TIME, DATATABLES_COLUMNS.LAST_TIME, DATATABLES_COLUMNS.SRC_IP, DATATABLES_COLUMNS.SRC_PORT, DATATABLES_COLUMNS.DST_IP, DATATABLES_COLUMNS.DST_PORT, DATATABLES_COLUMNS.PROTO, DATATABLES_COLUMNS.TYPE ]
            },
        ],
        oLanguage: {
            sLengthMenu: "_MENU_ threats per page",  // Reference: http://www.sprymedia.co.uk/dataTables/example_language.html
            sZeroRecords: "No matching threats found",
            sInfo: "Showing _START_ to _END_ of <span class='details_total'>_TOTAL_</span> threats",
            sInfoEmpty: "Showing 0 to 0 of <span class='details_total'>0</span> total threats",
            sInfoFiltered: "(filtered from _MAX_ total threats)",
            sSearch: "Filter: "
        },
        dom: 'T<"clear">lfrtip',
        tableTools: {
            aButtons: [
                {
                    sExtends: "text",
                    sButtonText: "Clear",
                    fnClick: function (nButton, oConfig, oFlash) {
                        var table = $('#details').dataTable();
                        var settings = table.fnSettings();
                        table.fnFilter("");
//                         if ((settings._iDisplayLength > 0) && (settings._iDisplayLength < 30))
//                             $("html, body").animate({ scrollTop: $(document).height() }, "slow");
                    }
                },
                "print",
                {
                    sExtends: "collection",
                    sButtonText: "Tools",
                    aButtons: [
                        {
                            sExtends: "text",
                            sButtonText: "Flush local storage",
                            fnClick: function ( nButton, oConfig, oFlash ) {
                                $('<div id="dialog-confirm" title="Flush local storage?"></div>').appendTo('body')
                                .html('<p><span class="ui-icon ui-icon-alert" style="float:left; margin:0 7px 20px 0;"></span>These items will be permanently deleted and<br>won\'t be recoverable. Are you sure?</p>')
                                .dialog({
                                    resizable: false,
                                    width: "auto",
                                    height: "auto",
                                    modal: true,
                                    buttons: {
                                        Cancel: function() {
                                            $(this).dialog("close");
                                        },
                                        "Delete all items": function() {
                                            $(this).dialog("close");
                                            $.jStorage.flush();
                                            location.reload();
                                        },
                                    }
                                });
                            }
                        },
                    ]
                }
            ],
        },
        fnRowCallback: function(nRow, aData, iDisplayIndex, iDisplayIndexFull) {
            function nslookup(event, ui) {
                var elem = $(this);
                var html = elem.parent().html();
                var match = html.match(/\d+\.\d+\.\d+\.\d+/);

                if (match !== null) {
                    var ip = match[0];
                    $.ajax("https://stat.ripe.net/data/whois/data.json?resource=" + ip, { dataType:"jsonp", ip: ip })
                    .success(function(json) {
                        // Reference: http://bugs.jqueryui.com/ticket/8740#comment:21
                        var found = null;
                        var msg = "";

                        for (var i = json.data.records.length - 1; i >= 0 ; i--) {
                            if ((json.data.records[i][0].key.toLowerCase().indexOf("inetnum") != -1) || (json.data.records[i][0].key.toLowerCase().indexOf("netrange") != -1)){
                                found = i;
                                break;
                            }
                        }

                        if (found !== null) {
                            for (var j = 0; j < json.data.records[found].length; j++) {
                                msg += json.data.records[found][j].key + ": " + json.data.records[found][j].value;
                                msg += "<br>";
                            }
                            msg = msg.replace(/(\-\+)+/g, "--").replace(/(\-\+)+/g, "--");
                        }

                        $.ajax("https://stat.ripe.net/data/dns-chain/data.json?resource=" + ip, { dataType:"jsonp", ip: ip, msg: msg})
                        .success(function(json) {
                            var _ = json.data.reverse_nodes[this.ip];
                            if ((_.length === 0)||(_ === "localhost")) {
                                /*var parts = this.ip.split('.');
                                _ = "";
                                for (var i = parts.length - 1; i >= 0; i--)
                                    _ += parts[i] + ".";
                                _ += "in-addr.arpa";*/
                                _ = "-";
                            }
                            var msg = "<p><b>" + _ + "</b></p>" + this.msg;
                            ui.tooltip.find(".ui-tooltip-content").html(msg);
                        });
                    });
                }
            }

            $('[title]', nRow).tooltip();

            if (THREAT_PIC_HASH !== null) {
                var cell = $('td:eq(' + (DATATABLES_COLUMNS.THREAT) + ')', nRow);
                var div = cell.find("div");
                div[0].title = "";
                div.tooltip({ content: "<img src='" + THREAT_PIC_HASH + div[0].innerHTML + "?size=64x64' width='64' height='64'>", position: { my: "left center", at: "right+10 top" }});
            }

            $.each([DATATABLES_COLUMNS.SRC_IP, DATATABLES_COLUMNS.DST_IP], function(index, value) {
                var cell = $('td:eq(' + value + ')', nRow);

                if (cell === null)
                    return false;

                var html = cell.html();

                if (html === null)
                    return false;

                if ((html.indexOf('flag') > -1) || (html.indexOf('lan') > -1) || (html.indexOf(',') > -1) || (html.indexOf(ELLIPSIS) > -1))
                    return false;

                var match = html.match(/\d+\.\d+\.\d+\.\d+/);
                if (match === null)
                    return false;

                var img = "";
                var ip = match[0];
                var options = { content: "please wait...", open: nslookup, position: { my: "left center", at: "right+10 top-50" } };

                if (!isLocalAddress(ip)) {
                    if (!(ip in IP_COUNTRY)) {
                        IP_COUNTRY[ip] = null;
                        $.ajax("https://stat.ripe.net/data/geoloc/data.json?resource=" + ip, { dataType:"jsonp", ip: ip, cell: cell })
                        .success(function(json) {
                            var span_ip = $("<span title=''/>").html(this.ip + " ");

                            if ((json.data.locations.length > 0) && (json.data.locations[0].country !== "ANO")) {
                                IP_COUNTRY[this.ip] = json.data.locations[0].country.toLowerCase().split('-')[0];
                                img = '<img src="images/blank.gif" class="flag flag-' + IP_COUNTRY[this.ip] + '" title="' + IP_COUNTRY[this.ip].toUpperCase() + '" />';  // title="' + IP_COUNTRY[this.ip].toUpperCase() + '" 
                                span_ip.tooltip(options);
                            }
                            else {
                                IP_COUNTRY[this.ip] = "unknown";
                                img = '<img src="images/blank.gif" class="flag flag-unknown" title="UNKNOWN"/>';
                            }
                            
                            this.cell.html("").append(span_ip).append($(img).tooltip());
                        });
                    }
                    else if (IP_COUNTRY[ip] !== null) {
                        img = ' <img src="images/blank.gif" class="flag flag-' + IP_COUNTRY[ip] + '" title="' + IP_COUNTRY[ip].toUpperCase() + '" />'

                        var span_ip = $("<span title=''/>").html(ip + " ");
                        span_ip.tooltip(options);

                        cell.html("").append(span_ip).append($(img).tooltip());
                    }
                    else {
                        setTimeout(function(ip, cell){
                            html = cell.html();
                            if ((IP_COUNTRY[ip] !== null) && (html.indexOf("flag-") === -1)) {
                                img = ' <img src="images/blank.gif" class="flag flag-' + IP_COUNTRY[ip] + '" title="' + IP_COUNTRY[ip].toUpperCase() + '" />'

                                var span_ip = $("<span title=''/>").html(ip + " ");
                                span_ip.tooltip(options);

                                cell.html("").append(span_ip).append($(img).tooltip());
                            }
                        }, 2000, ip, cell);
                    }
                }
                else {
                    img = '<img src="images/lan.gif" height="11px" style="margin-bottom: 2px" title="LAN">';
                    cell.html(html + " ").append($(img).tooltip());
                }
            });

            /*
            var cell = $('td:eq(' + (DATATABLES_COLUMNS.EVENTS) + ')', nRow);
            var div = cell.find("div");
            div[0].title = "";
            // $(".ui-tooltip").append($("<div>bla</div>"))

            div.tooltip({ content: function(callback) { 
                setTimeout(function() {
                    var wewe = $("<div id='wewe'>foobar</div>");
                    $('#wewe').sparkline([1,2,3,4,5,4,3,2,1], {disabledHiddenCheck: true});
                    $(".ui-tooltip").append(wewe);
                    setTimeout(function() {
                        $.sparkline_display_visible();
                    }, 100);
                }, 100); 
            return "<div id='ticker'>aa</div>"; }, position: { my: "left center", at: "right+10 top" }});
            */
        },
    });

    details.off("mouseenter");  // clear previous
    details.on("mouseenter", "td", function(event) {
        var cell = event.target;
        if (event.target.classList.contains("trail")) {
            clearTimeout(SEARCH_TIP_TIMER);
            SEARCH_TIP_TIMER = setTimeout(function(cell, event) {
                if ($(".ui-tooltip").length === 0) {
                    var query = cell[0].innerHTML.replace(/<[^>]+>/g, "").replace(/[()]/g, "").split('/')[0];
                    $(".searchtip").remove();
                    $("body").append(
                        $('<div class="ui-tooltip searchtip"><div><img src="images/newtab.png" style="cursor: pointer" onclick="searchTipToTab(\'' + query + '\')" title="open in new tab"><img src="images/close.png" style="cursor: pointer; width: 16px; height: 16px" onclick="$(\'.searchtip\').remove()" title="close"></div><iframe src="' + SEARCH_TIP_URL.replace("${query}", query) + '"></iframe><div>')
                        .css('position', 'absolute')
                        .show()
                        .position({ my: "right+10 top-200", of: event })
                        .on("mouseleave", function(){
                            $(".searchtip").remove();
                        })
                    );
                }
            }, 2000, $(this), event);

            $(cell).on("mouseleave", function(mouseenter) {
                clearTimeout(SEARCH_TIP_TIMER);
            });
        }
    });

    details.off("dblclick");  // clear previous
    details.on("dblclick", "td", function (){
        var table = $('#details').dataTable();
        var filter = "";

        if ($(this).find(".info-input").length > 0)
            filter = $(this).find(".info-input")[0].value;
        else if ($(this).hasClass("trail"))
            filter = $(this).html().replace(/\([^)]+\)/g, "");
        else if ($(this).find(".time-day").length > 0)
            filter = $(this).find("div")[0].lastChild.textContent;
        else if (this.innerHTML.indexOf("ellipsis") > -1) {
            match = this.innerHTML.match(/title=["']([^"']+)/);
            if (match !== null)
                filter = match[1].replace(/, /g, " ");
            else {
                var tooltip = $(".ui-tooltip");
                if (tooltip.length > 0)
                    filter = tooltip.html().replace(/, /g, " ");
            }
        }
        else {
            filter = this.innerHTML.replace(/<.+?>/g, " ");
        }

        filter = filter.replace(/\s+/g, " ").trim();
        filter = $('<div/>').html(filter).text();
        appendFilter(filter);
    });

    details.off("mouseup");  // clear previous
    details.on("mouseup", "td", function (event) {
        if (event.button === 0) {  // left mouse button
            if (event.target.classList.contains("tag"))
                appendFilter(event.target.innerHTML, event, true);
            else if (event.target.classList.contains("label-type"))
                if (event.target.innerHTML.toUpperCase() === event.target.innerHTML)
                    appendFilter('" ' + event.target.innerHTML + '"', event);
                else
                    appendFilter(event.target.innerHTML, event);
        }
        else if (event.button === 1) {  // middle mouse button
            if (event.target.classList.contains("tag"))
                appendFilter(event.target.innerHTML, event, true);
        }
        else if (event.button === 2) {  // right mouse button
            stopPropagation(event);
        }
    });

    details.off("contextmenu");  // clear previous
    details.on("contextmenu", "td", function (){
        return false;
    });
}

String.prototype.hashCode = function() {
    return murmurhash3_32_gc(this, 13);
};

// Reference: http://stackoverflow.com/a/12710609
Array.prototype.insert = function (index, item) {
  this.splice(index, 0, item);
};

Array.prototype.clean = function(deleteValue) {
    for (var i = 0; i < this.length; i++) {
        if (this[i] === deleteValue) {         
            this.splice(i, 1);
            i--;
        }
    }
    return this;
};

if (typeof String.prototype.startsWith !== "function") {
    String.prototype.startsWith = function (str){
        return this.indexOf(str) === 0;
    };
}

// Reference: http://stackoverflow.com/a/2548133
if (typeof String.prototype.endsWith !== "function") {
    String.prototype.endsWith = function(suffix) {
        return this.indexOf(suffix, this.length - suffix.length) !== -1;
    };
}

// Reference: http://stackoverflow.com/a/6700
Object.size = function(obj) {
    var size = 0, key;
    for (key in obj) {
        if (obj.hasOwnProperty(key))
            size++;
    }
    return size;
};

$.fn.dataTable.ext.search.push(    
    function(settings, data, dataIndex) {
        return true;
    }
);

jQuery.extend(jQuery.fn.dataTableExt.oSort, {
    // Reference: http://cdn.datatables.net/plug-ins/3cfcc339e89/sorting/date-euro.js
    "date-custom-pre": function ( a ) {
        var x;
        if ( $.trim(a) !== '' ) {
            var frDatea = $.trim(a).split(' ');
            var frTimea = frDatea[1].split('.')[0].split(':');
            var frUseca = frDatea[1].split('.')[1];
            var frDatea2 = frDatea[0].split('-');

            x = (frDatea2[0] + frDatea2[1] + frDatea2[2] + frTimea[0] + frTimea[1] + frTimea[2] + frUseca) * 1;
        }
        else {
            x = Infinity;
        }
        return x;
    },
    "date-custom-asc": function ( a, b ) {
        return a - b;
    },
    "date-custom-desc": function ( a, b ) {
        return b - a;
    }
});

jQuery.extend(jQuery.fn.dataTableExt.oSort, {
    // Reference: https://cdn.datatables.net/plug-ins/3cfcc339e89/sorting/ip-address.js
    "ip-address-pre": function (a) {
        return _ipSortingValue(a);
    },

    "ip-address-asc": function ( a, b ) {
        return ((a < b) ? -1 : ((a > b) ? 1 : 0));
    },

    "ip-address-desc": function ( a, b ) {
        return ((a < b) ? 1 : ((a > b) ? -1 : 0));
    }
});

jQuery.extend(jQuery.fn.dataTableExt.oSort, {
    "events-pre": function (a) {
        return parseInt(a.replace(/<span.+<\/span>/g, ""));
    },

    "events-asc": function ( a, b ) {
        return ((a < b) ? -1 : ((a > b) ? 1 : 0));
    },

    "events-desc": function ( a, b ) {
        return ((a < b) ? 1 : ((a > b) ? -1 : 0));
    }
});

jQuery.extend(jQuery.fn.dataTableExt.oSort, {
    // Reference: https://cdn.datatables.net/plug-ins/3cfcc339e89/sorting/ip-address.js
    "port-pre": function ( a ) {
        var x = 0;
        var match = a.match(/\d+/);

        if (match !== null) {
            x = parseInt(match[0]);
        }

        return x;
    },

    "port-asc": function ( a, b ) {
        return ((a < b) ? -1 : ((a > b) ? 1 : 0));
    },

    "port-desc": function ( a, b ) {
        return ((a < b) ? 1 : ((a > b) ? -1 : 0));
    }
});

jQuery.extend(jQuery.fn.dataTableExt.oSort, {
    "threat-pre": function ( a ) {
        var x = "";
        var match = a.match(/([0-9a-fA-F]{8})/);

        if (match !== null)
            //x = parseInt(match[1], 16);
            x = match[1];

        return x;
    },

    "threat-asc": function ( a, b ) {
        return ((a < b) ? -1 : ((a > b) ? 1 : 0));
    },

    "threat-desc": function ( a, b ) {
        return ((a < b) ? 1 : ((a > b) ? -1 : 0));
    }
});

function setChartScale(options, maxValue) {
    if (maxValue > 0) {
        stepValue = Math.pow(10, Math.floor(Math.log(maxValue) / Math.LN10));
        options.scaleOverride = true;
        options.scaleStartValue = 0;
        while ((stepValue > 0) && (stepValue === Math.floor(stepValue))) {
            options.scaleStepWidth = stepValue;
            options.scaleSteps = Math.ceil(maxValue / stepValue);
            if ((options.scaleSteps >= 5) || (stepValue === 1))
                break;
            else
                stepValue = stepValue / 2;
        }
    }
}

function drawInfo(type) {
    //var color = $("#" + type.toLowerCase() + "_count").parent()[0].style["background-color"];
    //$("li.status-button").css("opacity", "0.6");
    $("#chart_area").empty();

    if (jQuery.isEmptyObject(_HOURS))
        return;

    if ($("#" + type.toLowerCase() + "_count").parent()[0].style.boxShadow.startsWith("none")) {
        resetStatusButtons();
        return;
    }

    resetStatusButtons();
    $("#" + type.toLowerCase() + "_count").parent().css("box-shadow", "none");
    $("#" + type.toLowerCase() + "_count").parent().css("text-shadow", "none");
    $("#" + type.toLowerCase() + "_count").parent().css("border", "none");

    if (type === "Events") {
        var ticks = {};
        var labels = [];
        var first = true;
        var datasets = [];

        for (var type in TRAIL_TYPES) {
            var _ = [];

            ticks[type] = [];

            for (var hour in _HOURS)
                _.push([hour >>> 0, _HOURS[hour][type]]);

            _.sort(function(a, b) {
                a = a[0];
                b = b[0];

                return a < b ? -1 : (a > b ? 1 : 0);
            });

            for (var i = 0; i < _.length; i++) {
                var date = new Date(_[i][0] * 60 * 60 * 1000);
                var hours = date.getHours();

                if (first)
                    labels.push(pad(hours, 2) + "h");

                ticks[type].push(_[i][1]);
            }

            first = false;

            datasets.push(
                {
                    label: type,
                    strokeColor: TRAIL_TYPES[type],
                    pointColor: TRAIL_TYPES[type],
                    pointHighlightFill: "#fff",
                    data: ticks[type],
                }
            );
        }

        var data = {
            labels: labels,
            datasets: datasets
        };
        var options = {
            //scaleGridLineColor: "#abb2b4",
            scaleShowVerticalLines: false,
            scaleShowHorizontalLines: false, // because StackedBar doesn't show them properly
            datasetFill: false,
            bezierCurve: false,
            pointDotRadius: 5,
            //scaleShowGridLines: false
            tooltipTemplate: "<%if (label){%><%=label.replace(/[^0-9]/, '')%>:00h-<%=label.replace(/[^0-9]/, '')%>:59h: <%}%><%= value %> events",
            pointHitDetectionRadius: 5,
        };

        //setChartScale(options, _MAX_EVENTS_PER_HOUR);

        var ctx = $('<canvas id="chart_canvas" width="' + CHART_WIDTH + '" height="' + CHART_HEIGHT + '"></canvas>').appendTo('#chart_area')[0].getContext("2d");
        var chart = new Chart(ctx);
        var line = chart.Line(data, options);

        chart.canvas.onclick = function(evt) {
            var activePoints = line.getPointsAtEvent(evt);

            if (activePoints.length > 0) {
                var filter = '" ' + activePoints[0].label.replace(/[^0-9]/g, "") + ':"';
                var table = $('#details').dataTable();

                table.fnFilter(filter);
                scrollTo("#details_section");
            }
        };
    }
    else if (type === "Trails") {
        var data = [];
        var options = {
            segmentStrokeWidth: 1,
            tooltipTemplate: "<%if (label){%><%=label%>: <%}%><%= value %> events",
            animationSteps: 30,
        };
        var other = 0;
        var _ = {}

        for (var type in TRAIL_TYPES)
            _[type] = [];

        var threshold = 0;
        for (var i = 0; i < _TRAILS_SORTED.length; i++)
            threshold += _TRAILS_SORTED[i][1];

        threshold = threshold / 100;

        for (var i = 0; i < _TRAILS_SORTED.length; i++) {
            var item = _TRAILS_SORTED[i];

            if (item[1] >= threshold) {
                var match = item[0].match(/(.+?) \(([^)]+)\)/);
                var type = match[2];
                var count = item[1];

                data.push({value: count, label: item[0], color: TRAIL_TYPES[type]})
            }
            else
                other += item[1];
        }

        if (other > 0)
            data.push({ value: other, label: "Other (<1%)", color: OTHER_COLOR })

        var pie = new d3pie("chart_area", {
            header: {
                title: {
                    fontSize: 1,
                    font: DEFAULT_FONT_FAMILY
                },
                subtitle: {
                    color: "#999999",
                    fontSize: 1,
                    font: DEFAULT_FONT_FAMILY
                },
                titleSubtitlePadding: 0
            },
            footer: {
                color: "#999999",
                fontSize: 1,
                font: DEFAULT_FONT_FAMILY,
                location: "bottom-left"
            },
            size: {
                canvasHeight: CHART_HEIGHT,
                canvasWidth: CHART_WIDTH
            },
            data: {
                content: data
            },
            labels: {
                inner: {
                    hideWhenLessThanPercentage: 101
                },
                mainLabel: {
                    font: DEFAULT_FONT_FAMILY,
                    fontSize: PIE_FONT_SIZE
                },
                percentage: {
                    color: "#ffffff",
                    font: DEFAULT_FONT_FAMILY,
                    decimalPlaces: 0
                },
                value: {
                    color: "#adadad",
                    font: DEFAULT_FONT_FAMILY,
                    fontSize: PIE_FONT_SIZE
                },
                lines: {
                    enabled: true
                }
            },
            tooltips: {
                enabled: true,
                type: "placeholder",
                string: "{label}: {value}, {percentage}%",
                styles: {
                    font: DEFAULT_FONT_FAMILY
                }
            },
            effects: {
                load: {
                    speed: 500
                },
                pullOutSegmentOnClick: {
                    effect: "none",
                }
            },
            misc: {
                gradient: {
                    enabled: true,
                    percentage: 100
                }
            },
            callbacks: {
                onClickSegment: function(a) {
                    var filter = a.data.label.replace(/\(([A-Z]+)\)/g, "$1");

                    if (!filter.startsWith("Other")) {
                        var table = $('#details').dataTable();

                        table.fnFilter(filter);
                        scrollTo("#details_section");
                    }
                }
            }
        });
    }
    else if (type === "Sources") {
        var labels = [];
        var values = [];
        var maxValue = 0;
        var datasets = {};
        var options = {
            //scaleShowVerticalLines: false, // not working properly
        };

        for (var key in TRAIL_TYPES)
            datasets[key] = { fillColor: TRAIL_TYPES[key], data: [] };

        for (var i = 0; i < _TOP_SOURCES.length; i++) {
            labels.push(_TOP_SOURCES[i][0]);
            maxValue = Math.max(_TOP_SOURCES[i][1], maxValue);

            for (var key in TRAIL_TYPES)
                datasets[key].data.push(_SOURCE_EVENTS[_TOP_SOURCES[i][0]][key]);
        }

        _ = [];
        for (var key in TRAIL_TYPES) {
            console.log(key);
            _.insert(0, datasets[key]); // StackedBar is drawing from last to first (for some strange reason)
        }

        var data = {
            labels: labels,
            datasets: _
        };
        var ctx = $('<canvas id="chart_canvas" width="' + CHART_WIDTH + '" height="' + CHART_HEIGHT + '"></canvas>').appendTo('#chart_area')[0].getContext("2d");
        var chart = new Chart(ctx);
        var bar = chart.StackedBar(data, options);

        chart.canvas.onclick = function(evt) {
            var activeBars = bar.getBarsAtEvent(evt);

            if (activeBars.length > 0) {
                var filter = activeBars[0].label;

                if (filter.toLowerCase() != "other") {
                    var table = $('#details').dataTable();

                    table.fnFilter(filter);
                    scrollTo("#details_section");
                }
            }
        };
    }
    else if (type === "Threats") {
        var data = [];
        var options = {
            segmentStrokeWidth: 1,
            tooltipTemplate: "<%if (label){%><%=label%>: <%}%><%= value %> events",
            animationSteps: 30,
        };

        var threshold = 0;
        for (var i = 0; i < _THREATS_SORTED.length; i++)
            threshold += _THREATS_SORTED[i][1];

        threshold = threshold / 100;

        var other = 0;
        for (var i = 0; i < _THREATS_SORTED.length; i++) {
            var item = _THREATS_SORTED[i];

            if (item[1] >= threshold) {
                //var threat = item[0];
                var threat = item[0].replace(/ \([^)]+\)/g, "");
                var count = item[1];
                var color = "#" + threat.substr(0, 6);

                data.push({value: count, label: threat, color: color})
            }
            else
                other += item[1];
        }

        if (other > 0)
            data.push({value: other, label: "Other (<1%)", color: OTHER_COLOR})

        var pie = new d3pie("chart_area", {
            "header": {
                "title": {
                    "fontSize": 1,
                    "font": DEFAULT_FONT_FAMILY
                },
                "subtitle": {
                    "color": "#999999",
                    "fontSize": 1,
                    "font": DEFAULT_FONT_FAMILY
                },
                "titleSubtitlePadding": 0
            },
            "footer": {
                "color": "#999999",
                "fontSize": 1,
                "font": DEFAULT_FONT_FAMILY,
                "location": "bottom-left"
            },
            "size": {
                "canvasHeight": CHART_HEIGHT,
                "canvasWidth": CHART_WIDTH
            },
            "data": {
                "content": data
            },
            "labels": {
                "inner": {
                    "hideWhenLessThanPercentage": 101
                },
                "mainLabel": {
                    "font": DEFAULT_FONT_FAMILY,
                    "fontSize": PIE_FONT_SIZE
                },
                "percentage": {
                    "color": "#ffffff",
                    "font": DEFAULT_FONT_FAMILY,
                    "decimalPlaces": 0
                },
                "value": {
                    "color": "#adadad",
                    "font": DEFAULT_FONT_FAMILY,
                    "fontSize": PIE_FONT_SIZE
                },
                "lines": {
                    "enabled": true
                }
            },
            "tooltips": {
                "enabled": true,
                "type": "placeholder",
                "string": "{label}: {value}, {percentage}%",
                "styles": {
                    "font": DEFAULT_FONT_FAMILY
                }
            },
            "effects": {
                "load": {
                    "speed": 500
                },
                "pullOutSegmentOnClick": {
                    "effect": "none",
                }
            },
            "misc": {
                "gradient": {
                    "enabled": true,
                    "percentage": 100
                }
            },
            "callbacks": {
                onClickSegment: function(a) {
                    var filter = a.data.label.substr(0, 8);

                    if (!filter.startsWith("Other")) {
                        var table = $('#details').dataTable();

                        table.fnFilter(filter);
                        scrollTo("#details_section");
                    }
                }
            }
        });
    }
}

function initVisual() {
    var sparklines = {}
    var min_ = null;
    var max_ = null;
    var sliceColors = [];
    var total = {};
    var data = [];
    var other = 0;

    _MAX_EVENTS_PER_HOUR = 0;
    _TRAILS_SORTED = _sort(_TRAILS);

    for (var type in TRAIL_TYPES) {
        sparklines[type] = [];
        total[type] = 0;
    }

    // Trails sparkline
    var threshold = 0;
    for (var i = 0; i < _TRAILS_SORTED.length; i++)
        threshold += _TRAILS_SORTED[i][1];

    threshold = threshold / 100;

    for (var i = 0; i < _TRAILS_SORTED.length; i++) {
        if (_TRAILS_SORTED[i][1] >= threshold) {
            var type = _TRAILS_SORTED[i][0].match(/\(([A-Z]+)\)/)[1];
            data.push(_TRAILS_SORTED[i][1]);
            sliceColors.push(TRAIL_TYPES[type]);
        }
        else
            other += _TRAILS_SORTED[i][1];
    }

    if (other > 0) {
        data.push(other);
        sliceColors.push(OTHER_COLOR);
    }

    if (data.length === 0) {
        data.push(1);
        sliceColors.push(OTHER_COLOR);
    }

    total["Trails"] = _TRAILS_SORTED.length;

    var options = { type: 'pie', sliceColors: sliceColors, minSpotColor: "", maxSpotColor: "", spotColor: "", highlightSpotColor: "", highlightLineColor: "", tooltipClassname: "", width: '30', height: '30', offset: -90, disableInteraction: true };

    $('#trails_sparkline').sparkline(data, options);

    // Threats sparkline
    var _ = {};
    for (var threat in _THREATS) {
        var threatUID = getThreatUID(threat);
        var count = _THREATS[threat][0];
        var type = _THREATS[threat][4][LOG_COLUMNS.TYPE];
        total[type] += count;
        _[threatUID] = count;
    }

    _THREATS_SORTED = _sort(_);
    var other = 0;

    data.length = 0;
    options.sliceColors = [];

    var threshold = 0;
    for (var i = 0; i < _THREATS_SORTED.length; i++)
        threshold += _THREATS_SORTED[i][1];

    threshold = threshold / 100;

    for (var i = 0; i < _THREATS_SORTED.length; i++) {
        if (_THREATS_SORTED[i][1] >= threshold) {
            data.push(_THREATS_SORTED[i][1]);
            options.sliceColors.push("#" + _THREATS_SORTED[i][0].substr(0, 6));
        }
        else
            other += _THREATS_SORTED[i][1];
    }

    if (other > 0) {
        data.push(other);
        options.sliceColors.push(OTHER_COLOR);
    }

    if (data.length === 0) {
        data.push(1);
        options.sliceColors.push(OTHER_COLOR);
    }

    total["Threats"] = _THREATS_SORTED.length;
    $('#threats_sparkline').sparkline(data, options);

    // URL, DNS and IP sparklines
    for (var hour in _HOURS) {
        if (min_ === null)
            min_ = hour;
        else
            min_ = Math.min(min_, hour);

        if (max_ === null)
            max_ = hour;
        else
            max_ = Math.max(max_, hour);
    }

    if ((min_ !== null) && (max_ !== null)) {
        var _ = 60 * 60 * 1000;
        min_ = dayStart(min_ * _) / _;
        max_ = dayEnd(max_ * _) / _;

        for (var hour = min_; hour <= max_; hour++) {
            if (!(hour in _HOURS)) {
                for (var key in sparklines)
                    sparklines[key].push(0);

                _HOURS[hour] = {};
                for (var type in TRAIL_TYPES)
                    _HOURS[hour][type] = 0;
            }
            else
                for (var key in sparklines) {
                    _MAX_EVENTS_PER_HOUR = Math.max(_MAX_EVENTS_PER_HOUR, _HOURS[hour][key]);
                    sparklines[key].push(_HOURS[hour][key]);
                }
        }
    }
    else {
        for (var key in sparklines) {
            sparklines[key].push(0);
            sparklines[key].push(0);
        }
    }

    // Sources sparkline
    _ = [];
    _TOP_SOURCES = [];
    total["Sources"] = Object.size(_SOURCES);

    sorted = _sort(_SOURCES);
    other = 0;

    var top = {};
    var ips = [];
    var zero = [];
    other_events = {};

    for (var key in TRAIL_TYPES) {
        zero.push(0);
        other_events[key] = 0;
    }

    for (var i = 0; i < sorted.length; i++) {
        if (i < MAX_SOURCES_ITEMS) {
            top[sorted[i][0]] = sorted[i][1];
            ips.push(sorted[i][0]);
        }
        else {
            for (var key in TRAIL_TYPES)
                other_events[key] += _SOURCE_EVENTS[sorted[i][0]][key];
            other += sorted[i][1];
        }
    }

    ips.sort(_ipCompareValues);
    _ = [zero];

    for (var i = 0; i < ips.length; i++) {
        var _type_counts = [];

        for (var key in TRAIL_TYPES)
            _type_counts.push(_SOURCE_EVENTS[ips[i]][key]);

        _.push(_type_counts);
        _TOP_SOURCES.push([ips[i], _type_counts]);
    }

    if (other > 0) {
        var _other_counts = [];

        for (var key in TRAIL_TYPES)
            _other_counts.push(other_events[key]);

        _.push(_other_counts);
        _TOP_SOURCES.push(["Other", other]);
        _SOURCE_EVENTS["Other"] = other_events;
    }

    _.push(zero);  // because of 0 value display problem

    var barWidth = Math.min(6, Math.max(2, Math.floor((SPARKLINE_WIDTH / (_.length + 2)) - 1)));

    var barColors = [];
    for (var key in TRAIL_TYPES)
        barColors.push(TRAIL_TYPES[key]);

    $('#sources_sparkline').sparkline(_, { width: SPARKLINE_WIDTH, height: '30', type: 'bar', barColor: '#ffffff', barWidth: barWidth, disableInteraction: true, zeroColor: "rgba(0, 0, 0, 0)", stackedBarColor: barColors});

    var options = { fillColor: false, minSpotColor: "", maxSpotColor: "", spotColor: "", highlightSpotColor: "", highlightLineColor: "", tooltipClassname: "", chartRangeMin: 0, chartRangeMax: _MAX_EVENTS_PER_HOUR, width: SPARKLINE_WIDTH, height: '30', lineWidth: 2 };  // disableInteraction: false, tooltipClassname: "sparkline-tooltip"

    total["Events"] = 0;

    for (var key in { URL: "#ff9900", DNS: "#3366cc", IP: "#dc3912" }) {
        options.lineColor = TRAIL_TYPES[key];
        $('#events_sparkline').sparkline(sparklines[key], options);
        options.composite = true;
        total["Events"] += total[key];
    }

    sum = 0;
    for (var key in total)
        sum += total[key];

    for (var key in total)
        $("#" + key.toLowerCase() + "_count").html((sum > 0) ? numberWithCommas(total[key]) : '-')
}

function timestamp(str){
    return new Date(str).getTime();   
}

function pad(n, width, z) {
    z = z || '0';
    n = n + '';

    return n.length >= width ? n : new Array(width - n.length + 1).join(z) + n;
}

function formatDate(value) {
    return value.getFullYear() + "-" + pad(value.getMonth() + 1, 2) + "-" + pad(value.getDate(), 2);
};

function parseDate(value) {
    var retval = new Date(0);
    var match = value.match(/(\d{4})\-(\d{2})\-(\d{2})/);

    if (match !== null)
        retval = new Date(match[1], match[2] - 1, match[3]);

    return retval;
};

function getParameterByName(name) {
    name = name.replace(/[\[]/, "\\[").replace(/[\]]/, "\\]");

    var regex = new RegExp("[\\?&]" + name + "=([^&#]*)"),
        results = regex.exec(location.search);

    return results === null ? "" : decodeURIComponent(results[1].replace(/\+/g, " "));
}

function dayStart(tick_seconds) {
    var value = new Date(tick_seconds);

    value.setHours(0);
    value.setMinutes(0);
    value.setSeconds(0);
    value.setMilliseconds(0);

    return Math.floor(value.getTime());
}

function dayEnd(tick_seconds) {
    var value = new Date(tick_seconds);

    value.setHours(23);
    value.setMinutes(59);
    value.setSeconds(59);
    value.setMilliseconds(999);

    return Math.floor(value.getTime());
}

$(document).ready(function() {
    var from = dayStart(new Date().getTime());
    var to = dayStart(new Date().getTime());

    if (getParameterByName("from"))
        from = dayStart(parseDate(getParameterByName("from")));
    if (getParameterByName("to"))
        to = dayStart(parseDate(getParameterByName("to")));
});

function query(date) {
    var range = $("#slider").val();
    var url = location.origin + "/events?date=" + formatDate(date);

    init(url, date);
}

function networkFilter(netmask) {
    if ((netmask.length > 0) && (netmask.indexOf('/') === -1))
        netmask = netmask + "/32";
    if ((netmask.length > 0) && (!netmaskValidate(netmask))) {
        $("#netmask").val("");
        alertify.error("Invalid netmask");
    }
    else
        filterDataset(netmask);
}