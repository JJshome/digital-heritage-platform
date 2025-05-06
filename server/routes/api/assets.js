/**
 * Digital Asset API Routes
 * 
 * This module provides API endpoints for managing digital assets in the
 * Digital Heritage Management Platform.
 * 
 * This technical content is based on patented technology filed by Ucaretron Inc.
 */

const express = require('express');
const router = express.Router();
const { check, validationResult } = require('express-validator');
const auth = require('../../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const Asset = require('../../models/Asset');
const User = require('../../models/User');

// AI service client
const aiClient = require('../../services/aiService');

// IPFS client for decentralized storage
const ipfsClient = require('../../services/ipfsService');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../../../uploads/temp');
    // Ensure directory exists
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Create a unique filename with original extension
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB file size limit
  fileFilter: function(req, file, cb) {
    // Validate file types
    const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|xls|xlsx|ppt|pptx|txt|mp3|mp4|mov|avi|zip|rar/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (extname && mimetype) {
      return cb(null, true);
    } else {
      cb(new Error('File type not supported'));
    }
  }
});

/**
 * @route   GET api/assets
 * @desc    Get all assets for a user with optional filtering
 * @access  Private
 */
router.get('/', auth, async (req, res) => {
  try {
    const { category, importance, searchTerm, sortBy, page = 1, limit = 20 } = req.query;
    
    // Build query filter
    const filter = { user: req.user.id };
    
    if (category) {
      filter.category = category;
    }
    
    if (importance) {
      filter.importance = { $gte: parseInt(importance) };
    }
    
    if (searchTerm) {
      filter.$or = [
        { name: { $regex: searchTerm, $options: 'i' } },
        { description: { $regex: searchTerm, $options: 'i' } },
        { tags: { $in: [new RegExp(searchTerm, 'i')] } }
      ];
    }
    
    // Build sort options
    let sort = {};
    if (sortBy) {
      const [field, order] = sortBy.split(':');
      sort[field] = order === 'desc' ? -1 : 1;
    } else {
      sort = { createdAt: -1 }; // Default sort by newest
    }
    
    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Execute query with pagination
    const assets = await Asset.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .populate('beneficiaries.beneficiary', 'name email');
    
    // Get total count for pagination info
    const total = await Asset.countDocuments(filter);
    
    res.json({
      assets,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (err) {
    console.error('Error fetching assets', err.message);
    res.status(500).json({ msg: 'Server error' });
  }
});

/**
 * @route   GET api/assets/:id
 * @desc    Get asset by ID
 * @access  Private
 */
router.get('/:id', auth, async (req, res) => {
  try {
    const asset = await Asset.findById(req.params.id)
      .populate('beneficiaries.beneficiary', 'name email');
    
    if (!asset) {
      return res.status(404).json({ msg: 'Asset not found' });
    }
    
    // Check if asset belongs to user
    if (asset.user.toString() !== req.user.id) {
      return res.status(403).json({ msg: 'Not authorized to access this asset' });
    }
    
    res.json(asset);
  } catch (err) {
    console.error('Error fetching asset', err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Asset not found' });
    }
    res.status(500).json({ msg: 'Server error' });
  }
});

/**
 * @route   POST api/assets
 * @desc    Create a new digital asset
 * @access  Private
 */
router.post('/', [
  auth,
  upload.single('file'),
  [
    check('name', 'Name is required').not().isEmpty(),
    check('category', 'Category is required').not().isEmpty(),
  ]
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  
  try {
    const {
      name,
      description,
      category,
      subcategory,
      tags,
      importance,
      isEncrypted,
      beneficiaries
    } = req.body;
    
    // Initialize new asset object
    const assetData = {
      user: req.user.id,
      name,
      description,
      category,
      subcategory,
      tags: tags ? tags.split(',').map(tag => tag.trim()) : [],
      importance: importance || 5, // Default importance if not specified
      isEncrypted: isEncrypted === 'true'
    };
    
    // Handle file upload if present
    if (req.file) {
      const file = req.file;
      
      // Store file metadata
      assetData.fileType = path.extname(file.originalname).substring(1);
      assetData.mimeType = file.mimetype;
      assetData.fileSize = file.size;
      assetData.originalFilename = file.originalname;
      
      // Upload to IPFS for decentralized storage
      try {
        const ipfsHash = await ipfsClient.add(fs.readFileSync(file.path));
        assetData.ipfsHash = ipfsHash;
        assetData.storageLocation = {
          type: 'ipfs',
          path: ipfsHash
        };
        
        // Remove temporary file after upload
        fs.unlinkSync(file.path);
      } catch (ipfsError) {
        console.error('IPFS upload failed, storing locally', ipfsError.message);
        
        // If IPFS fails, store locally as fallback
        const localStoragePath = path.join(__dirname, '../../../uploads/assets', req.user.id);
        if (!fs.existsSync(localStoragePath)) {
          fs.mkdirSync(localStoragePath, { recursive: true });
        }
        
        const localFilename = `${uuidv4()}${path.extname(file.originalname)}`;
        const targetPath = path.join(localStoragePath, localFilename);
        
        fs.copyFileSync(file.path, targetPath);
        fs.unlinkSync(file.path);
        
        assetData.storageLocation = {
          type: 'local',
          path: `/uploads/assets/${req.user.id}/${localFilename}`
        };
      }
      
      // Use AI to analyze the file content
      try {
        const aiAnalysis = await aiClient.analyzeAsset({
          fileName: file.originalname,
          fileType: assetData.fileType,
          fileSize: assetData.fileSize,
          mimeType: assetData.mimeType,
          description: description
        });
        
        // Update asset data with AI analysis results
        if (aiAnalysis) {
          if (!importance && aiAnalysis.importance) {
            assetData.importance = aiAnalysis.importance;
          }
          
          if (!category && aiAnalysis.category) {
            assetData.category = aiAnalysis.category;
          }
          
          if (!subcategory && aiAnalysis.subcategory) {
            assetData.subcategory = aiAnalysis.subcategory;
          }
          
          if (aiAnalysis.tags && aiAnalysis.tags.length > 0) {
            assetData.tags = [...new Set([...assetData.tags, ...aiAnalysis.tags])];
          }
          
          assetData.aiSentiment = aiAnalysis.sentiment;
          assetData.aiAnalysis = aiAnalysis;
        }
      } catch (aiError) {
        console.error('AI analysis failed', aiError.message);
        // Continue without AI analysis
      }
    }
    
    // Handle beneficiaries if specified
    if (beneficiaries) {
      try {
        const beneficiaryData = JSON.parse(beneficiaries);
        if (Array.isArray(beneficiaryData)) {
          assetData.beneficiaries = beneficiaryData.map(b => ({
            beneficiary: b.id,
            accessCondition: b.accessCondition || 'immediate',
            delayPeriod: b.delayPeriod || 0,
            conditions: b.conditions
          }));
        }
      } catch (parseError) {
        console.error('Failed to parse beneficiaries', parseError.message);
      }
    }
    
    // Save asset to database
    const asset = new Asset(assetData);
    await asset.save();
    
    res.json(asset);
  } catch (err) {
    console.error('Error creating asset', err.message);
    res.status(500).json({ msg: 'Server error' });
  }
});

/**
 * @route   PUT api/assets/:id
 * @desc    Update an existing digital asset
 * @access  Private
 */
router.put('/:id', [
  auth,
  upload.single('file'),
  [
    check('name', 'Name is required').optional()
  ]
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  
  try {
    let asset = await Asset.findById(req.params.id);
    
    if (!asset) {
      return res.status(404).json({ msg: 'Asset not found' });
    }
    
    // Check if asset belongs to user
    if (asset.user.toString() !== req.user.id) {
      return res.status(403).json({ msg: 'Not authorized to update this asset' });
    }
    
    // Extract update fields
    const {
      name,
      description,
      category,
      subcategory,
      tags,
      importance,
      isEncrypted,
      beneficiaries
    } = req.body;
    
    // Build update object
    const assetFields = {};
    if (name) assetFields.name = name;
    if (description) assetFields.description = description;
    if (category) assetFields.category = category;
    if (subcategory) assetFields.subcategory = subcategory;
    if (tags) assetFields.tags = tags.split(',').map(tag => tag.trim());
    if (importance) assetFields.importance = importance;
    if (isEncrypted !== undefined) assetFields.isEncrypted = isEncrypted === 'true';
    
    // Handle file upload if present
    if (req.file) {
      // Similar logic as in the POST route for file handling
      // ...
    }
    
    // Handle beneficiaries if specified
    if (beneficiaries) {
      try {
        const beneficiaryData = JSON.parse(beneficiaries);
        if (Array.isArray(beneficiaryData)) {
          assetFields.beneficiaries = beneficiaryData.map(b => ({
            beneficiary: b.id,
            accessCondition: b.accessCondition || 'immediate',
            delayPeriod: b.delayPeriod || 0,
            conditions: b.conditions
          }));
        }
      } catch (parseError) {
        console.error('Failed to parse beneficiaries', parseError.message);
      }
    }
    
    // Update asset
    asset = await Asset.findByIdAndUpdate(
      req.params.id,
      { $set: assetFields },
      { new: true }
    ).populate('beneficiaries.beneficiary', 'name email');
    
    res.json(asset);
  } catch (err) {
    console.error('Error updating asset', err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Asset not found' });
    }
    res.status(500).json({ msg: 'Server error' });
  }
});

/**
 * @route   DELETE api/assets/:id
 * @desc    Delete a digital asset
 * @access  Private
 */
router.delete('/:id', auth, async (req, res) => {
  try {
    const asset = await Asset.findById(req.params.id);
    
    if (!asset) {
      return res.status(404).json({ msg: 'Asset not found' });
    }
    
    // Check if asset belongs to user
    if (asset.user.toString() !== req.user.id) {
      return res.status(403).json({ msg: 'Not authorized to delete this asset' });
    }
    
    // Clean up associated file if it's stored locally
    if (asset.storageLocation && asset.storageLocation.type === 'local') {
      const filePath = path.join(__dirname, '..', '..', '..', asset.storageLocation.path);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
    
    // Delete asset from database
    await asset.remove();
    
    res.json({ msg: 'Asset removed' });
  } catch (err) {
    console.error('Error deleting asset', err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Asset not found' });
    }
    res.status(500).json({ msg: 'Server error' });
  }
});

/**
 * @route   POST api/assets/analyze
 * @desc    Analyze asset content without saving
 * @access  Private
 */
router.post('/analyze', [auth, upload.single('file')], async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ msg: 'No file uploaded' });
    }
    
    const file = req.file;
    
    // Use AI to analyze the file content
    const aiAnalysis = await aiClient.analyzeAsset({
      fileName: file.originalname,
      fileType: path.extname(file.originalname).substring(1),
      fileSize: file.size,
      mimeType: file.mimetype,
      description: req.body.description
    });
    
    // Clean up temp file
    fs.unlinkSync(file.path);
    
    res.json({
      analysis: aiAnalysis,
      fileInfo: {
        name: file.originalname,
        size: file.size,
        type: file.mimetype
      }
    });
  } catch (err) {
    console.error('Error analyzing asset', err.message);
    res.status(500).json({ msg: 'Server error' });
  }
});

