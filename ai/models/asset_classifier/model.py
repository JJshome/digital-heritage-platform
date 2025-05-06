"""
Digital Asset Classifier Model

This module defines a deep learning model for classifying digital assets 
based on their metadata and content. The model uses a combination of 
text processing and feature engineering to categorize assets and predict
their importance.

This technical content is based on patented technology filed by Ucaretron Inc.
"""

import torch
import torch.nn as nn
import torch.nn.functional as F
import numpy as np
from transformers import BertModel, BertTokenizer

class AssetClassifierConfig:
    """Configuration for the Asset Classifier model."""
    
    def __init__(self):
        # Text processing
        self.bert_model_name = 'klue/bert-base'  # Korean BERT model
        self.max_text_length = 128
        self.text_embedding_dim = 768  # BERT base hidden size
        
        # Metadata feature sizes
        self.num_categories = 8
        self.num_file_types = 50
        self.num_storage_types = 6
        
        # Model architecture
        self.metadata_embedding_dim = 64
        self.combined_hidden_dim = 256
        self.dropout_rate = 0.3
        
        # Output dimensions
        self.num_asset_categories = 8
        self.num_importance_levels = 10  # 1-10 importance scale

class AssetMetadataEncoder(nn.Module):
    """Encodes asset metadata features."""
    
    def __init__(self, config):
        super(AssetMetadataEncoder, self).__init__()
        self.config = config
        
        # Embedding layers for categorical features
        self.category_embedding = nn.Embedding(
            config.num_categories, config.metadata_embedding_dim)
        self.file_type_embedding = nn.Embedding(
            config.num_file_types, config.metadata_embedding_dim)
        self.storage_type_embedding = nn.Embedding(
            config.num_storage_types, config.metadata_embedding_dim)
        
        # Numerical feature processing
        self.numeric_features_projection = nn.Linear(5, config.metadata_embedding_dim)
        
        # Combine features
        self.feature_combiner = nn.Sequential(
            nn.Linear(config.metadata_embedding_dim * 4, config.metadata_embedding_dim * 2),
            nn.LayerNorm(config.metadata_embedding_dim * 2),
            nn.ReLU(),
            nn.Dropout(config.dropout_rate),
            nn.Linear(config.metadata_embedding_dim * 2, config.metadata_embedding_dim),
            nn.LayerNorm(config.metadata_embedding_dim),
            nn.ReLU()
        )
    
    def forward(self, category_ids, file_type_ids, storage_type_ids, numeric_features):
        """Forward pass for metadata encoder.
        
        Args:
            category_ids: Asset category IDs (batch_size)
            file_type_ids: File type IDs (batch_size)
            storage_type_ids: Storage type IDs (batch_size)
            numeric_features: Numeric features like file size, age (batch_size, 5)
        
        Returns:
            Encoded metadata representation (batch_size, metadata_embedding_dim)
        """
        # Encode categorical features
        category_emb = self.category_embedding(category_ids)
        file_type_emb = self.file_type_embedding(file_type_ids)
        storage_type_emb = self.storage_type_embedding(storage_type_ids)
        
        # Process numeric features
        numeric_emb = self.numeric_features_projection(numeric_features)
        
        # Combine all features
        combined = torch.cat([
            category_emb, file_type_emb, storage_type_emb, numeric_emb
        ], dim=1)
        
        return self.feature_combiner(combined)

class AssetTextEncoder(nn.Module):
    """Encodes text content and descriptions of assets."""
    
    def __init__(self, config):
        super(AssetTextEncoder, self).__init__()
        self.config = config
        
        # Load pre-trained BERT model
        self.tokenizer = BertTokenizer.from_pretrained(config.bert_model_name)
        self.bert = BertModel.from_pretrained(config.bert_model_name)
        
        # Freeze BERT parameters to avoid overfitting on small dataset
        for param in self.bert.parameters():
            param.requires_grad = False
        
        # Only fine-tune the last few layers
        for param in self.bert.encoder.layer[-2:].parameters():
            param.requires_grad = True
        
        # Text feature projection
        self.text_projection = nn.Sequential(
            nn.Linear(config.text_embedding_dim, config.metadata_embedding_dim),
            nn.LayerNorm(config.metadata_embedding_dim),
            nn.ReLU()
        )
    
    def forward(self, text_inputs):
        """Forward pass for text encoder.
        
        Args:
            text_inputs: Dict with 'input_ids', 'attention_mask', 'token_type_ids'
        
        Returns:
            Encoded text representation (batch_size, metadata_embedding_dim)
        """
        # Get BERT embeddings
        outputs = self.bert(
            input_ids=text_inputs['input_ids'],
            attention_mask=text_inputs['attention_mask'],
            token_type_ids=text_inputs['token_type_ids']
        )
        
        # Use [CLS] token representation for the entire text
        cls_output = outputs.last_hidden_state[:, 0, :]
        
        # Project to the same dimension as metadata features
        return self.text_projection(cls_output)

