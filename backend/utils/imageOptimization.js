
/**
 * Image optimization utilities for Cloudinary CDN
 */

/**
 * Generate optimized image URL with transformations
 */
function getOptimizedImageUrl(publicId, options = {}) {
  const {
    width = 800,
    height = 1000,
    quality = 'auto',
    format = 'auto',
    crop = 'fill',
    gravity = 'face'
  } = options;

  const baseUrl = 'https://res.cloudinary.com';
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  
  const transformations = [
    `w_${width}`,
    `h_${height}`,
    `c_${crop}`,
    `g_${gravity}`,
    `q_${quality}`,
    `f_${format}`
  ].join(',');

  return `${baseUrl}/${cloudName}/image/upload/${transformations}/${publicId}`;
}

/**
 * Generate responsive image URLs for different screen sizes
 */
function getResponsiveImageUrls(publicId) {
  return {
    thumbnail: getOptimizedImageUrl(publicId, { width: 150, height: 150 }),
    small: getOptimizedImageUrl(publicId, { width: 400, height: 500 }),
    medium: getOptimizedImageUrl(publicId, { width: 800, height: 1000 }),
    large: getOptimizedImageUrl(publicId, { width: 1200, height: 1500 }),
    original: getOptimizedImageUrl(publicId, { width: 2000, height: 2500 })
  };
}

/**
 * Get WebP version of image for modern browsers
 */
function getWebPUrl(publicId, width = 800, height = 1000) {
  return getOptimizedImageUrl(publicId, {
    width,
    height,
    format: 'webp',
    quality: 'auto:eco'
  });
}

module.exports = {
  getOptimizedImageUrl,
  getResponsiveImageUrls,
  getWebPUrl
};
