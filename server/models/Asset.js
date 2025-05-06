/**
 * Digital Asset Model
 * 
 * This model defines the schema for digital assets managed by the 
 * Digital Heritage Management Platform.
 * 
 * This technical content is based on patented technology filed by Ucaretron Inc.
 */

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

/**
 * Digital Asset Schema
 */
const AssetSchema = new Schema({
  // User reference
  user: {
    type: Schema.Types.ObjectId,
    ref: 'user',
    required: true
  },
  
  // Basic asset information
  name: {
    type: String,
    required: true
  },
  description: {
    type: String
  },
  
  // Asset categorization
  category: {
    type: String,
    required: true,
    enum: [
      'documents', 
      'photos', 
      'videos', 
      'emails', 
      'financialAssets',
      'digitalCreations',
      'socialMedia',
      'credentials',
      'other'
    ]
  },
  subcategory: {
    type: String
  },
  tags: [String],
  
  // File metadata
  fileType: String,
  mimeType: String,
  fileSize: Number,
  fileSizeUnit: {
    type: String,
    enum: ['B', 'KB', 'MB', 'GB'],
    default: 'KB'
  },
  originalFilename: String,
  creatorSoftware: String,
  
  // Storage location
  storageLocation: {
    type: {
      type: String,
      enum: ['local', 'ipfs', 'cloud', 'blockchain', 'external']
    },
    service: String,
    account: String,
    path: String,
    url: String
  },
  ipfsHash: String,
  
  // Asset importance and analysis
  importance: {
    type: Number,
    min: 1,
    max: 10,
    default: 5
  },
  sentiment: {
    type: Number,
    min: -1,
    max: 1
  },
  aiSentiment: {
    type: Number,
    min: -1,
    max: 1
  },
  aiAnalysis: {
    category: String,
    subcategory: String,
    importance: Number,
    tags: [String],
    sentiment: Number,
    entities: [Object],
    content: Object
  },
  
  // Security settings
  isEncrypted: {
    type: Boolean,
    default: false
  },
  accessControl: {
    type: String,
    enum: ['private', 'shared', 'protected', 'public'],
    default: 'private'
  },
  
  // Inheritance settings
  inheritancePlan: {
    includeInEstate: {
      type: Boolean,
      default: true
    },
    accessCondition: {
      type: String,
      enum: ['immediate', 'delayed', 'conditional', 'staged'],
      default: 'immediate'
    },
    delayPeriod: Number, // In days
    conditions: String,
    specialInstructions: String
  },
  
  // Beneficiaries
  beneficiaries: [
    {
      beneficiary: {
        type: Schema.Types.ObjectId,
        ref: 'user'
      },
      accessCondition: {
        type: String,
        enum: ['immediate', 'delayed', 'conditional', 'staged'],
        default: 'immediate'
      },
      delayPeriod: {
        type: Number,
        default: 0
      },
      conditions: String
    }
  ],
  
  // Sharing settings
  sharedWith: [
    {
      user: {
        type: Schema.Types.ObjectId,
        ref: 'user'
      },
      email: String,
      name: String,
      shareDate: {
        type: Date,
        default: Date.now
      },
      permissions: {
        type: String,
        enum: ['view', 'edit', 'comment', 'transfer'],
        default: 'view'
      },
      accessExpiration: Date
    }
  ],
  
  // Blockchain integration
  blockchain: {
    tokenId: String,
    contract: String,
    transactionHash: String,
    tokenURI: String,
    tokenizedAt: Date
  },
  
  // Versioning
  version: {
    type: Number,
    default: 1
  },
  previousVersions: [
    {
      version: Number,
      changes: String,
      changedAt: Date,
      changedBy: {
        type: Schema.Types.ObjectId,
        ref: 'user'
      }
    }
  ],
  
  // Usage tracking
  viewCount: {
    type: Number,
    default: 0
  },
  lastAccessed: Date,
  
  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Index for faster queries
AssetSchema.index({ user: 1, category: 1 });
AssetSchema.index({ user: 1, importance: -1 });
AssetSchema.index({ user: 1, 'beneficiaries.beneficiary': 1 });
AssetSchema.index({ tags: 1 });
AssetSchema.index({ name: 'text', description: 'text', tags: 'text' });

// Pre-save middleware to update 'updatedAt'
AssetSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Virtual for full file size
AssetSchema.virtual('fullFileSize').get(function() {
  if (!this.fileSize || !this.fileSizeUnit) {
    return null;
  }
  
  let bytes = this.fileSize;
  switch (this.fileSizeUnit) {
    case 'GB':
      bytes *= 1024 * 1024 * 1024;
      break;
    case 'MB':
      bytes *= 1024 * 1024;
      break;
    case 'KB':
      bytes *= 1024;
      break;
  }
  
  return bytes;
});

// Method to create a new version
AssetSchema.methods.createNewVersion = function(changes, userId) {
  // Add current state to previous versions
  this.previousVersions.push({
    version: this.version,
    changes: changes,
    changedAt: Date.now(),
    changedBy: userId
  });
  
  // Increment version number
  this.version += 1;
  
  return this;
};

// Method to add a view count
AssetSchema.methods.recordView = function() {
  this.viewCount += 1;
  this.lastAccessed = Date.now();
  return this;
};

// Method to share with another user
AssetSchema.methods.shareWith = function(user, permissions = 'view', expirationDays = null) {
  // Check if already shared
  const existingShare = this.sharedWith.find(
    share => share.user.toString() === user._id.toString()
  );
  
  if (existingShare) {
    // Update existing share
    existingShare.permissions = permissions;
    existingShare.shareDate = Date.now();
    if (expirationDays) {
      existingShare.accessExpiration = new Date(Date.now() + expirationDays * 24 * 60 * 60 * 1000);
    } else {
      existingShare.accessExpiration = null;
    }
  } else {
    // Create new share
    let expiration = null;
    if (expirationDays) {
      expiration = new Date(Date.now() + expirationDays * 24 * 60 * 60 * 1000);
    }
    
    this.sharedWith.push({
      user: user._id,
      email: user.email,
      name: user.name,
      shareDate: Date.now(),
      permissions: permissions,
      accessExpiration: expiration
    });
  }
  
  return this;
};

// Method to check if asset is shared with a specific user
AssetSchema.methods.isSharedWith = function(userId) {
  return this.sharedWith.some(share => 
    share.user.toString() === userId.toString() && 
    (!share.accessExpiration || new Date(share.accessExpiration) > new Date())
  );
};

// Static method to find assets shared with a user
AssetSchema.statics.findSharedWithUser = function(userId) {
  return this.find({
    'sharedWith.user': userId,
    $or: [
      { 'sharedWith.accessExpiration': null },
      { 'sharedWith.accessExpiration': { $gt: new Date() } }
    ]
  });
};

module.exports = Asset = mongoose.model('asset', AssetSchema);
