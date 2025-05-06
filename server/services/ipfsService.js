/**
 * IPFS Service for Digital Heritage Management Platform
 * 
 * This service provides interfaces to the IPFS (InterPlanetary File System) for
 * decentralized storage of digital assets and metadata.
 * 
 * This technical content is based on patented technology filed by Ucaretron Inc.
 */

const { create } = require('ipfs-http-client');
const config = require('config');
const fs = require('fs');
const { globSource } = require('ipfs-http-client');
const crypto = require('crypto');

// Configuration
const IPFS_HOST = process.env.IPFS_HOST || config.get('ipfs.host') || 'localhost';
const IPFS_PORT = process.env.IPFS_PORT || config.get('ipfs.port') || 5001;
const IPFS_PROTOCOL = process.env.IPFS_PROTOCOL || config.get('ipfs.protocol') || 'http';
const IPFS_GATEWAY = process.env.IPFS_GATEWAY || config.get('ipfs.gateway') || 'https://ipfs.io/ipfs/';
const ENABLE_LOCAL_FALLBACK = process.env.ENABLE_LOCAL_FALLBACK || config.get('ipfs.enableLocalFallback') || true;
const LOCAL_STORAGE_PATH = process.env.LOCAL_STORAGE_PATH || config.get('ipfs.localStoragePath') || './uploads/ipfs-fallback';

// Initialize IPFS client
let ipfs;
try {
  ipfs = create({
    host: IPFS_HOST,
    port: IPFS_PORT,
    protocol: IPFS_PROTOCOL
  });
  
  console.log(`IPFS client initialized: ${IPFS_PROTOCOL}://${IPFS_HOST}:${IPFS_PORT}`);
} catch (error) {
  console.error('IPFS client initialization error:', error.message);
  if (ENABLE_LOCAL_FALLBACK) {
    console.log('Using local storage as fallback for IPFS');
    
    // Create local storage directory if it doesn't exist
    if (!fs.existsSync(LOCAL_STORAGE_PATH)) {
      fs.mkdirSync(LOCAL_STORAGE_PATH, { recursive: true });
    }
  }
}

/**
 * Add content to IPFS
 * @param {Buffer|string} content - Content to add
 * @returns {Promise<string>} IPFS CID (Content Identifier)
 */
async function add(content) {
  try {
    if (!ipfs && !ENABLE_LOCAL_FALLBACK) {
      throw new Error('IPFS client not available and local fallback disabled');
    }
    
    // If IPFS is available, use it
    if (ipfs) {
      const result = await ipfs.add(content);
      return result.cid.toString();
    }
    
    // If IPFS is not available, use local storage fallback
    if (ENABLE_LOCAL_FALLBACK) {
      return addToLocalStorage(content);
    }
  } catch (error) {
    console.error('IPFS add error:', error.message);
    
    // Try local storage fallback if enabled
    if (ENABLE_LOCAL_FALLBACK) {
      return addToLocalStorage(content);
    }
    
    throw error;
  }
}

/**
 * Add file to IPFS
 * @param {string} filePath - Path to file
 * @returns {Promise<string>} IPFS CID (Content Identifier)
 */
async function addFile(filePath) {
  try {
    if (!ipfs && !ENABLE_LOCAL_FALLBACK) {
      throw new Error('IPFS client not available and local fallback disabled');
    }
    
    // If IPFS is available, use it
    if (ipfs) {
      const file = await ipfs.add(fs.createReadStream(filePath));
      return file.cid.toString();
    }
    
    // If IPFS is not available, use local storage fallback
    if (ENABLE_LOCAL_FALLBACK) {
      const content = fs.readFileSync(filePath);
      return addToLocalStorage(content, filePath);
    }
  } catch (error) {
    console.error('IPFS addFile error:', error.message);
    
    // Try local storage fallback if enabled
    if (ENABLE_LOCAL_FALLBACK) {
      const content = fs.readFileSync(filePath);
      return addToLocalStorage(content, filePath);
    }
    
    throw error;
  }
}

/**
 * Add directory to IPFS
 * @param {string} dirPath - Path to directory
 * @returns {Promise<string>} IPFS CID (Content Identifier) of directory
 */
async function addDirectory(dirPath) {
  try {
    if (!ipfs) {
      throw new Error('IPFS client not available');
    }
    
    // Add directory to IPFS
    const files = [];
    for await (const file of ipfs.add(globSource(dirPath, '**/*'), { wrapWithDirectory: true })) {
      files.push(file);
    }
    
    // Return the CID of the directory (should be the last file)
    return files[files.length - 1].cid.toString();
  } catch (error) {
    console.error('IPFS addDirectory error:', error.message);
    throw error;
  }
}

/**
 * Get content from IPFS
 * @param {string} cid - IPFS CID (Content Identifier)
 * @returns {Promise<Buffer>} Content as buffer
 */
