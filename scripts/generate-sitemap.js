import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 1. Robust .env parser for Node.js
const envPath = path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  const envFile = fs.readFileSync(envPath, 'utf8');
  // Split correctly on Windows (\r\n) or Mac/Linux (\n)
  envFile.split(/\r?\n/).forEach(line => {
    // Skip comments and empty lines
    if (!line || line.trim().startsWith('#')) return;
    
    // Extract key and value safely
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      const key = match[1];
      let value = match[2] || '';
      // Remove single or double quotes if present
      value = value.replace(/^['"](.*)['"]$/, '$1').trim();
      process.env[key] = value;
    }
  });
}

// 2. Fallback checks for both VITE_ and standard variable names
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const siteUrl = process.env.VITE_SITE_URL || process.env.SITE_URL;

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Sitemap Gen Failed: Missing Supabase credentials in .env");
  console.error("👉 Please open your .env file and ensure it contains VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.");
  process.exit(1);
}

// Default to a safe placeholder if VITE_SITE_URL is entirely missing
const finalDomain = siteUrl || 'https://noirmtd.com'; 
if (!siteUrl) {
  console.warn(`⚠️ WARNING: VITE_SITE_URL is not defined in .env! Using fallback: ${finalDomain}`);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function generateSitemap() {
  console.log("Generating sitemap...");
  
  // Fetch only active products
  const { data: products, error } = await supabase
    .from('products')
    .select('id, updated_at')
    .neq('status', 'archived');

  if (error) {
    console.error("❌ Failed to fetch products for sitemap:", error.message);
    process.exit(1);
  }

  const staticUrls = ['/', '/shop', '/about', '/contact', '/legal'];

  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

  // Static Routes
  staticUrls.forEach(url => {
    xml += `  <url>\n    <loc>${finalDomain}${url}</loc>\n    <changefreq>weekly</changefreq>\n    <priority>${url === '/' ? '1.0' : '0.8'}</priority>\n  </url>\n`;
  });

  // Dynamic Product Routes
  if (products) {
    products.forEach(p => {
      // Only use lastmod if updated_at is actually present in the database row
      const lastModStr = p.updated_at ? `\n    <lastmod>${new Date(p.updated_at).toISOString()}</lastmod>` : '';
      xml += `  <url>\n    <loc>${finalDomain}/product/${p.id}</loc>${lastModStr}\n    <changefreq>daily</changefreq>\n    <priority>0.9</priority>\n  </url>\n`;
    });
  }

  xml += `</urlset>`;

  const outputPath = path.resolve(__dirname, '../public/sitemap.xml');
  fs.writeFileSync(outputPath, xml);
  
  console.log(`✅ Sitemap successfully generated at: ${outputPath}`);
}

generateSitemap();