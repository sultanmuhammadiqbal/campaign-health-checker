import { analyzeCampaign } from "./logic.js";

const root = document;
const form = root.querySelector("#health-form");
const byId = (id) => root.querySelector(`#${id}`);
const numberValue = (id) => Number(byId(id).value || 0);
const choice = (id) => byId(id).value;

const money = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0
});
const decimal = new Intl.NumberFormat("id-ID", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

const platformChecks = {
  "Google Ads": [
    { id: "google-attribution", label: "Attribution window sudah dipahami dan konsisten?", kind: "tracking", danger: "Tidak", initial: "Ya", note: "Attribution window belum dipastikan konsisten." },
    { id: "google-lag", label: "Conversion lag sudah diperhitungkan?", kind: "data", danger: "Tidak", initial: "Ya", note: "Conversion lag belum diperhitungkan." },
    { id: "google-goal", label: "Purchase yang dinilai sesuai goal campaign?", kind: "tracking", danger: "Tidak", initial: "Ya", note: "Purchase belum dipastikan sesuai goal campaign." }
  ],
  "Meta Ads": [
    { id: "meta-event", label: "Event Purchase sudah diperiksa pencatatannya?", kind: "tracking", danger: "Tidak", initial: "Ya", note: "Pencatatan event Purchase belum diperiksa." },
    { id: "meta-duplicate", label: "Kemungkinan purchase tercatat ganda sudah diperiksa?", kind: "tracking", danger: "Tidak", initial: "Ya", note: "Kemungkinan pencatatan purchase ganda belum diperiksa." },
    { id: "meta-attribution", label: "Attribution setting sesuai dengan laporan?", kind: "tracking", danger: "Tidak", initial: "Ya", note: "Attribution setting belum dipastikan sesuai." }
  ],
  "Shopee Ads": [
    { id: "shopee-stock", label: "Stok produk masih mencukupi?", kind: "operational", danger: "Tidak", initial: "Tidak", note: "Stok produk belum mencukupi." },
    { id: "shopee-variants", label: "Variasi utama masih tersedia?", kind: "operational", danger: "Tidak", initial: "Tidak", note: "Variasi utama tidak tersedia." },
    { id: "shopee-offer", label: "Harga dan promo masih kompetitif?", kind: "operational", danger: "Tidak", initial: "Ya", note: "Harga atau promo perlu diperiksa." },
    { id: "shopee-period", label: "Mendekati payday atau campaign besar?", kind: "timing", danger: "", initial: "Ya", note: "Periode mendekati payday atau campaign besar." }
  ],
  "TikTok Ads": [
    { id: "tiktok-source", label: "Sumber purchase—website atau TikTok Shop—sudah jelas?", kind: "tracking", danger: "Tidak", initial: "Ya", note: "Sumber purchase belum dipastikan." },
    { id: "tiktok-event", label: "Pencatatan Purchase sudah diperiksa?", kind: "tracking", danger: "Tidak", initial: "Ya", note: "Pencatatan Purchase belum diperiksa." },
    { id: "tiktok-stock", label: "Stok dan variasi utama masih tersedia?", kind: "operational", danger: "Tidak", initial: "Ya", note: "Stok atau variasi utama perlu diperiksa." },
    { id: "tiktok-period", label: "Mendekati payday atau campaign besar?", kind: "timing", danger: "", initial: "Tidak", note: "Periode mendekati payday atau campaign besar." }
  ],
  "Lainnya": [
    { id: "other-attribution", label: "Definisi purchase dan attribution sudah dipahami?", kind: "tracking", danger: "Tidak", initial: "Belum tahu", note: "Definisi purchase atau attribution belum dipastikan." },
    { id: "other-stock", label: "Stok atau kapasitas pemenuhan masih tersedia?", kind: "operational", danger: "Tidak", initial: "Belum tahu", note: "Stok atau kapasitas pemenuhan belum dipastikan." }
  ]
};

function renderPlatformChecks() {
  const platform = choice("platform");
  const definitions = platformChecks[platform] || platformChecks.Lainnya;
  const container = byId("platform-checks");
  byId("platform-check-label").textContent = `Pemeriksaan untuk ${platform}`;
  byId("platform-heading").textContent = `Khusus ${platform}`;
  container.replaceChildren();

  definitions.forEach((definition) => {
    const item = document.createElement("div");
    item.className = "context-item";
    const label = document.createElement("label");
    label.htmlFor = definition.id;
    label.textContent = definition.label;
    const select = document.createElement("select");
    select.id = definition.id;
    select.dataset.platformCheck = "true";
    select.dataset.kind = definition.kind;
    select.dataset.danger = definition.danger;
    select.dataset.note = definition.note;
    ["Ya", "Tidak", "Belum tahu", "Tidak relevan"].forEach((value) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = value;
      option.selected = value === definition.initial;
      select.appendChild(option);
    });
    item.append(label, select);
    container.appendChild(item);
  });
}

