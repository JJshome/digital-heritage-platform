/**
 * AI Service for Digital Heritage Management Platform
 * 
 * This service provides interfaces to the AI subsystem for analyzing digital assets,
 * classifying content, detecting sentiment, and identifying important information.
 * 
 * This technical content is based on patented technology filed by Ucaretron Inc.
 */

const axios = require('axios');
const path = require('path');
const fs = require('fs');
const FormData = require('form-data');
const config = require('config');
const mimeTypes = require('mime-types');

// Configuration
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || config.get('aiService.url');
const AI_SERVICE_TIMEOUT = process.env.AI_SERVICE_TIMEOUT || config.get('aiService.timeout') || 30000;
const ENABLE_LOCAL_FALLBACK = process.env.ENABLE_LOCAL_FALLBACK || config.get('aiService.enableLocalFallback') || true;

// Client for AI service
const aiClient = axios.create({
  baseURL: AI_SERVICE_URL,
  timeout: AI_SERVICE_TIMEOUT,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Local fallback models
let textClassifier = null;
let imageClassifier = null;
let sentimentAnalyzer = null;

/**
 * Initialize local fallback models if enabled
 */
async function initLocalModels() {
  if (!ENABLE_LOCAL_FALLBACK) return;
  
  try {
    const tf = require('@tensorflow/tfjs-node');
    
    // Load text classifier
    const textClassifierPath = path.join(__dirname, '../../ai/models/saved/text_classifier');
    if (fs.existsSync(textClassifierPath)) {
      textClassifier = await tf.loadLayersModel(`file://${textClassifierPath}/model.json`);
      console.log('Local text classifier loaded');
    }
    
    // Load image classifier
    const imageClassifierPath = path.join(__dirname, '../../ai/models/saved/image_classifier');
    if (fs.existsSync(imageClassifierPath)) {
      imageClassifier = await tf.loadLayersModel(`file://${imageClassifierPath}/model.json`);
      console.log('Local image classifier loaded');
    }
    
    // Load sentiment analyzer
    const sentimentAnalyzerPath = path.join(__dirname, '../../ai/models/saved/sentiment_analyzer');
    if (fs.existsSync(sentimentAnalyzerPath)) {
      sentimentAnalyzer = await tf.loadLayersModel(`file://${sentimentAnalyzerPath}/model.json`);
      console.log('Local sentiment analyzer loaded');
    }
  } catch (error) {
    console.error('Failed to load local models:', error.message);
  }
}

// Initialize local models
if (ENABLE_LOCAL_FALLBACK) {
  initLocalModels().catch(err => {
    console.error('Error initializing local models:', err.message);
  });
}

/**
 * Analyze asset content using AI services
 * @param {Object} assetInfo - Asset information
 * @returns {Promise<Object>} Analysis results
 */
async function analyzeAsset(assetInfo) {
  try {
    // Prepare request data
    const requestData = {
      fileName: assetInfo.fileName,
      fileType: assetInfo.fileType,
      mimeType: assetInfo.mimeType,
      fileSize: assetInfo.fileSize,
      description: assetInfo.description || '',
      content: assetInfo.content
    };
    
    // Send to AI service
    const response = await aiClient.post('/analyze', requestData);
    return response.data;
  } catch (error) {
    console.error('AI Service error:', error.message);
    
    // Try local fallback if enabled
    if (ENABLE_LOCAL_FALLBACK) {
      console.log('Attempting local fallback analysis');
      return localAnalysis(assetInfo);
    }
    
    // Re-throw if no fallback or fallback fails
    throw error;
  }
}

/**
 * Upload a file to the AI service for analysis
 * @param {string} filePath - Path to the file
 * @param {Object} metadata - Additional metadata
 * @returns {Promise<Object>} Analysis results
 */
async function analyzeFile(filePath, metadata = {}) {
  try {
    // Create form data
    const form = new FormData();
    form.append('file', fs.createReadStream(filePath));
    
    // Add metadata
    Object.keys(metadata).forEach(key => {
      form.append(key, metadata[key]);
    });
    
    // Send to AI service
    const response = await aiClient.post('/analyze/file', form, {
      headers: {
        ...form.getHeaders()
      }
    });
    
    return response.data;
  } catch (error) {
    console.error('AI File Analysis error:', error.message);
    
    // Try local fallback if enabled
    if (ENABLE_LOCAL_FALLBACK) {
      console.log('Attempting local fallback file analysis');
      
      // Read file and determine type
      const fileContent = fs.readFileSync(filePath);
      const mimeType = metadata.mimeType || mimeTypes.lookup(filePath) || '';
      
      // Call appropriate local analysis based on file type
      const fileInfo = {
        fileName: path.basename(filePath),
        fileType: path.extname(filePath).substring(1),
        mimeType: mimeType,
        fileSize: fileContent.length,
        description: metadata.description || '',
        content: fileContent.toString('base64')
      };
      
      return localAnalysis(fileInfo);
    }
    
    // Re-throw if no fallback or fallback fails
    throw error;
  }
}

/**
 * Local fallback analysis function
 * @param {Object} assetInfo - Asset information
 * @returns {Object} Analysis results
 */
function localAnalysis(assetInfo) {
  // Result object with default values
  const result = {
    category: null,
    subcategory: null,
    importance: 5,
    sentiment: 0,
    tags: [],
    entities: []
  };
  
  try {
    // Basic analysis based on file extension and mime type
    const fileType = assetInfo.fileType.toLowerCase();
    const mimeType = assetInfo.mimeType.toLowerCase();
    
    // Determine category based on file type
    if (['pdf', 'doc', 'docx', 'txt', 'rtf', 'odt'].includes(fileType)) {
      result.category = 'documents';
      
      // Further classify document type based on name/description
      const description = (assetInfo.description || '').toLowerCase();
      const fileName = (assetInfo.fileName || '').toLowerCase();
      
      if (/contract|agreement|legal|law|terms|conditions/.test(description + fileName)) {
        result.subcategory = '법적 문서';
        result.importance = 9;
      } else if (/financ|bank|tax|invoice|receipt|payment/.test(description + fileName)) {
        result.subcategory = '금융 문서';
        result.importance = 8;
      } else if (/medical|health|doctor|hospital|prescription/.test(description + fileName)) {
        result.subcategory = '의료 기록';
        result.importance = 9;
      } else if (/certificate|diploma|degree|education|school|grade/.test(description + fileName)) {
        result.subcategory = '학업 기록';
        result.importance = 7;
      } else {
        result.subcategory = '개인 문서';
        result.importance = 6;
      }
      
      // Extract potential tags from filename/description
      const words = (description + ' ' + fileName).toLowerCase()
        .replace(/[^\w\s가-힣]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length > 2);
      
      result.tags = [...new Set(words.slice(0, 5))];
    } 
    else if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'tiff', 'webp', 'heic'].includes(fileType)) {
      result.category = 'photos';
      
      // Use local image classifier if available
      if (imageClassifier) {
        // Image classification would be implemented here
        // This requires additional image processing code
      } else {
        // Basic classification based on filename/description
        const description = (assetInfo.description || '').toLowerCase();
        const fileName = (assetInfo.fileName || '').toLowerCase();
        
        if (/family|relatives|부모님|가족|친척/.test(description + fileName)) {
          result.subcategory = '가족 사진';
          result.importance = 9;
        } else if (/travel|trip|vacation|tour|여행|여름|휴가/.test(description + fileName)) {
          result.subcategory = '여행 사진';
          result.importance = 7;
        } else if (/wedding|marriage|ceremony|결혼|웨딩|예식/.test(description + fileName)) {
          result.subcategory = '결혼 사진';
          result.importance = 9;
        } else if (/graduation|graduate|diploma|졸업|학위/.test(description + fileName)) {
          result.subcategory = '졸업 사진';
          result.importance = 8;
        } else {
          result.subcategory = '일상 사진';
          result.importance = 5;
        }
      }
    }
    else if (['mp4', 'mov', 'avi', 'wmv', 'flv', 'mkv', 'webm', '3gp'].includes(fileType)) {
      result.category = 'videos';
      result.importance = 7; // Videos are generally important
      
      // Basic classification based on filename/description
      const description = (assetInfo.description || '').toLowerCase();
      const fileName = (assetInfo.fileName || '').toLowerCase();
      
      if (/family|relatives|부모님|가족|친척/.test(description + fileName)) {
        result.subcategory = '가족 영상';
        result.importance = 9;
      } else if (/wedding|marriage|ceremony|결혼|웨딩|예식/.test(description + fileName)) {
        result.subcategory = '결혼 영상';
        result.importance = 10;
      } else if (/travel|trip|vacation|tour|여행|여름|휴가/.test(description + fileName)) {
        result.subcategory = '여행 영상';
        result.importance = 7;
      } else {
        result.subcategory = '일상 영상';
        result.importance = 6;
      }
    }
    else if (['eml', 'msg'].includes(fileType) || mimeType.includes('message')) {
      result.category = 'emails';
      result.importance = 6;
      
      // Basic sentiment analysis
      const description = (assetInfo.description || '').toLowerCase();
      
      // Crude sentiment analysis based on keywords
      const positiveWords = ['good', 'great', 'excellent', 'happy', 'love', 'joy', '좋아', '행복', '감사'];
      const negativeWords = ['bad', 'poor', 'terrible', 'sad', 'hate', 'angry', '나쁜', '싫어', '화나'];
      
      let sentimentScore = 0;
      positiveWords.forEach(word => {
        if (description.includes(word)) sentimentScore += 0.2;
      });
      
      negativeWords.forEach(word => {
        if (description.includes(word)) sentimentScore -= 0.2;
      });
      
      // Clamp between -1 and 1
      result.sentiment = Math.max(-1, Math.min(1, sentimentScore));
    }
    else if (['xls', 'xlsx', 'csv', 'pdf', 'doc'].includes(fileType) && 
             /financ|bank|tax|invoice|receipt|payment|crypto/.test((assetInfo.description || '') + (assetInfo.fileName || ''))) {
      result.category = 'financialAssets';
      result.importance = 8;
      
      // Further classify financial documents
      const description = (assetInfo.description || '').toLowerCase();
      const fileName = (assetInfo.fileName || '').toLowerCase();
      
      if (/tax|세금|국세/.test(description + fileName)) {
        result.subcategory = '세금 문서';
        result.importance = 9;
      } else if (/bank|통장|계좌|은행/.test(description + fileName)) {
        result.subcategory = '은행 계좌';
        result.importance = 8;
      } else if (/investment|invest|stock|주식|투자/.test(description + fileName)) {
        result.subcategory = '투자 자산';
        result.importance = 8;
      } else if (/crypto|bitcoin|ethereum|비트코인|이더리움|코인/.test(description + fileName)) {
        result.subcategory = '암호화폐';
        result.importance = 9;
      } else {
        result.subcategory = '금융 문서';
        result.importance = 7;
      }
    }
    else if (['psd', 'ai', 'svg', 'eps', 'indd', 'mp3', 'wav', 'html', 'css', 'js'].includes(fileType)) {
      result.category = 'digitalCreations';
      result.importance = 7;
      
      // Classify digital creations
      if (['mp3', 'wav', 'ogg', 'flac', 'm4a'].includes(fileType)) {
        result.subcategory = '음악 작품';
      } else if (['psd', 'ai', 'svg', 'eps'].includes(fileType)) {
        result.subcategory = '디자인 작업';
      } else if (['html', 'css', 'js', 'php', 'py', 'java'].includes(fileType)) {
        result.subcategory = '소프트웨어 개발';
      } else {
        result.subcategory = '창작물';
      }
    }
    else if (['key', 'pem', 'cert', 'p12', 'pfx', 'jks', 'keystore'].includes(fileType)) {
      result.category = 'credentials';
      result.importance = 10; // Security credentials are highly important
      result.subcategory = '인증서';
    }
    else {
      // Default categorization
      result.category = 'other';
      result.subcategory = '기타 문서';
      result.importance = 5;
    }
    
    // Basic sentiment analysis for description
    if (sentimentAnalyzer && assetInfo.description) {
      // More sophisticated sentiment analysis would be implemented here
      // This is just a placeholder for the local model
    }
    
    return result;
  } catch (error) {
    console.error('Local analysis error:', error.message);
    return result;
  }
}

