-- Import the complete Rawkaan catalog from the restaurant's published menu.
-- Source: https://res.nunps.com/rawkaan/catalog
-- Source API: https://api.nunps.com/api/menu/getData2/rawkaan
-- Snapshot imported on 2026-08-28: 22 categories, 171 products,
-- 71 product images, 13 modifier groups (6 size groups and 7 add-on groups).
--
-- Existing catalog rows are archived/deactivated rather than deleted so historical
-- order and invoice snapshots remain referentially safe.

UPDATE "menu_items"
SET "is_archived" = TRUE,
    "is_available" = FALSE,
    "updated_at" = CURRENT_TIMESTAMP
WHERE "id" NOT LIKE 'rawkaan-item-%';

UPDATE "categories"
SET "is_active" = FALSE,
    "updated_at" = CURRENT_TIMESTAMP
WHERE "id" NOT LIKE 'rawkaan-cat-%';

INSERT INTO "categories"
  ("id", "slug", "name", "name_en", "description", "image_url", "sort_order", "is_active", "created_at", "updated_at")
VALUES
  ('rawkaan-cat-392', 'rawkaan-category-392', 'الفطور', 'الفطور', NULL, NULL, 0, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-cat-393', 'rawkaan-category-393', 'منقايش', 'Mangaish', NULL, NULL, 1, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-cat-394', 'rawkaan-category-394', 'مقبلات', 'Meze', NULL, NULL, 2, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-cat-395', 'rawkaan-category-395', 'سلطات', 'SALADS', NULL, NULL, 3, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-cat-396', 'rawkaan-category-396', 'بيتزا', 'Pizzas', NULL, NULL, 4, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-cat-397', 'rawkaan-category-397', 'باستا', 'Basta!', NULL, NULL, 5, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-cat-398', 'rawkaan-category-398', 'ساندويشات', 'Sandwiches', NULL, NULL, 6, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-cat-400', 'rawkaan-category-400', 'وجبات رئيسية', 'Main Meals', NULL, NULL, 7, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-cat-401', 'rawkaan-category-401', 'مشاوى', 'Grills', NULL, NULL, 8, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-cat-402', 'rawkaan-category-402', 'اسماك', 'Fish', NULL, NULL, 9, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-cat-403', 'rawkaan-category-403', 'عصائر طبيعية', 'natural juices', NULL, NULL, 10, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-cat-404', 'rawkaan-category-404', 'عصائر', 'Juices', NULL, NULL, 11, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-cat-405', 'rawkaan-category-405', 'موهيتو', 'mojito', NULL, NULL, 12, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-cat-406', 'rawkaan-category-406', 'ميلك شيك', 'MILKSHAKE', NULL, NULL, 13, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-cat-407', 'rawkaan-category-407', 'ايسات', 'AISAT', NULL, NULL, 14, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-cat-408', 'rawkaan-category-408', 'مشروبات باردة', 'Cold Beverages', NULL, NULL, 15, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-cat-409', 'rawkaan-category-409', 'المشروبات الساخنة', 'Hot Drinks', NULL, NULL, 16, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-cat-410', 'rawkaan-category-410', 'كوكتيلات طبيعية', 'Natural Cocktails', NULL, NULL, 17, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-cat-411', 'rawkaan-category-411', 'بوظة', 'icecream, sundae', NULL, NULL, 18, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-cat-412', 'rawkaan-category-412', 'حلويات', 'dessert', NULL, NULL, 19, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-cat-413', 'rawkaan-category-413', 'اراجيل', 'Argyle', NULL, NULL, 20, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-cat-414', 'rawkaan-category-414', 'بيتزا نبوليتانا شوكلت(S)', 'Neapolitana Chocolate Pizza (S)', NULL, NULL, 21, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET
  "slug" = EXCLUDED."slug",
  "name" = EXCLUDED."name",
  "name_en" = EXCLUDED."name_en",
  "description" = EXCLUDED."description",
  "image_url" = EXCLUDED."image_url",
  "sort_order" = EXCLUDED."sort_order",
  "is_active" = TRUE,
  "updated_at" = CURRENT_TIMESTAMP;

INSERT INTO "menu_items"
  ("id", "category_id", "slug", "name", "name_en", "description", "description_en",
   "price", "is_available", "is_best_seller", "is_archived", "sort_order", "created_at", "updated_at")
VALUES
  ('rawkaan-item-2395', 'rawkaan-cat-392', 'rawkaan-item-2395', 'فطور فلسطينى لشخصين', 'palestinian breakfast for two', NULL, NULL, 45::numeric(10,2), TRUE, FALSE, FALSE, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-item-2396', 'rawkaan-cat-392', 'rawkaan-item-2396', 'حمص مع لحمة', 'Hummus with meat', NULL, NULL, 30::numeric(10,2), TRUE, FALSE, FALSE, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-item-2397', 'rawkaan-cat-392', 'rawkaan-item-2397', 'قلاية بندورة', 'Tomato Fryer', NULL, NULL, 15::numeric(10,2), TRUE, FALSE, FALSE, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-item-2398', 'rawkaan-cat-392', 'rawkaan-item-2398', 'قلاية شكشوكة', 'Shakshoka Fryer', NULL, NULL, 20::numeric(10,2), TRUE, FALSE, FALSE, 3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-item-2399', 'rawkaan-cat-392', 'rawkaan-item-2399', 'قلاية بندورة مع لحمة', 'Tomato Fryer with Meat', NULL, NULL, 35::numeric(10,2), TRUE, FALSE, FALSE, 4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-item-2400', 'rawkaan-cat-392', 'rawkaan-item-2400', 'بيض كما تحب', 'Eggs as you like', NULL, NULL, 12::numeric(10,2), TRUE, FALSE, FALSE, 5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-item-2401', 'rawkaan-cat-392', 'rawkaan-item-2401', 'جبنة بيضة مقلية', 'Fried Egg Cheese', NULL, NULL, 20::numeric(10,2), TRUE, FALSE, FALSE, 6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-item-2403', 'rawkaan-cat-393', 'rawkaan-item-2403', 'زعتر', 'Thyme', NULL, NULL, 10::numeric(10,2), TRUE, FALSE, FALSE, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-item-2404', 'rawkaan-cat-393', 'rawkaan-item-2404', 'صفيحة', 'PL', NULL, NULL, 25::numeric(10,2), TRUE, FALSE, FALSE, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-item-2405', 'rawkaan-cat-393', 'rawkaan-item-2405', 'جبنة بيضاء', 'White Cheese', NULL, NULL, 15::numeric(10,2), TRUE, FALSE, FALSE, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-item-2406', 'rawkaan-cat-393', 'rawkaan-item-2406', 'منقوشة بيض', 'egg manoushe', NULL, NULL, 15::numeric(10,2), TRUE, FALSE, FALSE, 3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-item-2407', 'rawkaan-cat-393', 'rawkaan-item-2407', 'منقوشة روقان', 'Roqan manoushe', 'بطاطا مسلوقة مهروسة مع
سماق وزيت زيتون وليمون يضاف عليها بندورة شيري
جرجير وجبنة البارميزان', 'Boiled mashed potatoes with
Sumac, olive oil and lemon with sherry tomatoes
Arugula and Parmesan Cheese', 28::numeric(10,2), TRUE, FALSE, FALSE, 4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-item-2408', 'rawkaan-cat-394', 'rawkaan-item-2408', 'شوربة فطر', 'Mushroom Soup', NULL, NULL, 20::numeric(10,2), TRUE, FALSE, FALSE, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-item-2409', 'rawkaan-cat-394', 'rawkaan-item-2409', 'شوربة خضار', 'Vegetables Soup', NULL, NULL, 15::numeric(10,2), TRUE, FALSE, FALSE, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-item-2410', 'rawkaan-cat-394', 'rawkaan-item-2410', 'اصابع موزريلا', 'mozzarella sticks', NULL, NULL, 25::numeric(10,2), TRUE, FALSE, FALSE, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-item-2411', 'rawkaan-cat-394', 'rawkaan-item-2411', 'اصابع كريسبى', 'crispy fingers', NULL, NULL, 30::numeric(10,2), TRUE, FALSE, FALSE, 3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-item-2412', 'rawkaan-cat-394', 'rawkaan-item-2412', 'بطاطا ودجز15 مع جبنة', 'Potato wedges 15 with cheese', NULL, NULL, 20::numeric(10,2), TRUE, FALSE, FALSE, 4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-item-2413', 'rawkaan-cat-394', 'rawkaan-item-2413', 'بطاطا مقلية 15 مع جبنة', 'French fries 15 with cheese', NULL, NULL, 20::numeric(10,2), TRUE, FALSE, FALSE, 5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-item-2414', 'rawkaan-cat-394', 'rawkaan-item-2414', 'بطاطا بالفرن مع فطر وكريماو الجبنة', 'Oven baked potatoes with mushrooms and cream cheese', NULL, NULL, 25::numeric(10,2), TRUE, FALSE, FALSE, 6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-item-2415', 'rawkaan-cat-394', 'rawkaan-item-2415', 'خبز بالثوم 10 مع جبنة', 'Garlic bread 10 with cheese', NULL, NULL, 15::numeric(10,2), TRUE, FALSE, FALSE, 7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-item-2416', 'rawkaan-cat-394', 'rawkaan-item-2416', 'اجنحة دجاج', 'Nor hot wings to dip in.', NULL, NULL, 25::numeric(10,2), TRUE, FALSE, FALSE, 8, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-item-2417', 'rawkaan-cat-394', 'rawkaan-item-2417', 'يلنجى روقان', 'stuffed mushrooms', NULL, NULL, 25::numeric(10,2), TRUE, FALSE, FALSE, 9, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-item-2418', 'rawkaan-cat-394', 'rawkaan-item-2418', 'سمبوسك', 'Samosa', NULL, NULL, 15::numeric(10,2), TRUE, FALSE, FALSE, 10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-item-2419', 'rawkaan-cat-394', 'rawkaan-item-2419', 'كبة 3 حبات', 'Kubba 3 pcs', NULL, NULL, 15::numeric(10,2), TRUE, FALSE, FALSE, 11, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-item-2421', 'rawkaan-cat-395', 'rawkaan-item-2421', 'حمص', 'HOMS', NULL, NULL, 12::numeric(10,2), TRUE, FALSE, FALSE, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-item-2422', 'rawkaan-cat-395', 'rawkaan-item-2422', 'تبولة', 'Tabbouleh', NULL, NULL, 15::numeric(10,2), TRUE, FALSE, FALSE, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-item-2423', 'rawkaan-cat-395', 'rawkaan-item-2423', 'جرجير', 'جرجير', NULL, NULL, 18::numeric(10,2), TRUE, FALSE, FALSE, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-item-2424', 'rawkaan-cat-395', 'rawkaan-item-2424', 'يونانية', 'Greek', NULL, NULL, 20::numeric(10,2), TRUE, FALSE, FALSE, 3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-item-2425', 'rawkaan-cat-395', 'rawkaan-item-2425', 'عربية', 'Arabic', NULL, NULL, 15::numeric(10,2), TRUE, FALSE, FALSE, 4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-item-2426', 'rawkaan-cat-395', 'rawkaan-item-2426', 'سيزر 15 مع دجاج', 'Caesar 15 with Chicken', NULL, NULL, 25::numeric(10,2), TRUE, FALSE, FALSE, 5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-item-2427', 'rawkaan-cat-395', 'rawkaan-item-2427', 'فلاحية', 'Farmers', NULL, NULL, 15::numeric(10,2), TRUE, FALSE, FALSE, 6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-item-2428', 'rawkaan-cat-395', 'rawkaan-item-2428', 'كينوا', 'Quinoa', NULL, NULL, 20::numeric(10,2), TRUE, FALSE, FALSE, 7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-item-2429', 'rawkaan-cat-395', 'rawkaan-item-2429', 'باذنجان الراهب', 'Raheb Eggplant', NULL, NULL, 25::numeric(10,2), TRUE, FALSE, FALSE, 8, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-item-2430', 'rawkaan-cat-395', 'rawkaan-item-2430', 'فتوش 20 مع جبنة', 'Fattoush 20 with cheese', NULL, NULL, 25::numeric(10,2), TRUE, FALSE, FALSE, 9, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-item-2431', 'rawkaan-cat-395', 'rawkaan-item-2431', 'حلومى', 'Halloumi', NULL, NULL, 25::numeric(10,2), TRUE, FALSE, FALSE, 10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-item-2432', 'rawkaan-cat-395', 'rawkaan-item-2432', 'سلطة روقان', 'Rougan Salad', 'خس - جرجير- ريحان-بصل- شيرى- فطر- باذنجان مقلى -خبز محمص-جبنة بارميزان', 'Lettuce - Rocket - Basil - Onion - Cherry - Mushroom - Fried Eggplant - Toasted Bread - Parmesan Cheese', 25::numeric(10,2), TRUE, FALSE, FALSE, 11, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-item-2433', 'rawkaan-cat-396', 'rawkaan-item-2433', 'مرجريتا', 'Mur Greta', NULL, NULL, 28::numeric(10,2), TRUE, TRUE, FALSE, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-item-2434', 'rawkaan-cat-396', 'rawkaan-item-2434', 'الفريدو', 'Alfredo.', NULL, NULL, 35::numeric(10,2), TRUE, TRUE, FALSE, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-item-2435', 'rawkaan-cat-396', 'rawkaan-item-2435', 'باربكيو', 'Barbecue.', NULL, NULL, 35::numeric(10,2), TRUE, FALSE, FALSE, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-item-2436', 'rawkaan-cat-396', 'rawkaan-item-2436', 'بيرونى', 'Peroni', NULL, NULL, 32::numeric(10,2), TRUE, FALSE, FALSE, 3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-item-2437', 'rawkaan-cat-396', 'rawkaan-item-2437', 'خضار', 'vegetable', NULL, NULL, 30::numeric(10,2), TRUE, FALSE, FALSE, 4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-item-2438', 'rawkaan-cat-396', 'rawkaan-item-2438', 'بيتزا روقان', 'Rougan Pizza', 'دجاج بصوص  الديناميت مع هالبينو وببرونى', 'Chicken in  dynamite sauce with jalapeno and pepperoni', 35::numeric(10,2), TRUE, FALSE, FALSE, 5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-item-2439', 'rawkaan-cat-397', 'rawkaan-item-2439', 'فوتتيشينى الفريدو', 'fettuccine alfredo', NULL, NULL, 32::numeric(10,2), TRUE, FALSE, FALSE, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-item-2440', 'rawkaan-cat-397', 'rawkaan-item-2440', 'بينى روزا', 'Penne Rosa', NULL, NULL, 30::numeric(10,2), TRUE, FALSE, FALSE, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-item-2441', 'rawkaan-cat-397', 'rawkaan-item-2441', 'بينا ببياتا', 'Pepini Arrabiatta', NULL, NULL, 30::numeric(10,2), TRUE, FALSE, FALSE, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-item-2442', 'rawkaan-cat-397', 'rawkaan-item-2442', 'بينى بيستو', 'Penne Pesto', NULL, NULL, 30::numeric(10,2), TRUE, FALSE, FALSE, 3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-item-2443', 'rawkaan-cat-397', 'rawkaan-item-2443', 'بينى الفريدو 30 مع دجاج', 'Penne Alfredo 30 with Chicken', NULL, NULL, 35::numeric(10,2), TRUE, FALSE, FALSE, 4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-item-2444', 'rawkaan-cat-397', 'rawkaan-item-2444', 'نودلز اسيوى', 'asian noodles', NULL, NULL, 40::numeric(10,2), TRUE, FALSE, FALSE, 5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-item-2445', 'rawkaan-cat-398', 'rawkaan-item-2445', 'برغر كلاسيك150 غم', 'Classic Burger 150g', NULL, NULL, 30::numeric(10,2), TRUE, TRUE, FALSE, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-item-2446', 'rawkaan-cat-398', 'rawkaan-item-2446', 'تشيز برغر', 'Cheese Burger', NULL, NULL, 35::numeric(10,2), TRUE, FALSE, FALSE, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-item-2447', 'rawkaan-cat-398', 'rawkaan-item-2447', 'برغر ماشروم', 'burger mushroom', NULL, NULL, 35::numeric(10,2), TRUE, FALSE, FALSE, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-item-2448', 'rawkaan-cat-398', 'rawkaan-item-2448', 'فاهيتا', 'fajita', NULL, NULL, 25::numeric(10,2), TRUE, FALSE, FALSE, 3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-item-2449', 'rawkaan-cat-398', 'rawkaan-item-2449', 'كريسبى', 'Crispy', NULL, NULL, 25::numeric(10,2), TRUE, FALSE, FALSE, 4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-item-2450', 'rawkaan-cat-398', 'rawkaan-item-2450', 'الفريدو', 'Alfredo.', NULL, NULL, 25::numeric(10,2), TRUE, FALSE, FALSE, 5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-item-2451', 'rawkaan-cat-398', 'rawkaan-item-2451', 'فيلية عجل', 'Veal Fillet', NULL, NULL, 35::numeric(10,2), TRUE, FALSE, FALSE, 6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-item-2452', 'rawkaan-cat-398', 'rawkaan-item-2452', 'روقان', 'Roqan', 'خس - بندورة - مخلل- موزريلا شيدر.سالمى.مدخن بصل مكرمل - فطر - باربكيو', 'Lettuce - Tomato - Pickle - Mozzarella Cheddar. Salami. Smoked Caramelized Onion - Mushroom - BBQ', 40::numeric(10,2), TRUE, FALSE, FALSE, 7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-item-2453', 'rawkaan-cat-400', 'rawkaan-item-2453', 'ستيك انتريكوت', 'Inter Lycotte Steak', NULL, NULL, 85::numeric(10,2), TRUE, FALSE, FALSE, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-item-2454', 'rawkaan-cat-400', 'rawkaan-item-2454', 'ستيك عجل محشى', 'stuffed veal steak', NULL, NULL, 85::numeric(10,2), TRUE, FALSE, FALSE, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-item-2455', 'rawkaan-cat-400', 'rawkaan-item-2455', 'دجاج هندى بالزبدة', 'Butter Indian Chicken', NULL, NULL, 42::numeric(10,2), TRUE, FALSE, FALSE, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-item-2456', 'rawkaan-cat-400', 'rawkaan-item-2456', 'ستيك صدر دجاج', 'Chicken breast steak', NULL, NULL, 40::numeric(10,2), TRUE, FALSE, FALSE, 3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-item-2457', 'rawkaan-cat-400', 'rawkaan-item-2457', 'تشيكن بوبييت', 'chicken poppiet', NULL, NULL, 45::numeric(10,2), TRUE, FALSE, FALSE, 4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-item-2458', 'rawkaan-cat-400', 'rawkaan-item-2458', 'ستراجنوف عجل', 'Straganov calf', NULL, NULL, 50::numeric(10,2), TRUE, FALSE, FALSE, 5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-item-2459', 'rawkaan-cat-400', 'rawkaan-item-2459', 'ستراجنوف دجاج', NULL, NULL, NULL, 42::numeric(10,2), TRUE, FALSE, FALSE, 6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-item-2460', 'rawkaan-cat-400', 'rawkaan-item-2460', 'فخارة خروف', 'lamb pottery', NULL, NULL, 65::numeric(10,2), TRUE, FALSE, FALSE, 7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-item-2461', 'rawkaan-cat-400', 'rawkaan-item-2461', 'فخارة دجاج', 'chicken fukhara', NULL, NULL, 45::numeric(10,2), TRUE, FALSE, FALSE, 8, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-item-2462', 'rawkaan-cat-400', 'rawkaan-item-2462', 'فخارة خضار', 'Vegetable pottery', NULL, NULL, 30::numeric(10,2), TRUE, FALSE, FALSE, 9, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-item-2463', 'rawkaan-cat-400', 'rawkaan-item-2463', 'منسف خروف', 'Mansaf  Kharaf', NULL, NULL, 60::numeric(10,2), TRUE, FALSE, FALSE, 10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-item-2464', 'rawkaan-cat-400', 'rawkaan-item-2464', 'فيليه عجل', 'Beef fillet', NULL, NULL, 80::numeric(10,2), TRUE, FALSE, FALSE, 11, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-item-2465', 'rawkaan-cat-401', 'rawkaan-item-2465', 'كباب', 'shish kebab', NULL, NULL, 49::numeric(10,2), TRUE, FALSE, FALSE, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-item-2466', 'rawkaan-cat-401', 'rawkaan-item-2466', 'شيش طاووق', 'Shish Taouk', NULL, NULL, 45::numeric(10,2), TRUE, FALSE, FALSE, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-item-2467', 'rawkaan-cat-401', 'rawkaan-item-2467', 'برجيت', 'Bridget!', NULL, NULL, 45::numeric(10,2), TRUE, FALSE, FALSE, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-item-2468', 'rawkaan-cat-401', 'rawkaan-item-2468', 'شقف خاروف', 'Shekaf Kharouf', NULL, NULL, 65::numeric(10,2), TRUE, FALSE, FALSE, 3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-item-2469', 'rawkaan-cat-401', 'rawkaan-item-2469', 'نصف دجاجة', 'Half chicken', NULL, NULL, 45::numeric(10,2), TRUE, FALSE, FALSE, 4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-item-2470', 'rawkaan-cat-401', 'rawkaan-item-2470', 'مشكلة (2 لحمة 1شيش 1كباب)', 'Mixed (2 meat 1shish 1kebab', NULL, NULL, 65::numeric(10,2), TRUE, FALSE, FALSE, 5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-item-2471', 'rawkaan-cat-402', 'rawkaan-item-2471', 'دينيس مقلى او مشوى', 'Fried or grilled Denise', NULL, NULL, 65::numeric(10,2), TRUE, FALSE, FALSE, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-item-2472', 'rawkaan-cat-402', 'rawkaan-item-2472', 'سالمون ستيك', 'Salmon Steak', NULL, NULL, 75::numeric(10,2), TRUE, FALSE, FALSE, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-item-2473', 'rawkaan-cat-402', 'rawkaan-item-2473', 'جمبرى مقلى', 'Fried Shrimp', NULL, NULL, 65::numeric(10,2), TRUE, FALSE, FALSE, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-item-2474', 'rawkaan-cat-402', 'rawkaan-item-2474', 'جمبرى ثوم او ليمون', 'Garlic or lemon shrimp', NULL, NULL, 65::numeric(10,2), TRUE, FALSE, FALSE, 3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-item-2475', 'rawkaan-cat-402', 'rawkaan-item-2475', 'فخارة جمبرى حارة', 'spicy shrimp pottery', NULL, NULL, 65::numeric(10,2), TRUE, FALSE, FALSE, 4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-item-2476', 'rawkaan-cat-403', 'rawkaan-item-2476', 'برتقال', 'Orange', NULL, NULL, 0::numeric(10,2), TRUE, FALSE, FALSE, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-item-2477', 'rawkaan-cat-403', 'rawkaan-item-2477', 'جزر', 'Carrots', NULL, NULL, 0::numeric(10,2), TRUE, FALSE, FALSE, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-item-2478', 'rawkaan-cat-403', 'rawkaan-item-2478', 'برتقال وجزر', 'Orange & Carrot', NULL, NULL, 0::numeric(10,2), TRUE, FALSE, FALSE, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-item-2479', 'rawkaan-cat-403', 'rawkaan-item-2479', 'ليمون فرش', 'Lemon brush', NULL, NULL, 0::numeric(10,2), TRUE, FALSE, FALSE, 3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-item-2480', 'rawkaan-cat-403', 'rawkaan-item-2480', 'ليمون ونعنع فريش', 'Fresh Lemon & Mint', NULL, NULL, 0::numeric(10,2), TRUE, FALSE, FALSE, 4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-item-2481', 'rawkaan-cat-403', 'rawkaan-item-2481', 'تفاح اخضر', 'Green Apples', NULL, NULL, 0::numeric(10,2), TRUE, FALSE, FALSE, 5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-item-2482', 'rawkaan-cat-404', 'rawkaan-item-2482', 'بينك ليمونادا', 'pink lemonade', NULL, NULL, 15::numeric(10,2), TRUE, FALSE, FALSE, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-item-2483', 'rawkaan-cat-404', 'rawkaan-item-2483', 'بيرى بومب', 'berry bomb', NULL, NULL, 16::numeric(10,2), TRUE, FALSE, FALSE, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-item-2484', 'rawkaan-cat-404', 'rawkaan-item-2484', 'جميكا', 'Jemica', NULL, NULL, 17::numeric(10,2), TRUE, FALSE, FALSE, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-item-2485', 'rawkaan-cat-404', 'rawkaan-item-2485', 'ريلكس', 'Relix', NULL, NULL, 13::numeric(10,2), TRUE, FALSE, FALSE, 3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-item-2486', 'rawkaan-cat-404', 'rawkaan-item-2486', 'مانجا وببلز', 'Manga and bubbles', NULL, NULL, 16::numeric(10,2), TRUE, FALSE, FALSE, 4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-item-2487', 'rawkaan-cat-404', 'rawkaan-item-2487', 'فروالة وببلز', 'Strawberry & Bubbles', NULL, NULL, 16::numeric(10,2), TRUE, FALSE, FALSE, 5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-item-2488', 'rawkaan-cat-404', 'rawkaan-item-2488', 'اناناس وببلز', 'Pineapple & Bubbles', NULL, NULL, 16::numeric(10,2), TRUE, FALSE, FALSE, 6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-item-2489', 'rawkaan-cat-405', 'rawkaan-item-2489', 'روقان', 'Roqan', NULL, NULL, 18::numeric(10,2), TRUE, FALSE, FALSE, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-item-2490', 'rawkaan-cat-405', 'rawkaan-item-2490', 'بطيخ', 'watermelon', NULL, NULL, 15::numeric(10,2), TRUE, FALSE, FALSE, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-item-2491', 'rawkaan-cat-405', 'rawkaan-item-2491', 'مكس بيرى', 'mix berry', NULL, NULL, 15::numeric(10,2), TRUE, FALSE, FALSE, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-item-2492', 'rawkaan-cat-405', 'rawkaan-item-2492', 'توت وببلز', 'berries and bubbles', NULL, NULL, 16::numeric(10,2), TRUE, FALSE, FALSE, 3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-item-2493', 'rawkaan-cat-405', 'rawkaan-item-2493', 'اناناس وببلز', 'Pineapple & Bubbles', NULL, NULL, 16::numeric(10,2), TRUE, FALSE, FALSE, 4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-item-2494', 'rawkaan-cat-405', 'rawkaan-item-2494', 'بلوبرى', 'blueberry', NULL, NULL, 14::numeric(10,2), TRUE, FALSE, FALSE, 5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-item-2495', 'rawkaan-cat-405', 'rawkaan-item-2495', 'بلاك جولد', 'Black Gold', NULL, NULL, 15::numeric(10,2), TRUE, FALSE, FALSE, 6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-item-2496', 'rawkaan-cat-405', 'rawkaan-item-2496', 'تروبيكانا', 'Tropicana', NULL, NULL, 15::numeric(10,2), TRUE, FALSE, FALSE, 7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-item-2497', 'rawkaan-cat-405', 'rawkaan-item-2497', 'بسفلورا وكركديه', 'Psiflora and Hibiscus', NULL, NULL, 16::numeric(10,2), TRUE, FALSE, FALSE, 8, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-item-2498', 'rawkaan-cat-405', 'rawkaan-item-2498', 'بلو كورساو', 'Blue Corsao', NULL, NULL, 16::numeric(10,2), TRUE, FALSE, FALSE, 9, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-item-2499', 'rawkaan-cat-405', 'rawkaan-item-2499', 'علكة', 'Nic gum.', NULL, NULL, 15::numeric(10,2), TRUE, FALSE, FALSE, 10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-item-2500', 'rawkaan-cat-405', 'rawkaan-item-2500', 'مارجريتا', 'Margaritas !', NULL, NULL, 15::numeric(10,2), TRUE, FALSE, FALSE, 11, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-item-2501', 'rawkaan-cat-405', 'rawkaan-item-2501', 'بينا كولادا', 'Pina colada', NULL, NULL, 15::numeric(10,2), TRUE, FALSE, FALSE, 12, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-item-2502', 'rawkaan-cat-406', 'rawkaan-item-2502', 'روقان ميلك شيك', 'Roqan Milkshake', NULL, NULL, 20::numeric(10,2), TRUE, FALSE, FALSE, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-item-2503', 'rawkaan-cat-406', 'rawkaan-item-2503', 'فانيلا', 'undershirt', NULL, NULL, 16::numeric(10,2), TRUE, FALSE, FALSE, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-item-2504', 'rawkaan-cat-406', 'rawkaan-item-2504', 'شوكو', 'Shouko.', NULL, NULL, 16::numeric(10,2), TRUE, FALSE, FALSE, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-item-2505', 'rawkaan-cat-406', 'rawkaan-item-2505', 'اوريو', 'Oreo', NULL, NULL, 18::numeric(10,2), TRUE, FALSE, FALSE, 3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-item-2506', 'rawkaan-cat-406', 'rawkaan-item-2506', 'توت', 'Berries', NULL, NULL, 16::numeric(10,2), TRUE, FALSE, FALSE, 4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-item-2507', 'rawkaan-cat-406', 'rawkaan-item-2507', 'بمبا', 'Bemba', NULL, NULL, 18::numeric(10,2), TRUE, FALSE, FALSE, 5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-item-2508', 'rawkaan-cat-406', 'rawkaan-item-2508', 'كونيتو سنيكرز', 'Conito Snickers', NULL, NULL, 18::numeric(10,2), TRUE, FALSE, FALSE, 6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-item-2509', 'rawkaan-cat-406', 'rawkaan-item-2509', 'حلاوة توت فانيلا', 'Vanilla Berry Halawa', NULL, NULL, 18::numeric(10,2), TRUE, FALSE, FALSE, 7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-item-2510', 'rawkaan-cat-406', 'rawkaan-item-2510', 'لوتس', 'lotus', NULL, NULL, 18::numeric(10,2), TRUE, FALSE, FALSE, 8, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-item-2511', 'rawkaan-cat-406', 'rawkaan-item-2511', 'ابوظبى', 'Abu Dhabi', NULL, NULL, 17::numeric(10,2), TRUE, FALSE, FALSE, 9, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-item-2512', 'rawkaan-cat-406', 'rawkaan-item-2512', 'كرز', 'CHERRY', NULL, NULL, 18::numeric(10,2), TRUE, FALSE, FALSE, 10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-item-2513', 'rawkaan-cat-407', 'rawkaan-item-2513', 'ايس كوفى', 'Ice Coffee', NULL, NULL, 16::numeric(10,2), TRUE, FALSE, FALSE, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-item-2514', 'rawkaan-cat-407', 'rawkaan-item-2514', 'ماتشا ستروبرى', 'Matcha Strawberry', NULL, NULL, 17::numeric(10,2), TRUE, FALSE, FALSE, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-item-2515', 'rawkaan-cat-407', 'rawkaan-item-2515', 'كندر بوينر', 'Kinder Boehner', NULL, NULL, 17::numeric(10,2), TRUE, FALSE, FALSE, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-item-2516', 'rawkaan-cat-407', 'rawkaan-item-2516', 'سبانش لاتيه', 'Hot Spanish Latte,', NULL, NULL, 15::numeric(10,2), TRUE, FALSE, FALSE, 3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-item-2517', 'rawkaan-cat-408', 'rawkaan-item-2517', 'عصير عنب', 'Grape Juice', NULL, NULL, 5::numeric(10,2), TRUE, FALSE, FALSE, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-item-2518', 'rawkaan-cat-408', 'rawkaan-item-2518', 'سبرايت صغير', 'Mini Sprite', NULL, NULL, 5::numeric(10,2), TRUE, FALSE, FALSE, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-item-2519', 'rawkaan-cat-408', 'rawkaan-item-2519', 'كولا صغير', 'Small Coke', NULL, NULL, 5::numeric(10,2), TRUE, FALSE, FALSE, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-item-2520', 'rawkaan-cat-408', 'rawkaan-item-2520', 'كولا كبير', 'cola large', NULL, NULL, 7::numeric(10,2), TRUE, FALSE, FALSE, 3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-item-2521', 'rawkaan-cat-408', 'rawkaan-item-2521', 'كولا زيرو صغير', 'cola zero small', NULL, NULL, 5::numeric(10,2), TRUE, FALSE, FALSE, 4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-item-2522', 'rawkaan-cat-408', 'rawkaan-item-2522', 'مى صغير', 'Mai Saghir', NULL, NULL, 3::numeric(10,2), TRUE, FALSE, FALSE, 5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-item-2523', 'rawkaan-cat-408', 'rawkaan-item-2523', 'مى كبير', 'Mei Kabir', NULL, NULL, 5::numeric(10,2), TRUE, FALSE, FALSE, 6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-item-2524', 'rawkaan-cat-409', 'rawkaan-item-2524', 'زهورات روقان مع زنجبيل وعسل', 'Roquin flowers with ginger and honey', NULL, NULL, 13::numeric(10,2), TRUE, FALSE, FALSE, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-item-2525', 'rawkaan-cat-409', 'rawkaan-item-2525', 'شاى', 'Tea', NULL, NULL, 7::numeric(10,2), TRUE, FALSE, FALSE, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-item-2526', 'rawkaan-cat-409', 'rawkaan-item-2526', 'شاى اخضر', 'Green Tea', NULL, NULL, 7::numeric(10,2), TRUE, FALSE, FALSE, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-item-2527', 'rawkaan-cat-409', 'rawkaan-item-2527', 'نسكافيه حليب', 'Nescafe Milk', NULL, NULL, 10::numeric(10,2), TRUE, FALSE, FALSE, 3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-item-2528', 'rawkaan-cat-409', 'rawkaan-item-2528', 'قهوة اسبريسو صغيرة 7 دبل', 'Espresso coffee small 7 double', NULL, NULL, 9::numeric(10,2), TRUE, FALSE, FALSE, 4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-item-2529', 'rawkaan-cat-409', 'rawkaan-item-2529', 'قهوة عربية صغير 6 دبل', 'arabic coffee small 6 double', NULL, NULL, 8::numeric(10,2), TRUE, FALSE, FALSE, 5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-item-2530', 'rawkaan-cat-409', 'rawkaan-item-2530', 'كابيتشنو اسبريسو حليب', 'Cappuccino Espresso Milk', NULL, NULL, 12::numeric(10,2), TRUE, FALSE, FALSE, 6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-item-2531', 'rawkaan-cat-409', 'rawkaan-item-2531', 'ايطالينو شوكلت بالمارشيملو', 'italino marshmallow chocolate', NULL, NULL, 15::numeric(10,2), TRUE, FALSE, FALSE, 7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-item-2532', 'rawkaan-cat-409', 'rawkaan-item-2532', 'كارميل التوفى مع كريمة', 'Carmel toffee with cream', NULL, NULL, 15::numeric(10,2), TRUE, FALSE, FALSE, 8, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-item-2533', 'rawkaan-cat-409', 'rawkaan-item-2533', 'سحلب اسطنبولى بالمكسرات', 'Istanbul Orchid with Nuts', NULL, NULL, 14::numeric(10,2), TRUE, FALSE, FALSE, 9, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-item-2534', 'rawkaan-cat-409', 'rawkaan-item-2534', 'كرانشى شوكو كلاسيك', 'crunchy choco classic', NULL, NULL, 14::numeric(10,2), TRUE, FALSE, FALSE, 10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-item-2535', 'rawkaan-cat-409', 'rawkaan-item-2535', 'جوز الهند لاتيه', 'Coconut Latte', NULL, NULL, 14::numeric(10,2), TRUE, FALSE, FALSE, 11, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-item-2536', 'rawkaan-cat-409', 'rawkaan-item-2536', 'تشاى لاتيه', 'Chai Latte', NULL, NULL, 13::numeric(10,2), TRUE, FALSE, FALSE, 12, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-item-2537', 'rawkaan-cat-409', 'rawkaan-item-2537', 'فرينش فانيلا', 'French Vanilla', NULL, NULL, 13::numeric(10,2), TRUE, FALSE, FALSE, 13, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-item-2539', 'rawkaan-cat-409', 'rawkaan-item-2539', 'اسبنيول لاتيه', 'Espniol Latte', NULL, NULL, 13::numeric(10,2), TRUE, FALSE, FALSE, 14, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-item-2543', 'rawkaan-cat-410', 'rawkaan-item-2543', 'روقان كوكتيل', 'Roqan Cocktail', NULL, NULL, 23::numeric(10,2), TRUE, FALSE, FALSE, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-item-2545', 'rawkaan-cat-410', 'rawkaan-item-2545', 'فخفينا', 'Fakhfina', NULL, NULL, 20::numeric(10,2), TRUE, FALSE, FALSE, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-item-2546', 'rawkaan-cat-410', 'rawkaan-item-2546', 'افوكادو بالقشطة والعسل', 'Avocado with cream and honey', NULL, NULL, 22::numeric(10,2), TRUE, FALSE, FALSE, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-item-2547', 'rawkaan-cat-411', 'rawkaan-item-2547', 'بوظة مشكل سادة', 'Plain Mixed Ice Cream', NULL, NULL, 15::numeric(10,2), TRUE, FALSE, FALSE, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-item-2548', 'rawkaan-cat-411', 'rawkaan-item-2548', 'بوظة مشكل حوامض', 'Mixed citrus ice cream', NULL, NULL, 15::numeric(10,2), TRUE, FALSE, FALSE, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-item-2549', 'rawkaan-cat-411', 'rawkaan-item-2549', 'بوظة مشكل فاخر', 'Deluxe Mixed Ice Cream', NULL, NULL, 18::numeric(10,2), TRUE, FALSE, FALSE, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-item-2551', 'rawkaan-cat-414', 'rawkaan-item-2551', 'بيتزا نوتيلا', 'Nutella Pizza', NULL, NULL, 18::numeric(10,2), TRUE, FALSE, FALSE, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-item-2552', 'rawkaan-cat-414', 'rawkaan-item-2552', 'بيتزا بصوص الشوكولاتة البيضاء', 'Pizza with white chocolate sauce', NULL, NULL, 18::numeric(10,2), TRUE, FALSE, FALSE, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-item-2553', 'rawkaan-cat-414', 'rawkaan-item-2553', 'مكس شوكولاتة ابيض بنى', 'Mix Chocolate White Brown', NULL, NULL, 18::numeric(10,2), TRUE, FALSE, FALSE, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-item-2554', 'rawkaan-cat-414', 'rawkaan-item-2554', 'بيتزا لوتس مع بسكوت', 'Lotus Pizza with Cookies', NULL, NULL, 20::numeric(10,2), TRUE, FALSE, FALSE, 3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-item-2555', 'rawkaan-cat-414', 'rawkaan-item-2555', 'بيتزا اوريو مع بسكوت', 'oreo pizza with biscuits', NULL, NULL, 20::numeric(10,2), TRUE, FALSE, FALSE, 4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-item-2556', 'rawkaan-cat-414', 'rawkaan-item-2556', 'بيتزا الفصول الاربعة', 'Four Seasons Pizza', NULL, NULL, 25::numeric(10,2), TRUE, FALSE, FALSE, 5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-item-2557', 'rawkaan-cat-414', 'rawkaan-item-2557', 'بيتزا ابو ظبى', 'Abu Dhabi Pizza', NULL, NULL, 22::numeric(10,2), TRUE, FALSE, FALSE, 6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-item-2558', 'rawkaan-cat-414', 'rawkaan-item-2558', 'بيتزا دبى', 'Dubai Pizza', NULL, NULL, 25::numeric(10,2), TRUE, FALSE, FALSE, 7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-item-2560', 'rawkaan-cat-412', 'rawkaan-item-2560', 'تريليتشى', 'Trelliche', NULL, NULL, 20::numeric(10,2), TRUE, FALSE, FALSE, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-item-2562', 'rawkaan-cat-412', 'rawkaan-item-2562', 'قشطوطة', 'Keshtouta', NULL, NULL, 20::numeric(10,2), TRUE, FALSE, FALSE, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-item-2564', 'rawkaan-cat-412', 'rawkaan-item-2564', 'سلك شوكلت', 'Chocolate Silk', NULL, NULL, 22::numeric(10,2), TRUE, FALSE, FALSE, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-item-2565', 'rawkaan-cat-412', 'rawkaan-item-2565', 'ليالى بيروت', 'Beirut Nights', NULL, NULL, 15::numeric(10,2), TRUE, FALSE, FALSE, 3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-item-2567', 'rawkaan-cat-412', 'rawkaan-item-2567', 'تشيز كيك', 'Cheese cake', NULL, NULL, 22::numeric(10,2), TRUE, FALSE, FALSE, 4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-item-2568', 'rawkaan-cat-413', 'rawkaan-item-2568', 'نخلة', 'palm', NULL, NULL, 25::numeric(10,2), TRUE, FALSE, FALSE, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-item-2570', 'rawkaan-cat-413', 'rawkaan-item-2570', 'تفاحتين', '2 apples', NULL, NULL, 20::numeric(10,2), TRUE, FALSE, FALSE, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-item-2572', 'rawkaan-cat-413', 'rawkaan-item-2572', 'LOVE66', 'LOVE66', NULL, NULL, 20::numeric(10,2), TRUE, FALSE, FALSE, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-item-2573', 'rawkaan-cat-413', 'rawkaan-item-2573', 'خلطة شامية', 'khalta shamiyya', NULL, NULL, 20::numeric(10,2), TRUE, FALSE, FALSE, 3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-item-2574', 'rawkaan-cat-413', 'rawkaan-item-2574', 'بلوبيرى', 'blueberry', NULL, NULL, 20::numeric(10,2), TRUE, FALSE, FALSE, 4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-item-2575', 'rawkaan-cat-413', 'rawkaan-item-2575', 'ليمون ونعنع', 'Lemon & Mint', NULL, NULL, 20::numeric(10,2), TRUE, FALSE, FALSE, 5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-item-2576', 'rawkaan-cat-413', 'rawkaan-item-2576', 'بطيخ ونعنع', 'Watermelon and mint', NULL, NULL, 20::numeric(10,2), TRUE, FALSE, FALSE, 6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-item-2577', 'rawkaan-cat-413', 'rawkaan-item-2577', 'كيف', ' How', NULL, NULL, 20::numeric(10,2), TRUE, FALSE, FALSE, 7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-item-3882', 'rawkaan-cat-412', 'rawkaan-item-3882', 'مينى بان كيك', 'mini pancake', NULL, NULL, 18::numeric(10,2), TRUE, FALSE, FALSE, 5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rawkaan-item-3883', 'rawkaan-cat-412', 'rawkaan-item-3883', 'سوفيله', 'Souffelle', NULL, NULL, 22::numeric(10,2), TRUE, FALSE, FALSE, 6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET
  "category_id" = EXCLUDED."category_id",
  "slug" = EXCLUDED."slug",
  "name" = EXCLUDED."name",
  "name_en" = EXCLUDED."name_en",
  "description" = EXCLUDED."description",
  "description_en" = EXCLUDED."description_en",
  "price" = EXCLUDED."price",
  "is_available" = TRUE,
  "is_best_seller" = EXCLUDED."is_best_seller",
  "is_archived" = FALSE,
  "sort_order" = EXCLUDED."sort_order",
  "updated_at" = CURRENT_TIMESTAMP;

INSERT INTO "item_images"
  ("id", "item_id", "url", "alt", "sort_order", "is_primary", "created_at")
VALUES
  ('rawkaan-image-2395', 'rawkaan-item-2395', 'https://res.nunps.com/api/image?path=product%2Fimages%2FGKZbvMjGESOV_2026-04-17.png', 'فطور فلسطينى لشخصين', 0, TRUE, CURRENT_TIMESTAMP),
  ('rawkaan-image-2398', 'rawkaan-item-2398', 'https://res.nunps.com/api/image?path=product%2Fimages%2FNYAy24VUrcAt_2026-05-19.png', 'قلاية شكشوكة', 0, TRUE, CURRENT_TIMESTAMP),
  ('rawkaan-image-2400', 'rawkaan-item-2400', 'https://res.nunps.com/api/image?path=product%2Fimages%2FAQOPN2C8McF3_2026-04-17.png', 'بيض كما تحب', 0, TRUE, CURRENT_TIMESTAMP),
  ('rawkaan-image-2401', 'rawkaan-item-2401', 'https://res.nunps.com/api/image?path=product%2Fimages%2FViYkAbgPnSJv_2026-04-17.png', 'جبنة بيضة مقلية', 0, TRUE, CURRENT_TIMESTAMP),
  ('rawkaan-image-2403', 'rawkaan-item-2403', 'https://res.nunps.com/api/image?path=product%2Fimages%2FtRHqSzLKSJQW_2026-05-14.png', 'زعتر', 0, TRUE, CURRENT_TIMESTAMP),
  ('rawkaan-image-2404', 'rawkaan-item-2404', 'https://res.nunps.com/api/image?path=product%2Fimages%2F403ALy73Thdf_2026-05-14.png', 'صفيحة', 0, TRUE, CURRENT_TIMESTAMP),
  ('rawkaan-image-2407', 'rawkaan-item-2407', 'https://res.nunps.com/api/image?path=product%2Fimages%2FgWB4O8Bvmuv2_2026-05-14.png', 'منقوشة روقان', 0, TRUE, CURRENT_TIMESTAMP),
  ('rawkaan-image-2414', 'rawkaan-item-2414', 'https://res.nunps.com/api/image?path=product%2Fimages%2FbQ09kg8J2iN7_2026-05-14.png', 'بطاطا بالفرن مع فطر وكريماو الجبنة', 0, TRUE, CURRENT_TIMESTAMP),
  ('rawkaan-image-2416', 'rawkaan-item-2416', 'https://res.nunps.com/api/image?path=product%2Fimages%2FXPGfDigOoS3m_2026-04-17.png', 'اجنحة دجاج', 0, TRUE, CURRENT_TIMESTAMP),
  ('rawkaan-image-2417', 'rawkaan-item-2417', 'https://res.nunps.com/api/image?path=product%2Fimages%2Fdn426lX0sGVn_2026-05-14.png', 'يلنجى روقان', 0, TRUE, CURRENT_TIMESTAMP),
  ('rawkaan-image-2419', 'rawkaan-item-2419', 'https://res.nunps.com/api/image?path=product%2Fimages%2Fx0Lf1ojALMNc_2026-05-14.png', 'كبة 3 حبات', 0, TRUE, CURRENT_TIMESTAMP),
  ('rawkaan-image-2422', 'rawkaan-item-2422', 'https://res.nunps.com/api/image?path=product%2Fimages%2FGRUbnnQZiKYY_2026-05-14.png', 'تبولة', 0, TRUE, CURRENT_TIMESTAMP),
  ('rawkaan-image-2424', 'rawkaan-item-2424', 'https://res.nunps.com/api/image?path=product%2Fimages%2FyEmHdTFnoWxk_2026-04-17.png', 'يونانية', 0, TRUE, CURRENT_TIMESTAMP),
  ('rawkaan-image-2426', 'rawkaan-item-2426', 'https://res.nunps.com/api/image?path=product%2Fimages%2FOekrXZq9EgGS_2026-05-14.png', 'سيزر 15 مع دجاج', 0, TRUE, CURRENT_TIMESTAMP),
  ('rawkaan-image-2428', 'rawkaan-item-2428', 'https://res.nunps.com/api/image?path=product%2Fimages%2FXFiVyEnx3M7y_2026-05-14.png', 'كينوا', 0, TRUE, CURRENT_TIMESTAMP),
  ('rawkaan-image-2430', 'rawkaan-item-2430', 'https://res.nunps.com/api/image?path=product%2Fimages%2FNyPoTaGu74lq_2026-05-14.png', 'فتوش 20 مع جبنة', 0, TRUE, CURRENT_TIMESTAMP),
  ('rawkaan-image-2432', 'rawkaan-item-2432', 'https://res.nunps.com/api/image?path=product%2Fimages%2FUgPnVrg3xvLr_2026-05-14.png', 'سلطة روقان', 0, TRUE, CURRENT_TIMESTAMP),
  ('rawkaan-image-2433', 'rawkaan-item-2433', 'https://res.nunps.com/api/image?path=product%2Fimages%2FTMMEdc7fhhGF_2026-04-17.png', 'مرجريتا', 0, TRUE, CURRENT_TIMESTAMP),
  ('rawkaan-image-2434', 'rawkaan-item-2434', 'https://res.nunps.com/api/image?path=product%2Fimages%2FfBMPsYuM6hVL_2026-04-21.png', 'الفريدو', 0, TRUE, CURRENT_TIMESTAMP),
  ('rawkaan-image-2435', 'rawkaan-item-2435', 'https://res.nunps.com/api/image?path=product%2Fimages%2FuBxN11o4r5FH_2026-05-14.png', 'باربكيو', 0, TRUE, CURRENT_TIMESTAMP),
  ('rawkaan-image-2437', 'rawkaan-item-2437', 'https://res.nunps.com/api/image?path=product%2Fimages%2FQb4RY5eIFwbz_2026-05-14.png', 'خضار', 0, TRUE, CURRENT_TIMESTAMP),
  ('rawkaan-image-2438', 'rawkaan-item-2438', 'https://res.nunps.com/api/image?path=product%2Fimages%2FGXA57MBEp2j7_2026-04-17.png', 'بيتزا روقان', 0, TRUE, CURRENT_TIMESTAMP),
  ('rawkaan-image-2439', 'rawkaan-item-2439', 'https://res.nunps.com/api/image?path=product%2Fimages%2F5u5G2Mi8ZbRU_2026-05-14.png', 'فوتتيشينى الفريدو', 0, TRUE, CURRENT_TIMESTAMP),
  ('rawkaan-image-2440', 'rawkaan-item-2440', 'https://res.nunps.com/api/image?path=product%2Fimages%2Ft2fn1XjQMMou_2026-04-21.png', 'بينى روزا', 0, TRUE, CURRENT_TIMESTAMP),
  ('rawkaan-image-2441', 'rawkaan-item-2441', 'https://res.nunps.com/api/image?path=product%2Fimages%2FWptlvon8nyll_2026-05-14.png', 'بينا ببياتا', 0, TRUE, CURRENT_TIMESTAMP),
  ('rawkaan-image-2442', 'rawkaan-item-2442', 'https://res.nunps.com/api/image?path=product%2Fimages%2FKv2ty8H1wmZ2_2026-05-14.png', 'بينى بيستو', 0, TRUE, CURRENT_TIMESTAMP),
  ('rawkaan-image-2445', 'rawkaan-item-2445', 'https://res.nunps.com/api/image?path=product%2Fimages%2FetrfvwKm1ZxS_2026-05-14.png', 'برغر كلاسيك150 غم', 0, TRUE, CURRENT_TIMESTAMP),
  ('rawkaan-image-2448', 'rawkaan-item-2448', 'https://res.nunps.com/api/image?path=product%2Fimages%2FGRqVqDV8rHkR_2026-05-14.png', 'فاهيتا', 0, TRUE, CURRENT_TIMESTAMP),
  ('rawkaan-image-2449', 'rawkaan-item-2449', 'https://res.nunps.com/api/image?path=product%2Fimages%2FEymg2qk3bH1x_2026-05-14.png', 'كريسبى', 0, TRUE, CURRENT_TIMESTAMP),
  ('rawkaan-image-2450', 'rawkaan-item-2450', 'https://res.nunps.com/api/image?path=product%2Fimages%2FC56E7hROw51e_2026-05-14.png', 'الفريدو', 0, TRUE, CURRENT_TIMESTAMP),
  ('rawkaan-image-2452', 'rawkaan-item-2452', 'https://res.nunps.com/api/image?path=product%2Fimages%2FuRY5LFtdnjXy_2026-05-14.png', 'روقان', 0, TRUE, CURRENT_TIMESTAMP),
  ('rawkaan-image-2453', 'rawkaan-item-2453', 'https://res.nunps.com/api/image?path=product%2Fimages%2FTPg6molRyfdp_2026-05-14.png', 'ستيك انتريكوت', 0, TRUE, CURRENT_TIMESTAMP),
  ('rawkaan-image-2456', 'rawkaan-item-2456', 'https://res.nunps.com/api/image?path=product%2Fimages%2FkiAXzeCk2QvK_2026-05-14.png', 'ستيك صدر دجاج', 0, TRUE, CURRENT_TIMESTAMP),
  ('rawkaan-image-2457', 'rawkaan-item-2457', 'https://res.nunps.com/api/image?path=product%2Fimages%2FMHoOFKsZgRSI_2026-05-14.png', 'تشيكن بوبييت', 0, TRUE, CURRENT_TIMESTAMP),
  ('rawkaan-image-2458', 'rawkaan-item-2458', 'https://res.nunps.com/api/image?path=product%2Fimages%2FySbLdluyG51h_2026-05-14.png', 'ستراجنوف عجل', 0, TRUE, CURRENT_TIMESTAMP),
  ('rawkaan-image-2459', 'rawkaan-item-2459', 'https://res.nunps.com/api/image?path=product%2Fimages%2FdkxkP2aS8pX6_2026-04-21.png', 'ستراجنوف دجاج', 0, TRUE, CURRENT_TIMESTAMP),
  ('rawkaan-image-2460', 'rawkaan-item-2460', 'https://res.nunps.com/api/image?path=product%2Fimages%2F7kxaVH2X0lFh_2026-05-14.png', 'فخارة خروف', 0, TRUE, CURRENT_TIMESTAMP),
  ('rawkaan-image-2464', 'rawkaan-item-2464', 'https://res.nunps.com/api/image?path=product%2Fimages%2FZ9Yn0wkXTd7I_2026-04-21.png', 'فيليه عجل', 0, TRUE, CURRENT_TIMESTAMP),
  ('rawkaan-image-2465', 'rawkaan-item-2465', 'https://res.nunps.com/api/image?path=product%2Fimages%2F83jQohNCweNg_2026-05-14.png', 'كباب', 0, TRUE, CURRENT_TIMESTAMP),
  ('rawkaan-image-2469', 'rawkaan-item-2469', 'https://res.nunps.com/api/image?path=product%2Fimages%2FI7uZQy1aFh9o_2026-04-17.png', 'نصف دجاجة', 0, TRUE, CURRENT_TIMESTAMP),
  ('rawkaan-image-2472', 'rawkaan-item-2472', 'https://res.nunps.com/api/image?path=product%2Fimages%2FxPILQrtFoZ7e_2026-05-14.png', 'سالمون ستيك', 0, TRUE, CURRENT_TIMESTAMP),
  ('rawkaan-image-2473', 'rawkaan-item-2473', 'https://res.nunps.com/api/image?path=product%2Fimages%2F5SkeKfdWkO1Y_2026-04-17.png', 'جمبرى مقلى', 0, TRUE, CURRENT_TIMESTAMP),
  ('rawkaan-image-2476', 'rawkaan-item-2476', 'https://res.nunps.com/api/image?path=product%2Fimages%2FPUxS8tqqSJ2E_2026-05-14.png', 'برتقال', 0, TRUE, CURRENT_TIMESTAMP),
  ('rawkaan-image-2478', 'rawkaan-item-2478', 'https://res.nunps.com/api/image?path=product%2Fimages%2FtMjN1vx2GwVr_2026-05-14.png', 'برتقال وجزر', 0, TRUE, CURRENT_TIMESTAMP),
  ('rawkaan-image-2480', 'rawkaan-item-2480', 'https://res.nunps.com/api/image?path=product%2Fimages%2FpFfV1onlVDDF_2026-05-14.png', 'ليمون ونعنع فريش', 0, TRUE, CURRENT_TIMESTAMP),
  ('rawkaan-image-2484', 'rawkaan-item-2484', 'https://res.nunps.com/api/image?path=product%2Fimages%2Fz5AgWNSfGFc2_2026-05-14.png', 'جميكا', 0, TRUE, CURRENT_TIMESTAMP),
  ('rawkaan-image-2486', 'rawkaan-item-2486', 'https://res.nunps.com/api/image?path=product%2Fimages%2FhCFc74tNiQLk_2026-05-14.png', 'مانجا وببلز', 0, TRUE, CURRENT_TIMESTAMP),
  ('rawkaan-image-2487', 'rawkaan-item-2487', 'https://res.nunps.com/api/image?path=product%2Fimages%2FSG5FNI9vMi3y_2026-05-14.png', 'فروالة وببلز', 0, TRUE, CURRENT_TIMESTAMP),
  ('rawkaan-image-2488', 'rawkaan-item-2488', 'https://res.nunps.com/api/image?path=product%2Fimages%2F8CasTDBec6y0_2026-04-17.png', 'اناناس وببلز', 0, TRUE, CURRENT_TIMESTAMP),
  ('rawkaan-image-2490', 'rawkaan-item-2490', 'https://res.nunps.com/api/image?path=product%2Fimages%2FkgLnUb9A2E7S_2026-05-19.png', 'بطيخ', 0, TRUE, CURRENT_TIMESTAMP),
  ('rawkaan-image-2491', 'rawkaan-item-2491', 'https://res.nunps.com/api/image?path=product%2Fimages%2FOfeihTS6p1MY_2026-04-17.png', 'مكس بيرى', 0, TRUE, CURRENT_TIMESTAMP),
  ('rawkaan-image-2493', 'rawkaan-item-2493', 'https://res.nunps.com/api/image?path=product%2Fimages%2FpbsuTAQn5YZS_2026-05-14.png', 'اناناس وببلز', 0, TRUE, CURRENT_TIMESTAMP),
  ('rawkaan-image-2494', 'rawkaan-item-2494', 'https://res.nunps.com/api/image?path=product%2Fimages%2FqW6q7hewTvk6_2026-05-19.png', 'بلوبرى', 0, TRUE, CURRENT_TIMESTAMP),
  ('rawkaan-image-2498', 'rawkaan-item-2498', 'https://res.nunps.com/api/image?path=product%2Fimages%2F6uZRvn9XkXWz_2026-05-19.png', 'بلو كورساو', 0, TRUE, CURRENT_TIMESTAMP),
  ('rawkaan-image-2503', 'rawkaan-item-2503', 'https://res.nunps.com/api/image?path=product%2Fimages%2FFo60cQUMsh0X_2026-05-14.png', 'فانيلا', 0, TRUE, CURRENT_TIMESTAMP),
  ('rawkaan-image-2504', 'rawkaan-item-2504', 'https://res.nunps.com/api/image?path=product%2Fimages%2FwcAxDcZev0RK_2026-05-14.png', 'شوكو', 0, TRUE, CURRENT_TIMESTAMP),
  ('rawkaan-image-2505', 'rawkaan-item-2505', 'https://res.nunps.com/api/image?path=product%2Fimages%2Fo0CqYsnLnRMT_2026-05-14.png', 'اوريو', 0, TRUE, CURRENT_TIMESTAMP),
  ('rawkaan-image-2508', 'rawkaan-item-2508', 'https://res.nunps.com/api/image?path=product%2Fimages%2FfWs4K81fdbgu_2026-05-14.png', 'كونيتو سنيكرز', 0, TRUE, CURRENT_TIMESTAMP),
  ('rawkaan-image-2510', 'rawkaan-item-2510', 'https://res.nunps.com/api/image?path=product%2Fimages%2F2WCjC1tZAhBp_2026-05-14.png', 'لوتس', 0, TRUE, CURRENT_TIMESTAMP),
  ('rawkaan-image-2511', 'rawkaan-item-2511', 'https://res.nunps.com/api/image?path=product%2Fimages%2F4KpueTnCYjwq_2026-05-14.png', 'ابوظبى', 0, TRUE, CURRENT_TIMESTAMP),
  ('rawkaan-image-2514', 'rawkaan-item-2514', 'https://res.nunps.com/api/image?path=product%2Fimages%2FKP1BTqXSO28K_2026-05-14.png', 'ماتشا ستروبرى', 0, TRUE, CURRENT_TIMESTAMP),
  ('rawkaan-image-2530', 'rawkaan-item-2530', 'https://res.nunps.com/api/image?path=product%2Fimages%2FV5pLoKvpA1tH_2026-05-14.png', 'كابيتشنو اسبريسو حليب', 0, TRUE, CURRENT_TIMESTAMP),
  ('rawkaan-image-2543', 'rawkaan-item-2543', 'https://res.nunps.com/api/image?path=product%2Fimages%2F0Oi556QxrKsB_2026-04-17.png', 'روقان كوكتيل', 0, TRUE, CURRENT_TIMESTAMP),
  ('rawkaan-image-2545', 'rawkaan-item-2545', 'https://res.nunps.com/api/image?path=product%2Fimages%2F3JXhkbZedQzC_2026-05-14.png', 'فخفينا', 0, TRUE, CURRENT_TIMESTAMP),
  ('rawkaan-image-2549', 'rawkaan-item-2549', 'https://res.nunps.com/api/image?path=product%2Fimages%2FqoYpIaBwvIDz_2026-04-17.png', 'بوظة مشكل فاخر', 0, TRUE, CURRENT_TIMESTAMP),
  ('rawkaan-image-2554', 'rawkaan-item-2554', 'https://res.nunps.com/api/image?path=product%2Fimages%2Fo7CfyqZrdtIJ_2026-05-14.png', 'بيتزا لوتس مع بسكوت', 0, TRUE, CURRENT_TIMESTAMP),
  ('rawkaan-image-2556', 'rawkaan-item-2556', 'https://res.nunps.com/api/image?path=product%2Fimages%2FUtHVVzlUF3r7_2026-05-14.png', 'بيتزا الفصول الاربعة', 0, TRUE, CURRENT_TIMESTAMP),
  ('rawkaan-image-2558', 'rawkaan-item-2558', 'https://res.nunps.com/api/image?path=product%2Fimages%2Fmkhaqactautb_2026-04-17.png', 'بيتزا دبى', 0, TRUE, CURRENT_TIMESTAMP),
  ('rawkaan-image-2560', 'rawkaan-item-2560', 'https://res.nunps.com/api/image?path=product%2Fimages%2FSyDiq9Scy87c_2026-05-14.png', 'تريليتشى', 0, TRUE, CURRENT_TIMESTAMP),
  ('rawkaan-image-3882', 'rawkaan-item-3882', 'https://res.nunps.com/api/image?path=product%2Fimages%2FwVPf7Ay6K2LO_2026-05-14.png', 'مينى بان كيك', 0, TRUE, CURRENT_TIMESTAMP),
  ('rawkaan-image-3883', 'rawkaan-item-3883', 'https://res.nunps.com/api/image?path=product%2Fimages%2FzmT1aLCgWeaF_2026-05-14.png', 'سوفيله', 0, TRUE, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET
  "item_id" = EXCLUDED."item_id",
  "url" = EXCLUDED."url",
  "alt" = EXCLUDED."alt",
  "sort_order" = 0,
  "is_primary" = TRUE;

INSERT INTO "modifier_groups"
  ("id", "type", "name", "name_en", "min_selections", "max_selections",
   "is_required", "is_active", "sort_order", "created_at", "updated_at")
VALUES
  (md5('rawkaan-size-2476')::uuid, 'VARIANT'::"ModifierGroupType", 'الحجم', 'Size', 1, 1, TRUE, TRUE, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (md5('rawkaan-size-2477')::uuid, 'VARIANT'::"ModifierGroupType", 'الحجم', 'Size', 1, 1, TRUE, TRUE, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (md5('rawkaan-size-2478')::uuid, 'VARIANT'::"ModifierGroupType", 'الحجم', 'Size', 1, 1, TRUE, TRUE, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (md5('rawkaan-size-2479')::uuid, 'VARIANT'::"ModifierGroupType", 'الحجم', 'Size', 1, 1, TRUE, TRUE, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (md5('rawkaan-size-2480')::uuid, 'VARIANT'::"ModifierGroupType", 'الحجم', 'Size', 1, 1, TRUE, TRUE, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (md5('rawkaan-size-2481')::uuid, 'VARIANT'::"ModifierGroupType", 'الحجم', 'Size', 1, 1, TRUE, TRUE, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET
  "type" = EXCLUDED."type",
  "name" = EXCLUDED."name",
  "name_en" = EXCLUDED."name_en",
  "min_selections" = EXCLUDED."min_selections",
  "max_selections" = EXCLUDED."max_selections",
  "is_required" = EXCLUDED."is_required",
  "is_active" = TRUE,
  "sort_order" = EXCLUDED."sort_order",
  "updated_at" = CURRENT_TIMESTAMP;

INSERT INTO "modifier_options"
  ("id", "group_id", "name", "name_en", "price_type", "price",
   "is_active", "sort_order", "created_at", "updated_at")
VALUES
  (md5('rawkaan-size-option-2476-S')::uuid, md5('rawkaan-size-2476')::uuid, 'صغير', 'S', 'REPLACEMENT'::"ModifierPriceType", 14::numeric(10,2), TRUE, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (md5('rawkaan-size-option-2476-L')::uuid, md5('rawkaan-size-2476')::uuid, 'كبير', 'L', 'REPLACEMENT'::"ModifierPriceType", 32::numeric(10,2), TRUE, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (md5('rawkaan-size-option-2477-S')::uuid, md5('rawkaan-size-2477')::uuid, 'صغير', 'S', 'REPLACEMENT'::"ModifierPriceType", 12::numeric(10,2), TRUE, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (md5('rawkaan-size-option-2477-L')::uuid, md5('rawkaan-size-2477')::uuid, 'كبير', 'L', 'REPLACEMENT'::"ModifierPriceType", 30::numeric(10,2), TRUE, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (md5('rawkaan-size-option-2478-S')::uuid, md5('rawkaan-size-2478')::uuid, 'صغير', 'S', 'REPLACEMENT'::"ModifierPriceType", 13::numeric(10,2), TRUE, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (md5('rawkaan-size-option-2478-L')::uuid, md5('rawkaan-size-2478')::uuid, 'كبير', 'L', 'REPLACEMENT'::"ModifierPriceType", 30::numeric(10,2), TRUE, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (md5('rawkaan-size-option-2479-S')::uuid, md5('rawkaan-size-2479')::uuid, 'صغير', 'S', 'REPLACEMENT'::"ModifierPriceType", 13::numeric(10,2), TRUE, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (md5('rawkaan-size-option-2479-L')::uuid, md5('rawkaan-size-2479')::uuid, 'كبير', 'L', 'REPLACEMENT'::"ModifierPriceType", 30::numeric(10,2), TRUE, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (md5('rawkaan-size-option-2480-S')::uuid, md5('rawkaan-size-2480')::uuid, 'صغير', 'S', 'REPLACEMENT'::"ModifierPriceType", 15::numeric(10,2), TRUE, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (md5('rawkaan-size-option-2480-L')::uuid, md5('rawkaan-size-2480')::uuid, 'كبير', 'L', 'REPLACEMENT'::"ModifierPriceType", 32::numeric(10,2), TRUE, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (md5('rawkaan-size-option-2481-S')::uuid, md5('rawkaan-size-2481')::uuid, 'صغير', 'S', 'REPLACEMENT'::"ModifierPriceType", 14::numeric(10,2), TRUE, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (md5('rawkaan-size-option-2481-L')::uuid, md5('rawkaan-size-2481')::uuid, 'كبير', 'L', 'REPLACEMENT'::"ModifierPriceType", 32::numeric(10,2), TRUE, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET
  "group_id" = EXCLUDED."group_id",
  "name" = EXCLUDED."name",
  "name_en" = EXCLUDED."name_en",
  "price_type" = EXCLUDED."price_type",
  "price" = EXCLUDED."price",
  "is_active" = TRUE,
  "sort_order" = EXCLUDED."sort_order",
  "updated_at" = CURRENT_TIMESTAMP;

INSERT INTO "menu_item_modifier_groups"
  ("id", "menu_item_id", "group_id", "sort_order")
VALUES
  (md5('rawkaan-link-size-2476')::uuid, 'rawkaan-item-2476', md5('rawkaan-size-2476')::uuid, 0),
  (md5('rawkaan-link-size-2477')::uuid, 'rawkaan-item-2477', md5('rawkaan-size-2477')::uuid, 0),
  (md5('rawkaan-link-size-2478')::uuid, 'rawkaan-item-2478', md5('rawkaan-size-2478')::uuid, 0),
  (md5('rawkaan-link-size-2479')::uuid, 'rawkaan-item-2479', md5('rawkaan-size-2479')::uuid, 0),
  (md5('rawkaan-link-size-2480')::uuid, 'rawkaan-item-2480', md5('rawkaan-size-2480')::uuid, 0),
  (md5('rawkaan-link-size-2481')::uuid, 'rawkaan-item-2481', md5('rawkaan-size-2481')::uuid, 0)
ON CONFLICT ("menu_item_id", "group_id") DO UPDATE SET
  "sort_order" = EXCLUDED."sort_order";

-- Source add-on groups. The zero-priced juice-jug entries are retained because
-- they are part of the published catalog and convey an available ordering choice.
INSERT INTO "modifier_groups"
  ("id", "type", "name", "name_en", "min_selections", "max_selections",
   "is_required", "is_active", "sort_order", "created_at", "updated_at")
VALUES
  (md5('rawkaan-extra-93')::uuid, 'ADD_ON'::"ModifierGroupType", 'اضافات', 'Add-ons / Extras', 0, 3, FALSE, TRUE, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (md5('rawkaan-extra-94')::uuid, 'ADD_ON'::"ModifierGroupType", 'اضافات', 'Add-ons', 0, 1, FALSE, TRUE, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (md5('rawkaan-extra-95')::uuid, 'ADD_ON'::"ModifierGroupType", 'اضافات', 'Add-ons', 0, 1, FALSE, TRUE, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (md5('rawkaan-extra-96')::uuid, 'ADD_ON'::"ModifierGroupType", 'اضافات', 'Add-ons', 0, 1, FALSE, TRUE, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (md5('rawkaan-extra-97')::uuid, 'ADD_ON'::"ModifierGroupType", 'اضافات', 'Add-ons', 0, 1, FALSE, TRUE, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (md5('rawkaan-extra-98')::uuid, 'ADD_ON'::"ModifierGroupType", 'اضافات', 'Add-ons', 0, 1, FALSE, TRUE, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (md5('rawkaan-extra-99')::uuid, 'ADD_ON'::"ModifierGroupType", 'اضافات', 'Add-ons', 0, 1, FALSE, TRUE, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET
  "type" = EXCLUDED."type",
  "name" = EXCLUDED."name",
  "name_en" = EXCLUDED."name_en",
  "min_selections" = EXCLUDED."min_selections",
  "max_selections" = EXCLUDED."max_selections",
  "is_required" = EXCLUDED."is_required",
  "is_active" = TRUE,
  "sort_order" = EXCLUDED."sort_order",
  "updated_at" = CURRENT_TIMESTAMP;

INSERT INTO "modifier_options"
  ("id", "group_id", "name", "name_en", "price_type", "price",
   "is_active", "sort_order", "created_at", "updated_at")
VALUES
  (md5('rawkaan-extra-option-443')::uuid, md5('rawkaan-extra-93')::uuid, 'اضافة دجاج', 'Add Chicken', 'DELTA'::"ModifierPriceType", 5, TRUE, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (md5('rawkaan-extra-option-444')::uuid, md5('rawkaan-extra-93')::uuid, 'اضافة جمبرى', 'Add Shrimp', 'DELTA'::"ModifierPriceType", 10, TRUE, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (md5('rawkaan-extra-option-445')::uuid, md5('rawkaan-extra-93')::uuid, 'بالفرن مع جبنة', 'Baked with Cheese', 'DELTA'::"ModifierPriceType", 5, TRUE, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (md5('rawkaan-extra-option-446')::uuid, md5('rawkaan-extra-94')::uuid, 'يمكن طلب ابريق عصير سعة 1لتر', 'You can order a 1-liter juice jug', 'DELTA'::"ModifierPriceType", 0, TRUE, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (md5('rawkaan-extra-option-447')::uuid, md5('rawkaan-extra-95')::uuid, 'يمكن طلب ابريق عصير سعة 1لتر', 'You can order a 1-liter juice jug', 'DELTA'::"ModifierPriceType", 0, TRUE, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (md5('rawkaan-extra-option-448')::uuid, md5('rawkaan-extra-96')::uuid, 'يمكن طلب ابريق عصير سعة 1لتر', 'You can order a 1-liter juice jug', 'DELTA'::"ModifierPriceType", 0, TRUE, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (md5('rawkaan-extra-option-449')::uuid, md5('rawkaan-extra-97')::uuid, 'يمكن طلب ابريق عصير سعة 1لتر', 'You can order a 1-liter juice jug', 'DELTA'::"ModifierPriceType", 0, TRUE, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (md5('rawkaan-extra-option-450')::uuid, md5('rawkaan-extra-98')::uuid, 'يمكن طلب إبريق عصير سعة 1 لتر', 'You can order a 1-liter juice jug', 'DELTA'::"ModifierPriceType", 0, TRUE, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (md5('rawkaan-extra-option-451')::uuid, md5('rawkaan-extra-99')::uuid, 'يمكن طلب إبريق عصير سعة 1 لتر', 'You can order a 1-liter juice jug', 'DELTA'::"ModifierPriceType", 0, TRUE, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET
  "group_id" = EXCLUDED."group_id",
  "name" = EXCLUDED."name",
  "name_en" = EXCLUDED."name_en",
  "price_type" = EXCLUDED."price_type",
  "price" = EXCLUDED."price",
  "is_active" = TRUE,
  "sort_order" = EXCLUDED."sort_order",
  "updated_at" = CURRENT_TIMESTAMP;

INSERT INTO "menu_item_modifier_groups"
  ("id", "menu_item_id", "group_id", "sort_order")
VALUES
  (md5('rawkaan-link-extra-2444-93')::uuid, 'rawkaan-item-2444', md5('rawkaan-extra-93')::uuid, 1),
  (md5('rawkaan-link-extra-2476-94')::uuid, 'rawkaan-item-2476', md5('rawkaan-extra-94')::uuid, 1),
  (md5('rawkaan-link-extra-2477-95')::uuid, 'rawkaan-item-2477', md5('rawkaan-extra-95')::uuid, 1),
  (md5('rawkaan-link-extra-2478-96')::uuid, 'rawkaan-item-2478', md5('rawkaan-extra-96')::uuid, 1),
  (md5('rawkaan-link-extra-2479-97')::uuid, 'rawkaan-item-2479', md5('rawkaan-extra-97')::uuid, 1),
  (md5('rawkaan-link-extra-2480-98')::uuid, 'rawkaan-item-2480', md5('rawkaan-extra-98')::uuid, 1),
  (md5('rawkaan-link-extra-2481-99')::uuid, 'rawkaan-item-2481', md5('rawkaan-extra-99')::uuid, 1)
ON CONFLICT ("menu_item_id", "group_id") DO UPDATE SET
  "sort_order" = EXCLUDED."sort_order";

UPDATE "restaurant_settings"
SET "name" = 'روقان',
    "name_en" = 'Rawkaan',
    "logo_url" = 'https://res.nunps.com/api/image?path=logo%2Flogo_1776758376747_dryrps.png',
    "logo_public_id" = NULL,
    "phone" = '0598493986',
    "whatsapp" = '+972597255792',
    "facebook" = NULL,
    "instagram" = NULL,
    "tiktok" = NULL,
    "address_line" = 'نابلس شارع حطين مقابل كوكتيل ابو عيسى',
    "currency" = 'ILS',
    "pos_currency" = 'ILS',
    "pos_cache_epoch" = "pos_cache_epoch" + 1,
    "updated_at" = CURRENT_TIMESTAMP;

INSERT INTO "catalog_changes" ("entity_type", "entity_id", "action", "payload", "created_at")
SELECT
  'Category',
  "id",
  'UPDATED',
  jsonb_build_object('reason', 'RAWKAAN_CATALOG_IMPORT', 'source', 'res.nunps.com'),
  CURRENT_TIMESTAMP
FROM "categories"
WHERE "id" LIKE 'rawkaan-cat-%';

INSERT INTO "catalog_changes" ("entity_type", "entity_id", "action", "payload", "created_at")
SELECT
  'MenuItem',
  "id",
  'UPDATED',
  jsonb_build_object('reason', 'RAWKAAN_CATALOG_IMPORT', 'source', 'res.nunps.com'),
  CURRENT_TIMESTAMP
FROM "menu_items"
WHERE "id" LIKE 'rawkaan-item-%';
