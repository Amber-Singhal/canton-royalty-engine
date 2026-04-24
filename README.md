# Canton Royalty Engine

[![CI](https://github.com/digital-asset/canton-royalty-engine/actions/workflows/ci.yml/badge.svg)](https://github.com/digital-asset/canton-royalty-engine/actions/workflows/ci.yml)

The Canton Royalty Engine is a decentralized application for transparent, automated, and real-time royalty calculation and distribution for digital content. Built on the Canton Network using Daml smart contracts, it provides an immutable, auditable, and privacy-preserving system for creators, rights holders, and content licensees.

This platform replaces opaque, slow, and error-prone manual royalty accounting with a shared, trusted ledger that programmatically enforces royalty agreements.

## Key Features

*   **On-Chain Royalty Splits:** Creators define and register royalty distribution shares for each piece of content directly on the ledger.
*   **Automated Distribution:** When licensees report revenue, the engine automatically calculates and distributes payments to all rights holders in proportion to their registered shares.
*   **Atomic Settlement:** Royalty payments are settled atomically using Canton-native tokens (e.g., stablecoins), ensuring that fund transfers and obligation fulfillment happen in a single, indivisible step.
*   **Full Audit Trail:** Every action, from agreement creation to usage reporting and payment, is immutably recorded, providing a complete and verifiable history for all stakeholders.
*   **Privacy by Design:** Canton's privacy model ensures that contract details are only visible to the involved parties, protecting sensitive financial and contractual information.

---

## How It Works: The Royalty Lifecycle

The process is divided into three main phases: Setup, Usage Reporting, and Distribution.

![Workflow Diagram](docs/ROYALTY_MODEL.md)

### 1. Onboarding & Content Registration (Creators)

1.  **Onboarding:** A **Royalty Service Provider** (the operator of the platform) onboards creators and other rights holders (e.g., publishers, producers) onto the network, assigning them a unique party identifier.
2.  **Content Registration:** The primary creator registers a new piece of content (e.g., a song, an e-book, a digital art piece).
3.  **Define Splits:** The creator defines the royalty split agreement, specifying the percentage share for each rights holder. This is captured in a `RoyaltyAgreement` smart contract. All specified rights holders must agree to the terms, creating a multi-party, signed agreement on the ledger.

### 2. Usage Reporting (Licensees)

1.  **License Grant:** The Royalty Service Provider grants a usage license to a content platform (e.g., a streaming service, an online marketplace).
2.  **Report Usage:** The licensee periodically reports usage metrics and the gross revenue generated from the content. This is submitted as a `UsageReport` contract proposal to the Royalty Service Provider.
3.  **Verification & Acceptance:** The provider verifies the report. Upon acceptance, the report becomes a mutually agreed-upon fact on the ledger, creating an obligation for the licensee to pay the calculated royalties.

### 3. Calculation & Distribution (Automated)

1.  **Royalty Calculation:** The acceptance of the `UsageReport` triggers an automated process. The system references the `RoyaltyAgreement` to calculate the total royalty amount due and the specific payment owed to each rights holder.
2.  **Payment Instruction:** The system creates `RoyaltyEntitlement` contracts, one for each rights holder, detailing the exact amount they are owed.
3.  **Atomic Settlement:** The licensee settles their obligation by funding the distribution. This is typically done via an atomic Delivery-vs-Payment (DVP) transaction, where the licensee's payment is automatically and proportionally distributed to each rights holder's digital wallet in a single, trustless transaction.

---

## User Guides

### For Creators & Rights Holders

As a creator or rights holder, the platform enables you to manage your intellectual property and receive payments transparently.

**Your Workflow:**

1.  **Contact the Service Provider:** Get onboarded to receive your secure digital identity on the Canton Network.
2.  **Register Your Content:** Use the platform's dashboard to register your work. You will be the initial owner.
3.  **Define Your Collaborators:** Invite your co-creators, publisher, or other rights holders to the royalty agreement. Enter their party identifier and the percentage share they are entitled to.
4.  **Finalize Agreement:** Once all parties have digitally signed the `RoyaltyAgreement`, it becomes active on the ledger.
5.  **Monitor Earnings:** The dashboard provides a real-time view of usage reports and your accrued earnings. You will receive payments directly to your connected wallet as soon as licensees settle their reports.

### For Licensees

As a licensee, the platform simplifies your royalty accounting and payment obligations.

**Your Workflow:**

1.  **Get a License:** Contact the Service Provider to get onboarded and receive a license for the content you wish to use.
2.  **Submit Usage Reports:** On a periodic basis (e.g., monthly), use the dashboard to submit a `UsageReport`. You will need to provide:
    *   The content identifier.
    *   The reporting period.
    *   The gross revenue generated.
3.  **Await Verification:** The Service Provider will review and approve your report.
4.  **Settle Payments:** Once the report is approved, the system will show you the total royalty amount due. You can initiate a payment from your connected wallet to settle the obligation. The platform ensures your single payment is correctly distributed to all underlying rights holders automatically.

---

## Technical Stack

*   **Smart Contracts:** Daml
*   **Ledger:** Canton Network
*   **Daml SDK Version:** 3.4.0 (using DPM)
*   **Frontend:** TypeScript, React, Vite
*   **UI Components:** Material UI
*   **Ledger Integration:** `@c7/ledger`, `@c7/react`

## Development Setup

### Prerequisites

*   **DPM (Daml Package Manager):** [Installation Guide](https://docs.digitalasset.com/dpm/install.html)
*   **Node.js:** v18 or later
*   **Java:** JDK 11

### Running the Application

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/digital-asset/canton-royalty-engine.git
    cd canton-royalty-engine
    ```

2.  **Build the Daml models:**
    This compiles your Daml code into a DAR (Daml Archive).
    ```bash
    dpm build
    ```

3.  **Start the Canton Sandbox Ledger:**
    This command starts a local, single-node Canton ledger and exposes the JSON API on port 7575.
    ```bash
    dpm sandbox
    ```

4.  **Install frontend dependencies:**
    Navigate to the `frontend` directory and install the required npm packages.
    ```bash
    cd frontend
    npm install
    ```

5.  **Run the frontend application:**
    This will start the React development server, typically on `http://localhost:3000`.
    ```bash
    npm start
    ```

The application should now be running and connected to your local Canton sandbox. You can interact with the UI to onboard parties and test the royalty management workflows.