/**
 * Digital Asset Generator
 * 
 * This script generates virtual digital assets for testing and AI model training.
 * It creates synthetic data representing various types of digital assets that might
 * be managed by the Digital Heritage Management Platform.
 * 
 * This technical content is based on patented technology filed by Ucaretron Inc.
 */

const fs = require('fs');
const path = require('path');
const { faker } = require('@faker-js/faker/locale/ko');
const crypto = require('crypto');
const { generateUserProfiles } = require('./users');

// Ensure output directory exists
const OUTPUT_DIR = path.join(__dirname, '../virtual');
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Load existing users or generate new ones
let users = [];
const usersPath = path.join(OUTPUT_DIR, 'users.json');

if (fs.existsSync(usersPath)) {
  users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
  console.log(`Loaded ${users.length} users from ${usersPath}`);
} else {
  console.log('No existing users found. Generating new user profiles...');
  users = generateUserProfiles(50);
  fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
  console.log(`Generated ${users.length} users and saved to ${usersPath}`);
}

/**
 * Generate asset categories with subcategories
 * @returns {Object} - Object containing asset categories and subcategories
 */
function generateAssetCategories() {
  return {
    documents: {
      name: '문서',
      subcategories: [
        { name: '개인 문서', importance: 9 },
        { name: '금융 문서', importance: 8 },
        { name: '법적 문서', importance: 10 },
        { name: '의료 기록', importance: 9 },
        { name: '학업 기록', importance: 7 },
        { name: '비즈니스 문서', importance: 8 },
        { name: '매뉴얼', importance: 5 },
        { name: '편지', importance: 6 },
        { name: '영수증', importance: 4 }
      ]
    },
    photos: {
      name: '사진',
      subcategories: [
        { name: '가족 사진', importance: 9 },
        { name: '여행 사진', importance: 7 },
        { name: '이벤트 사진', importance: 8 },
        { name: '스냅샷', importance: 5 },
        { name: '기념일 사진', importance: 8 },
        { name: '예술 작품', importance: 6 },
        { name: '풍경 사진', importance: 5 },
        { name: '졸업 사진', importance: 7 },
        { name: '결혼 사진', importance: 9 }
      ]
    },
    videos: {
      name: '동영상',
      subcategories: [
        { name: '가족 영상', importance: 9 },
        { name: '여행 영상', importance: 7 },
        { name: '이벤트 영상', importance: 8 },
        { name: '학교 행사', importance: 7 },
        { name: '결혼식 영상', importance: 10 },
        { name: '졸업식 영상', importance: 8 },
        { name: '취미 영상', importance: 5 },
        { name: '반려동물 영상', importance: 6 },
        { name: '자녀 성장 기록', importance: 9 }
      ]
    },
    emails: {
      name: '이메일',
      subcategories: [
        { name: '개인 서신', importance: 8 },
        { name: '사업 서신', importance: 7 },
        { name: '법적 커뮤니케이션', importance: 9 },
        { name: '가족 서신', importance: 8 },
        { name: '구독 메일', importance: 3 },
        { name: '뉴스레터', importance: 4 },
        { name: '계정 정보', importance: 6 },
        { name: '온라인 거래', importance: 7 },
        { name: '중요 공지', importance: 8 }
      ]
    },
    financialAssets: {
      name: '금융 자산',
      subcategories: [
        { name: '은행 계좌', importance: 10 },
        { name: '주식 투자', importance: 9 },
        { name: '암호화폐', importance: 8 },
        { name: '펀드', importance: 7 },
        { name: '보험', importance: 9 },
        { name: '부동산 서류', importance: 10 },
        { name: '대출 정보', importance: 8 },
        { name: '세금 문서', importance: 9 },
        { name: '디지털 결제 계정', importance: 7 }
      ]
    },
    digitalCreations: {
      name: '디지털 창작물',
      subcategories: [
        { name: '작성 문서', importance: 7 },
        { name: '디자인 작업', importance: 8 },
        { name: '음악 작품', importance: 7 },
        { name: '소프트웨어 개발', importance: 8 },
        { name: '블로그 포스트', importance: 6 },
        { name: '웹사이트', importance: 7 },
        { name: '디지털 아트', importance: 7 },
        { name: 'NFT', importance: 6 },
        { name: '게임 자산', importance: 5 }
      ]
    },
    socialMedia: {
      name: '소셜 미디어',
      subcategories: [
        { name: '프로필', importance: 6 },
        { name: '포스트', importance: 5 },
        { name: '사진 앨범', importance: 7 },
        { name: '친구 목록', importance: 4 },
        { name: '메시지', importance: 7 },
        { name: '이벤트', importance: 5 },
        { name: '그룹', importance: 4 },
        { name: '페이지', importance: 5 },
        { name: '연락처', importance: 6 }
      ]
    },
    credentials: {
      name: '자격 증명',
      subcategories: [
        { name: '계정 비밀번호', importance: 10 },
        { name: '인증서', importance: 9 },
        { name: '라이센스 키', importance: 8 },
        { name: '디지털 서명', importance: 9 },
        { name: '보안 질문 답변', importance: 8 },
        { name: '인증 앱', importance: 7 },
        { name: 'API 키', importance: 8 },
        { name: 'VPN 접속 정보', importance: 7 },
        { name: '생체 인증 정보', importance: 9 }
      ]
    }
  };
}