/**
 * @route   POST api/assets/:id/tokenize
 * @desc    Tokenize an asset on the blockchain
 * @access  Private
 */
router.post('/:id/tokenize', auth, async (req, res) => {
  try {
    const asset = await Asset.findById(req.params.id);
    
    if (!asset) {
      return res.status(404).json({ msg: 'Asset not found' });
    }
    
    // Check if asset belongs to user
    if (asset.user.toString() !== req.user.id) {
      return res.status(403).json({ msg: 'Not authorized to tokenize this asset' });
    }
    
    // Check if already tokenized
    if (asset.blockchain && asset.blockchain.tokenId) {
      return res.status(400).json({ msg: 'Asset already tokenized' });
    }
    
    // Tokenize asset on blockchain
    const blockchainService = require('../../services/blockchainService');
    const tokenizationResult = await blockchainService.tokenizeAsset(asset);
    
    // Update asset with blockchain info
    asset.blockchain = {
      tokenId: tokenizationResult.tokenId,
      contract: tokenizationResult.contract,
      transactionHash: tokenizationResult.transactionHash,
      tokenURI: tokenizationResult.tokenURI,
      tokenizedAt: Date.now()
    };
    
    await asset.save();
    
    res.json({
      msg: 'Asset successfully tokenized',
      blockchain: asset.blockchain
    });
  } catch (err) {
    console.error('Error tokenizing asset', err.message);
    res.status(500).json({ msg: 'Server error' });
  }
});

module.exports = router;
