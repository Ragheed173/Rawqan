import { config } from '@/config/env';

interface SeoProps {
  title?: string;
  description?: string;
  image?: string | null;
  path?: string;
  type?: string;
  jsonLd?: Record<string, unknown>;
}

const SITE_NAME = 'روقان | Rawaqan';
const DEFAULT_DESC = 'روقان — تجربة طعام فاخرة. تصفّح قائمتنا الرقمية الأنيقة.';

/**
 * Centralized SEO/meta head (Task 13). Uses React 19 native document metadata:
 * <title>/<meta>/<link> rendered here are automatically hoisted into <head>.
 */
export function Seo({ title, description = DEFAULT_DESC, image, path = '', type = 'website', jsonLd }: SeoProps) {
  const fullTitle = title ? `${title} · ${SITE_NAME}` : SITE_NAME;
  const url = `${config.siteUrl}${path}`;

  return (
    <>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />

      <meta property="og:type" content={type} />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      {image && <meta property="og:image" content={image} />}

      <meta name="twitter:card" content={image ? 'summary_large_image' : 'summary'} />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      {image && <meta name="twitter:image" content={image} />}

      {jsonLd && <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>}
    </>
  );
}