function getPlatformAnswers() {
  return Array.from(root.querySelectorAll("[data-platform-check]")).map((select) => ({
    value: select.value,
    kind: select.dataset.kind,
    danger: select.dataset.danger,
    note: select.dataset.note
  }));
}

function buildJourney(platform) {
  const journeys = {
    "Shopee Ads": ["Klik iklan", "Halaman produk", "Pilih varian / keranjang", "Checkout", "Purchase tercatat"],
    "TikTok Ads": ["Klik iklan", "Produk / website", "Pilih produk", "Checkout", "Purchase tercatat"],
    "Google Ads": ["Klik iklan", "Landing page", "Add to cart", "Mulai checkout", "Purchase tercatat"],
    "Meta Ads": ["Klik iklan", "Landing page", "Add to cart", "Mulai checkout", "Purchase tercatat"],
    "Lainnya": ["Klik iklan", "Halaman tujuan", "Minat beli", "Checkout", "Purchase tercatat"]
  };
  return journeys[platform] || journeys.Lainnya;
}

function buildInterpretation(input, result) {
  const lines = [];
  const { metrics } = result;
  if (input.clicks === 0) {
    lines.push("Iklan memperoleh impressions, tetapi belum menghasilkan klik. Masalahnya masih berada sebelum orang masuk ke halaman produk.");
  } else {
    const perThousand = metrics.cvr === null ? 0 : Math.round(metrics.cvr * 10);
    lines.push(`Dari ${input.clicks.toLocaleString("id-ID")} clicks, ${input.purchases.toLocaleString("id-ID")} purchase tercatat. Artinya sekitar ${perThousand.toLocaleString("id-ID")} purchase untuk setiap 1.000 clicks.`);
  }

  if (input.targetCpa > 0) {
    if (metrics.cpa === null) {
      lines.push(`CPA belum dapat dihitung karena belum ada purchase. Target CPA yang dimasukkan adalah ${money.format(input.targetCpa)}.`);
    } else if (metrics.cpa > input.targetCpa) {
      const difference = metrics.cpa - input.targetCpa;
      lines.push(`CPA saat ini ${money.format(metrics.cpa)}, atau ${money.format(difference)} lebih tinggi daripada target ${money.format(input.targetCpa)}.`);
    } else {
      lines.push(`CPA saat ini ${money.format(metrics.cpa)} dan masih memenuhi target ${money.format(input.targetCpa)}.`);
    }
  }

  if (input.targetRoas > 0 && metrics.roas !== null) {
    const position = metrics.roas >= input.targetRoas ? "memenuhi" : "belum memenuhi";
    lines.push(`Setiap Rp1 biaya iklan menghasilkan sekitar Rp${decimal.format(metrics.roas)} attributed revenue. Angka ini ${position} break-even ROAS ${decimal.format(input.targetRoas)}.`);
  }
  return lines;
}

function buildAnalysisLimit(input, result) {
  if (result.status.code === "Data incomplete") {
    return "Karena datanya belum lengkap, perubahan performa belum bisa dibedakan dari keterlambatan laporan atau atribusi.";
  }
  if (result.status.code === "Tracking check required") {
    return "Selama purchase atau revenue belum tercatat dengan benar, CPA dan ROAS dapat terlihat lebih baik atau lebih buruk daripada kondisi sebenarnya.";
  }
  return `Dari input ${input.platform} ini, tool hanya mengetahui angka agregat dan jawaban pemeriksaanmu. Tool belum bisa memastikan apakah penyebab utamanya adalah traffic, halaman produk, harga, stok, atau proses checkout.`;
}

