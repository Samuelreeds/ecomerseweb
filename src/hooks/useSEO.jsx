import { useEffect } from 'react';

/**
 * @param {Object} params
 * @param {string} [params.title]
 * @param {string} [params.description]
 * @param {string} [params.canonicalUrl]
 * @param {string} [params.ogType='website']
 * @param {string} [params.ogImage]
 * @param {Object|null} [params.schema]
 * @param {Object|null} [params.breadcrumbSchema]
 */
export function useSEO({
  title,
  description,
  canonicalUrl,
  ogType = 'website',
  ogImage,
  schema,
  breadcrumbSchema
}) {
  useEffect(() => {
    // FIXED: Changed HTMLElement[] to Element[] to match document.querySelector
    /** @type {Element[]} */
    const injectedElements = [];

    /**
     * @param {string} attrName 
     * @param {string} attrValue 
     * @param {string} content 
     */
    const setMetaTag = (attrName, attrValue, content) => {
      if (!content) return;
      let element = document.querySelector(`meta[${attrName}="${attrValue}"]`);
      if (!element) {
        element = document.createElement('meta');
        element.setAttribute(attrName, attrValue);
        document.head.appendChild(element);
        injectedElements.push(element); 
      } else {
        injectedElements.push(element);
      }
      element.setAttribute('content', content);
    };

    if (title) {
      document.title = `${title} | NOIR MTD`;
      setMetaTag('property', 'og:title', title);
      setMetaTag('name', 'twitter:title', title);
    }

    if (description) {
      setMetaTag('name', 'description', description);
      setMetaTag('property', 'og:description', description);
      setMetaTag('name', 'twitter:description', description);
    }

    const url = canonicalUrl || window.location.href.split('?')[0];
    let link = document.querySelector("link[rel='canonical']");
    if (!link) {
      link = document.createElement('link');
      link.setAttribute('rel', 'canonical');
      document.head.appendChild(link);
      injectedElements.push(link);
    } else {
      injectedElements.push(link);
    }
    link.setAttribute('href', url);
    
    setMetaTag('property', 'og:url', url);
    setMetaTag('property', 'og:type', ogType);
    setMetaTag('property', 'og:site_name', 'NOIR MTD');

    if (ogImage) {
      setMetaTag('property', 'og:image', ogImage);
      setMetaTag('name', 'twitter:image', ogImage);
      setMetaTag('name', 'twitter:card', 'summary_large_image');
    }

    let script = document.querySelector('#seo-schema');
    if (schema) {
      if (!script) {
        script = document.createElement('script');
        script.setAttribute('id', 'seo-schema');
        script.setAttribute('type', 'application/ld+json');
        document.head.appendChild(script);
      }
      script.textContent = JSON.stringify(schema);
    } else if (script) {
      script.remove();
    }

    let breadcrumbScript = document.querySelector('#breadcrumb-schema');
    if (breadcrumbSchema) {
      if (!breadcrumbScript) {
        breadcrumbScript = document.createElement('script');
        breadcrumbScript.setAttribute('id', 'breadcrumb-schema');
        breadcrumbScript.setAttribute('type', 'application/ld+json');
        document.head.appendChild(breadcrumbScript);
      }
      breadcrumbScript.textContent = JSON.stringify(breadcrumbSchema);
    } else if (breadcrumbScript) {
      breadcrumbScript.remove();
    }

    return () => {
      injectedElements.forEach(el => {
        if (document.head.contains(el)) {
          el.remove();
        }
      });
      if (script && document.head.contains(script)) script.remove();
      if (breadcrumbScript && document.head.contains(breadcrumbScript)) breadcrumbScript.remove();
    };
  }, [title, description, canonicalUrl, ogType, ogImage, schema, breadcrumbSchema]);
}