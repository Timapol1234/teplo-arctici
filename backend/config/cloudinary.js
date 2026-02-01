const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

// Конфигурация Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Storage для изображений кампаний
const campaignImageStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'teplo-arctici/campaigns',
    allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
    transformation: [
      { width: 1200, height: 630, crop: 'limit', quality: 'auto' }
    ]
  }
});

// Storage для чеков/документов отчетов
const reportReceiptStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'teplo-arctici/reports',
    allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'pdf'],
    resource_type: 'auto'
  }
});

// Multer middleware для загрузки изображений кампаний
const uploadCampaignImage = multer({
  storage: campaignImageStorage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
}).single('image_file');

// Multer middleware для загрузки чеков
const uploadReportReceipt = multer({
  storage: reportReceiptStorage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
}).single('receipt_file');

// Удаление файла из Cloudinary
async function deleteFromCloudinary(publicId) {
  try {
    if (publicId) {
      await cloudinary.uploader.destroy(publicId);
    }
  } catch (error) {
    console.error('Ошибка удаления из Cloudinary:', error);
  }
}

// Извлечение public_id из URL Cloudinary
function getPublicIdFromUrl(url) {
  if (!url || !url.includes('cloudinary')) return null;

  const matches = url.match(/\/v\d+\/(.+)\.\w+$/);
  return matches ? matches[1] : null;
}

module.exports = {
  cloudinary,
  uploadCampaignImage,
  uploadReportReceipt,
  deleteFromCloudinary,
  getPublicIdFromUrl
};