function investigateSteps(platform) {
  const commonLastStep = {
    title: "Ubah satu hal dahulu",
    detail: "Jangan mengganti targeting, harga, halaman, dan budget bersamaan. Ubah satu bagian, lalu bandingkan periode sebelum dan sesudah dengan atribusi yang sama."
  };
  const byPlatform = {
    "Shopee Ads": [
      {
        title: "Periksa relevansi traffic",
        detail: "Kalau laporan keyword atau sumber pencarian tersedia, lihat apakah istilah yang membawa klik memang sesuai dengan produk, harga, kategori, dan kebutuhan pembeli. Klik dari pencarian yang terlalu umum bisa ramai tetapi niat belinya lemah."
      },
      {
        title: "Periksa penawaran di halaman produk",
        detail: "Bandingkan foto utama, judul, harga setelah voucher, ongkir, rating, ulasan, stok, dan variasi dengan produk pesaing yang muncul berdekatan."
      },
      {
        title: "Cari titik berhenti setelah klik",
        detail: "Jika data keranjang atau checkout tersedia: klik tinggi tetapi tambah ke keranjang rendah mengarah ke masalah produk atau penawaran. Keranjang tinggi tetapi purchase rendah mengarah ke stok, ongkir, voucher, harga akhir, atau pembeli yang menunggu campaign."
      },
      commonLastStep
    ],
    "Google Ads": [
      {
        title: "Periksa kecocokan traffic dengan landing page",
        detail: "Lihat search term, keyword, audience, atau placement yang membawa klik. Pastikan kebutuhan pada iklan benar-benar dijawab oleh halaman tujuan."
      },
      {
        title: "Periksa tahapan setelah landing page",
        detail: "Jika tersedia, bandingkan add to cart, begin checkout, dan purchase. Penurunan terbesar menunjukkan bagian yang perlu diperiksa lebih dahulu."
      },
      {
        title: "Periksa pengalaman halaman",
        detail: "Cek kecepatan, tampilan ponsel, harga, stok, pilihan produk, serta apakah tombol pembelian bekerja dengan benar."
      },
      commonLastStep
    ],
    "Meta Ads": [
      {
        title: "Cocokkan janji iklan dengan halaman tujuan",
        detail: "Pastikan produk, harga, promo, dan pesan yang terlihat setelah klik sama dengan yang dijanjikan pada creative."
      },
      {
        title: "Bandingkan klik dengan landing-page view",
        detail: "Kalau link click ramai tetapi landing-page view jauh lebih sedikit, periksa kecepatan halaman, link, atau proses pemuatan halaman."
      },
      {
        title: "Lihat add to cart sampai purchase",
        detail: "Add to cart rendah mengarah ke penawaran atau kecocokan produk. Checkout tinggi tetapi purchase rendah mengarah ke hambatan pembayaran, ongkir, atau stok."
      },
      commonLastStep
    ],
    "TikTok Ads": [
      {
        title: "Cocokkan konten dengan produk setelah klik",
        detail: "Pastikan produk, harga, variasi, dan promo di TikTok Shop atau website sama dengan yang ditampilkan dalam iklan."
      },
      {
        title: "Pastikan sumber purchase yang dinilai",
        detail: "Pisahkan purchase yang terjadi di TikTok Shop dan website agar angka yang dibandingkan mempunyai sumber yang jelas."
      },
      {
        title: "Cari titik berhenti sebelum purchase",
        detail: "Jika tersedia, gunakan data product view, add to cart, checkout, dan purchase untuk melihat tahap dengan penurunan terbesar."
      },
      commonLastStep
    ]
  };
  return byPlatform[platform] || [
    { title: "Periksa kecocokan traffic", detail: "Pastikan orang yang mengeklik iklan memang mencari produk atau penawaran yang tersedia." },
    { title: "Periksa halaman tujuan", detail: "Cek harga, stok, kejelasan penawaran, dan kemudahan pembelian." },
    commonLastStep
  ];
}

