/**
 * Blockchain Service for Digital Heritage Management Platform
 * 
 * This service provides interfaces to the blockchain system for tokenizing assets,
 * creating and managing inheritance contracts, and executing inheritance transfers.
 * 
 * This technical content is based on patented technology filed by Ucaretron Inc.
 */

const Web3 = require('web3');
const ethers = require('ethers');
const config = require('config');
const { MerkleTree } = require('merkletreejs');
const keccak256 = require('keccak256');
const ipfsClient = require('./ipfsService');

// Contract ABIs
const DigitalAssetTokenABI = require('../../blockchain/build/contracts/DigitalAssetToken.json').abi;
const DigitalAssetInheritanceABI = require('../../blockchain/build/contracts/DigitalAssetInheritance.json').abi;
const DeathVerificationOracleABI = require('../../blockchain/build/contracts/DeathVerificationOracle.json').abi;

// Configuration
const BLOCKCHAIN_PROVIDER_URL = process.env.BLOCKCHAIN_PROVIDER_URL || config.get('blockchain.providerUrl');
const DIGITAL_ASSET_TOKEN_ADDRESS = process.env.DIGITAL_ASSET_TOKEN_ADDRESS || config.get('blockchain.contracts.digitalAssetToken');
const DIGITAL_ASSET_INHERITANCE_ADDRESS = process.env.DIGITAL_ASSET_INHERITANCE_ADDRESS || config.get('blockchain.contracts.digitalAssetInheritance');
const DEATH_VERIFICATION_ORACLE_ADDRESS = process.env.DEATH_VERIFICATION_ORACLE_ADDRESS || config.get('blockchain.contracts.deathVerificationOracle');
const ADMIN_WALLET_ADDRESS = process.env.ADMIN_WALLET_ADDRESS || config.get('blockchain.admin.address');
const ADMIN_PRIVATE_KEY = process.env.ADMIN_PRIVATE_KEY || config.get('blockchain.admin.privateKey');
const GAS_PRICE = process.env.GAS_PRICE || config.get('blockchain.gasPrice') || 'auto';
const GAS_LIMIT = process.env.GAS_LIMIT || config.get('blockchain.gasLimit') || 3000000;

// Initialize Web3
let web3;
let digitalAssetTokenContract;
let digitalAssetInheritanceContract;
let deathVerificationOracleContract;
let adminAccount;

/**
 * Initialize blockchain connections and contracts
 */
async function initialize() {
  try {
    // Initialize Web3 provider
    web3 = new Web3(new Web3.providers.HttpProvider(BLOCKCHAIN_PROVIDER_URL));
    
    // Initialize ethers provider for more complex operations
    const ethersProvider = new ethers.providers.JsonRpcProvider(BLOCKCHAIN_PROVIDER_URL);
    
    // Initialize contracts with Web3
    digitalAssetTokenContract = new web3.eth.Contract(
      DigitalAssetTokenABI,
      DIGITAL_ASSET_TOKEN_ADDRESS
    );
    
    digitalAssetInheritanceContract = new web3.eth.Contract(
      DigitalAssetInheritanceABI,
      DIGITAL_ASSET_INHERITANCE_ADDRESS
    );
    
    deathVerificationOracleContract = new web3.eth.Contract(
      DeathVerificationOracleABI,
      DEATH_VERIFICATION_ORACLE_ADDRESS
    );
    
    // Initialize admin account
    if (ADMIN_PRIVATE_KEY) {
      const wallet = new ethers.Wallet(ADMIN_PRIVATE_KEY, ethersProvider);
      adminAccount = wallet.address;
      console.log('Blockchain service initialized with admin account');
    } else {
      console.warn('No admin private key provided, some blockchain functions will be limited');
    }
    
    return true;
  } catch (error) {
    console.error('Blockchain initialization error:', error.message);
    return false;
  }
}

// Initialize on startup
initialize().then(success => {
  if (success) {
    console.log('Blockchain service initialized successfully');
  } else {
    console.error('Failed to initialize blockchain service');
  }
});

/**
 * Tokenize a digital asset on the blockchain
 * @param {Object} asset - Asset object from database
 * @returns {Promise<Object>} Tokenization result
 */