class DigitalAssetClassifier(nn.Module):
    """End-to-end model for digital asset classification and importance prediction."""
    
    def __init__(self, config):
        super(DigitalAssetClassifier, self).__init__()
        self.config = config
        
        # Encoders for different types of inputs
        self.metadata_encoder = AssetMetadataEncoder(config)
        self.text_encoder = AssetTextEncoder(config)
        
        # Combine text and metadata features
        self.combined_encoder = nn.Sequential(
            nn.Linear(config.metadata_embedding_dim * 2, config.combined_hidden_dim),
            nn.LayerNorm(config.combined_hidden_dim),
            nn.ReLU(),
            nn.Dropout(config.dropout_rate),
            nn.Linear(config.combined_hidden_dim, config.combined_hidden_dim),
            nn.LayerNorm(config.combined_hidden_dim),
            nn.ReLU(),
            nn.Dropout(config.dropout_rate)
        )
        
        # Output layers
        self.category_classifier = nn.Linear(config.combined_hidden_dim, config.num_asset_categories)
        self.importance_predictor = nn.Linear(config.combined_hidden_dim, config.num_importance_levels)
        self.sentiment_predictor = nn.Linear(config.combined_hidden_dim, 1)  # Regression: -1 to 1
    
    def forward(self, metadata_inputs, text_inputs):
        """Forward pass for the complete model.
        
        Args:
            metadata_inputs: Dict with metadata features
            text_inputs: Dict with text features
        
        Returns:
            Dict with category logits, importance logits, and sentiment score
        """
        # Encode metadata
        metadata_features = self.metadata_encoder(
            metadata_inputs['category_ids'],
            metadata_inputs['file_type_ids'],
            metadata_inputs['storage_type_ids'],
            metadata_inputs['numeric_features']
        )
        
        # Encode text
        text_features = self.text_encoder(text_inputs)
        
        # Combine features
        combined_features = torch.cat([metadata_features, text_features], dim=1)
        encoded_features = self.combined_encoder(combined_features)
        
        # Generate predictions
        category_logits = self.category_classifier(encoded_features)
        importance_logits = self.importance_predictor(encoded_features)
        sentiment = torch.tanh(self.sentiment_predictor(encoded_features))
        
        return {
            'category_logits': category_logits,
            'importance_logits': importance_logits,
            'sentiment': sentiment
        }

def create_model():
    """Factory function to create and initialize the model."""
    config = AssetClassifierConfig()
    model = DigitalAssetClassifier(config)
    return model, config

def preprocess_asset(asset_data, tokenizer, config):
    """Preprocess a single asset for model input.
    
    Args:
        asset_data: Dict containing asset information
        tokenizer: BERT tokenizer
        config: Model configuration
        
    Returns:
        Dict with preprocessed model inputs
    """
    # Process text data
    text = f"{asset_data.get('name', '')} {asset_data.get('description', '')}"
    text_inputs = tokenizer(
        text,
        max_length=config.max_text_length,
        padding='max_length',
        truncation=True,
        return_tensors='pt'
    )
    
    # Process metadata
    # (In actual implementation, these would be mapped to indices)
    category_id = torch.tensor([0])  # Placeholder
    file_type_id = torch.tensor([0])  # Placeholder
    storage_type_id = torch.tensor([0])  # Placeholder
    
    # Generate numeric features
    file_size = float(asset_data.get('fileSize', 0))
    if asset_data.get('fileSizeUnit') == 'GB':
        file_size *= 1024
    elif asset_data.get('fileSizeUnit') == 'KB':
        file_size /= 1024
    
    # Calculate asset age in days
    creation_date = asset_data.get('creationDate')
    if creation_date:
        from datetime import datetime
        try:
            creation_time = datetime.fromisoformat(creation_date.replace('Z', '+00:00'))
            age_days = (datetime.now() - creation_time).days
        except (ValueError, TypeError):
            age_days = 0
    else:
        age_days = 0
    
    # Normalized numeric features
    numeric_features = torch.tensor([
        [
            np.log1p(file_size) / 10,  # Log-normalized file size
            age_days / 365,  # Age in years (normalized)
            int(asset_data.get('isEncrypted', False)),
            int(asset_data.get('isShared', False)),
            len(asset_data.get('sharedWith', [])) / 10  # Normalized share count
        ]
    ], dtype=torch.float32)
    
    return {
        'metadata_inputs': {
            'category_ids': category_id,
            'file_type_ids': file_type_id,
            'storage_type_ids': storage_type_id,
            'numeric_features': numeric_features
        },
        'text_inputs': text_inputs
    }

def predict_asset_properties(model, asset_data, tokenizer, config):
    """Make predictions for a single asset.
    
    Args:
        model: Trained DigitalAssetClassifier model
        asset_data: Dict containing asset information
        tokenizer: BERT tokenizer
        config: Model configuration
        
    Returns:
        Dict with predicted category, importance, and sentiment
    """
    # Preprocess asset data
    inputs = preprocess_asset(asset_data, tokenizer, config)
    
    # Run inference
    model.eval()
    with torch.no_grad():
        outputs = model(inputs['metadata_inputs'], inputs['text_inputs'])
    
    # Get predictions
    category_id = torch.argmax(outputs['category_logits'], dim=1).item()
    importance = torch.argmax(outputs['importance_logits'], dim=1).item() + 1  # 1-10 scale
    sentiment = outputs['sentiment'].item()
    
    # Map category ID to category name (placeholder implementation)
    categories = [
        'documents', 'photos', 'videos', 'emails', 
        'financialAssets', 'digitalCreations', 'socialMedia', 'credentials'
    ]
    category = categories[category_id]
    
    return {
        'predicted_category': category,
        'predicted_importance': importance,
        'predicted_sentiment': sentiment
    }

# Example usage
if __name__ == "__main__":
    import json
    
    # Create model
    model, config = create_model()
    tokenizer = BertTokenizer.from_pretrained(config.bert_model_name)
    
    # Sample asset data
    sample_asset = {
        "name": "가족 사진 모음.jpg",
        "description": "우리 가족의 특별한 순간들을 담은 소중한 추억",
        "fileSize": 2.5,
        "fileSizeUnit": "MB",
        "creationDate": "2023-05-15T09:30:00Z",
        "isEncrypted": False,
        "isShared": True,
        "sharedWith": [
            {"name": "김철수", "email": "chulsoo@example.com"}
        ]
    }
    
    # Make predictions
    predictions = predict_asset_properties(model, sample_asset, tokenizer, config)
    print(json.dumps(predictions, indent=2, ensure_ascii=False))
