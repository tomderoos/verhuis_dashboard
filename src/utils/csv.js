import Papa from 'papaparse';
import { parseAmount } from './format.js';

// Bekende Nederlandse bankformaten. Gebruikt om default kolom-mapping voor te stellen.
export const BANK_FORMATS = [
  {
    id: 'ing',
    name: 'ING',
    // ING CSV: "Datum";"Naam / Omschrijving";"Rekening";"Tegenrekening";"Code";"Af Bij";"Bedrag (EUR)";"MutatieSoort";"Mededelingen"
    detect: (headers) => headers.includes('Datum') && headers.includes('Af Bij') && (headers.includes('Bedrag (EUR)') || headers.includes('Bedrag')),
    mapping: {
      date: 'Datum',
      amount: 'Bedrag (EUR)',
      description: 'Naam / Omschrijving',
      notes: 'Mededelingen',
      typeColumn: 'Af Bij',
      typeExpenseValue: 'Af',
      typeIncomeValue: 'Bij',
    },
    dateFormat: 'YYYYMMDD',
  },
  {
    id: 'rabobank',
    name: 'Rabobank',
    // Rabobank kolommen: IBAN/BBAN, Munt, BIC, Volgnr, Datum, Rentedatum, Bedrag, Saldo na trn, Tegenrekening IBAN/BBAN, Naam tegenpartij, ...
    detect: (headers) => headers.some((h) => h === 'IBAN/BBAN') && headers.includes('Bedrag') && headers.includes('Datum'),
    mapping: {
      date: 'Datum',
      amount: 'Bedrag',
      description: 'Naam tegenpartij',
      notes: 'Omschrijving-1',
      typeColumn: null, // teken zit al in Bedrag
    },
    dateFormat: 'YYYY-MM-DD',
  },
  {
    id: 'abn',
    name: 'ABN AMRO',
    // ABN CSV: accountNumber;mutationcode;transactiondate;valuedate;startsaldo;endsaldo;amount;description
    detect: (headers) => headers.includes('transactiondate') && headers.includes('amount') && headers.includes('description'),
    mapping: {
      date: 'transactiondate',
      amount: 'amount',
      description: 'description',
      notes: null,
      typeColumn: null,
    },
    dateFormat: 'YYYYMMDD',
  },
  {
    id: 'triodos',
    name: 'Triodos',
    // Triodos: dd-mm-yyyy, IBAN, bedrag, Debet/Credit, naam, tegenpartij, code, omschrijving, saldo. Geen header.
    detect: (headers) => headers.length === 9 && headers[0] === 'Datum' && headers[3] === 'Type' && headers[4] === 'Naam',
    mapping: {
      date: 'Datum',
      amount: 'Bedrag',
      description: 'Naam',
      notes: 'Omschrijving',
      typeColumn: 'Type',
      typeExpenseValue: 'Debet',
      typeIncomeValue: 'Credit',
    },
    dateFormat: 'DD-MM-YYYY',
  },
];

// Vaste kolomnamen voor Triodos-CSV (heeft geen headerregel).
const TRIODOS_HEADERS = ['Datum', 'Rekening', 'Bedrag', 'Type', 'Naam', 'Tegenpartij', 'Code', 'Omschrijving', 'Saldo'];

export function parseCsv(text) {
  const trimmed = text.trim();
  // Automatisch delimiter herkennen (Papa doet dat als delimiter = '')
  const withHeader = Papa.parse(trimmed, {
    header: true,
    skipEmptyLines: true,
    delimiter: '',
    transformHeader: (h) => h.trim(),
  });

  // Triodos heeft geen header en start met een datum (dd-mm-yyyy) in 9 kolommen.
  const fields = withHeader.meta.fields || [];
  const looksLikeTriodos = fields.length === 9 && /^\d{2}-\d{2}-\d{4}$/.test(fields[0]);
  if (looksLikeTriodos) {
    const noHeader = Papa.parse(trimmed, {
      header: false,
      skipEmptyLines: true,
      delimiter: withHeader.meta.delimiter || ',',
    });
    const rows = noHeader.data.map((row) => {
      const obj = {};
      TRIODOS_HEADERS.forEach((h, i) => { obj[h] = row[i]; });
      return obj;
    });
    return {
      rows,
      headers: TRIODOS_HEADERS,
      delimiter: noHeader.meta.delimiter,
      errors: noHeader.errors,
    };
  }

  return {
    rows: withHeader.data,
    headers: fields,
    delimiter: withHeader.meta.delimiter,
    errors: withHeader.errors,
  };
}

export function detectFormat(headers) {
  return BANK_FORMATS.find((f) => f.detect(headers));
}

export function parseCsvDate(raw, hint) {
  if (!raw) return null;
  const s = String(raw).trim();

  // YYYYMMDD (bijv. 20240315)
  if (/^\d{8}$/.test(s)) {
    return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
  }
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // DD-MM-YYYY of DD/MM/YYYY
  const m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/);
  if (m) {
    let [, d, mo, y] = m;
    if (y.length === 2) y = `20${y}`;
    return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }
  // fallback: laat Date parsen
  const dt = new Date(s);
  if (!Number.isNaN(dt.getTime())) return dt.toISOString().slice(0, 10);
  return null;
}

