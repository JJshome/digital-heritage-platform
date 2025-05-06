/**
 * Virtual User Data Generator
 * 
 * This script generates synthetic user profiles for testing and AI model training.
 * It creates realistic but fictional user data that can be used for development
 * and testing purposes without using real personal information.
 * 
 * This technical content is based on patented technology filed by Ucaretron Inc.
 */

const fs = require('fs');
const path = require('path');
const { faker } = require('@faker-js/faker/locale/ko');
const crypto = require('crypto');

// Ensure output directory exists
const OUTPUT_DIR = path.join(__dirname, '../virtual');
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

/**
 * Generate a random age with normal distribution
 * @param {number} mean - Mean age
 * @param {number} stdDev - Standard deviation
 * @returns {number} - Age between 18 and 100
 */
function normalDistributionAge(mean = 45, stdDev = 15) {
  // Box-Muller transform
  const u1 = Math.random();
  const u2 = Math.random();
  const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  let age = Math.round(z0 * stdDev + mean);
  
  // Ensure age is between 18 and 100
  age = Math.max(18, Math.min(100, age));
  return age;
}

/**
 * Generate a list of common digital platforms
 * @returns {Array} - Array of platform objects
 */
function generatePlatforms() {
  const platforms = [
    { name: 'Gmail', type: 'email', url: 'https://mail.google.com' },
    { name: 'Naver Mail', type: 'email', url: 'https://mail.naver.com' },
    { name: 'Daum Mail', type: 'email', url: 'https://mail.daum.net' },
    { name: 'Facebook', type: 'social', url: 'https://facebook.com' },
    { name: 'Instagram', type: 'social', url: 'https://instagram.com' },
    { name: 'Twitter', type: 'social', url: 'https://twitter.com' },
    { name: 'LinkedIn', type: 'social', url: 'https://linkedin.com' },
    { name: 'YouTube', type: 'content', url: 'https://youtube.com' },
    { name: 'TikTok', type: 'content', url: 'https://tiktok.com' },
    { name: 'Google Drive', type: 'storage', url: 'https://drive.google.com' },
    { name: 'Dropbox', type: 'storage', url: 'https://dropbox.com' },
    { name: 'Naver Cloud', type: 'storage', url: 'https://mybox.naver.com' },
    { name: 'Kakao', type: 'messaging', url: 'https://kakao.com' },
    { name: 'Line', type: 'messaging', url: 'https://line.me' },
    { name: 'Upbit', type: 'crypto', url: 'https://upbit.com' },
    { name: 'Bithumb', type: 'crypto', url: 'https://www.bithumb.com' },
    { name: 'Coinone', type: 'crypto', url: 'https://coinone.co.kr' },
    { name: 'Apple ID', type: 'account', url: 'https://appleid.apple.com' },
    { name: 'Google Account', type: 'account', url: 'https://myaccount.google.com' },
    { name: 'Microsoft Account', type: 'account', url: 'https://account.microsoft.com' },
    { name: 'Amazon', type: 'shopping', url: 'https://amazon.com' },
    { name: 'Coupang', type: 'shopping', url: 'https://coupang.com' },
    { name: 'Gmarket', type: 'shopping', url: 'https://gmarket.co.kr' },
    { name: 'Netflix', type: 'entertainment', url: 'https://netflix.com' },
    { name: 'Spotify', type: 'entertainment', url: 'https://spotify.com' },
    { name: 'Melon', type: 'entertainment', url: 'https://melon.com' },
    { name: 'KakaoBank', type: 'finance', url: 'https://kakaobank.com' },
    { name: 'Shinhan Bank', type: 'finance', url: 'https://shinhan.com' },
    { name: 'KB Kookmin Bank', type: 'finance', url: 'https://kbstar.com' }
  ];
  
  return platforms;
}

/**
 * Generate user profile accounts with platform data
 * @param {Object} user - User profile object
 * @returns {Array} - Array of account objects
 */
function generateUserAccounts(user) {
  const platforms = generatePlatforms();
  const numAccounts = Math.floor(Math.random() * 10) + 5; // 5-15 accounts
  const selectedPlatforms = [];
  
  // Select random platforms without duplicates
  while (selectedPlatforms.length < numAccounts && selectedPlatforms.length < platforms.length) {
    const platform = platforms[Math.floor(Math.random() * platforms.length)];
    if (!selectedPlatforms.find(p => p.name === platform.name)) {
      selectedPlatforms.push(platform);
    }
  }
  
  // Generate account data for each platform
  return selectedPlatforms.map(platform => {
    // Generate username based on platform type
    let username = '';
    switch (platform.type) {
      case 'email':
        username = user.email.split('@')[0];
        break;
      case 'social':
      case 'content':
        username = faker.internet.userName(user.firstName, user.lastName);
        break;
      default:
        username = `${user.firstName.toLowerCase()}${user.lastName.toLowerCase()}${Math.floor(Math.random() * 1000)}`;
    }
    
    // Generate masked password (for demonstration - not actual passwords)
    const password = '*'.repeat(Math.floor(Math.random() * 6) + 8);
    
    // Generate recovery information
    const recoveryEmail = Math.random() > 0.5 ? user.email : faker.internet.email();
    const recoveryPhone = user.phoneNumber;
    
    // Generate account creation date
    const creationDate = faker.date.past({ years: 10 });
    
    // Generate importance score (1-10)
    const importance = Math.floor(Math.random() * 10) + 1;
    
    return {
      platform: platform.name,
      platformType: platform.type,
      platformUrl: platform.url,
      username,
      password,  // Note: In real application, passwords would never be stored
      recoveryEmail,
      recoveryPhone,
      creationDate,
      lastLogin: faker.date.recent({ days: 30 }),
      importance,
      twoFactorEnabled: Math.random() > 0.7,  // 30% chance of having 2FA
      notes: Math.random() > 0.8 ? faker.lorem.sentence() : null  // 20% chance of having notes
    };
  });
}

