# Rawaqan API Reference

Base URL: `http://localhost:4000/api` (dev). All responses use a consistent envelope.

**Success**
```json
{ "success": true, "data": <payload>, "meta": { ... } }
```
**Error**
```json
{ "success": false, "error": { "code": "NOT_FOUND", "message": "…", "details": [...] } }
```

Status codes: `200` OK · `201` Created · `204` No Content · `400` validation · `401` unauth ·
`403` forbidden · `404` not found · `409` conflict · `429` rate-limited · `500` server.

## Authentication
JWT access token (15m) sent as `Authorization: Bearer <token>`. A rotating refresh token lives in
an httpOnly cookie (`rawaqan_rt`, path `/api/auth`) and is exchanged at `/auth/refresh`.

| Method | Path | Auth | Body | Notes |
|--------|------|------|------|-------|
| POST | `/auth/login` | — | `{ email, password }` | Sets refresh cookie, returns `{ admin, accessToken }`. Rate-limited. |
| POST | `/auth/refresh` | cookie | — | Rotates refresh token, returns new access token. |
| POST | `/auth/logout` | — | — | Revokes refresh token, clears cookie. |
| GET | `/auth/me` | Bearer | — | Current admin profile. |

## Public endpoints (no auth)

| Method | Path | Query / Notes |
|--------|------|---------------|
| GET | `/settings` | Restaurant settings + computed `isOpen` + opening hours |
| GET | `/categories` | Active categories, each with available items |
| GET | `/items` | `categoryId, search, featured, bestSeller, isNew, vegetarian, sort, limit` |
| GET | `/items/:slug` | Single item + `related[]` |
| GET | `/tags` | All tags |
| GET | `/qr` | `format=png\|svg\|pdf\|json`, `size` (128–2048). Encodes the menu URL |
| GET | `/sitemap.xml` | Dynamic sitemap (root path, not `/api`) |
| GET | `/robots.txt` | Root path |

`sort` ∈ `popular | price_asc | price_desc | newest | name`.

## Admin endpoints (Bearer required)

### Categories `/admin/categories`
| Method | Path | Body |
|--------|------|------|
| GET | `/` | — (all categories + item counts) |
| POST | `/` | `{ name, nameEn?, description?, imageUrl?, isActive? }` |
| GET | `/:id` | — |
| PATCH | `/:id` | partial category |
| DELETE | `/:id` | — (cascades to items) |
| PATCH | `/reorder` | `{ order: [{ id, sortOrder }] }` |

### Meals `/admin/items`
| Method | Path | Body |
|--------|------|------|
| GET | `/` | `?categoryId&search` |
| POST | `/` | full item (see below) |
| GET | `/:id` | — |
| PATCH | `/:id` | partial item |
| DELETE | `/:id` | — |
| POST | `/:id/duplicate` | — (deep copy, marked unavailable) |

Item body: `{ categoryId, name, nameEn?, description?, descriptionEn?, ingredients?, price,
discountPrice?, calories?, allergens?, spiceLevel(NONE|MILD|MEDIUM|HOT), isAvailable?, isFeatured?,
isBestSeller?, isNew?, isVegetarian?, isChefRecommendation?, tagIds?[] }`. `discountPrice` must be
below `price`.

### Tags `/admin/tags`
`GET /` · `POST /` `{ label, labelEn?, color? }` · `PATCH /:id` · `DELETE /:id`

### Uploads `/admin/uploads`
| Method | Path | Form-data | Result |
|--------|------|-----------|--------|
| POST | `/` | `file`, `folder?` | `{ url, publicId }` (logos/covers/category images) |
| POST | `/items/:itemId/images` | `files[]` (≤10) | created `ItemImage[]` |
| DELETE | `/images/:imageId` | — | removes Cloudinary asset + row; promotes new primary |
| PATCH | `/images/:imageId/primary` | — | sets primary |

Accepted image types: JPEG, PNG, WEBP, AVIF · max 8 MB each.

### Settings `/admin/settings`
`GET /` · `PATCH /` (identity, contact, social, theme colors, currency…) ·
`PATCH /hours` `{ hours: OpeningHour[7] }`

### Dashboard
`GET /admin/dashboard/stats` → totals, recent meals, recent activity log.

### QR `/admin/qr`
`GET /?format=&size=&table=` — same as public plus **table scoping** for printable table cards.
Downloads must be fetched with the Bearer header (the admin UI streams them as blobs).