export function rowToTransaction(row, mapping, defaults = {}) {
  const dateRaw = row[mapping.date];
  const date = parseCsvDate(dateRaw);
  if (!date) return null;

  const amountRaw = row[mapping.amount];
  let amount = parseAmount(amountRaw);
  let type = 'expense';

  if (mapping.typeColumn && row[mapping.typeColumn] != null) {
    const val = String(row[mapping.typeColumn]).trim();
    if (val === mapping.typeIncomeValue) type = 'income';
    else if (val === mapping.typeExpenseValue) type = 'expense';
  } else {
    // Gebruik teken van bedrag: positief = inkomst, negatief = uitgave
    if (amount > 0) type = 'income';
    else if (amount < 0) type = 'expense';
  }
  amount = Math.abs(amount);
  if (!amount) return null;

  const parts = [];
  if (mapping.description && row[mapping.description]) parts.push(String(row[mapping.description]).trim());
  if (mapping.notes && row[mapping.notes]) {
    const n = String(row[mapping.notes]).trim();
    if (n && !parts.includes(n)) parts.push(n);
  }
  const description = parts.join(' · ').replace(/\s+/g, ' ').slice(0, 200);

  return {
    date,
    amount,
    type,
    description,
    categoryId: defaults.categoryId || null,
    userId: defaults.userId || null,
  };
}

// Keyword-based categorisatie. Volgorde is belangrijk: specifiekere slugs eerst.
const CATEGORY_KEYWORDS = {
  // Overboekingen tussen eigen rekeningen (interne stromen) — eerst matchen om onterecht 'salaris' te voorkomen.
  overboeking: ['t. de roos', 'de roos en/of', 'r.e. jansen', 'r. e. jansen'],
  // Vaste lasten
  woning: ['obvion', 'hypotheek', 'huur ', ' huur', 'vve '],
  nuts: ['eneco', 'vattenfall', 'essent', 'greenchoice', 'nuon', 'vitens', 'evides', 'oasen', 'delta ', 'ziggo', 'kpn', 'vodafone', 't-mobile', 'odido'],
  verzekering: ['verzekering', 'insurance', 'zilveren kruis', 'cz ', 'menzis', 'vgz', 'ohra', 'univé', 'unive', 'centraal beheer', 'aegon', 'nationale nederlanden', 'asr'],
  belasting: ['belastingdienst', 'gblt', 'waterschap', 'gemeente apeldoorn', 'bng*gemeente'],
  abonnementen: ['spotify', 'netflix', 'disney', 'hbo', 'skyshowtime', 'apple.com', 'icloud', 'youtube', 'amazon prime', 'nordvpn', 'notion', 'dropbox', 'strava', 'transip', 'youfone', 'simyo', 'npo ', 'dpg media'],
  // Boodschappen (Albert Heijn heeft veel filialen: 1261, 4068, 8605, 8732, etc.)
  boodschappen: ['albert heijn', 'ah 8', 'ah 4', 'ah to go', 'jumbo', 'aldi', 'lidl', 'plus supermarkt', 'plus apeldoorn', 'plus ', 'dirk', 'coop', 'spar', 'vomar', 'deen', 'hoogvliet', 'ekoplaza', 'sprengenpark', 'de kaasman', 'flink bv', 'flink '],
  huishouden: ['ikea', 'action', 'kruidvat', 'etos', 'blokker', 'hema', 'bol.com', 'praxis', 'gamma', 'karwei', 'coolblue', 'mediamarkt', 'xenos'],
  auto: ['shell', 'bck*shell', 'bp ', 'esso', 'tinq', 'total ', 'texaco', 'ov-chip', 'ns.nl', 'ns groep', '9292', 'flixbus', 'greenwheels', 'parkeren', 'parking', 'q-park'],
  zorg: ['d.s.w.', 'dsw ', 'apotheek', 'huisarts', 'tandarts', 'fysio', 'ziekenhuis'],
  // Aanname: A./L./Anne/Lotte Jansen = kinderen (regelmatige kleine overboekingen). Herstel handmatig als het anders is.
  kinderen: ['kinderopvang', 'bso ', 'basisschool', 'peuterspeelzaal', 'intertoys', 'bart smit', 'a. jansen', 'l. jansen', 'anne jansen', 'lotte jansen', 'jansen via tikkie'],
  uiteten: ['restaurant', 'thuisbezorgd', 'takeaway.com', 'uber eats', 'deliveroo', 'mcdonald', 'kfc', 'domino', 'new york pizza', 'starbucks', 'pizza sandro', 'cafetaria', 'la place', 'la cubanita'],
  vrijetijd: ['bioscoop', 'pathé', 'kinepolis', 'basic-fit', 'sportschool', 'concert', 'ticketmaster', 'cts eventim', 'efteling', 'boulder', 'neoliet', 'annebra', 'decathlon', 'randerode', 'entreegebied'],
  kleding: ['h&m', 'zara ', 'uniqlo', 'bershka', 'zalando', 'bijenkorf', 'primark', 'wehkamp', 'nike ', 'adidas'],
  vakantie: ['booking.com', 'airbnb', 'transavia', 'klm ', 'ryanair', 'easyjet', 'expedia', 'trainline', 'camp oasis', 'campingcard'],
  // Inkomsten — na overboeking geplaatst zodat 't. de roos' als overboeking wordt gemarkeerd.
  salaris: ['salaris', 'salary', 'loon ', 't de roos', 'mw re jansen'],
  toeslagen: ['toeslagen', 'zorgtoeslag', 'huurtoeslag', 'kindgebonden', 'kinderbijslag', 'sociale verzekeringsbank', 'svb ', 'belastingdienst'],
};

export function suggestCategoryId(description, categories) {
  if (!description) return null;
  const desc = description.toLowerCase();
  for (const [slug, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some((k) => desc.includes(k))) {
      // Zoek eerste categorie die matcht op naam of id-fragment
      const match = categories.find((c) => c.id.includes(slug) || c.name.toLowerCase().includes(slug));
      if (match) return match.id;
    }
  }
  return null;
}
