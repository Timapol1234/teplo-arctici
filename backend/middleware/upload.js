const multer = require('multer');
const path = require('path');
const crypto = require('crypto');

// Разрешенные типы файлов для чеков
const ALLOWED_TYPES = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx'
};

// Разрешенные типы для изображений
const IMAGE_TYPES = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp'
};

// Максимальный размер файла (10MB)
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// Генерация уникального имени файла
const generateFilename = (file, allowedTypes) => {
  const uniqueSuffix = crypto.randomBytes(8).toString('hex');
  const ext = allowedTypes[file.mimetype] || path.extname(file.originalname).slice(1);
  return `${Date.now()}-${uniqueSuffix}.${ext}`;
};

// Настройка хранилища для чеков
const receiptStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../../public/uploads/receipts'));
  },
  filename: (req, file, cb) => {
    cb(null, generateFilename(file, ALLOWED_TYPES));
  }
});

// Настройка хранилища для изображений сборов
const campaignImageStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../../public/uploads/campaigns'));
  },
  filename: (req, file, cb) => {
    cb(null, generateFilename(file, IMAGE_TYPES));
  }
});

// Фильтр файлов для чеков
const receiptFileFilter = (req, file, cb) => {
  if (ALLOWED_TYPES[file.mimetype]) {
    cb(null, true);
  } else {
    cb(new Error('Недопустимый тип файла. Разрешены: JPG, PNG, GIF, WebP, PDF, DOC, DOCX'), false);
  }
};

// Фильтр файлов для изображений
const imageFileFilter = (req, file, cb) => {
  if (IMAGE_TYPES[file.mimetype]) {
    cb(null, true);
  } else {
    cb(new Error('Недопустимый тип файла. Разрешены: JPG, PNG, GIF, WebP'), false);
  }
};

// Создаем middleware для загрузки чеков
const uploadReceipt = multer({
  storage: receiptStorage,
  fileFilter: receiptFileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE
  }
}).single('receipt_file');

// Создаем middleware для загрузки изображений сборов
const uploadCampaignImage = multer({
  storage: campaignImageStorage,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE
  }
}).single('image_file');

// Обертка с обработкой ошибок для чеков
const handleReceiptUpload = (req, res, next) => {
  uploadReceipt(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'Файл слишком большой. Максимальный размер: 10MB' });
      }
      return res.status(400).json({ error: 'Ошибка загрузки файла: ' + err.message });
    } else if (err) {
      return res.status(400).json({ error: err.message });
    }
    next();
  });
};

// Обертка с обработкой ошибок для изображений сборов
const handleCampaignImageUpload = (req, res, next) => {
  uploadCampaignImage(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'Изображение слишком большое. Максимальный размер: 10MB' });
      }
      return res.status(400).json({ error: 'Ошибка загрузки изображения: ' + err.message });
    } else if (err) {
      return res.status(400).json({ error: err.message });
    }
    next();
  });
};

module.exports = { handleReceiptUpload, handleCampaignImageUpload };
