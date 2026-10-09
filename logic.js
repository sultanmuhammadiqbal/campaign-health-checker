export const STATUS = {
  DATA_INCOMPLETE: {
    label: "Data belum cukup",
    code: "Data incomplete"
  },
  TRACKING_CHECK: {
    label: "Periksa tracking",
    code: "Tracking check required"
  },
  OPERATIONAL_CHECK: {
    label: "Periksa operasional",
    code: "Operational check required"
  },
  INVESTIGATE_FUNNEL: {
    label: "Klik belum berubah menjadi pembelian",
    code: "Investigate funnel"
  },
  CAUTIOUS_SCALE: {
    label: "Layak scale perlahan",
    code: "Eligible for cautious scale"
  },
  HOLD: {
    label: "Tahan dulu",
    code: "Hold"
  }
};

const finiteNonNegative = (value) => Number.isFinite(value) && value >= 0;

export function validateInput(input) {
  const errors = [];
  const requiredNumbers = [
    ["Ad spend", input.spend],
    ["Impressions", input.impressions],
    ["Clicks", input.clicks],
    ["Purchase", input.purchases],
    ["Attributed revenue", input.revenue]
  ];

  requiredNumbers.forEach(([label, value]) => {
    if (!finiteNonNegative(value)) errors.push(`${label} harus berupa angka nol atau lebih.`);
  });

  if (input.impressions <= 0) errors.push("Impressions harus lebih dari nol.");
  if (input.spend <= 0) errors.push("Ad spend harus lebih dari nol agar performa dapat dianalisis.");
  if (input.clicks > input.impressions) errors.push("Clicks tidak boleh melebihi impressions.");
  if (input.purchases > input.clicks) errors.push("Purchase tidak boleh melebihi clicks.");
  if (!(input.targetCpa > 0) && !(input.targetRoas > 0)) {
    errors.push("Isi minimal target CPA atau break-even ROAS.");
  }
  if (input.periodStart && input.periodEnd && input.periodStart > input.periodEnd) {
    errors.push("Tanggal mulai tidak boleh melewati tanggal selesai.");
  }

  return errors;
}

export function calculateMetrics(input) {
  return {
    ctr: input.impressions > 0 ? (input.clicks / input.impressions) * 100 : null,
    cpc: input.clicks > 0 ? input.spend / input.clicks : null,
    cvr: input.clicks > 0 ? (input.purchases / input.clicks) * 100 : null,
    cpa: input.purchases > 0 ? input.spend / input.purchases : null,
    roas: input.spend > 0 ? input.revenue / input.spend : null
  };
}

export function analyzeCampaign(input) {
  const errors = validateInput(input);
  if (errors.length) return { errors, metrics: calculateMetrics(input), status: null };

  const metrics = calculateMetrics(input);
  const answers = input.platformAnswers || [];
  const notes = [];

  const unknownUniversal = [input.primaryConversion, input.dataComplete, input.linkCorrect]
    .some((value) => value === "Belum tahu");
  const unknownPlatform = answers.some((answer) => answer.value === "Belum tahu");
  const missingContext = unknownUniversal || unknownPlatform;

  const impossibleRevenue = input.purchases === 0 && input.revenue > 0;
  const missingRevenue = input.purchases > 0 && input.revenue === 0;
  const trackingRisk = input.primaryConversion === "Tidak"
    || impossibleRevenue
    || missingRevenue
    || answers.some((answer) => answer.kind === "tracking" && answer.danger && answer.value === answer.danger);
  const incomplete = input.dataComplete !== "Ya"
    || answers.some((answer) => answer.kind === "data" && answer.danger && answer.value === answer.danger);
  const operationalRisk = input.linkCorrect === "Tidak"
    || answers.some((answer) => answer.kind === "operational" && answer.danger && answer.value === answer.danger);

  const meetsCpa = input.targetCpa > 0 && metrics.cpa !== null ? metrics.cpa <= input.targetCpa : null;
  const meetsRoas = input.targetRoas > 0 && metrics.roas !== null ? metrics.roas >= input.targetRoas : null;
  const hasTargetMiss = meetsCpa === false || meetsRoas === false;
  const hasPassedTarget = meetsCpa === true || meetsRoas === true;
  const allProvidedTargetsMet = hasPassedTarget && meetsCpa !== false && meetsRoas !== false;

  if (input.primaryConversion !== "Ya") notes.push("Primary conversion belum dipastikan sebagai purchase.");
  if (input.dataComplete !== "Ya") notes.push("Kelengkapan data pada periode tersebut belum terkonfirmasi.");
  if (input.linkCorrect === "Tidak") notes.push("Link tidak menuju produk atau halaman yang benar.");
  if (impossibleRevenue) notes.push("Revenue tercatat meskipun purchase bernilai nol.");
  if (missingRevenue) notes.push("Purchase tercatat tetapi attributed revenue masih nol.");
  answers.forEach((answer) => {
    const isRisk = answer.danger && answer.value === answer.danger;
    const isTimingSignal = answer.kind === "timing" && answer.value === "Ya";
    if (isRisk || isTimingSignal) notes.push(answer.note);
  });
  if (missingContext) notes.push("Masih ada konteks yang belum diketahui.");

  if (incomplete) {
    return {
      errors: [], metrics, status: STATUS.DATA_INCOMPLETE, notes,
      diagnosis: "Data belum cukup kuat untuk menghasilkan rekomendasi campaign.",
      recommendation: "Lengkapi atau tunggu data periode tersebut sebelum mengubah budget."
    };
  }

  if (trackingRisk) {
    return {
      errors: [], metrics, status: STATUS.TRACKING_CHECK, notes,
      diagnosis: "Angka purchase atau revenue belum bisa dipakai dengan yakin.",
      recommendation: "Periksa conversion goal, pencatatan purchase, dan atribusi sebelum membaca CPA atau ROAS."
    };
  }

  if (operationalRisk) {
    return {
      errors: [], metrics, status: STATUS.OPERATIONAL_CHECK, notes,
      diagnosis: hasTargetMiss
        ? "Ada kondisi operasional yang dapat menghambat purchase, sementara CPA atau ROAS juga belum memenuhi target."
        : "Ada kondisi operasional yang dapat menghambat purchase meskipun performa iklan terlihat memadai.",
      recommendation: "Jangan langsung menyimpulkan iklannya buruk. Periksa konteks operasional sebelum menaikkan budget."
    };
  }

  if (hasTargetMiss || input.purchases === 0) {
    return {
      errors: [], metrics, status: STATUS.INVESTIGATE_FUNNEL, notes,
      diagnosis: "Data dapat dibaca, tetapi hasil purchase belum memenuhi target yang dimasukkan.",
      recommendation: "Periksa kualitas traffic, halaman produk, penawaran, dan tahapan click-to-purchase."
    };
  }

  if (allProvidedTargetsMet && !missingContext) {
    return {
      errors: [], metrics, status: STATUS.CAUTIOUS_SCALE, notes,
      diagnosis: "Campaign memenuhi target yang dimasukkan dan tidak memiliki peringatan data atau operasional yang diketahui.",
      recommendation: "Jika budget dinaikkan, lakukan bertahap dan pantau CPA serta ROAS setelah perubahan."
    };
  }

  return {
    errors: [], metrics, status: STATUS.HOLD, notes,
    diagnosis: "Target terlihat terpenuhi, tetapi masih ada konteks yang belum diketahui.",
    recommendation: "Pertahankan sementara dan lengkapi pemeriksaan sebelum menaikkan budget."
  };
}