function buildActions(input, result) {
  switch (result.status.code) {
    case "Data incomplete":
      return [
        { title: "Pastikan periode laporan selesai", detail: "Tunggu pembaruan data dan attribution lag yang berlaku pada platform sebelum membandingkan hasil." },
        { title: "Jangan ubah budget berdasarkan data sementara", detail: "Perubahan terlalu cepat membuat hasil sebelum dan sesudah sulit dibedakan." },
        { title: "Jalankan pemeriksaan ulang", detail: "Gunakan periode, conversion, dan sumber revenue yang sama setelah data lengkap." }
      ];
    case "Tracking check required":
      return [
        { title: "Pastikan purchase adalah conversion utama", detail: "Pisahkan purchase dari add to cart, page view, chat, atau conversion lain sebelum membaca CPA." },
        { title: "Cocokkan purchase dan revenue", detail: "Purchase tanpa revenue, atau revenue tanpa purchase, perlu diperiksa sebelum ROAS digunakan." },
        { title: `Periksa pencatatan di ${input.platform}`, detail: "Pastikan event, attribution, dan periode laporan konsisten dengan data yang dimasukkan ke tool." }
      ];
    case "Operational check required": {
      const detected = result.notes.filter((note) => !note.includes("campaign besar") && !note.includes("belum diketahui"));
      return [
        { title: "Bereskan hambatan yang sudah ditemukan", detail: detected.length ? detected.join(" ") : "Periksa link, stok, variasi, harga, dan promo yang sedang aktif." },
        { title: "Tahan perubahan targeting atau budget", detail: "Iklan belum bisa dinilai adil selama pembeli datang ke produk yang salah, stok kosong, atau penawaran tidak siap." },
        { title: "Uji ulang setelah operasional siap", detail: "Gunakan periode baru dengan stok, link, dan promo yang sudah dipastikan, lalu bandingkan CPA dan ROAS kembali." }
      ];
    }
    case "Investigate funnel":
      return investigateSteps(input.platform);
    case "Eligible for cautious scale":
      return [
        { title: "Naikkan budget secara bertahap", detail: "Hindari perubahan besar sekaligus agar dampaknya masih bisa dipantau." },
        { title: "Pantau CPA dan ROAS setelah perubahan", detail: "Gunakan periode dan attribution yang sama supaya perbandingannya adil." },
        { title: "Hentikan kenaikan jika target mulai gagal", detail: "Layak scale bukan jaminan performa akan tetap sama saat volume bertambah." }
      ];
    default:
      return [
        { title: "Lengkapi konteks yang belum diketahui", detail: "Periksa stok, tracking, link, promo, dan kondisi campaign yang masih belum terjawab." },
        { title: "Pertahankan kondisi sementara", detail: "Belum ada alasan yang cukup kuat untuk menaikkan atau menghentikan campaign." },
        { title: "Jalankan pemeriksaan ulang", detail: "Setelah konteks lengkap, lihat apakah status berubah menjadi layak scale atau perlu diperiksa lebih lanjut." }
      ];
  }
}

function readInput() {
  return {
    campaignName: byId("campaign-name").value.trim(),
    platform: choice("platform"),
    periodStart: byId("period-start").value,
    periodEnd: byId("period-end").value,
    spend: numberValue("spend"),
    impressions: numberValue("impressions"),
    clicks: numberValue("clicks"),
    purchases: numberValue("purchases"),
    revenue: numberValue("revenue"),
    targetCpa: numberValue("target-cpa"),
    targetRoas: numberValue("target-roas"),
    primaryConversion: choice("primary-conversion"),
    dataComplete: choice("data-complete"),
    linkCorrect: choice("link-correct"),
    platformAnswers: getPlatformAnswers()
  };
}

function formatMetric(value, type) {
  if (value === null || !Number.isFinite(value)) return "N/A";
  if (type === "money") return money.format(value);
  if (type === "percent") return `${decimal.format(value)}%`;
  return `${decimal.format(value)}×`;
}

function renderResult(result, input) {
  byId("m-ctr").textContent = formatMetric(result.metrics.ctr, "percent");
  byId("m-cpc").textContent = formatMetric(result.metrics.cpc, "money");
  byId("m-cvr").textContent = formatMetric(result.metrics.cvr, "percent");
  byId("m-cpa").textContent = formatMetric(result.metrics.cpa, "money");
  byId("m-roas").textContent = formatMetric(result.metrics.roas, "roas");

  const validation = byId("validation");
  if (result.errors.length) {
    validation.innerHTML = result.errors.map((error) => `<div>• ${error}</div>`).join("");
    validation.style.display = "block";
    return;
  }

  validation.style.display = "none";
  byId("status-label").textContent = result.status.label;
  byId("status-code").textContent = result.status.code;
  byId("diagnosis-copy").textContent = result.diagnosis;
  byId("result-note").textContent = result.recommendation;

  const interpretation = byId("interpretation");
  interpretation.replaceChildren();
  buildInterpretation(input, result).forEach((line) => {
    const item = document.createElement("li");
    item.textContent = line;
    interpretation.appendChild(item);
  });

  byId("analysis-limit-copy").textContent = buildAnalysisLimit(input, result);

  const journey = byId("journey");
  journey.replaceChildren();
  buildJourney(input.platform).forEach((step, index, stages) => {
    const chip = document.createElement("span");
    chip.className = "journey-step";
    chip.textContent = step;
    journey.appendChild(chip);
    if (index < stages.length - 1) {
      const arrow = document.createElement("span");
      arrow.className = "journey-arrow";
      arrow.setAttribute("aria-hidden", "true");
      arrow.textContent = "→";
      journey.appendChild(arrow);
    }
  });
  byId("journey-help").textContent = "Click-to-purchase bukan satu metrik khusus. Ini rangkaian setelah orang mengeklik iklan sampai purchase tercatat. Input sekarang hanya mengetahui clicks dan purchase; gunakan data tahap tengah jika platform menyediakannya.";

  const actionList = byId("action-list");
  actionList.replaceChildren();
  buildActions(input, result).forEach((action, index) => {
    const item = document.createElement("li");
    const number = document.createElement("span");
    number.className = "action-number";
    number.setAttribute("aria-hidden", "true");
    number.textContent = String(index + 1);
    const title = document.createElement("span");
    title.className = "action-title";
    title.textContent = action.title;
    const detail = document.createTextNode(action.detail);
    item.append(number, title, detail);
    actionList.appendChild(item);
  });

  const checks = byId("checks");
  checks.replaceChildren();
  const notes = result.notes.length ? result.notes : ["Tidak ada peringatan tambahan yang diketahui."];
  notes.forEach((note) => {
    const item = document.createElement("li");
    item.textContent = note;
    checks.appendChild(item);
  });
}