async function tokenizeAsset(asset) {
  try {
    // Ensure blockchain is initialized
    if (!web3 || !digitalAssetTokenContract) {
      await initialize();
    }
    
    // Prepare metadata for the token
    const metadata = {
      name: asset.name,
      description: asset.description || '',
      asset_type: asset.category,
      asset_id: asset._id.toString(),
      created_at: asset.createdAt || new Date().toISOString(),
      importance: asset.importance || 5,
      user_id: asset.user.toString()
    };
    
    // Add storage information if available
    if (asset.ipfsHash) {
      metadata.ipfs_hash = asset.ipfsHash;
    } else if (asset.storageLocation) {
      metadata.storage_location = asset.storageLocation;
    }
    
    // Add thumbnail if it's an image
    if (asset.category === 'photos' && asset.ipfsHash) {
      metadata.image = `ipfs://${asset.ipfsHash}`;
    }
    
    // Upload metadata to IPFS
    const metadataString = JSON.stringify(metadata, null, 2);
    const metadataHash = await ipfsClient.add(Buffer.from(metadataString));
    const tokenURI = `ipfs://${metadataHash}`;
    
    // Create wallet instance for transaction signing
    const provider = new ethers.providers.JsonRpcProvider(BLOCKCHAIN_PROVIDER_URL);
    const wallet = new ethers.Wallet(ADMIN_PRIVATE_KEY, provider);
    const tokenContract = new ethers.Contract(
      DIGITAL_ASSET_TOKEN_ADDRESS,
      DigitalAssetTokenABI,
      wallet
    );
    
    // Get owner address from user ID
    // In a real implementation, you would look up the user's wallet address
    // Here we're using a mock function that returns a test address
    const ownerAddress = await getUserWalletAddress(asset.user.toString());
    
    // Mint the token
    const tx = await tokenContract.mint(
      ownerAddress,
      tokenURI,
      asset.category === 'photos' ? 1 : 0,  // Asset type: 0=generic, 1=image, 2=document, etc.
      {
        gasLimit: GAS_LIMIT,
        gasPrice: GAS_PRICE === 'auto' ? await provider.getGasPrice() : ethers.utils.parseUnits(GAS_PRICE, 'gwei')
      }
    );
    
    // Wait for transaction confirmation
    const receipt = await tx.wait();
    
    // Get token ID from logs
    const transferEvent = receipt.logs
      .map(log => {
        try {
          return tokenContract.interface.parseLog(log);
        } catch (e) {
          return null;
        }
      })
      .filter(Boolean)
      .find(event => event.name === 'Transfer');
    
    if (!transferEvent) {
      throw new Error('Token minting transaction successful but could not find Transfer event');
    }
    
    const tokenId = transferEvent.args.tokenId.toString();
    
    return {
      tokenId,
      contract: DIGITAL_ASSET_TOKEN_ADDRESS,
      transactionHash: receipt.transactionHash,
      tokenURI,
      blockNumber: receipt.blockNumber
    };
  } catch (error) {
    console.error('Tokenization error:', error.message);
    throw error;
  }
}

/**
 * Get a user's wallet address from user ID
 * @param {string} userId - User ID from database
 * @returns {Promise<string>} Wallet address
 */
async function getUserWalletAddress(userId) {
  // In a real implementation, you would look up the user's wallet address
  // from your database or identity service
  
  // For testing, we generate a deterministic address from the user ID
  const hash = web3.utils.keccak256(userId);
  const address = `0x${hash.substring(26)}`;
  return web3.utils.toChecksumAddress(address);
}

/**
 * Create a new inheritance plan for a user
 * @param {Object} planData - Inheritance plan data
 * @returns {Promise<Object>} Creation result
 */