async function get(cid) {
  try {
    if (!ipfs && !ENABLE_LOCAL_FALLBACK) {
      throw new Error('IPFS client not available and local fallback disabled');
    }
    
    // If IPFS is available, use it
    if (ipfs) {
      const chunks = [];
      for await (const chunk of ipfs.cat(cid)) {
        chunks.push(chunk);
      }
      return Buffer.concat(chunks);
    }
    
    // If IPFS is not available, use local storage fallback
    if (ENABLE_LOCAL_FALLBACK) {
      return getFromLocalStorage(cid);
    }
  } catch (error) {
    console.error('IPFS get error:', error.message);
    
    // Try local storage fallback if enabled
    if (ENABLE_LOCAL_FALLBACK) {
      return getFromLocalStorage(cid);
    }
    
    throw error;
  }
}

/**
 * Get file metadata from IPFS
 * @param {string} cid - IPFS CID (Content Identifier)
 * @returns {Promise<Object>} File metadata
 */
async function stat(cid) {
  try {
    if (!ipfs) {
      throw new Error('IPFS client not available');
    }
    
    const stats = await ipfs.files.stat(`/ipfs/${cid}`);
    return {
      cid: stats.cid.toString(),
      size: stats.size,
      cumulativeSize: stats.cumulativeSize,
      blocks: stats.blocks,
      type: stats.type
    };
  } catch (error) {
    console.error('IPFS stat error:', error.message);
    throw error;
  }
}

/**
 * Pin content to IPFS node
 * @param {string} cid - IPFS CID (Content Identifier)
 * @returns {Promise<boolean>} Success status
 */
async function pin(cid) {
  try {
    if (!ipfs) {
      throw new Error('IPFS client not available');
    }
    
    await ipfs.pin.add(cid);
    return true;
  } catch (error) {
    console.error('IPFS pin error:', error.message);
    return false;
  }
}

/**
 * Unpin content from IPFS node
 * @param {string} cid - IPFS CID (Content Identifier)
 * @returns {Promise<boolean>} Success status
 */
async function unpin(cid) {
  try {
    if (!ipfs) {
      throw new Error('IPFS client not available');
    }
    
    await ipfs.pin.rm(cid);
    return true;
  } catch (error) {
    console.error('IPFS unpin error:', error.message);
    return false;
  }
}

/**
 * Get IPFS gateway URL for a CID
 * @param {string} cid - IPFS CID (Content Identifier)
 * @returns {string} Gateway URL
 */
function getGatewayUrl(cid) {
  return `${IPFS_GATEWAY}${cid}`;
}

/**
 * Local storage fallback for IPFS add
 * @param {Buffer|string} content - Content to add
 * @param {string} [originalFilename] - Original filename if available
 * @returns {Promise<string>} Generated CID-like identifier
 */
function addToLocalStorage(content, originalFilename = null) {
  return new Promise((resolve, reject) => {
    try {
      // Convert content to buffer if it's a string
      const contentBuffer = Buffer.isBuffer(content) ? content : Buffer.from(content);
      
      // Generate a hash of the content to use as CID
      const hash = crypto.createHash('sha256').update(contentBuffer).digest('hex');
      const cid = `local-${hash}`;
      
      // Create directory if it doesn't exist
      const storageDir = `${LOCAL_STORAGE_PATH}/${cid.substring(0, 2)}/${cid.substring(2, 4)}`;
      if (!fs.existsSync(storageDir)) {
        fs.mkdirSync(storageDir, { recursive: true });
      }
      
      // Save content to local storage
      const filePath = `${storageDir}/${cid}`;
      fs.writeFileSync(filePath, contentBuffer);
      
      // Save metadata if available
      if (originalFilename) {
        const metadata = {
          originalFilename,
          size: contentBuffer.length,
          created: new Date().toISOString()
        };
        fs.writeFileSync(`${filePath}.meta`, JSON.stringify(metadata, null, 2));
      }
      
      console.log(`Content stored locally with ID: ${cid}`);
      resolve(cid);
    } catch (error) {
      console.error('Local storage fallback error:', error.message);
      reject(error);
    }
  });
}

/**
 * Local storage fallback for IPFS get
 * @param {string} cid - Local CID or IPFS CID
 * @returns {Promise<Buffer>} Content as buffer
 */
function getFromLocalStorage(cid) {
  return new Promise((resolve, reject) => {
    try {
      // If it's a local CID (starts with "local-")
      if (cid.startsWith('local-')) {
        const storageDir = `${LOCAL_STORAGE_PATH}/${cid.substring(6, 8)}/${cid.substring(8, 10)}`;
        const filePath = `${storageDir}/${cid}`;
        
        if (fs.existsSync(filePath)) {
          const content = fs.readFileSync(filePath);
          resolve(content);
        } else {
          reject(new Error('Content not found in local storage'));
        }
      } 
      // If it's an IPFS CID but we're working in fallback mode
      else {
        // Search in the fallback storage by IPFS CID
        // This is a simplified approach; a real implementation would need a lookup table
        reject(new Error('IPFS CID retrieval from local storage not implemented'));
      }
    } catch (error) {
      console.error('Local storage get error:', error.message);
      reject(error);
    }
  });
}

module.exports = {
  add,
  addFile,
  addDirectory,
  get,
  stat,
  pin,
  unpin,
  getGatewayUrl
};
