export type PricingPlan = {
  code: string
  label: string
  groupId: string
  groupLabel: string
  users: number
  usersLabel: string
  storageLabel: string
  monthlyPrice: number
  yearlyPrice: number
  highlights: string[]
  recommended?: boolean
}

export type PricingPlanGroup = {
  id: string
  name: string
  description: string
  summaryFeatures: string[]
  popular?: boolean
  plans: PricingPlan[]
}

export const pricingSiteNote =
  "Setiap paket berlaku untuk 1 site. Jika butuh site tambahan, tambahkan paket lain."

export const pricingPlanGroups: PricingPlanGroup[] = [
  {
    id: "kelas",
    name: "Kelas & Pelatihan",
    description: "Untuk kelas, pelatihan, dan sekolah kecil yang butuh mulai cepat.",
    summaryFeatures: [
      "10-100 pengguna",
      "10-50 GB storage",
      "Backup harian",
      "Support email",
    ],
    plans: [
      {
        code: "kelas-10",
        label: "Kelas 10",
        groupId: "kelas",
        groupLabel: "Kelas & Pelatihan",
        users: 10,
        usersLabel: "10 pengguna",
        storageLabel: "10 GB",
        monthlyPrice: 149000,
        yearlyPrice: 1430000,
        highlights: ["Backup harian", "Support email", "Custom domain opsional"],
      },
      {
        code: "kelas-50",
        label: "Kelas 50",
        groupId: "kelas",
        groupLabel: "Kelas & Pelatihan",
        users: 50,
        usersLabel: "50 pengguna",
        storageLabel: "25 GB",
        monthlyPrice: 299000,
        yearlyPrice: 2870000,
        highlights: ["Backup harian", "Support email", "Custom domain opsional"],
      },
      {
        code: "kelas-100",
        label: "Kelas 100",
        groupId: "kelas",
        groupLabel: "Kelas & Pelatihan",
        users: 100,
        usersLabel: "100 pengguna",
        storageLabel: "50 GB",
        monthlyPrice: 499000,
        yearlyPrice: 4790000,
        highlights: ["Backup harian", "Support email", "Custom domain opsional"],
      },
    ],
  },
  {
    id: "institusi",
    name: "Institusi",
    description: "Untuk kampus, lembaga, dan operasional harian yang butuh performa dedicated.",
    summaryFeatures: [
      "300-700 pengguna",
      "200-500 GB storage",
      "Dedicated VPS",
      "Support prioritas",
    ],
    popular: true,
    plans: [
      {
        code: "institusi-300",
        label: "Institusi 300",
        groupId: "institusi",
        groupLabel: "Institusi",
        users: 300,
        usersLabel: "300 pengguna",
        storageLabel: "200 GB",
        monthlyPrice: 1499000,
        yearlyPrice: 14390000,
        highlights: ["Dedicated VPS", "Backup harian", "Support prioritas"],
      },
      {
        code: "institusi-500",
        label: "Institusi 500",
        groupId: "institusi",
        groupLabel: "Institusi",
        users: 500,
        usersLabel: "500 pengguna",
        storageLabel: "350 GB",
        monthlyPrice: 2499000,
        yearlyPrice: 23990000,
        highlights: ["Dedicated VPS", "Backup harian", "Support prioritas"],
        recommended: true,
      },
      {
        code: "institusi-700",
        label: "Institusi 700",
        groupId: "institusi",
        groupLabel: "Institusi",
        users: 700,
        usersLabel: "700 pengguna",
        storageLabel: "500 GB",
        monthlyPrice: 3499000,
        yearlyPrice: 33590000,
        highlights: ["Dedicated VPS", "Backup harian", "Support prioritas"],
      },
    ],
  },
  {
    id: "skala",
    name: "Skala Besar",
    description: "Untuk kebutuhan besar, trafik tinggi, dan pertumbuhan pengguna yang agresif.",
    summaryFeatures: [
      "1.000-10.000 pengguna",
      "750 GB-6 TB storage",
      "HA cluster",
      "Support dedicated",
    ],
    plans: [
      {
        code: "skala-1000",
        label: "Skala 1000",
        groupId: "skala",
        groupLabel: "Skala Besar",
        users: 1000,
        usersLabel: "1.000 pengguna",
        storageLabel: "750 GB",
        monthlyPrice: 5999000,
        yearlyPrice: 57590000,
        highlights: ["HA cluster", "Backup lebih sering", "Support dedicated"],
      },
      {
        code: "skala-3000",
        label: "Skala 3000",
        groupId: "skala",
        groupLabel: "Skala Besar",
        users: 3000,
        usersLabel: "3.000 pengguna",
        storageLabel: "1.5 TB",
        monthlyPrice: 12999000,
        yearlyPrice: 124790000,
        highlights: ["HA cluster", "Backup lebih sering", "Support dedicated"],
      },
      {
        code: "skala-5000",
        label: "Skala 5000",
        groupId: "skala",
        groupLabel: "Skala Besar",
        users: 5000,
        usersLabel: "5.000 pengguna",
        storageLabel: "3 TB",
        monthlyPrice: 19999000,
        yearlyPrice: 191990000,
        highlights: ["HA cluster", "Backup lebih sering", "Support dedicated"],
      },
      {
        code: "skala-10000",
        label: "Skala 10000",
        groupId: "skala",
        groupLabel: "Skala Besar",
        users: 10000,
        usersLabel: "10.000 pengguna",
        storageLabel: "6 TB",
        monthlyPrice: 34999000,
        yearlyPrice: 335990000,
        highlights: ["HA cluster", "Backup lebih sering", "Support dedicated"],
      },
    ],
  },
]