async function createInheritancePlan(planData) {
  try {
    // Ensure blockchain is initialized
    if (!web3 || !digitalAssetInheritanceContract) {
      await initialize();
    }
    
    // Create wallet instance for transaction signing
    const provider = new ethers.providers.JsonRpcProvider(BLOCKCHAIN_PROVIDER_URL);
    const wallet = new ethers.Wallet(ADMIN_PRIVATE_KEY, provider);
    const inheritanceContract = new ethers.Contract(
      DIGITAL_ASSET_INHERITANCE_ADDRESS,
      DigitalAssetInheritanceABI,
      wallet
    );
    
    // Get user's wallet address
    const userAddress = await getUserWalletAddress(planData.userId);
    
    // Create asset Merkle tree
    const assetLeaves = planData.assets.map(asset => 
      keccak256(Buffer.from(`${asset.assetId}:${asset.registryAddress}:${asset.ownerAddress}`))
    );
    const assetMerkleTree = new MerkleTree(assetLeaves, keccak256, { sortPairs: true });
    const assetMerkleRoot = '0x' + assetMerkleTree.getRoot().toString('hex');
    
    // Get guardian addresses
    const guardianAddresses = await Promise.all(
      planData.guardians.map(guardianId => getUserWalletAddress(guardianId))
    );
    
    // Upload plan metadata to IPFS
    const metadata = {
      userId: planData.userId,
      createdAt: new Date().toISOString(),
      assetsCount: planData.assets.length,
      guardiansCount: guardianAddresses.length,
      beneficiariesCount: planData.beneficiaries.length,
      description: planData.description || 'Digital inheritance plan'
    };
    
    const metadataString = JSON.stringify(metadata, null, 2);
    const metadataHash = await ipfsClient.add(Buffer.from(metadataString));
    const metadataURI = `ipfs://${metadataHash}`;
    
    // Calculate document hash
    const documentHash = web3.utils.keccak256(
      web3.utils.encodePacked(
        planData.userId,
        JSON.stringify(planData.assets),
        JSON.stringify(planData.beneficiaries),
        JSON.stringify(guardianAddresses),
        metadataURI
      )
    );
    
    // Call the contract
    const tx = await inheritanceContract.createInheritancePlan(
      planData.cooldownPeriod || 60 * 60 * 24 * 30, // 30 days in seconds
      assetMerkleRoot,
      guardianAddresses,
      planData.requiredGuardianApprovals || Math.ceil(guardianAddresses.length / 2),
      documentHash,
      metadataURI,
      {
        gasLimit: GAS_LIMIT,
        gasPrice: GAS_PRICE === 'auto' ? await provider.getGasPrice() : ethers.utils.parseUnits(GAS_PRICE, 'gwei')
      }
    );
    
    // Wait for transaction confirmation
    const receipt = await tx.wait();
    
    return {
      transactionHash: receipt.transactionHash,
      documentHash,
      assetMerkleRoot,
      metadataURI,
      blockNumber: receipt.blockNumber
    };
  } catch (error) {
    console.error('Inheritance plan creation error:', error.message);
    throw error;
  }
}

/**
 * Add a beneficiary to an inheritance plan
 * @param {Object} beneficiaryData - Beneficiary data
 * @returns {Promise<Object>} Operation result
 */
async function addBeneficiary(beneficiaryData) {
  try {
    // Ensure blockchain is initialized
    if (!web3 || !digitalAssetInheritanceContract) {
      await initialize();
    }
    
    // Create wallet instance for transaction signing
    const provider = new ethers.providers.JsonRpcProvider(BLOCKCHAIN_PROVIDER_URL);
    const wallet = new ethers.Wallet(ADMIN_PRIVATE_KEY, provider);
    const inheritanceContract = new ethers.Contract(
      DIGITAL_ASSET_INHERITANCE_ADDRESS,
      DigitalAssetInheritanceABI,
      wallet
    );
    
    // Get addresses
    const ownerAddress = await getUserWalletAddress(beneficiaryData.ownerId);
    const beneficiaryAddress = await getUserWalletAddress(beneficiaryData.beneficiaryId);
    
    // Create Merkle tree for beneficiary's assets
    const assetLeaves = beneficiaryData.assets.map(asset => 
      keccak256(Buffer.from(`${asset.assetId}:${asset.registryAddress}:${beneficiaryData.beneficiaryId}`))
    );
    const assetMerkleTree = new MerkleTree(assetLeaves, keccak256, { sortPairs: true });
    const assetMerkleRoot = '0x' + assetMerkleTree.getRoot().toString('hex');
    
    // Map access condition to enum
    const accessConditionMap = {
      'immediate': 0,
      'delayed': 1,
      'conditional': 2,
      'staged': 3
    };
    
    const accessCondition = accessConditionMap[beneficiaryData.accessCondition] || 0;
    
    // Calculate condition hash if provided
    const conditionHash = beneficiaryData.conditions 
      ? web3.utils.keccak256(beneficiaryData.conditions)
      : ethers.constants.HashZero;
    
    // Call the contract
    const tx = await inheritanceContract.addBeneficiary(
      beneficiaryAddress,
      assetMerkleRoot,
      accessCondition,
      beneficiaryData.delayPeriod || 0,
      conditionHash,
      {
        gasLimit: GAS_LIMIT,
        gasPrice: GAS_PRICE === 'auto' ? await provider.getGasPrice() : ethers.utils.parseUnits(GAS_PRICE, 'gwei')
      }
    );
    
    // Wait for transaction confirmation
    const receipt = await tx.wait();
    
    return {
      transactionHash: receipt.transactionHash,
      beneficiaryAddress,
      assetMerkleRoot,
      blockNumber: receipt.blockNumber
    };
  } catch (error) {
    console.error('Add beneficiary error:', error.message);
    throw error;
  }
}

