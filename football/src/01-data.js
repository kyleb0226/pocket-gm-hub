const { useState, useEffect, useRef, useMemo } = React;

/* =========================================================================
   POCKET GM — FOOTBALL
   A fictional 32-team pro league on top of a full college football world:
   all 138 FBS programs in their real 2026 conferences, a 12-team playoff,
   bowls, rivalries, polls, the Heisman and every major award. Players are
   fictional and carry one continuous record from signing day to retirement.
   Source is split across src/*.js and assembled by tools/assemble.js.
   ========================================================================= */

/* ----------------------------- RNG / utils ----------------------------- */
let _rng = Math.random;
function mulberry32(seed){ let a = seed >>> 0; return function(){ a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function hashSeed(s){ let h = 2166136261; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
const rint = (a, b) => Math.floor(_rng() * (b - a + 1)) + a;
const pick = arr => arr[Math.floor(_rng() * arr.length)];
const chance = p => _rng() < p;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const round = Math.round;
function gauss(mean, sd){ let u = 0, v = 0; while (u === 0) u = _rng(); while (v === 0) v = _rng(); return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
function shuffle(a){ a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(_rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function wpick(list){ let tot = 0; for (const x of list) tot += x[1]; let r = _rng() * tot; for (const x of list) { r -= x[1]; if (r <= 0) return x[0]; } return list.length ? list[list.length - 1][0] : null; }
const sum = (a, f) => a.reduce((s, x) => s + f(x), 0);
const avgOf = (a, f, d = 45) => a.length ? sum(a, f) / a.length : d;
const by = f => (a, b) => f(b) - f(a);
const money = m => (m >= 1 ? "$" + m.toFixed(1) + "M" : "$" + round(m * 1000) + "K");
const ord = n => { const s = ["th", "st", "nd", "rd"], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); };
const ROMAN = n => { const m = [[1000,"M"],[900,"CM"],[500,"D"],[400,"CD"],[100,"C"],[90,"XC"],[50,"L"],[40,"XL"],[10,"X"],[9,"IX"],[5,"V"],[4,"IV"],[1,"I"]]; let o = ""; for (const [v, s] of m) while (n >= v) { o += s; n -= v; } return o; };

/* ----------------------------- positions ----------------------------- */
const POS = ["QB","RB","WR","TE","OT","OG","C","DE","DT","LB","CB","S","K","P"];
const COL_NEED = {QB:3,RB:3,WR:6,TE:2,OT:3,OG:3,C:2,DE:4,DT:3,LB:5,CB:5,S:4,K:1,P:1};   // 45
const PRO_NEED = {QB:3,RB:4,WR:6,TE:3,OT:4,OG:4,C:2,DE:4,DT:4,LB:6,CB:6,S:4,K:1,P:1};   // 52
const STARTERS = {QB:1,RB:1,WR:3,TE:1,OT:2,OG:2,C:1,DE:2,DT:2,LB:3,CB:2,S:2,K:1,P:1};
const GROUP = pos => ({OT:"OL",OG:"OL",C:"OL",DE:"DL",DT:"DL",CB:"DB",S:"DB",K:"KP",P:"KP"})[pos] || pos;
const isOff = pos => ["QB","RB","WR","TE","OT","OG","C"].includes(pos);
const isDef = pos => ["DE","DT","LB","CB","S"].includes(pos);
// Six ratings per position group; the weights turn them into an overall.
const RLAB = {
  QB:["Arm","Accuracy","Reads","Mobility","Poise","Toughness"], RB:["Speed","Vision","Power","Elusive","Hands","Blocking"],
  WR:["Speed","Hands","Routes","Release","After Catch","Blocking"], TE:["Speed","Hands","Routes","Run Block","Pass Block","Strength"],
  OL:["Pass Block","Run Block","Strength","Footwork","Awareness","Stamina"], DL:["Pass Rush","Run Stop","Strength","Burst","Motor","Tackling"],
  LB:["Tackling","Coverage","Blitz","Speed","Instincts","Strength"], DB:["Coverage","Speed","Ball Skills","Tackling","Instincts","Press"],
  KP:["Leg","Accuracy","Clutch","Hang Time","Consistency","Composure"],
};
const RW = {
  QB:[.2,.3,.25,.08,.14,.03], RB:[.24,.25,.17,.2,.08,.06], WR:[.22,.26,.26,.1,.13,.03], TE:[.14,.24,.2,.2,.12,.1],
  OL:[.3,.3,.14,.12,.1,.04], DL:[.3,.28,.14,.12,.08,.08], LB:[.28,.2,.14,.14,.16,.08], DB:[.34,.2,.16,.1,.14,.06], KP:[.3,.4,.1,.1,.06,.04],
};
const calcOvr = p => round(sum(RW[GROUP(p.pos)].map((w, i) => w * p.r[i]), x => x));
const SIZE = {QB:[75,220],RB:[70,212],WR:[73,198],TE:[77,250],OT:[78,312],OG:[76,315],C:[75,303],DE:[76,265],DT:[75,305],LB:[73,238],CB:[71,192],S:[72,205],K:[72,195],P:[74,210]};
const CLS = ["FR","SO","JR","SR"];

/* ----------------------------- names & places ----------------------------- */
const FIRST = "James,Marcus,Tyler,Jalen,Caleb,Malik,Ethan,Darius,Noah,Xavier,Mason,Trevon,Logan,Isaiah,Cole,Andre,Hunter,Jordan,Lucas,Devin,Carson,Jamal,Blake,Tyrell,Owen,Kendrick,Brady,Rashad,Luke,DeShawn,Cooper,Terrance,Jackson,Micah,Grant,Jaylen,Wyatt,Dante,Parker,Elijah,Chase,Tyrone,Bryce,Javon,Colton,Kareem,Garrett,Trey,Nolan,Keenan,Drew,Marquis,Easton,Quentin,Reid,Darnell,Tanner,Amari,Gavin,Kobe,Shane,Lamar,Austin,Deion,Beau,Jermaine,Max,Tavon,Brock,Cedric,Dalton,Rome,Zach,Khalil,Peyton,Dre,Cade,Emmanuel,Bo,Tre,Walker,Jaxon,Kai,Sione,Mateo,Diego,Nico,Aiden,Josiah,Rhett,Cam,Tobias,Ezra,Silas,Miles,Jonah,Tate,Kyler,Roman,Dominic,Kellen,Jett,Asher,Zion,Omar,Desmond,Luca,Brooks,Sawyer,Dillon,Corey,Vince,Anthony,Chris,Mike,Will,Sam,Ben,Jake,Ryan,Nick,Matt,Josh,Dylan,Evan,Adam,Sean,Kyle,Aaron,Eric,Travis,Derek".split(",");
const LAST = "Smith,Johnson,Williams,Brown,Jones,Davis,Miller,Wilson,Moore,Taylor,Anderson,Thomas,Jackson,White,Harris,Martin,Thompson,Robinson,Clark,Lewis,Walker,Hall,Allen,Young,King,Wright,Scott,Green,Baker,Adams,Nelson,Hill,Campbell,Mitchell,Roberts,Carter,Phillips,Evans,Turner,Parker,Collins,Edwards,Stewart,Morris,Murphy,Cook,Rogers,Morgan,Cooper,Peterson,Reed,Bailey,Bell,Howard,Ward,Cox,Richardson,Wood,Watson,Brooks,Bennett,Gray,James,Hughes,Price,Sanders,Ross,Henderson,Coleman,Jenkins,Perry,Powell,Long,Patterson,Butler,Simmons,Foster,Bryant,Alexander,Russell,Griffin,Hayes,Myers,Ford,Hamilton,Graham,Sullivan,Wallace,Woods,Cole,West,Jordan,Owens,Reynolds,Fisher,Ellis,Harrison,Gibson,McDonald,Marshall,Freeman,Wells,Webb,Simpson,Stevens,Tucker,Porter,Hunter,Hicks,Crawford,Boyd,Mason,Dixon,Hunt,Palmer,Robertson,Black,Holmes,Stone,Meyer,Rice,Knight,Ferguson,Rose,Dunn,Pierce,Arnold,Ray,Watkins,Carroll,Duncan,Armstrong,Berry,Lane,Riley,Carpenter,Greene,Lawrence,Elliott,Chavez,Sims,Austin,Peters,Franklin,Lawson,Fields,Ryan,Schmidt,Weaver,Banks,Bishop,Lynch,Barrett,Fuller,Garza,Tuiasosopo,Mahe,Okafor,Adebayo,Nwosu,Fa'alele,Lopez,Ramirez,Torres,Flores,Rivera,Gomez,Diaz,Reyes,Cruz,Ortiz,Vea,Tagovailoa,O'Brien,McCoy,Brennan,Kowalski,Novak,Petrov,Lombardi,Rossi,Hoang,Kim,Douglas,Pruitt,Slaughter,Battle,Strong,Swift,Law,Bolden,Dorsey,Gaines,Tillman,Blackmon,Speight,Crosby,Whitfield,Jefferson,Washington,Booker,Singleton,Glover,Mack,Dawson,Cross,Thornton,Hairston,Vaughn,Ware,Sample,Starks".split(",");
// [city, state, weight] — where recruits come from.
const TOWNS = [["Houston","TX",9],["Dallas","TX",9],["San Antonio","TX",5],["Austin","TX",4],["Fort Worth","TX",4],["Katy","TX",3],["Miami","FL",9],["Tampa","FL",5],["Jacksonville","FL",5],["Orlando","FL",5],["Fort Lauderdale","FL",4],["Los Angeles","CA",8],["San Diego","CA",4],["Long Beach","CA",3],["Sacramento","CA",3],["Oakland","CA",3],["Santa Ana","CA",3],["Atlanta","GA",9],["Savannah","GA",2],["Valdosta","GA",2],["Columbus","OH",4],["Cleveland","OH",4],["Cincinnati","OH",4],["Detroit","MI",4],["Grand Rapids","MI",2],["Charlotte","NC",4],["Raleigh","NC",3],["Birmingham","AL",4],["Mobile","AL",3],["Montgomery","AL",2],["New Orleans","LA",5],["Baton Rouge","LA",3],["Shreveport","LA",2],["Philadelphia","PA",4],["Pittsburgh","PA",3],["Baltimore","MD",4],["Washington","DC",3],["Richmond","VA",2],["Virginia Beach","VA",3],["Nashville","TN",3],["Memphis","TN",3],["Chicago","IL",5],["St. Louis","MO",3],["Kansas City","MO",2],["Indianapolis","IN",3],["Phoenix","AZ",4],["Las Vegas","NV",3],["Seattle","WA",3],["Portland","OR",2],["Denver","CO",2],["Salt Lake City","UT",3],["Honolulu","HI",2],["Newark","NJ",4],["Brooklyn","NY",3],["Buffalo","NY",1],["Boston","MA",2],["Columbia","SC",3],["Charleston","SC",2],["Jackson","MS",3],["Little Rock","AR",2],["Oklahoma City","OK",3],["Tulsa","OK",2],["Louisville","KY",2],["Omaha","NE",1],["Des Moines","IA",1],["Minneapolis","MN",2],["Milwaukee","WI",2],["Wichita","KS",1],["Albuquerque","NM",1],["Boise","ID",1],["Fargo","ND",1],["Hartford","CT",1],["Wilmington","DE",1],["Morgantown","WV",1]];
const HS_SUFFIX = ["Central","North","South","East","West","Catholic","Prep","Christian","Academy","Heights","Memorial","Tech","Lutheran","County"];
// Neighbouring-state regions, for the recruiting pull toward home.
const REGION = {TX:"SW",OK:"SW",AR:"SW",LA:"SW",NM:"SW",FL:"SE",GA:"SE",AL:"SE",MS:"SE",SC:"SE",TN:"SE",NC:"ATL",VA:"ATL",MD:"ATL",DC:"ATL",WV:"ATL",KY:"ATL",DE:"ATL",PA:"NE",NJ:"NE",NY:"NE",MA:"NE",CT:"NE",OH:"MW",MI:"MW",IN:"MW",IL:"MW",WI:"MW",MN:"MW",IA:"MW",MO:"MW",NE:"MW",KS:"MW",ND:"MW",CA:"W",AZ:"W",NV:"W",WA:"W",OR:"W",CO:"W",UT:"W",HI:"W",ID:"W",WY:"W"};

/* ----------------------------- college programs ----------------------------- */
// FBS as it lines up for the 2026 season. name|mascot|abbr|prestige|colour|colour2|state
const P4 = ["SEC","B1G","B12","ACC"];
const CONFS = {
  SEC:{name:"SEC",full:"Southeastern Conference",games:9,teams:"Alabama|Crimson Tide|ALA|95|#9E1B32|#ffffff|AL;Arkansas|Razorbacks|ARK|72|#9D2235|#ffffff|AR;Auburn|Tigers|AUB|82|#0C2340|#E87722|AL;Florida|Gators|FLA|84|#0021A5|#FA4616|FL;Georgia|Bulldogs|UGA|96|#BA0C2F|#111111|GA;Kentucky|Wildcats|UK|70|#0033A0|#ffffff|KY;LSU|Tigers|LSU|90|#461D7C|#FDD023|LA;Mississippi State|Bulldogs|MSST|66|#660000|#cccccc|MS;Missouri|Tigers|MIZ|76|#F1B82D|#111111|MO;Oklahoma|Sooners|OU|88|#841617|#FDF9D8|OK;Ole Miss|Rebels|MISS|84|#CE1126|#14213D|MS;South Carolina|Gamecocks|SC|77|#73000A|#111111|SC;Tennessee|Volunteers|TENN|87|#FF8200|#ffffff|TN;Texas|Longhorns|TEX|94|#BF5700|#ffffff|TX;Texas A&M|Aggies|TAMU|87|#500000|#ffffff|TX;Vanderbilt|Commodores|VAN|68|#866D4B|#111111|TN"},
  B1G:{name:"Big Ten",full:"Big Ten Conference",games:9,teams:"Illinois|Fighting Illini|ILL|74|#E84A27|#13294B|IL;Indiana|Hoosiers|IND|80|#990000|#EEEDEB|IN;Iowa|Hawkeyes|IOWA|79|#FFCD00|#111111|IA;Maryland|Terrapins|MD|67|#E03A3E|#FFD520|MD;Michigan|Wolverines|MICH|92|#00274C|#FFCB05|MI;Michigan State|Spartans|MSU|74|#18453B|#ffffff|MI;Minnesota|Golden Gophers|MINN|72|#7A0019|#FFCC33|MN;Nebraska|Cornhuskers|NEB|77|#E41C38|#FDF2D9|NE;Northwestern|Wildcats|NW|64|#4E2A84|#ffffff|IL;Ohio State|Buckeyes|OSU|97|#BB0000|#888888|OH;Oregon|Ducks|ORE|93|#154733|#FEE123|OR;Penn State|Nittany Lions|PSU|91|#041E42|#ffffff|PA;Purdue|Boilermakers|PUR|62|#CEB888|#111111|IN;Rutgers|Scarlet Knights|RUTG|66|#CC0033|#5F6A72|NJ;UCLA|Bruins|UCLA|71|#2D68C4|#F2A900|CA;USC|Trojans|USC|86|#990000|#FFC72C|CA;Washington|Huskies|WASH|81|#4B2E83|#B7A57A|WA;Wisconsin|Badgers|WIS|76|#C5050C|#ffffff|WI"},
  B12:{name:"Big 12",full:"Big 12 Conference",games:9,teams:"Arizona|Wildcats|ARIZ|70|#CC0033|#003366|AZ;Arizona State|Sun Devils|ASU|79|#8C1D40|#FFC627|AZ;Baylor|Bears|BAY|74|#154734|#FFB81C|TX;BYU|Cougars|BYU|79|#002E5D|#ffffff|UT;Cincinnati|Bearcats|CIN|69|#E00122|#111111|OH;Colorado|Buffaloes|COLO|73|#CFB87C|#111111|CO;Houston|Cougars|HOU|68|#C8102E|#ffffff|TX;Iowa State|Cyclones|ISU|77|#C8102E|#F1BE48|IA;Kansas|Jayhawks|KU|69|#0051BA|#E8000D|KS;Kansas State|Wildcats|KSU|78|#512888|#ffffff|KS;Oklahoma State|Cowboys|OKST|72|#FF7300|#111111|OK;TCU|Horned Frogs|TCU|77|#4D1979|#A3A9AC|TX;Texas Tech|Red Raiders|TTU|82|#CC0000|#111111|TX;UCF|Knights|UCF|69|#BA9B37|#111111|FL;Utah|Utes|UTAH|80|#CC0000|#ffffff|UT;West Virginia|Mountaineers|WVU|70|#002855|#EAAA00|WV"},
  ACC:{name:"ACC",full:"Atlantic Coast Conference",games:8,teams:"Boston College|Eagles|BC|65|#98002E|#BC9B6A|MA;California|Golden Bears|CAL|67|#003262|#FDB515|CA;Clemson|Tigers|CLEM|88|#F56600|#522D80|SC;Duke|Blue Devils|DUKE|71|#003087|#ffffff|NC;Florida State|Seminoles|FSU|84|#782F40|#CEB888|FL;Georgia Tech|Yellow Jackets|GT|75|#B3A369|#003057|GA;Louisville|Cardinals|LOU|78|#AD0000|#111111|KY;Miami|Hurricanes|MIA|89|#F47321|#005030|FL;NC State|Wolfpack|NCST|73|#CC0000|#111111|NC;North Carolina|Tar Heels|UNC|74|#7BAFD4|#13294B|NC;Pittsburgh|Panthers|PITT|72|#003594|#FFB81C|PA;SMU|Mustangs|SMU|80|#0033A0|#C8102E|TX;Stanford|Cardinal|STAN|63|#8C1515|#ffffff|CA;Syracuse|Orange|SYR|70|#F76900|#000E54|NY;Virginia|Cavaliers|UVA|70|#232D4B|#F84C1E|VA;Virginia Tech|Hokies|VT|74|#630031|#CF4420|VA;Wake Forest|Demon Deacons|WAKE|66|#9E7E38|#111111|NC"},
  P12:{name:"Pac-12",full:"Pac-12 Conference",games:7,teams:"Boise State|Broncos|BSU|78|#0033A0|#D64309|ID;Colorado State|Rams|CSU|62|#1E4D2B|#C8C372|CO;Fresno State|Bulldogs|FRES|66|#DB0032|#002E6D|CA;Oregon State|Beavers|ORST|64|#DC4405|#111111|OR;San Diego State|Aztecs|SDSU|65|#A6192E|#111111|CA;Texas State|Bobcats|TXST|62|#501214|#8D734A|TX;Utah State|Aggies|USU|60|#0F2439|#8A8D8F|UT;Washington State|Cougars|WSU|67|#981E32|#5E6A71|WA"},
  MWC:{name:"Mountain West",full:"Mountain West Conference",games:8,teams:"Air Force|Falcons|AFA|62|#003087|#8A8D8F|CO;Hawaii|Rainbow Warriors|HAW|58|#024731|#C8C8C8|HI;Nevada|Wolf Pack|NEV|54|#003366|#807F84|NV;New Mexico|Lobos|UNM|60|#BA0C2F|#A7A8AA|NM;North Dakota State|Bison|NDSU|66|#0A5640|#FFC72C|ND;Northern Illinois|Huskies|NIU|58|#BA0C2F|#111111|IL;San Jose State|Spartans|SJSU|58|#0055A2|#E5A823|CA;UNLV|Rebels|UNLV|68|#CF0A2C|#666666|NV;UTEP|Miners|UTEP|52|#FF8200|#041E42|TX;Wyoming|Cowboys|WYO|58|#492F24|#FFC425|WY"},
  AAC:{name:"American",full:"American Conference",games:8,teams:"Army|Black Knights|ARMY|70|#2a2a2a|#D4BF91|NY;Charlotte|49ers|CLT|50|#046A38|#B9975B|NC;East Carolina|Pirates|ECU|62|#592A8A|#FDC82F|NC;Florida Atlantic|Owls|FAU|56|#003366|#CC0000|FL;Memphis|Tigers|MEM|70|#003087|#898D8D|TN;Navy|Midshipmen|NAVY|70|#00205B|#C5B783|MD;North Texas|Mean Green|UNT|64|#00853E|#111111|TX;Rice|Owls|RICE|54|#00205B|#C1C6C8|TX;South Florida|Bulls|USF|68|#006747|#CFC493|FL;Temple|Owls|TEM|54|#9D2235|#ffffff|PA;Tulane|Green Wave|TULN|72|#006747|#418FDE|LA;Tulsa|Golden Hurricane|TLSA|52|#002D72|#C8102E|OK;UAB|Blazers|UAB|54|#1E6B52|#F4C300|AL;UTSA|Roadrunners|UTSA|64|#0C2340|#F15A22|TX"},
  SBC:{name:"Sun Belt",full:"Sun Belt Conference",games:8,teams:"Appalachian State|Mountaineers|APP|62|#222222|#FFCC00|NC;Arkansas State|Red Wolves|ARST|56|#CC092F|#111111|AR;Coastal Carolina|Chanticleers|CCU|58|#006F71|#A27752|SC;Georgia Southern|Eagles|GASO|60|#011E41|#A3AAAE|GA;Georgia State|Panthers|GAST|50|#0039A6|#C60C30|GA;James Madison|Dukes|JMU|70|#450084|#CBB677|VA;Louisiana|Ragin' Cajuns|UL|62|#CE181E|#ffffff|LA;Louisiana Tech|Bulldogs|LT|56|#002F8B|#E31B23|LA;Louisiana-Monroe|Warhawks|ULM|48|#840029|#B18B43|LA;Marshall|Thundering Herd|MRSH|60|#00B140|#111111|WV;Old Dominion|Monarchs|ODU|60|#003057|#7C878E|VA;South Alabama|Jaguars|USA|58|#00205B|#BF0D3E|AL;Southern Miss|Golden Eagles|USM|54|#FFAB00|#111111|MS;Troy|Trojans|TROY|60|#8A2432|#B3B5B8|AL"},
  MAC:{name:"MAC",full:"Mid-American Conference",games:8,teams:"Akron|Zips|AKR|46|#041E42|#A89968|OH;Ball State|Cardinals|BALL|48|#BA0C2F|#ffffff|IN;Bowling Green|Falcons|BGSU|56|#FE5000|#4F2C1D|OH;Buffalo|Bulls|BUFF|56|#005BBB|#ffffff|NY;Central Michigan|Chippewas|CMU|54|#6A0032|#FFC82E|MI;Eastern Michigan|Eagles|EMU|52|#006633|#ffffff|MI;Kent State|Golden Flashes|KENT|44|#002664|#EAAB00|OH;Miami (OH)|RedHawks|M-OH|60|#B61E2E|#ffffff|OH;Ohio|Bobcats|OHIO|62|#00694E|#ffffff|OH;Sacramento State|Hornets|SAC|54|#043927|#C4B581|CA;Toledo|Rockets|TOL|62|#15397F|#FFDA00|OH;UMass|Minutemen|MASS|44|#881C1C|#ffffff|MA;Western Michigan|Broncos|WMU|56|#6C4023|#B5A167|MI"},
  CUSA:{name:"C-USA",full:"Conference USA",games:8,teams:"Delaware|Fightin' Blue Hens|DEL|54|#00539F|#FFD200|DE;FIU|Panthers|FIU|50|#081E3F|#B6862C|FL;Jacksonville State|Gamecocks|JVST|58|#CC0000|#ffffff|AL;Kennesaw State|Owls|KENN|54|#FDBB30|#111111|GA;Liberty|Flames|LIB|62|#0A254E|#990000|VA;Middle Tennessee|Blue Raiders|MTSU|48|#0066CC|#ffffff|TN;Missouri State|Bears|MOST|52|#5E0009|#ffffff|MO;New Mexico State|Aggies|NMSU|48|#8C0B42|#ffffff|NM;Sam Houston|Bearkats|SHSU|50|#F56423|#ffffff|TX;Western Kentucky|Hilltoppers|WKU|60|#C60C30|#ffffff|KY"},
  IND:{name:"Independents",full:"FBS Independents",games:0,teams:"Notre Dame|Fighting Irish|ND|93|#0C2340|#C99700|IN;UConn|Huskies|CONN|58|#000E2F|#E4002B|CT"},
};
const CONF_ORDER = ["SEC","B1G","B12","ACC","P12","AAC","MWC","SBC","MAC","CUSA","IND"];
// Named rivalries: [name, abbrA, abbrB, trophy]. The first one a team appears in is its season finale.
const RIVALRIES = [
  ["Iron Bowl","ALA","AUB","Foy–ODK Trophy"],["The Game","MICH","OSU","Gold Pants"],["Red River Rivalry","TEX","OU","Golden Hat"],["Egg Bowl","MISS","MSST","Golden Egg"],
  ["Clean, Old-Fashioned Hate","UGA","GT","Governor's Cup"],["Sunshine Showdown","FLA","FSU","Makala Trophy"],["Palmetto Bowl","CLEM","SC","Palmetto Trophy"],["Governor's Cup","UK","LOU","Governor's Cup"],
  ["Lone Star Showdown","TAMU","TEX","Lone Star Trophy"],["Third Saturday in October","TENN","ALA","Victory Cigar"],["Cocktail Party","UGA","FLA","Okefenokee Oar"],["Deep South's Oldest Rivalry","AUB","UGA","Bragging Rights"],
  ["Magnolia Bowl","LSU","MISS","Magnolia Bowl Trophy"],["Battle Line Rivalry","ARK","MIZ","Battle Line Trophy"],["Golden Boot","ARK","LSU","Golden Boot"],["Tennessee–Vanderbilt","VAN","TENN","Bragging Rights"],
  ["Paul Bunyan Trophy","MSU","MICH","Paul Bunyan Trophy"],["Paul Bunyan's Axe","MINN","WIS","Paul Bunyan's Axe"],["Old Oaken Bucket","IND","PUR","Old Oaken Bucket"],["Land of Lincoln","ILL","NW","Land of Lincoln Trophy"],
  ["Heroes Game","NEB","IOWA","Heroes Trophy"],["Floyd of Rosedale","IOWA","MINN","Floyd of Rosedale"],["Victory Bell","USC","UCLA","Victory Bell"],["Apple Cup","WASH","WSU","Apple Cup"],
  ["Oregon–Oregon State","ORE","ORST","Platypus Trophy"],["Land Grant Trophy","PSU","MSU","Land Grant Trophy"],["Jeweled Shillelagh","ND","USC","Jeweled Shillelagh"],["Bedlam","OKST","OU","Bedlam Bell"],
  ["Sunflower Showdown","KU","KSU","Governor's Cup"],["Holy War","BYU","UTAH","Beehive Boot"],["Territorial Cup","ARIZ","ASU","Territorial Cup"],["Cy-Hawk","ISU","IOWA","Cy-Hawk Trophy"],
  ["Backyard Brawl","WVU","PITT","Bragging Rights"],["Iron Skillet","TCU","SMU","Iron Skillet"],["Texas Tech–Baylor","TTU","BAY","Bragging Rights"],["Rocky Mountain Showdown","COLO","CSU","Centennial Cup"],
  ["Commonwealth Cup","UVA","VT","Commonwealth Cup"],["Tobacco Road","NCST","UNC","Bragging Rights"],["Victory Bell (NC)","DUKE","UNC","Victory Bell"],["Big Game","CAL","STAN","Stanford Axe"],
  ["Florida State–Miami","MIA","FSU","Florida Cup"],["Textile Bowl","CLEM","NCST","Textile Bowl Trophy"],["Black Diamond Trophy","VT","WVU","Black Diamond Trophy"],["Keg of Nails","CIN","LOU","Keg of Nails"],
  ["Army–Navy Game","ARMY","NAVY","Thompson Cup"],["Commander-in-Chief's (AF–Army)","AFA","ARMY","Commander-in-Chief's Trophy"],["Commander-in-Chief's (AF–Navy)","AFA","NAVY","Commander-in-Chief's Trophy"],["Battle for the Bones","MEM","UAB","Bronze Ribs"],
  ["Battle of I-75","BGSU","TOL","Peace Pipe"],["Battle of the Bricks","M-OH","OHIO","Bricks Trophy"],["Michigan MAC Trophy","CMU","WMU","Victory Cannon"],["Fremont Cannon","NEV","UNLV","Fremont Cannon"],
  ["Border War","WYO","CSU","Bronze Boot"],["Old Wagon Wheel","USU","BYU","Old Wagon Wheel"],["Milk Can","BSU","FRES","Milk Can"],["Battle of the Palm","SDSU","FRES","Old Oil Can"],
  ["I-35 Rivalry","UTSA","TXST","I-35 Trophy"],["Bayou Bucket","HOU","RICE","Bayou Bucket"],["Battle of the Belt","USA","TROY","The Belt"],["Royal Rivalry","ODU","JMU","Royal Crown"],
  ["100 Miles of Hate","MTSU","WKU","Bragging Rights"],["Battle of I-10","UTEP","NMSU","Silver Spade"],["Shula Bowl","FAU","FIU","Don Shula Award"],["War on I-4","UCF","USF","War on I-4 Trophy"],
  ["Deeper Than Hate","GASO","APP","Bragging Rights"],["Wagon Wheel","AKR","KENT","Wagon Wheel"],["Bronze Stalk","NIU","BALL","Bronze Stalk"],["Notre Dame–Navy","ND","NAVY","Rip Miller Trophy"],
];
const BOWLS = ["Citrus Bowl","Gator Bowl","Alamo Bowl","Holiday Bowl","Sun Bowl","Liberty Bowl","Music City Bowl","Las Vegas Bowl","Pinstripe Bowl","Texas Bowl","Independence Bowl","Hawaii Bowl","Armed Forces Bowl","Birmingham Bowl","New Mexico Bowl","Fenway Bowl","Military Bowl","First Responder Bowl","Arizona Bowl","Boca Raton Bowl","Frisco Bowl","Myrtle Beach Bowl","Cure Bowl","New Orleans Bowl","Camellia Bowl","Gasparilla Bowl","Potato Bowl","LA Bowl","Bahamas Bowl","Queen City Bowl","Tangerine Bowl","Mobile Bowl","Detroit Bowl","Aloha Bowl"];
const CFP_QF = ["Rose Bowl","Sugar Bowl","Fiesta Bowl","Peach Bowl"], CFP_SF = ["Orange Bowl","Cotton Bowl"];

/* ----------------------------- pro league ----------------------------- */
// Fictional league. city|nickname|abbr|colour|colour2
const PRO_CONFS = ["Liberty","Frontier"], PRO_DIVS = ["East","North","South","West"];
const PRO_DEFS = [
  "New York|Knights|NYK|#1D3557|#E63946;Boston|Minutemen|BOS|#0B3D2E|#F1C40F;Philadelphia|Founders|PHI|#5B2A86|#C0C0C0;Washington|Monuments|WAS|#7B1E1E|#F2D0A4",
  "Chicago|Blaze|CHI|#D62828|#F77F00;Detroit|Motors|DET|#1B4965|#BEE9E8;Cleveland|Ironmen|CLE|#3D2B1F|#FF6B00;Pittsburgh|Forge|PIT|#111111|#FFB703",
  "Atlanta|Firebirds|ATL|#A4161A|#111111;Miami|Tide|MIA|#008E97|#FC4C02;Charlotte|Stingers|CLT|#0077B6|#111111;Nashville|Outlaws|NSH|#14213D|#FCA311",
  "Dallas|Wranglers|DAL|#003566|#ADB5BD;Houston|Comets|HOU|#03045E|#E63946;Kansas City|Scouts|KC|#C1121F|#FFD60A;Denver|Summit|DEN|#FB5607|#023E8A",
  "Brooklyn|Bridges|BKN|#222222|#E9ECEF;Baltimore|Admirals|BAL|#3C096C|#FFD166;Toronto|Huskies|TOR|#B5179E|#111111;Buffalo|Blizzard|BUF|#0353A4|#E63946",
  "Minnesota|Loons|MIN|#4F2683|#FFC62F;Milwaukee|Brewmasters|MIL|#1B4332|#FFBA08;Indianapolis|Racers|IND|#003049|#EAEAEA;Cincinnati|Rivermen|CIN|#E85D04|#111111",
  "New Orleans|Voodoo|NO|#2B2118|#D4AF37;Tampa Bay|Cannons|TB|#9D0208|#6C757D;Orlando|Orbit|ORL|#7209B7|#4CC9F0;Memphis|Kings|MEM|#1D3461|#D4AF37",
  "Los Angeles|Stars|LA|#27187E|#FFD23F;San Francisco|Fog|SF|#8D0801|#BF9B30;Seattle|Sasquatch|SEA|#0B6E4F|#A8DADC;Las Vegas|Jackpots|LV|#111111|#C9A227",
];
const CAP = 255;            // $M salary cap
const PRO_WEEKS = 17, COL_WEEKS = 14;
// Calendar: college 1–14 regular, 15 title games, 16 CFP R1, 17 QF, 18 SF, 19 final.
//           pro 1–17 regular, 18 wild card, 19 divisional, 20 conference, 21 title.
const LAST_WEEK = 21;
