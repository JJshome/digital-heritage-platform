// 디지털 유산 분산 저장소 서비스
// This technical content is based on patented technology filed by Ucaretron Inc.

const { create } = require('ipfs-http-client');
const { Blob } = require('buffer');
const crypto = require('crypto');

class IPFSStorageService {
  /**
   * IPFS 저장소 서비스 초기화
   * @param {string} ipfsApiUrl - IPFS API URL (예: 'https://ipfs.infura.io:5001/api/v0')
   * @param {string} encryptionKey - 데이터 암호화에 사용할 키
   */
  constructor(ipfsApiUrl, encryptionKey) {
    this.ipfs = create({ url: ipfsApiUrl });
    this.encryptionKey = encryptionKey;
  }

  /**
   * 데이터 암호화
   * @param {Buffer|string} data - 암호화할 데이터
   * @returns {Buffer} - 암호화된 데이터
   */
  encryptData(data) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(this.encryptionKey, 'hex'), iv);
    let encrypted = cipher.update(data);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return Buffer.concat([iv, encrypted]);
  }

  /**
   * 데이터 복호화
   * @param {Buffer} encryptedData - 복호화할 암호화된 데이터
   * @returns {Buffer} - 복호화된 데이터
   */
  decryptData(encryptedData) {
    const iv = encryptedData.slice(0, 16);
    const dataToDecrypt = encryptedData.slice(16);
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(this.encryptionKey, 'hex'), iv);
    let decrypted = decipher.update(dataToDecrypt);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted;
  }

  /**
   * 파일을 IPFS에 업로드
   * @param {Buffer|string} fileData - 업로드할 파일 데이터
   * @param {boolean} encrypt - 암호화 여부
   * @returns {Promise<string>} - IPFS CID (Content Identifier)
   */
  async uploadFile(fileData, encrypt = true) {
    try {
      let dataToUpload = fileData;
      
      if (encrypt) {
        dataToUpload = this.encryptData(fileData);
      }
      
      const blob = new Blob([dataToUpload]);
      const result = await this.ipfs.add(blob);
      console.log(`파일 업로드 성공: ${result.path}`);
      
      return result.path;
    } catch (error) {
      console.error(`파일 업로드 실패: ${error.message}`);
      throw error;
    }
  }

  /**
   * IPFS에서 파일 다운로드
   * @param {string} cid - 파일의 IPFS CID
   * @param {boolean} decrypt - 복호화 여부
   * @returns {Promise<Buffer>} - 파일 데이터
   */
  async downloadFile(cid, decrypt = true) {
    try {
      const chunks = [];
      for await (const chunk of this.ipfs.cat(cid)) {
        chunks.push(chunk);
      }
      
      let fileData = Buffer.concat(chunks);
      
      if (decrypt) {
        fileData = this.decryptData(fileData);
      }
      
      console.log(`파일 다운로드 성공: ${cid}`);
      return fileData;
    } catch (error) {
      console.error(`파일 다운로드 실패: ${error.message}`);
      throw error;
    }
  }

  /**
   * 메타데이터를 IPFS에 업로드
   * @param {Object} metadata - 업로드할 메타데이터 객체
   * @param {boolean} encrypt - 암호화 여부
   * @returns {Promise<string>} - 메타데이터의 IPFS CID
   */
  async uploadMetadata(metadata, encrypt = true) {
    try {
      const metadataString = JSON.stringify(metadata);
      return await this.uploadFile(Buffer.from(metadataString), encrypt);
    } catch (error) {
      console.error(`메타데이터 업로드 실패: ${error.message}`);
      throw error;
    }
  }

  /**
   * IPFS에서 메타데이터 다운로드
   * @param {string} cid - 메타데이터의 IPFS CID
   * @param {boolean} decrypt - 복호화 여부
   * @returns {Promise<Object>} - 메타데이터 객체
   */
  async downloadMetadata(cid, decrypt = true) {
    try {
      const fileData = await this.downloadFile(cid, decrypt);
      return JSON.parse(fileData.toString());
    } catch (error) {
      console.error(`메타데이터 다운로드 실패: ${error.message}`);
      throw error;
    }
  }

  /**
   * 디지털 유산 패키지 생성 및 업로드
   * @param {Object} assetData - 디지털 자산 데이터
   * @param {Object} metadata - 자산 메타데이터
   * @param {Array<{key: string, value: Buffer|string}>} files - 자산 파일 목록
   * @returns {Promise<string>} - 패키지의 IPFS CID
   */
  async createDigitalHeritagePackage(assetData, metadata, files = []) {
    try {
      // 파일들을 개별적으로 업로드하고 CID 수집
      const fileEntries = await Promise.all(
        files.map(async (file) => {
          const cid = await this.uploadFile(file.value);
          return { key: file.key, cid };
        })
      );
      
      // 패키지 메타데이터 생성
      const packageMetadata = {
        assetData,
        metadata,
        files: fileEntries,
        timestamp: Date.now(),
      };
      
      // 패키지 메타데이터 업로드
      const packageCid = await this.uploadMetadata(packageMetadata, true);
      console.log(`디지털 유산 패키지 생성 완료: ${packageCid}`);
      
      return packageCid;
    } catch (error) {
      console.error(`디지털 유산 패키지 생성 실패: ${error.message}`);
      throw error;
    }
  }

  /**
   * 디지털 유산 패키지 다운로드
   * @param {string} packageCid - 패키지의 IPFS CID
   * @returns {Promise<Object>} - 패키지 데이터 (메타데이터 + 파일 CID 목록)
   */
  async downloadDigitalHeritagePackage(packageCid) {
    try {
      const packageMetadata = await this.downloadMetadata(packageCid);
      console.log(`디지털 유산 패키지 다운로드 완료: ${packageCid}`);
      return packageMetadata;
    } catch (error) {
      console.error(`디지털 유산 패키지 다운로드 실패: ${error.message}`);
      throw error;
    }
  }
}

module.exports = IPFSStorageService;