/**
 * Generate file extensions and MIME types based on asset category
 * @param {string} category - Asset category
 * @returns {Object} - Object with file extension and MIME type
 */
function getFileProperties(category) {
  const extensions = {
    documents: ['pdf', 'docx', 'xlsx', 'pptx', 'txt', 'hwp', 'odt', 'pages', 'md'],
    photos: ['jpg', 'png', 'heic', 'webp', 'gif', 'raw', 'tiff', 'bmp', 'svg'],
    videos: ['mp4', 'mov', 'avi', 'wmv', 'flv', 'mkv', 'webm', '3gp', 'm4v'],
    emails: ['eml', 'msg', 'html', 'txt'],
    financialAssets: ['pdf', 'xlsx', 'csv', 'json', 'txt'],
    digitalCreations: ['psd', 'ai', 'indd', 'mp3', 'wav', 'ogg', 'html', 'css', 'js'],
    socialMedia: ['jpg', 'png', 'mp4', 'gif', 'txt', 'html', 'json'],
    credentials: ['key', 'cert', 'pem', 'keystore', 'jks', 'p12', 'pfx', 'txt', 'json']
  };
  
  const mimeTypes = {
    pdf: 'application/pdf',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    txt: 'text/plain',
    hwp: 'application/x-hwp',
    odt: 'application/vnd.oasis.opendocument.text',
    pages: 'application/vnd.apple.pages',
    md: 'text/markdown',
    jpg: 'image/jpeg',
    png: 'image/png',
    heic: 'image/heic',
    webp: 'image/webp',
    gif: 'image/gif',
    raw: 'image/raw',
    tiff: 'image/tiff',
    bmp: 'image/bmp',
    svg: 'image/svg+xml',
    mp4: 'video/mp4',
    mov: 'video/quicktime',
    avi: 'video/x-msvideo',
    wmv: 'video/x-ms-wmv',
    flv: 'video/x-flv',
    mkv: 'video/x-matroska',
    webm: 'video/webm',
    '3gp': 'video/3gpp',
    'm4v': 'video/x-m4v',
    eml: 'message/rfc822',
    msg: 'application/vnd.ms-outlook',
    html: 'text/html',
    csv: 'text/csv',
    json: 'application/json',
    psd: 'application/vnd.adobe.photoshop',
    ai: 'application/postscript',
    indd: 'application/x-indesign',
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    ogg: 'audio/ogg',
    css: 'text/css',
    js: 'application/javascript',
    key: 'application/x-pem-file',
    cert: 'application/x-x509-ca-cert',
    pem: 'application/x-pem-file',
    keystore: 'application/octet-stream',
    jks: 'application/octet-stream',
    p12: 'application/x-pkcs12',
    pfx: 'application/x-pkcs12'
  };
  
  const ext = extensions[category][Math.floor(Math.random() * extensions[category].length)];
  return {
    extension: ext,
    mimeType: mimeTypes[ext] || 'application/octet-stream'
  };
}

/**
 * Generate a storage location for an asset
 * @param {Object} user - User profile
 * @returns {Object} - Storage location information
 */