/**
 * Initiate inheritance process for a deceased user
 * @param {string} userId - User ID of the deceased
 * @returns {Promise<Object>} Operation result
 */
async function initiateInheritance(userId) {
  try {
    // Ensure blockchain is initialized
    if (!web3 || !digitalAssetInheritanceContract) {
      await initialize();
    }
    
    // Create wallet instance for transaction signing
    const provider = new ethers.providers.JsonRpcProvider(BLOCKCHAIN_PROVIDER_URL);
    const wallet = new ethers.Wallet(ADMIN_PRIVATE_KEY, provider);
    const inheritanceContract = new ethers.Contract(
      DIGITAL_ASSET_INHERITANCE_ADDRESS,
      DigitalAssetInheritanceABI,
      wallet
    );
    
    // Get user's wallet address
    const userAddress = await getUserWalletAddress(userId);
    
    // Call the contract
    const tx = await inheritanceContract.initiateInheritance(
      userAddress,
      {
        gasLimit: GAS_LIMIT,
        gasPrice: GAS_PRICE === 'auto' ? await provider.getGasPrice() : ethers.utils.parseUnits(GAS_PRICE, 'gwei')
      }
    );
    
    // Wait for transaction confirmation
    const receipt = await tx.wait();
    
    return {
      transactionHash: receipt.transactionHash,
      userAddress,
      blockNumber: receipt.blockNumber,
      status: 'initiated'
    };
  } catch (error) {
    console.error('Initiate inheritance error:', error.message);
    throw error;
  }
}

/**
 * Guardian approval for inheritance execution
 * @param {Object} approvalData - Approval data
 * @returns {Promise<Object>} Operation result
 */
async function approveInheritance(approvalData) {
  try {
    // Ensure blockchain is initialized
    if (!web3 || !digitalAssetInheritanceContract) {
      await initialize();
    }
    
    // Create wallet instance for transaction signing
    const provider = new ethers.providers.JsonRpcProvider(BLOCKCHAIN_PROVIDER_URL);
    const wallet = new ethers.Wallet(approvalData.guardianPrivateKey, provider);
    const inheritanceContract = new ethers.Contract(
      DIGITAL_ASSET_INHERITANCE_ADDRESS,
      DigitalAssetInheritanceABI,
      wallet
    );
    
    // Get user's wallet address
    const userAddress = await getUserWalletAddress(approvalData.userId);
    
    // Call the contract
    const tx = await inheritanceContract.approveInheritance(
      userAddress,
      {
        gasLimit: GAS_LIMIT,
        gasPrice: GAS_PRICE === 'auto' ? await provider.getGasPrice() : ethers.utils.parseUnits(GAS_PRICE, 'gwei')
      }
    );
    
    // Wait for transaction confirmation
    const receipt = await tx.wait();
    
    return {
      transactionHash: receipt.transactionHash,
      guardianAddress: wallet.address,
      userAddress,
      blockNumber: receipt.blockNumber,
      status: 'approved'
    };
  } catch (error) {
    console.error('Approve inheritance error:', error.message);
    throw error;
  }
}

/**
 * Execute asset transfer to beneficiary
 * @param {Object} transferData - Transfer data
 * @returns {Promise<Object>} Operation result
 */
