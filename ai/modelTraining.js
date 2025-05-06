// 디지털 유산 AI 모델 학습 및 분석
// This technical content is based on patented technology filed by Ucaretron Inc.

const tf = require('@tensorflow/tfjs-node');
const natural = require('natural');
const { PCA } = require('ml-pca');
const { AgglomerativeClustering } = require('ml-hclust');
const sentiment = require('sentiment');

class DigitalHeritageAI {
  constructor() {
    // 텍스트 처리를 위한 자연어 처리 모듈 초기화
    this.tokenizer = new natural.WordTokenizer();
    this.stemmer = natural.PorterStemmer;
    this.sentimentAnalyzer = new sentiment();
    
    // 학습된 모델 저장소
    this.models = {
      textClassifier: null,
      imageFeatureExtractor: null,
      assetRecommender: null
    };
    
    // 메타데이터 및 임베딩 저장소
    this.embeddings = {
      text: new Map(),
      image: new Map(),
      combined: new Map()
    };
  }

  /**
   * 텍스트 데이터 전처리
   * @param {string} text - 입력 텍스트
   * @returns {string[]} - 처리된 토큰 배열
   */
  preprocessText(text) {
    // 소문자 변환
    const lowerText = text.toLowerCase();
    
    // 토큰화
    const tokens = this.tokenizer.tokenize(lowerText);
    
    // 불용어 제거
    const stopwords = ['a', 'an', 'the', 'and', 'or', 'but', 'is', 'are', 'was', 'were'];
    const filteredTokens = tokens.filter(token => !stopwords.includes(token));
    
    // 어간 추출
    const stemmedTokens = filteredTokens.map(token => this.stemmer.stem(token));
    
    return stemmedTokens;
  }

  /**
   * 감성 분석
   * @param {string} text - 분석할 텍스트
   * @returns {Object} - 감성 분석 결과
   */
  analyzeSentiment(text) {
    return this.sentimentAnalyzer.analyze(text);
  }

  /**
   * 텍스트 분류 모델 학습
   * @param {Array<{text: string, label: string}>} trainingData - 학습 데이터
   * @returns {Promise<void>}
   */
  async trainTextClassifier(trainingData) {
    // 데이터 전처리
    const processedData = trainingData.map(item => ({
      tokens: this.preprocessText(item.text),
      label: item.label
    }));
    
    // 고유 레이블 추출
    const labels = [...new Set(processedData.map(item => item.label))];
    
    // 단어 사전 구축
    const vocabulary = new Set();
    processedData.forEach(item => {
      item.tokens.forEach(token => vocabulary.add(token));
    });
    
    // 텍스트를 벡터로 변환
    const xData = processedData.map(item => {
      const vector = Array.from(vocabulary).map(word => 
        item.tokens.includes(word) ? 1 : 0
      );
      return vector;
    });
    
    // 레이블 인코딩
    const yData = processedData.map(item => 
      labels.indexOf(item.label)
    );
    
    // 텐서 변환
    const xs = tf.tensor2d(xData);
    const ys = tf.oneHot(tf.tensor1d(yData, 'int32'), labels.length);
    
    // 모델 생성
    const model = tf.sequential();
    model.add(tf.layers.dense({
      inputShape: [vocabulary.size],
      units: 128,
      activation: 'relu'
    }));
    model.add(tf.layers.dropout({ rate: 0.2 }));
    model.add(tf.layers.dense({
      units: labels.length,
      activation: 'softmax'
    }));
    
    // 모델 컴파일
    model.compile({
      optimizer: 'adam',
      loss: 'categoricalCrossentropy',
      metrics: ['accuracy']
    });
    
    // 모델 학습
    await model.fit(xs, ys, {
      epochs: 50,
      batchSize: 32,
      validationSplit: 0.2,
      callbacks: {
        onEpochEnd: (epoch, logs) => {
          console.log(`에폭 ${epoch + 1}: 손실 = ${logs.loss.toFixed(4)}, 정확도 = ${logs.acc.toFixed(4)}`);
        }
      }
    });
    
    // 학습된 모델 저장
    this.models.textClassifier = {
      model,
      vocabulary: Array.from(vocabulary),
      labels
    };
    
    console.log('텍스트 분류 모델 학습 완료');
  }

  /**
   * 디지털 자산 클러스터링
   * @param {Array<{id: string, features: number[]}>} assets - 디지털 자산 특징 벡터
   * @param {number} numClusters - 클러스터 수
   * @returns {Object} - 클러스터링 결과
   */
  clusterDigitalAssets(assets, numClusters) {
    // 특징 벡터 행렬 생성
    const featureMatrix = assets.map(asset => asset.features);
    
    // PCA를 사용한 차원 축소 (선택적)
    const pca = new PCA(featureMatrix);
    const reducedFeatures = pca.predict(featureMatrix, { nComponents: Math.min(10, featureMatrix[0].length) });
    
    // 계층적 클러스터링 실행
    const clustering = new AgglomerativeClustering({
      distanceFunction: (a, b) => {
        // 유클리드 거리
        return Math.sqrt(a.reduce((sum, val, i) => sum + Math.pow(val - b[i], 2), 0));
      },
      method: 'complete' // 완전 연결법
    });
    
    const clusterResult = clustering.cluster({
      data: reducedFeatures,
      numberOfClusters: numClusters
    });
    
    // 결과 매핑
    const assetClusters = assets.map((asset, index) => ({
      id: asset.id,
      cluster: clusterResult.clusters[index]
    }));
    
    return {
      assetClusters,
      clusterInfo: clusterResult
    };
  }

