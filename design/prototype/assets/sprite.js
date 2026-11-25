/* Inline SVG sprite: icons + sample page artwork. Include as the first element in <body>:
   <script src="assets/sprite.js"></script>  (synchronous so <use href="#..."> resolves at first paint) */
(function () {
  var F = 'font-family="IBM Plex Sans,Arial,sans-serif"';
  var ink = '#0F172A', body = '#475569', brand = '#0F4C5C', off = '#1597B0', soft = '#E6F2F4', road = '#B5D9E0', line = '#CBD5E1';

  function nav(links, cta) {
    var xs = [760, 856, 950, 1028], names = ['Product', 'Pricing', 'Docs', 'Company'], out = '';
    links.forEach(function (n, k) { out += '<text x="' + xs[k + (4 - links.length)] + '" y="46">' + n + '</text>'; });
    return '<rect width="1440" height="1000" fill="#FFFFFF"/>' +
      '<rect x="64" y="28" width="24" height="24" fill="' + brand + '"/>' +
      '<text x="100" y="47" ' + F + ' font-size="18" font-weight="700" fill="' + ink + '">Sample Co.</text>' +
      '<g ' + F + ' font-size="15" fill="#334155">' + out + '</g>' +
      '<rect x="1176" y="20" width="200" height="40" rx="8" fill="' + cta + '"/>' +
      '<text x="1276" y="45" text-anchor="middle" ' + F + ' font-size="15" font-weight="700" fill="#FFFFFF">Start free trial</text>';
  }
  function illo() {
    return '<rect x="800" y="140" width="576" height="400" rx="16" fill="' + soft + '"/>' +
      '<path d="M800 420 C 940 380, 980 250, 1120 260 S 1320 200, 1376 170" stroke="' + road + '" stroke-width="22" fill="none"/>' +
      '<path d="M900 540 C 920 440, 1040 400, 1080 330 S 1200 220, 1260 140" stroke="' + road + '" stroke-width="14" fill="none"/>' +
      '<path d="M880 470 L 1010 380 L 1140 300 L 1290 230" stroke="' + brand + '" stroke-width="4" stroke-dasharray="10 8" fill="none"/>' +
      '<g fill="' + brand + '"><circle cx="880" cy="470" r="12"/><circle cx="1140" cy="300" r="12"/><circle cx="1290" cy="230" r="16"/></g>' +
      '<g fill="#FFFFFF"><circle cx="880" cy="470" r="5"/><circle cx="1140" cy="300" r="5"/><circle cx="1290" cy="230" r="6"/></g>';
  }
  function heroGood(cta) {
    return '<g ' + F + ' font-weight="700" font-size="60" fill="' + ink + '"><text x="64" y="240">Plan field visits</text><text x="64" y="312">in minutes.</text></g>' +
      '<g ' + F + ' font-size="22" fill="' + body + '"><text x="64" y="366">Routes, schedules and site notes</text><text x="64" y="396">for teams on the road.</text></g>' +
      '<rect x="64" y="440" width="220" height="56" rx="8" fill="' + cta + '"/>' +
      '<text x="174" y="475" text-anchor="middle" ' + F + ' font-size="18" font-weight="700" fill="#FFFFFF">Book a demo</text>' +
      '<text x="316" y="475" ' + F + ' font-size="16" font-weight="700" fill="' + brand + '">See how it works →</text>';
  }
  function section(y) {
    var t = y + 40, ic = y + 80, tt = y + 162, l1 = y + 182, l2 = y + 202;
    return '<text x="64" y="' + t + '" ' + F + ' font-size="32" font-weight="700" fill="' + ink + '">How it works</text>' +
      '<g fill="' + soft + '"><rect x="64" y="' + ic + '" width="44" height="44" rx="8"/><rect x="528" y="' + ic + '" width="44" height="44" rx="8"/><rect x="992" y="' + ic + '" width="44" height="44" rx="8"/></g>' +
      '<g ' + F + ' font-size="19" font-weight="700" fill="' + ink + '"><text x="64" y="' + tt + '">Plan the route</text><text x="528" y="' + tt + '">Brief the team</text><text x="992" y="' + tt + '">Log site notes</text></g>' +
      '<g fill="' + line + '"><rect x="64" y="' + l1 + '" width="340" height="10" rx="5"/><rect x="64" y="' + l2 + '" width="280" height="10" rx="5"/><rect x="528" y="' + l1 + '" width="330" height="10" rx="5"/><rect x="528" y="' + l2 + '" width="260" height="10" rx="5"/><rect x="992" y="' + l1 + '" width="340" height="10" rx="5"/><rect x="992" y="' + l2 + '" width="230" height="10" rx="5"/></g>';
  }
  var all4 = ['Product', 'Pricing', 'Docs', 'Company'], three = ['Product', 'Pricing', 'Company'];

  var design = nav(all4, brand) + heroGood(brand) + illo() + section(604);
  var capture = nav(three, off) +
    '<text x="64" y="236" ' + F + ' font-weight="700" font-size="34" fill="' + ink + '">Plan field visits in minutes.</text>' +
    '<g ' + F + ' font-size="40" fill="' + body + '"><text x="64" y="320">Routes, schedules and site notes</text><text x="64" y="370">for teams on the road.</text></g>' +
    '<rect x="64" y="440" width="132" height="56" rx="8" fill="' + off + '"/>' +
    '<text x="130" y="474" text-anchor="middle" ' + F + ' font-size="16" font-weight="700" fill="#FFFFFF">Book a demo</text>' +
    '<text x="228" y="475" ' + F + ' font-size="16" font-weight="700" fill="' + brand + '">See how it works →</text>' + section(572);
  var fixed = nav(all4, brand) + heroGood(brand) + illo() + section(572);

  function mobile(flawed) {
    var c = flawed ? off : brand;
    var s = '<rect width="476" height="844" fill="#FFFFFF"/>';
    if (flawed) {
      s += '<g ' + F + ' font-weight="700" font-size="40" fill="' + ink + '"><text x="20" y="120">Plan field visits in</text><text x="20" y="168">minutes.</text></g>' +
        '<rect x="0" y="80" width="476" height="64" fill="#FFFFFF" opacity=".92"/>' +
        '<rect x="20" y="100" width="20" height="20" fill="' + brand + '"/><text x="50" y="116" ' + F + ' font-size="16" font-weight="700" fill="' + ink + '">Sample Co.</text>' +
        '<g fill="' + ink + '"><rect x="340" y="102" width="24" height="3"/><rect x="340" y="110" width="24" height="3"/><rect x="340" y="118" width="24" height="3"/></g>' +
        '<g ' + F + ' font-size="20" fill="' + body + '"><text x="20" y="220">Routes, schedules and site notes for teams</text><text x="20" y="248">on the road.</text></g>' +
        '<rect x="20" y="284" width="132" height="52" rx="8" fill="' + c + '"/><text x="86" y="316" text-anchor="middle" ' + F + ' font-size="16" font-weight="700" fill="#FFFFFF">Book a demo</text>';
    } else {
      s += '<rect x="20" y="24" width="20" height="20" fill="' + brand + '"/><text x="50" y="40" ' + F + ' font-size="16" font-weight="700" fill="' + ink + '">Sample Co.</text>' +
        '<g fill="' + ink + '"><rect x="346" y="26" width="24" height="3"/><rect x="346" y="34" width="24" height="3"/><rect x="346" y="42" width="24" height="3"/></g>' +
        '<g ' + F + ' font-weight="700" font-size="36" fill="' + ink + '"><text x="20" y="128">Plan field visits</text><text x="20" y="172">in minutes.</text></g>' +
        '<g ' + F + ' font-size="18" fill="' + body + '"><text x="20" y="214">Routes, schedules and site notes</text><text x="20" y="238">for teams on the road.</text></g>' +
        '<rect x="20" y="268" width="350" height="52" rx="8" fill="' + c + '"/><text x="195" y="300" text-anchor="middle" ' + F + ' font-size="17" font-weight="700" fill="#FFFFFF">Book a demo</text>' +
        '<rect x="20" y="352" width="350" height="230" rx="14" fill="' + soft + '"/><path d="M40 540 L 140 470 L 240 420 L 340 380" stroke="' + brand + '" stroke-width="4" stroke-dasharray="8 6" fill="none"/>';
    }
    s += '<text x="20" y="' + (flawed ? 400 : 640) + '" ' + F + ' font-size="26" font-weight="700" fill="' + ink + '">How it works</text>';
    return s;
  }

  var I = {
    chip: '<rect x="7" y="7" width="10" height="10"/><path d="M10 3v4M14 3v4M10 17v4M14 17v4M3 10h4M3 14h4M17 10h4M17 14h4"/>',
    cloud: '<path d="M7 18h11a4 4 0 0 0 0-8 6 6 0 0 0-11.6 1.5A3.5 3.5 0 0 0 7 18z"/>',
    ruler: '<rect x="2" y="8" width="20" height="8"/><path d="M6 8v3M10 8v4M14 8v3M18 8v4"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    review: '<circle cx="12" cy="12" r="9" stroke-dasharray="3 2.6"/><path d="M9.8 9.6a2.3 2.3 0 1 1 3.4 2c-.8.4-1.2.9-1.2 1.8"/><path d="M12 16.2v.4"/>',
    dash: '<path d="M7 12h10"/>',
    critical: '<path fill="currentColor" stroke="none" d="M8 2h8l6 6v8l-6 6H8l-6-6V8z"/>',
    major: '<path fill="currentColor" stroke="none" d="M12 2.5l10.5 19h-21z"/>',
    minor: '<circle cx="12" cy="12" r="8"/>',
    copy: '<rect x="8" y="8" width="12" height="12"/><path d="M16 8V4H4v12h4"/>',
    download: '<path d="M12 4v11M7 10l5 5 5-5M4 20h16"/>',
    upload: '<path d="M12 16V5M7 10l5-5 5 5M4 20h16"/>',
    refresh: '<path d="M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5"/>',
    shield: '<path d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z"/>',
    desktop: '<rect x="3" y="4" width="18" height="12"/><path d="M8 20h8M12 16v4"/>',
    phone: '<rect x="7" y="2" width="10" height="20"/><path d="M11 18h2"/>',
    layers: '<rect x="3" y="3" width="12" height="12"/><rect x="9" y="9" width="12" height="12" stroke-dasharray="3 2"/>',
    expand: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
    chev: '<path d="M9 6l6 6-6 6"/>',
    'chev-down': '<path d="M6 9l6 6 6-6"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
    image: '<rect x="3" y="4" width="18" height="16"/><path d="M3 16l5-5 4 4 3-3 6 6"/><circle cx="15.5" cy="8.5" r="1.5"/>',
    code: '<path d="M8 7l-5 5 5 5M16 7l5 5-5 5"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
    alert: '<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 17.5v.5"/>',
    offline: '<path d="M3 3l18 18M8.5 16.5a5 5 0 0 1 7 0M5 13a10 10 0 0 1 5-2.7M14 10.3A10 10 0 0 1 19 13M2 9.5a14 14 0 0 1 4.5-2.8M12 20v.5"/>',
    more: '<circle cx="5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="19" cy="12" r="1.2"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
    lock: '<rect x="5" y="11" width="14" height="10"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    up: '<path d="M12 19V5M6 11l6-6 6 6"/>',
    down: '<path d="M12 5v14M6 13l6 6 6-6"/>',
    file: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/>',
    play: '<path d="M7 4l13 8-13 8z"/>',
    external: '<path d="M14 4h6v6M20 4l-9 9M18 14v6H4V6h6"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5"/>',
    moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    loop: '<path d="M4 12a8 8 0 0 1 13.7-5.7L20 8.5M20 4v4.5h-4.5M20 12a8 8 0 0 1-13.7 5.7L4 15.5M4 20v-4.5h4.5"/>',
    compare: '<rect x="3" y="4" width="7" height="16"/><rect x="14" y="4" width="7" height="16"/>'
  };
  var syms = '';
  for (var k in I) syms += '<symbol id="i-' + k + '" viewBox="0 0 24 24">' + I[k] + '</symbol>';
  syms += '<symbol id="sample-design" viewBox="0 0 1440 1000">' + design + '</symbol>';
  syms += '<symbol id="sample-capture" viewBox="0 0 1440 1000">' + capture + '</symbol>';
  syms += '<symbol id="sample-fixed" viewBox="0 0 1440 1000">' + fixed + '</symbol>';
  syms += '<symbol id="sample-mobile" viewBox="0 0 476 844">' + mobile(true) + '</symbol>';
  syms += '<symbol id="sample-mobile-fixed" viewBox="0 0 476 844">' + mobile(false) + '</symbol>';
  var logo = '<symbol id="logo" viewBox="0 0 64 64"><g fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="square" stroke-linejoin="miter"><path d="M52 22 V12 H12 V52 H52 V42"/><path d="M23 26 V38 H35 V26"/><path d="M41 26 V38"/></g></symbol>';
  document.currentScript.insertAdjacentHTML('afterend', '<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false"><defs>' + syms + logo + '</defs></svg>');
})();