function analyzeAndRender() {
  const input = readInput();
  renderResult(analyzeCampaign(input), input);
}

function setInputMethod(method) {
  const upload = method === "upload";
  byId("manual-method").classList.toggle("is-active", !upload);
  byId("manual-method").setAttribute("aria-pressed", String(!upload));
  byId("upload-method").classList.toggle("is-active", upload);
  byId("upload-method").setAttribute("aria-pressed", String(upload));
  byId("upload-box").classList.toggle("is-visible", upload);
}

function parseCsvLine(line) {
  const values = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"' && line[index + 1] === '"' && quoted) {
      current += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === "," && !quoted) {
      values.push(current.trim());
      current = "";
    } else {
      current += character;
    }
  }
  values.push(current.trim());
  return values;
}

async function loadCsv() {
  const file = byId("csv-file").files?.[0];
  const status = byId("upload-status");
  if (!file) {
    status.textContent = "Pilih file CSV terlebih dahulu.";
    return;
  }

  try {
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter((line) => line.trim());
    if (lines.length < 2) throw new Error("Template belum memiliki baris data.");
    const headers = parseCsvLine(lines[0]);
    const values = parseCsvLine(lines[1]);
    const record = Object.fromEntries(headers.map((header, index) => [header, values[index] || ""]));
    const required = ["campaign_name", "platform", "period_start", "period_end", "spend", "impressions", "clicks", "purchases", "attributed_revenue"];
    const missing = required.filter((column) => !(column in record));
    if (missing.length) throw new Error(`Kolom belum sesuai template: ${missing.join(", ")}.`);

    byId("campaign-name").value = record.campaign_name;
    const platforms = Array.from(byId("platform").options).map((option) => option.value);
    byId("platform").value = platforms.includes(record.platform) ? record.platform : "Lainnya";
    byId("period-start").value = record.period_start;
    byId("period-end").value = record.period_end;
    byId("spend").value = record.spend;
    byId("impressions").value = record.impressions;
    byId("clicks").value = record.clicks;
    byId("purchases").value = record.purchases;
    byId("revenue").value = record.attributed_revenue;
    if ("target_cpa" in record) byId("target-cpa").value = record.target_cpa;
    if ("break_even_roas" in record) byId("target-roas").value = record.break_even_roas;
    renderPlatformChecks();
    status.textContent = "Satu campaign berhasil dimasukkan. Lengkapi pemeriksaan tambahan, lalu tekan Periksa campaign.";
  } catch (error) {
    status.textContent = `${error.message} Versi awal belum menerima ekspor mentah platform.`;
  }
}

function downloadTemplate() {
  const csv = [
    "campaign_name,platform,period_start,period_end,spend,impressions,clicks,purchases,attributed_revenue,target_cpa,break_even_roas",
    '"Sepatu Running A — Iklan Produk","Shopee Ads",2026-10-01,2026-10-07,1750000,78125,2500,10,4000000,100000,3'
  ].join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "campaign-health-checker-template.csv";
  anchor.click();
  URL.revokeObjectURL(url);
}

byId("manual-method").addEventListener("click", () => setInputMethod("manual"));
byId("upload-method").addEventListener("click", () => setInputMethod("upload"));
byId("load-csv").addEventListener("click", loadCsv);
byId("download-template").addEventListener("click", downloadTemplate);
byId("platform").addEventListener("change", renderPlatformChecks);
form.addEventListener("submit", (event) => {
  event.preventDefault();
  analyzeAndRender();
});

renderPlatformChecks();
analyzeAndRender();
