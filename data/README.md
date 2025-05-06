# Data Management Directory

This directory contains tools and resources for data generation, management, and processing for the Digital Heritage Management Platform.

## Contents

- **generators/** - Scripts and tools for generating virtual data for testing and AI model training
- **schemas/** - JSON schemas and data structure definitions
- **virtual/** - Generated virtual datasets
- **samples/** - Sample data for development and testing purposes

## Virtual Data Generation

The platform includes tools for generating realistic but synthetic data for development, testing, and training AI models. To generate virtual data:

```bash
# Generate virtual user data
npm run generate:users

# Generate virtual digital assets data
npm run generate:assets

# Generate virtual inheritance scenarios
npm run generate:scenarios

# Generate comprehensive test datasets
npm run generate:all
```

Generated data is saved in the `virtual/` directory and can be used for:

1. Training AI models for asset classification
2. Testing the inheritance flow
3. Performance benchmarking
4. Security testing

## Schema Documentation

Data schemas are defined in the `schemas/` directory using JSON Schema standard. Key schemas include:

- **user.schema.json** - User profile data structure
- **asset.schema.json** - Digital asset metadata structure
- **inheritance.schema.json** - Inheritance rules and beneficiary assignments
- **memorial.schema.json** - Digital memorial space configuration

## Data Protection

All data in this directory is protected in accordance with the platform's security standards:

- All sensitive data is encrypted
- Personal identifiable information (PII) is pseudonymized
- Sample and virtual data comply with data protection regulations

---

*Note: This technical content is based on patented technology filed by Ucaretron Inc.*
