import { PrismaClient, type Prisma, type Weekday } from '@prisma/client';
import bcrypt from 'bcryptjs';
import 'dotenv/config';

const prisma = new PrismaClient();

const img = (id: string) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=1200&q=80`;

const WEEK: Weekday[] = [
  'SUNDAY',
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
];

async function seedAdmin() {
  const email = process.env.SEED_ADMIN_EMAIL ?? 'admin@rawaqan.local';
  const password = process.env.SEED_ADMIN_PASSWORD ?? 'Admin@12345';
  const name = process.env.SEED_ADMIN_NAME ?? 'Rawaqan Admin';
  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.admin.upsert({
    where: { email },
    update: {},
    create: { email, passwordHash, name, role: 'SUPER_ADMIN' },
  });
  console.log(`✔ admin ready: ${email}`);
}

async function seedSettings() {
  const existing = await prisma.restaurantSettings.findFirst();
  if (existing) return;
  await prisma.restaurantSettings.create({
    data: {
      name: 'روقان',
      nameEn: 'Rawaqan',
      tagline: 'تجربة طعام فاخرة في أجواء استثنائية',
      taglineEn: 'A luxury dining experience in an exceptional atmosphere',
      description:
        'روقان وجهة راقية تجمع بين الأصالة والحداثة، نقدّم أطباقاً مميزة بمكوّنات طازجة وعناية فائقة لتعيش لحظات لا تُنسى.',
      logoUrl: null,
      coverUrl: img('1517248135467-4c7edcad34c4'),
      phone: '+201000000000',
      whatsapp: '+201000000000',
      facebook: 'https://facebook.com/rawaqan',
      instagram: 'https://instagram.com/rawaqan',
      tiktok: 'https://tiktok.com/@rawaqan',
      googleMapsUrl: 'https://maps.google.com/?q=Rawaqan',
      addressLine: 'شارع النيل، المعادي، القاهرة',
      latitude: 29.9602,
      longitude: 31.2569,
      currency: 'EGP',
      footerText: 'روقان © جميع الحقوق محفوظة',
      openingHours: {
        create: WEEK.map((weekday) => ({
          weekday,
          isClosed: weekday === 'MONDAY',
          opensAt: '12:00',
          closesAt: '23:59',
        })),
      },
    },
  });
  console.log('✔ restaurant settings created');
}

const TAGS = [
  { slug: 'best-seller', label: 'الأكثر مبيعاً', labelEn: 'Best Seller', color: '#D4AF37' },
  { slug: 'chef', label: 'اختيار الشيف', labelEn: "Chef's Choice", color: '#111111' },
  { slug: 'spicy', label: 'حار', labelEn: 'Spicy', color: '#C0392B' },
  { slug: 'vegetarian', label: 'نباتي', labelEn: 'Vegetarian', color: '#27AE60' },
  { slug: 'new', label: 'جديد', labelEn: 'New', color: '#2980B9' },
];

async function seedTags() {
  for (const t of TAGS) {
    await prisma.tag.upsert({ where: { slug: t.slug }, update: {}, create: t });
  }
  console.log('✔ tags ready');
}

interface SeedItem {
  slug: string;
  name: string;
  nameEn: string;
  description: string;
  ingredients: string;
  price: number;
  discountPrice?: number;
  calories?: number;
  allergens?: string;
  spiceLevel?: 'NONE' | 'MILD' | 'MEDIUM' | 'HOT';
  flags?: Partial<
    Record<'isFeatured' | 'isBestSeller' | 'isNew' | 'isVegetarian' | 'isChefRecommendation', boolean>
  >;
  image: string;
  tags?: string[];
}

const CATEGORIES: {
  slug: string;
  name: string;
  nameEn: string;
  description: string;
  image: string;
  items: SeedItem[];
}[] = [
  {
    slug: 'starters',
    name: 'المقبلات',
    nameEn: 'Starters',
    description: 'بدايات شهية تفتح الشهية',
    image: img('1541529086526-db283c563270'),
    items: [
      {
        slug: 'hummus-royale',
        name: 'حمص رويال',
        nameEn: 'Hummus Royale',
        description: 'حمص كريمي بزيت الزيتون البكر وصنوبر محمّص',
        ingredients: 'حمص، طحينة، زيت زيتون، ثوم، ليمون، صنوبر',
        price: 85,
        calories: 320,
        allergens: 'سمسم',
        flags: { isVegetarian: true, isBestSeller: true },
        image: img('1637949385162-1b90bb3a5c39'),
        tags: ['vegetarian', 'best-seller'],
      },
      {
        slug: 'spicy-wings',
        name: 'أجنحة حارة',
        nameEn: 'Spicy Wings',
        description: 'أجنحة دجاج مقرمشة بصلصة حارة خاصة',
        ingredients: 'دجاج، صلصة حارة، ثوم، بهارات',
        price: 120,
        calories: 540,
        spiceLevel: 'HOT',
        flags: { isChefRecommendation: true },
        image: img('1608039755401-742074f0548d'),
        tags: ['spicy', 'chef'],
      },
    ],
  },
  {
    slug: 'main-dishes',
    name: 'الأطباق الرئيسية',
    nameEn: 'Main Dishes',
    description: 'أطباق رئيسية غنية بالنكهات',
    image: img('1544025162-d76694265947'),
    items: [
      {
        slug: 'wagyu-steak',
        name: 'ستيك واغيو',
        nameEn: 'Wagyu Steak',
        description: 'ستيك واغيو فاخر مشوي على الفحم مع صلصة الفلفل',
        ingredients: 'لحم واغيو، زبدة، ثوم، إكليل الجبل، صلصة فلفل',
        price: 780,
        discountPrice: 690,
        calories: 850,
        flags: { isFeatured: true, isBestSeller: true, isChefRecommendation: true },
        image: img('1546833999-b9f581a1996d'),
        tags: ['best-seller', 'chef'],
      },
      {
        slug: 'grilled-salmon',
        name: 'سلمون مشوي',
        nameEn: 'Grilled Salmon',
        description: 'فيليه سلمون طازج مع خضار موسمية وصلصة الليمون',
        ingredients: 'سلمون، ليمون، زبدة، خضار موسمية',
        price: 420,
        calories: 610,
        allergens: 'أسماك',
        flags: { isFeatured: true, isNew: true },
        image: img('1467003909585-2f8a72700288'),
        tags: ['new'],
      },
      {
        slug: 'truffle-pasta',
        name: 'باستا الكمأة',
        nameEn: 'Truffle Pasta',
        description: 'باستا كريمية بالكمأة السوداء وجبن البارميزان',
        ingredients: 'باستا، كريمة، كمأة، بارميزان',
        price: 310,
        calories: 720,
        allergens: 'غلوتين، ألبان',
        flags: { isVegetarian: true },
        image: img('1621996346565-e3dbc646d9a9'),
        tags: ['vegetarian'],
      },
    ],
  },
  {
    slug: 'desserts',
    name: 'الحلويات',
    nameEn: 'Desserts',
    description: 'ختام حلو لتجربتك',
    image: img('1551024601-bec78aea704b'),
    items: [
      {
        slug: 'chocolate-fondant',
        name: 'فوندان الشوكولاتة',
        nameEn: 'Chocolate Fondant',
        description: 'كيكة شوكولاتة ذائبة مع آيس كريم الفانيليا',
        ingredients: 'شوكولاتة، زبدة، بيض، سكر، آيس كريم',
        price: 140,
        calories: 480,
        allergens: 'بيض، ألبان، غلوتين',
        flags: { isBestSeller: true },
        image: img('1624353365286-3f8d62daad51'),
        tags: ['best-seller'],
      },
    ],
  },
  {
    slug: 'beverages',
    name: 'المشروبات',
    nameEn: 'Beverages',
    description: 'مشروبات منعشة وساخنة',
    image: img('1514432324607-a09d9b4aefdd'),
    items: [
      {
        slug: 'signature-latte',
        name: 'لاتيه روقان',
        nameEn: 'Rawaqan Latte',
        description: 'لاتيه بنكهة خاصة مع لمسة من الهيل',
        ingredients: 'إسبريسو، حليب، هيل',
        price: 65,
        calories: 180,
        allergens: 'ألبان',
        flags: { isNew: true },
        image: img('1461023058943-07fcbe16d735'),
        tags: ['new'],
      },
    ],
  },
];

async function seedMenu() {
  const tagRows = await prisma.tag.findMany();
  const tagBySlug = new Map(tagRows.map((t) => [t.slug, t.id]));

  let catOrder = 0;
  for (const cat of CATEGORIES) {
    const existing = await prisma.category.findUnique({ where: { slug: cat.slug } });
    if (existing) continue;

    let itemOrder = 0;
    await prisma.category.create({
      data: {
        slug: cat.slug,
        name: cat.name,
        nameEn: cat.nameEn,
        description: cat.description,
        imageUrl: cat.image,
        sortOrder: catOrder++,
        items: {
          create: cat.items.map((it) => {
            const flags = it.flags ?? {};
            const data: Prisma.MenuItemCreateWithoutCategoryInput = {
              slug: it.slug,
              name: it.name,
              nameEn: it.nameEn,
              description: it.description,
              ingredients: it.ingredients,
              price: it.price,
              discountPrice: it.discountPrice ?? null,
              calories: it.calories ?? null,
              allergens: it.allergens ?? null,
              spiceLevel: it.spiceLevel ?? 'NONE',
              isFeatured: flags.isFeatured ?? false,
              isBestSeller: flags.isBestSeller ?? false,
              isNew: flags.isNew ?? false,
              isVegetarian: flags.isVegetarian ?? false,
              isChefRecommendation: flags.isChefRecommendation ?? false,
              sortOrder: itemOrder++,
              images: { create: [{ url: it.image, alt: it.name, isPrimary: true, sortOrder: 0 }] },
              tags: {
                create: (it.tags ?? [])
                  .map((s) => tagBySlug.get(s))
                  .filter((id): id is string => Boolean(id))
                  .map((tagId) => ({ tagId })),
              },
            };
            return data;
          }),
        },
      },
    });
  }
  console.log('✔ menu (categories + items) seeded');
}

async function main() {
  console.log('🌱 Seeding Rawaqan database...');
  await seedAdmin();
  await seedSettings();
  await seedTags();
  await seedMenu();
  console.log('✅ Seed complete');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