/**
 * Generate family members for inheritance planning
 * @param {Object} user - User profile object
 * @returns {Array} - Array of family member objects
 */
function generateFamilyMembers(user) {
  const familyTypes = ['spouse', 'child', 'parent', 'sibling'];
  const numFamily = Math.floor(Math.random() * 5) + 1; // 1-5 family members
  const familyMembers = [];
  
  for (let i = 0; i < numFamily; i++) {
    const relationshipType = familyTypes[Math.floor(Math.random() * familyTypes.length)];
    let age;
    
    switch (relationshipType) {
      case 'spouse':
        age = user.age + (Math.random() > 0.5 ? 1 : -1) * Math.floor(Math.random() * 5);
        break;
      case 'child':
        age = Math.max(18, user.age - 20 - Math.floor(Math.random() * 15));
        break;
      case 'parent':
        age = user.age + 20 + Math.floor(Math.random() * 15);
        break;
      case 'sibling':
        age = user.age + (Math.random() > 0.5 ? 1 : -1) * Math.floor(Math.random() * 10);
        break;
    }
    
    // Ensure age is valid
    age = Math.max(18, Math.min(100, age));
    
    const gender = Math.random() > 0.5 ? 'male' : 'female';
    const firstName = gender === 'male' ? faker.person.firstName('male') : faker.person.firstName('female');
    
    familyMembers.push({
      id: crypto.randomUUID(),
      firstName,
      lastName: user.lastName, // Same last name for family
      relationshipType,
      age,
      email: faker.internet.email({ firstName, lastName: user.lastName }),
      phoneNumber: faker.phone.number(),
      trustScore: Math.floor(Math.random() * 10) + 1, // 1-10 trust score
      isLegalGuardian: relationshipType === 'spouse' || relationshipType === 'parent',
      inheritance: {
        percentageShare: 0, // Will be calculated later
        specificAssets: []  // Will be filled later
      }
    });
  }
  
  return familyMembers;
}

/**
 * Generate a single user profile with all associated data
 * @returns {Object} - Complete user profile
 */
function generateUserProfile() {
  const userId = crypto.randomUUID();
  const gender = Math.random() > 0.5 ? 'male' : 'female';
  const firstName = gender === 'male' ? faker.person.firstName('male') : faker.person.firstName('female');
  const lastName = faker.person.lastName();
  const age = normalDistributionAge();
  
  const user = {
    id: userId,
    firstName,
    lastName,
    email: faker.internet.email({ firstName, lastName }),
    phoneNumber: faker.phone.number(),
    age,
    birthDate: faker.date.birthdate({ min: 18, max: 100, mode: 'age' }),
    address: {
      street: faker.location.streetAddress(),
      city: faker.location.city(),
      state: faker.location.state(),
      zipCode: faker.location.zipCode(),
      country: 'South Korea'
    },
    occupation: faker.person.jobTitle(),
    registrationDate: faker.date.recent({ days: 365 }),
    profileSettings: {
      language: 'ko',
      timezone: 'Asia/Seoul',
      notifications: {
        email: Math.random() > 0.3,
        sms: Math.random() > 0.6,
        push: Math.random() > 0.5
      },
      twoFactorAuthentication: Math.random() > 0.6
    }
  };
  
  // Generate digital accounts
  user.digitalAccounts = generateUserAccounts(user);
  
  // Generate family members for inheritance
  user.familyMembers = generateFamilyMembers(user);
  
  // Calculate inheritance percentages among family members
  const totalFamilyMembers = user.familyMembers.length;
  let remainingPercentage = 100;
  
  // Distribute inheritance percentages
  user.familyMembers.forEach((member, index) => {
    // Last member gets the remainder
    if (index === totalFamilyMembers - 1) {
      member.inheritance.percentageShare = remainingPercentage;
    } else {
      // Random percentage between 5% and 50%
      const percentage = Math.min(remainingPercentage - 5, Math.floor(Math.random() * 45) + 5);
      member.inheritance.percentageShare = percentage;
      remainingPercentage -= percentage;
    }
    
    // Assign some specific assets (accounts) to family members
    const numSpecificAssets = Math.floor(Math.random() * 3); // 0-2 specific assets
    for (let i = 0; i < numSpecificAssets && i < user.digitalAccounts.length; i++) {
      const randomAccountIndex = Math.floor(Math.random() * user.digitalAccounts.length);
      const assetId = user.digitalAccounts[randomAccountIndex].platform;
      
      // Only add if not already assigned
      if (!member.inheritance.specificAssets.includes(assetId)) {
        member.inheritance.specificAssets.push(assetId);
      }
    }
  });
  
  return user;
}

/**
 * Generate multiple user profiles
 * @param {number} count - Number of profiles to generate
 * @returns {Array} - Array of user profiles
 */
function generateUserProfiles(count = 100) {
  const users = [];
  for (let i = 0; i < count; i++) {
    users.push(generateUserProfile());
  }
  return users;
}

// Generate user data
const userCount = process.argv[2] ? parseInt(process.argv[2]) : 100;
console.log(`Generating ${userCount} virtual user profiles...`);
const users = generateUserProfiles(userCount);

// Write to JSON file
const outputPath = path.join(OUTPUT_DIR, 'users.json');
fs.writeFileSync(outputPath, JSON.stringify(users, null, 2));
console.log(`Generated ${users.length} user profiles successfully.`);
console.log(`Output saved to: ${outputPath}`);

module.exports = {
  generateUserProfile,
  generateUserProfiles
};
