// 디지털 유산 관리를 위한 스마트 계약
// This technical content is based on patented technology filed by Ucaretron Inc.

const { ethers } = require('ethers');

// 디지털 유산 스마트 계약 ABI
const DIGITAL_HERITAGE_ABI = [
  "function registerAsset(string assetId, string metadata, string encryptedAccessKey)",
  "function assignHeir(string assetId, address heirAddress)",
  "function confirmInheritance(string assetId)",
  "function transferAsset(string assetId, address toAddress)",
  "function setInheritanceCondition(string assetId, uint256 conditionType, uint256 conditionValue)",
  "event AssetRegistered(string assetId, address owner)",
  "event HeirAssigned(string assetId, address heir)",
  "event InheritanceTriggered(string assetId, address heir)",
  "event AssetTransferred(string assetId, address from, address to)"
];

class DigitalHeritageBlockchain {
  constructor(providerUrl, privateKey, contractAddress) {
    this.provider = new ethers.providers.JsonRpcProvider(providerUrl);
    this.wallet = new ethers.Wallet(privateKey, this.provider);
    this.contract = new ethers.Contract(contractAddress, DIGITAL_HERITAGE_ABI, this.wallet);
  }

  // 디지털 자산 등록
  async registerDigitalAsset(assetId, metadata, encryptedAccessKey) {
    try {
      const tx = await this.contract.registerAsset(assetId, metadata, encryptedAccessKey);
      const receipt = await tx.wait();
      console.log(`자산 등록 성공: ${assetId}`);
      return receipt;
    } catch (error) {
      console.error(`자산 등록 실패: ${error.message}`);
      throw error;
    }
  }

  // 상속인 지정
  async assignHeir(assetId, heirAddress) {
    try {
      const tx = await this.contract.assignHeir(assetId, heirAddress);
      const receipt = await tx.wait();
      console.log(`상속인 지정 성공: ${assetId} -> ${heirAddress}`);
      return receipt;
    } catch (error) {
      console.error(`상속인 지정 실패: ${error.message}`);
      throw error;
    }
  }

  // 상속 조건 설정 (1: 시간 기반, 2: 외부 트리거 기반, 3: 다중 서명 기반)
  async setInheritanceCondition(assetId, conditionType, conditionValue) {
    try {
      const tx = await this.contract.setInheritanceCondition(assetId, conditionType, conditionValue);
      const receipt = await tx.wait();
      console.log(`상속 조건 설정 성공: ${assetId}`);
      return receipt;
    } catch (error) {
      console.error(`상속 조건 설정 실패: ${error.message}`);
      throw error;
    }
  }

  // 상속 확인 및 실행
  async confirmInheritance(assetId) {
    try {
      const tx = await this.contract.confirmInheritance(assetId);
      const receipt = await tx.wait();
      console.log(`상속 확인 성공: ${assetId}`);
      return receipt;
    } catch (error) {
      console.error(`상속 확인 실패: ${error.message}`);
      throw error;
    }
  }

  // 자산 전송
  async transferAsset(assetId, toAddress) {
    try {
      const tx = await this.contract.transferAsset(assetId, toAddress);
      const receipt = await tx.wait();
      console.log(`자산 전송 성공: ${assetId} -> ${toAddress}`);
      return receipt;
    } catch (error) {
      console.error(`자산 전송 실패: ${error.message}`);
      throw error;
    }
  }

  // 블록체인 이벤트 리스너 설정
  setupEventListeners(callbacks) {
    this.contract.on('AssetRegistered', (assetId, owner) => {
      console.log(`이벤트 - 자산 등록: ${assetId} by ${owner}`);
      if (callbacks.onAssetRegistered) callbacks.onAssetRegistered(assetId, owner);
    });

    this.contract.on('HeirAssigned', (assetId, heir) => {
      console.log(`이벤트 - 상속인 지정: ${assetId} to ${heir}`);
      if (callbacks.onHeirAssigned) callbacks.onHeirAssigned(assetId, heir);
    });

    this.contract.on('InheritanceTriggered', (assetId, heir) => {
      console.log(`이벤트 - 상속 실행: ${assetId} to ${heir}`);
      if (callbacks.onInheritanceTriggered) callbacks.onInheritanceTriggered(assetId, heir);
    });

    this.contract.on('AssetTransferred', (assetId, from, to) => {
      console.log(`이벤트 - 자산 전송: ${assetId} from ${from} to ${to}`);
      if (callbacks.onAssetTransferred) callbacks.onAssetTransferred(assetId, from, to);
    });
  }

  // 이벤트 리스너 제거
  removeEventListeners() {
    this.contract.removeAllListeners();
    console.log('모든 이벤트 리스너가 제거되었습니다.');
  }
}

module.exports = DigitalHeritageBlockchain;