  /**
   * 디지털 자산 중요도 점수 계산
   * @param {Object} asset - 디지털 자산 객체
   * @returns {number} - 중요도 점수 (0-100)
   */
  calculateAssetImportance(asset) {
    let score = 0;
    const weights = {
      accessFrequency: 0.3,
      emotionalValue: 0.4,
      uniqueness: 0.2,
      fileSize: 0.1
    };
    
    // 1. 접근 빈도 점수 (0-10)
    const accessScore = Math.min(10, asset.accessCount / 10);
    
    // 2. 감정적 가치 점수 (텍스트 분석) (0-10)
    let emotionalScore = 5; // 기본값
    if (asset.content && typeof asset.content === 'string') {
      const sentiment = this.analyzeSentiment(asset.content);
      emotionalScore = Math.min(10, Math.abs(sentiment.score) * 2 + 5);
    }
    
    // 3. 고유성 점수 (0-10)
    const uniquenessScore = asset.isUnique ? 10 : 5;
    
    // 4. 파일 크기에 따른 점수 (작은 파일이 많은 경우 큰 파일이 더 중요할 수 있음) (0-10)
    const sizeScore = Math.min(10, Math.log10(asset.sizeInBytes) - 2);
    
    // 최종 점수 계산 (0-100)
    score = (
      weights.accessFrequency * accessScore +
      weights.emotionalValue * emotionalScore +
      weights.uniqueness * uniquenessScore +
      weights.fileSize * sizeScore
    ) * 10;
    
    return Math.max(0, Math.min(100, score));
  }

  /**
   * 디지털 자산 유사도 계산
   * @param {Object} assetA - 첫 번째 자산
   * @param {Object} assetB - 두 번째 자산
   * @returns {number} - 유사도 점수 (0-1)
   */
  calculateAssetSimilarity(assetA, assetB) {
    // 공통 메타데이터 특성에 기반한 유사도 계산
    let similarity = 0;
    let totalFeatures = 0;
    
    // 태그 유사도
    if (assetA.tags && assetB.tags) {
      const tagsA = new Set(assetA.tags);
      const tagsB = new Set(assetB.tags);
      const intersection = new Set([...tagsA].filter(tag => tagsB.has(tag)));
      const union = new Set([...tagsA, ...tagsB]);
      
      // 자카드 유사도
      similarity += intersection.size / union.size;
      totalFeatures++;
    }
    
    // 생성 시간 유사도
    if (assetA.createdAt && assetB.createdAt) {
      const timeA = new Date(assetA.createdAt).getTime();
      const timeB = new Date(assetB.createdAt).getTime();
      const timeDiff = Math.abs(timeA - timeB);
      const maxDiff = 365 * 24 * 60 * 60 * 1000; // 1년
      
      // 시간적 근접성 (1년 이내면 유사함)
      similarity += Math.max(0, 1 - (timeDiff / maxDiff));
      totalFeatures++;
    }
    
    // 콘텐츠 유형 유사도
    if (assetA.type === assetB.type) {
      similarity += 1;
    } else {
      similarity += 0;
    }
    totalFeatures++;
    
    return totalFeatures > 0 ? similarity / totalFeatures : 0;
  }

  /**
   * 비슷한 디지털 자산 추천
   * @param {string} assetId - 기준 자산 ID
   * @param {Array<Object>} assetPool - 자산 풀
   * @param {number} numRecommendations - 추천 수
   * @returns {Array<Object>} - 추천 자산 목록
   */
  recommendSimilarAssets(assetId, assetPool, numRecommendations = 5) {
    const targetAsset = assetPool.find(asset => asset.id === assetId);
    
    if (!targetAsset) {
      throw new Error(`자산 ID ${assetId}를 찾을 수 없습니다.`);
    }
    
    // 대상 자산과 다른 모든 자산 간의 유사도 계산
    const similarities = assetPool
      .filter(asset => asset.id !== assetId)
      .map(asset => ({
        asset,
        similarity: this.calculateAssetSimilarity(targetAsset, asset)
      }));
    
    // 유사도에 따라 정렬하고 상위 N개 추천
    const recommendations = similarities
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, numRecommendations)
      .map(item => ({
        ...item.asset,
        similarityScore: item.similarity
      }));
    
    return recommendations;
  }
}

module.exports = DigitalHeritageAI;