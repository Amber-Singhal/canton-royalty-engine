# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- `RoyaltyAgreement` template to define royalty splits between rights holders.
- `UsageReport` template for licensees to report content usage.
- `RoyaltyCalculation` template to automatically calculate royalty amounts based on usage and splits.
- `Distribution` choice on `RoyaltyCalculation` to generate `PaymentObligation` contracts for each rights holder.

### Changed
- Upgraded Canton SDK to 3.4.0 and migrated to DPM build tool.

### Fixed
- Corrected party mapping in `DisputeTest.daml` to ensure proper signatory rights.


## [0.1.0] - 2024-05-15

### Added
- Initial project structure for the Canton Royalty Engine.
- `daml.yaml` configured for a DPM-based build.
- `Dispute` Daml template (`daml/Dispute.daml`) allowing licensees or rights holders to open a dispute regarding a usage report.
- `DisputeTest.daml` providing Daml Script tests for the full dispute lifecycle: initiation, evidence submission, and resolution.
- `UsageReportForm.tsx` React component stub for the frontend application.
- `README.md` with project description, goals, and setup instructions.
- `docs/ROYALTY_MODEL.md` outlining the high-level concepts and data models.
- `.gitignore` for a standard Daml/Canton and TypeScript project.
- Basic GitHub Actions CI workflow to build and test the Daml models.