function generateStorageLocation(user) {
  const storageTypes = [
    'local_drive', 'cloud_storage', 'email_attachment', 
    'social_media', 'external_drive', 'backup_service'
  ];
  
  const storageType = storageTypes[Math.floor(Math.random() * storageTypes.length)];
  let storagePath, storageService, storageAccount;
  
  switch (storageType) {
    case 'local_drive':
      storagePath = `/Users/${user.firstName}/Documents/`;
      // Add random path elements
      const folderTypes = ['Photos', 'Documents', 'Videos', 'Downloads', 'Desktop', 'Archive'];
      const yearFolders = ['2020', '2021', '2022', '2023', '2024'];
      
      if (Math.random() > 0.5) {
        storagePath += folderTypes[Math.floor(Math.random() * folderTypes.length)] + '/';
      }
      
      if (Math.random() > 0.7) {
        storagePath += yearFolders[Math.floor(Math.random() * yearFolders.length)] + '/';
      }
      
      if (Math.random() > 0.8) {
        storagePath += faker.lorem.word() + '/';
      }
      break;
      
    case 'cloud_storage':
      const cloudServices = [
        'Google Drive', 'Dropbox', 'OneDrive', 'iCloud', 
        'Naver Cloud', 'Kakao Drive', 'AWS S3'
      ];
      storageService = cloudServices[Math.floor(Math.random() * cloudServices.length)];
      storageAccount = user.email;
      storagePath = `/`;
      
      // Add random path elements
      const cloudFolders = ['Personal', 'Work', 'Backup', 'Shared', 'Family', 'Projects'];
      
      if (Math.random() > 0.3) {
        storagePath += cloudFolders[Math.floor(Math.random() * cloudFolders.length)] + '/';
      }
      
      if (Math.random() > 0.6) {
        storagePath += faker.lorem.word() + '/';
      }
      break;
      
    case 'email_attachment':
      const emailServices = ['Gmail', 'Outlook', 'Naver Mail', 'Daum Mail', 'Yahoo Mail'];
      storageService = emailServices[Math.floor(Math.random() * emailServices.length)];
      storageAccount = user.email;
      storagePath = `/Inbox`;
      
      // Add random folder
      if (Math.random() > 0.6) {
        const emailFolders = ['Work', 'Personal', 'Family', 'Finance', 'Travel', 'Projects', 'Archive'];
        storagePath = `/${emailFolders[Math.floor(Math.random() * emailFolders.length)]}`;
      }
      break;
      
    case 'social_media':
      const socialPlatforms = ['Facebook', 'Instagram', 'Twitter', 'LinkedIn', 'Kakao'];
      storageService = socialPlatforms[Math.floor(Math.random() * socialPlatforms.length)];
      storageAccount = faker.internet.userName(user.firstName, user.lastName);
      storagePath = `/profile`;
      
      // Add random location
      if (Math.random() > 0.5) {
        const socialLocations = ['photos', 'albums', 'posts', 'messages', 'saved'];
        storagePath = `/${socialLocations[Math.floor(Math.random() * socialLocations.length)]}`;
      }
      break;
      
    case 'external_drive':
      const driveTypes = ['USB Drive', 'External HDD', 'External SSD', 'Memory Card', 'NAS'];
      storageService = driveTypes[Math.floor(Math.random() * driveTypes.length)];
      storagePath = `/`;
      
      // Add random folders
      if (Math.random() > 0.4) {
        const externalFolders = ['Backup', 'Archive', 'Media', 'Documents', 'Photos', 'Videos'];
        storagePath += externalFolders[Math.floor(Math.random() * externalFolders.length)] + '/';
      }
      
      if (Math.random() > 0.7) {
        storagePath += faker.lorem.word() + '/';
      }
      break;
      
    case 'backup_service':
      const backupServices = ['Backblaze', 'Carbonite', 'IDrive', 'Acronis', 'Time Machine', 'Windows Backup'];
      storageService = backupServices[Math.floor(Math.random() * backupServices.length)];
      storagePath = `/Backups/${faker.date.past().getFullYear()}-${String(faker.date.past().getMonth() + 1).padStart(2, '0')}-${String(faker.date.past().getDate()).padStart(2, '0')}`;
      break;
  }
  
  return {
    storageType,
    ...(storageService && { storageService }),
    ...(storageAccount && { storageAccount }),
    storagePath
  };
}

/**
 * Generate a single digital asset
 * @param {Object} user - User profile
 * @param {Object} categories - Asset categories
 * @returns {Object} - Digital asset object
 */