/**
 * Analyze inheritance preferences of a user based on their asset history
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Recommendations for inheritance settings
 */
async function analyzeInheritancePreferences(userId) {
  try {
    const response = await aiClient.post('/analyze/inheritance-preferences', { userId });
    return response.data;
  } catch (error) {
    console.error('AI inheritance analysis error:', error.message);
    
    // Return basic recommendations as fallback
    return {
      suggestedBeneficiaries: [],
      assetCategoryPreferences: {
        documents: { accessCondition: 'immediate' },
        photos: { accessCondition: 'immediate' },
        videos: { accessCondition: 'immediate' },
        emails: { accessCondition: 'delayed', delayPeriod: 30 },
        financialAssets: { accessCondition: 'conditional' },
        digitalCreations: { accessCondition: 'immediate' },
        socialMedia: { accessCondition: 'delayed', delayPeriod: 15 },
        credentials: { accessCondition: 'conditional' }
      },
      confidence: 0.5 // Low confidence for fallback
    };
  }
}

/**
 * Analyze the relationship between two users based on their digital interactions
 * @param {string} userId1 - First user ID
 * @param {string} userId2 - Second user ID
 * @returns {Promise<Object>} Relationship analysis
 */
async function analyzeRelationship(userId1, userId2) {
  try {
    const response = await aiClient.post('/analyze/relationship', { 
      userId1, 
      userId2 
    });
    
    return response.data;
  } catch (error) {
    console.error('AI relationship analysis error:', error.message);
    
    // Return basic analysis as fallback
    return {
      relationshipStrength: 0.5, // Medium strength as default
      interactionFrequency: 'unknown',
      relationshipType: 'unknown',
      confidence: 0.3, // Low confidence for fallback
      suggestedAssetSharing: []
    };
  }
}

/**
 * Generate a summary of a user's digital assets
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Asset summary
 */
async function generateAssetSummary(userId) {
  try {
    const response = await aiClient.post('/generate/asset-summary', { userId });
    return response.data;
  } catch (error) {
    console.error('AI asset summary generation error:', error.message);
    throw error;
  }
}

module.exports = {
  analyzeAsset,
  analyzeFile,
  analyzeInheritancePreferences,
  analyzeRelationship,
  generateAssetSummary
};