async function executeAssetTransfer(transferData) {
  try {
    // Ensure blockchain is initialized
    if (!web3 || !digitalAssetInheritanceContract) {
      await initialize();
    }
    
    // Create wallet instance for transaction signing
    const provider = new ethers.providers.JsonRpcProvider(BLOCKCHAIN_PROVIDER_URL);
    const wallet = new ethers.Wallet(ADMIN_PRIVATE_KEY, provider);
    const inheritanceContract = new ethers.Contract(
      DIGITAL_ASSET_INHERITANCE_ADDRESS,
      DigitalAssetInheritanceABI,
      wallet
    );
    
    // Get addresses
    const ownerAddress = await getUserWalletAddress(transferData.ownerId);
    const beneficiaryAddress = await getUserWalletAddress(transferData.beneficiaryId);
    
    // Create Merkle proof
    const assetLeaf = keccak256(Buffer.from(
      `${transferData.assetId}:${transferData.assetRegistry}:${transferData.beneficiaryId}`
    ));
    
    // In a real implementation, you would build the Merkle tree from all assets
    // Here we're mocking the proof for simplicity
    const merkleProof = ['0x' + keccak256(Buffer.from('proof')).toString('hex')];
    
    // Call the contract
    const tx = await inheritanceContract.executeAssetTransfer(
      ownerAddress,
      transferData.assetRegistry,
      transferData.assetId,
      beneficiaryAddress,
      merkleProof,
      {
        gasLimit: GAS_LIMIT,
        gasPrice: GAS_PRICE === 'auto' ? await provider.getGasPrice() : ethers.utils.parseUnits(GAS_PRICE, 'gwei')
      }
    );
    
    // Wait for transaction confirmation
    const receipt = await tx.wait();
    
    return {
      transactionHash: receipt.transactionHash,
      ownerAddress,
      beneficiaryAddress,
      assetId: transferData.assetId,
      blockNumber: receipt.blockNumber,
      status: 'transferred'
    };
  } catch (error) {
    console.error('Execute asset transfer error:', error.message);
    throw error;
  }
}

/**
 * Get inheritance plan status
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Plan status
 */
async function getInheritancePlanStatus(userId) {
  try {
    // Ensure blockchain is initialized
    if (!web3 || !digitalAssetInheritanceContract) {
      await initialize();
    }
    
    // Get user's wallet address
    const userAddress = await getUserWalletAddress(userId);
    
    // Call the contract
    const status = await digitalAssetInheritanceContract.methods
      .getInheritancePlanStatus(userAddress)
      .call();
    
    // Map status code to string
    const statusMap = [
      'NotConfigured',
      'Configured',
      'InCooldown',
      'InProcess',
      'Completed',
      'Disputed',
      'Cancelled'
    ];
    
    return {
      userId,
      status: statusMap[status] || 'Unknown',
      statusCode: status
    };
  } catch (error) {
    console.error('Get inheritance plan status error:', error.message);
    throw error;
  }
}

/**
 * Get inheritance plan details
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Plan details
 */
async function getInheritancePlanDetails(userId) {
  try {
    // Ensure blockchain is initialized
    if (!web3 || !digitalAssetInheritanceContract) {
      await initialize();
    }
    
    // Get user's wallet address
    const userAddress = await getUserWalletAddress(userId);
    
    // Call the contract
    const details = await digitalAssetInheritanceContract.methods
      .getInheritancePlanDetails(userAddress)
      .call();
    
    // Parse the result
    const statusMap = [
      'NotConfigured',
      'Configured',
      'InCooldown',
      'InProcess',
      'Completed',
      'Disputed',
      'Cancelled'
    ];
    
    return {
      userId,
      creationTime: new Date(details.creationTime * 1000).toISOString(),
      lastUpdateTime: new Date(details.lastUpdateTime * 1000).toISOString(),
      cooldownPeriod: parseInt(details.cooldownPeriod),
      guardians: details.guardians,
      requiredApprovals: parseInt(details.requiredApprovals),
      approvalCount: parseInt(details.approvalCount),
      status: statusMap[details.status] || 'Unknown',
      metadataURI: details.metadataURI
    };
  } catch (error) {
    console.error('Get inheritance plan details error:', error.message);
    throw error;
  }
}

// Export the service functions
module.exports = {
  initialize,
  tokenizeAsset,
  getUserWalletAddress,
  createInheritancePlan,
  addBeneficiary,
  initiateInheritance,
  approveInheritance,
  executeAssetTransfer,
  getInheritancePlanStatus,
  getInheritancePlanDetails
};