function generateDigitalAsset(user, categories) {
  // Choose a random category and subcategory
  const categoryKeys = Object.keys(categories);
  const categoryKey = categoryKeys[Math.floor(Math.random() * categoryKeys.length)];
  const category = categories[categoryKey];
  
  const subcategory = category.subcategories[Math.floor(Math.random() * category.subcategories.length)];
  
  // Generate file properties
  const { extension, mimeType } = getFileProperties(categoryKey);
  
  // Generate timestamps
  const creationDate = faker.date.past({ years: 5 });
  const modificationDate = new Date(creationDate.getTime() + Math.random() * (Date.now() - creationDate.getTime()));
  
  // Generate storage location
  const storageLocation = generateStorageLocation(user);
  
  // Generate file size (0.1 MB to 1 GB)
  const fileSize = Math.floor(Math.random() * 1024 * 10) / 10 + 0.1;
  
  // Determine file size unit
  let fileSizeUnit = 'MB';
  if (fileSize > 100 || categoryKey === 'videos') {
    fileSizeUnit = 'MB';
    if (Math.random() > 0.7) {
      fileSizeUnit = 'GB';
    }
  } else if (fileSize < 1 && categoryKey === 'documents') {
    fileSizeUnit = 'KB';
  }
  
  // Calculate sentiment value (-1 to 1)
  const sentiment = (Math.random() * 2 - 1).toFixed(2);
  
  // Generate sharing information
  const isShared = Math.random() > 0.7;
  const sharedWith = isShared ? 
    Array.from({ length: Math.floor(Math.random() * 3) + 1 }).map(() => {
      return {
        name: faker.person.fullName(),
        email: faker.internet.email(),
        shareDate: faker.date.recent({ days: 180 }),
        permissions: ['view', 'edit', 'comment', 'share'][Math.floor(Math.random() * 4)]
      };
    }) : [];
  
  // Generate asset
  return {
    id: crypto.randomUUID(),
    userId: user.id,
    name: faker.lorem.words(Math.floor(Math.random() * 4) + 1).replace(/\b\w/g, l => l.toUpperCase()) + '.' + extension,
    description: Math.random() > 0.7 ? faker.lorem.sentence() : null,
    category: categoryKey,
    categoryName: category.name,
    subcategory: subcategory.name,
    fileType: extension,
    mimeType,
    fileSize: parseFloat(fileSize.toFixed(2)),
    fileSizeUnit,
    creationDate,
    modificationDate,
    lastAccessDate: faker.date.recent({ days: 90 }),
    storageLocation,
    creatorSoftware: Math.random() > 0.7 ? faker.company.name() + ' ' + faker.commerce.productName() : null,
    tags: Math.random() > 0.5 ? 
      Array.from({ length: Math.floor(Math.random() * 5) + 1 }).map(() => faker.lorem.word()) : [],
    importance: subcategory.importance * (Math.random() * 0.4 + 0.8), // Vary by ±20%
    sentiment: parseFloat(sentiment),
    isEncrypted: Math.random() > 0.9,
    isShared,
    sharedWith,
    inheritancePlan: {
      includeInEstate: Math.random() > 0.2, // 80% included
      beneficiaries: user.familyMembers
        .filter(() => Math.random() > 0.7) // Randomly select some beneficiaries
        .map(member => ({
          id: member.id,
          name: member.firstName + ' ' + member.lastName,
          relationship: member.relationshipType
        })),
      accessConditions: Math.random() > 0.8 ? 
        ['immediate', 'delayed', 'conditional'][Math.floor(Math.random() * 3)] : 'immediate',
      specialInstructions: Math.random() > 0.9 ? faker.lorem.sentence() : null
    }
  };
}

/**
 * Generate multiple digital assets for all users
 * @param {Array} users - Array of user profiles
 * @param {number} avgAssetsPerUser - Average number of assets per user
 * @returns {Array} - Array of digital assets
 */
function generateDigitalAssets(users, avgAssetsPerUser = 50) {
  const categories = generateAssetCategories();
  const assets = [];
  
  for (const user of users) {
    // Determine number of assets for this user (normal distribution around average)
    const standardDeviation = avgAssetsPerUser * 0.3;
    let assetCount = Math.round(
      avgAssetsPerUser + (standardDeviation * (Math.random() + Math.random() + Math.random() - 1.5))
    );
    assetCount = Math.max(5, assetCount); // At least 5 assets per user
    
    console.log(`Generating ${assetCount} assets for user ${user.firstName} ${user.lastName}...`);
    
    for (let i = 0; i < assetCount; i++) {
      assets.push(generateDigitalAsset(user, categories));
    }
  }
  
  return assets;
}

// Generate assets
const avgAssetsPerUser = process.argv[2] ? parseInt(process.argv[2]) : 50;
console.log(`Generating digital assets for ${users.length} users (avg. ${avgAssetsPerUser} per user)...`);
const assets = generateDigitalAssets(users, avgAssetsPerUser);

// Write to JSON file
const outputPath = path.join(OUTPUT_DIR, 'assets.json');
fs.writeFileSync(outputPath, JSON.stringify(assets, null, 2));
console.log(`Generated ${assets.length} digital assets successfully.`);
console.log(`Output saved to: ${outputPath}`);

module.exports = {
  generateDigitalAsset,
  generateDigitalAssets
};