export const pricingFaqs = [
  {
    question: "Apakah ada biaya setup di luar harga bulanan?",
    answer:
      "Tidak ada biaya tersembunyi. Harga yang ditampilkan adalah contoh biaya layanan sesuai paket yang dipilih.",
  },
  {
    question: "Kalau saya butuh lebih dari 1 site bagaimana?",
    answer:
      "Setiap paket berlaku untuk 1 site. Jika Anda butuh site tambahan, Anda bisa menambahkan paket lain sesuai kapasitas yang dibutuhkan.",
  },
  {
    question: "Apakah saya bisa upgrade paket nanti?",
    answer:
      "Bisa. Anda dapat pindah ke paket dengan kapasitas pengguna dan storage yang lebih besar saat kebutuhan bertambah.",
  },
  {
    question: "Apakah pembayaran tahunan wajib?",
    answer:
      "Tidak wajib. Toggle tahunan hanya menampilkan opsi komitmen tahunan dengan harga total yang lebih hemat.",
  },
  {
    question: "Bagaimana jika pengguna aktif saya melebihi kapasitas paket?",
    answer:
      "Kami sarankan upgrade ke paket berikutnya sebelum kapasitas habis agar performa tetap stabil dan pengalaman pengguna tetap nyaman.",
  },
  {
    question: "Apakah paket di atas 10.000 pengguna bisa dibantu juga?",
    answer:
      "Bisa. Paket hingga 10.000 pengguna adalah contoh awal. Untuk kebutuhan di atas itu, tim sales dapat menyiapkan arsitektur yang lebih sesuai.",
  },
]

export const pricingPlanOptions = pricingPlanGroups.flatMap((group) =>
  group.plans.map((plan) => ({
    ...plan,
    caption: `${formatPrice(plan.monthlyPrice)}/bulan`,
    description: `${plan.usersLabel} • ${plan.storageLabel} • ${group.name}`,
  })),
)

export function formatPrice(price: number) {
  return new Intl.NumberFormat("id-ID").format(price)
}

export function getGroupStartingPlan(group: PricingPlanGroup) {
  return group.plans[0]
}

export function getPricingTier(planCode?: string | null) {
  if (!planCode) {
    return null
  }

  return pricingPlanOptions.find((plan) => plan.code === planCode) ?? null
}

export const getTierByCode = getPricingTier

export function formatPricingPlanLabel(planCode?: string | null) {
  return getPricingTier(planCode)?.label ?? planCode ?? ""
}
